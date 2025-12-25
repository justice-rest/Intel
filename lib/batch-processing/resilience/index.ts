/**
 * Resilience Module
 *
 * Provides circuit breaker, retry, and rate limiting utilities
 * for robust batch processing operations.
 */

export {
  CircuitBreaker,
  circuitBreakerRegistry,
  getBatchProcessingCircuitBreakers,
  isCircuitBreakerError,
  executeWithFallback,
  CIRCUIT_BREAKER_CONFIGS,
  type CircuitBreakerConfig,
  type CircuitBreakerState,
  type CircuitBreakerStats,
  type CircuitBreakerError,
} from "./circuit-breaker"

export {
  executeWithRetry,
  executeWithRetryOrThrow,
  createRetryPolicy,
  createSelectiveRetryPolicy,
  createRateLimitAwarePolicy,
  isRateLimitError,
  isTimeoutError,
  isConnectionError,
  extractRetryAfter,
  DEFAULT_LLM_RETRY_POLICY,
  AGGRESSIVE_RETRY_POLICY,
  QUICK_RETRY_POLICY,
  NO_RETRY_POLICY,
  BATCH_PROCESSING_RETRY_POLICIES,
  type RetryPolicy,
  type RetryResult,
  type RetryOptions,
} from "./retry-policy"

export {
  TokenBucketRateLimiter,
  SlidingWindowRateLimiter,
  ProtectedExecutor,
  rateLimiterRegistry,
  getBatchProcessingRateLimiters,
  createThrottledFunction,
  batchWithRateLimit,
  RATE_LIMITER_CONFIGS,
  type RateLimiterConfig,
  type RateLimiterStats,
} from "./rate-limiter"
