/**
 * In-Memory Embedding Cache
 *
 * Caches embeddings to avoid redundant API calls during memory operations.
 * Uses LRU-style eviction with TTL expiration.
 *
 * Retry logic: Transient failures (network errors, 5xx) are retried up to
 * 2 times with exponential backoff (1s, 3s) to handle intermittent
 * OpenRouter API issues that manifest as "TypeError: fetch failed".
 */

import { createHash } from "crypto"
import { EMBEDDING_CACHE_TTL, EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./config"

interface CacheEntry {
  embedding: number[]
  timestamp: number
}

// Simple in-memory cache with TTL
const cache = new Map<string, CacheEntry>()
const MAX_CACHE_SIZE = 500 // Larger cache - each entry is ~6KB (1536 floats)

/** Max retry attempts for transient failures */
const EMBEDDING_MAX_RETRIES = 2

/** Backoff delays in ms for each retry attempt */
const EMBEDDING_RETRY_DELAYS = [1000, 3000]

/**
 * Generate a collision-resistant cache key from text content.
 * Uses SHA-256 (truncated to 16 hex chars) for strong collision resistance.
 */
function generateCacheKey(text: string): string {
  const normalized = text.trim().toLowerCase()
  const hash = createHash("sha256").update(normalized).digest("hex").substring(0, 16)
  return `${normalized.length}:${hash}`
}

/**
 * Get cached embedding if available and not expired
 */
export function getCachedEmbedding(text: string): number[] | null {
  const key = generateCacheKey(text)
  const entry = cache.get(key)

  if (!entry) return null

  // Check if expired
  if (Date.now() - entry.timestamp > EMBEDDING_CACHE_TTL) {
    cache.delete(key)
    return null
  }

  return entry.embedding
}

/**
 * Store embedding in cache
 */
export function setCachedEmbedding(text: string, embedding: number[]): void {
  // Evict oldest entries if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) cache.delete(oldestKey)
  }

  const key = generateCacheKey(text)
  cache.set(key, {
    embedding,
    timestamp: Date.now(),
  })
}

/**
 * Clear expired entries from cache
 */
export function cleanExpiredCache(): void {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > EMBEDDING_CACHE_TTL) {
      cache.delete(key)
    }
  }
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return { size: cache.size, maxSize: MAX_CACHE_SIZE }
}

/**
 * Check if an error is transient and worth retrying.
 * Retries on: network failures (TypeError: fetch failed), 5xx server errors,
 * 429 rate limits. Does NOT retry on 4xx client errors (bad key, bad input).
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    // Network-level failures (DNS, connection refused, TLS, timeout)
    if (msg.includes("fetch failed") || msg.includes("enotfound") || msg.includes("econnrefused") || msg.includes("timeout") || msg.includes("abort")) {
      return true
    }
    // Server error status codes embedded in our error message
    if (msg.includes("embedding failed: 5") || msg.includes("embedding failed: 429")) {
      return true
    }
  }
  return false
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Generate embedding for text using OpenRouter
 * Uses caching to avoid redundant API calls.
 * Retries transient failures (network errors, 5xx) with exponential backoff.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Check cache first
  const cached = getCachedEmbedding(text)
  if (cached) return cached

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured")
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= EMBEDDING_MAX_RETRIES; attempt++) {
    try {
      // Wait before retry (no wait on first attempt)
      if (attempt > 0) {
        const delay = EMBEDDING_RETRY_DELAYS[attempt - 1] || 3000
        console.warn(`[embedding-cache] Retry ${attempt}/${EMBEDDING_MAX_RETRIES} after ${delay}ms...`)
        await sleep(delay)
      }

      const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_VERCEL_URL || "http://localhost:3000",
          "X-Title": "Romy Memory System",
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: text,
          dimensions: EMBEDDING_DIMENSIONS, // Matryoshka truncation to 1536d
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        const errorText = await response.text()
        const err = new Error(`Embedding failed: ${response.status} ${errorText}`)
        // Retry on 5xx/429, throw immediately on 4xx
        if (response.status >= 500 || response.status === 429) {
          lastError = err
          if (attempt < EMBEDDING_MAX_RETRIES) continue
        }
        throw err
      }

      const data = await response.json()
      const embedding = data.data?.[0]?.embedding

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error("Invalid embedding response")
      }

      // Cache the result
      setCachedEmbedding(text, embedding)

      return embedding
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Only retry transient errors
      if (attempt < EMBEDDING_MAX_RETRIES && isTransientError(error)) {
        continue
      }

      // Non-transient error or exhausted retries — throw
      break
    }
  }

  console.error(`[embedding-cache] Generation failed after ${EMBEDDING_MAX_RETRIES + 1} attempts:`, lastError)
  throw lastError || new Error("Embedding generation failed")
}
