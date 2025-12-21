/**
 * Scraper Services Index
 *
 * Exports all scraper services:
 * - Rate limiter: Token bucket rate limiting per source
 * - Circuit breaker: Failure protection and automatic recovery
 * - Cache: Result caching with Supabase + in-memory fallback
 * - Proxy rotator: Free proxy rotation for web scraping
 * - Browser stealth: Fingerprint randomization and bot detection evasion
 */

// Rate Limiter
export {
  RateLimiter,
  getRateLimiter,
  rateLimited,
  withRateLimit,
  DEFAULT_RATE_LIMITS,
  type RateLimitConfig,
} from "./rate-limiter"

// Circuit Breaker
export {
  CircuitBreaker,
  getCircuitBreaker,
  withCircuitBreaker,
  DEFAULT_CIRCUIT_CONFIG,
  type CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerResult,
} from "./circuit-breaker"

// Cache
export {
  ScraperCache,
  getScraperCache,
  withCache,
  generateCacheKey,
  DEFAULT_CACHE_CONFIG,
  type CacheEntry,
  type CacheConfig,
} from "./cache"

// Proxy Rotator
export {
  proxyRotator,
  testProxy,
  withProxyRetry,
  type Proxy,
} from "./proxy-rotator"

// NOTE: Browser stealth functions are now in ../stealth-browser.ts
// The browser-stealth.ts service file is deprecated and not used.
