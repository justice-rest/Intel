import { SYSTEM_PROMPT_DEFAULT, AI_MAX_OUTPUT_TOKENS } from "@/lib/config"
import type { ChatConfig } from "@/lib/chat-config"
import { getAllModels, normalizeModelId } from "@/lib/models"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import { isWorkflowEnabled, runDurableWorkflow } from "@/lib/workflows"
import { extractMemoriesWorkflow } from "@/lib/workflows/memory-extraction.workflow"
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
  createLinkUpProspectResearchTool,
  shouldEnableLinkUpTools,
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
import type { Provider } from "@/lib/user-keys"
import {
  preCheckDeepResearchCredits,
  deductDeepResearchCredits,
  hasScalePlan,
  type DeepResearchCreditCheck,
} from "@/lib/subscription/autumn-client"
import {
  geminiGroundedSearchTool,
  geminiUltraSearchTool,
  shouldEnableGeminiGroundedSearchTool,
} from "@/lib/tools/gemini-grounded-search"
import {
  linkupUltraResearchTool,
  shouldEnableLinkUpUltraResearchTool,
} from "@/lib/tools/linkup-ultra-research"
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

type ResearchMode = "research" | "deep-research" | "ultra-research"

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

const ALLOWED_ATTACHMENT_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
])

const ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".json": "application/json",
  ".csv": "text/csv",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

