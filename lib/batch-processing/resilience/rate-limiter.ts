/**
 * Rate Limiter Implementation
 *
 * Token bucket algorithm for rate limiting API calls.
 * Prevents overwhelming external services and helps avoid rate limit errors.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimiterConfig {
  /**
   * Maximum number of tokens in the bucket
   */
  maxTokens: number

  /**
   * Number of tokens added per interval
   */
  refillRate: number

  /**
   * Interval in milliseconds for token refill
   * @default 1000 (1 second)
   */
  refillInterval: number

  /**
   * Optional name for logging
   */
  name?: string
}

export interface RateLimiterStats {
  currentTokens: number
  maxTokens: number
  requestsWaiting: number
  totalRequests: number
  totalWaits: number
  avgWaitTime: number
}

// ============================================================================
// TOKEN BUCKET RATE LIMITER
// ============================================================================

export class TokenBucketRateLimiter {
  private tokens: number
  private lastRefill: number
  private waiting: number = 0
  private totalRequests: number = 0
  private totalWaits: number = 0
  private totalWaitTime: number = 0

  private readonly config: Required<RateLimiterConfig>

  constructor(config: RateLimiterConfig) {
    this.config = {
      maxTokens: config.maxTokens,
      refillRate: config.refillRate,
      refillInterval: config.refillInterval ?? 1000,
      name: config.name ?? "rate-limiter",
    }

    this.tokens = this.config.maxTokens
    this.lastRefill = Date.now()
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    const intervals = Math.floor(elapsed / this.config.refillInterval)

    if (intervals > 0) {
      const tokensToAdd = intervals * this.config.refillRate
      this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd)
      this.lastRefill = now - (elapsed % this.config.refillInterval)
    }
  }

  /**
   * Try to acquire a token without waiting
   * @returns true if token was acquired, false if no tokens available
   */
  tryAcquire(tokens: number = 1): boolean {
    this.refill()
    this.totalRequests++

    if (this.tokens >= tokens) {
      this.tokens -= tokens
      return true
    }

    return false
  }

  /**
   * Acquire a token, waiting if necessary
   * @returns Time waited in milliseconds
   */
  async acquire(tokens: number = 1): Promise<number> {
    this.totalRequests++

    // Try immediate acquisition
    this.refill()
    if (this.tokens >= tokens) {
      this.tokens -= tokens
      return 0
    }

    // Need to wait
    this.waiting++
    this.totalWaits++

    const startWait = Date.now()

    try {
      // Calculate how long we need to wait
      const tokensNeeded = tokens - this.tokens
      const intervalsNeeded = Math.ceil(tokensNeeded / this.config.refillRate)
      const waitTime = intervalsNeeded * this.config.refillInterval

      console.log(
        `[RateLimiter:${this.config.name}] Waiting ${waitTime}ms for ${tokens} token(s)`
      )

      await this.sleep(waitTime)

      // Refill and take tokens
      this.refill()
      this.tokens -= tokens

      const totalWait = Date.now() - startWait
      this.totalWaitTime += totalWait

      return totalWait
    } finally {
      this.waiting--
    }
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>, tokens: number = 1): Promise<T> {
    await this.acquire(tokens)
    return fn()
  }

  /**
   * Get current stats
   */
  getStats(): RateLimiterStats {
    this.refill()
    return {
      currentTokens: this.tokens,
      maxTokens: this.config.maxTokens,
      requestsWaiting: this.waiting,
      totalRequests: this.totalRequests,
      totalWaits: this.totalWaits,
      avgWaitTime: this.totalWaits > 0 ? this.totalWaitTime / this.totalWaits : 0,
    }
  }

  /**
   * Get current token count
   */
  getAvailableTokens(): number {
    this.refill()
    return this.tokens
  }

  /**
   * Check if tokens are available without consuming them
   */
  hasTokens(tokens: number = 1): boolean {
    this.refill()
    return this.tokens >= tokens
  }

  /**
   * Reset the rate limiter to full capacity
   */
  reset(): void {
    this.tokens = this.config.maxTokens
    this.lastRefill = Date.now()
    console.log(`[RateLimiter:${this.config.name}] Reset to full capacity`)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ============================================================================
// SLIDING WINDOW RATE LIMITER
// ============================================================================

/**
 * Sliding window rate limiter
 * More accurate for bursty workloads
 */
export class SlidingWindowRateLimiter {
  private readonly timestamps: number[] = []
  private totalRequests: number = 0
  private totalWaits: number = 0

  private readonly windowSize: number
  private readonly maxRequests: number
  private readonly name: string

  constructor(config: { maxRequests: number; windowSizeMs: number; name?: string }) {
    this.maxRequests = config.maxRequests
    this.windowSize = config.windowSizeMs
    this.name = config.name ?? "sliding-window"
  }

  /**
   * Clean up old timestamps
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.windowSize
    while (this.timestamps.length > 0 && this.timestamps[0] < cutoff) {
      this.timestamps.shift()
    }
  }

  /**
   * Try to acquire permission without waiting
   */
  tryAcquire(): boolean {
    this.cleanup()
    this.totalRequests++

    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(Date.now())
      return true
    }

    return false
  }

  /**
   * Acquire permission, waiting if necessary
   */
  async acquire(): Promise<number> {
    this.totalRequests++
    this.cleanup()

    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(Date.now())
      return 0
    }

    // Need to wait
    this.totalWaits++
    const oldestRequest = this.timestamps[0]
    const waitTime = oldestRequest + this.windowSize - Date.now()

    if (waitTime > 0) {
      console.log(`[RateLimiter:${this.name}] Waiting ${waitTime}ms`)
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }

    this.cleanup()
    this.timestamps.push(Date.now())
    return Math.max(0, waitTime)
  }

  /**
   * Execute with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    return fn()
  }

  /**
   * Get remaining requests in current window
   */
  getRemaining(): number {
    this.cleanup()
    return Math.max(0, this.maxRequests - this.timestamps.length)
  }

  /**
   * Get time until next request is available
   */
  getTimeUntilAvailable(): number {
    this.cleanup()

    if (this.timestamps.length < this.maxRequests) {
      return 0
    }

    const oldestRequest = this.timestamps[0]
    return Math.max(0, oldestRequest + this.windowSize - Date.now())
  }
}

