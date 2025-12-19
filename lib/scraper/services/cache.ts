/**
 * Scraper Cache Service
 *
 * Provides caching for scraper results using Supabase.
 * Falls back to in-memory LRU cache when Supabase is unavailable.
 *
 * Features:
 * - 1-hour TTL by default
 * - Supabase persistence (when available)
 * - In-memory LRU fallback
 * - Cache key generation from source + query + options
 */

import { createHash } from "crypto"

/**
 * Cache entry metadata
 */
export interface CacheEntry<T> {
  key: string
  source: string
  query: string
  data: T
  totalFound: number
  createdAt: string
  expiresAt: string
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Time-to-live in milliseconds (default: 1 hour) */
  ttlMs: number
  /** Maximum entries for in-memory cache (default: 1000) */
  maxEntries: number
  /** Whether to use Supabase (default: true if available) */
  useSupabase: boolean
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttlMs: 60 * 60 * 1000, // 1 hour
  maxEntries: 1000,
  useSupabase: true,
}

/**
 * Generate a cache key from source, query, and options
 */
export function generateCacheKey(
  source: string,
  query: string,
  options?: Record<string, unknown>
): string {
  const data = JSON.stringify({
    source: source.toLowerCase(),
    query: query.toLowerCase().trim(),
    options: options || {},
  })

  return createHash("sha256").update(data).digest("hex")
}

/**
 * In-memory LRU cache entry
 */
interface LRUEntry<T> {
  value: CacheEntry<T>
  timestamp: number
}

/**
 * Simple LRU cache implementation
 */
class LRUCache<T> {
  private cache: Map<string, LRUEntry<T>> = new Map()
  private maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  get(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if expired
    if (new Date(entry.value.expiresAt) < new Date()) {
      this.cache.delete(key)
      return null
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.value
  }

  set(key: string, value: CacheEntry<T>): void {
    // If at capacity, remove oldest entry
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    })
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = new Date()
    let removed = 0

    for (const [key, entry] of this.cache) {
      if (new Date(entry.value.expiresAt) < now) {
        this.cache.delete(key)
        removed++
      }
    }

    return removed
  }
}

/**
 * Scraper Cache
 *
 * Caches scraper results with configurable TTL.
 * Uses Supabase when available, falls back to in-memory LRU cache.
 */
