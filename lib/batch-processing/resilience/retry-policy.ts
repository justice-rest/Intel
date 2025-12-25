/**
 * Retry Policy Utilities
 *
 * Configurable retry strategies for batch processing operations.
 * Supports exponential backoff, jitter, and selective error retries.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RetryPolicy {
  /**
   * Maximum number of retry attempts (not including initial attempt)
   * @default 3
   */
  maxRetries: number

  /**
   * Base delay in milliseconds between retries
   * @default 1000
   */
  baseDelay: number

  /**
   * Maximum delay in milliseconds (caps exponential backoff)
   * @default 30000
   */
  maxDelay: number

  /**
   * Multiplier for exponential backoff
   * @default 2
   */
  backoffMultiplier: number

  /**
   * Whether to add jitter to prevent thundering herd
   * @default true
   */
  useJitter: boolean

  /**
   * Function to determine if an error is retryable
   * @default Returns true for rate limits, timeouts, and transient errors
   */
  isRetryable: (error: Error, attempt: number) => boolean

  /**
   * Optional callback before each retry
   */
  onRetry?: (error: Error, attempt: number, delay: number) => void
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
  totalTime: number
  retryErrors: Error[]
}

export interface RetryOptions extends Partial<RetryPolicy> {
  /**
   * Optional name for logging
   */
  name?: string

  /**
   * Optional abort signal for cancellation
   */
  signal?: AbortSignal
}

// ============================================================================
// DEFAULT RETRY POLICIES
// ============================================================================

/**
 * Default function to determine if an error is retryable
 */
function defaultIsRetryable(error: Error): boolean {
  const message = error.message.toLowerCase()

  // Rate limit errors (always retry)
  if (message.includes("429") || message.includes("rate limit")) {
    return true
  }

  // Service unavailable (temporary)
  if (message.includes("503") || message.includes("service unavailable")) {
    return true
  }

  // Gateway errors (temporary)
  if (message.includes("502") || message.includes("504") || message.includes("bad gateway")) {
    return true
  }

  // Timeout errors
  if (message.includes("timeout") || message.includes("timed out") || message.includes("etimedout")) {
    return true
  }

  // Connection errors
  if (
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("network")
  ) {
    return true
  }

  // Server errors (5xx)
  if (message.includes("internal server error") || message.includes("500")) {
    return true
  }

  // Specific API errors that are transient
  if (message.includes("temporarily") || message.includes("try again")) {
    return true
  }

  return false
}

/**
 * Default retry policy for LLM API calls
 */
export const DEFAULT_LLM_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  useJitter: true,
  isRetryable: defaultIsRetryable,
}

/**
 * Aggressive retry policy for critical operations
 */
export const AGGRESSIVE_RETRY_POLICY: RetryPolicy = {
  maxRetries: 5,
  baseDelay: 500,
  maxDelay: 60000,
  backoffMultiplier: 2,
  useJitter: true,
  isRetryable: defaultIsRetryable,
}

/**
 * Quick retry policy for fast-failing operations
 */
export const QUICK_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  baseDelay: 200,
  maxDelay: 2000,
  backoffMultiplier: 2,
  useJitter: true,
  isRetryable: defaultIsRetryable,
}

/**
 * No retry policy (single attempt)
 */
export const NO_RETRY_POLICY: RetryPolicy = {
  maxRetries: 0,
  baseDelay: 0,
  maxDelay: 0,
  backoffMultiplier: 1,
  useJitter: false,
  isRetryable: () => false,
}

// ============================================================================
// PRE-CONFIGURED POLICIES FOR BATCH PROCESSING
// ============================================================================

export const BATCH_PROCESSING_RETRY_POLICIES = {
  /**
   * Primary LLM calls (Perplexity Sonar Pro)
   * More retries since these are critical
   */
  perplexity: {
    ...DEFAULT_LLM_RETRY_POLICY,
    maxRetries: 3,
    baseDelay: 2000,
  },

  /**
   * Secondary LLM calls (Grok, etc.)
   * Fewer retries - we can skip if failing
   */
  secondaryLLM: {
    ...DEFAULT_LLM_RETRY_POLICY,
    maxRetries: 2,
    baseDelay: 1000,
  },

  /**
   * Search API calls (LinkUp)
   * Quick retries
   */
  searchAPI: {
    ...QUICK_RETRY_POLICY,
    maxRetries: 2,
  },

  /**
   * Verification APIs (SEC, FEC, ProPublica)
   * Patient retries - these are free and slow
   */
  verificationAPI: {
    ...DEFAULT_LLM_RETRY_POLICY,
    maxRetries: 3,
    baseDelay: 3000,
    maxDelay: 15000,
  },

  /**
   * Database operations
   * Quick retries for transient issues
   */
  database: {
    ...QUICK_RETRY_POLICY,
    maxRetries: 3,
    baseDelay: 100,
  },
} as const

// ============================================================================
// RETRY EXECUTION
// ============================================================================

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffMultiplier: number,
  useJitter: boolean
): number {
  // Exponential backoff: baseDelay * multiplier^attempt
  let delay = baseDelay * Math.pow(backoffMultiplier, attempt)

  // Cap at max delay
  delay = Math.min(delay, maxDelay)

  // Add jitter (±25% of delay)
  if (useJitter) {
    const jitterRange = delay * 0.25
    const jitter = Math.random() * jitterRange * 2 - jitterRange
    delay = Math.max(0, delay + jitter)
  }

  return Math.round(delay)
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"))
      return
    }

    const timeout = setTimeout(resolve, ms)

    signal?.addEventListener("abort", () => {
      clearTimeout(timeout)
      reject(new Error("Aborted"))
    })
  })
}