const SUPABASE_STORAGE_PUBLIC_PREFIX = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/public/chat-attachments/`
  : null

function normalizeAttachmentContentType(attachment: Attachment): string | null {
  if (attachment.contentType) return attachment.contentType
  if (!attachment.name) return null
  const dotIndex = attachment.name.lastIndexOf(".")
  if (dotIndex === -1) return null
  const ext = attachment.name.slice(dotIndex).toLowerCase()
  return ATTACHMENT_MIME_BY_EXTENSION[ext] ?? null
}

function isAllowedAttachmentUrl(url: string): boolean {
  if (!SUPABASE_STORAGE_PUBLIC_PREFIX) return false
  return url.startsWith(SUPABASE_STORAGE_PUBLIC_PREFIX)
}

function sanitizeAttachments(
  attachments: Attachment[] | undefined
): Attachment[] | undefined {
  if (!attachments || attachments.length === 0) return undefined

  const filtered: Attachment[] = []

  for (const attachment of attachments) {
    if (!attachment || typeof attachment !== "object") continue
    const normalizedContentType = normalizeAttachmentContentType(attachment)
    if (!normalizedContentType || !ALLOWED_ATTACHMENT_CONTENT_TYPES.has(normalizedContentType)) {
      console.warn("[Chat API] Dropping attachment with unsupported content type.")
      continue
    }
    if (!attachment.url || !isAllowedAttachmentUrl(attachment.url)) {
      console.warn("[Chat API] Dropping attachment with invalid storage URL.")
      continue
    }

    filtered.push({
      ...attachment,
      contentType: normalizedContentType,
    })
  }

  return filtered.length > 0 ? filtered : undefined
}

function sanitizeMessageAttachments(messages: MessageAISDK[]): MessageAISDK[] {
  return messages.map((message) => {
    const messageWithAttachments = message as MessageAISDK & {
      experimental_attachments?: Attachment[]
    }
    if (!messageWithAttachments.experimental_attachments) return message

    const sanitized = sanitizeAttachments(messageWithAttachments.experimental_attachments)
    if (!sanitized) {
      const { experimental_attachments: _unused, ...rest } = messageWithAttachments
      return rest
    }

    return {
      ...message,
      experimental_attachments: sanitized,
    }
  })
}

// Map research modes to Grok model IDs (via OpenRouter)
// Grok 4.1 Fast supports native tool calling with LinkUp web search
const RESEARCH_MODE_MODELS: Record<ResearchMode, string> = {
  "research": "openrouter:x-ai/grok-4.1-fast",
  "deep-research": "openrouter:x-ai/grok-4.1-fast-thinking",
  "ultra-research": "openrouter:x-ai/grok-4.1-fast-thinking", // Same model, different tool
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

    const safeMessages = sanitizeMessageAttachments(messages)

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
      userName,
      memoryResult,
      batchReportsResult,
      hasCRM,
      deepResearchCreditCheck,
      chatConfig,
      betaFeaturesEnabled,
      isScalePlan,
    ] = await Promise.all([
      // 1. Validate user and check rate limits (critical - blocks streaming)
      validateAndTrackUsage({
        userId,
        model: normalizedModel,
        isAuthenticated,
      }),
      // 2. Get all models config (needed for streaming)
      getAllModels(),
      // 3. Get system prompt
      systemPrompt || SYSTEM_PROMPT_DEFAULT,
      // 4. Get user API key if authenticated (needed for streaming)
      (async () => {
        if (!isAuthenticated || !userId) return undefined
        const { getEffectiveApiKey } = await import("@/lib/user-keys")
        const provider = getProviderForModel(normalizedModel)
        return (await getEffectiveApiKey(userId, provider as Provider)) || undefined
      })(),
      // 5. USER NAME - Fetch the actual logged-in user's name for AI context
      (async (): Promise<string | null> => {
        if (!isAuthenticated || !userId) return null
        try {
          const { createClient } = await import("@/lib/supabase/server")
          const supabaseClient = await createClient()
          if (!supabaseClient) return null

          const { data } = await supabaseClient
            .from("users")
            .select("first_name, display_name")
            .eq("id", userId)
            .single()

          // Priority: first_name (from welcome popup) > display_name (from OAuth)
          return data?.first_name || data?.display_name || null
        } catch (error) {
          console.error("Failed to fetch user name:", error)
          return null
        }
      })(),
      // 6. MEMORY RETRIEVAL - Uses V2 hybrid search with automatic V1 fallback
      (async (): Promise<string | null> => {
        if (!shouldInjectMemory) return null

        try {
          const { getChatMemories, isMemoryEnabled } = await import("@/lib/memory")
          const { createClient } = await import("@/lib/supabase/server")

          if (!isMemoryEnabled()) return null

          // Use the unified V2 chat integration (auto-fallback to V1)
          const supabaseClient = await createClient()
          if (!supabaseClient) return null

          const memoryContext = await getChatMemories(supabaseClient, {
            userId,
            conversationMessages: messages.slice(-3).map((m) => ({
              role: m.role,
              content: String(m.content),
            })),
            count: 5, // V2 uses more memories with better relevance scoring
            minImportance: 0.4,
          })

          if (memoryContext.formattedMemories) {
            console.log(`[Memory] Retrieved ${memoryContext.memories.length} memories using ${memoryContext.systemUsed} system (${memoryContext.timing.totalMs}ms)`)
            return memoryContext.formattedMemories
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
      })(),
      // 8. DEEP RESEARCH CREDIT CHECK - Pre-check only, no deduction (safe for parallel)
      (async (): Promise<DeepResearchCreditCheck | null> => {
        if (researchMode !== "deep-research" || !isAuthenticated) return null
        return await preCheckDeepResearchCredits(userId)
      })(),
      // 9. CHAT CONFIG - Get knowledge profile and custom system prompt for this chat
      (async (): Promise<ChatConfig | null> => {
        if (!isAuthenticated || !chatId) return null
        try {
          const { getChatConfig } = await import("@/lib/chat-config")
          const { createClient } = await import("@/lib/supabase/server")
          const supabaseClient = await createClient()
          if (!supabaseClient) return null
          return await getChatConfig(supabaseClient, chatId, userId)
        } catch (error) {
          console.error("Failed to get chat config:", error)
          return null
        }
      })(),
      // 12. BETA FEATURES CHECK - Check if user has beta features enabled
      (async (): Promise<boolean> => {
        if (!isAuthenticated) return false
        try {
          const { createClient } = await import("@/lib/supabase/server")
          const supabaseClient = await createClient()
          if (!supabaseClient) return false

          const { data } = await supabaseClient
            .from("user_preferences")
            .select("beta_features_enabled")
            .eq("user_id", userId)
            .single()

          // Type assertion needed until Supabase types are regenerated after migration
          return (data as { beta_features_enabled?: boolean } | null)?.beta_features_enabled || false
        } catch (error) {
          console.error("Failed to check beta features:", error)
          return false
        }
      })(),
      // 13. SCALE PLAN CHECK - Check if user has Scale plan (required for beta features)
      (async (): Promise<boolean> => {
        if (!isAuthenticated) return false
        return hasScalePlan(userId)
      })(),
    ])

    // Verify model config exists
    const modelConfig = allModels.find((m) => m.id === normalizedModel)
    if (!modelConfig || !modelConfig.apiSdk) {
      throw new Error(`Model ${normalizedModel} not found`)
    }

    /**
     * Beta Features Access Check
     * Beta features require BOTH: enabled preference AND Scale plan
     * This provides defense-in-depth for premium features
     */
    const betaEnabled = betaFeaturesEnabled && isScalePlan

    /**
     * Deep Research Credit Check (Growth Plan: 2 credits)
     * Pre-check ran in parallel above; now validate result and deduct if needed
     * Note: Ultra Research mode also uses 2 credits (same as Deep Research)
     */
    let skipAutumnTracking = false
    if (deepResearchCreditCheck) {
      // Check failed - insufficient credits
      if (!deepResearchCreditCheck.allowed) {
        return new Response(
          JSON.stringify({ error: deepResearchCreditCheck.error || "Insufficient credits for Deep Research" }),
          { status: 402, headers: { "Content-Type": "application/json" } }
        )
      }
      // Check passed - deduct credits now (after all other checks passed)
      if (deepResearchCreditCheck.needsDeduction) {
        await deductDeepResearchCredits(userId)
        skipAutumnTracking = true // Already deducted 2 credits
      }
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
        model: normalizedModel,
        skipAutumnTracking,
      })
    }

    const userMessage = safeMessages[safeMessages.length - 1]

    // =========================================================================
    // SYSTEM PROMPT CONSTRUCTION
    // Priority: Knowledge Profile > Custom System Prompt > Default
    // =========================================================================

    let finalSystemPrompt: string = effectiveSystemPrompt

    // =========================================================================
    // CONTEXT INJECTION WITH BOUNDARIES (Prompt Engineering Technique)
    // Each context block uses [SECTION] / [/SECTION] boundaries for clarity
    // =========================================================================

    // CRITICAL: Inject the actual user's name so AI doesn't confuse them with donors
    if (userName) {
      finalSystemPrompt = `${finalSystemPrompt}

