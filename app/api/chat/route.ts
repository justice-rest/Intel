import { SYSTEM_PROMPT_DEFAULT, AI_MAX_OUTPUT_TOKENS } from "@/lib/config"
import { getAllModels, normalizeModelId } from "@/lib/models"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import { createListDocumentsTool } from "@/lib/tools/list-documents"
import { createRagSearchTool } from "@/lib/tools/rag-search"
import { createMemorySearchTool } from "@/lib/tools/memory-tool"
import { createBatchReportsSearchTool } from "@/lib/tools/batch-reports-search"
import { linkupSearchTool, shouldEnableLinkupTool } from "@/lib/tools/linkup-search"
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
import {
  nonprofitAffiliationSearchTool,
  shouldEnableNonprofitAffiliationTool,
} from "@/lib/tools/nonprofit-affiliation-search"
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
  propertyValuationTool,
  shouldEnablePropertyValuationTool,
} from "@/lib/tools/property-valuation"
import {
  rentalInvestmentTool,
  shouldEnableRentalInvestmentTool,
} from "@/lib/tools/rental-investment-tool"
import {
  opensanctionsScreeningTool,
  shouldEnableOpenSanctionsTools,
} from "@/lib/tools/opensanctions"
import {
  lobbyingSearchTool,
  shouldEnableLobbyingTools,
} from "@/lib/tools/lobbying"
import {
  courtSearchTool,
  judgeSearchTool,
  shouldEnableCourtListenerTools,
} from "@/lib/tools/courtlistener"
import {
  householdSearchTool,
  shouldEnableHouseholdSearchTool,
} from "@/lib/tools/household-search"
import {
  businessAffiliationSearchTool,
  shouldEnableBusinessAffiliationSearchTool,
} from "@/lib/tools/business-affiliation-search"
import {
  businessRegistryScraperTool,
  shouldEnableBusinessRegistryScraperTool,
} from "@/lib/tools/business-registry-scraper"
import {
  findBusinessOwnershipTool,
  shouldEnableFindBusinessOwnershipTool,
} from "@/lib/tools/find-business-ownership"
import {
  prospectProfileTool,
  shouldEnableProspectProfileTool,
} from "@/lib/tools/prospect-profile"
import {
  nonprofitBoardSearchTool,
  shouldEnableNonprofitBoardSearchTool,
} from "@/lib/tools/nonprofit-board-search"
import {
  givingHistoryTool,
  shouldEnableGivingHistoryTool,
} from "@/lib/tools/giving-history"
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
  voterRegistrationTool,
  shouldEnableVoterRegistrationTool,
} from "@/lib/tools/voter-registration"
import {
  foundationGrantsTool,
  shouldEnableFoundationGrantsTool,
} from "@/lib/tools/foundation-grants"
import {
  familyDiscoveryTool,
  shouldEnableFamilyDiscoveryTool,
} from "@/lib/tools/family-discovery"
import {
  businessRevenueEstimatorTool,
  shouldEnableBusinessRevenueEstimatorTool,
} from "@/lib/tools/business-revenue-estimator"
import {
  stateCampaignFinanceTool,
  shouldEnableStateCampaignFinanceTool,
} from "@/lib/tools/state-campaign-finance"
import {
  professionalLicenseTool,
  shouldEnableProfessionalLicenseTool,
} from "@/lib/tools/professional-license"
import {
  buildingPermitTool,
  shouldEnableBuildingPermitTool,
} from "@/lib/tools/building-permits"
import {
  stateContractsTool,
  shouldEnableStateContractsTool,
} from "@/lib/tools/state-contracts"
import {
  businessEntitiesTool,
  shouldEnableBusinessEntitiesTool,
} from "@/lib/tools/business-entities"
import {
  governmentSalaryTool,
  shouldEnableGovernmentSalaryTool,
} from "@/lib/tools/government-salary"
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
  lobbyistSearchTool,
  shouldEnableLobbyistSearchTool,
} from "@/lib/tools/lobbyist-search"
import {
  businessLicenseTool,
  shouldEnableBusinessLicenseTool,
} from "@/lib/tools/business-licenses"
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
import { createErrorResponse, extractErrorMessage } from "./utils"

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
      if (shouldEnablePropertyValuationTool()) dataTools.push("property_valuation (AVM home valuation: hedonic pricing, comp sales, confidence score)")
      if (shouldEnableRentalInvestmentTool()) dataTools.push("rental_investment (rental analysis: monthly rent estimate, GRM, cap rate, cash-on-cash return, cash flow)")
      dataTools.push("business_affiliation_search (UNIFIED: finds business roles from SEC EDGAR + Wikidata + Web - best for PUBLIC company officer/director search)")
      if (shouldEnableFindBusinessOwnershipTool()) dataTools.push("find_business_ownership (STATE REGISTRIES: find what businesses a person owns/controls - searches FL, NY, CA, DE, CO with ownership inference)")
      if (shouldEnableBusinessRegistryScraperTool()) dataTools.push("business_registry_scraper (STATE REGISTRIES: search by company name OR officer name - FL, NY, CA, DE, CO)")
      if (shouldEnableProspectProfileTool()) dataTools.push("prospect_profile (AI-POWERED: Unified wealth scoring + verified evidence - Capacity/Propensity/Affinity scores with source citations - FREE DonorSearch/iWave alternative)")
      if (shouldEnableNonprofitBoardSearchTool()) dataTools.push("nonprofit_board_search (BOARD FINDER: Find all nonprofit & public company board positions for a person)")
      if (shouldEnableGivingHistoryTool()) dataTools.push("giving_history (GIVING AGGREGATOR: Combines FEC + 990 grants + major gifts - DonorSearch's core feature, FREE)")
      if (shouldEnableGleifTools()) dataTools.push("gleif_search / gleif_lookup (Global LEI database - 2.5M+ entities, corporate ownership chains)")
      if (shouldEnableNeonCRMTools()) dataTools.push("neon_crm_* (Neon CRM integration: search accounts/donors, get donor details, search donations - requires API key)")
      if (shouldEnableOpenSanctionsTools()) dataTools.push("opensanctions_screening (PEP/sanctions screening - OFAC, EU, UN sanctions + politically exposed persons)")
      if (shouldEnableLobbyingTools()) dataTools.push("lobbying_search (federal lobbying disclosures - lobbyists, clients, issues, spending)")
      if (shouldEnableCourtListenerTools()) dataTools.push("court_search / judge_search (federal court records, opinions, dockets, judge profiles)")
      if (shouldEnableHouseholdSearchTool()) dataTools.push("household_search (spouse/partner search - household wealth assessment, shared affiliations)")
      if (shouldEnableStateCampaignFinanceTool()) dataTools.push("state_campaign_finance (STATE-level political contributions - CA, NY, TX, FL, IL, OH, CO, WA, MA, NJ)")
      if (shouldEnableProfessionalLicenseTool()) dataTools.push("professional_license (verify credentials: MD, JD, CPA, Real Estate - CA, NY, TX, FL, IL)")
      if (shouldEnableBuildingPermitTool()) dataTools.push("building_permits (city renovation permits - wealth indicator from permit values)")
      if (shouldEnableStateContractsTool()) dataTools.push("state_contracts (state government contracts - CA, NY, TX, FL, IL, OH, CO, MA)")
      if (shouldEnableBusinessEntitiesTool()) dataTools.push("business_entities (state corporation registry - NY, CO, OR, IA, WA - search by entity name or agent/officer)")
      if (shouldEnableGovernmentSalaryTool()) dataTools.push("government_salary (public employee salaries - NYC, VT, NJ, OR, LA - wealth indicator)")
      if (shouldEnableFAAAircraftTool()) dataTools.push("faa_aircraft (FAA N-Number registry - aircraft ownership - ULTRA-HIGH wealth indicator)")
      if (shouldEnableUSCGVesselTool()) dataTools.push("uscg_vessels (USCG vessel documentation - boat/yacht ownership - HIGH wealth indicator)")
      if (shouldEnableNPIRegistryTool()) dataTools.push("npi_registry (CMS NPI Registry - healthcare providers - income by specialty)")
      if (shouldEnableFINRABrokerCheckTool()) dataTools.push("finra_brokercheck (FINRA BrokerCheck - financial advisors - HIGH income profession)")
      if (shouldEnableLobbyistSearchTool()) dataTools.push("lobbyist_search (state/local lobbyists - NY, IL, CA, WA, CO - HIGH wealth indicator)")
      if (shouldEnableBusinessLicenseTool()) dataTools.push("business_licenses (city business licenses - Chicago, Seattle, KC, Cincinnati, Berkeley, DE)")
      if (shouldEnableUSPTOSearchTool()) dataTools.push("uspto_search (USPTO patents/trademarks - inventors, assignees - IP wealth indicator)")

      const hasLinkup = shouldEnableLinkupTool()
      if (hasLinkup || dataTools.length > 0) {
        finalSystemPrompt += `\n\n## Prospect Research Tools`

        if (hasLinkup) {
          finalSystemPrompt += `\n### searchWeb - Your Primary Research Tool
Use searchWeb for prospect research with curated domains (SEC filings, FEC contributions, foundation 990s, property records, corporate data).
Run 6-10 searchWeb queries per prospect with different angles:
- Property: "[address] home value Zillow Redfin", "[address] property records"
- Business: "[name] founder CEO business [city]", "[name] LLC [state]"
- Philanthropy: "[name] foundation board nonprofit", "[name] donor charitable giving"`
        }

        if (dataTools.length > 0) {
          finalSystemPrompt += `\n\n### Data API Tools\n${dataTools.join("\n")}

**Usage:**
- sec_edgar_filings: Public company financials, 10-K/10-Q, executive compensation
- sec_insider_search: Verify board membership - search Form 3/4/5 by person name
- sec_proxy_search: Get DEF 14A proxy statements listing all directors/officers
- fec_contributions: Political contribution history by individual name
- yahoo_finance_*: Stock data, company profiles, insider holdings
- propublica_nonprofit_*: Foundation 990s, nonprofit financials (search by ORG name)
- usaspending_awards: Federal contracts/grants by company/org name
- wikidata_search/entity: Biographical data (education, employers, net worth)
- property_valuation: Home value estimate - just pass the address, auto-fetches Zillow/Redfin/comps
- rental_investment: Rental analysis - REQUIRES property value from property_valuation first
- business_affiliation_search: Search SEC EDGAR + Wikidata + Web for PUBLIC company officer/director roles
- find_business_ownership: **USE THIS** for "what businesses does [person] own?" - searches state registries with ownership inference
- business_registry_scraper: Search state registries (FL, NY, CA, DE, CO) by company name OR officer name
- gleif_search: Search Global LEI database for corporate entities (2.5M+ entities)
- gleif_lookup: Get LEI details with ownership chain (direct/ultimate parent)
- opensanctions_screening: PEP & sanctions check - returns risk level (HIGH/MEDIUM/LOW/CLEAR)
- lobbying_search: Federal lobbying disclosures by lobbyist, client, or firm name
- court_search: Federal court opinions and dockets by party name or case
- judge_search: Judge biographical data, positions, appointers, education
- household_search: Find spouse/partner - returns household wealth assessment and shared affiliations
- prospect_score: AI-powered prospect scoring (Capacity 0-100, Propensity 0-100, A-D Rating)
- prospect_report: Comprehensive research report consolidating ALL data sources
- nonprofit_board_search: Find nonprofit and public company board positions
- giving_history: Aggregate all known giving (FEC political, 990 grants, major gifts)
- neon_crm_search_accounts: Search donors in Neon CRM by name/email
- neon_crm_get_account: Get detailed donor profile and giving history from Neon CRM
- neon_crm_search_donations: Search donations in Neon CRM by date, amount, campaign
- state_campaign_finance: STATE-level political giving (complements fec_contributions which is federal-only)
- professional_license: Verify credentials (MD, JD, CPA, Real Estate) - wealth indicator from profession
- building_permits: City renovation permits - $500K+ permits suggest high wealth
- state_contracts: State government contracts - $1M+ contracts suggest successful business
- business_entities: State corporation registry search (NY, CO, OR, IA, WA) - find LLC/Corp by name or officer
- government_salary: Public employee salaries (NYC, VT, NJ, OR, LA) - known income source
- faa_aircraft: FAA aircraft registry - ULTRA-HIGH wealth ($500K-$70M+ aircraft)
- uscg_vessels: USCG vessel documentation - yacht/boat ownership ($25K-$50M+)
- npi_registry: Healthcare provider credentials - income estimates by specialty ($100K-$900K)
- finra_brokercheck: Financial advisor credentials - HIGH income ($80K-$1M+)
- lobbyist_search: State/local lobbyists (NY, IL, CA, WA, CO) - HIGH income profession ($150K-$500K+)
- business_licenses: City business licenses (Chicago, Seattle, KC, Cincinnati, Berkeley, DE)
- uspto_search: Patent/trademark search by inventor or assignee - IP wealth indicator`
        }

        finalSystemPrompt += `\n\n### Research Strategy
1. Run 6-10 **searchWeb** queries covering property, business, philanthropy
2. Use **data API tools** to get detailed info on discovered entities
3. **propublica workflow**: searchWeb to find nonprofit names → propublica_nonprofit_search with ORG name
4. **property_valuation**: Just pass the address - tool auto-searches Zillow, Redfin, county records, and comps
5. **compliance screening**: ALWAYS run opensanctions_screening for major donor prospects (PEP/sanctions check)
6. **wealth screening**: Run **faa_aircraft** + **uscg_vessels** for luxury asset discovery
7. **professional verification**: Run **npi_registry** (doctors), **finra_brokercheck** (finance), or **government_salary** (public employees)
8. Run tools in parallel when possible. Be thorough.

### Business & Ownership Research (IMPORTANT)
**Choose the right tool based on your goal:**

| Goal | Tool | When to Use |
|------|------|-------------|
| "What businesses does [person] own?" | **find_business_ownership** | Person→Business search. Searches state registries with ownership inference. |
| "Is [person] a director/officer at any PUBLIC companies?" | **business_affiliation_search** | SEC EDGAR + Wikidata + Web. Best for public company roles. |
| "Find info about [company name]" | **business_registry_scraper** (searchType="company") | Company→Details search. Gets registration, officers, status. |
| "Find all officer positions for [person]" in private companies | **business_registry_scraper** (searchType="officer") | Person→Companies via state registries |

**State Registry Knowledge:**
- **Delaware (DE)**: 65% of Fortune 500 companies. Holdings, LLCs, corporations. ALWAYS include for large companies.
- **Florida (FL)**: Most reliable for officer search. Best overall data quality.
- **New York (NY)**: Open Data API - fastest and most reliable. Good for NYC-based entities.
- **California (CA)**: Tech companies, startups. Required for Silicon Valley prospects.
- **Colorado (CO)**: Open Data API available. Good secondary source.

**Ownership Inference (find_business_ownership):**
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
- **lobbyist_search** - Registered lobbyists (NY, IL, CA, WA, CO). High-income profession ($150K-$500K+).
- **government_salary** - Public employees (NYC, VT, NJ, OR, LA). Known income from public payroll records.

**Business & IP Research:**
- **business_entities** - State corporation registry (NY, CO, OR, IA, WA). Search by entity OR agent/officer name.
- **business_licenses** - City licenses (Chicago, Seattle, KC, Cincinnati, Berkeley, DE). Find business ownership.
- **uspto_search** - Patents/trademarks. Inventors and IP holders = wealth indicator.

### Professional Verification Workflow
When researching someone's profession:
1. **Doctor/Healthcare**: Run **npi_registry** first - authoritative NPI number + specialty + income estimate
2. **Financial Advisor**: Run **finra_brokercheck** - CRD number, licenses, disclosures, firm history
3. **Attorney**: Run **professional_license** with "attorney" type
4. **Lobbyist**: Run **lobbyist_search** for state registrations + compensation data
5. **Government Employee**: Run **government_salary** for exact salary from payroll records

### Due Diligence Workflow
For comprehensive prospect due diligence:
1. **opensanctions_screening** - Check for sanctions/PEP status (REQUIRED for major gifts)
2. **find_business_ownership** - Find ALL business affiliations via state registries
3. **business_affiliation_search** - Find public company roles via SEC + Wikidata
4. **court_search** - Check for litigation history
5. **lobbying_search** - Discover political connections
6. **fec_contributions** + **state_campaign_finance** - Complete political giving (federal + state)
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
      // Add Linkup web search tool - prospect research with curated domains
      // Note: Native Exa integration via OpenRouter :online suffix handles general web grounding when tools are disabled
      ...(enableSearch && shouldEnableLinkupTool()
        ? { searchWeb: linkupSearchTool }
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
      // Add Nonprofit Affiliation Search - AUTOMATIC person-to-nonprofit workflow
      // Searches web for person's nonprofit connections, then queries ProPublica
      ...(enableSearch && shouldEnableNonprofitAffiliationTool()
        ? {
            nonprofit_affiliation_search: nonprofitAffiliationSearchTool,
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
      // Add Property Valuation tool for AVM (Automated Valuation Model) calculations
      // Uses hedonic pricing, comparable sales, and online estimates
      // No external API required - uses existing search infrastructure + math
      ...(enableSearch && shouldEnablePropertyValuationTool()
        ? {
            property_valuation: propertyValuationTool,
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
      // Uses playwright-extra + puppeteer-extra-plugin-stealth
      // Scrapes State SoS (FL, NY, CA, DE, CO) registries
      ...(enableSearch && shouldEnableBusinessRegistryScraperTool()
        ? {
            business_registry_scraper: businessRegistryScraperTool,
          }
        : {}),
      // Add Find Business Ownership - Person-to-business search with ownership inference
      // Searches state registries for officer/director positions
      // Includes ownership likelihood scoring (confirmed/high/medium/low)
      ...(enableSearch && shouldEnableFindBusinessOwnershipTool()
        ? {
            find_business_ownership: findBusinessOwnershipTool,
          }
        : {}),
      // Add OpenSanctions tool for PEP and sanctions screening
      // COMPLETELY FREE - open source sanctions database
      ...(enableSearch && shouldEnableOpenSanctionsTools()
        ? {
            opensanctions_screening: opensanctionsScreeningTool,
          }
        : {}),
      // Add Lobbying Disclosure tool for federal lobbying data
      // FREE - Senate LDA API, no key required
      ...(enableSearch && shouldEnableLobbyingTools()
        ? {
            lobbying_search: lobbyingSearchTool,
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
      // Add Household/Spouse search tool for major gift strategy
      // FREE - uses Wikidata, SEC, and other public records
      ...(enableSearch && shouldEnableHouseholdSearchTool()
        ? {
            household_search: householdSearchTool,
          }
        : {}),
      // Add Business Affiliation Search - UNIFIED enterprise-grade tool
      // Combines SEC EDGAR + Wikidata + Web Search + State Registries
      // ALWAYS FREE - automatically uses available sources
      ...(enableSearch && shouldEnableBusinessAffiliationSearchTool()
        ? {
            business_affiliation_search: businessAffiliationSearchTool,
          }
        : {}),
      // Add Prospect Profile Tool - Unified wealth assessment + research report
      // Combines scoring (capacity, propensity, affinity) with verified evidence
      // FREE alternative to DonorSearch AI ($4,000+/yr), iWave ($4,150+/yr)
      ...(enableSearch && shouldEnableProspectProfileTool()
        ? {
            prospect_profile: prospectProfileTool,
          }
        : {}),
      // Add Nonprofit Board Search - Find board positions held by a person
      // FREE alternative to premium board mapping services
      ...(enableSearch && shouldEnableNonprofitBoardSearchTool()
        ? {
            nonprofit_board_search: nonprofitBoardSearchTool,
          }
        : {}),
      // Add Giving History Tool - Comprehensive giving history aggregation
      // FREE alternative to DonorSearch/iWave giving history features
      ...(enableSearch && shouldEnableGivingHistoryTool()
        ? {
            giving_history: givingHistoryTool,
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
      // Add Voter Registration Tool - Party affiliation and registration status
      // FREE - Uses FEC patterns + public voter records
      ...(enableSearch && shouldEnableVoterRegistrationTool()
        ? {
            voter_registration: voterRegistrationTool,
          }
        : {}),
      // Add Foundation Grants Tool - 990-PF Schedule I grant data
      // FREE ProPublica API + web search for grant details
      ...(enableSearch && shouldEnableFoundationGrantsTool()
        ? {
            foundation_grants: foundationGrantsTool,
          }
        : {}),
      // Add Family Discovery Tool - Household member identification
      // Uses property records, voter data, web search
      ...(enableSearch && shouldEnableFamilyDiscoveryTool()
        ? {
            family_discovery: familyDiscoveryTool,
          }
        : {}),
      // Add Business Revenue Estimator - Private company revenue estimates
      // Uses employee count × industry benchmarks methodology
      ...(enableSearch && shouldEnableBusinessRevenueEstimatorTool()
        ? {
            business_revenue_estimate: businessRevenueEstimatorTool,
          }
        : {}),
      // Add State Campaign Finance - State-level political contributions
      // Socrata APIs for CA, NY, TX, FL, IL, OH, CO, WA, MA, NJ
      ...(enableSearch && shouldEnableStateCampaignFinanceTool()
        ? {
            state_campaign_finance: stateCampaignFinanceTool,
          }
        : {}),
      // Add Professional License Search - State licensing databases
      // Verifies credentials for MD, JD, CPA, Real Estate, etc.
      ...(enableSearch && shouldEnableProfessionalLicenseTool()
        ? {
            professional_license: professionalLicenseTool,
          }
        : {}),
      // Add Building Permit Search - City permit databases
      // Wealth indicator from renovation/construction permits
      ...(enableSearch && shouldEnableBuildingPermitTool()
        ? {
            building_permits: buildingPermitTool,
          }
        : {}),
      // Add State Contracts Search - State/local government contracts
      // Reveals business-government relationships and contract values
      ...(enableSearch && shouldEnableStateContractsTool()
        ? {
            state_contracts: stateContractsTool,
          }
        : {}),
      // Add Business Entities Tool - State corporation registries via Socrata
      // Searches NY, CO, OR, IA, WA for LLC/Corp registrations
      ...(enableSearch && shouldEnableBusinessEntitiesTool()
        ? {
            business_entities: businessEntitiesTool,
          }
        : {}),
      // Add Government Salary Tool - Public employee salaries via Socrata
      // Searches NYC, VT, NJ, OR, LA payroll databases
      ...(enableSearch && shouldEnableGovernmentSalaryTool()
        ? {
            government_salary: governmentSalaryTool,
          }
        : {}),
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
      // Add Lobbyist Search Tool - State/local lobbyist registries
      // NY, IL, CA, WA, CO - HIGH income profession ($150K-$500K+)
      ...(enableSearch && shouldEnableLobbyistSearchTool()
        ? {
            lobbyist_search: lobbyistSearchTool,
          }
        : {}),
      // Add Business License Tool - City business license databases
      // Chicago, Seattle, Kansas City, Cincinnati, Berkeley, Delaware
      ...(enableSearch && shouldEnableBusinessLicenseTool()
        ? {
            business_licenses: businessLicenseTool,
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

    // Check if any tools are available - smoothStream causes issues with tool calls
    const hasTools = Object.keys(tools).length > 0

    // Optimize message payload to prevent FUNCTION_PAYLOAD_TOO_LARGE errors
    // This limits message history, removes blob URLs, and truncates large tool results
    const optimizedMessages = optimizeMessagePayload(messages)

    const result = streamText({
      model: modelConfig.apiSdk(apiKey, { enableSearch }),
      system: finalSystemPrompt,
      messages: optimizedMessages,
      tools,
      // Allow multiple tool call steps for RAG and memory search
      maxSteps: 25,
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

          // RESPONSE VERIFICATION: Verify Grok responses with Perplexity Sonar (background operation)
          if (isAuthenticated && savedMessage?.messageId) {
            const messageId = savedMessage.messageId
            const responseContent = savedMessage.content || text || ""

            Promise.resolve().then(async () => {
              try {
                const { shouldVerifyResponse, verifyResponse } = await import("@/lib/verification")

                if (!shouldVerifyResponse(normalizedModel, responseContent)) {
                  console.log("[Verification] Skipping - criteria not met")
                  return
                }

                console.log("[Verification] Starting verification for message:", messageId)
                const numericMessageId = parseInt(messageId, 10)

                // Set verifying = true immediately so UI shows the badge
                // Using type assertion since verification columns are added via migration
                const { error: verifyingError } = await supabase
                  .from("messages")
                  .update({ verifying: true } as Record<string, unknown>)
                  .eq("id", numericMessageId)

                if (verifyingError) {
                  console.error("[Verification] Failed to set verifying flag:", verifyingError)
                }

                // Run verification
                const verificationResult = await verifyResponse(
                  {
                    originalResponse: responseContent,
                    userQuery: String(userMessage?.content || ""),
                    modelId: normalizedModel,
                  },
                  apiKey || process.env.OPENROUTER_API_KEY || ""
                )

                if (!verificationResult) {
                  console.log("[Verification] No result returned, clearing verifying flag")
                  await supabase
                    .from("messages")
                    .update({ verifying: false } as Record<string, unknown>)
                    .eq("id", numericMessageId)
                  return
                }

                // Check if response was modified
                const wasModified =
                  verificationResult.mergedResponse &&
                  verificationResult.mergedResponse !== responseContent

                if (wasModified) {
                  console.log(
                    `[Verification] Response updated with ${verificationResult.corrections.length} corrections and ${verificationResult.gapsFilled.length} gaps filled`
                  )
                } else {
                  console.log("[Verification] Response verified - no changes needed")
                }

                // Update message with verification results
                // Using type assertion since verification columns are added via migration
                const { error: updateError } = await supabase
                  .from("messages")
                  .update({
                    content: wasModified ? verificationResult.mergedResponse : responseContent,
                    verified: true,
                    verifying: false,
                    verification_result: {
                      corrections: verificationResult.corrections,
                      gapsFilled: verificationResult.gapsFilled,
                      confidenceScore: verificationResult.confidenceScore,
                      sources: verificationResult.sources,
                      wasModified,
                    },
                    verified_at: verificationResult.verificationTimestamp,
                  } as Record<string, unknown>)
                  .eq("id", numericMessageId)

                if (updateError) {
                  console.error("[Verification] Failed to update message:", updateError)
                } else {
                  console.log("[Verification] Message updated successfully")
                }
              } catch (error) {
                console.error("[Verification] Verification failed:", error)
                // Clear verifying flag on error
                await supabase
                  .from("messages")
                  .update({ verifying: false } as Record<string, unknown>)
                  .eq("id", parseInt(messageId, 10))
              }
            }).catch((err) => console.error("[Verification] Background verification failed:", err))
          }

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
