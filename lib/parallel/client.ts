/**
 * Parallel AI Client Wrapper
 *
 * Enterprise-grade client with circuit breaker protection, retry logic,
 * and comprehensive error handling. No fallback to legacy systems -
 * if Parallel fails, research is gracefully unavailable.
 *
 * @see https://parallel.ai/docs
 */

import Parallel from "parallel-web"
import type {
  BetaSearchParams,
  BetaExtractParams,
  SearchResult,
  ExtractResponse,
} from "parallel-web/resources/beta/beta"
import {
  circuitBreakerRegistry,
  CIRCUIT_BREAKER_CONFIGS,
  type CircuitBreaker,
} from "@/lib/batch-processing/resilience/circuit-breaker"
import {
  isParallelAvailable,
  isParallelConfigured,
  getParallelFlags,
} from "@/lib/feature-flags/parallel-migration"

// ============================================================================
// TYPES
// ============================================================================

export interface ParallelClientConfig {
  /** API key (defaults to PARALLEL_API_KEY env var) */
  apiKey?: string
  /** Request timeout in ms (default: 30000) */
  timeout?: number
  /** Max retries for transient failures (default: 2) */
  maxRetries?: number
  /** Base URL override (for testing) */
  baseURL?: string
}

export interface ParallelSearchOptions {
  /** Natural language search objective */
  objective: string
  /** Optional keyword queries */
  searchQueries?: string[]
  /** Max results to return (default: 10) */
  maxResults?: number
  /** Search mode: 'one-shot' for comprehensive, 'agentic' for token-efficient */
  mode?: "one-shot" | "agentic"
  /** Max characters per result excerpt */
  maxCharsPerResult?: number
  /** Domain allowlist */
  allowedDomains?: string[]
  /** Domain blocklist */
  blockedDomains?: string[]
}

export interface ParallelExtractOptions {
  /** URLs to extract content from */
  urls: string[]
  /** Focus extraction on this objective */
  objective?: string
  /** Include full content (not just excerpts) */
  fullContent?: boolean
  /** Max characters per result */
  maxCharsPerResult?: number
}

export interface ParallelError extends Error {
  code: ParallelErrorCode
  statusCode?: number
  retryable: boolean
  details?: Record<string, unknown>
}

export type ParallelErrorCode =
  | "NOT_CONFIGURED"
  | "NOT_AVAILABLE"
  | "CIRCUIT_OPEN"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "AUTHENTICATION_ERROR"
  | "INVALID_REQUEST"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR"

// ============================================================================
// ERROR FACTORY
// ============================================================================

function createParallelError(
  message: string,
  code: ParallelErrorCode,
  options?: {
    statusCode?: number
    retryable?: boolean
    details?: Record<string, unknown>
    cause?: Error
  }
): ParallelError {
  const error = new Error(message) as ParallelError
  error.name = "ParallelError"
  error.code = code
  error.statusCode = options?.statusCode
  error.retryable = options?.retryable ?? false
  error.details = options?.details
  if (options?.cause) {
    error.cause = options.cause
  }
  return error
}

function classifyError(error: unknown): ParallelError {
  // Already a ParallelError
  if (error instanceof Error && "code" in error && "retryable" in error) {
    return error as ParallelError
  }

  // Handle Parallel SDK errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Rate limiting
    if (message.includes("rate limit") || message.includes("429")) {
      return createParallelError("Rate limit exceeded", "RATE_LIMITED", {
        statusCode: 429,
        retryable: true,
        cause: error,
      })
    }

    // Authentication
    if (
      message.includes("authentication") ||
      message.includes("unauthorized") ||
      message.includes("401")
    ) {
      return createParallelError("Authentication failed", "AUTHENTICATION_ERROR", {
        statusCode: 401,
        retryable: false,
        cause: error,
      })
    }

    // Timeout
    if (message.includes("timeout") || message.includes("timed out")) {
      return createParallelError("Request timed out", "TIMEOUT", {
        retryable: true,
        cause: error,
      })
    }

    // Server errors
    if (message.includes("500") || message.includes("502") || message.includes("503")) {
      return createParallelError("Parallel server error", "SERVER_ERROR", {
        statusCode: 500,
        retryable: true,
        cause: error,
      })
    }

    // Network errors
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("ECONNREFUSED")
    ) {
      return createParallelError("Network error", "NETWORK_ERROR", {
        retryable: true,
        cause: error,
      })
    }

    // Bad request
    if (message.includes("400") || message.includes("invalid")) {
      return createParallelError("Invalid request", "INVALID_REQUEST", {
        statusCode: 400,
        retryable: false,
        cause: error,
      })
    }

    // Unknown error
    return createParallelError(error.message, "UNKNOWN_ERROR", {
      retryable: false,
      cause: error,
    })
  }

  // Non-Error thrown
  return createParallelError(String(error), "UNKNOWN_ERROR", {
    retryable: false,
  })
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