---

## [USER CONTEXT]
**Current User:** ${userName}

[HARD CONSTRAINTS]
1. ${userName} is the LOGGED-IN USER you are helping
2. NEVER confuse ${userName} with any donors or prospects being researched
3. When addressing the user, use "${userName}"—NOT donor names

[/USER CONTEXT]`
    }

    // Memory context injection
    if (memoryResult) {
      finalSystemPrompt = `${finalSystemPrompt}

---

## [MEMORY CONTEXT]
The following are remembered facts about the user from previous conversations:

${memoryResult}

[FOCUS]
Use this context to personalize responses. Reference prior conversations naturally.
[/MEMORY CONTEXT]`
    }

    // Organizational knowledge injection
    // Priority: Chat-scoped profile (replace/merge) > Chat config > User's active profile
    let knowledgePrompt: string | null = null

    if (isAuthenticated) {
      try {
        const knowledgeModule = await import('@/lib/knowledge')
        const {
          getChatScopedProfile,
          combinePromptSections,
          truncateToTokens,
          getKnowledgePromptForUser,
          TOKEN_BUDGET,
          MERGE_TOKEN_BUDGET_SPLIT,
          estimateTokens: estimateKnowledgeTokens,
        } = knowledgeModule

        // Check for chat-scoped knowledge profile first
        const chatScopedProfile = await getChatScopedProfile(chatId, userId)

        if (chatScopedProfile) {
          const chatScopedPrompt = combinePromptSections(chatScopedProfile)

          if (chatScopedProfile.merge_mode === 'merge') {
            // Merge: combine chat-scoped + global profile
            let globalPrompt: string | null = null
            if (chatConfig?.knowledge_prompt) {
              globalPrompt = chatConfig.knowledge_prompt
            } else {
              globalPrompt = await getKnowledgePromptForUser(userId)
            }

            if (globalPrompt && chatScopedPrompt) {
              const combinedTokens =
                estimateKnowledgeTokens(globalPrompt) + estimateKnowledgeTokens(chatScopedPrompt)

              if (combinedTokens > TOKEN_BUDGET.total) {
                // Truncate with 60/40 split favoring chat-scoped content
                const chatBudget = Math.floor(
                  TOKEN_BUDGET.total * MERGE_TOKEN_BUDGET_SPLIT.chat_scoped
                )
                const globalBudget = Math.floor(
                  TOKEN_BUDGET.total * MERGE_TOKEN_BUDGET_SPLIT.global
                )
                const truncatedGlobal = truncateToTokens(globalPrompt, globalBudget)
                const truncatedChat = truncateToTokens(chatScopedPrompt, chatBudget)
                knowledgePrompt = `${truncatedGlobal}\n\n---\n\n[CHAT-SPECIFIC KNOWLEDGE]\n${truncatedChat}\n[/CHAT-SPECIFIC KNOWLEDGE]`
              } else {
                knowledgePrompt = `${globalPrompt}\n\n---\n\n[CHAT-SPECIFIC KNOWLEDGE]\n${chatScopedPrompt}\n[/CHAT-SPECIFIC KNOWLEDGE]`
              }
            } else {
              // Only one side has content
              knowledgePrompt = chatScopedPrompt || globalPrompt
            }
          } else {
            // Replace mode: use only chat-scoped profile
            knowledgePrompt = chatScopedPrompt || null
          }
        } else if (chatConfig?.knowledge_prompt) {
          // Fallback to chat's knowledge profile
          knowledgePrompt = chatConfig.knowledge_prompt
          console.log(`[Chat] Using knowledge profile from chat config`)
        } else {
          // Fallback to user's active global profile
          knowledgePrompt = await getKnowledgePromptForUser(userId)
        }
      } catch (error) {
        console.error('Knowledge prompt retrieval failed:', error)
        // Non-blocking - continue without knowledge context
      }
    }

    if (knowledgePrompt) {
      finalSystemPrompt = `${finalSystemPrompt}

