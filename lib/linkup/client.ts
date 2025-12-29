/**
 * LinkUp Search Client
 *
 * Enterprise-grade client with circuit breaker protection, retry logic,
 * and comprehensive error handling for LinkUp's search API.
 *
 * KEY INNOVATION: Multi-query execution for Standard mode
 * - Instead of one broad query, we execute multiple targeted queries in parallel
 * - This makes Standard mode nearly as comprehensive as Deep mode
 * - Cost savings: $0.005/query × 5 queries = $0.025 vs $0.02 for Deep
 * - But with BETTER results due to targeted query construction
 *
 * @see https://docs.linkup.so
 */

import { LinkupClient } from "linkup-sdk"
import {
  circuitBreakerRegistry,
  CIRCUIT_BREAKER_CONFIGS,
  type CircuitBreaker,
} from "@/lib/batch-processing/resilience/circuit-breaker"
import {
  getLinkUpFlags,
  isLinkUpConfigured,
  BLOCKED_DOMAINS,
  LINKUP_PRICING,
  type LinkUpConfig,
} from "./config"

// ============================================================================
// TYPES
// ============================================================================

export interface LinkUpSearchOptions {
  /** Natural language search query */
  query: string
  /** Search depth: 'standard' (fast) or 'deep' (comprehensive) */
  depth?: "standard" | "deep"
  /** Output type */
  outputType?: "sourcedAnswer" | "searchResults" | "structured"
  /** JSON schema for structured output */
  structuredOutputSchema?: Record<string, unknown>
  /** Include sources with structured output */
  includeSources?: boolean
  /** Include images in results */
  includeImages?: boolean
  /** Max results to return */
  maxResults?: number
  /** Include inline citations in answer */
  includeInlineCitations?: boolean
  /** Filter to specific domains */
  includeDomains?: string[]
  /** Exclude specific domains */
  excludeDomains?: string[]
  /** Date range filter */
  fromDate?: string
  toDate?: string
}

export interface LinkUpSearchResult {
  /** Answer text (for sourcedAnswer type) */
  answer?: string
  /** Raw search results (for searchResults type) */
  results?: Array<{
    type: "text" | "image"
    name: string
    url: string
    content?: string
  }>
  /** Structured output (for structured type) */
  structured?: Record<string, unknown>
  /** Sources with citations */
  sources?: Array<{
    name: string
    url: string
    snippet?: string
  }>
}

export interface LinkUpError extends Error {
  code: LinkUpErrorCode
  statusCode?: number
  retryable: boolean
  details?: Record<string, unknown>
}

export type LinkUpErrorCode =
  | "NOT_CONFIGURED"
  | "NOT_AVAILABLE"
  | "CIRCUIT_OPEN"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "AUTHENTICATION_ERROR"
  | "INVALID_REQUEST"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "INSUFFICIENT_CREDITS"
  | "UNKNOWN_ERROR"

// ============================================================================
// ERROR FACTORY
// ============================================================================

function createLinkUpError(
  message: string,
  code: LinkUpErrorCode,
  options?: {
    statusCode?: number
    retryable?: boolean
    details?: Record<string, unknown>
    cause?: Error
  }
): LinkUpError {
  const error = new Error(message) as LinkUpError
  error.name = "LinkUpError"
  error.code = code
  error.statusCode = options?.statusCode
  error.retryable = options?.retryable ?? false
  error.details = options?.details
  if (options?.cause) {
    error.cause = options.cause
  }
  return error
}

