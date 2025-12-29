/**
 * Parallel AI FindAll API Wrapper
 *
 * Enterprise-grade wrapper for Parallel's FindAll API - autonomous prospect discovery.
 * Finds entities matching specific criteria without needing individual names.
 *
 * Use Cases:
 * - "Find tech billionaires in Silicon Valley who are philanthropists"
 * - "Find healthcare executives in Boston who sit on nonprofit boards"
 * - "Find real estate investors in Miami with $10M+ portfolios"
 *
 * @see https://parallel.ai/docs/findall
 */

import Parallel from "parallel-web"
import type {
  FindallCreateParams,
  FindallEventsResponse,
  FindallRun,
  FindallRunResult,
} from "parallel-web/resources/beta/findall"
import type { FieldBasis } from "parallel-web/resources/task-run"
import {
  circuitBreakerRegistry,
  CIRCUIT_BREAKER_CONFIGS,
  type CircuitBreaker,
} from "@/lib/batch-processing/resilience/circuit-breaker"
import {
  isParallelAvailable,
  isParallelConfigured,
} from "@/lib/feature-flags/parallel-migration"

// ============================================================================
// TYPES
// ============================================================================

export interface FindAllConfig {
  /** API key (defaults to PARALLEL_API_KEY env var) */
  apiKey?: string
  /** Request timeout in ms (default: 60000) */
  timeout?: number
}