---

## [ORGANIZATIONAL KNOWLEDGE]
The following defines how you communicate and approach fundraising for THIS specific organization.
These instructions take precedence over generic advice.

${knowledgePrompt}
[/ORGANIZATIONAL KNOWLEDGE]`
    }

    // Apply chat-level custom system prompt override (highest priority)
    if (chatConfig?.custom_system_prompt) {
      finalSystemPrompt = `${finalSystemPrompt}

---

## [CHAT-SPECIFIC INSTRUCTIONS]

The following instructions are specific to this conversation and take highest priority:

${chatConfig.custom_system_prompt}

[/CHAT-SPECIFIC INSTRUCTIONS]`
      console.log(`[Chat] Applied chat-level custom system prompt`)
    }

    // Batch reports context injection
    if (batchReportsResult) {
      finalSystemPrompt = `${finalSystemPrompt}

---

## [BATCH REPORTS CONTEXT]
${batchReportsResult}
[/BATCH REPORTS CONTEXT]`
    }

    // Add CRM guidance when user has connected CRMs
    if (hasCRM) {
      finalSystemPrompt += `

---

## [CRM INTEGRATION]

[CAPABILITY]
Access to connected CRM systems (Bloomerang, Virtuous, Neon CRM, DonorPerfect)
- **crm_search**: Search synced data for constituents, giving history, contact info

[HARD CONSTRAINT]
ALWAYS call crm_search FIRST when researching a named donor/prospect.
CRM data = verified baseline; external research supplements, never replaces.

[/CRM INTEGRATION]`
    }

    // Add memory tool guidance for authenticated users
    if (isAuthenticated) {
      finalSystemPrompt += `

---

## [MEMORY TOOL GUIDANCE]

[CAPABILITY]
**search_memory** - Recall past conversations, user preferences, previous research

[TRIGGER CONDITIONS]
- "do you remember...", "we discussed...", "I told you about..."
- User references past conversations or previous research
- Researching a prospect from earlier in session
- User mentions preferences or constraints

[HARD CONSTRAINT]
Call search_memory FIRST before external research to avoid duplicating work.

