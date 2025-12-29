/**
 * Exa Websets API Wrapper
 *
 * Enterprise-grade wrapper for Exa's Websets API - autonomous prospect discovery.
 * Finds entities matching specific criteria without needing individual names.
 *
 * Use Cases:
 * - "Find tech billionaires in Silicon Valley who are philanthropists"
 * - "Find healthcare executives in Boston who sit on nonprofit boards"
 * - "Find real estate investors in Miami with $10M+ portfolios"
 *
 * @see https://docs.exa.ai/websets/api/overview
 */

import {
  circuitBreakerRegistry,
  CIRCUIT_BREAKER_CONFIGS,
  type CircuitBreaker,
} from "@/lib/batch-processing/resilience/circuit-breaker"

// ============================================================================
// TYPES
// ============================================================================

export interface ExaWebsetsConfig {
  /** API key (defaults to EXA_API_KEY env var) */
  apiKey?: string
  /** Request timeout in ms (default: 60000) */
  timeout?: number
}

export interface ProspectDiscoveryOptions {
  /** Natural language objective describing who to find */
  objective: string
  /** Type of entity to find: "person", "company", "research_paper", "article" */
  entityType?: "person" | "company" | "research_paper" | "article"
  /** Match conditions that candidates must satisfy */
  matchConditions: Array<{
    name: string
    description: string
  }>
  /** Maximum number of matches to find (default: 10, min: 5, max: 100) */
  matchLimit?: number
  /** Entities to exclude from results */
  excludeList?: Array<{ name: string; url: string }>
  /** Metadata for tracking */
  metadata?: Record<string, string | number | boolean>
}

export interface DiscoveredProspect {
  /** Unique candidate ID */
  candidateId: string
  /** Prospect name */
  name: string
  /** Description/summary */
  description?: string
  /** Primary URL for context */
  url: string
  /** Match status */
  matchStatus: "generated" | "matched" | "unmatched" | "discarded"
  /** Match condition results */
  matchResults?: Record<string, unknown>
  /** Sources/citations */
  sources: Array<{
    url: string
    title?: string
    excerpts?: string[]
    fieldName?: string
    reasoning?: string
  }>
}

export interface DiscoveryResult {
  /** Webset ID */
  findallId: string
  /** Run status */
  status: "queued" | "pending" | "running" | "completed" | "failed" | "paused" | "idle"
  /** Whether run is still active */
  isActive: boolean
  /** Metrics */
  metrics: {
    generatedCandidatesCount: number
    matchedCandidatesCount: number
  }
  /** Discovered prospects (matched candidates) */
  prospects: DiscoveredProspect[]
  /** All candidates including unmatched */
  allCandidates: DiscoveredProspect[]
  /** Duration in ms */
  durationMs: number
  /** Error if failed */
  error?: string
}

export interface DiscoveryProgressEvent {
  type: "status" | "candidate_generated" | "candidate_matched" | "candidate_unmatched" | "candidate_discarded" | "error"
  /** Webset ID */
  findallId: string
  /** Event timestamp */
  timestamp: Date
  /** Run status (if status event) */
  status?: string
  /** Candidate data (if candidate event) */
  candidate?: DiscoveredProspect
  /** Error message (if error event) */
  error?: string
}

export type DiscoveryProgressCallback = (event: DiscoveryProgressEvent) => void

export interface ExaWebsetsError extends Error {
  code: ExaErrorCode
  websetId?: string
  retryable: boolean
}

export type ExaErrorCode =
  | "NOT_CONFIGURED"
  | "NOT_AVAILABLE"
  | "CIRCUIT_OPEN"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "RUN_FAILED"
  | "CANCELLED"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR"

// Exa API Response Types
interface ExaWebset {
  id: string
  object: "webset"
  status: "idle" | "pending" | "running" | "paused" | "completed" | "failed"
  externalId?: string
  title?: string
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown>
}

interface ExaWebsetItem {
  id: string
  object: "webset_item"
  properties: {
    name?: string
    description?: string
    url?: string
    [key: string]: unknown
  }
  sourceContent?: string
  verificationStatus?: "verified" | "unverified" | "rejected"
  reasoning?: string
  references?: Array<{ url: string; title?: string; excerpt?: string }>
  enrichments?: Record<string, unknown>
  createdAt: string
}

interface ExaItemsResponse {
  data: ExaWebsetItem[]
  hasMore: boolean
  nextCursor?: string
}

