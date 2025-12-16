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
  opencorporatesCompanySearchTool,
  opencorporatesOfficerSearchTool,
  shouldEnableOpenCorporatesTools,
} from "@/lib/tools/opencorporates"
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
  prospectScoringTool,
  shouldEnableProspectScoringTool,
} from "@/lib/tools/prospect-scoring"
import {
  prospectReportTool,
  shouldEnableProspectReportTool,
} from "@/lib/tools/prospect-report"
import {
  nonprofitBoardSearchTool,
  shouldEnableNonprofitBoardSearchTool,
} from "@/lib/tools/nonprofit-board-search"
import {
  givingHistoryTool,
  shouldEnableGivingHistoryTool,
} from "@/lib/tools/giving-history"
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
      dataTools.push("business_affiliation_search (UNIFIED: finds ALL business roles from SEC EDGAR + Wikidata + Web - use this for officer/director search)")
      if (shouldEnableProspectScoringTool()) dataTools.push("prospect_score (AI-POWERED: Giving Capacity Score 0-100, Propensity Score, A-D Rating - FREE DonorSearch AI alternative)")
      if (shouldEnableProspectReportTool()) dataTools.push("prospect_report (COMPREHENSIVE: Full research report with all data sources - FREE alternative to $125-$300/profile reports)")
      if (shouldEnableNonprofitBoardSearchTool()) dataTools.push("nonprofit_board_search (BOARD FINDER: Find all nonprofit & public company board positions for a person)")
      if (shouldEnableGivingHistoryTool()) dataTools.push("giving_history (GIVING AGGREGATOR: Combines FEC + 990 grants + major gifts - DonorSearch's core feature, FREE)")
      if (shouldEnableOpenCorporatesTools()) dataTools.push("opencorporates_company_search / opencorporates_officer_search (company ownership, officers, directors across 140+ jurisdictions)")
      if (shouldEnableOpenSanctionsTools()) dataTools.push("opensanctions_screening (PEP/sanctions screening - OFAC, EU, UN sanctions + politically exposed persons)")
      if (shouldEnableLobbyingTools()) dataTools.push("lobbying_search (federal lobbying disclosures - lobbyists, clients, issues, spending)")
      if (shouldEnableCourtListenerTools()) dataTools.push("court_search / judge_search (federal court records, opinions, dockets, judge profiles)")
      if (shouldEnableHouseholdSearchTool()) dataTools.push("household_search (spouse/partner search - household wealth assessment, shared affiliations)")

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
- business_affiliation_search: **USE THIS** for officer/director search - automatically searches SEC EDGAR + Wikidata + Web + OpenCorporates
- opencorporates_company_search: Search companies by name (LLC, Corp, etc.) - returns officers, status, filings (requires API key)
- opencorporates_officer_search: Find all companies where a person is officer/director (requires API key)
- opensanctions_screening: PEP & sanctions check - returns risk level (HIGH/MEDIUM/LOW/CLEAR)
- lobbying_search: Federal lobbying disclosures by lobbyist, client, or firm name
- court_search: Federal court opinions and dockets by party name or case
- judge_search: Judge biographical data, positions, appointers, education
- household_search: Find spouse/partner - returns household wealth assessment and shared affiliations
- prospect_score: AI-powered prospect scoring (Capacity 0-100, Propensity 0-100, A-D Rating)
- prospect_report: Comprehensive research report consolidating ALL data sources
- nonprofit_board_search: Find nonprofit and public company board positions
- giving_history: Aggregate all known giving (FEC political, 990 grants, major gifts)`
        }

        finalSystemPrompt += `\n\n### Research Strategy
1. Run 6-10 **searchWeb** queries covering property, business, philanthropy
2. Use **data API tools** to get detailed info on discovered entities
3. **propublica workflow**: searchWeb to find nonprofit names → propublica_nonprofit_search with ORG name
4. **property_valuation**: Just pass the address - tool auto-searches Zillow, Redfin, county records, and comps
5. **business ownership**: Use **business_affiliation_search** (unified tool) - automatically searches SEC + Wikidata + Web + OpenCorporates
6. **compliance screening**: ALWAYS run opensanctions_screening for major donor prospects (PEP/sanctions check)
7. Run tools in parallel when possible. Be thorough.

### Board & Officer Validation (PUBLIC COMPANIES)
When asked to verify if someone is on a board, is a director, officer, or executive:
1. **sec_insider_search("[person name]")** - Searches Form 3/4/5 insider filings. If results found, they ARE an insider.
2. **sec_proxy_search("[company name]")** - Gets DEF 14A proxy statement listing ALL directors and officers.
Use BOTH tools: insider search confirms the person files as insider, proxy shows full board composition.

### Due Diligence Workflow
For comprehensive prospect due diligence:
1. **opensanctions_screening** - Check for sanctions/PEP status (REQUIRED for major gifts)
2. **business_affiliation_search** - Find ALL business affiliations (unified search)
3. **court_search** - Check for litigation history
4. **lobbying_search** - Discover political connections
5. **fec_contributions** - Political giving patterns`
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
      // Add OpenCorporates tools for company and officer search
      // FREE API - no key required (100-200 requests/month)
      ...(enableSearch && shouldEnableOpenCorporatesTools()
        ? {
            opencorporates_company_search: opencorporatesCompanySearchTool,
            opencorporates_officer_search: opencorporatesOfficerSearchTool,
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
      // Combines SEC EDGAR + Wikidata + Web Search + OpenCorporates (if available)
      // ALWAYS FREE - automatically uses available sources
      ...(enableSearch && shouldEnableBusinessAffiliationSearchTool()
        ? {
            business_affiliation_search: businessAffiliationSearchTool,
          }
        : {}),
      // Add Prospect Scoring Tool - AI-powered wealth/capacity assessment
      // FREE alternative to DonorSearch AI ($4,000+/yr), iWave ($4,150+/yr)
      ...(enableSearch && shouldEnableProspectScoringTool()
        ? {
            prospect_score: prospectScoringTool,
          }
        : {}),
      // Add Prospect Report Tool - Comprehensive research reports
      // FREE alternative to DonorSearch Research on Demand ($125-$300/profile)
      ...(enableSearch && shouldEnableProspectReportTool()
        ? {
            prospect_report: prospectReportTool,
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
          // Store assistant message
          await storeAssistantMessage({
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
