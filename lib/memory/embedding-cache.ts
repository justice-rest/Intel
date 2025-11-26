/**
 * In-Memory Embedding Cache
 *
 * Caches embeddings to avoid redundant API calls during memory operations.
 * Uses LRU-style eviction with TTL expiration.
 */

import { EMBEDDING_CACHE_TTL } from "./config"

interface CacheEntry {
  embedding: number[]
  timestamp: number
}

// Simple in-memory cache with TTL
const cache = new Map<string, CacheEntry>()
const MAX_CACHE_SIZE = 100 // Limit cache size to prevent memory issues

/**
 * Generate a cache key from text content
 * Uses first 200 chars + length for uniqueness without storing full text
 */
function generateCacheKey(text: string): string {
  const normalized = text.trim().toLowerCase().slice(0, 200)
  return `${normalized.length}:${normalized}`
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
