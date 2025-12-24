import { SYSTEM_PROMPT_DEFAULT, AI_MAX_OUTPUT_TOKENS } from "@/lib/config"
import { getAllModels, normalizeModelId } from "@/lib/models"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import { createListDocumentsTool } from "@/lib/tools/list-documents"
import { createRagSearchTool } from "@/lib/tools/rag-search"
import { createMemorySearchTool } from "@/lib/tools/memory-tool"
import { createBatchReportsSearchTool } from "@/lib/tools/batch-reports-search"
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
  createPerplexityProspectResearchTool,
  shouldEnablePerplexityTools,
} from "@/lib/tools/perplexity-prospect-research"
import {
  createLinkupProspectResearchTool,
  shouldEnableLinkupTools,
} from "@/lib/tools/linkup-prospect-research"
import {
  rentalInvestmentTool,
  shouldEnableRentalInvestmentTool,
} from "@/lib/tools/rental-investment-tool"
import {
  courtSearchTool,
  judgeSearchTool,
  shouldEnableCourtListenerTools,
} from "@/lib/tools/courtlistener"
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
  stateContractsTool,
  shouldEnableStateContractsTool,
} from "@/lib/tools/state-contracts"
import {
  npiRegistryTool,
  shouldEnableNPIRegistryTool,
} from "@/lib/tools/npi-registry"
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
import { optimizeMessagePayload, estimateTokens } from "@/lib/message-payload-optimizer"
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

type ResearchMode = "research" | "deep-research"

type ChatRequest = {
  messages: MessageAISDK[]
  chatId: string
  userId: string
  model: string
  isAuthenticated: boolean
  systemPrompt: string
  enableSearch: boolean
  researchMode?: ResearchMode
  message_group_id?: string
  editCutoffTimestamp?: string
}

// Map research modes to Grok model IDs (via OpenRouter)
// Grok 4.1 Fast supports native tool calling with Exa web search
const RESEARCH_MODE_MODELS: Record<ResearchMode, string> = {
  "research": "openrouter:x-ai/grok-4.1-fast",
  "deep-research": "openrouter:x-ai/grok-4.1-fast-thinking",
}