export class ScraperCache {
  private config: CacheConfig
  private memoryCache: LRUCache<unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: any = null
  private supabaseChecked = false

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      ...DEFAULT_CACHE_CONFIG,
      ...config,
    }
    this.memoryCache = new LRUCache(this.config.maxEntries)
  }

  /**
   * Initialize Supabase client (lazy)
   */
  private async getSupabase() {
    if (this.supabaseChecked) {
      return this.supabase
    }

    this.supabaseChecked = true

    if (!this.config.useSupabase) {
      return null
    }

    try {
      // Try to import and use Supabase
      const { createClient } = await import("@supabase/supabase-js")

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!url || !key) {
        console.log("[ScraperCache] Supabase not configured, using memory cache")
        return null
      }

      this.supabase = createClient(url, key)
      console.log("[ScraperCache] Using Supabase cache")
      return this.supabase
    } catch {
      console.log("[ScraperCache] Supabase not available, using memory cache")
      return null
    }
  }

  /**
   * Get cached entry
   */
  async get<T>(
    source: string,
    query: string,
    options?: Record<string, unknown>
  ): Promise<CacheEntry<T> | null> {
    const key = generateCacheKey(source, query, options)

    // Try Supabase first
    const supabase = await this.getSupabase()
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("scraper_cache")
          .select("*")
          .eq("cache_key", key)
          .gt("expires_at", new Date().toISOString())
          .single()

        if (!error && data) {
          console.log(`[ScraperCache] Supabase HIT for ${source}:${query.slice(0, 20)}`)
          return {
            key: data.cache_key,
            source: data.source,
            query: data.query,
            data: data.results,
            totalFound: data.total_found,
            createdAt: data.created_at,
            expiresAt: data.expires_at,
          }
        }
      } catch (err) {
        console.warn("[ScraperCache] Supabase get error:", err)
      }
    }

    // Fall back to memory cache
    const memoryEntry = this.memoryCache.get(key)
    if (memoryEntry) {
      console.log(`[ScraperCache] Memory HIT for ${source}:${query.slice(0, 20)}`)
      return memoryEntry as CacheEntry<T>
    }

    console.log(`[ScraperCache] MISS for ${source}:${query.slice(0, 20)}`)
    return null
  }

  /**
   * Set cached entry
   */
  async set<T>(
    source: string,
    query: string,
    data: T,
    totalFound: number,
    options?: Record<string, unknown>
  ): Promise<void> {
    const key = generateCacheKey(source, query, options)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.config.ttlMs)

    const entry: CacheEntry<T> = {
      key,
      source,
      query,
      data,
      totalFound,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }

    // Store in memory cache first (always)
    this.memoryCache.set(key, entry as CacheEntry<unknown>)

    // Try to store in Supabase
    const supabase = await this.getSupabase()
    if (supabase) {
      try {
        await supabase
          .from("scraper_cache")
          .upsert({
            cache_key: key,
            source,
            query,
            results: data,
            total_found: totalFound,
            created_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          }, {
            onConflict: "cache_key",
          })

        console.log(`[ScraperCache] Stored in Supabase: ${source}:${query.slice(0, 20)}`)
      } catch (err) {
        console.warn("[ScraperCache] Supabase set error:", err)
      }
    }
  }

  /**
   * Delete cached entry
   */
  async delete(
    source: string,
    query: string,
    options?: Record<string, unknown>
  ): Promise<void> {
    const key = generateCacheKey(source, query, options)

    // Delete from memory
    this.memoryCache.delete(key)

    // Delete from Supabase
    const supabase = await this.getSupabase()
    if (supabase) {
      try {
        await supabase
          .from("scraper_cache")
          .delete()
          .eq("cache_key", key)
      } catch (err) {
        console.warn("[ScraperCache] Supabase delete error:", err)
      }
    }
  }

  /**
   * Clear all cached entries for a source
   */
  async clearSource(source: string): Promise<void> {
    // Clear memory cache (scan and delete)
    // Note: This is O(n) but acceptable for cache cleanup
    this.memoryCache.clear()

    // Clear from Supabase
    const supabase = await this.getSupabase()
    if (supabase) {
      try {
        await supabase
          .from("scraper_cache")
          .delete()
          .eq("source", source)
      } catch (err) {
        console.warn("[ScraperCache] Supabase clearSource error:", err)
      }
    }
  }

  /**
   * Clear all cached entries
   */
  async clearAll(): Promise<void> {
    this.memoryCache.clear()

    const supabase = await this.getSupabase()
    if (supabase) {
      try {
        // Delete expired entries
        await supabase
          .from("scraper_cache")
          .delete()
          .lt("expires_at", new Date().toISOString())
      } catch (err) {
        console.warn("[ScraperCache] Supabase clearAll error:", err)
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    memorySize: number
    supabaseConnected: boolean
  }> {
    const supabase = await this.getSupabase()

    return {
      memorySize: this.memoryCache.size(),
      supabaseConnected: !!supabase,
    }
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<{ memoryRemoved: number; supabaseRemoved: number }> {
    const memoryRemoved = this.memoryCache.cleanup()
    let supabaseRemoved = 0

    const supabase = await this.getSupabase()
    if (supabase) {
      try {
        const { data } = await supabase
          .from("scraper_cache")
          .delete()
          .lt("expires_at", new Date().toISOString())
          .select("count")

        supabaseRemoved = data?.[0]?.count || 0
      } catch (err) {
        console.warn("[ScraperCache] Supabase cleanup error:", err)
      }
    }

    return { memoryRemoved, supabaseRemoved }
  }
}

/**
 * Global cache singleton
 */
let globalCache: ScraperCache | null = null

/**
 * Get the global scraper cache instance
 */
export function getScraperCache(): ScraperCache {
  if (!globalCache) {
    globalCache = new ScraperCache()
  }
  return globalCache
}

/**
 * Higher-order function for caching async functions
 */
export function withCache<T, R extends { data: T[]; totalFound: number }>(
  source: string,
  fn: (query: string, options?: Record<string, unknown>) => Promise<R>,
  cache?: ScraperCache
): (query: string, options?: Record<string, unknown>) => Promise<R> {
  const scraperCache = cache || getScraperCache()

  return async (query: string, options?: Record<string, unknown>): Promise<R> => {
    // Try cache first
    const cached = await scraperCache.get<R["data"]>(source, query, options)
    if (cached) {
      return {
        data: cached.data,
        totalFound: cached.totalFound,
        // Add other fields that might be expected
      } as R
    }

    // Execute function
    const result = await fn(query, options)

    // Cache result
    if (result.data && result.data.length > 0) {
      await scraperCache.set(source, query, result.data, result.totalFound, options)
    }

    return result
  }
}
