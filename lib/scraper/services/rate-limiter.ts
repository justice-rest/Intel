/**
 * Rate Limiter Service
 *
 * Token bucket rate limiter for controlling request rates per source.
 * Prevents getting blocked by rate limiting while maximizing throughput.
 *
 * Features:
 * - Per-source rate limiting
 * - Token bucket algorithm with refill
 * - Async/await API for easy integration
 * - Configurable rates per source
 */

/**
 * Rate limit configuration per source
 */
export interface RateLimitConfig {
  /** Requests allowed per minute */
  requestsPerMinute: number
  /** Maximum burst size (default: requestsPerMinute) */
  maxBurst?: number
}

/**
 * Default rate limits per source
 */
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // State registries
  florida: { requestsPerMinute: 30 },
  newYork: { requestsPerMinute: 20 },
  california: { requestsPerMinute: 15 },
  delaware: { requestsPerMinute: 10 }, // Be careful with CAPTCHA states
  texas: { requestsPerMinute: 10 },

  // External sources
  opencorporates: { requestsPerMinute: 10 },
  sec_edgar: { requestsPerMinute: 10 },

  // Default for unknown sources
  default: { requestsPerMinute: 10 },
}

/**
 * Token bucket state
 */
interface TokenBucket {
  tokens: number
  lastRefill: number
  config: Required<RateLimitConfig>
}

/**
 * Token Bucket Rate Limiter
 *
 * Implements the token bucket algorithm:
 * - Tokens are added at a constant rate (requestsPerMinute / 60)
 * - Each request consumes one token
 * - If no tokens available, wait until one is refilled
 * - Burst capacity allows temporary spikes
 */
export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map()
  private customLimits: Map<string, RateLimitConfig> = new Map()

  constructor(customLimits?: Record<string, RateLimitConfig>) {
    if (customLimits) {
      for (const [source, config] of Object.entries(customLimits)) {
        this.customLimits.set(source, config)
      }
    }
  }

  /**
   * Get or create a bucket for a source
   */
  private getBucket(source: string): TokenBucket {
    let bucket = this.buckets.get(source)

    if (!bucket) {
      const config = this.customLimits.get(source)
        || DEFAULT_RATE_LIMITS[source]
        || DEFAULT_RATE_LIMITS.default

      const fullConfig: Required<RateLimitConfig> = {
        requestsPerMinute: config.requestsPerMinute,
        maxBurst: config.maxBurst ?? config.requestsPerMinute,
      }

      bucket = {
        tokens: fullConfig.maxBurst, // Start with full bucket
        lastRefill: Date.now(),
        config: fullConfig,
      }

      this.buckets.set(source, bucket)
    }

    return bucket
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(bucket: TokenBucket): void {
    const now = Date.now()
    const elapsed = now - bucket.lastRefill
    const tokensPerMs = bucket.config.requestsPerMinute / 60000

    const tokensToAdd = elapsed * tokensPerMs
    bucket.tokens = Math.min(bucket.config.maxBurst, bucket.tokens + tokensToAdd)
    bucket.lastRefill = now
  }

  /**
   * Calculate wait time until a token is available
   */
  private getWaitTime(bucket: TokenBucket): number {
    if (bucket.tokens >= 1) {
      return 0
    }

    const tokensNeeded = 1 - bucket.tokens
    const tokensPerMs = bucket.config.requestsPerMinute / 60000

    return Math.ceil(tokensNeeded / tokensPerMs)
  }

  /**
   * Acquire a token (wait if necessary)
   *
   * @param source - The source to rate limit
   * @returns Promise that resolves when token is acquired
   */
  async acquire(source: string): Promise<void> {
    const bucket = this.getBucket(source)

    // Refill tokens based on time elapsed
    this.refill(bucket)

    // Check if we need to wait
    const waitTime = this.getWaitTime(bucket)
    if (waitTime > 0) {
      console.log(`[RateLimiter] Waiting ${waitTime}ms for ${source}`)
      await new Promise(resolve => setTimeout(resolve, waitTime))

      // Refill again after waiting
      this.refill(bucket)
    }

    // Consume token
    bucket.tokens -= 1
  }

  /**
   * Try to acquire a token without waiting
   *
   * @param source - The source to rate limit
   * @returns true if token acquired, false if would need to wait
   */
  tryAcquire(source: string): boolean {
    const bucket = this.getBucket(source)
    this.refill(bucket)

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return true
    }

    return false
  }

  /**
   * Get current token count for a source
   */
  getTokens(source: string): number {
    const bucket = this.getBucket(source)
    this.refill(bucket)
    return bucket.tokens
  }

  /**
   * Get remaining time until next token (ms)
   */
  getTimeUntilNextToken(source: string): number {
    const bucket = this.getBucket(source)
    this.refill(bucket)
    return this.getWaitTime(bucket)
  }

  /**
   * Update rate limit for a source
   */
  setRateLimit(source: string, config: RateLimitConfig): void {
    this.customLimits.set(source, config)
    // Reset bucket so new config takes effect
    this.buckets.delete(source)
  }

  /**
   * Get current rate limit config for a source
   */
  getRateLimit(source: string): Required<RateLimitConfig> {
    const bucket = this.getBucket(source)
    return bucket.config
  }

  /**
   * Reset a source's bucket (useful after errors)
   */
  reset(source: string): void {
    this.buckets.delete(source)
  }

  /**
   * Reset all buckets
   */
  resetAll(): void {
    this.buckets.clear()
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): Record<string, { tokens: number; requestsPerMinute: number }> {
    const stats: Record<string, { tokens: number; requestsPerMinute: number }> = {}

    for (const [source, bucket] of this.buckets) {
      this.refill(bucket)
      stats[source] = {
        tokens: Math.floor(bucket.tokens * 100) / 100,
        requestsPerMinute: bucket.config.requestsPerMinute,
      }
    }

    return stats
  }
}

/**
 * Global rate limiter singleton
 */
let globalRateLimiter: RateLimiter | null = null

/**
 * Get the global rate limiter instance
 */
export function getRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter()
  }
  return globalRateLimiter
}

/**
 * Decorator for rate-limited functions
 */
export function rateLimited(source: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function <T extends (...args: any[]) => Promise<any>>(
    _target: object,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const originalMethod = descriptor.value!

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    descriptor.value = async function (this: unknown, ...args: any[]) {
      await getRateLimiter().acquire(source)
      return originalMethod.apply(this, args)
    } as T

    return descriptor
  }
}

/**
 * Higher-order function for rate limiting any async function
 */
export function withRateLimit<T extends unknown[], R>(
  source: string,
  fn: (...args: T) => Promise<R>,
  limiter?: RateLimiter
): (...args: T) => Promise<R> {
  const rateLimiter = limiter || getRateLimiter()

  return async (...args: T): Promise<R> => {
    await rateLimiter.acquire(source)
    return fn(...args)
  }
}
