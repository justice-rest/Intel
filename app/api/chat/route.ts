import { SYSTEM_PROMPT_DEFAULT, AI_MAX_OUTPUT_TOKENS } from "@/lib/config"
import { getAllModels, normalizeModelId } from "@/lib/models"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import { createListDocumentsTool } from "@/lib/tools/list-documents"
import { createRagSearchTool } from "@/lib/tools/rag-search"
import { createMemorySearchTool } from "@/lib/tools/memory-tool"
import { createBatchReportsSearchTool } from "@/lib/tools/batch-reports-search"
import {
  yahooFinanceQuoteTool,
  yahooFinanceSearchTool,
  yahooFinanceProfileTool,
  shouldEnableYahooFinanceTools,
} from "@/lib/tools/yahoo-finance"
import {
  propublicaNonprofitSearchTool,
  propublicaNonprofitDetailsTool,
  shouldEnableProPublicaTools,
} from "@/lib/tools/propublica-nonprofits"
import { secEdgarFilingsTool, shouldEnableSecEdgarTools } from "@/lib/tools/sec-edgar"
import {
  secInsiderSearchTool,
  secProxySearchTool,
  shouldEnableSecInsiderTools,
} from "@/lib/tools/sec-insider"
import { fecContributionsTool, shouldEnableFecTools } from "@/lib/tools/fec-contributions"
import { usGovDataTool, shouldEnableUsGovDataTools } from "@/lib/tools/us-gov-data"
import {
  wikidataSearchTool,
  wikidataEntityTool,
  shouldEnableWikidataTools,
} from "@/lib/tools/wikidata"
import {
  rentalInvestmentTool,
  shouldEnableRentalInvestmentTool,
} from "@/lib/tools/rental-investment-tool"
import {
  opensanctionsScreeningTool,
  shouldEnableOpenSanctionsTools,
} from "@/lib/tools/opensanctions"
import {
  courtSearchTool,
  judgeSearchTool,
  shouldEnableCourtListenerTools,
} from "@/lib/tools/courtlistener"
import {
  businessLookupTool,
  shouldEnableBusinessLookupTool,
} from "@/lib/tools/business-lookup"
import {
  gleifSearchTool,
  gleifLookupTool,
  shouldEnableGleifTools,
} from "@/lib/tools/gleif-lei"
import {
  neonCRMSearchAccountsTool,
  neonCRMGetAccountTool,
  neonCRMSearchDonationsTool,
  shouldEnableNeonCRMTools,
} from "@/lib/tools/neon-crm"
import {
  countyAssessorTool,
  shouldEnableCountyAssessorTool,
} from "@/lib/tools/county-assessor"
import {
  professionalLicenseTool,
  shouldEnableProfessionalLicenseTool,
} from "@/lib/tools/professional-license"
import {
  stateContractsTool,
  shouldEnableStateContractsTool,
} from "@/lib/tools/state-contracts"
// business-entities merged into business-lookup
import {
  faaAircraftTool,
  shouldEnableFAAAircraftTool,
} from "@/lib/tools/faa-aircraft"
import {
  uscgVesselTool,
  shouldEnableUSCGVesselTool,
} from "@/lib/tools/uscg-vessels"
import {
  npiRegistryTool,
  shouldEnableNPIRegistryTool,
} from "@/lib/tools/npi-registry"
import {
  finraBrokerCheckTool,
  shouldEnableFINRABrokerCheckTool,
} from "@/lib/tools/finra-brokercheck"
import {
  usptoSearchTool,
  shouldEnableUSPTOSearchTool,
} from "@/lib/tools/uspto-search"
import {
  nycPropertySalesTool,
  shouldEnableNYCPropertySalesTool,
} from "@/lib/tools/nyc-property-sales"
import {
  acrisDeedsTool,
  shouldEnableACRISDeedsTool,
} from "@/lib/tools/nyc-acris-deeds"
import {
  cmsOpenPaymentsTool,
  shouldEnableCMSOpenPaymentsTool,
} from "@/lib/tools/cms-open-payments"
import {
  federalLobbyingTool,
  shouldEnableFederalLobbyingTool,
} from "@/lib/tools/federal-lobbying"
import {
  givingCapacityCalculatorTool,
  shouldEnableGivingCapacityCalculatorTool,
} from "@/lib/tools/giving-capacity-calculator"
import {
  searchCRMConstituents,
  hasCRMConnections,
} from "@/lib/tools/crm-search"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import { getSystemPromptWithContext } from "@/lib/onboarding-context"
import { optimizeMessagePayload } from "@/lib/message-payload-optimizer"
import { Attachment } from "@ai-sdk/ui-utils"
import { Message as MessageAISDK, streamText, smoothStream, ToolSet, tool } from "ai"
import { z } from "zod"
import {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from "./api"
import { createErrorResponse, extractErrorMessage, cleanMessagesForTools } from "./utils"

// Increase timeout to 5 minutes for large PDFs + web search operations
// Note: Vercel Pro allows up to 300 seconds (5 min) for serverless functions
export const maxDuration = 300

// OPTIMIZATION: Prefer streaming for faster response delivery
export const preferredRegion = "auto" // Use closest region to reduce latency
export const dynamic = "force-dynamic" // Ensure fresh responses

type ChatRequest = {
  messages: MessageAISDK[]
  chatId: string
  userId: string
  model: string
  isAuthenticated: boolean
  systemPrompt: string
  enableSearch: boolean
  message_group_id?: string
  editCutoffTimestamp?: string
}

export async function POST(req: Request) {
  try {
    const {
      messages,
      chatId,
      userId,
      model,
      isAuthenticated,
      systemPrompt,
      enableSearch,
      message_group_id,
      editCutoffTimestamp,
    } = (await req.json()) as ChatRequest

    if (!messages || !chatId || !userId) {
      return new Response(
        JSON.stringify({ error: "Error, missing information" }),
        { status: 400 }
      )
    }

    // Normalize model ID for backwards compatibility (e.g., grok-4-fast → grok-4.1-fast)
    const normalizedModel = normalizeModelId(model)

    // Determine if we should inject memories (check early for parallel execution)
    const shouldInjectMemory = isAuthenticated && messages.length >= 3

    /**
     * OPTIMIZATION: Parallelize ALL independent operations including memory retrieval
     * Memory now runs IN PARALLEL with validation, not after it
     * This eliminates ~150-300ms of sequential latency
     */
    const [
      supabase,
      allModels,
      effectiveSystemPrompt,
      apiKey,
      memoryResult,
      batchReportsResult,
      hasCRM
    ] = await Promise.all([
      // 1. Validate user and check rate limits (critical - blocks streaming)
      validateAndTrackUsage({
        userId,
        model: normalizedModel,
        isAuthenticated,
      }),
      // 2. Get all models config (needed for streaming)
      getAllModels(),
      // 3. Get system prompt with onboarding context (cached after first request)
      (async () => {
        const baseSystemPrompt = systemPrompt || SYSTEM_PROMPT_DEFAULT
        return await getSystemPromptWithContext(
          isAuthenticated ? userId : null,
          baseSystemPrompt
        )
      })(),
      // 4. Get user API key if authenticated (needed for streaming)
      (async () => {
        if (!isAuthenticated || !userId) return undefined
        const { getEffectiveApiKey } = await import("@/lib/user-keys")
        const provider = getProviderForModel(normalizedModel)
        return (await getEffectiveApiKey(userId, provider as ProviderWithoutOllama)) || undefined
      })(),
      // 5. MEMORY RETRIEVAL - Now runs in parallel with everything else!
      (async (): Promise<string | null> => {
        if (!shouldInjectMemory) return null

        try {
          const { getMemoriesForAutoInject, formatMemoriesForPrompt, buildConversationContext, isMemoryEnabled } = await import("@/lib/memory")

          if (!isMemoryEnabled()) return null

          const conversationContext = buildConversationContext(
            messages.slice(-3).map((m) => ({ role: m.role, content: String(m.content) }))
          )

          if (!conversationContext) return null

          // Use env key since user key isn't available yet in parallel
          const relevantMemories = await getMemoriesForAutoInject(
            {
              conversationContext,
              userId,
              count: 3,
              minImportance: 0.4,
            },
            process.env.OPENROUTER_API_KEY || ""
          )

          if (relevantMemories.length > 0) {
            return formatMemoriesForPrompt(relevantMemories)
          }
          return null
        } catch (error) {
          console.error("Failed to retrieve memories:", error)
          return null
        }
      })(),
      // 6. BATCH REPORTS RETRIEVAL - Retrieve relevant prospect research
      (async (): Promise<string | null> => {
        if (!shouldInjectMemory) return null

        try {
          const { getBatchReportsForAutoInject, formatBatchReportsForPrompt, isBatchReportsRAGEnabled } = await import("@/lib/batch-reports")
          const { buildConversationContext } = await import("@/lib/memory")

          if (!isBatchReportsRAGEnabled()) return null

          const conversationContext = buildConversationContext(
            messages.slice(-3).map((m) => ({ role: m.role, content: String(m.content) }))
          )

          if (!conversationContext) return null

          const relevantReports = await getBatchReportsForAutoInject(
            {
              conversationContext,
              userId,
              count: 3,
            },
            process.env.OPENROUTER_API_KEY || ""
          )

          if (relevantReports.length > 0) {
            return formatBatchReportsForPrompt(relevantReports)
          }
          return null
        } catch (error) {
          console.error("Failed to retrieve batch reports:", error)
          return null
        }
      })(),
      // 7. CRM CONNECTIONS CHECK - Check if user has connected CRMs
      (async (): Promise<boolean> => {
        if (!isAuthenticated) return false
        try {
          return await hasCRMConnections(userId)
        } catch (error) {
          console.error("Failed to check CRM connections:", error)
          return false
        }
      })()
    ])

    // Verify model config exists
    const modelConfig = allModels.find((m) => m.id === normalizedModel)
    if (!modelConfig || !modelConfig.apiSdk) {
      throw new Error(`Model ${normalizedModel} not found`)
    }

    /**
     * CRITICAL: Increment message count BEFORE streaming
     * This prevents race conditions where multiple rapid requests could bypass rate limits
     * The increment must complete before streaming starts to ensure accurate counting
     */
    if (supabase) {
      await incrementMessageCount({
        supabase,
        userId,
        isAuthenticated,
        model: normalizedModel
      })
    }

    const userMessage = messages[messages.length - 1]

    // Combine system prompt with memory and batch reports context (if retrieved)
    let finalSystemPrompt = effectiveSystemPrompt
    if (memoryResult) {
      finalSystemPrompt = `${finalSystemPrompt}\n\n${memoryResult}`
    }
    if (batchReportsResult) {
      finalSystemPrompt = `${finalSystemPrompt}\n\n${batchReportsResult}`
    }

    // Add CRM guidance when user has connected CRMs
    if (hasCRM) {
      finalSystemPrompt += `\n\n## CRM Integration
You have access to the user's connected CRM systems (Bloomerang/Virtuous).
- **crm_search**: Search synced CRM data for constituent/donor info (name, email, address, giving history)

**Best Practice**: ALWAYS use crm_search FIRST when researching a donor who might already be in the CRM.
This provides existing giving history and contact details before running external prospect research.`
    }

    // Add search guidance when search is enabled
    // Note: Perplexity Sonar Reasoning has built-in web search - no need for separate search tools
    if (enableSearch) {
      // Data API tools (direct access to authoritative sources)
      const dataTools: string[] = []
      if (shouldEnableSecEdgarTools()) dataTools.push("sec_edgar_filings (SEC 10-K/10-Q filings, financial statements, executive compensation)")
      if (shouldEnableSecInsiderTools()) dataTools.push("sec_insider_search (verify if person is officer/director at public company via Form 4)")
      if (shouldEnableSecInsiderTools()) dataTools.push("sec_proxy_search (DEF 14A proxy statements - lists all directors/officers)")
      if (shouldEnableFecTools()) dataTools.push("fec_contributions (FEC political contributions by individual name)")
      if (shouldEnableYahooFinanceTools()) dataTools.push("yahoo_finance_* (stock quotes, company profiles, insider holdings)")
      if (shouldEnableProPublicaTools()) dataTools.push("propublica_nonprofit_* (foundation 990s, nonprofit financials)")
      if (shouldEnableUsGovDataTools()) dataTools.push("usaspending_awards (federal contracts/grants/loans by company/org name)")
      if (shouldEnableWikidataTools()) dataTools.push("wikidata_search/entity (biographical data: education, employers, positions, net worth, awards)")
      if (shouldEnableRentalInvestmentTool()) dataTools.push("rental_investment (rental analysis: monthly rent estimate, GRM, cap rate, cash-on-cash return, cash flow)")
      if (shouldEnableBusinessLookupTool()) dataTools.push("business_lookup (UNIFIED: search companies OR find person's business ownership - CO, CT, NY, OR, IA, WA, FL)")
      if (shouldEnableGleifTools()) dataTools.push("gleif_search / gleif_lookup (Global LEI database - 2.5M+ entities, corporate ownership chains)")
      if (shouldEnableNeonCRMTools()) dataTools.push("neon_crm_* (Neon CRM integration: search accounts/donors, get donor details, search donations - requires API key)")
      if (shouldEnableOpenSanctionsTools()) dataTools.push("opensanctions_screening (PEP/sanctions screening - OFAC, EU, UN sanctions + politically exposed persons)")
      if (shouldEnableCourtListenerTools()) dataTools.push("court_search / judge_search (federal court records, opinions, dockets, judge profiles)")
      if (shouldEnableProfessionalLicenseTool()) dataTools.push("professional_license (verify credentials: MD, JD, CPA, Real Estate - CA, NY, TX, FL, IL)")
      if (shouldEnableStateContractsTool()) dataTools.push("state_contracts (state government contracts - CA, NY, TX, FL, IL, OH, CO, MA)")
      if (shouldEnableFAAAircraftTool()) dataTools.push("faa_aircraft (FAA N-Number registry - aircraft ownership - ULTRA-HIGH wealth indicator)")
      if (shouldEnableUSCGVesselTool()) dataTools.push("uscg_vessels (USCG vessel documentation - boat/yacht ownership - HIGH wealth indicator)")
      if (shouldEnableNPIRegistryTool()) dataTools.push("npi_registry (CMS NPI Registry - healthcare providers - income by specialty)")
      if (shouldEnableFINRABrokerCheckTool()) dataTools.push("finra_brokercheck (FINRA BrokerCheck - financial advisors - HIGH income profession)")
      if (shouldEnableUSPTOSearchTool()) dataTools.push("uspto_search (USPTO patents/trademarks - inventors, assignees - IP wealth indicator)")

      if (dataTools.length > 0) {
        finalSystemPrompt += `\n\n## Prospect Research Tools

You have built-in web search capabilities through Perplexity Sonar Reasoning. Use this naturally to search the web for prospect information - property records, business affiliations, philanthropic activity, news articles, etc.

### Data API Tools
${dataTools.join("\n")}

**Usage:**
- sec_edgar_filings: Public company financials, 10-K/10-Q, executive compensation
- sec_insider_search: Verify board membership - search Form 3/4/5 by person name
- sec_proxy_search: Get DEF 14A proxy statements listing all directors/officers
- fec_contributions: Political contribution history by individual name
- yahoo_finance_*: Stock data, company profiles, insider holdings
- propublica_nonprofit_*: Foundation 990s, nonprofit financials (search by ORG name)
- usaspending_awards: Federal contracts/grants by company/org name
- wikidata_search/entity: Biographical data (education, employers, net worth)
- rental_investment: Rental analysis - estimates monthly rent and investment returns
- business_lookup: **USE THIS** for "what businesses does [person] own?" OR "find info about [company]" - searches CO, CT, NY, OR, IA, WA, FL state registries
- gleif_search: Search Global LEI database for corporate entities (2.5M+ entities)
- gleif_lookup: Get LEI details with ownership chain (direct/ultimate parent)
- opensanctions_screening: PEP & sanctions check - returns risk level (HIGH/MEDIUM/LOW/CLEAR)
- federal_lobbying: Federal lobbying disclosures with income/expense data
- court_search: Federal court opinions and dockets by party name or case
- judge_search: Judge biographical data, positions, appointers, education
- neon_crm_search_accounts: Search donors in Neon CRM by name/email
- neon_crm_get_account: Get detailed donor profile and giving history from Neon CRM
- neon_crm_search_donations: Search donations in Neon CRM by date, amount, campaign
- professional_license: Verify credentials (MD, JD, CPA, Real Estate) - wealth indicator from profession
- state_contracts: State government contracts - $1M+ contracts suggest successful business
- faa_aircraft: FAA aircraft registry - ULTRA-HIGH wealth ($500K-$70M+ aircraft)
- uscg_vessels: USCG vessel documentation - yacht/boat ownership ($25K-$50M+)
- npi_registry: Healthcare provider credentials - income estimates by specialty ($100K-$900K)
- finra_brokercheck: Financial advisor credentials - HIGH income ($80K-$1M+)
- uspto_search: Patent/trademark search by inventor or assignee - IP wealth indicator

### Research Strategy
1. Use your **built-in web search** for general prospect research (property values, business affiliations, philanthropy)
2. Use **data API tools** to get detailed structured data from authoritative sources
3. **propublica workflow**: Search web for nonprofit names → propublica_nonprofit_search with ORG name
4. **compliance screening**: ALWAYS run opensanctions_screening for major donor prospects (PEP/sanctions check)
5. **wealth screening**: Run **faa_aircraft** + **uscg_vessels** for luxury asset discovery
6. **professional verification**: Run **npi_registry** (doctors) or **finra_brokercheck** (finance)
7. Run tools in parallel when possible. Be thorough.

### Business & Ownership Research (IMPORTANT)
**Choose the right tool based on your goal:**

| Goal | Tool | When to Use |
|------|------|-------------|
| "What businesses does [person] own?" | **business_lookup** (searchType="person") | Person→Business search. Searches state registries with ownership inference. |
| "Is [person] a director/officer at any PUBLIC companies?" | Use **sec_insider_search** + **sec_proxy_search** | SEC EDGAR filings. Best for public company roles. |
| "Find info about [company name]" | **business_lookup** (searchType="company") | Company→Details search. Gets registration, officers, status. |

**Supported States (Free APIs):**
- **Colorado (CO)**: Open Data API - entity + agent search
- **Connecticut (CT)**: Open Data API - best-in-class, updated nightly
- **New York (NY)**: Open Data API - fastest and most reliable
- **Oregon (OR)**, **Iowa (IA)**, **Washington (WA)**: Open Data APIs
- **Florida (FL)**: HTTP scraper (no browser needed) - good officer data

**Other States:** Use built-in web search for states not supported by direct APIs.

**Ownership Inference (business_lookup):**
- LLC Managing Member = likely owner
- S-Corp President/CEO/Secretary = often sole owner (wears multiple hats)
- General Partner = ownership stake in partnership

### Board & Officer Validation (PUBLIC COMPANIES)
When asked to verify if someone is on a board, is a director, officer, or executive:
1. **sec_insider_search("[person name]")** - Searches Form 3/4/5 insider filings. If results found, they ARE an insider.
2. **sec_proxy_search("[company name]")** - Gets DEF 14A proxy statement listing ALL directors and officers.
Use BOTH tools: insider search confirms the person files as insider, proxy shows full board composition.

### Wealth Indicator Tools (USE PROACTIVELY)
These tools reveal high-value prospects. Run them during comprehensive research:

**Luxury Assets (ULTRA-HIGH wealth signals):**
- **faa_aircraft** - Aircraft ownership ($500K-$70M+). Run for any suspected high-net-worth prospect.
- **uscg_vessels** - Yacht/boat ownership ($25K-$50M+). Run alongside faa_aircraft for complete picture.

**High-Income Professions (verify profession + estimate income):**
- **npi_registry** - Healthcare providers. If prospect is MD/DO/NP, run this for specialty and income estimate ($100K-$900K).
- **finra_brokercheck** - Financial advisors. If prospect works in finance, run this for CRD#, licenses, disclosures ($80K-$1M+).
- **federal_lobbying** - Federal lobbyists. High-income profession with disclosed compensation.

**Business & IP Research:**
- **business_lookup** - Unified business search (CO, CT, NY, OR, IA, WA, FL). Search by company OR person name.
- **uspto_search** - Patents/trademarks. Inventors and IP holders = wealth indicator.

### Professional Verification Workflow
When researching someone's profession:
1. **Doctor/Healthcare**: Run **npi_registry** first - authoritative NPI number + specialty + income estimate
2. **Financial Advisor**: Run **finra_brokercheck** - CRD number, licenses, disclosures, firm history
3. **Attorney**: Run **professional_license** with "attorney" type
4. **Federal Lobbyist**: Run **federal_lobbying** for lobbying disclosures + compensation

### Due Diligence Workflow
For comprehensive prospect due diligence:
1. **opensanctions_screening** - Check for sanctions/PEP status (REQUIRED for major gifts)
2. **business_lookup** - Find business affiliations via state registries
3. **sec_insider_search** + **sec_proxy_search** - Find public company roles via SEC
4. **court_search** - Check for litigation history
5. **federal_lobbying** - Discover lobbying connections
6. **fec_contributions** - Political giving history
7. **faa_aircraft** + **uscg_vessels** - Luxury asset screening (aircraft, yachts)
8. **npi_registry** / **finra_brokercheck** - Professional credential verification if applicable`
      }
    }

    /**
     * OPTIMIZATION: Move non-critical operations to background
     * Logging and deletions can happen during streaming without blocking response
     */
    if (supabase) {
      // Fire-and-forget for truly non-critical operations
      Promise.all([
        // Delete old messages if editing
        (async () => {
          if (!editCutoffTimestamp) return
          try {
            await supabase
              .from("messages")
              .delete()
              .eq("chat_id", chatId)
              .gte("created_at", editCutoffTimestamp)
          } catch (err) {
            console.error("Failed to delete messages from cutoff:", err)
          }
        })(),
        // Log user message
        userMessage?.role === "user"
          ? logUserMessage({
              supabase,
              userId,
              chatId,
              content: userMessage.content,
              attachments: userMessage.experimental_attachments as Attachment[],
              model: normalizedModel,
              isAuthenticated,
              message_group_id,
            })
          : Promise.resolve()
      ]).catch((err: unknown) => console.error("Background operations failed:", err))
    }

    // Build tools object - RAG tools, Memory search, Web search, and Financial/Corporate data
    const tools: ToolSet = {
      ...(isAuthenticated
        ? {
            list_documents: createListDocumentsTool(userId),
            rag_search: createRagSearchTool(userId),
            search_memory: createMemorySearchTool(userId),
            search_prospects: createBatchReportsSearchTool(userId),
          }
        : {}),
      // Add Yahoo Finance tools for stock data, executive profiles, and insider transactions
      // Available to all users (no API key required)
      ...(enableSearch && shouldEnableYahooFinanceTools()
        ? {
            yahoo_finance_quote: yahooFinanceQuoteTool,
            yahoo_finance_search: yahooFinanceSearchTool,
            yahoo_finance_profile: yahooFinanceProfileTool,
          }
        : {}),
      // Add ProPublica Nonprofit Explorer tools for foundation/nonprofit research
      // Free API - no key required. Provides 990 financial data, EIN lookup
      ...(enableSearch && shouldEnableProPublicaTools()
        ? {
            propublica_nonprofit_search: propublicaNonprofitSearchTool,
            propublica_nonprofit_details: propublicaNonprofitDetailsTool,
          }
        : {}),
      // Add SEC EDGAR tool for public company filings and financial data
      // Free API - no key required. Provides 10-K, 10-Q filings and parsed financial statements
      ...(enableSearch && shouldEnableSecEdgarTools()
        ? {
            sec_edgar_filings: secEdgarFilingsTool,
          }
        : {}),
      // Add SEC Insider tools for board/officer validation
      // Free API - searches Form 3/4/5 and DEF 14A proxy statements
      ...(enableSearch && shouldEnableSecInsiderTools()
        ? {
            sec_insider_search: secInsiderSearchTool,
            sec_proxy_search: secProxySearchTool,
          }
        : {}),
      // Add FEC contributions tool for political giving research
      // Requires FEC_API_KEY from api.data.gov (free)
      ...(enableSearch && shouldEnableFecTools()
        ? {
            fec_contributions: fecContributionsTool,
          }
        : {}),
      // Add USAspending tool for federal contracts, grants, loans by company/org name
      // Free API - no key required
      ...(enableSearch && shouldEnableUsGovDataTools()
        ? {
            usaspending_awards: usGovDataTool,
          }
        : {}),
      // Add Wikidata tools for biographical research (education, employers, net worth, etc.)
      // Free API - no key required
      ...(enableSearch && shouldEnableWikidataTools()
        ? {
            wikidata_search: wikidataSearchTool,
            wikidata_entity: wikidataEntityTool,
          }
        : {}),
      // Add Rental Investment tool for rental valuation and investment analysis
      // Requires property value from property_valuation - returns rent estimate, cap rate, cash flow
      ...(enableSearch && shouldEnableRentalInvestmentTool()
        ? {
            rental_investment: rentalInvestmentTool,
          }
        : {}),
      // Add Business Registry Scraper - Stealth web scraping fallback
      // Unified Business Lookup - combines company search + person ownership search
      // Reliable states: CO, CT, NY, OR, IA, WA, FL (free Socrata APIs)
      // Other states: automatic Linkup web search fallback
      ...(enableSearch && shouldEnableBusinessLookupTool()
        ? {
            business_lookup: businessLookupTool,
          }
        : {}),
      // Add OpenSanctions tool for PEP and sanctions screening
      // COMPLETELY FREE - open source sanctions database
      ...(enableSearch && shouldEnableOpenSanctionsTools()
        ? {
            opensanctions_screening: opensanctionsScreeningTool,
          }
        : {}),
      // Add CourtListener tools for court records and judge information
      // FREE API - no key required (5,000 requests/hour)
      ...(enableSearch && shouldEnableCourtListenerTools()
        ? {
            court_search: courtSearchTool,
            judge_search: judgeSearchTool,
          }
        : {}),
      // Add GLEIF LEI Tools - Global Legal Entity Identifier database
      // FREE API - 2.5M+ entities with corporate ownership chains
      ...(enableSearch && shouldEnableGleifTools()
        ? {
            gleif_search: gleifSearchTool,
            gleif_lookup: gleifLookupTool,
          }
        : {}),
      // Add Neon CRM tools for nonprofit donor management
      // Requires NEON_CRM_ORG_ID and NEON_CRM_API_KEY
      ...(enableSearch && shouldEnableNeonCRMTools()
        ? {
            neon_crm_search_accounts: neonCRMSearchAccountsTool,
            neon_crm_get_account: neonCRMGetAccountTool,
            neon_crm_search_donations: neonCRMSearchDonationsTool,
          }
        : {}),
      // Add County Property Assessor Tool - Official government property records
      // FREE Socrata APIs - Supports major counties (LA, Cook, Miami-Dade, etc.)
      ...(enableSearch && shouldEnableCountyAssessorTool()
        ? {
            county_assessor: countyAssessorTool,
          }
        : {}),
      // Add Professional License Search - State licensing databases
      // Verifies credentials for MD, JD, CPA, Real Estate, etc.
      ...(enableSearch && shouldEnableProfessionalLicenseTool()
        ? {
            professional_license: professionalLicenseTool,
          }
        : {}),
      // Add State Contracts Search - State/local government contracts
      // Reveals business-government relationships and contract values
      ...(enableSearch && shouldEnableStateContractsTool()
        ? {
            state_contracts: stateContractsTool,
          }
        : {}),
      // business_entities merged into business_lookup
      // Add FAA Aircraft Registry Tool - Aircraft ownership lookup
      // Ultra-high wealth indicator ($500K-$70M+ for jets)
      ...(enableSearch && shouldEnableFAAAircraftTool()
        ? {
            faa_aircraft: faaAircraftTool,
          }
        : {}),
      // Add USCG Vessel Documentation Tool - Boat/yacht ownership
      // High wealth indicator ($25K-$50M+ for yachts)
      ...(enableSearch && shouldEnableUSCGVesselTool()
        ? {
            uscg_vessels: uscgVesselTool,
          }
        : {}),
      // Add NPI Registry Tool - Healthcare provider credentials
      // Authoritative source for MD, DO, NP, PA credentials with income estimates
      ...(enableSearch && shouldEnableNPIRegistryTool()
        ? {
            npi_registry: npiRegistryTool,
          }
        : {}),
      // Add FINRA BrokerCheck Tool - Financial advisor credentials
      // CRD number, licenses, disclosures, income estimates
      ...(enableSearch && shouldEnableFINRABrokerCheckTool()
        ? {
            finra_brokercheck: finraBrokerCheckTool,
          }
        : {}),
      // Add USPTO Search Tool - Patent and trademark search
      // Search by inventor or assignee - IP wealth indicator
      ...(enableSearch && shouldEnableUSPTOSearchTool()
        ? {
            uspto_search: usptoSearchTool,
          }
        : {}),
      // Add NYC Property Sales Tool - Actual transaction prices
      // NYC DOF Rolling Sales data - real prices, not estimates
      ...(enableSearch && shouldEnableNYCPropertySalesTool()
        ? {
            nyc_property_sales: nycPropertySalesTool,
          }
        : {}),
      // Add NYC ACRIS Deeds Tool - Property ownership records
      // NYC deed transfers, mortgages since 1966
      ...(enableSearch && shouldEnableACRISDeedsTool()
        ? {
            nyc_acris_deeds: acrisDeedsTool,
          }
        : {}),
      // Add CMS Open Payments Tool - Sunshine Act physician payments
      // Pharma/device payments to physicians (consulting, speaking, research)
      ...(enableSearch && shouldEnableCMSOpenPaymentsTool()
        ? {
            cms_open_payments: cmsOpenPaymentsTool,
          }
        : {}),
      // Add Federal Lobbying Tool - LDA filings
      // Federal lobbying disclosures (registrants, clients, lobbyists)
      ...(enableSearch && shouldEnableFederalLobbyingTool()
        ? {
            federal_lobbying: federalLobbyingTool,
          }
        : {}),
      // Add Giving Capacity Calculator - TFG Research Formulas (GS, EGS, Snapshot)
      // Calculates giving capacity from property, business, salary, and giving data
      // Use AFTER gathering data from property_valuation, business_lookup, etc.
      ...(enableSearch && shouldEnableGivingCapacityCalculatorTool()
        ? {
            giving_capacity_calculator: givingCapacityCalculatorTool,
          }
        : {}),
      // Add CRM Search Tool - Search synced Bloomerang/Virtuous data
      // Requires user to have connected CRM integrations
      ...(isAuthenticated && hasCRM
        ? {
            crm_search: tool({
              description:
                "Search your connected CRM systems (Bloomerang, Virtuous) for constituent/donor information. " +
                "Returns name, contact info, address, and giving history from synced CRM data. " +
                "Use this to look up existing donors by name or email BEFORE running external prospect research.",
              parameters: z.object({
                query: z.string().describe("Search term - name, email, or keyword"),
                provider: z.enum(["bloomerang", "virtuous", "all"]).optional().default("all")
                  .describe("Which CRM to search. Default 'all' searches all connected CRMs."),
                limit: z.number().optional().default(10).describe("Max results (1-50)"),
              }),
              execute: async ({ query, provider, limit }) => {
                return await searchCRMConstituents(userId, query, provider, limit)
              },
            }),
          }
        : {}),
    } as ToolSet

    // Check model capabilities to determine what content to clean
    // Perplexity models don't support tool calling or vision - passing such content causes errors
    const modelSupportsTools = modelConfig.tools !== false
    const modelSupportsVision = modelConfig.vision !== false
    const hasTools = modelSupportsTools && Object.keys(tools).length > 0

    // Optimize message payload to prevent FUNCTION_PAYLOAD_TOO_LARGE errors
    // This limits message history, removes blob URLs, and truncates large tool results
    const optimizedMessages = optimizeMessagePayload(messages)

    // Clean messages based on model capabilities:
    // - Remove tool invocations if model doesn't support tools
    // - Remove image/file attachments if model doesn't support vision
    // This prevents "Bad Request" errors for models like Perplexity that only accept text
    const cleanedMessages = cleanMessagesForTools(optimizedMessages, modelSupportsTools, modelSupportsVision)

    const result = streamText({
      model: modelConfig.apiSdk(apiKey, { enableSearch }),
      system: finalSystemPrompt,
      messages: cleanedMessages,
      // Only pass tools if model supports them - Perplexity models error on tool definitions
      ...(modelSupportsTools && { tools }),
      // Allow multiple tool call steps for complex research workflows
      maxSteps: modelSupportsTools ? 50 : 1,
      maxTokens: AI_MAX_OUTPUT_TOKENS,
      // Increase retries to handle rate limits (default is 3, which often fails)
      // Uses exponential backoff: ~1s, ~2s, ~4s, ~8s, ~16s, ~32s, ~64s, ~128s
      maxRetries: 8,
      experimental_telemetry: { isEnabled: false },
      // Only use smoothStream when no tools are available (smoothStream breaks tool calls)
      experimental_transform: hasTools ? undefined : smoothStream(),
      onError: (err: unknown) => {
        console.error("[Chat API] Streaming error:", err)
      },

      onFinish: async ({ response, text, finishReason, usage }) => {
        // Log completion details for debugging stuck issues
        console.log("[Chat API] Stream finished:", {
          finishReason,
          textLength: text?.length ?? 0,
          messageCount: response.messages?.length ?? 0,
          usage,
        })
        if (supabase) {
          // Store assistant message and get the message ID
          const savedMessage = await storeAssistantMessage({
            supabase,
            chatId,
            messages:
              response.messages as unknown as import("@/app/types/api.types").Message[],
            message_group_id,
            model: normalizedModel,
          })

          // MEMORY EXTRACTION: Extract and save important facts (background operation)
          if (isAuthenticated) {
            Promise.resolve().then(async () => {
              try {
                console.log("[Memory] Starting extraction for authenticated user:", userId)
                const { extractMemories, createMemory, memoryExists, calculateImportanceScore, isMemoryEnabled } = await import("@/lib/memory")
                const { generateEmbedding } = await import("@/lib/rag/embeddings")

                if (!isMemoryEnabled()) {
                  console.log("[Memory] Memory system is disabled")
                  return
                }

                // Extract text from response messages
                const textParts: string[] = []
                for (const msg of response.messages) {
                  if (msg.role === "assistant" && Array.isArray(msg.content)) {
                    for (const part of msg.content) {
                      if (part.type === "text" && part.text) {
                        textParts.push(part.text)
                      }
                    }
                  }
                }
                const responseText = textParts.join("\n\n")

                // Build conversation history for extraction (last user message + assistant response)
                const conversationForExtraction = [
                  { role: userMessage.role, content: String(userMessage.content) },
                  { role: "assistant", content: responseText },
                ]

                console.log("[Memory] Extracting memories from conversation...")
                // Extract memories
                const extractedMemories = await extractMemories(
                  {
                    messages: conversationForExtraction,
                    userId,
                    chatId,
                  },
                  apiKey || process.env.OPENROUTER_API_KEY || ""
                )

                console.log(`[Memory] Found ${extractedMemories.length} potential memories to save`)

                // Save each extracted memory
                for (const memory of extractedMemories) {
                  try {
                    // Check if similar memory already exists (avoid duplicates)
                    console.log(`[Memory] Checking if memory already exists: "${memory.content.substring(0, 50)}..."`)
                    const exists = await memoryExists(
                      memory.content,
                      userId,
                      apiKey || process.env.OPENROUTER_API_KEY || ""
                    )

                    if (exists) {
                      console.log(`[Memory] ⏭️  Skipping duplicate memory`)
                      continue
                    }

                    // Generate embedding for memory
                    console.log(`[Memory] Generating embedding...`)
                    const { embedding } = await generateEmbedding(
                      memory.content,
                      apiKey || process.env.OPENROUTER_API_KEY || ""
                    )

                    // Calculate final importance score
                    const importanceScore = calculateImportanceScore(
                      memory.content,
                      memory.category,
                      {
                        tags: memory.tags,
                        context: memory.context,
                      }
                    )

                    console.log(`[Memory] Saving with importance score: ${importanceScore}`)
                    // Save memory to database
                    const savedMemory = await createMemory({
                      user_id: userId,
                      content: memory.content,
                      memory_type: memory.tags?.includes("explicit") ? "explicit" : "auto",
                      importance_score: importanceScore,
                      metadata: {
                        source_chat_id: chatId,
                        category: memory.category,
                        tags: memory.tags,
                        context: memory.context,
                      },
                      embedding,
                    })

                    if (savedMemory) {
                      console.log(`[Memory] ✅ Successfully saved: "${memory.content.substring(0, 50)}..." (importance: ${importanceScore})`)
                    } else {
                      console.error(`[Memory] ❌ Failed to save memory (returned null)`)
                    }
                  } catch (memErr) {
                    console.error("[Memory] ❌ Error saving individual memory:", memErr)
                  }
                }

                console.log(`[Memory] Extraction complete. Processed ${extractedMemories.length} memories.`)
              } catch (error) {
                console.error("[Memory] ❌ Memory extraction failed:", error)
                // Don't fail the response if memory extraction fails
              }
            }).catch((err) => console.error("[Memory] ❌ Background memory extraction failed:", err))
          }
        }
      },
    })

    // Return streaming response with sources enabled
    const response = result.toDataStreamResponse({
      sendReasoning: true,
      sendSources: true,
      getErrorMessage: (error: unknown) => {
        console.error("[Chat API] Response error:", error)
        return extractErrorMessage(error)
      },
    })

    // Add headers to optimize streaming delivery
    response.headers.set("X-Accel-Buffering", "no") // Disable nginx buffering
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate")

    return response
  } catch (err: unknown) {
    console.error("Error in /api/chat:", err)
    const error = err as {
      code?: string
      message?: string
      statusCode?: number
    }

    return createErrorResponse(error)
  }
}
