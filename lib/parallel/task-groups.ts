/**
 * Parallel AI Task Groups Wrapper
 *
 * Enterprise-grade wrapper for Parallel's Task Groups API.
 * Enables batch processing of multiple prospects with:
 * - Parallel execution with structured JSON output
 * - Real-time progress streaming per run
 * - Graceful partial failure handling
 * - Resumable result streams
 * - Circuit breaker protection
 *
 * @see https://parallel.ai/docs/task-groups
 */

import Parallel from "parallel-web"
import type { BetaRunInput } from "parallel-web/resources/beta/task-run"
import type {
  TaskGroupCreateParams,
  TaskGroupAddRunsParams,
  TaskGroupEventsResponse,
  TaskGroupGetRunsResponse,
  TaskGroupStatus,
} from "parallel-web/resources/beta/task-group"
import type { TaskSpec, JsonSchema, FieldBasis } from "parallel-web/resources/task-run"
import {
  circuitBreakerRegistry,
  CIRCUIT_BREAKER_CONFIGS,
  type CircuitBreaker,
} from "@/lib/batch-processing/resilience/circuit-breaker"
import {
  isParallelAvailable,
  isParallelConfigured,
} from "@/lib/feature-flags/parallel-migration"
import { PROSPECT_RESEARCH_SCHEMA, type ProspectResearchOutput } from "./task-api"

// ============================================================================
// TYPES
// ============================================================================

export interface TaskGroupConfig {
  /** API key (defaults to PARALLEL_API_KEY env var) */
  apiKey?: string
  /** Request timeout in ms (default: 60000) */
  timeout?: number
}

export interface BatchProspect {
  /** Unique identifier for tracking */
  id: string
  /** Full name of the prospect */
  name: string
  /** Address for property research (optional) */
  address?: string
  /** Current employer (optional) */
  employer?: string
  /** Job title (optional) */
  title?: string
  /** City for location disambiguation (optional) */
  city?: string
  /** State for location disambiguation (optional) */
  state?: string
}

export interface BatchResearchOptions {
  /** Processor to use: 'base', 'pro', or 'preview' (default: 'pro') */
  processor?: "base" | "pro" | "preview"
  /** Focus areas for research */
  focusAreas?: Array<
    "real_estate" | "business" | "philanthropy" | "securities" | "biography"
  >
  /** Domains to exclude from search */
  excludeDomains?: string[]
  /** Enable real-time progress events */
  enableEvents?: boolean
  /** Group metadata for tracking */
  metadata?: Record<string, string | number | boolean>
}

export interface BatchRunResult<T = unknown> {
  /** Prospect ID from input */
  prospectId: string
  /** Prospect name */
  prospectName: string
  /** Run ID from Parallel */
  runId: string
  /** Run status */
  status:
    | "queued"
    | "action_required"
    | "running"
    | "completed"
    | "failed"
    | "cancelling"
    | "cancelled"
  /** Structured output (if completed with JSON schema) */
  output?: T
  /** Raw text output (if completed without schema) */
  textOutput?: string
  /** Output type */
  outputType: "json" | "text"
  /** Sources used */
  sources: Array<{
    url: string
    title?: string
    excerpts?: string[]
    fieldName?: string
    reasoning?: string
  }>
  /** Error message if failed */
  error?: string
  /** Duration in ms (if available) */
  durationMs?: number
}

export interface BatchGroupResult<T = unknown> {
  /** Task group ID */
  groupId: string
  /** Overall status */
  status: {
    isActive: boolean
    totalRuns: number
    statusCounts: Record<string, number>
  }
  /** Individual run results */
  results: BatchRunResult<T>[]
  /** Completed count */
  completedCount: number
  /** Failed count */
  failedCount: number
  /** Total duration ms */
  totalDurationMs: number
}

export interface BatchProgressEvent {
  type: "group_status" | "run_status" | "run_complete" | "error"
  /** Task group ID */
  groupId: string
  /** Run ID (if run-specific event) */
  runId?: string
  /** Prospect ID (if run-specific event) */
  prospectId?: string
  /** Group status (if group_status event) */
  groupStatus?: TaskGroupStatus
  /** Run status */
  runStatus?: string
  /** Output (if run_complete with completed status) */
  output?: unknown
  /** Error message */
  error?: string
  /** Event timestamp */
  timestamp: Date
}