export interface ProspectDiscoveryOptions {
  /** Natural language objective describing who to find */
  objective: string
  /** Type of entity to find (e.g., "person", "philanthropist", "executive") */
  entityType?: string
  /** Match conditions that candidates must satisfy */
  matchConditions: Array<{
    name: string
    description: string
  }>
  /** Maximum number of matches to find (default: 10, min: 5, max: 1000) */
  matchLimit?: number
  /** Generator quality: 'base', 'core', 'pro', or 'preview' */
  generator?: "base" | "core" | "pro" | "preview"
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
  /** FindAll run ID */
  findallId: string
  /** Run status */
  status: "queued" | "action_required" | "running" | "completed" | "failed" | "cancelling" | "cancelled"
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
  /** FindAll run ID */
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

export interface FindAllError extends Error {
  code: FindAllErrorCode
  findallId?: string
  retryable: boolean
}

export type FindAllErrorCode =
  | "NOT_CONFIGURED"
  | "NOT_AVAILABLE"
  | "CIRCUIT_OPEN"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "RUN_FAILED"
  | "CANCELLED"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR"

// ============================================================================
// ERROR FACTORY
// ============================================================================

function createFindAllError(
  message: string,
  code: FindAllErrorCode,
  options?: {
    findallId?: string
    retryable?: boolean
    cause?: Error
  }
): FindAllError {
  const error = new Error(message) as FindAllError
  error.name = "FindAllError"
  error.code = code
  error.findallId = options?.findallId
  error.retryable = options?.retryable ?? false
  if (options?.cause) {
    error.cause = options.cause
  }
  return error
}

function classifyFindAllError(error: unknown): FindAllError {
  if (error instanceof Error && "code" in error && "retryable" in error) {
    return error as FindAllError
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (message.includes("rate limit") || message.includes("429")) {
      return createFindAllError("Rate limit exceeded", "RATE_LIMITED", {
        retryable: true,
        cause: error,
      })
    }

    if (message.includes("timeout") || message.includes("timed out")) {
      return createFindAllError("Request timed out", "TIMEOUT", {
        retryable: true,
        cause: error,
      })
    }

    if (message.includes("network") || message.includes("fetch")) {
      return createFindAllError("Network error", "NETWORK_ERROR", {
        retryable: true,
        cause: error,
      })
    }

    if (message.includes("cancel")) {
      return createFindAllError("Run was cancelled", "CANCELLED", {
        retryable: false,
        cause: error,
      })
    }

    return createFindAllError(error.message, "UNKNOWN_ERROR", {
      retryable: false,
      cause: error,
    })
  }

  return createFindAllError(String(error), "UNKNOWN_ERROR", {
    retryable: false,
  })
}

// ============================================================================
// CLIENT SINGLETON
// ============================================================================

let findAllClient: Parallel | null = null

function getFindAllClient(config?: FindAllConfig): Parallel {
  if (!findAllClient) {
    const apiKey = config?.apiKey ?? process.env.PARALLEL_API_KEY

    if (!apiKey) {
      throw createFindAllError(
        "PARALLEL_API_KEY is not configured",
        "NOT_CONFIGURED"
      )
    }

    findAllClient = new Parallel({
      apiKey,
      timeout: config?.timeout ?? 60000,
      maxRetries: 0,
    })
  }

  return findAllClient
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

function getFindAllCircuitBreaker(): CircuitBreaker {
  return circuitBreakerRegistry.getOrCreate(
    "parallel-findall",
    CIRCUIT_BREAKER_CONFIGS.primaryLLM // More lenient since FindAll runs can be long
  )
}

// ============================================================================
// HELPER: Extract Sources from FieldBasis
// ============================================================================

function extractSourcesFromBasis(
  basis: FieldBasis[] | null | undefined
): DiscoveredProspect["sources"] {
  const sources: DiscoveredProspect["sources"] = []
  const seenUrls = new Set<string>()

  if (!basis) return sources

  for (const field of basis) {
    if (field.citations) {
      for (const citation of field.citations) {
        if (citation.url && !seenUrls.has(citation.url)) {
          seenUrls.add(citation.url)
          sources.push({
            url: citation.url,
            title: citation.title ?? undefined,
            excerpts: citation.excerpts ?? undefined,
            fieldName: field.field,
            reasoning: field.reasoning,
          })
        }
      }
    }
  }

  return sources
}

// ============================================================================
// HELPER: Convert Candidate to DiscoveredProspect
// ============================================================================

function candidateToProspect(
  candidate: FindallRunResult.Candidate
): DiscoveredProspect {
  return {
    candidateId: candidate.candidate_id,
    name: candidate.name,
    description: candidate.description ?? undefined,
    url: candidate.url,
    matchStatus: candidate.match_status,
    matchResults: candidate.output ?? undefined,
    sources: extractSourcesFromBasis(candidate.basis),
  }
}

// ============================================================================
// PUBLIC API: Create Prospect Discovery Run
// ============================================================================

/**
 * Start a prospect discovery run
 *
 * @param options - Discovery configuration
 * @param config - Optional client configuration
 * @returns FindAll run with ID for tracking
 */
export async function startProspectDiscovery(
  options: ProspectDiscoveryOptions,
  config?: FindAllConfig
): Promise<{ findallId: string; run: FindallRun }> {
  if (!isParallelConfigured()) {
    throw createFindAllError(
      "Parallel API key not configured",
      "NOT_CONFIGURED"
    )
  }

  if (!isParallelAvailable()) {
    throw createFindAllError("Parallel is not enabled", "NOT_AVAILABLE")
  }

  const circuitBreaker = getFindAllCircuitBreaker()
  if (circuitBreaker.isOpen()) {
    throw createFindAllError(
      "FindAll circuit breaker is open",
      "CIRCUIT_OPEN",
      { retryable: true }
    )
  }

  try {
    const client = getFindAllClient(config)

    // Enforce match_limit bounds (API requires 5-1000)
    const matchLimit = Math.max(5, Math.min(options.matchLimit ?? 10, 1000))

    const params: FindallCreateParams = {
      objective: options.objective,
      entity_type: options.entityType ?? "person",
      match_conditions: options.matchConditions,
      match_limit: matchLimit,
      generator: options.generator ?? "pro",
      betas: ["findall-2025-09-15"],
    }

    if (options.excludeList?.length) {
      params.exclude_list = options.excludeList
    }

    if (options.metadata) {
      params.metadata = options.metadata
    }

    const run = await client.beta.findall.create(params)

    console.log(`[FindAll] Created run: ${run.findall_id}`)
    circuitBreaker.recordSuccess()

    return {
      findallId: run.findall_id,
      run,
    }
  } catch (error) {
    const findAllError = classifyFindAllError(error)
    if (findAllError.code !== "CIRCUIT_OPEN") {
      getFindAllCircuitBreaker().recordFailure()
    }
    throw findAllError
  }
}

// ============================================================================
// PUBLIC API: Stream Discovery Events
// ============================================================================

/**
 * Stream events from a FindAll run
 *
 * @param findallId - FindAll run ID
 * @param onProgress - Callback for progress events
 * @param config - Optional client configuration
 */
export async function streamDiscoveryEvents(
  findallId: string,
  onProgress: DiscoveryProgressCallback,
  config?: FindAllConfig
): Promise<void> {
  const client = getFindAllClient(config)

  try {
    const eventStream = await client.beta.findall.events(findallId, {
      betas: ["findall-2025-09-15"],
    })

    for await (const event of eventStream) {
      const timestamp = new Date()

      if ("type" in event) {
        if (event.type === "findall.status") {
          const statusEvent = event as { data: FindallRun; type: string }
          onProgress({
            type: "status",
            findallId,
            status: statusEvent.data.status.status,
            timestamp,
          })
        } else if (event.type.startsWith("findall.candidate.")) {
          const candidateEvent = event as {
            data: FindallRunResult.Candidate
            type: string
          }
          const prospect = candidateToProspect(candidateEvent.data)

          let eventType: DiscoveryProgressEvent["type"] = "candidate_generated"
          if (event.type === "findall.candidate.matched") {
            eventType = "candidate_matched"
          } else if (event.type === "findall.candidate.unmatched") {
            eventType = "candidate_unmatched"
          } else if (event.type === "findall.candidate.discarded") {
            eventType = "candidate_discarded"
          }

          onProgress({
            type: eventType,
            findallId,
            candidate: prospect,
            timestamp,
          })
        } else if (event.type === "error") {
          const errorEvent = event as { error: { message: string } }
          onProgress({
            type: "error",
            findallId,
            error: errorEvent.error.message,
            timestamp,
          })
        }
      }
    }
  } catch (error) {
    const findAllError = classifyFindAllError(error)
    findAllError.findallId = findallId
    throw findAllError
  }
}

// ============================================================================
// PUBLIC API: Get Discovery Results
// ============================================================================

/**
 * Get results from a FindAll run
 *
 * @param findallId - FindAll run ID
 * @param config - Optional client configuration
 * @returns Discovery result with prospects
 */
export async function getDiscoveryResults(
  findallId: string,
  config?: FindAllConfig
): Promise<DiscoveryResult> {
  const startTime = Date.now()
  const client = getFindAllClient(config)

  try {
    const result = await client.beta.findall.result(findallId, {
      betas: ["findall-2025-09-15"],
    })

    const allCandidates = result.candidates.map(candidateToProspect)
    const prospects = allCandidates.filter((c) => c.matchStatus === "matched")

    return {
      findallId: result.run.findall_id,
      status: result.run.status.status,
      isActive: result.run.status.is_active,
      metrics: {
        generatedCandidatesCount:
          result.run.status.metrics.generated_candidates_count ?? 0,
        matchedCandidatesCount:
          result.run.status.metrics.matched_candidates_count ?? 0,
      },
      prospects,
      allCandidates,
      durationMs: Date.now() - startTime,
    }
  } catch (error) {
    const findAllError = classifyFindAllError(error)
    findAllError.findallId = findallId
    throw findAllError
  }
}

// ============================================================================
// PUBLIC API: Execute Prospect Discovery (Full Flow)
// ============================================================================

/**
 * Execute full prospect discovery with progress streaming
 *
 * @param options - Discovery configuration
 * @param onProgress - Optional callback for progress events
 * @param config - Optional client configuration
 * @returns Discovery result with matched prospects
 */
export async function executeProspectDiscovery(
  options: ProspectDiscoveryOptions,
  onProgress?: DiscoveryProgressCallback,
  config?: FindAllConfig
): Promise<DiscoveryResult> {
  const startTime = Date.now()

  console.log(`[FindAll] Starting discovery: ${options.objective}`)

  // Pre-flight checks
  if (!isParallelConfigured()) {
    throw createFindAllError(
      "Parallel API key not configured",
      "NOT_CONFIGURED"
    )
  }

  if (!isParallelAvailable()) {
    throw createFindAllError("Parallel is not enabled", "NOT_AVAILABLE")
  }

  const circuitBreaker = getFindAllCircuitBreaker()
  if (circuitBreaker.isOpen()) {
    throw createFindAllError(
      "FindAll circuit breaker is open",
      "CIRCUIT_OPEN",
      { retryable: true }
    )
  }

  try {
    // 1. Start the discovery run
    const { findallId } = await startProspectDiscovery(options, config)

    // 2. If progress callback provided, stream events
    if (onProgress) {
      const eventPromise = streamDiscoveryEvents(findallId, onProgress, config).catch(
        (err) => {
          console.error(`[FindAll] Event stream error:`, err)
        }
      )

      // Wait for completion by polling
      await waitForDiscoveryCompletion(findallId, config)

      // Give event stream a moment to finish
      await Promise.race([
        eventPromise,
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ])
    } else {
      // Just wait for completion
      await waitForDiscoveryCompletion(findallId, config)
    }

    // 3. Get final results
    const result = await getDiscoveryResults(findallId, config)
    result.durationMs = Date.now() - startTime

    console.log(
      `[FindAll] Discovery completed in ${result.durationMs}ms: ` +
        `${result.prospects.length} matched of ${result.allCandidates.length} candidates`
    )

    // Record circuit breaker success
    circuitBreaker.recordSuccess()

    return result
  } catch (error) {
    const findAllError = classifyFindAllError(error)
    if (findAllError.code !== "CIRCUIT_OPEN") {
      circuitBreaker.recordFailure()
    }
    throw findAllError
  }
}

// ============================================================================
// HELPER: Wait for Discovery Completion
// ============================================================================

async function waitForDiscoveryCompletion(
  findallId: string,
  config?: FindAllConfig,
  maxWaitMs: number = 600000 // 10 minutes max
): Promise<void> {
  const client = getFindAllClient(config)
  const startTime = Date.now()
  const pollIntervalMs = 3000

  while (Date.now() - startTime < maxWaitMs) {
    const run = await client.beta.findall.retrieve(findallId, {
      betas: ["findall-2025-09-15"],
    })

    // Handle both response types
    const status =
      "status" in run && typeof run.status === "object" && "is_active" in run.status
        ? run.status
        : null

    if (status && !status.is_active) {
      // Check for failure
      if (status.status === "failed") {
        throw createFindAllError(
          `FindAll run failed: ${status.termination_reason ?? "Unknown reason"}`,
          "RUN_FAILED",
          { findallId }
        )
      }
      if (status.status === "cancelled" || status.status === "cancelling") {
        throw createFindAllError("FindAll run was cancelled", "CANCELLED", {
          findallId,
        })
      }
      if (status.status === "action_required") {
        throw createFindAllError(
          "FindAll run requires action - not supported in automated mode",
          "RUN_FAILED",
          { findallId }
        )
      }
      return
    }

    // Handle poll response format
    if ("is_active" in run && !run.is_active) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  throw createFindAllError(
    `FindAll run did not complete within ${maxWaitMs}ms`,
    "TIMEOUT",
    { findallId, retryable: false }
  )
}

// ============================================================================
// PUBLIC API: Cancel Discovery Run
// ============================================================================

/**
 * Cancel an active FindAll run
 *
 * @param findallId - FindAll run ID
 * @param config - Optional client configuration
 */
export async function cancelDiscovery(
  findallId: string,
  config?: FindAllConfig
): Promise<void> {
  const client = getFindAllClient(config)

  try {
    await client.beta.findall.cancel(findallId, {
      betas: ["findall-2025-09-15"],
    })
    console.log(`[FindAll] Cancelled run: ${findallId}`)
  } catch (error) {
    const findAllError = classifyFindAllError(error)
    findAllError.findallId = findallId
    throw findAllError
  }
}

// ============================================================================
// PUBLIC API: Get FindAll Status
// ============================================================================

/**
 * Get FindAll API status
 */
export function getFindAllStatus(): {
  available: boolean
  configured: boolean
  enabled: boolean
  circuitOpen: boolean
  reasons: string[]
} {
  const configured = isParallelConfigured()
  const enabled = isParallelAvailable()
  const circuitBreaker = getFindAllCircuitBreaker()
  const circuitOpen = circuitBreaker.isOpen()

  const reasons: string[] = []

  if (!configured) {
    reasons.push("PARALLEL_API_KEY not set")
  }

  if (!enabled) {
    reasons.push("PARALLEL_ENABLED is false")
  }

  if (circuitOpen) {
    reasons.push("FindAll circuit breaker is open")
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
 * Reset FindAll circuit breaker
 */
export function resetFindAllCircuitBreaker(): void {
  getFindAllCircuitBreaker().reset()
}

// ============================================================================
// PRESET DISCOVERY TEMPLATES
// ============================================================================

/**
 * Preset templates for common prospect discovery use cases
 */
export const DISCOVERY_TEMPLATES = {
  /**
   * Find tech entrepreneurs who are philanthropists
   */
  techPhilanthropists: (location?: string): ProspectDiscoveryOptions => ({
    objective: `Find technology entrepreneurs and executives who are active philanthropists${location ? ` in ${location}` : ""}`,
    entityType: "philanthropist",
    matchConditions: [
      {
        name: "tech_background",
        description:
          "Must be a founder, CEO, or senior executive at a technology company (software, internet, AI, biotech, etc.)",
      },
      {
        name: "philanthropic_activity",
        description:
          "Must have demonstrated philanthropic activity: founded a foundation, sits on nonprofit boards, or made significant charitable gifts ($100K+)",
      },
      {
        name: "wealth_indicator",
        description:
          "Must have indicators of significant wealth: successful exit, public company executive, or verified high net worth",
      },
    ],
    matchLimit: 20,
    generator: "pro",
  }),

  /**
   * Find real estate investors with nonprofit involvement
   */
  realEstateInvestors: (location?: string): ProspectDiscoveryOptions => ({
    objective: `Find real estate investors and developers who support nonprofits${location ? ` in ${location}` : ""}`,
    entityType: "investor",
    matchConditions: [
      {
        name: "real_estate",
        description:
          "Must own or have developed significant commercial or residential real estate ($5M+ portfolio)",
      },
      {
        name: "nonprofit_connection",
        description:
          "Must have connection to nonprofits: board membership, foundation involvement, or documented charitable giving",
      },
    ],
    matchLimit: 15,
    generator: "pro",
  }),

  /**
   * Find healthcare executives who are donors
   */
  healthcareExecutives: (location?: string): ProspectDiscoveryOptions => ({
    objective: `Find healthcare industry executives who are philanthropic donors${location ? ` in ${location}` : ""}`,
    entityType: "executive",
    matchConditions: [
      {
        name: "healthcare_role",
        description:
          "Must be a senior executive (C-suite, VP+, or founder) at a healthcare company (hospitals, biotech, pharma, medical devices, healthcare services)",
      },
      {
        name: "giving_history",
        description:
          "Must have documented charitable giving or foundation involvement",
      },
    ],
    matchLimit: 15,
    generator: "pro",
  }),

  /**
   * Find finance professionals with philanthropy
   */
  financePhilanthropists: (location?: string): ProspectDiscoveryOptions => ({
    objective: `Find finance and investment professionals who are active in philanthropy${location ? ` in ${location}` : ""}`,
    entityType: "philanthropist",
    matchConditions: [
      {
        name: "finance_background",
        description:
          "Must work or have worked in finance: hedge funds, private equity, venture capital, investment banking, or asset management",
      },
      {
        name: "philanthropic_activity",
        description:
          "Must be involved in philanthropy: personal foundation, donor-advised fund, major gifts, or nonprofit board service",
      },
    ],
    matchLimit: 20,
    generator: "pro",
  }),
}
