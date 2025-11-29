import { SYSTEM_PROMPT_DEFAULT, AI_MAX_OUTPUT_TOKENS } from "@/lib/config"
import { getAllModels, normalizeModelId } from "@/lib/models"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import { createListDocumentsTool } from "@/lib/tools/list-documents"
import { createRagSearchTool } from "@/lib/tools/rag-search"
import { createMemorySearchTool } from "@/lib/tools/memory-tool"
import { linkupSearchTool, shouldEnableLinkupTool } from "@/lib/tools/linkup-search"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import { getSystemPromptWithContext } from "@/lib/onboarding-context"
import { optimizeMessagePayload } from "@/lib/message-payload-optimizer"
import { Attachment } from "@ai-sdk/ui-utils"
import { Message as MessageAISDK, streamText, ToolSet, smoothStream } from "ai"
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

    // Add search guidance when search is enabled and Linkup tool is available
    if (enableSearch && shouldEnableLinkupTool()) {
      finalSystemPrompt += `\n\n## Web Search
You have access to the searchWeb tool. The user has enabled web search for this conversation.
- Use searchWeb proactively when the user asks about current events, recent information, or anything that requires up-to-date data
- The tool returns a synthesized answer with sources - incorporate this information naturally into your response
- Always cite sources when using search results`
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

    // Build tools object - RAG tools, Memory search, and Web search
    const tools: ToolSet = {
      ...(isAuthenticated
        ? {
            list_documents: createListDocumentsTool(userId),
            rag_search: createRagSearchTool(userId),
            search_memory: createMemorySearchTool(userId),
          }
        : {}),
      // Add Linkup web search tool when search is enabled and API key is configured
      ...(enableSearch && shouldEnableLinkupTool()
        ? { searchWeb: linkupSearchTool }
        : {}),
    } as ToolSet

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

      /**
       * OPTIMIZATION: Smooth streaming for better perceived performance
       * Providers sometimes send chunks in irregular bursts.
       * smoothStream creates a more consistent, natural text flow.
       *
       * Using 'word' chunking to ensure complete words are sent,
       * avoiding partial word renders that look jarring.
       */
      experimental_transform: smoothStream({
        chunking: "word",
        delayInMs: 10, // Small delay for smooth word-by-word rendering
      }),

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
