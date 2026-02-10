/**
 * Memory System Chat Integration
 *
 * Provides a unified interface for memory retrieval and extraction in the
 * chat route. Simplified from the dual V1/V2 architecture to a single,
 * rock-solid V1 path that actually works.
 *
 * KEY CHANGES (2026-02-08):
 * - Removed V2 path entirely (the `memories_v2` table was never deployed,
 *   so isV2Available() always returned false, adding dead-code complexity)
 * - extractAndSaveMemories now passes existing user memories as context
 *   to the extraction LLM, enabling contradiction detection & updates
 * - Uses upsertMemory instead of createMemory for dedup-with-update
 * - Structured logging with [Memory] prefix throughout
 */

import type { MemorySearchResult } from "./types"
import { isMemoryEnabled } from "./config"
import { buildConversationContext, getMemoriesForAutoInject, formatMemoriesForPrompt } from "./retrieval"

// ============================================================================
// MAIN INTERFACE
// ============================================================================

export interface ChatMemoryContext {
  /** Formatted memory string for system prompt injection */
  formattedMemories: string | null
  /** Raw memories retrieved */
  memories: MemorySearchResult[]
  /** Which system was used */
  systemUsed: "v1" | "none"
  /** Timing information */
  timing: {
    totalMs: number
  }
}

export interface GetChatMemoriesParams {
  /** User ID */
  userId: string
  /** Recent conversation messages for context */
  conversationMessages: Array<{ role: string; content: string }>
  /** Maximum memories to inject */
  count?: number
  /** Minimum importance score */
  minImportance?: number
}

/**
 * Get memories for chat context injection.
 * Directly uses V1 retrieval (which now works correctly without the 200ms timeout).
 */
export async function getChatMemories(
  params: GetChatMemoriesParams
): Promise<ChatMemoryContext> {
  const startTime = Date.now()

  if (!isMemoryEnabled()) {
    return {
      formattedMemories: null,
      memories: [],
      systemUsed: "none",
      timing: { totalMs: Date.now() - startTime },
    }
  }

  const {
    userId,
    conversationMessages,
    count = 5,
    minImportance = 0.3,
  } = params

  // Build conversation context from recent messages
  const conversationContext = buildConversationContext(conversationMessages)
  if (!conversationContext) {
    return {
      formattedMemories: null,
      memories: [],
      systemUsed: "none",
      timing: { totalMs: Date.now() - startTime },
    }
  }

  try {
    const memories = await getMemoriesForAutoInject({
      conversationContext,
      userId,
      count,
      minImportance,
    })

    const formattedMemories = memories.length > 0 ? formatMemoriesForPrompt(memories) : null

    return {
      formattedMemories,
      memories,
      systemUsed: "v1",
      timing: { totalMs: Date.now() - startTime },
    }
  } catch (error) {
    console.error("[Memory] Retrieval failed:", error)
    return {
      formattedMemories: null,
      memories: [],
      systemUsed: "none",
      timing: { totalMs: Date.now() - startTime },
    }
  }
}

// ============================================================================
// CACHE WARMING (stub for backward compatibility)
// ============================================================================


// ============================================================================
// MEMORY EXTRACTION (Post-Response)
// ============================================================================

export interface ExtractAndSaveMemoriesParams {
  userId: string
  userMessage: string
  assistantResponse: string
  chatId: string
  messageId?: number
  /** Recent conversation history for richer context extraction */
  conversationHistory?: Array<{ role: string; content: string }>
}

/**
 * Extract and save memories from conversation.
 * Called as a fire-and-forget after the response is streamed.
 *
 * Improvements over the inline route.ts implementation:
 * - Fetches top 20 existing memories and passes them to the extraction LLM
 *   so it can detect contradictions and mark updates
 * - Uses upsertMemory for dedup-with-update instead of skip-on-duplicate
 * - Structured [Memory] logging throughout
 */