interface RetryOptions {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function calculateBackoff(attempt: number, options: RetryOptions): number {
  // Exponential backoff with jitter
  const exponentialDelay = options.baseDelayMs * Math.pow(2, attempt)
  const jitter = Math.random() * 0.3 * exponentialDelay
  return Math.min(exponentialDelay + jitter, options.maxDelayMs)
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<T> {
  let lastError: ParallelError | null = null

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = classifyError(error)

      // Don't retry non-retryable errors
      if (!lastError.retryable) {
        throw lastError
      }

      // Don't retry if we've exhausted retries
      if (attempt === options.maxRetries) {
        throw lastError
      }

      // Wait before retrying
      const delayMs = calculateBackoff(attempt, options)
      console.warn(
        `[Parallel] Retry ${attempt + 1}/${options.maxRetries} after ${delayMs}ms: ${lastError.message}`
      )
      await sleep(delayMs)
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError ?? createParallelError("Unknown error", "UNKNOWN_ERROR")
}

// ============================================================================
// CLIENT SINGLETON
// ============================================================================

let clientInstance: Parallel | null = null
let clientConfig: ParallelClientConfig | null = null

function getClient(config?: ParallelClientConfig): Parallel {
  // Check if we need to create a new instance
  const newConfig = config ?? {}
  const configChanged =
    clientConfig !== null &&
    (newConfig.apiKey !== clientConfig.apiKey ||
      newConfig.baseURL !== clientConfig.baseURL ||
      newConfig.timeout !== clientConfig.timeout)

  if (clientInstance === null || configChanged) {
    const apiKey = newConfig.apiKey ?? process.env.PARALLEL_API_KEY

    if (!apiKey) {
      throw createParallelError(
        "PARALLEL_API_KEY is not configured",
        "NOT_CONFIGURED"
      )
    }

    clientInstance = new Parallel({
      apiKey,
      baseURL: newConfig.baseURL,
      timeout: newConfig.timeout ?? 30000,
      maxRetries: 0, // We handle retries ourselves for better control
    })

    clientConfig = newConfig
  }

  return clientInstance
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

function getSearchCircuitBreaker(): CircuitBreaker {
  return circuitBreakerRegistry.getOrCreate(
    "parallel-search",
    CIRCUIT_BREAKER_CONFIGS.searchAPI
  )
}

function getExtractCircuitBreaker(): CircuitBreaker {
  return circuitBreakerRegistry.getOrCreate(
    "parallel-extract",
    CIRCUIT_BREAKER_CONFIGS.searchAPI
  )
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Search the web using Parallel AI
 *
 * @param options - Search configuration
 * @param config - Optional client configuration
 * @returns Search results with URLs, excerpts, and metadata
 * @throws ParallelError with specific error codes
 */
export async function parallelSearch(
  options: ParallelSearchOptions,
  config?: ParallelClientConfig
): Promise<SearchResult> {
  // Pre-flight checks
  if (!isParallelConfigured()) {
    throw createParallelError(
      "Parallel API key not configured",
      "NOT_CONFIGURED"
    )
  }

  if (!isParallelAvailable()) {
    throw createParallelError(
      "Parallel is not enabled",
      "NOT_AVAILABLE"
    )
  }

  const circuitBreaker = getSearchCircuitBreaker()

  // Check circuit breaker state
  if (circuitBreaker.isOpen()) {
    throw createParallelError(
      "Parallel search circuit breaker is open - service temporarily unavailable",
      "CIRCUIT_OPEN",
      { retryable: true }
    )
  }

  // Get client - wrap in try/catch to properly classify errors
  let client: Parallel
  try {
    client = getClient(config)
  } catch (error) {
    throw classifyError(error)
  }

  // Build search params
  const searchParams: BetaSearchParams = {
    objective: options.objective,
    mode: options.mode ?? "one-shot",
    max_results: options.maxResults ?? 10,
    betas: ["search-extract-2025-10-10"],
  }

  // Add optional keyword queries
  if (options.searchQueries && options.searchQueries.length > 0) {
    searchParams.search_queries = options.searchQueries
  }

  // Add excerpt settings
  if (options.maxCharsPerResult) {
    searchParams.excerpts = {
      max_chars_per_result: options.maxCharsPerResult,
    }
  }

  // Add source policy if domains specified
  if (options.allowedDomains || options.blockedDomains) {
    searchParams.source_policy = {}
    if (options.allowedDomains && options.allowedDomains.length > 0) {
      searchParams.source_policy.include_domains = options.allowedDomains
    }
    if (options.blockedDomains && options.blockedDomains.length > 0) {
      searchParams.source_policy.exclude_domains = options.blockedDomains
    }
  }

  try {
    const result = await withRetry(
      async () => {
        const response = await client.beta.search(searchParams)
        return response
      },
      {
        maxRetries: config?.maxRetries ?? 2,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
      }
    )

    // Record success AFTER the entire retry sequence completes
    circuitBreaker.recordSuccess()
    return result
  } catch (error) {
    const parallelError = classifyError(error)
    // Only record failure if it's not already a circuit breaker error
    // (to avoid double-counting when circuit is already open)
    if (parallelError.code !== "CIRCUIT_OPEN") {
      circuitBreaker.recordFailure()
    }
    throw parallelError
  }
}

/**
 * Extract content from URLs using Parallel AI
 *
 * @param options - Extraction configuration
 * @param config - Optional client configuration
 * @returns Extracted content from each URL
 * @throws ParallelError with specific error codes
 */
export async function parallelExtract(
  options: ParallelExtractOptions,
  config?: ParallelClientConfig
): Promise<ExtractResponse> {
  // Pre-flight checks
  if (!isParallelConfigured()) {
    throw createParallelError(
      "Parallel API key not configured",
      "NOT_CONFIGURED"
    )
  }

  if (!isParallelAvailable()) {
    throw createParallelError(
      "Parallel is not enabled",
      "NOT_AVAILABLE"
    )
  }

  if (options.urls.length === 0) {
    throw createParallelError(
      "At least one URL is required",
      "INVALID_REQUEST"
    )
  }

  const circuitBreaker = getExtractCircuitBreaker()

  // Check circuit breaker state
  if (circuitBreaker.isOpen()) {
    throw createParallelError(
      "Parallel extract circuit breaker is open - service temporarily unavailable",
      "CIRCUIT_OPEN",
      { retryable: true }
    )
  }

  // Get client - wrap in try/catch to properly classify errors
  let client: Parallel
  try {
    client = getClient(config)
  } catch (error) {
    throw classifyError(error)
  }

  // Build extract params
  const extractParams: BetaExtractParams = {
    urls: options.urls,
    betas: ["search-extract-2025-10-10"],
    excerpts: true,
  }

  // Add objective for focused extraction
  if (options.objective) {
    extractParams.objective = options.objective
  }

  // Add full content setting
  if (options.fullContent) {
    extractParams.full_content = options.maxCharsPerResult
      ? { max_chars_per_result: options.maxCharsPerResult }
      : true
  }

  try {
    const result = await withRetry(
      async () => {
        const response = await client.beta.extract(extractParams)
        return response
      },
      {
        maxRetries: config?.maxRetries ?? 2,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
      }
    )

    // Record success AFTER the entire retry sequence completes
    circuitBreaker.recordSuccess()
    return result
  } catch (error) {
    const parallelError = classifyError(error)
    // Only record failure if it's not already a circuit breaker error
    // (to avoid double-counting when circuit is already open)
    if (parallelError.code !== "CIRCUIT_OPEN") {
      circuitBreaker.recordFailure()
    }
    throw parallelError
  }
}

/**
 * Check if Parallel client can be used
 *
 * @returns Object with availability status and reasons
 */
export function getParallelStatus(): {
  available: boolean
  configured: boolean
  enabled: boolean
  searchCircuitOpen: boolean
  extractCircuitOpen: boolean
  reasons: string[]
} {
  const configured = isParallelConfigured()
  const flags = getParallelFlags()
  const enabled = flags.PARALLEL_ENABLED

  const searchCircuitOpen = getSearchCircuitBreaker().isOpen()
  const extractCircuitOpen = getExtractCircuitBreaker().isOpen()

  const reasons: string[] = []

  if (!configured) {
    reasons.push("PARALLEL_API_KEY not set")
  }

  if (!enabled) {
    reasons.push("PARALLEL_ENABLED is false")
  }

  if (searchCircuitOpen) {
    reasons.push("Search circuit breaker is open")
  }

  if (extractCircuitOpen) {
    reasons.push("Extract circuit breaker is open")
  }

  return {
    available: configured && enabled && !searchCircuitOpen,
    configured,
    enabled,
    searchCircuitOpen,
    extractCircuitOpen,
    reasons,
  }
}

/**
 * Reset circuit breakers (for testing/admin purposes)
 */
export function resetCircuitBreakers(): void {
  getSearchCircuitBreaker().reset()
  getExtractCircuitBreaker().reset()
}

/**
 * Get raw Parallel client for advanced usage
 * Use with caution - prefer the wrapped methods
 *
 * @param config - Optional client configuration
 * @returns Raw Parallel client instance
 */
export function getParallelClient(config?: ParallelClientConfig): Parallel {
  if (!isParallelConfigured()) {
    throw createParallelError(
      "Parallel API key not configured",
      "NOT_CONFIGURED"
    )
  }

  return getClient(config)
}