[/MEMORY TOOL GUIDANCE]`
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
      // Web search tools - LinkUp + Gemini (when beta enabled)
      // In ultra-research mode (beta), use linkup_ultra_research instead
      if (shouldEnableLinkUpTools()) {
        if (researchMode === "ultra-research" && betaEnabled) {
          dataTools.push("linkup_ultra_research [BETA] (exhaustive multi-step research via LinkUp /research endpoint - comprehensive synthesis with citations)")
        } else {
          dataTools.push("linkup_prospect_research (comprehensive prospect research via LinkUp - real estate, business, philanthropy, securities, biography)")
        }
      }
      // [BETA] Gemini Search tools - Google's native search with grounding
      if (betaEnabled && shouldEnableGeminiGroundedSearchTool()) {
        dataTools.push("gemini_grounded_search [BETA] (fast Google Search via Gemini 3 Flash - current events, quick fact-checking, news)")
        if (researchMode === "deep-research" || researchMode === "ultra-research") {
          dataTools.push("gemini_ultra_search [BETA] (deep research via Gemini 3 Pro - comprehensive multi-angle investigation)")
        }
      }
      if (shouldEnableRentalInvestmentTool()) dataTools.push("rental_investment (rental analysis: monthly rent estimate, GRM, cap rate, cash-on-cash return, cash flow)")
      if (shouldEnableGleifTools()) dataTools.push("gleif_search / gleif_lookup (Global LEI database - 2.5M+ entities, corporate ownership chains)")
      if (shouldEnableNeonCRMTools()) dataTools.push("neon_crm_* (Neon CRM integration: search accounts/donors, get donor details, search donations - requires API key)")
      if (shouldEnableCourtListenerTools()) dataTools.push("court_search / judge_search (federal court records, opinions, dockets, judge profiles)")
      if (shouldEnableStateContractsTool()) dataTools.push("state_contracts (state government contracts - CA, NY, TX, FL, IL, OH, CO, MA)")
      if (shouldEnableNPIRegistryTool()) dataTools.push("npi_registry (CMS NPI Registry - healthcare providers - income by specialty)")
      if (shouldEnableUSPTOSearchTool()) dataTools.push("uspto_search (USPTO patents/trademarks - inventors, assignees - IP wealth indicator)")

      if (dataTools.length > 0) {
        // Determine primary research tool based on mode
        const primaryResearchTool = (researchMode === "ultra-research" && betaEnabled)
          ? "linkup_ultra_research"
          : "linkup_prospect_research"

        // Check if Gemini tools are available
        const hasGemini = betaEnabled && shouldEnableGeminiGroundedSearchTool()
        const hasGeminiUltra = hasGemini && (researchMode === "deep-research" || researchMode === "ultra-research")

        // Web search guidance - includes both LinkUp and Gemini when available
        const webSearchGuidance = `
[CAPABILITY]
Built-in web search for prospect research.${researchMode === "ultra-research" && betaEnabled ? `

**[ULTRA RESEARCH MODE - BETA]**
You are in Ultra Research mode. Use BOTH search tools for comprehensive coverage:
- linkup_ultra_research: Exhaustive multi-step research (10s-5min) with synthesized citations
- gemini_ultra_search: Deep research via Gemini 3 Pro with Google Search grounding` : ""}${hasGemini ? `

**[BETA SEARCH TOOLS]**
You have access to Gemini Search tools powered by Google Search:
- gemini_grounded_search: Fast search for current events, news, quick fact-checking
${hasGeminiUltra ? "- gemini_ultra_search: Deep research for comprehensive multi-angle investigation" : ""}
Use Gemini tools alongside LinkUp for more comprehensive results.` : ""}

### Available Data API Tools
${dataTools.join("\n")}

---

[HARD CONSTRAINTS]
1. **WEB SEARCH**: ${hasGemini
  ? `Use BOTH LinkUp AND Gemini tools for comprehensive research. Call them in parallel when possible.`
  : `Call ${primaryResearchTool} for comprehensive web research`}