// ============================================================================
// ERROR FACTORY
// ============================================================================

function createExaError(
  message: string,
  code: ExaErrorCode,
  options?: {
    websetId?: string
    retryable?: boolean
    cause?: Error
  }
): ExaWebsetsError {
  const error = new Error(message) as ExaWebsetsError
  error.name = "ExaWebsetsError"
  error.code = code
  error.websetId = options?.websetId
  error.retryable = options?.retryable ?? false
  if (options?.cause) {
    error.cause = options.cause
  }
  return error
}

function classifyExaError(error: unknown): ExaWebsetsError {
  if (error instanceof Error && "code" in error && "retryable" in error) {
    return error as ExaWebsetsError
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (message.includes("rate limit") || message.includes("429")) {
      return createExaError("Rate limit exceeded", "RATE_LIMITED", {
        retryable: true,
        cause: error,
      })
    }

    if (message.includes("timeout") || message.includes("timed out")) {
      return createExaError("Request timed out", "TIMEOUT", {
        retryable: true,
        cause: error,
      })
    }

    if (message.includes("network") || message.includes("fetch")) {
      return createExaError("Network error", "NETWORK_ERROR", {
        retryable: true,
        cause: error,
      })
    }

    return createExaError(error.message, "UNKNOWN_ERROR", {
      retryable: false,
      cause: error,
    })
  }

  return createExaError(String(error), "UNKNOWN_ERROR", {
    retryable: false,
  })
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const EXA_API_BASE = "https://api.exa.ai"
const DEFAULT_TIMEOUT = 60000

// ============================================================================
// AVAILABILITY CHECKS
// ============================================================================

export function isExaConfigured(): boolean {
  return !!process.env.EXA_API_KEY
}

export function isExaAvailable(): boolean {
  return isExaConfigured()
}

export function getExaStatus(): { available: boolean; reasons: string[] } {
  const reasons: string[] = []

  if (!process.env.EXA_API_KEY) {
    reasons.push("EXA_API_KEY is not configured")
  }

  return {
    available: reasons.length === 0,
    reasons,
  }
}

// Alias for compatibility
export function getFindAllStatus(): { available: boolean; reasons: string[] } {
  return getExaStatus()
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

function getExaCircuitBreaker(): CircuitBreaker {
  return circuitBreakerRegistry.getOrCreate(
    "exa-websets",
    CIRCUIT_BREAKER_CONFIGS.primaryLLM
  )
}

// ============================================================================
// API HELPERS
// ============================================================================

async function exaFetch<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "DELETE"
    body?: unknown
    config?: ExaWebsetsConfig
  } = {}
): Promise<T> {
  const apiKey = options.config?.apiKey ?? process.env.EXA_API_KEY
  const timeout = options.config?.timeout ?? DEFAULT_TIMEOUT

  if (!apiKey) {
    throw createExaError("EXA_API_KEY is not configured", "NOT_CONFIGURED")
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(`${EXA_API_BASE}${endpoint}`, {
      method: options.method ?? "GET",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error")
      throw new Error(`Exa API error ${response.status}: ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      throw createExaError("Request timed out", "TIMEOUT", { retryable: true })
    }
    throw error
  }
}

// ============================================================================
// HELPER: Convert Exa Item to Prospect
// ============================================================================

function itemToProspect(item: ExaWebsetItem): DiscoveredProspect {
  const name = item.properties.name ||
    item.properties.title ||
    (typeof item.properties.label === "string" ? item.properties.label : undefined) ||
    "Unknown"

  return {
    candidateId: item.id,
    name: String(name),
    description: item.properties.description ? String(item.properties.description) : undefined,
    url: item.properties.url ? String(item.properties.url) : "",
    matchStatus: item.verificationStatus === "verified" ? "matched" :
                 item.verificationStatus === "rejected" ? "discarded" : "generated",
    matchResults: item.enrichments,
    sources: (item.references || []).map(ref => ({
      url: ref.url,
      title: ref.title,
      excerpts: ref.excerpt ? [ref.excerpt] : undefined,
      reasoning: item.reasoning,
    })),
  }
}

// ============================================================================
// PUBLIC API: Validate Discovery Schema
// ============================================================================

/**
 * Validate a discovery objective (stub for compatibility)
 * Exa doesn't have a separate validation endpoint - we just return a parsed structure
 */
export async function validateDiscoverySchema(
  objective: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _config?: ExaWebsetsConfig
): Promise<{
  entity_type: string
  match_conditions: Array<{ name: string; description: string }>
  objective: string
}> {
  if (!isExaConfigured()) {
    throw createExaError("Exa API key not configured", "NOT_CONFIGURED")
  }

  // Parse the objective to infer entity type and conditions
  const lowerObjective = objective.toLowerCase()
  let entityType = "person"

  if (lowerObjective.includes("company") || lowerObjective.includes("companies") || lowerObjective.includes("business")) {
    entityType = "company"
  } else if (lowerObjective.includes("paper") || lowerObjective.includes("research") || lowerObjective.includes("study")) {
    entityType = "research_paper"
  } else if (lowerObjective.includes("article")) {
    entityType = "article"
  }

  return {
    entity_type: entityType,
    match_conditions: [{ name: "primary", description: objective }],
    objective,
  }
}

// ============================================================================
// PUBLIC API: Create Webset (Start Discovery)
// ============================================================================

/**
 * Start a prospect discovery run using Exa Websets
 */
export async function startProspectDiscovery(
  options: ProspectDiscoveryOptions,
  config?: ExaWebsetsConfig
): Promise<{ findallId: string; run: ExaWebset }> {
  if (!isExaConfigured()) {
    throw createExaError("Exa API key not configured", "NOT_CONFIGURED")
  }

  if (!isExaAvailable()) {
    throw createExaError("Exa is not enabled", "NOT_AVAILABLE")
  }

  const circuitBreaker = getExaCircuitBreaker()
  if (circuitBreaker.isOpen()) {
    throw createExaError(
      "Exa circuit breaker is open",
      "CIRCUIT_OPEN",
      { retryable: true }
    )
  }

  try {
    // Map entity type to Exa format
    const entityTypeMap: Record<string, string> = {
      people: "person",
      person: "person",
      companies: "company",
      company: "company",
      research_paper: "research_paper",
      article: "article",
    }
    const entityType = entityTypeMap[options.entityType ?? "person"] ?? "person"

    // Build criteria from match conditions
    const criteria = options.matchConditions.map(cond => ({
      description: `${cond.name}: ${cond.description}`,
    }))

    // Build the webset request
    const requestBody = {
      search: {
        query: options.objective,
        count: Math.min(Math.max(options.matchLimit ?? 10, 5), 100),
        entity: {
          type: entityType,
        },
        criteria,
        recall: true, // Comprehensive search
      },
      metadata: options.metadata,
    }

    console.log(`[Exa Websets] Creating webset:`, JSON.stringify(requestBody, null, 2))

    const webset = await exaFetch<ExaWebset>("/v0/websets", {
      method: "POST",
      body: requestBody,
      config,
    })

    console.log(`[Exa Websets] Created webset: ${webset.id}`)
    circuitBreaker.recordSuccess()

    return {
      findallId: webset.id,
      run: webset,
    }
  } catch (error) {
    const exaError = classifyExaError(error)
    if (exaError.code !== "CIRCUIT_OPEN") {
      getExaCircuitBreaker().recordFailure()
    }
    throw exaError
  }
}

// ============================================================================
// PUBLIC API: Get Webset Status
// ============================================================================

/**
 * Get the current status of a webset
 */
export async function getWebsetStatus(
  websetId: string,
  config?: ExaWebsetsConfig
): Promise<ExaWebset> {
  return exaFetch<ExaWebset>(`/v0/websets/${websetId}`, { config })
}

// ============================================================================
// PUBLIC API: Get Discovery Results
// ============================================================================

/**
 * Get results from a webset
 */
export async function getDiscoveryResults(
  websetId: string,
  config?: ExaWebsetsConfig
): Promise<DiscoveryResult> {
  const startTime = Date.now()

  try {
    // Get webset status
    const webset = await getWebsetStatus(websetId, config)

    // Get all items with pagination
    const allItems: ExaWebsetItem[] = []
    let cursor: string | undefined

    do {
      const params = new URLSearchParams()
      params.set("limit", "100")
      if (cursor) {
        params.set("cursor", cursor)
      }

      const response = await exaFetch<ExaItemsResponse>(
        `/v0/websets/${websetId}/items?${params.toString()}`,
        { config }
      )

      allItems.push(...response.data)
      cursor = response.hasMore ? response.nextCursor : undefined
    } while (cursor)

    const allCandidates = allItems.map(itemToProspect)
    const prospects = allCandidates.filter(c => c.matchStatus === "matched")

    // Map Exa status to our status type
    const statusMap: Record<string, DiscoveryResult["status"]> = {
      idle: "queued",
      pending: "pending",
      running: "running",
      paused: "paused",
      completed: "completed",
      failed: "failed",
    }

    return {
      findallId: webset.id,
      status: statusMap[webset.status] ?? "running",
      isActive: webset.status === "running" || webset.status === "pending",
      metrics: {
        generatedCandidatesCount: allCandidates.length,
        matchedCandidatesCount: prospects.length,
      },
      prospects,
      allCandidates,
      durationMs: Date.now() - startTime,
    }
  } catch (error) {
    const exaError = classifyExaError(error)
    exaError.websetId = websetId
    throw exaError
  }
}

// ============================================================================
// HELPER: Wait for Webset Completion
// ============================================================================

async function waitForWebsetCompletion(
  websetId: string,
  config?: ExaWebsetsConfig,
  maxWaitMs: number = 600000 // 10 minutes max
): Promise<void> {
  const startTime = Date.now()
  const pollIntervalMs = 3000 // Poll every 3 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const webset = await getWebsetStatus(websetId, config)

    if (webset.status === "completed") {
      return
    }

    if (webset.status === "failed") {
      throw createExaError("Webset processing failed", "RUN_FAILED", {
        websetId,
      })
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
  }

  throw createExaError("Webset processing timed out", "TIMEOUT", {
    websetId,
    retryable: true,
  })
}

// ============================================================================
// PUBLIC API: Execute Prospect Discovery (Full Flow)
// ============================================================================

/**
 * Execute full prospect discovery with progress streaming
 */
export async function executeProspectDiscovery(
  options: ProspectDiscoveryOptions,
  onProgress?: DiscoveryProgressCallback,
  config?: ExaWebsetsConfig
): Promise<DiscoveryResult> {
  const startTime = Date.now()

  console.log(`[Exa Websets] Starting discovery: ${options.objective}`)

  // Pre-flight checks
  if (!isExaConfigured()) {
    throw createExaError("Exa API key not configured", "NOT_CONFIGURED")
  }

  if (!isExaAvailable()) {
    throw createExaError("Exa is not enabled", "NOT_AVAILABLE")
  }

  const circuitBreaker = getExaCircuitBreaker()
  if (circuitBreaker.isOpen()) {
    throw createExaError(
      "Exa circuit breaker is open",
      "CIRCUIT_OPEN",
      { retryable: true }
    )
  }

  try {
    // 1. Create the webset
    const { findallId } = await startProspectDiscovery(options, config)

    // 2. Send initial progress event
    if (onProgress) {
      onProgress({
        type: "status",
        findallId,
        status: "running",
        timestamp: new Date(),
      })
    }

    // 3. Wait for completion with periodic status updates
    const pollIntervalMs = 3000
    const maxWaitMs = 600000

    while (Date.now() - startTime < maxWaitMs) {
      const webset = await getWebsetStatus(findallId, config)

      if (onProgress) {
        onProgress({
          type: "status",
          findallId,
          status: webset.status,
          timestamp: new Date(),
        })
      }

      if (webset.status === "completed") {
        break
      }

      if (webset.status === "failed") {
        throw createExaError("Webset processing failed", "RUN_FAILED", {
          websetId: findallId,
        })
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    }

    // 4. Get final results
    const result = await getDiscoveryResults(findallId, config)
    result.durationMs = Date.now() - startTime

    // 5. Send candidate events for each matched prospect
    if (onProgress) {
      for (const prospect of result.prospects) {
        onProgress({
          type: "candidate_matched",
          findallId,
          candidate: prospect,
          timestamp: new Date(),
        })
      }

      onProgress({
        type: "status",
        findallId,
        status: "completed",
        timestamp: new Date(),
      })
    }

    console.log(
      `[Exa Websets] Discovery completed in ${result.durationMs}ms: ` +
        `${result.prospects.length} matched of ${result.allCandidates.length} candidates`
    )

    circuitBreaker.recordSuccess()
    return result
  } catch (error) {
    const exaError = classifyExaError(error)
    if (exaError.code !== "CIRCUIT_OPEN") {
      circuitBreaker.recordFailure()
    }
    throw exaError
  }
}
