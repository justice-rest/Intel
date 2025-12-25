/**
 * Hot Memory Cache - In-Memory LRU Cache for Fastest Retrieval
 *
 * Implements the "hot" tier of the multi-tier memory architecture:
 * - <5ms access time (in-memory)
 * - Top 20 memories per user by importance/access velocity
 * - LRU eviction with max 1000 global entries
 * - Auto-population on user session start
 * - Background refresh every 10 minutes
 *
 * Inspired by Supermemory's fast memory retrieval patterns.
 */

import type {
  UserMemoryV2,
  HotCacheEntry,
  HotCacheConfig,
  CacheStats,
  MemoryTier,
} from "./types"

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: HotCacheConfig = {
  maxPerUser: 20,
  globalMax: 1000,
  ttlMs: 10 * 60 * 1000, // 10 minutes
  cleanupIntervalMs: 60 * 1000, // 1 minute
}

// ============================================================================
// HOT MEMORY CACHE CLASS
// ============================================================================

export class HotMemoryCache {
  private cache: Map<string, HotCacheEntry> = new Map()
  private config: HotCacheConfig
  private hitCount = 0
  private missCount = 0
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(config: Partial<HotCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Start the cache cleanup interval
   */
  start(): void {
    if (this.cleanupInterval) return

    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupIntervalMs)

    // Don't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  /**
   * Stop the cache cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Load memories for a user into the hot cache
   * Called when user session starts or cache needs refresh
   */
  async loadUser(
    userId: string,
    memories: UserMemoryV2[]
  ): Promise<void> {
    // Sort by importance * access_velocity, take top N
    const sorted = [...memories].sort((a, b) => {
      const scoreA = a.importance_score * (1 + a.access_velocity)
      const scoreB = b.importance_score * (1 + b.access_velocity)
      return scoreB - scoreA
    })

    const topMemories = sorted.slice(0, this.config.maxPerUser)

    // Ensure we don't exceed global max
    if (this.cache.size >= this.config.globalMax && !this.cache.has(userId)) {
      this.evictLRU()
    }

    const now = Date.now()
    this.cache.set(userId, {
      memories: topMemories,
      loadedAt: now,
      accessCount: 0,
      lastAccessedAt: now,
    })
  }

  /**
   * Get memories from hot cache for a user
   * Returns null if not in cache (cache miss)
   */
  get(userId: string): UserMemoryV2[] | null {
    const entry = this.cache.get(userId)

    if (!entry) {
      this.missCount++
      return null
    }

    // Check if expired
    if (Date.now() - entry.loadedAt > this.config.ttlMs) {
      this.cache.delete(userId)
      this.missCount++
      return null
    }

    // Update access stats
    entry.accessCount++
    entry.lastAccessedAt = Date.now()

    this.hitCount++
    return entry.memories
  }

  /**
   * Check if user is in hot cache
   */
  has(userId: string): boolean {
    const entry = this.cache.get(userId)
    if (!entry) return false

    // Check if expired
    if (Date.now() - entry.loadedAt > this.config.ttlMs) {
      this.cache.delete(userId)
      return false
    }

    return true
  }

  /**
   * Invalidate cache for a specific user
   * Called when user's memories are updated
   */
  invalidate(userId: string): void {
    this.cache.delete(userId)
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    this.cache.clear()
  }

  /**
   * Add a single memory to user's hot cache
   * Used for immediate cache update after memory creation
   */
  addMemory(userId: string, memory: UserMemoryV2): void {
    const entry = this.cache.get(userId)
    if (!entry) return

    // Add to cache if not already present
    const exists = entry.memories.some((m) => m.id === memory.id)
    if (exists) return

    // Add and re-sort by importance
    entry.memories.push(memory)
    entry.memories.sort((a, b) => {
      const scoreA = a.importance_score * (1 + a.access_velocity)
      const scoreB = b.importance_score * (1 + b.access_velocity)
      return scoreB - scoreA
    })

    // Trim to max
    if (entry.memories.length > this.config.maxPerUser) {
      entry.memories = entry.memories.slice(0, this.config.maxPerUser)
    }
  }

  /**
   * Remove a memory from user's hot cache
   * Used for immediate cache update after memory deletion
   */
  removeMemory(userId: string, memoryId: string): void {
    const entry = this.cache.get(userId)
    if (!entry) return

    entry.memories = entry.memories.filter((m) => m.id !== memoryId)
  }

  /**
   * Update a memory in user's hot cache
   */
  updateMemory(userId: string, memory: UserMemoryV2): void {
    const entry = this.cache.get(userId)
    if (!entry) return

    const index = entry.memories.findIndex((m) => m.id === memory.id)
    if (index !== -1) {
      entry.memories[index] = memory
      // Re-sort in case importance changed
      entry.memories.sort((a, b) => {
        const scoreA = a.importance_score * (1 + a.access_velocity)
        const scoreB = b.importance_score * (1 + b.access_velocity)
        return scoreB - scoreA
      })
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values())
    const totalMemories = entries.reduce((sum, e) => sum + e.memories.length, 0)
    const loadTimes = entries.map((e) => e.loadedAt)

    const totalRequests = this.hitCount + this.missCount
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0
    const missRate = totalRequests > 0 ? this.missCount / totalRequests : 0

    return {
      totalEntries: this.cache.size,
      totalMemories,
      hitRate,
      missRate,
      avgAccessTime: 0, // In-memory is <1ms
      oldestEntry: loadTimes.length > 0 ? Math.min(...loadTimes) : null,
      newestEntry: loadTimes.length > 0 ? Math.max(...loadTimes) : null,
    }
  }

  /**
   * Get all user IDs in cache
   */
  getCachedUserIds(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Get hot memories for a user, filtering by criteria
   */
  getFiltered(
    userId: string,
    options: {
      staticOnly?: boolean
      minImportance?: number
      limit?: number
    } = {}
  ): UserMemoryV2[] | null {
    const memories = this.get(userId)
    if (!memories) return null

    let filtered = memories

    if (options.staticOnly) {
      filtered = filtered.filter((m) => m.is_static)
    }

    if (options.minImportance !== undefined) {
      filtered = filtered.filter(
        (m) => m.importance_score >= options.minImportance!
      )
    }

    if (options.limit !== undefined) {
      filtered = filtered.slice(0, options.limit)
    }

    return filtered
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    const expiredUserIds: string[] = []

    for (const [userId, entry] of this.cache.entries()) {
      if (now - entry.loadedAt > this.config.ttlMs) {
        expiredUserIds.push(userId)
      }
    }

    for (const userId of expiredUserIds) {
      this.cache.delete(userId)
    }
  }

  /**
   * Evict least recently used entry when at capacity
   */
  private evictLRU(): void {
    let lruUserId: string | null = null
    let lruTime = Infinity

    for (const [userId, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < lruTime) {
        lruTime = entry.lastAccessedAt
        lruUserId = userId
      }
    }

    if (lruUserId) {
      this.cache.delete(lruUserId)
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let hotCacheInstance: HotMemoryCache | null = null

/**
 * Get the global hot cache instance
 */
export function getHotCache(config?: Partial<HotCacheConfig>): HotMemoryCache {
  if (!hotCacheInstance) {
    hotCacheInstance = new HotMemoryCache(config)
    hotCacheInstance.start()
  }
  return hotCacheInstance
}

/**
 * Shutdown the hot cache (for testing/cleanup)
 */
export function shutdownHotCache(): void {
  if (hotCacheInstance) {
    hotCacheInstance.stop()
    hotCacheInstance.invalidateAll()
    hotCacheInstance = null
  }
}

// ============================================================================
// CACHE LOADER UTILITIES
// ============================================================================

/**
 * Determine which memories should be in hot cache
 * Based on importance, access velocity, and recency
 */
export function selectHotMemories(
  memories: UserMemoryV2[],
  limit: number = 20
): UserMemoryV2[] {
  // Filter out forgotten and cold memories
  const eligible = memories.filter(
    (m) => !m.is_forgotten && m.memory_tier !== "cold"
  )

  // Score and sort
  const scored = eligible.map((m) => ({
    memory: m,
    score: calculateHotScore(m),
  }))

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map((s) => s.memory)
}

/**
 * Calculate hot cache priority score for a memory
 */
export function calculateHotScore(memory: UserMemoryV2): number {
  // Base score from importance
  let score = memory.importance_score * 100

  // Boost for static memories (always include)
  if (memory.is_static) {
    score += 50
  }

  // Boost for profile memories
  if (memory.memory_kind === "profile") {
    score += 30
  }

  // Boost for high access velocity
  score += memory.access_velocity * 20

  // Boost for recent access
  if (memory.last_accessed_at) {
    const hoursSinceAccess =
      (Date.now() - new Date(memory.last_accessed_at).getTime()) / (1000 * 60 * 60)
    if (hoursSinceAccess < 1) {
      score += 20
    } else if (hoursSinceAccess < 24) {
      score += 10
    }
  }

  // Penalty for inferred memories (slightly less priority)
  if (memory.is_inference) {
    score *= 0.9
  }

  return score
}

/**
 * Check if a memory qualifies for hot tier promotion
 */
export function qualifiesForHotTier(
  memory: UserMemoryV2,
  thresholds: {
    minImportance: number
    minVelocity: number
    maxInactiveDays: number
  } = {
    minImportance: 0.5,
    minVelocity: 0.3,
    maxInactiveDays: 7,
  }
): boolean {
  // Static memories always qualify
  if (memory.is_static) return true

  // Profile memories always qualify
  if (memory.memory_kind === "profile") return true

  // Check importance
  if (memory.importance_score < thresholds.minImportance) return false

  // Check access velocity
  if (memory.access_velocity < thresholds.minVelocity) return false

  // Check recency
  if (memory.last_accessed_at) {
    const daysSinceAccess =
      (Date.now() - new Date(memory.last_accessed_at).getTime()) /
      (1000 * 60 * 60 * 24)
    if (daysSinceAccess > thresholds.maxInactiveDays) return false
  }

  return true
}