/**
 * Execute a function with retry policy
 *
 * @example
 * ```ts
 * const result = await executeWithRetry(
 *   () => fetchFromPerplexity(query),
 *   BATCH_PROCESSING_RETRY_POLICIES.perplexity
 * )
 * ```
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const policy: RetryPolicy = {
    ...DEFAULT_LLM_RETRY_POLICY,
    ...options,
  }

  const startTime = Date.now()
  const retryErrors: Error[] = []
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    try {
      // Check for abort
      if (options.signal?.aborted) {
        throw new Error("Aborted")
      }

      const data = await fn()

      return {
        success: true,
        data,
        attempts: attempt + 1,
        totalTime: Date.now() - startTime,
        retryErrors,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if we should retry
      const canRetry = attempt < policy.maxRetries && policy.isRetryable(lastError, attempt)

      if (canRetry) {
        retryErrors.push(lastError)

        // Calculate delay
        const delay = calculateDelay(
          attempt,
          policy.baseDelay,
          policy.maxDelay,
          policy.backoffMultiplier,
          policy.useJitter
        )

        console.log(
          `[Retry${options.name ? `:${options.name}` : ""}] ` +
            `Attempt ${attempt + 1} failed: ${lastError.message}. ` +
            `Retrying in ${delay}ms...`
        )

        // Call onRetry callback
        policy.onRetry?.(lastError, attempt + 1, delay)

        // Wait before retry
        await sleep(delay, options.signal)
      } else {
        // Not retryable or max retries reached
        console.log(
          `[Retry${options.name ? `:${options.name}` : ""}] ` +
            `Attempt ${attempt + 1} failed: ${lastError.message}. ` +
            (attempt >= policy.maxRetries ? "Max retries reached." : "Error not retryable.")
        )
        break
      }
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: retryErrors.length + 1,
    totalTime: Date.now() - startTime,
    retryErrors,
  }
}

/**
 * Execute with retry, throwing on failure
 * Use when you need the error to propagate
 */
export async function executeWithRetryOrThrow<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const result = await executeWithRetry(fn, options)

  if (!result.success) {
    const error = result.error || new Error("Unknown error after retries")
    ;(error as Error & { attempts: number; retryErrors: Error[] }).attempts = result.attempts
    ;(error as Error & { attempts: number; retryErrors: Error[] }).retryErrors = result.retryErrors
    throw error
  }

  return result.data!
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a custom retry policy
 */
export function createRetryPolicy(overrides: Partial<RetryPolicy>): RetryPolicy {
  return {
    ...DEFAULT_LLM_RETRY_POLICY,
    ...overrides,
  }
}

/**
 * Create a retry policy that only retries specific error types
 */
export function createSelectiveRetryPolicy(
  errorPatterns: string[],
  base: Partial<RetryPolicy> = {}
): RetryPolicy {
  return createRetryPolicy({
    ...base,
    isRetryable: (error: Error) => {
      const message = error.message.toLowerCase()
      return errorPatterns.some((pattern) => message.includes(pattern.toLowerCase()))
    },
  })
}

/**
 * Check if an error looks like a rate limit
 */
export function isRateLimitError(error: Error): boolean {
  const message = error.message.toLowerCase()
  return message.includes("429") || message.includes("rate limit") || message.includes("too many requests")
}

/**
 * Check if an error looks like a timeout
 */
export function isTimeoutError(error: Error): boolean {
  const message = error.message.toLowerCase()
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("etimedout") ||
    message.includes("deadline exceeded")
  )
}

/**
 * Check if an error looks like a connection error
 */
export function isConnectionError(error: Error): boolean {
  const message = error.message.toLowerCase()
  return (
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("network") ||
    message.includes("dns")
  )
}

/**
 * Extract retry-after header value if present in error
 * Returns delay in milliseconds, or null if not found
 */
export function extractRetryAfter(error: Error): number | null {
  const message = error.message.toLowerCase()

  // Look for "retry-after: X" or "retry after X seconds"
  const match = message.match(/retry[- ]after[:\s]+(\d+)/i)
  if (match) {
    const value = parseInt(match[1], 10)
    // If value is large, assume it's seconds. If small, could be seconds or already ms
    return value > 100 ? value : value * 1000
  }

  return null
}

/**
 * Create a retry policy that respects retry-after headers
 */
export function createRateLimitAwarePolicy(base: Partial<RetryPolicy> = {}): RetryPolicy {
  let nextRetryAfter: number | null = null

  return createRetryPolicy({
    ...base,
    isRetryable: (error: Error, attempt: number) => {
      // Always retry rate limits
      if (isRateLimitError(error)) {
        nextRetryAfter = extractRetryAfter(error)
        return true
      }
      return defaultIsRetryable(error)
    },
    onRetry: (error, attempt, delay) => {
      if (nextRetryAfter && nextRetryAfter > delay) {
        console.log(`[RetryPolicy] Rate limit detected, waiting ${nextRetryAfter}ms instead of ${delay}ms`)
      }
      nextRetryAfter = null
    },
  })
}