export async function POST(req: Request) {
  try {
    const {
      messages,
      chatId,
      userId,
      model: requestedModel,
      isAuthenticated,
      systemPrompt,
      enableSearch,
      researchMode,
      message_group_id,
      editCutoffTimestamp,
    } = (await req.json()) as ChatRequest

    // When research mode is active, override the model with Perplexity's research models
    const model = researchMode
      ? RESEARCH_MODE_MODELS[researchMode]
      : requestedModel

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

    // Add memory tool guidance for authenticated users
    if (isAuthenticated) {
      finalSystemPrompt += `\n\n## Memory Tool Usage
You have access to **search_memory** to recall past conversations and user context.

**PROACTIVELY call search_memory when:**
- User says "do you remember...", "we discussed...", "I told you about..."
- User references past conversations or previous research
- Researching a prospect you may have researched before
- User mentions their preferences or constraints

**Call search_memory FIRST** before external research to avoid duplicating work.`
    }

    // Add search guidance when search is enabled
    // Gemini 3 supports native tool calling, so all models get full tool documentation
    if (enableSearch) {
      // Data API tools (direct access to authoritative sources)
      const dataTools: string[] = []
      if (shouldEnableSecEdgarTools()) dataTools.push("sec_edgar_filings (SEC 10-K/10-Q filings, financial statements, executive compensation)")
      if (shouldEnableSecInsiderTools()) dataTools.push("sec_insider_search (verify if person is officer/director at public company via Form 4)")
      if (shouldEnableSecInsiderTools()) dataTools.push("sec_proxy_search (DEF 14A proxy statements - lists all directors/officers)")
      if (shouldEnableFecTools()) dataTools.push("fec_contributions (FEC political contributions by individual name)")
      if (shouldEnableProPublicaTools()) dataTools.push("propublica_nonprofit_* (foundation 990s, nonprofit financials)")
      if (shouldEnableUsGovDataTools()) dataTools.push("usaspending_awards (federal contracts/grants/loans by company/org name)")
      if (shouldEnablePerplexityTools()) dataTools.push("perplexity_prospect_research (comprehensive prospect research with grounded citations - real estate, business, philanthropy, securities, biography)")
      if (shouldEnableLinkupTools()) dataTools.push("linkup_prospect_research (parallel web search for prospect research - use ALONGSIDE perplexity for maximum coverage)")
      if (shouldEnableRentalInvestmentTool()) dataTools.push("rental_investment (rental analysis: monthly rent estimate, GRM, cap rate, cash-on-cash return, cash flow)")
      if (shouldEnableGleifTools()) dataTools.push("gleif_search / gleif_lookup (Global LEI database - 2.5M+ entities, corporate ownership chains)")
      if (shouldEnableNeonCRMTools()) dataTools.push("neon_crm_* (Neon CRM integration: search accounts/donors, get donor details, search donations - requires API key)")
      if (shouldEnableCourtListenerTools()) dataTools.push("court_search / judge_search (federal court records, opinions, dockets, judge profiles)")
      if (shouldEnableStateContractsTool()) dataTools.push("state_contracts (state government contracts - CA, NY, TX, FL, IL, OH, CO, MA)")
      if (shouldEnableNPIRegistryTool()) dataTools.push("npi_registry (CMS NPI Registry - healthcare providers - income by specialty)")
      if (shouldEnableUSPTOSearchTool()) dataTools.push("uspto_search (USPTO patents/trademarks - inventors, assignees - IP wealth indicator)")

      if (dataTools.length > 0) {
        finalSystemPrompt += `\n\n## Prospect Research Tools

You have built-in web search capabilities through Perplexity Sonar Reasoning. Use this naturally to search the web for prospect information - property records, business affiliations, philanthropic activity, news articles, etc.

### Data API Tools
${dataTools.join("\n")}

**Key Tools:**
- **perplexity_prospect_research + linkup_prospect_research**: ALWAYS use BOTH IN PARALLEL for comprehensive prospect research. Perplexity provides structured JSON output; LinkUp provides additional sources and coverage. Call both simultaneously for maximum results.
- **fec_contributions**: Political contribution history by individual name (structured FEC data)
- **propublica_nonprofit_***: Foundation 990s, nonprofit financials (search by ORG name)
- **sec_edgar_filings**: Public company financials, 10-K/10-Q, executive compensation
- **sec_insider_search / sec_proxy_search**: Verify board membership via SEC filings

### Parallel Web Search Strategy (CRITICAL)
When researching prospects with web search enabled:
1. **ALWAYS invoke BOTH perplexity_prospect_research AND linkup_prospect_research IN PARALLEL** (single tool call message with both tools)
2. Wait for both tool results to return
3. **CRITICAL: After receiving tool results, you MUST generate a comprehensive text response** - DO NOT just return tool results silently
4. Combine findings from both tools, deduplicate sources, and cross-reference information
5. Present a unified research report with all sources cited
6. Flag discrepancies between sources and prefer official sources (SEC, FEC, ProPublica) when conflicts exist

### Response Requirement (MANDATORY)
**After ANY tool call completes, you MUST ALWAYS respond to the user with a complete text message.**
- Never leave tool results unprocessed - always synthesize them into a response
- If tools return research data, format it into a readable report for the user
- If tools return errors, explain the issue and suggest next steps
- The user should ALWAYS receive a final text response, not just raw tool output

### Research Strategy
1. **Start with PARALLEL web search** - call perplexity_prospect_research AND linkup_prospect_research simultaneously
2. **Use structured tools for specific data**: FEC for political giving, ProPublica for 990s, SEC for public company roles
3. **Run ALL tools in parallel** when gathering data from multiple sources for maximum efficiency
4. **propublica workflow**: Search perplexity for nonprofit names → propublica_nonprofit_search with ORG name for 990 details

### Board & Officer Validation (PUBLIC COMPANIES)
When asked to verify if someone is on a board, is a director, officer, or executive:
1. **sec_insider_search("[person name]")** - Searches Form 3/4/5 insider filings. If results found, they ARE an insider.
2. **sec_proxy_search("[company name]")** - Gets DEF 14A proxy statement listing ALL directors and officers.
Use BOTH tools: insider search confirms the person files as insider, proxy shows full board composition.

### Comprehensive Prospect Research Workflow
For full donor research:
1. **perplexity_prospect_research** - Get comprehensive profile with citations (property, business, philanthropy, biography)
2. **fec_contributions** - Political giving history (structured data)
3. **propublica_nonprofit_search** - If philanthropist, get 990 details for foundations they're connected to
4. **sec_insider_search** - If suspected public company executive, verify via SEC
5. **giving_capacity_calculator** - Calculate capacity from gathered wealth data`
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
      // Add Perplexity Sonar Pro/Deep Research for comprehensive prospect research
      // Grounded web search with citations - real estate, business, philanthropy, securities, biography
      // Deep research mode uses sonar-deep-research with 180s timeout for multi-step autonomous search
      ...(enableSearch && shouldEnablePerplexityTools()
        ? {
            perplexity_prospect_research: createPerplexityProspectResearchTool(
              researchMode === "deep-research"
            ),
          }
        : {}),
      // Add LinkUp web search for parallel prospect research
      // Use ALONGSIDE perplexity_prospect_research for maximum coverage
      // Deep search with sourced answers and inline citations
      ...(enableSearch && shouldEnableLinkupTools()
        ? {
            linkup_prospect_research: createLinkupProspectResearchTool(
              researchMode === "deep-research"
            ),
          }
        : {}),
      // Add Rental Investment tool for rental valuation and investment analysis
      // Requires property value from property_valuation - returns rent estimate, cap rate, cash flow
      ...(enableSearch && shouldEnableRentalInvestmentTool()
        ? {
            rental_investment: rentalInvestmentTool,
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
      // Add State Contracts Search - State/local government contracts
      // Reveals business-government relationships and contract values
      ...(enableSearch && shouldEnableStateContractsTool()
        ? {
            state_contracts: stateContractsTool,
          }
        : {}),
      // Add NPI Registry Tool - Healthcare provider credentials
      // Authoritative source for MD, DO, NP, PA credentials with income estimates
      ...(enableSearch && shouldEnableNPIRegistryTool()
        ? {
            npi_registry: npiRegistryTool,
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
      // Use AFTER gathering wealth data from other tools
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
    // Some models don't support tool calling or vision - passing such content causes errors
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

    // Debug logging for model configuration
    console.log("[Chat API] Request config:", {
      model: normalizedModel,
      modelSupportsTools,
      modelSupportsVision,
      hasTools,
      enableSearch,
      messageCount: cleanedMessages.length,
      hasApiKey: !!apiKey,
      hasEnvKey: !!process.env.OPENROUTER_API_KEY,
    })

    // Log message structure for debugging
    console.log("[Chat API] Messages being sent:")
    cleanedMessages.forEach((msg, i) => {
      const msgAny = msg as any
      console.log(`[Chat API]   [${i}] role: ${msg.role}, contentType: ${typeof msg.content}, hasAttachments: ${!!msgAny.experimental_attachments}`)
      if (Array.isArray(msg.content)) {
        console.log(`[Chat API]       content parts: ${(msg.content as any[]).map((p: any) => p.type || 'text').join(', ')}`)
      }
    })

    // =========================================================================
    // UNIFIED FLOW - All models (including Gemini 3 with native tool calling)
    // =========================================================================
    // Gemini 3 Flash/Pro support native tool calling, eliminating the need for
    // the previous two-stage architecture that was required for Perplexity models.
    // All tools (RAG, CRM, Memory, Web Search) are now handled directly by the model.
    // =========================================================================
    const result = streamText({
      model: modelConfig.apiSdk(apiKey, { enableSearch, enableReasoning: true }),
      system: finalSystemPrompt,
      messages: cleanedMessages,
      // Only pass tools if model supports them
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
        // Enhanced error logging to capture full error details
        console.error("[Chat API] ========== STREAMING ERROR ==========")
        console.error("[Chat API] Error type:", typeof err)
        console.error("[Chat API] Error:", err)

        // Try to extract detailed error info
        if (err && typeof err === "object") {
          const errorObj = err as Record<string, unknown>
          console.error("[Chat API] Error keys:", Object.keys(errorObj))

          if (errorObj.message) {
            console.error("[Chat API] Error message:", errorObj.message)
          }
          if (errorObj.cause) {
            console.error("[Chat API] Error cause:", errorObj.cause)
          }
          if (errorObj.error) {
            console.error("[Chat API] Nested error:", JSON.stringify(errorObj.error, null, 2))
          }
          if (errorObj.responseBody) {
            console.error("[Chat API] Response body:", errorObj.responseBody)
          }
          if ((errorObj as any).response) {
            const resp = (errorObj as any).response
            console.error("[Chat API] Response status:", resp.status)
            console.error("[Chat API] Response headers:", resp.headers)
          }
        }

        // Try to stringify the whole error
        try {
          console.error("[Chat API] Full error JSON:", JSON.stringify(err, null, 2))
        } catch {
          console.error("[Chat API] Could not stringify error")
        }
        console.error("[Chat API] =====================================")
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