// ============================================================================
// RATE LIMITER REGISTRY
// ============================================================================

class RateLimiterRegistry {
  private limiters: Map<string, TokenBucketRateLimiter> = new Map()

  getOrCreate(name: string, config: Omit<RateLimiterConfig, "name">): TokenBucketRateLimiter {
    let limiter = this.limiters.get(name)

    if (!limiter) {
      limiter = new TokenBucketRateLimiter({ ...config, name })
      this.limiters.set(name, limiter)
      console.log(`[RateLimiterRegistry] Created limiter for: ${name}`)
    }

    return limiter
  }

  get(name: string): TokenBucketRateLimiter | undefined {
    return this.limiters.get(name)
  }

  getAllStats(): Record<string, RateLimiterStats> {
    const stats: Record<string, RateLimiterStats> = {}
    for (const [name, limiter] of this.limiters) {
      stats[name] = limiter.getStats()
    }
    return stats
  }

  resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset()
    }
  }
}

export const rateLimiterRegistry = new RateLimiterRegistry()

// ============================================================================
// PRE-CONFIGURED RATE LIMITERS
// ============================================================================

export const RATE_LIMITER_CONFIGS = {
  /**
   * Perplexity API
   * Conservative: ~10 requests per minute
   */
  perplexity: {
    maxTokens: 10,
    refillRate: 2,
    refillInterval: 12000, // 2 tokens every 12 seconds
  },

  /**
   * OpenRouter API (for Grok, Claude corrections, etc.)
   * More generous: ~30 requests per minute
   */
  openrouter: {
    maxTokens: 30,
    refillRate: 5,
    refillInterval: 10000, // 5 tokens every 10 seconds
  },

  /**
   * LinkUp API
   * Conservative: ~5 requests per minute
   */
  linkup: {
    maxTokens: 5,
    refillRate: 1,
    refillInterval: 12000, // 1 token every 12 seconds
  },

  /**
   * SEC EDGAR API (free, but be nice)
   * ~10 requests per second is their limit
   */
  secEdgar: {
    maxTokens: 10,
    refillRate: 10,
    refillInterval: 1000, // 10 tokens per second
  },

  /**
   * FEC API
   * Conservative: ~5 requests per second
   */
  fec: {
    maxTokens: 5,
    refillRate: 5,
    refillInterval: 1000,
  },

  /**
   * ProPublica API
   * Free tier: ~2 requests per second
   */
  propublica: {
    maxTokens: 2,
    refillRate: 2,
    refillInterval: 1000,
  },
} as const

