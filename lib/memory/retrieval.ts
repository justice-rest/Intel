/**
 * Memory Retrieval Module
 *
 * Handles semantic search and retrieval of user memories
 * Optimized for speed with embedding caching and timeouts
 */

import { createClient } from "@/lib/supabase/server"
import { generateEmbedding } from "@/lib/rag/embeddings"
import type { MemorySearchParams, MemorySearchResult, AutoInjectParams } from "./types"
import {
  DEFAULT_SIMILARITY_THRESHOLD,
  AUTO_INJECT_MEMORY_COUNT,
  AUTO_INJECT_MIN_IMPORTANCE,
  MAX_SEARCH_RESULTS,
} from "./config"
import { incrementMemoryAccess } from "./storage"
import { getCachedEmbedding, setCachedEmbedding } from "./embedding-cache"

// Timeout for memory operations (prevents blocking streaming)
const MEMORY_OPERATION_TIMEOUT_MS = 200

// ============================================================================
// SEMANTIC SEARCH
// ============================================================================

/**
 * Search memories using semantic similarity
 *
 * @param params - Search parameters
 * @param apiKey - OpenRouter API key for embedding generation
 * @returns Array of matching memories with scores
 */
export async function searchMemories(
  params: MemorySearchParams,
  apiKey: string
): Promise<MemorySearchResult[]> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      console.error("Supabase not configured - cannot search memories")
      return []
    }

    // Check cache first for faster response
    let embedding = getCachedEmbedding(params.query)

    if (!embedding) {
      // Generate embedding for search query
      const result = await generateEmbedding(params.query, apiKey)
      embedding = result.embedding
      // Cache for future use
      setCachedEmbedding(params.query, embedding)
    }

    // Convert embedding to JSON string for Supabase
    const embeddingString = JSON.stringify(embedding)

    // Call Supabase function for vector similarity search
    const { data, error } = await supabase.rpc("search_user_memories", {
      query_embedding: embeddingString,
      match_user_id: params.userId,
      match_count: Math.min(params.limit || 5, MAX_SEARCH_RESULTS),
      similarity_threshold: params.similarityThreshold || DEFAULT_SIMILARITY_THRESHOLD,
      memory_type_filter: params.memoryType || null,
      min_importance: params.minImportance || 0,
    })

    if (error) {
      console.error("Error searching memories:", error)
      throw error
    }

    // Track access for retrieved memories (fire-and-forget)
    if (data && data.length > 0) {
      Promise.all(data.map((m) => incrementMemoryAccess(m.id))).catch((err) =>
        console.error("Failed to track memory access:", err)
      )
    }

    return (data || []) as MemorySearchResult[]
  } catch (error) {
    console.error("Failed to search memories:", error)
    return []
  }
}

/**
 * Promise.race with timeout - returns empty result if operation takes too long
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  const timeout = new Promise<T>((resolve) =>
    setTimeout(() => resolve(fallback), timeoutMs)
  )
  return Promise.race([promise, timeout])
}

/**
 * Get relevant memories for auto-injection into conversation context
 * Combines current conversation context to find most relevant memories
 *
 * OPTIMIZED: Uses timeout to prevent blocking streaming
 * If memory retrieval takes > 200ms, returns empty and continues without memories
 *
 * @param params - Auto-injection parameters
 * @param apiKey - OpenRouter API key
 * @returns Array of relevant memories
 */
export async function getMemoriesForAutoInject(
  params: AutoInjectParams,
  apiKey: string
): Promise<MemorySearchResult[]> {
  try {
    // Use conversation context as search query
    const searchQuery = params.conversationContext

    if (!searchQuery || searchQuery.trim().length === 0) {
      return []
    }

    // Wrap in timeout to prevent blocking streaming
    // If memory retrieval is slow, we skip it rather than delay response
    const memoriesPromise = searchMemories(
      {
        query: searchQuery,
        userId: params.userId,
        limit: params.count || AUTO_INJECT_MEMORY_COUNT,
        similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
        minImportance: params.minImportance || AUTO_INJECT_MIN_IMPORTANCE,
      },
      apiKey
    )

    return await withTimeout(memoriesPromise, MEMORY_OPERATION_TIMEOUT_MS, [])
  } catch (error) {
    console.error("Failed to get memories for auto-inject:", error)
    return []
  }
}

/**
 * Format memories for injection into system prompt
 *
 * @param memories - Array of memory search results
 * @returns Formatted string to inject into prompt
 */
export function formatMemoriesForPrompt(
  memories: MemorySearchResult[]
): string {
  if (!memories || memories.length === 0) {
    return ""
  }

  const formattedMemories = memories
    .map((memory, index) => {
      const metadata = memory.metadata as any
      const category = metadata?.category || "general"
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
 * Find duplicate or highly similar memories
 * Used to prevent storing redundant information
 *
 * @param content - Memory content to check
 * @param userId - User ID
 * @param apiKey - OpenRouter API key
 * @param similarityThreshold - Threshold for considering memories similar (default: 0.85)
 * @returns Array of similar memories
 */
export async function findSimilarMemories(
  content: string,
  userId: string,
  apiKey: string,
  similarityThreshold: number = 0.85
): Promise<MemorySearchResult[]> {
  try {
    return await searchMemories(
      {
        query: content,
        userId,
        limit: 5,
        similarityThreshold,
      },
      apiKey
    )
  } catch (error) {
    console.error("Failed to find similar memories:", error)
    return []
  }
}

/**
 * Check if memory already exists (to avoid duplicates)
 *
 * @param content - Memory content
 * @param userId - User ID
 * @param apiKey - OpenRouter API key
 * @returns True if similar memory exists
 */
export async function memoryExists(
  content: string,
  userId: string,
  apiKey: string
): Promise<boolean> {
  const similarMemories = await findSimilarMemories(
    content,
    userId,
    apiKey,
    0.9 // High threshold for exact duplicates
  )

  return similarMemories.length > 0
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

/**
 * Build conversation context string from recent messages
 * Used as search query for finding relevant memories
 *
 * @param messages - Array of recent conversation messages
 * @param maxLength - Maximum length of context string
 * @returns Context string
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
 * Extract key topics/entities from conversation context
 * Used for more targeted memory retrieval
 *
 * @param context - Conversation context
 * @returns Array of key topics
 */
export function extractKeyTopics(context: string): string[] {
  if (!context) return []

  // Simple keyword extraction (could be enhanced with NLP)
  const topics: string[] = []

  // Extract common entities (simple pattern matching)
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