2. **RESPONSE REQUIRED**: After ANY tool call, you MUST generate a text response—never return raw tool output
3. **OFFICIAL SOURCES PRIORITY**: When conflicts exist, prefer SEC/FEC/ProPublica over web sources
4. **SYNTHESIZE, DON'T DUMP**: Combine findings into unified reports with source citations
5. **CLICKABLE LINKS**: ALL source citations MUST use proper markdown link syntax:
   - CORRECT: [Wall Street Journal](https://wsj.com/article/123)
   - CORRECT: Sources: [FEC.gov](https://fec.gov), [SEC Edgar](https://sec.gov/edgar)
   - WRONG: [Source: wsj.com] ← NOT clickable
   - WRONG: (Source: fec.gov, sec.gov) ← NOT clickable
   ALWAYS include https:// and make every URL a clickable markdown link

---

### Structured Thinking: Research Workflow

**[UNDERSTAND]** - What research is needed?
- Named prospect → CRM first, then ${hasGemini ? "LinkUp + Gemini" : primaryResearchTool}
- Board verification → SEC insider + proxy search
- Foundation research → ProPublica 990 data
- Current events/news → ${hasGemini ? "gemini_grounded_search" : primaryResearchTool}

**[ANALYZE]** - Select tools based on research type:
| Need | Primary Tool | Complementary Tool |
|------|--------------|-------------------|
| Comprehensive profile | ${primaryResearchTool} | ${hasGemini ? "gemini_grounded_search" : "-"} |
| Current news/events | ${hasGemini ? "gemini_grounded_search" : primaryResearchTool} | ${hasGemini ? primaryResearchTool : "-"} |
| Deep research | ${hasGeminiUltra ? "linkup_ultra_research + gemini_ultra_search" : primaryResearchTool} | - |
| Political giving | fec_contributions | - |
| Foundation/990 data | propublica_nonprofit_search | propublica_nonprofit_details |
| Public company exec | sec_insider_search | sec_proxy_search |
| Giving capacity | giving_capacity_calculator | - |

#### Giving Capacity Calculator Workflow
**Optimal sequence:** Gather wealth data FIRST, then calculate capacity.
1. Collect real estate data (property_valuation) → provides totalRealEstateValue, propertyCount
2. Check business ownership (find_business_ownership) → provides hasBusinessOwnership, businessRevenue, isMultipleBusinessOwner
3. Check SEC filings (sec_insider_search) → provides hasSecFilings
4. Check charitable giving (fec_contributions, propublica) → provides lifetimeGiving, last5YearsGiving, largestKnownGift
5. Call **giving_capacity_calculator** with ALL available data and \`calculationType: "all"\`

**Required params:** totalRealEstateValue, propertyCount
**Recommended:** age, estimatedSalary, businessRevenue, lifetimeGiving, hasBusinessOwnership, hasSecFilings
**Snapshot-specific:** last5YearsGiving, hasDemonstratedGenerosity, largestKnownGift, isMultipleBusinessOwner
**Note:** If salary is unknown, the tool auto-estimates from home value (Home Value × 0.15).
Present all three formulas (GS, EGS, Snapshot) with the A/B/C/D capacity rating.

**[STRATEGIZE]** - Research execution plan:
1. ${hasGemini ? "Call LinkUp AND Gemini search tools in parallel for comprehensive web coverage" : `Call ${primaryResearchTool} for comprehensive web research`}
2. Follow up with structured tools (FEC, SEC, ProPublica) for verified data
3. Synthesize all findings into unified report

**[EXECUTE]** - After tool results:
- Combine findings from all sources, deduplicate
- Flag discrepancies, note confidence levels
- Present formatted report with all sources
- ALWAYS end with text response to user`

        finalSystemPrompt += `

---

## [PROSPECT RESEARCH TOOLS]
${webSearchGuidance}

---

### Board & Officer Validation (PUBLIC COMPANIES)
1. **sec_insider_search("[name]")** - Form 3/4/5 filings → confirms insider status
2. **sec_proxy_search("[company]")** - DEF 14A → lists ALL directors/officers
Use BOTH: insider search confirms filings, proxy shows full board composition.

[/PROSPECT RESEARCH TOOLS]`
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
      // Add LinkUp web search for prospect research
      // Comprehensive search with citations - real estate, business, philanthropy, securities, biography
      // NOTE: Excluded when ultra-research mode is selected (uses linkup_ultra_research instead)
      ...(enableSearch && shouldEnableLinkUpTools() && researchMode !== "ultra-research"
        ? {
            linkup_prospect_research: createLinkUpProspectResearchTool(
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
      // [BETA] Add Gemini Grounded Search - Google's native search with citations
      // Only available when: beta features enabled + Scale plan + search enabled + API key configured
      ...(enableSearch && betaEnabled && shouldEnableGeminiGroundedSearchTool()
        ? {
            gemini_grounded_search: geminiGroundedSearchTool,
          }
        : {}),
      // [BETA] Add LinkUp Ultra Research - Comprehensive multi-step research
      // Only available when: beta features enabled + Scale plan + ultra-research mode selected
      ...(enableSearch && betaEnabled && researchMode === "ultra-research" && shouldEnableLinkUpUltraResearchTool()
        ? {
            linkup_ultra_research: linkupUltraResearchTool,
          }
        : {}),
      // [BETA] Add Gemini Ultra Search - Deep research using Gemini 3 Pro
      // Only available when: beta features enabled + Scale plan + deep-research or ultra-research mode
      ...(enableSearch && betaEnabled && (researchMode === "deep-research" || researchMode === "ultra-research") && shouldEnableGeminiGroundedSearchTool()
        ? {
            gemini_ultra_search: geminiUltraSearchTool,
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
    const optimizedMessages = optimizeMessagePayload(safeMessages)

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
      const contentEmpty = !msg.content || (typeof msg.content === "string" && !msg.content.trim()) || (Array.isArray(msg.content) && msg.content.length === 0)
      console.log(`[Chat API]   [${i}] role: ${msg.role}, contentType: ${typeof msg.content}, isEmpty: ${contentEmpty}, hasAttachments: ${!!msgAny.experimental_attachments}`)
      if (Array.isArray(msg.content)) {
        console.log(`[Chat API]       content parts: ${(msg.content as any[]).map((p: any) => `${p.type || 'unknown'}(${p.text ? 'has text' : 'no text'})`).join(', ')}`)
      }
    })

    // SAFETY NET: Final check for empty content (xAI/Grok requires non-empty content in every message)
    // This should never trigger if cleanMessagesForTools is working correctly, but prevents API errors
    const finalMessages = cleanedMessages.map((msg) => {
      // Check if content is effectively empty
      const isEmpty = !msg.content ||
        (typeof msg.content === "string" && !msg.content.trim()) ||
        (Array.isArray(msg.content) && (
          msg.content.length === 0 ||
          !msg.content.some((p: any) => (p.type === "text" && p.text?.trim()) || (p.type && p.type !== "text"))
        ))

      if (isEmpty) {
        console.warn(`[Chat API] WARNING: Empty content detected in message ${msg.id}, role: ${msg.role}. Adding placeholder.`)
        return {
          ...msg,
          content: msg.role === "assistant" ? "[Assistant response]" : "[User message]",
        }
      }
      return msg
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
      messages: finalMessages,
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
          // Feature Flag: `durable-memory-extraction`
          // - When enabled: Uses Workflow DevKit for durable, resumable extraction
          // - When disabled: Uses legacy fire-and-forget pattern (default)
          if (isAuthenticated) {
            // Extract text from response messages (needed for both paths)
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

            // Check if durable memory extraction is enabled
            const useDurableMemory = isWorkflowEnabled("durable-memory-extraction", userId)

            if (useDurableMemory) {
              // NEW: Durable workflow with guaranteed completion
              console.log("[Memory] Using durable workflow for user:", userId)
              runDurableWorkflow(extractMemoriesWorkflow, {
                userId,
                chatId,
                userMessage: String(userMessage.content),
                assistantResponse: responseText,
                messageId: savedMessage?.messageId,
                apiKey: apiKey || undefined,
              }).catch((error) => {
                console.error("[Memory] Durable workflow failed:", error)
              })
            } else {
              // LEGACY: Fire-and-forget (preserved for rollback)
              Promise.resolve().then(async () => {
                try {
                  console.log("[Memory] Starting extraction for authenticated user:", userId)
                  const { extractMemories, createMemory, memoryExists, calculateImportanceScore, isMemoryEnabled } = await import("@/lib/memory")
                  const { generateEmbedding } = await import("@/lib/rag/embeddings")

                  if (!isMemoryEnabled()) {
                    console.log("[Memory] Memory system is disabled")
                    return
                  }

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