export type BatchProgressCallback = (event: BatchProgressEvent) => void

export interface TaskGroupError extends Error {
  code: TaskGroupErrorCode
  groupId?: string
  retryable: boolean
}

export type TaskGroupErrorCode =
  | "NOT_CONFIGURED"
  | "NOT_AVAILABLE"
  | "CIRCUIT_OPEN"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "GROUP_FAILED"
  | "PARTIAL_FAILURE"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR"

// ============================================================================
// ERROR FACTORY
// ============================================================================

function createTaskGroupError(
  message: string,
  code: TaskGroupErrorCode,
  options?: {
    groupId?: string
    retryable?: boolean
    cause?: Error
  }
): TaskGroupError {
  const error = new Error(message) as TaskGroupError
  error.name = "TaskGroupError"
  error.code = code
  error.groupId = options?.groupId
  error.retryable = options?.retryable ?? false
  if (options?.cause) {
    error.cause = options.cause
  }
  return error
}

function classifyTaskGroupError(error: unknown): TaskGroupError {
  if (error instanceof Error && "code" in error && "retryable" in error) {
    return error as TaskGroupError
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (message.includes("rate limit") || message.includes("429")) {
      return createTaskGroupError("Rate limit exceeded", "RATE_LIMITED", {
        retryable: true,
        cause: error,
      })
    }

    if (message.includes("timeout") || message.includes("timed out")) {
      return createTaskGroupError("Request timed out", "TIMEOUT", {
        retryable: true,
        cause: error,
      })
    }

    if (message.includes("network") || message.includes("fetch")) {
      return createTaskGroupError("Network error", "NETWORK_ERROR", {
        retryable: true,
        cause: error,
      })
    }

    return createTaskGroupError(error.message, "UNKNOWN_ERROR", {
      retryable: false,
      cause: error,
    })
  }

  return createTaskGroupError(String(error), "UNKNOWN_ERROR", {
    retryable: false,
  })
}

// ============================================================================
// CLIENT SINGLETON
// ============================================================================

let taskGroupClient: Parallel | null = null

