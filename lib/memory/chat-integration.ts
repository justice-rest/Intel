/**
 * Memory System Chat Integration
 *
 * Provides a unified interface for memory retrieval in the chat route.
 * Supports both V1 (legacy) and V2 (enterprise) memory systems with
 * automatic fallback and feature detection.
 */

import type { AnySupabaseClient } from "@/lib/supabase/types"
import type { MemoryProfile, MemorySearchResultV2, MemoryKind } from "./types"
import { isMemoryEnabled } from "./config"
import { buildConversationContext } from "./retrieval"

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Check if V2 memory system is available (database has memories_v2 table)
 */
let v2Available: boolean | null = null

export async function isV2Available(supabase: AnySupabaseClient): Promise<boolean> {
  if (v2Available !== null) return v2Available

  try {
    // Try to query the V2 table
    const { error } = await supabase
      .from("memories_v2")
      .select("id")
      .limit(1)

    v2Available = !error
    return v2Available
  } catch {
    v2Available = false
    return false
  }
}

// ============================================================================
// MAIN INTERFACE
// ============================================================================

export interface ChatMemoryContext {
  /** Formatted memory string for system prompt injection */
  formattedMemories: string | null
  /** Memory profile (V2 only) */
  profile?: MemoryProfile
  /** Raw memories retrieved */
  memories: MemorySearchResultV2[]
  /** Which system was used */
  systemUsed: "v1" | "v2" | "none"
  /** Timing information */
  timing: {
    totalMs: number
    embeddingMs?: number
    searchMs?: number
    formatMs?: number
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
  /** Force use of specific system version */
  forceVersion?: "v1" | "v2"
}

/**
 * Get memories for chat context injection
 * Automatically uses V2 if available, falls back to V1
 */
export async function getChatMemories(
  supabase: AnySupabaseClient,
  params: GetChatMemoriesParams
): Promise<ChatMemoryContext> {
  const startTime = Date.now()

  // Check if memory system is enabled
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
    forceVersion,
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

  // Determine which system to use
  const useV2 = forceVersion === "v2" || (forceVersion !== "v1" && await isV2Available(supabase))

  if (useV2) {
    return getChatMemoriesV2(supabase, userId, conversationContext, count, minImportance, startTime)
  }

  return getChatMemoriesV1(userId, conversationContext, count, minImportance, startTime)
}

// ============================================================================
// V1 IMPLEMENTATION (Legacy)
// ============================================================================

async function getChatMemoriesV1(
  userId: string,
  conversationContext: string,
  count: number,
  minImportance: number,
  startTime: number
): Promise<ChatMemoryContext> {
  try {
    const { getMemoriesForAutoInject, formatMemoriesForPrompt } = await import("./retrieval")

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return {
        formattedMemories: null,
        memories: [],
        systemUsed: "none",
        timing: { totalMs: Date.now() - startTime },
      }
    }

    const memories = await getMemoriesForAutoInject(
      {
        conversationContext,
        userId,
        count,
        minImportance,
      },
      apiKey
    )

    const formattedMemories = memories.length > 0 ? formatMemoriesForPrompt(memories) : null

    // Convert to V2 result format for consistency
    const memoriesV2: MemorySearchResultV2[] = memories.map((m) => ({
      id: m.id,
      content: m.content,
      memory_kind: (m.memory_type === "explicit" ? "profile" : "episodic") as MemoryKind,
      memory_tier: "warm" as const,
      is_static: false,
      importance_score: m.importance_score,
      created_at: m.created_at,
      similarity_score: m.similarity,
    }))

    return {
      formattedMemories,
      memories: memoriesV2,
      systemUsed: "v1",
      timing: { totalMs: Date.now() - startTime },
    }
  } catch (error) {
    console.error("[chat-integration] V1 memory retrieval failed:", error)
    return {
      formattedMemories: null,
      memories: [],
      systemUsed: "none",
      timing: { totalMs: Date.now() - startTime },
    }
  }
}

// ============================================================================
// V2 IMPLEMENTATION (Enterprise)
// ============================================================================

async function getChatMemoriesV2(
  supabase: AnySupabaseClient,
  userId: string,
  conversationContext: string,
  count: number,
  minImportance: number,
  startTime: number
): Promise<ChatMemoryContext> {
  try {
    const { getMemoryProfile } = await import("./hybrid-search")
    const { generateEmbedding } = await import("./embedding-cache")

    // Generate embedding for conversation context
    const embeddingStart = Date.now()
    const queryEmbedding = await generateEmbedding(conversationContext)
    const embeddingMs = Date.now() - embeddingStart

    // Get memory profile (static + dynamic memories)
    const searchStart = Date.now()
    const profileResponse = await getMemoryProfile(supabase, {
      userId,
      query: conversationContext,
      queryEmbedding,
      staticLimit: Math.ceil(count / 2), // Half static, half dynamic
      dynamicLimit: Math.ceil(count / 2),
    })
    const searchMs = Date.now() - searchStart

    // Combine static and dynamic memories and convert to search result format
    const allMemories: MemorySearchResultV2[] = [
      ...profileResponse.profile.static.map((m) => ({
        id: m.id,
        content: m.content,
        memory_kind: m.memory_kind,
        memory_tier: m.memory_tier,
        is_static: m.is_static,
        importance_score: m.importance_score,
        created_at: m.created_at,
      })),
      ...profileResponse.profile.dynamic.map((m) => ({
        id: m.id,
        content: m.content,
        memory_kind: m.memory_kind,
        memory_tier: m.memory_tier,
        is_static: m.is_static,
        importance_score: m.importance_score,
        created_at: m.created_at,
      })),
    ]

    // Filter by importance
    const filteredMemories = allMemories.filter(
      (m) => m.importance_score >= minImportance
    )

    // Format for prompt
    const formatStart = Date.now()
    const formattedMemories = filteredMemories.length > 0
      ? formatMemoriesForPromptV2(filteredMemories)
      : null
    const formatMs = Date.now() - formatStart

    return {
      formattedMemories,
      profile: profileResponse.profile,
      memories: filteredMemories,
      systemUsed: "v2",
      timing: {
        totalMs: Date.now() - startTime,
        embeddingMs,
        searchMs,
        formatMs,
      },
    }
  } catch (error) {
    console.error("[chat-integration] V2 memory retrieval failed, falling back to V1:", error)
    // Fallback to V1
    return getChatMemoriesV1(userId, conversationContext, count, minImportance, startTime)
  }
}

