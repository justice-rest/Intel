import { SYSTEM_PROMPT_DEFAULT, AI_MAX_OUTPUT_TOKENS } from "@/lib/config"
import { getAllModels, normalizeModelId } from "@/lib/models"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import { createListDocumentsTool } from "@/lib/tools/list-documents"
import { createRagSearchTool } from "@/lib/tools/rag-search"
import { createMemorySearchTool } from "@/lib/tools/memory-tool"
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
import { exaSearchTool, shouldEnableExaTool } from "@/lib/tools/exa-search"
import { tavilySearchTool, shouldEnableTavilyTool } from "@/lib/tools/tavily-search"
import { firecrawlSearchTool, shouldEnableFirecrawlTool } from "@/lib/tools/firecrawl-search"
import { youSearchTool, shouldEnableYouTool } from "@/lib/tools/you-search"
import { secEdgarFilingsTool, shouldEnableSecEdgarTools } from "@/lib/tools/sec-edgar"
import { fecContributionsTool, shouldEnableFecTools } from "@/lib/tools/fec-contributions"
import { usGovDataTool, shouldEnableUsGovDataTools } from "@/lib/tools/us-gov-data"
import {
  wikidataSearchTool,
  wikidataEntityTool,
  shouldEnableWikidataTools,
} from "@/lib/tools/wikidata"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import { getSystemPromptWithContext } from "@/lib/onboarding-context"
import { optimizeMessagePayload } from "@/lib/message-payload-optimizer"
import { Attachment } from "@ai-sdk/ui-utils"
import { Message as MessageAISDK, streamText, smoothStream, ToolSet } from "ai"
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
      memoryResult
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

    // Combine system prompt with memory context (if retrieved)
    let finalSystemPrompt = memoryResult
      ? `${effectiveSystemPrompt}\n\n${memoryResult}`
      : effectiveSystemPrompt

    // Add search guidance when search is enabled
    if (enableSearch) {
      const searchTools: string[] = []
      if (shouldEnableLinkupTool()) searchTools.push("searchWeb (prospect research: SEC, FEC, 990s, real estate, corporate filings)")
      if (shouldEnableYouTool()) searchTools.push("youSearch (agentic web+news search, backup for searchWeb, breaking news)")
      if (shouldEnableExaTool()) searchTools.push("exaSearch (semantic search, broad web, finding similar content)")
      if (shouldEnableTavilyTool()) searchTools.push("tavilySearch (news, current events, real-time facts)")
      if (shouldEnableFirecrawlTool()) searchTools.push("firecrawlSearch (general web search, documentation, articles)")

      // Data API tools (direct access to authoritative sources)
      const dataTools: string[] = []
      if (shouldEnableSecEdgarTools()) dataTools.push("sec_edgar_filings (SEC 10-K/10-Q filings, financial statements, executive compensation)")
      if (shouldEnableFecTools()) dataTools.push("fec_contributions (FEC political contributions by individual name)")
      if (shouldEnableYahooFinanceTools()) dataTools.push("yahoo_finance_* (stock quotes, company profiles, insider holdings)")
      if (shouldEnableProPublicaTools()) dataTools.push("propublica_nonprofit_* (foundation 990s, nonprofit financials)")
      if (shouldEnableUsGovDataTools()) dataTools.push("usaspending_awards (federal contracts/grants/loans by company/org name)")
      if (shouldEnableWikidataTools()) dataTools.push("wikidata_search/entity (biographical data: education, employers, positions, net worth, awards)")

      if (searchTools.length > 0 || dataTools.length > 0) {
        finalSystemPrompt += `\n\n## Web Search & Data Tools`

        if (searchTools.length > 0) {
          finalSystemPrompt += `\nYou have access to these search tools: ${searchTools.join(", ")}
- Use searchWeb for prospect research (SEC filings, FEC contributions, foundation 990s, property records, corporate data)
- Use youSearch as backup/complement to searchWeb - great for breaking news, recent coverage, and web+news combined results
- Use exaSearch for semantic queries, finding similar content, companies, or when keyword search fails
- Use tavilySearch for news, current events, and real-time factual questions (use topic='news' for news, topic='finance' for financial data)
- Use firecrawlSearch for general web queries, technical docs, articles, blog posts, and company info`
        }

        if (dataTools.length > 0) {
          finalSystemPrompt += `\n\nYou also have access to these data API tools: ${dataTools.join(", ")}
- Use sec_edgar_filings for public company financial data (10-K annual reports, 10-Q quarterly reports, balance sheets, income statements, cash flow, executive compensation)
- Use fec_contributions to search FEC records for an individual's political contribution history (amounts, dates, recipients, employer, occupation)
- Use yahoo_finance_quote/search/profile for stock prices, market cap, company profiles, executives, and insider holdings
- Use propublica_nonprofit_search/details for foundation 990 data, nonprofit financials, and EIN lookups
- Use usaspending_awards to find federal contracts, grants, and loans received by a COMPANY or ORGANIZATION (search by org name like 'Gates Foundation' or 'Lockheed Martin'). NOT for individual donor research.
- Use wikidata_search to find people/organizations by name and get their Wikidata QID
- Use wikidata_entity with a QID to get biographical data (education, employers, positions held, net worth, awards, etc.)`
        }

        finalSystemPrompt += `\n\n### CRITICAL: MAXIMIZE TOOL USAGE
**Use ALL available tools aggressively.** Each tool costs fractions of a cent. Thoroughness is expected.

For ANY prospect research request, execute 10-15+ tool calls minimum:
1. **searchWeb** (4-6 calls): property values, business ownership, philanthropy, news
2. **youSearch**: backup/complement to searchWeb - use for breaking news, recent media coverage, web+news combined
3. **fec_contributions**: political giving history
4. **propublica_nonprofit_search/details**: foundation 990 data (search by ORG name, not person)
5. **yahoo_finance_profile**: if they're a public company executive
6. **sec_edgar_filings**: if they have SEC filings
7. **wikidata_search + wikidata_entity**: biographical data (education, employers, net worth)
8. **tavilySearch**: recent news and current events

**DO NOT** stop after 2-3 tool calls. Run tools in parallel when possible. The user expects comprehensive research.

### Tool Usage Best Practices
- Always cite sources when using search or data tool results
- For prospect research, use MULTIPLE tools together - not just web search
- Cross-reference findings across tools for validation

### Person-to-Nonprofit Research Workflow
When researching an individual's nonprofit affiliations:
1. **searchWeb** for "[name] foundation board nonprofit" to discover affiliations
2. **Extract organization names and EINs** from results
3. **propublica_nonprofit_search** with the ORGANIZATION name (not person name)
4. **propublica_nonprofit_details** with the EIN for full 990 financials
5. **Cross-reference** with other tools for complete picture

### Home Valuation Research
Run MULTIPLE searchWeb queries to triangulate property values:
- "[address] home value Zillow Redfin"
- "[address] property records tax assessment"
- "[address] sold price history"
- "[county] assessor [address]"
- "[owner name] real estate [city state]" - finds additional properties

### Business Ownership Research
Run MULTIPLE searchWeb queries to uncover business interests:
- "[name] owner founder business [city]"
- "[name] CEO president LLC [state]"
- "[state] secretary of state [name]"
- If you find a company: "[company name] revenue employees"`
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
          }
        : {}),
      // Add Linkup web search tool - prospect research with curated domains
      ...(enableSearch && shouldEnableLinkupTool()
        ? { searchWeb: linkupSearchTool }
        : {}),
      // Add You.com agentic search tool - backup for Linkup, web+news combined
      ...(enableSearch && shouldEnableYouTool()
        ? { youSearch: youSearchTool }
        : {}),
      // Add Exa semantic search tool - neural embeddings, broad web coverage
      ...(enableSearch && shouldEnableExaTool()
        ? { exaSearch: exaSearchTool }
        : {}),
      // Add Tavily search tool - news, current events, real-time facts
      ...(enableSearch && shouldEnableTavilyTool()
        ? { tavilySearch: tavilySearchTool }
        : {}),
      // Add Firecrawl search tool - web scraping, full page content
      ...(enableSearch && shouldEnableFirecrawlTool()
        ? { firecrawlSearch: firecrawlSearchTool }
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
