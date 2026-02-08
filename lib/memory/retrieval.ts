/**
 * Memory Retrieval Module
 *
 * Handles semantic search and retrieval of user memories.
 *
 * KEY FIX (2026-02-08): Removed the 200ms withTimeout wrapper that was
 * silently killing every retrieval call. Embedding generation alone takes
 * 300-500ms via OpenRouter, so the old timeout always fired first, returning
 * empty results. Now we let the embedding call complete normally and only
 * apply a 5-second safety net on the Supabase RPC call.
 *
 * Uses the canonical `embedding-cache.ts` generateEmbedding (reads API key
 * from env) instead of `@/lib/rag/embeddings` (requires apiKey param).
 */

import { createClient } from "@/lib/supabase/server"
import { generateEmbedding } from "./embedding-cache"
import type { MemorySearchParams, MemorySearchResult, AutoInjectParams } from "./types"
import {
  DEFAULT_SIMILARITY_THRESHOLD,
  AUTO_INJECT_MEMORY_COUNT,
  AUTO_INJECT_MIN_IMPORTANCE,
  MAX_SEARCH_RESULTS,
  MEMORY_RETRIEVAL_TIMEOUT_MS,
} from "./config"
import { incrementMemoryAccess } from "./storage"

// ============================================================================
// SEMANTIC SEARCH
// ============================================================================

/**
 * Search memories using semantic similarity.
 *
 * No longer requires an `apiKey` parameter — the embedding-cache module
 * reads OPENROUTER_API_KEY from the environment.
 */
export async function searchMemories(
  params: MemorySearchParams
): Promise<MemorySearchResult[]> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      console.error("[Memory] Supabase not configured — cannot search memories")
      return []
    }

    // Generate (or retrieve cached) embedding for the search query
    const embedding = await generateEmbedding(params.query)

    // Convert embedding to JSON string for Supabase RPC
    const embeddingString = JSON.stringify(embedding)

    // Call Supabase function for vector similarity search
    // Safety-net: abort if the DB call takes longer than MEMORY_RETRIEVAL_TIMEOUT_MS
    const { data, error } = await supabase.rpc("search_user_memories", {
      query_embedding: embeddingString,
      match_user_id: params.userId,
      match_count: Math.min(params.limit || 5, MAX_SEARCH_RESULTS),
      similarity_threshold: params.similarityThreshold || DEFAULT_SIMILARITY_THRESHOLD,
      memory_type_filter: params.memoryType || null,
      min_importance: params.minImportance || 0,
    }).abortSignal(AbortSignal.timeout(MEMORY_RETRIEVAL_TIMEOUT_MS))

    if (error) {
      console.error("[Memory] Error searching memories:", error)
      throw error
    }

    // Track access for retrieved memories (fire-and-forget)
    if (data && data.length > 0) {
      Promise.all(data.map((m: MemorySearchResult) => incrementMemoryAccess(m.id))).catch((err) =>
        console.error("[Memory] Failed to track memory access:", err)
      )
    }

    return (data || []) as MemorySearchResult[]
  } catch (error) {
    console.error("[Memory] Failed to search memories:", error)
    return []
  }
}

/**
 * Get relevant memories for auto-injection into conversation context.
 *
 * No longer uses a 200ms timeout. The embedding call is allowed to
 * complete (typically 300-500ms, cached thereafter), and a 5s safety
 * net on the DB query prevents unbounded waits.
 */
export async function getMemoriesForAutoInject(
  params: AutoInjectParams
): Promise<MemorySearchResult[]> {
  try {
    const searchQuery = params.conversationContext

    if (!searchQuery || searchQuery.trim().length === 0) {
      return []
    }

    return await searchMemories({
      query: searchQuery,
      userId: params.userId,
      limit: params.count || AUTO_INJECT_MEMORY_COUNT,
      similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
      minImportance: params.minImportance || AUTO_INJECT_MIN_IMPORTANCE,
    })
  } catch (error) {
    console.error("[Memory] Failed to get memories for auto-inject:", error)
    return []
  }
}

/**
 * Format memories for injection into system prompt
 */
export function formatMemoriesForPrompt(
  memories: MemorySearchResult[]
): string {
  if (!memories || memories.length === 0) {
    return ""
  }

  const formattedMemories = memories
    .map((memory, index) => {
      const metadata = memory.metadata as Record<string, unknown> | null
      const category = (metadata?.category as string) || "general"
      return `${index + 1}. [${category.toUpperCase()}] ${memory.content}`
    })
    .join("\n")

  return `
# User Memory Context

The following are important facts you should remember about this user:

${formattedMemories}

Please use these memories to personalize your responses and maintain context across conversations.
`
}

// ============================================================================
// MEMORY DEDUPLICATION
// ============================================================================

/**
 * Find duplicate or highly similar memories.
 * Used to prevent storing redundant information.
 */
export async function findSimilarMemories(
  content: string,
  userId: string,
  similarityThreshold: number = 0.85
): Promise<MemorySearchResult[]> {
  try {
    return await searchMemories({
      query: content,
      userId,
      limit: 5,
      similarityThreshold,
    })
  } catch (error) {
    console.error("[Memory] Failed to find similar memories:", error)
    return []
  }
}

/**
 * Check if memory already exists (to avoid duplicates).
 */
export async function memoryExists(
  content: string,
  userId: string
): Promise<boolean> {
  const similarMemories = await findSimilarMemories(
    content,
    userId,
    0.9 // High threshold for exact duplicates
  )

  return similarMemories.length > 0
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

/**
 * Build conversation context string from recent messages.
 * Used as search query for finding relevant memories.
 */
export function buildConversationContext(
  messages: Array<{ role: string; content: string }>,
  maxLength: number = 1000
): string {
  if (!messages || messages.length === 0) {
    return ""
  }

  // Take last few messages (user and assistant)
  const recentMessages = messages.slice(-5)

  // Combine into single string
  const context = recentMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")

  // Truncate if too long
  if (context.length > maxLength) {
    return context.substring(0, maxLength) + "..."
  }

  return context
}

/**
 * Extract key topics/entities from conversation context.
 * Used for more targeted memory retrieval.
 */
export function extractKeyTopics(context: string): string[] {
  if (!context) return []

  const topics: string[] = []

  const patterns = [
    /my name is (\w+)/gi,
    /I(?:'m| am) (?:a |an )?(\w+)/gi,
    /I work (?:at |for )?([^.]+)/gi,
    /I like ([^.]+)/gi,
    /I prefer ([^.]+)/gi,
  ]

  patterns.forEach((pattern) => {
    const matches = context.matchAll(pattern)
    for (const match of matches) {
      if (match[1]) {
        topics.push(match[1].trim())
      }
    }
  })

  return topics
}