function classifyError(error: unknown): LinkUpError {
  // Already a LinkUpError
  if (error instanceof Error && "code" in error && "retryable" in error) {
    return error as LinkUpError
  }

  // Handle LinkUp SDK errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Rate limiting
    if (message.includes("rate limit") || message.includes("429")) {
      return createLinkUpError("Rate limit exceeded", "RATE_LIMITED", {
        statusCode: 429,
        retryable: true,
        cause: error,
      })
    }

    // Authentication
    if (
      message.includes("authentication") ||
      message.includes("unauthorized") ||
      message.includes("401") ||
      message.includes("invalid api key")
    ) {
      return createLinkUpError("Authentication failed", "AUTHENTICATION_ERROR", {
        statusCode: 401,
        retryable: false,
        cause: error,
      })
    }

    // Insufficient credits
    if (message.includes("credit") || message.includes("insufficient")) {
      return createLinkUpError("Insufficient credits", "INSUFFICIENT_CREDITS", {
        statusCode: 402,
        retryable: false,
        cause: error,
      })
    }

    // Timeout
    if (message.includes("timeout") || message.includes("timed out")) {
      return createLinkUpError("Request timed out", "TIMEOUT", {
        retryable: true,
        cause: error,
      })
    }

    // Server errors
    if (message.includes("500") || message.includes("502") || message.includes("503")) {
      return createLinkUpError("LinkUp server error", "SERVER_ERROR", {
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
      return createLinkUpError("Network error", "NETWORK_ERROR", {
        retryable: true,
        cause: error,
      })
    }

    // Bad request
    if (message.includes("400") || message.includes("invalid")) {
      return createLinkUpError("Invalid request", "INVALID_REQUEST", {
        statusCode: 400,
        retryable: false,
        cause: error,
      })
    }

    // Unknown error
    return createLinkUpError(error.message, "UNKNOWN_ERROR", {
      retryable: false,
      cause: error,
    })
  }

  // Non-Error thrown
  return createLinkUpError(String(error), "UNKNOWN_ERROR", {
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
  let lastError: LinkUpError | null = null

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
        `[LinkUp] Retry ${attempt + 1}/${options.maxRetries} after ${delayMs}ms: ${lastError.message}`
      )
      await sleep(delayMs)
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError ?? createLinkUpError("Unknown error", "UNKNOWN_ERROR")
}

// ============================================================================
// CLIENT SINGLETON
// ============================================================================

let clientInstance: LinkupClient | null = null
let clientConfig: LinkUpConfig | null = null

function getClient(config?: Partial<LinkUpConfig>): LinkupClient {
  const apiKey = config?.apiKey ?? process.env.LINKUP_API_KEY

  if (!apiKey) {
    throw createLinkUpError(
      "LINKUP_API_KEY is not configured",
      "NOT_CONFIGURED"
    )
  }

  // Check if we need to create a new instance
  const configChanged =
    clientConfig !== null &&
    (apiKey !== clientConfig.apiKey)

  if (clientInstance === null || configChanged) {
    clientInstance = new LinkupClient({
      apiKey,
    })

    clientConfig = {
      apiKey,
      timeout: config?.timeout ?? 60000,
      maxRetries: config?.maxRetries ?? 2,
    }
  }

  return clientInstance
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

function getSearchCircuitBreaker(): CircuitBreaker {
  return circuitBreakerRegistry.getOrCreate(
    "linkup-search",
    CIRCUIT_BREAKER_CONFIGS.searchAPI
  )
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Execute a single LinkUp search
 *
 * @param options - Search configuration
 * @returns Search results with sources
 * @throws LinkUpError with specific error codes
 */
export async function linkupSearch(
  options: LinkUpSearchOptions
): Promise<LinkUpSearchResult> {
  // Pre-flight checks
  if (!isLinkUpConfigured()) {
    throw createLinkUpError(
      "LinkUp API key not configured",
      "NOT_CONFIGURED"
    )
  }

  const flags = getLinkUpFlags()
  if (!flags.LINKUP_ENABLED) {
    throw createLinkUpError(
      "LinkUp is not enabled",
      "NOT_AVAILABLE"
    )
  }

  const circuitBreaker = getSearchCircuitBreaker()

  // Check circuit breaker state
  if (circuitBreaker.isOpen()) {
    throw createLinkUpError(
      "LinkUp search circuit breaker is open - service temporarily unavailable",
      "CIRCUIT_OPEN",
      { retryable: true }
    )
  }

  // Get client
  let client: LinkupClient
  try {
    client = getClient()
  } catch (error) {
    throw classifyError(error)
  }

  // Always exclude blocked domains
  const excludeDomains = [
    ...BLOCKED_DOMAINS,
    ...(options.excludeDomains || []),
  ]

  try {
    const result = await withRetry(async () => {
      // Build base search params
      const baseParams = {
        query: options.query,
        depth: options.depth ?? "standard",
        includeImages: options.includeImages ?? false,
        maxResults: options.maxResults,
        includeDomains: options.includeDomains,
        excludeDomains,
        fromDate: options.fromDate ? new Date(options.fromDate) : undefined,
        toDate: options.toDate ? new Date(options.toDate) : undefined,
      }

      // Use any to work around complex SDK type union
      // The SDK has union types that are complex to satisfy statically
      const searchParams: any = {
        ...baseParams,
        outputType: options.outputType ?? "sourcedAnswer",
        includeSources: options.includeSources ?? true,
        includeInlineCitations: options.includeInlineCitations ?? true,
      }

      // Add structured output schema if provided
      if (options.structuredOutputSchema) {
        searchParams.structuredOutputSchema = options.structuredOutputSchema
      }

      const response = await client.search(searchParams)

      return response
    })

    // Record success
    circuitBreaker.recordSuccess()

    // Normalize response
    const normalized: LinkUpSearchResult = {}

    // Handle different response types
    if (options.outputType === "searchResults") {
      normalized.results = (result as any).results?.map((r: any) => ({
        type: r.type || "text",
        name: r.name || r.title || "",
        url: r.url || "",
        content: r.content || "",
      }))
    } else if (options.outputType === "structured") {
      normalized.structured = (result as any).content || (result as any).output
      normalized.sources = (result as any).sources?.map((s: any) => ({
        name: s.name || s.title || "",
        url: s.url || "",
        snippet: s.snippet || s.content || "",
      }))
    } else {
      // sourcedAnswer
      normalized.answer = (result as any).answer || (result as any).content || ""
      normalized.sources = (result as any).sources?.map((s: any) => ({
        name: s.name || s.title || "",
        url: s.url || "",
        snippet: s.snippet || s.content || "",
      }))
    }

    return normalized
  } catch (error) {
    const linkupError = classifyError(error)
    // Only record failure if it's not already a circuit breaker error
    if (linkupError.code !== "CIRCUIT_OPEN") {
      circuitBreaker.recordFailure()
    }
    throw linkupError
  }
}

/**
 * Execute multiple searches in parallel (for enhanced standard mode)
 *
 * This is the KEY INNOVATION that makes standard mode nearly as good as deep:
 * - Execute multiple targeted queries instead of one broad query
 * - Each query focuses on a specific aspect (property, business, philanthropy, etc.)
 * - Aggregate results for comprehensive coverage
 *
 * @param queries - Array of search options
 * @returns Aggregated results from all searches
 */
export async function linkupParallelSearch(
  queries: LinkUpSearchOptions[]
): Promise<{
  results: LinkUpSearchResult[]
  aggregatedSources: Array<{ name: string; url: string; snippet?: string }>
  successCount: number
  errorCount: number
}> {
  const results = await Promise.allSettled(
    queries.map((q) => linkupSearch(q))
  )

  const successfulResults: LinkUpSearchResult[] = []
  const allSources: Array<{ name: string; url: string; snippet?: string }> = []
  const seenUrls = new Set<string>()
  let errorCount = 0

  for (const result of results) {
    if (result.status === "fulfilled") {
      successfulResults.push(result.value)

      // Aggregate unique sources
      for (const source of result.value.sources || []) {
        const normalizedUrl = source.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")
        if (!seenUrls.has(normalizedUrl)) {
          seenUrls.add(normalizedUrl)
          allSources.push(source)
        }
      }
    } else {
      errorCount++
      console.warn("[LinkUp] Parallel query failed:", result.reason?.message)
    }
  }

  return {
    results: successfulResults,
    aggregatedSources: allSources,
    successCount: successfulResults.length,
    errorCount,
  }
}

/**
 * Get LinkUp client status
 */
export function getLinkUpStatus(): {
  available: boolean
  configured: boolean
  enabled: boolean
  circuitOpen: boolean
  reasons: string[]
} {
  const configured = isLinkUpConfigured()
  const flags = getLinkUpFlags()
  const enabled = flags.LINKUP_ENABLED
  const circuitOpen = getSearchCircuitBreaker().isOpen()

  const reasons: string[] = []

  if (!configured) {
    reasons.push("LINKUP_API_KEY not set")
  }

  if (!enabled) {
    reasons.push("LINKUP_ENABLED is false or not set")
  }

  if (circuitOpen) {
    reasons.push("Search circuit breaker is open")
  }

  return {
    available: configured && enabled && !circuitOpen,
    configured,
    enabled,
    circuitOpen,
    reasons,
  }
}

/**
 * Reset circuit breaker (for testing/admin purposes)
 */
export function resetLinkUpCircuitBreaker(): void {
  getSearchCircuitBreaker().reset()
}

/**
 * Estimate cost for a search operation
 */
export function estimateSearchCost(depth: "standard" | "deep"): number {
  return LINKUP_PRICING[depth]
}

// Re-export error helper functions (LinkUpErrorCode already exported above)
export { createLinkUpError, classifyError }