/**
 * Format memories for system prompt injection (V2 version)
 */
function formatMemoriesForPromptV2(memories: MemorySearchResultV2[]): string {
  const parts: string[] = ["## User Memories"]

  const staticMemories = memories.filter((m) => m.is_static)
  const dynamicMemories = memories.filter((m) => !m.is_static)

  if (staticMemories.length > 0) {
    parts.push("\n### Profile (Always Relevant)")
    staticMemories.forEach((m) => {
      parts.push(`- ${m.content}`)
    })
  }

  if (dynamicMemories.length > 0) {
    parts.push("\n### Contextual")
    dynamicMemories.forEach((m) => {
      parts.push(`- ${m.content}`)
    })
  }

  return parts.join("\n")
}

// ============================================================================
// CACHE WARMING
// ============================================================================

/**
 * Warm up user's memory cache for faster subsequent requests
 * Should be called when user starts a session
 */
export async function warmUserMemoryCache(
  supabase: AnySupabaseClient,
  userId: string
): Promise<{ success: boolean; timing: number }> {
  const startTime = Date.now()

  try {
    if (!isMemoryEnabled()) {
      return { success: false, timing: Date.now() - startTime }
    }

    const useV2 = await isV2Available(supabase)

    if (useV2) {
      const { getHotCache } = await import("./hot-cache")
      const hotCache = getHotCache()

      // Load user's top memories into hot cache
      const { data } = await supabase
        .from("memories_v2")
        .select("*")
        .eq("user_id", userId)
        .eq("is_forgotten", false)
        .eq("is_latest", true)
        .order("importance_score", { ascending: false })
        .limit(20)

      if (data && data.length > 0) {
        await hotCache.loadUser(userId, data)
      }
    }

    return { success: true, timing: Date.now() - startTime }
  } catch (error) {
    console.error("[chat-integration] Cache warming failed:", error)
    return { success: false, timing: Date.now() - startTime }
  }
}

// ============================================================================
// MEMORY EXTRACTION (Post-Response)
// ============================================================================

export interface ExtractAndSaveMemoriesParams {
  userId: string
  userMessage: string
  assistantResponse: string
  chatId: string
  messageId?: number
}

/**
 * Extract and save memories from conversation
 * Should be called after response is complete
 */
export async function extractAndSaveMemories(
  supabase: AnySupabaseClient,
  params: ExtractAndSaveMemoriesParams
): Promise<{ extracted: number; saved: number }> {
  try {
    if (!isMemoryEnabled()) {
      return { extracted: 0, saved: 0 }
    }

    const { extractMemories, detectExplicitMemory } = await import("./extractor")
    const { createMemory } = await import("./storage")
    const { generateEmbedding } = await import("./embedding-cache")

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return { extracted: 0, saved: 0 }
    }

    const { userId, userMessage, assistantResponse, chatId, messageId } = params

    // Detect explicit memory request first
    const explicitMemoryContent = detectExplicitMemory(userMessage)
    if (explicitMemoryContent) {
      const embedding = await generateEmbedding(explicitMemoryContent)
      await createMemory({
        user_id: userId,
        content: explicitMemoryContent,
        memory_type: "explicit",
        importance_score: 0.9, // Explicit memories are high importance
        metadata: {
          source_chat_id: chatId,
          source_message_id: messageId,
        },
        embedding,
      })
      return { extracted: 1, saved: 1 }
    }

    // Auto-extract from conversation
    const memories = await extractMemories(
      {
        messages: [
          { role: "user", content: userMessage },
          { role: "assistant", content: assistantResponse },
        ],
        userId,
        chatId,
      },
      apiKey
    )

    let saved = 0
    for (const memory of memories) {
      try {
        const embedding = await generateEmbedding(memory.content)
        const savedMemory = await createMemory({
          user_id: userId,
          content: memory.content,
          memory_type: "auto",
          importance_score: memory.importance,
          metadata: {
            source_chat_id: chatId,
            source_message_id: messageId,
            category: memory.category,
            tags: memory.tags,
            context: memory.context,
          },
          embedding,
        })
        if (savedMemory) {
          saved++
        }
      } catch (error) {
        console.error("[chat-integration] Failed to save memory:", error)
      }
    }

    return { extracted: memories.length, saved }
  } catch (error) {
    console.error("[chat-integration] Memory extraction failed:", error)
    return { extracted: 0, saved: 0 }
  }
}
