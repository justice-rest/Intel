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
  isLinkUpAvailable,
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
  // Pre-flight check - LinkUp is enabled by default if API key is set
  if (!isLinkUpAvailable()) {
    throw createLinkUpError(
      "LINKUP_API_KEY not configured - set it in environment variables",
      "NOT_CONFIGURED"
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

// ============================================================================
// RESEARCH ENDPOINT (Ultra Research Mode)
// ============================================================================

export interface LinkUpResearchOptions {
  /** Research query/objective */
  query: string
  /** Output format - only 'sourcedAnswer' and 'structured' are available for /research */
  outputType?: "sourcedAnswer" | "structured"
  /** Structured output schema (if outputType is structured) */
  structuredOutputSchema?: Record<string, unknown>
}

export interface LinkUpResearchResult {
  /** The comprehensive research answer */
  answer: string
  /** Sources with citations */
  sources: Array<{
    name: string
    url: string
    snippet?: string
  }>
  /** Intermediate search queries executed */
  searchQueries?: string[]
}

// Research polling configuration
const RESEARCH_POLL_INTERVAL_MS = 2000 // 2 seconds between polls
const RESEARCH_MAX_WAIT_MS = 5 * 60 * 1000 // 5 minutes max wait time

/**
 * Start a research task on LinkUp's /research endpoint
 * Returns the task ID for polling
 */
async function startResearchTask(
  apiKey: string,
  query: string,
  outputType: "sourcedAnswer" | "structured"
): Promise<string> {
  const response = await fetch("https://api.linkup.so/v1/research", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      outputType,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error")
    throw createLinkUpError(
      `Failed to start research task: ${response.status} ${errorText}`,
      response.status === 401 ? "AUTHENTICATION_ERROR" :
      response.status === 429 ? "RATE_LIMITED" : "SERVER_ERROR",
      {
        statusCode: response.status,
        retryable: response.status >= 500 || response.status === 429,
      }
    )
  }

  const data = await response.json()
  if (!data.id) {
    throw createLinkUpError(
      "Research task started but no task ID returned",
      "SERVER_ERROR"
    )
  }

  return data.id
}

/**
 * Poll for research task results
 * Returns the result when complete, or throws on error/timeout
 */
async function pollResearchResults(
  apiKey: string,
  taskId: string
): Promise<any> {
  const startTime = Date.now()

  while (Date.now() - startTime < RESEARCH_MAX_WAIT_MS) {
    const response = await fetch(
      `https://api.linkup.so/v1/research/${taskId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error")
      throw createLinkUpError(
        `Failed to poll research results: ${response.status} ${errorText}`,
        response.status === 401 ? "AUTHENTICATION_ERROR" : "SERVER_ERROR",
        {
          statusCode: response.status,
          retryable: false,
        }
      )
    }

    const data = await response.json()
    const status = data.status

    // Check if still processing
    if (status === "pending" || status === "processing") {
      // Wait before polling again
      await sleep(RESEARCH_POLL_INTERVAL_MS)
      continue
    }

    // Task is complete - return the result
    return data
  }

  // Timeout reached
  throw createLinkUpError(
    `Research task timed out after ${RESEARCH_MAX_WAIT_MS / 1000} seconds`,
    "TIMEOUT",
    { retryable: false }
  )
}

/**
 * Execute comprehensive research using LinkUp's /research endpoint
 *
 * [BETA] This is an asynchronous multi-step research process that:
 * 1. Analyzes the query to understand research objectives
 * 2. Generates multiple targeted search queries
 * 3. Aggregates and synthesizes results
 * 4. Returns a comprehensive answer with citations
 *
 * The /research endpoint is designed for deep, multi-step reasoning and search.
 * Unlike standard search, it can take from a few seconds to a few minutes.
 *
 * API Flow:
 * 1. POST /v1/research - starts task, returns { id: task_id }
 * 2. GET /v1/research/{task_id} - poll until status != "pending"/"processing"
 *
 * @param options - Research configuration (NO depth parameter - removed in /research)
 * @returns Comprehensive research result with sources
 */
export async function linkupResearch(
  options: LinkUpResearchOptions
): Promise<LinkUpResearchResult> {
  // Pre-flight check
  if (!isLinkUpAvailable()) {
    throw createLinkUpError(
      "LINKUP_API_KEY not configured - set it in environment variables",
      "NOT_CONFIGURED"
    )
  }

  const apiKey = process.env.LINKUP_API_KEY
  if (!apiKey) {
    throw createLinkUpError(
      "LINKUP_API_KEY not configured",
      "NOT_CONFIGURED"
    )
  }

  const circuitBreaker = getSearchCircuitBreaker()

  // Check circuit breaker state
  if (circuitBreaker.isOpen()) {
    throw createLinkUpError(
      "LinkUp research circuit breaker is open - service temporarily unavailable",
      "CIRCUIT_OPEN",
      { retryable: true }
    )
  }

  const outputType = options.outputType || "sourcedAnswer"

  try {
    // Step 1: Start the research task
    console.log("[LinkUp Research] Starting research task...")
    const taskId = await startResearchTask(apiKey, options.query, outputType)
    console.log(`[LinkUp Research] Task started: ${taskId}`)

    // Step 2: Poll for results
    console.log("[LinkUp Research] Polling for results...")
    const result = await pollResearchResults(apiKey, taskId)
    console.log("[LinkUp Research] Research complete")

    // Record success
    circuitBreaker.recordSuccess()

    // Normalize response - handle nested output structure from /research endpoint
    // Response format: { output: { answer: string, sources: [...] }, ... }
    let answer: string = ""
    let rawSources: any[] = []

    if (result.output && typeof result.output === "object") {
      // Nested structure: { output: { answer, sources } }
      answer = result.output.answer || result.output.content || ""
      rawSources = result.output.sources || []
    } else {
      // Flat structure fallback
      answer = result.answer || result.content || result.output || ""
      rawSources = result.sources || []
    }

    const sources = rawSources.map((s: any) => ({
      name: s.name || s.title || "",
      url: s.url || "",
      snippet: s.snippet || s.content || "",
    }))

    return {
      answer,
      sources,
      searchQueries: result.searchQueries,
    }
  } catch (error) {
    const linkupError = classifyError(error)
    if (linkupError.code !== "CIRCUIT_OPEN") {
      circuitBreaker.recordFailure()
    }
    console.error("[LinkUp Research] Error:", linkupError.message)
    throw linkupError
  }
}

/**
 * Get LinkUp client status
 *
 * LinkUp is available if API key is set. No feature flag needed.
 */
export function getLinkUpStatus(): {
  available: boolean
  configured: boolean
  circuitOpen: boolean
  reasons: string[]
} {
  const configured = isLinkUpAvailable()
  const circuitOpen = getSearchCircuitBreaker().isOpen()

  const reasons: string[] = []

  if (!configured) {
    reasons.push("LINKUP_API_KEY not set")
  }

  if (circuitOpen) {
    reasons.push("Search circuit breaker is open")
  }

  return {
    available: configured && !circuitOpen,
    configured,
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