/**
 * Get pre-configured rate limiters for batch processing
 */
export function getBatchProcessingRateLimiters() {
  return {
    perplexity: rateLimiterRegistry.getOrCreate("perplexity", RATE_LIMITER_CONFIGS.perplexity),
    openrouter: rateLimiterRegistry.getOrCreate("openrouter", RATE_LIMITER_CONFIGS.openrouter),
    linkup: rateLimiterRegistry.getOrCreate("linkup", RATE_LIMITER_CONFIGS.linkup),
    secEdgar: rateLimiterRegistry.getOrCreate("sec_edgar", RATE_LIMITER_CONFIGS.secEdgar),
    fec: rateLimiterRegistry.getOrCreate("fec", RATE_LIMITER_CONFIGS.fec),
    propublica: rateLimiterRegistry.getOrCreate("propublica", RATE_LIMITER_CONFIGS.propublica),
  }
}

// ============================================================================
// COMBINED RATE LIMITER + CIRCUIT BREAKER
// ============================================================================

import { CircuitBreaker, type CircuitBreakerConfig } from "./circuit-breaker"

/**
 * Combined protection with both rate limiting and circuit breaking
 */
export class ProtectedExecutor {
  private rateLimiter: TokenBucketRateLimiter
  private circuitBreaker: CircuitBreaker

  constructor(
    rateLimiterConfig: RateLimiterConfig,
    circuitBreakerConfig: CircuitBreakerConfig
  ) {
    this.rateLimiter = new TokenBucketRateLimiter(rateLimiterConfig)
    this.circuitBreaker = new CircuitBreaker(circuitBreakerConfig)
  }

  /**
   * Execute with both rate limiting and circuit breaking
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // First check circuit breaker
    if (this.circuitBreaker.isOpen()) {
      throw new Error(`Circuit breaker is open`)
    }

    // Then wait for rate limit
    await this.rateLimiter.acquire()

    // Execute with circuit breaker
    return this.circuitBreaker.execute(fn)
  }

  /**
   * Get combined stats
   */
  getStats() {
    return {
      rateLimiter: this.rateLimiter.getStats(),
      circuitBreaker: this.circuitBreaker.getStats(),
    }
  }

  /**
   * Check if execution is currently possible
   */
  canExecute(): boolean {
    return !this.circuitBreaker.isOpen() && this.rateLimiter.hasTokens()
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a simple delay function with rate limiting in mind
 */
export function createThrottledFunction<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  minDelayMs: number
): T {
  let lastCall = 0

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const now = Date.now()
    const elapsed = now - lastCall
    const waitTime = minDelayMs - elapsed

    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }

    lastCall = Date.now()
    return fn(...args) as ReturnType<T>
  }) as T
}

/**
 * Batch requests with rate limiting
 * Processes items in parallel up to the rate limit
 */
export async function batchWithRateLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  rateLimiter: TokenBucketRateLimiter,
  options: { concurrency?: number; onProgress?: (completed: number, total: number) => void } = {}
): Promise<R[]> {
  const { concurrency = 5, onProgress } = options
  const results: R[] = []
  let completed = 0

  // Process in chunks
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)

    const chunkResults = await Promise.all(
      chunk.map(async (item) => {
        await rateLimiter.acquire()
        const result = await processor(item)
        completed++
        onProgress?.(completed, items.length)
        return result
      })
    )

    results.push(...chunkResults)
  }

  return results
}