export async function extractAndSaveMemories(
  params: ExtractAndSaveMemoriesParams
): Promise<{ extracted: number; saved: number }> {
  try {
    if (!isMemoryEnabled()) {
      return { extracted: 0, saved: 0 }
    }

    const { extractMemories, detectExplicitMemory } = await import("./extractor")
    const { upsertMemory, getUserMemories } = await import("./storage")
    const { generateEmbedding } = await import("./embedding-cache")

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      console.warn("[Memory] No API key available — skipping extraction")
      return { extracted: 0, saved: 0 }
    }

    const { userId, userMessage, assistantResponse, chatId, messageId, conversationHistory } = params

    // Fetch existing memories so the extraction LLM can detect contradictions
    let existingMemoryContents: string[] = []
    try {
      const existing = await getUserMemories(userId, 20)
      existingMemoryContents = existing.map((m) => m.content)
    } catch {
      // Non-fatal: extraction still works without existing context
    }

    // Handle explicit "remember that..." commands (fast path)
    const explicitMemoryContent = detectExplicitMemory(userMessage)
    if (explicitMemoryContent) {
      const embedding = await generateEmbedding(explicitMemoryContent)
      const saved = await upsertMemory({
        user_id: userId,
        content: explicitMemoryContent,
        memory_type: "explicit",
        importance_score: 0.9,
        metadata: {
          source_chat_id: chatId,
          source_message_id: messageId,
          is_static: true,
        },
        embedding,
      })
      console.log(`[Memory] Explicit memory ${saved ? "saved" : "failed"}: "${explicitMemoryContent.substring(0, 60)}"`)
      return { extracted: 1, saved: saved ? 1 : 0 }
    }

    // Build richer message context: use conversation history if available,
    // otherwise fall back to just the latest exchange. More context lets the
    // extraction LLM infer implicit facts and behavioral patterns.
    const extractionMessages = conversationHistory && conversationHistory.length > 0
      ? [
          ...conversationHistory.slice(-6), // up to 6 recent messages for context
          { role: "user", content: userMessage },
          { role: "assistant", content: assistantResponse },
        ]
      : [
          { role: "user", content: userMessage },
          { role: "assistant", content: assistantResponse },
        ]

    // Auto-extract from conversation with existing memory context
    const memories = await extractMemories(
      {
        messages: extractionMessages,
        userId,
        chatId,
      },
      apiKey,
      existingMemoryContents
    )

    if (memories.length === 0) {
      console.log("[Memory] Extracted 0 memories — nothing to save")
      return { extracted: 0, saved: 0 }
    }

    console.log(`[Memory] Extracted ${memories.length} memories — generating embeddings...`)

    // Generate all embeddings in parallel (~300-500ms each, so parallel saves significant time)
    const embeddingResults = await Promise.allSettled(
      memories.map((m) => generateEmbedding(m.content))
    )

    let saved = 0
    for (let i = 0; i < memories.length; i++) {
      const embeddingResult = embeddingResults[i]
      if (embeddingResult.status === "rejected") {
        console.error(`[Memory] Embedding failed for: "${memories[i].content.substring(0, 60)}..."`, embeddingResult.reason)
        continue
      }

      const memory = memories[i]
      const embedding = embeddingResult.value

      try {
        // Use upsert: if a very similar memory exists, update it
        // instead of creating a duplicate
        const savedMemory = await upsertMemory({
          user_id: userId,
          content: memory.content,
          memory_type: memory.tags?.includes("explicit") ? "explicit" : "auto",
          importance_score: memory.importance,
          metadata: {
            source_chat_id: chatId,
            source_message_id: messageId,
            category: memory.category,
            tags: memory.tags,
            context: memory.context,
            is_static: memory.is_static ?? false,
            relationship: memory.relationship ?? "new",
          },
          embedding,
        })

        if (savedMemory) {
          saved++
        } else {
          console.error(`[Memory] Failed to persist: "${memory.content.substring(0, 60)}..."`)
        }
      } catch (error) {
        console.error("[Memory] Error saving individual memory:", error)
      }
    }

    console.log(`[Memory] Saved ${saved}/${memories.length}`)
    return { extracted: memories.length, saved }
  } catch (error) {
    console.error("[Memory] Extraction pipeline failed:", error)
    return { extracted: 0, saved: 0 }
  }
}