function getTaskGroupClient(config?: TaskGroupConfig): Parallel {
  if (!taskGroupClient) {
    const apiKey = config?.apiKey ?? process.env.PARALLEL_API_KEY

    if (!apiKey) {
      throw createTaskGroupError(
        "PARALLEL_API_KEY is not configured",
        "NOT_CONFIGURED"
      )
    }

    taskGroupClient = new Parallel({
      apiKey,
      timeout: config?.timeout ?? 60000,
      maxRetries: 0,
    })
  }

  return taskGroupClient
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

function getTaskGroupCircuitBreaker(): CircuitBreaker {
  return circuitBreakerRegistry.getOrCreate(
    "parallel-task-groups",
    CIRCUIT_BREAKER_CONFIGS.primaryLLM
  )
}

// ============================================================================
// HELPER: Build Prospect Research Input
// ============================================================================

function buildProspectInput(
  prospect: BatchProspect,
  options?: BatchResearchOptions
): BetaRunInput {
  const focusAreas = options?.focusAreas ?? [
    "real_estate",
    "business",
    "philanthropy",
    "securities",
    "biography",
  ]

  const professionalContext = [prospect.title, prospect.employer]
    .filter(Boolean)
    .join(" at ")
  const location = [prospect.city, prospect.state].filter(Boolean).join(", ")

  const input = {
    prospect_id: prospect.id,
    prospect_name: prospect.name,
    address: prospect.address ?? null,
    location: location || null,
    professional_context: professionalContext || null,
    focus_areas: focusAreas,
    instructions: `Research ${prospect.name} for nonprofit major donor prospect research.

${prospect.address ? `Known address: ${prospect.address}` : ""}
${location ? `Location: ${location}` : ""}
${professionalContext ? `Professional: ${professionalContext}` : ""}

Focus areas: ${focusAreas.join(", ")}

REQUIREMENTS:
- Find specific dollar amounts with ranges where estimated ($X-Y million)
- Mark findings as verified or estimated
- Calculate giving capacity rating based on:
  - A: $1M+ capacity
  - B: $100K-$1M capacity
  - C: $25K-$100K capacity
  - D: Under $25K capacity
- Provide a brief executive summary`,
  }

  const taskSpec: TaskSpec = {
    output_schema: PROSPECT_RESEARCH_SCHEMA,
  }

  // NOTE: Parallel AI limits source_policy to max 10 domains total
  const sourcePolicy: BetaRunInput["source_policy"] = {
    exclude_domains: options?.excludeDomains ?? [
      "pinterest.com",
      "instagram.com",
      "tiktok.com",
      "facebook.com",
      "reddit.com",
      "quora.com",
      "yelp.com",
      "yellowpages.com",
      // Removed twitter.com and x.com - Grok handles Twitter/X search
    ],
  }

  return {
    input,
    processor: options?.processor ?? "pro",
    task_spec: taskSpec,
    enable_events: options?.enableEvents ?? true,
    source_policy: sourcePolicy,
    metadata: {
      prospect_id: prospect.id,
      prospect_name: prospect.name,
      research_type: "batch_prospect_research",
    },
  }
}

// ============================================================================
// HELPER: Extract Sources from FieldBasis
// ============================================================================

function extractSourcesFromBasis(
  basis: FieldBasis[] | undefined
): BatchRunResult["sources"] {
  const sources: BatchRunResult["sources"] = []
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
// PUBLIC API: Create Task Group
// ============================================================================

/**
 * Create a new task group for batch processing
 *
 * @param metadata - Optional metadata for the group
 * @param config - Optional client configuration
 * @returns Task group ID and initial status
 */
export async function createTaskGroup(
  metadata?: Record<string, string | number | boolean>,
  config?: TaskGroupConfig
): Promise<{ groupId: string; status: TaskGroupStatus }> {
  if (!isParallelConfigured()) {
    throw createTaskGroupError(
      "Parallel API key not configured",
      "NOT_CONFIGURED"
    )
  }

  if (!isParallelAvailable()) {
    throw createTaskGroupError("Parallel is not enabled", "NOT_AVAILABLE")
  }

  const circuitBreaker = getTaskGroupCircuitBreaker()
  if (circuitBreaker.isOpen()) {
    throw createTaskGroupError(
      "Task Groups circuit breaker is open",
      "CIRCUIT_OPEN",
      { retryable: true }
    )
  }

  try {
    const client = getTaskGroupClient(config)
    const params: TaskGroupCreateParams = { metadata }
    const group = await client.beta.taskGroup.create(params)

    circuitBreaker.recordSuccess()

    return {
      groupId: group.taskgroup_id,
      status: group.status,
    }
  } catch (error) {
    const groupError = classifyTaskGroupError(error)
    if (groupError.code !== "CIRCUIT_OPEN") {
      getTaskGroupCircuitBreaker().recordFailure()
    }
    throw groupError
  }
}

// ============================================================================
// PUBLIC API: Add Runs to Group
// ============================================================================

/**
 * Add multiple prospect research runs to a task group
 *
 * @param groupId - Task group ID
 * @param prospects - Array of prospects to research
 * @param options - Research options
 * @param config - Optional client configuration
 * @returns Run IDs and updated status
 */
export async function addProspectResearchRuns(
  groupId: string,
  prospects: BatchProspect[],
  options?: BatchResearchOptions,
  config?: TaskGroupConfig
): Promise<{
  runIds: string[]
  prospectRunMap: Map<string, string>
  status: TaskGroupStatus
}> {
  if (!isParallelConfigured()) {
    throw createTaskGroupError(
      "Parallel API key not configured",
      "NOT_CONFIGURED"
    )
  }

  if (!isParallelAvailable()) {
    throw createTaskGroupError("Parallel is not enabled", "NOT_AVAILABLE")
  }

  const circuitBreaker = getTaskGroupCircuitBreaker()
  if (circuitBreaker.isOpen()) {
    throw createTaskGroupError(
      "Task Groups circuit breaker is open",
      "CIRCUIT_OPEN",
      { retryable: true, groupId }
    )
  }

  if (prospects.length === 0) {
    throw createTaskGroupError("No prospects provided", "GROUP_FAILED", {
      groupId,
    })
  }

  // Limit batch size to prevent overwhelming the API
  const MAX_BATCH_SIZE = 50
  if (prospects.length > MAX_BATCH_SIZE) {
    throw createTaskGroupError(
      `Batch size exceeds maximum of ${MAX_BATCH_SIZE}. Split into smaller batches.`,
      "GROUP_FAILED",
      { groupId }
    )
  }

  try {
    const client = getTaskGroupClient(config)

    // Build inputs for all prospects
    const inputs: BetaRunInput[] = prospects.map((p) =>
      buildProspectInput(p, options)
    )

    const params: TaskGroupAddRunsParams = {
      inputs,
      default_task_spec: {
        output_schema: PROSPECT_RESEARCH_SCHEMA,
      },
      betas: ["search-extract-2025-10-10"],
    }

    const response = await client.beta.taskGroup.addRuns(groupId, params)

    circuitBreaker.recordSuccess()

    // Create mapping from prospect ID to run ID
    const prospectRunMap = new Map<string, string>()
    for (let i = 0; i < prospects.length; i++) {
      if (response.run_ids[i]) {
        prospectRunMap.set(prospects[i].id, response.run_ids[i])
      }
    }

    return {
      runIds: response.run_ids,
      prospectRunMap,
      status: response.status,
    }
  } catch (error) {
    const groupError = classifyTaskGroupError(error)
    groupError.groupId = groupId
    if (groupError.code !== "CIRCUIT_OPEN") {
      getTaskGroupCircuitBreaker().recordFailure()
    }
    throw groupError
  }
}

// ============================================================================
// PUBLIC API: Stream Group Events
// ============================================================================

/**
 * Stream events from a task group
 *
 * @param groupId - Task group ID
 * @param prospectRunMap - Mapping from prospect ID to run ID
 * @param onProgress - Callback for progress events
 * @param config - Optional client configuration
 */
export async function streamGroupEvents(
  groupId: string,
  prospectRunMap: Map<string, string>,
  onProgress: BatchProgressCallback,
  config?: TaskGroupConfig
): Promise<void> {
  const client = getTaskGroupClient(config)

  // Create reverse mapping from run ID to prospect ID
  const runProspectMap = new Map<string, string>()
  for (const [prospectId, runId] of prospectRunMap.entries()) {
    runProspectMap.set(runId, prospectId)
  }

  try {
    const eventStream = await client.beta.taskGroup.events(groupId)

    for await (const event of eventStream) {
      const timestamp = new Date()

      if ("status" in event && event.type === "task_group_status") {
        // Group status event
        onProgress({
          type: "group_status",
          groupId,
          groupStatus: event.status,
          timestamp,
        })
      } else if ("run" in event && event.type === "task_run.state") {
        // Run state change event
        const runId = event.run.run_id
        const prospectId = runProspectMap.get(runId)

        if (
          event.run.status === "completed" ||
          event.run.status === "failed" ||
          event.run.status === "cancelled"
        ) {
          onProgress({
            type: "run_complete",
            groupId,
            runId,
            prospectId,
            runStatus: event.run.status,
            output: event.output,
            error:
              event.run.status === "failed"
                ? event.run.error?.message
                : undefined,
            timestamp,
          })
        } else {
          onProgress({
            type: "run_status",
            groupId,
            runId,
            prospectId,
            runStatus: event.run.status,
            timestamp,
          })
        }
      } else if ("error" in event) {
        // Error event
        onProgress({
          type: "error",
          groupId,
          error: event.error.message,
          timestamp,
        })
      }
    }
  } catch (error) {
    const groupError = classifyTaskGroupError(error)
    groupError.groupId = groupId
    throw groupError
  }
}

// ============================================================================
// PUBLIC API: Get Group Results
// ============================================================================

/**
 * Get all results from a task group
 *
 * @param groupId - Task group ID
 * @param prospectRunMap - Mapping from prospect ID to run ID
 * @param prospects - Original prospect list for name lookup
 * @param config - Optional client configuration
 * @returns Batch group result with all run results
 */
export async function getGroupResults<T = ProspectResearchOutput>(
  groupId: string,
  prospectRunMap: Map<string, string>,
  prospects: BatchProspect[],
  config?: TaskGroupConfig
): Promise<BatchGroupResult<T>> {
  const startTime = Date.now()
  const client = getTaskGroupClient(config)

  // Create lookups
  const runProspectMap = new Map<string, string>()
  const prospectNameMap = new Map<string, string>()

  for (const [prospectId, runId] of prospectRunMap.entries()) {
    runProspectMap.set(runId, prospectId)
  }

  for (const prospect of prospects) {
    prospectNameMap.set(prospect.id, prospect.name)
  }

  try {
    // Get group status
    const group = await client.beta.taskGroup.retrieve(groupId)

    // Get all runs with outputs
    const runsStream = await client.beta.taskGroup.getRuns(groupId, {
      include_input: false,
      include_output: true,
    })

    const results: BatchRunResult<T>[] = []
    let completedCount = 0
    let failedCount = 0

    for await (const event of runsStream) {
      if ("run" in event && event.type === "task_run.state") {
        const runId = event.run.run_id
        const prospectId = runProspectMap.get(runId) ?? "unknown"
        const prospectName = prospectNameMap.get(prospectId) ?? "Unknown"

        const result: BatchRunResult<T> = {
          prospectId,
          prospectName,
          runId,
          status: event.run.status,
          outputType: "text",
          sources: [],
        }

        if (event.run.status === "completed" && event.output) {
          completedCount++

          if (event.output.type === "json") {
            result.output = event.output.content as T
            result.outputType = "json"
          } else {
            result.textOutput = event.output.content
            result.outputType = "text"
          }

          result.sources = extractSourcesFromBasis(event.output.basis)
        } else if (event.run.status === "failed") {
          failedCount++
          result.error = event.run.error?.message ?? "Unknown error"
        } else if (
          event.run.status === "cancelled" ||
          event.run.status === "cancelling"
        ) {
          failedCount++
          result.error = "Run was cancelled"
        } else if (event.run.status === "action_required") {
          failedCount++
          result.error = "Run requires action - not supported in automated mode"
        }

        results.push(result)
      } else if ("error" in event) {
        // Error event during stream
        console.error(`[TaskGroups] Stream error: ${event.error.message}`)
      }
    }

    const totalDurationMs = Date.now() - startTime

    return {
      groupId,
      status: {
        isActive: group.status.is_active,
        totalRuns: group.status.num_task_runs,
        statusCounts: group.status.task_run_status_counts,
      },
      results,
      completedCount,
      failedCount,
      totalDurationMs,
    }
  } catch (error) {
    const groupError = classifyTaskGroupError(error)
    groupError.groupId = groupId
    throw groupError
  }
}

// ============================================================================
// PUBLIC API: Execute Batch Prospect Research
// ============================================================================

/**
 * Execute batch prospect research with progress streaming
 *
 * This is the main entry point for batch processing.
 * Creates a group, adds runs, streams progress, and returns all results.
 *
 * @param prospects - Array of prospects to research
 * @param options - Research options
 * @param onProgress - Optional callback for progress events
 * @param config - Optional client configuration
 * @returns Batch group result with all outputs
 */
export async function executeBatchProspectResearch(
  prospects: BatchProspect[],
  options?: BatchResearchOptions,
  onProgress?: BatchProgressCallback,
  config?: TaskGroupConfig
): Promise<BatchGroupResult<ProspectResearchOutput>> {
  const startTime = Date.now()

  console.log(
    `[TaskGroups] Starting batch research for ${prospects.length} prospects`
  )

  // Pre-flight checks
  if (!isParallelConfigured()) {
    throw createTaskGroupError(
      "Parallel API key not configured",
      "NOT_CONFIGURED"
    )
  }

  if (!isParallelAvailable()) {
    throw createTaskGroupError("Parallel is not enabled", "NOT_AVAILABLE")
  }

  const circuitBreaker = getTaskGroupCircuitBreaker()
  if (circuitBreaker.isOpen()) {
    throw createTaskGroupError(
      "Task Groups circuit breaker is open",
      "CIRCUIT_OPEN",
      { retryable: true }
    )
  }

  try {
    // 1. Create the task group
    const { groupId } = await createTaskGroup(
      {
        batch_size: prospects.length,
        research_type: "prospect_research",
        ...options?.metadata,
      },
      config
    )

    console.log(`[TaskGroups] Created group: ${groupId}`)

    // 2. Add all prospect research runs
    const { prospectRunMap, status } = await addProspectResearchRuns(
      groupId,
      prospects,
      options,
      config
    )

    console.log(
      `[TaskGroups] Added ${prospectRunMap.size} runs, status: ${status.status_message}`
    )

    // 3. If progress callback provided, stream events
    if (onProgress) {
      // Stream in background while we wait for completion
      const eventPromise = streamGroupEvents(
        groupId,
        prospectRunMap,
        onProgress,
        config
      ).catch((err) => {
        console.error(`[TaskGroups] Event stream error:`, err)
      })

      // Wait for group to complete by polling
      await waitForGroupCompletion(groupId, config)

      // Give event stream a moment to finish
      await Promise.race([
        eventPromise,
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ])
    } else {
      // Just wait for completion
      await waitForGroupCompletion(groupId, config)
    }

    // 4. Get all results
    const results = await getGroupResults<ProspectResearchOutput>(
      groupId,
      prospectRunMap,
      prospects,
      config
    )

    const totalDurationMs = Date.now() - startTime
    results.totalDurationMs = totalDurationMs

    console.log(
      `[TaskGroups] Batch completed in ${totalDurationMs}ms: ` +
        `${results.completedCount} completed, ${results.failedCount} failed`
    )

    // Record circuit breaker based on success ratio
    const successRatio =
      results.completedCount / (results.completedCount + results.failedCount)
    if (successRatio >= 0.5) {
      circuitBreaker.recordSuccess()
    } else if (successRatio < 0.3) {
      circuitBreaker.recordFailure()
    }

    return results
  } catch (error) {
    const groupError = classifyTaskGroupError(error)
    if (groupError.code !== "CIRCUIT_OPEN") {
      circuitBreaker.recordFailure()
    }
    throw groupError
  }
}

// ============================================================================
// HELPER: Wait for Group Completion
// ============================================================================

async function waitForGroupCompletion(
  groupId: string,
  config?: TaskGroupConfig,
  maxWaitMs: number = 600000 // 10 minutes max
): Promise<void> {
  const client = getTaskGroupClient(config)
  const startTime = Date.now()
  const pollIntervalMs = 2000

  while (Date.now() - startTime < maxWaitMs) {
    const group = await client.beta.taskGroup.retrieve(groupId)

    if (!group.status.is_active) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  throw createTaskGroupError(
    `Group did not complete within ${maxWaitMs}ms`,
    "TIMEOUT",
    { groupId, retryable: false }
  )
}

// ============================================================================
// PUBLIC API: Get Task Groups Status
// ============================================================================

/**
 * Get Task Groups API status
 */
export function getTaskGroupsStatus(): {
  available: boolean
  configured: boolean
  enabled: boolean
  circuitOpen: boolean
  reasons: string[]
} {
  const configured = isParallelConfigured()
  const enabled = isParallelAvailable()
  const circuitBreaker = getTaskGroupCircuitBreaker()
  const circuitOpen = circuitBreaker.isOpen()

  const reasons: string[] = []

  if (!configured) {
    reasons.push("PARALLEL_API_KEY not set")
  }

  if (!enabled) {
    reasons.push("PARALLEL_ENABLED is false")
  }

  if (circuitOpen) {
    reasons.push("Task Groups circuit breaker is open")
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
 * Reset Task Groups circuit breaker
 */
export function resetTaskGroupsCircuitBreaker(): void {
  getTaskGroupCircuitBreaker().reset()
}
