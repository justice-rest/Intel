/**
 * Parallel AI Task API Wrapper
 *
 * Enterprise-grade wrapper for Parallel's Task API with structured JSON output.
 * Returns typed, validated data instead of raw text - eliminates parsing errors.
 *
 * Key Features:
 * - Structured JSON output schemas
 * - Progress streaming support
 * - Circuit breaker protection
 * - Automatic retry with exponential backoff
 *
 * @see https://parallel.ai/docs/task-api
 */

import Parallel from "parallel-web"
import type {
  TaskRunCreateParams,
  BetaTaskRunResult,
  TaskRunEventsResponse,
} from "parallel-web/resources/beta/task-run"
import type { TaskSpec, JsonSchema } from "parallel-web/resources/task-run"
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

export interface TaskApiConfig {
  /** API key (defaults to PARALLEL_API_KEY env var) */
  apiKey?: string
  /** Request timeout in ms (default: 60000) */
  timeout?: number
  /** Max retries for transient failures (default: 2) */
  maxRetries?: number
}

export interface TaskRunOptions<T = unknown> {
  /** Input to the task - text or structured JSON */
  input: string | Record<string, unknown>
  /** Processor to use: 'base', 'pro', or 'preview' */
  processor?: "base" | "pro" | "preview"
  /** Output schema for structured JSON responses */
  outputSchema?: JsonSchema | "auto"
  /** Enable progress events streaming */
  enableEvents?: boolean
  /** Source policy for web results */
  sourcePolicy?: {
    includeDomains?: string[]
    excludeDomains?: string[]
  }
  /** Metadata for tracking */
  metadata?: Record<string, string | number | boolean>
  /** Timeout for waiting for result (ms) */
  resultTimeout?: number
}

export interface TaskRunResult<T = unknown> {
  /** Run ID for reference */
  runId: string
  /** Status of the run */
  status: "queued" | "action_required" | "running" | "completed" | "failed" | "cancelling" | "cancelled"
  /** Structured output (if completed with JSON schema) */
  output?: T
  /** Raw text output (if completed without schema) */
  textOutput?: string
  /** Output type */
  outputType: "json" | "text"
  /** Sources used (from basis citations) */
  sources: Array<{
    url: string
    title?: string
    excerpts?: string[]
    fieldName?: string
    reasoning?: string
  }>
  /** Error message if failed */
  error?: string
  /** Duration in ms */
  durationMs: number
}

export interface ProgressEvent {
  type: "progress_stats" | "progress_message" | "state" | "error"
  progressPercent?: number
  message?: string
  sourcesRead?: number
  sourcesConsidered?: number
  status?: string
  timestamp: Date
}

export type TaskProgressCallback = (event: ProgressEvent) => void

export interface TaskApiError extends Error {
  code: TaskApiErrorCode
  statusCode?: number
  retryable: boolean
  runId?: string
}

export type TaskApiErrorCode =
  | "NOT_CONFIGURED"
  | "NOT_AVAILABLE"
  | "CIRCUIT_OPEN"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "INVALID_SCHEMA"
  | "RUN_FAILED"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR"

// ============================================================================
// PROSPECT RESEARCH SCHEMAS
// ============================================================================

/**
 * Structured output schema for prospect research
 * Eliminates text parsing - returns typed JSON directly
 */
export const PROSPECT_RESEARCH_SCHEMA: JsonSchema = {
  type: "json",
  json_schema: {
    type: "object",
    properties: {
    name: {
      type: "string",
      description: "Full name of the prospect",
    },
    age: {
      type: ["integer", "null"],
      description: "Age of the prospect if found",
    },
    spouse: {
      type: ["string", "null"],
      description: "Name of spouse if found",
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          institution: { type: "string" },
          degree: { type: ["string", "null"] },
          year: { type: ["integer", "null"] },
        },
        required: ["institution"],
      },
      description: "Educational background",
    },
    realEstate: {
      type: "array",
      items: {
        type: "object",
        properties: {
          address: { type: "string" },
          estimatedValue: { type: ["number", "null"] },
          valueLow: { type: ["number", "null"] },
          valueHigh: { type: ["number", "null"] },
          source: { type: ["string", "null"] },
          isVerified: { type: "boolean" },
        },
        required: ["address"],
      },
      description: "Real estate holdings with estimated values",
    },
    totalRealEstateValue: {
      type: ["number", "null"],
      description: "Sum of all real estate values",
    },
    businesses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          estimatedRevenue: { type: ["number", "null"] },
          industry: { type: ["string", "null"] },
          isOwner: { type: "boolean" },
        },
        required: ["name", "role"],
      },
      description: "Business ownership and executive positions",
    },
    securities: {
      type: "object",
      properties: {
        hasSecFilings: { type: "boolean" },
        companies: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ticker: { type: "string" },
              companyName: { type: "string" },
              role: { type: ["string", "null"] },
            },
            required: ["ticker", "companyName"],
          },
        },
      },
      description: "SEC filings and public company involvement",
    },
    philanthropy: {
      type: "object",
      properties: {
        foundations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: { type: ["string", "null"] },
              ein: { type: ["string", "null"] },
            },
            required: ["name"],
          },
        },
        boardMemberships: {
          type: "array",
          items: {
            type: "object",
            properties: {
              organization: { type: "string" },
              role: { type: ["string", "null"] },
            },
            required: ["organization"],
          },
        },
        majorGifts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              recipient: { type: "string" },
              amount: { type: ["number", "null"] },
              year: { type: ["integer", "null"] },
            },
            required: ["recipient"],
          },
        },
      },
      description: "Philanthropic activity and foundation involvement",
    },
    politicalGiving: {
      type: "object",
      properties: {
        totalAmount: { type: ["number", "null"] },
        partyLean: { type: ["string", "null"] },
        recentContributions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              recipient: { type: "string" },
              amount: { type: "number" },
              date: { type: ["string", "null"] },
            },
            required: ["recipient", "amount"],
          },
        },
      },
      description: "Political contribution history",
    },
    netWorthEstimate: {
      type: "object",
      properties: {
        low: { type: ["number", "null"] },
        high: { type: ["number", "null"] },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
      },
      description: "Estimated net worth range",
    },
    givingCapacityRating: {
      type: ["string", "null"],
      enum: ["A", "B", "C", "D", null],
      description: "Giving capacity rating (A: $1M+, B: $100K-$1M, C: $25K-$100K, D: <$25K)",
    },
    summary: {
      type: "string",
      description: "Brief executive summary of the prospect",
    },
  },
  required: ["name", "summary"],
  },
}

/**
 * TypeScript type matching the schema above
 */
export interface ProspectResearchOutput {
  name: string
  age?: number | null
  spouse?: string | null
  education?: Array<{
    institution: string
    degree?: string | null
    year?: number | null
  }>
  realEstate?: Array<{
    address: string
    estimatedValue?: number | null
    valueLow?: number | null
    valueHigh?: number | null
    source?: string | null
    isVerified?: boolean
  }>
  totalRealEstateValue?: number | null
  businesses?: Array<{
    name: string
    role: string
    estimatedRevenue?: number | null
    industry?: string | null
    isOwner?: boolean
  }>
  securities?: {
    hasSecFilings?: boolean
    companies?: Array<{
      ticker: string
      companyName: string
      role?: string | null
    }>
  }
  philanthropy?: {
    foundations?: Array<{
      name: string
      role?: string | null
      ein?: string | null
    }>
    boardMemberships?: Array<{
      organization: string
      role?: string | null
    }>
    majorGifts?: Array<{
      recipient: string
      amount?: number | null
      year?: number | null
    }>
  }
  politicalGiving?: {
    totalAmount?: number | null
    partyLean?: string | null
    recentContributions?: Array<{
      recipient: string
      amount: number
      date?: string | null
    }>
  }
  netWorthEstimate?: {
    low?: number | null
    high?: number | null
    confidence?: "high" | "medium" | "low"
  }
  givingCapacityRating?: "A" | "B" | "C" | "D" | null
  summary: string
}

// ============================================================================
// ERROR FACTORY
// ============================================================================

function createTaskApiError(
  message: string,
  code: TaskApiErrorCode,
  options?: {
    statusCode?: number
    retryable?: boolean
    runId?: string
    cause?: Error
  }
): TaskApiError {
  const error = new Error(message) as TaskApiError
  error.name = "TaskApiError"
  error.code = code
  error.statusCode = options?.statusCode
  error.retryable = options?.retryable ?? false
  error.runId = options?.runId
  if (options?.cause) {
    error.cause = options.cause
  }
  return error
}

function classifyTaskApiError(error: unknown): TaskApiError {
  if (error instanceof Error && "code" in error && "retryable" in error) {
    return error as TaskApiError
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (message.includes("rate limit") || message.includes("429")) {
      return createTaskApiError("Rate limit exceeded", "RATE_LIMITED", {
        statusCode: 429,
        retryable: true,
        cause: error,
      })
    }

    if (message.includes("timeout") || message.includes("timed out")) {
      return createTaskApiError("Request timed out", "TIMEOUT", {
        retryable: true,
        cause: error,
      })
    }

    if (message.includes("schema") || message.includes("validation")) {
      return createTaskApiError("Invalid output schema", "INVALID_SCHEMA", {
        retryable: false,
        cause: error,
      })
    }

    if (message.includes("network") || message.includes("fetch")) {
      return createTaskApiError("Network error", "NETWORK_ERROR", {
        retryable: true,
        cause: error,
      })
    }

    return createTaskApiError(error.message, "UNKNOWN_ERROR", {
      retryable: false,
      cause: error,
    })
  }

  return createTaskApiError(String(error), "UNKNOWN_ERROR", {
    retryable: false,
  })
}

// ============================================================================
// CLIENT SINGLETON
// ============================================================================

let taskApiClient: Parallel | null = null

function getTaskApiClient(config?: TaskApiConfig): Parallel {
  if (!taskApiClient) {
    const apiKey = config?.apiKey ?? process.env.PARALLEL_API_KEY

    if (!apiKey) {
      throw createTaskApiError(
        "PARALLEL_API_KEY is not configured",
        "NOT_CONFIGURED"
      )
    }

    taskApiClient = new Parallel({
      apiKey,
      timeout: config?.timeout ?? 60000,
      maxRetries: 0, // We handle retries ourselves
    })
  }

  return taskApiClient
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

function getTaskApiCircuitBreaker(): CircuitBreaker {
  return circuitBreakerRegistry.getOrCreate(
    "parallel-task-api",
    CIRCUIT_BREAKER_CONFIGS.primaryLLM // Use primary LLM config - more lenient
  )
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withTaskRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  let lastError: TaskApiError | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = classifyTaskApiError(error)

      if (!lastError.retryable || attempt === maxRetries) {
        throw lastError
      }

      const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000)
      console.warn(
        `[TaskAPI] Retry ${attempt + 1}/${maxRetries} after ${delayMs}ms: ${lastError.message}`
      )
      await sleep(delayMs)
    }
  }

  throw lastError ?? createTaskApiError("Unknown error", "UNKNOWN_ERROR")
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Execute a task with structured JSON output
 *
 * @param options - Task configuration including input and output schema
 * @param config - Optional client configuration
 * @returns Structured result with typed output
 */
export async function executeTask<T = unknown>(
  options: TaskRunOptions<T>,
  config?: TaskApiConfig
): Promise<TaskRunResult<T>> {
  const startTime = Date.now()

  // Pre-flight checks
  if (!isParallelConfigured()) {
    throw createTaskApiError(
      "Parallel API key not configured",
      "NOT_CONFIGURED"
    )
  }

  if (!isParallelAvailable()) {
    throw createTaskApiError("Parallel is not enabled", "NOT_AVAILABLE")
  }

  const circuitBreaker = getTaskApiCircuitBreaker()

  if (circuitBreaker.isOpen()) {
    throw createTaskApiError(
      "Task API circuit breaker is open - service temporarily unavailable",
      "CIRCUIT_OPEN",
      { retryable: true }
    )
  }

  let client: Parallel
  try {
    client = getTaskApiClient(config)
  } catch (error) {
    throw classifyTaskApiError(error)
  }

  // Build task spec
  const taskSpec: TaskSpec | undefined = options.outputSchema
    ? {
        output_schema:
          options.outputSchema === "auto"
            ? { type: "auto" }
            : options.outputSchema,
      }
    : undefined

  // Build create params
  const createParams: TaskRunCreateParams = {
    input: options.input,
    processor: options.processor ?? "pro",
    task_spec: taskSpec,
    enable_events: options.enableEvents,
    metadata: options.metadata,
    betas: ["search-extract-2025-10-10"],
  }

  // Add source policy if specified
  if (options.sourcePolicy) {
    createParams.source_policy = {}
    if (options.sourcePolicy.includeDomains?.length) {
      createParams.source_policy.include_domains =
        options.sourcePolicy.includeDomains
    }
    if (options.sourcePolicy.excludeDomains?.length) {
      createParams.source_policy.exclude_domains =
        options.sourcePolicy.excludeDomains
    }
  }

  try {
    // Create the task run
    const run = await withTaskRetry(
      () => client.beta.taskRun.create(createParams),
      config?.maxRetries ?? 2
    )

    console.log(`[TaskAPI] Created task run: ${run.run_id}`)

    // Wait for result with timeout
    const timeoutMs = options.resultTimeout ?? 120000 // 2 minute default
    const result = await withTaskRetry(
      () =>
        client.beta.taskRun.result(run.run_id, {
          timeout: Math.ceil(timeoutMs / 1000),
          betas: ["search-extract-2025-10-10"],
        }),
      1 // Only 1 retry for result polling
    )

    // Record success
    circuitBreaker.recordSuccess()

    const durationMs = Date.now() - startTime
    console.log(
      `[TaskAPI] Task completed in ${durationMs}ms, status: ${result.run.status}`
    )

    // Handle non-success states
    if (result.run.status === "failed") {
      throw createTaskApiError(
        `Task run failed: ${result.run.error?.message || "Unknown error"}`,
        "RUN_FAILED",
        { runId: run.run_id }
      )
    }

    if (result.run.status === "cancelled" || result.run.status === "cancelling") {
      throw createTaskApiError(
        `Task run was cancelled`,
        "RUN_FAILED",
        { runId: run.run_id }
      )
    }

    if (result.run.status === "action_required") {
      throw createTaskApiError(
        `Task run requires action - not supported in automated mode`,
        "RUN_FAILED",
        { runId: run.run_id }
      )
    }

    // Extract sources from basis citations
    const sources: TaskRunResult<T>["sources"] = []
    const seenUrls = new Set<string>()

    if (result.output.basis) {
      for (const basis of result.output.basis) {
        // Each basis has field, reasoning, and citations array
        if (basis.citations) {
          for (const citation of basis.citations) {
            if (citation.url && !seenUrls.has(citation.url)) {
              seenUrls.add(citation.url)
              sources.push({
                url: citation.url,
                title: citation.title ?? undefined,
                excerpts: citation.excerpts ?? undefined,
                fieldName: basis.field,
                reasoning: basis.reasoning,
              })
            }
          }
        }
      }
    }

    // Return typed result
    if (result.output.type === "json") {
      return {
        runId: run.run_id,
        status: result.run.status,
        output: result.output.content as T,
        outputType: "json",
        sources,
        durationMs,
      }
    } else {
      return {
        runId: run.run_id,
        status: result.run.status,
        textOutput: result.output.content,
        outputType: "text",
        sources,
        durationMs,
      }
    }
  } catch (error) {
    const taskError = classifyTaskApiError(error)

    // Only record failure if not already a circuit breaker error
    if (taskError.code !== "CIRCUIT_OPEN") {
      circuitBreaker.recordFailure()
    }

    throw taskError
  }
}

/**
 * Execute task with progress streaming
 *
 * @param options - Task configuration
 * @param onProgress - Callback for progress events
 * @param config - Optional client configuration
 * @returns Structured result
 */
export async function executeTaskWithProgress<T = unknown>(
  options: TaskRunOptions<T>,
  onProgress: TaskProgressCallback,
  config?: TaskApiConfig
): Promise<TaskRunResult<T>> {
  const startTime = Date.now()

  // Pre-flight checks
  if (!isParallelConfigured()) {
    throw createTaskApiError(
      "Parallel API key not configured",
      "NOT_CONFIGURED"
    )
  }

  if (!isParallelAvailable()) {
    throw createTaskApiError("Parallel is not enabled", "NOT_AVAILABLE")
  }

  const circuitBreaker = getTaskApiCircuitBreaker()

  if (circuitBreaker.isOpen()) {
    throw createTaskApiError(
      "Task API circuit breaker is open - service temporarily unavailable",
      "CIRCUIT_OPEN",
      { retryable: true }
    )
  }

  let client: Parallel
  try {
    client = getTaskApiClient(config)
  } catch (error) {
    throw classifyTaskApiError(error)
  }

  // Build task spec
  const taskSpec: TaskSpec | undefined = options.outputSchema
    ? {
        output_schema:
          options.outputSchema === "auto"
            ? { type: "auto" }
            : options.outputSchema,
      }
    : undefined

  // Build create params - always enable events for streaming
  const createParams: TaskRunCreateParams = {
    input: options.input,
    processor: options.processor ?? "pro",
    task_spec: taskSpec,
    enable_events: true,
    metadata: options.metadata,
    betas: ["search-extract-2025-10-10", "events-sse-2025-07-24"],
  }

  if (options.sourcePolicy) {
    createParams.source_policy = {}
    if (options.sourcePolicy.includeDomains?.length) {
      createParams.source_policy.include_domains =
        options.sourcePolicy.includeDomains
    }
    if (options.sourcePolicy.excludeDomains?.length) {
      createParams.source_policy.exclude_domains =
        options.sourcePolicy.excludeDomains
    }
  }

  try {
    // Create the task run
    const run = await withTaskRetry(
      () => client.beta.taskRun.create(createParams),
      config?.maxRetries ?? 2
    )

    console.log(`[TaskAPI] Created streaming task run: ${run.run_id}`)

    // Stream events
    const eventStream = await client.beta.taskRun.events(run.run_id)

    let finalResult: BetaTaskRunResult | null = null

    for await (const event of eventStream) {
      const timestamp = new Date()

      if ("progress_meter" in event) {
        // Progress stats event
        const statsEvent = event as TaskRunEventsResponse.TaskRunProgressStatsEvent
        onProgress({
          type: "progress_stats",
          progressPercent: statsEvent.progress_meter,
          sourcesRead: statsEvent.source_stats.num_sources_read ?? undefined,
          sourcesConsidered:
            statsEvent.source_stats.num_sources_considered ?? undefined,
          timestamp,
        })
      } else if ("message" in event) {
        // Progress message event
        const msgEvent = event as TaskRunEventsResponse.TaskRunProgressMessageEvent
        onProgress({
          type: "progress_message",
          message: msgEvent.message,
          timestamp,
        })
      } else if ("run" in event && "type" in event && event.type === "task_run.state") {
        // State change event
        onProgress({
          type: "state",
          status: event.run.status,
          timestamp,
        })

        // If completed, we'll get the result from the result endpoint
        if (
          event.run.status === "completed" ||
          event.run.status === "failed" ||
          event.run.status === "cancelled"
        ) {
          break
        }
      } else if ("error" in event) {
        // Error event
        onProgress({
          type: "error",
          message: event.error.message,
          timestamp,
        })
      }
    }

    // Get final result
    finalResult = await withTaskRetry(
      () =>
        client.beta.taskRun.result(run.run_id, {
          betas: ["search-extract-2025-10-10"],
        }),
      1
    )

    // Record success
    circuitBreaker.recordSuccess()

    const durationMs = Date.now() - startTime

    if (finalResult.run.status === "failed") {
      throw createTaskApiError(
        `Task run failed: ${finalResult.run.error?.message || "Unknown error"}`,
        "RUN_FAILED",
        { runId: run.run_id }
      )
    }

    // Extract sources from basis citations
    const sources: TaskRunResult<T>["sources"] = []
    const seenUrls = new Set<string>()

    if (finalResult.output.basis) {
      for (const basis of finalResult.output.basis) {
        if (basis.citations) {
          for (const citation of basis.citations) {
            if (citation.url && !seenUrls.has(citation.url)) {
              seenUrls.add(citation.url)
              sources.push({
                url: citation.url,
                title: citation.title ?? undefined,
                excerpts: citation.excerpts ?? undefined,
                fieldName: basis.field,
                reasoning: basis.reasoning,
              })
            }
          }
        }
      }
    }

    if (finalResult.output.type === "json") {
      return {
        runId: run.run_id,
        status: finalResult.run.status,
        output: finalResult.output.content as T,
        outputType: "json",
        sources,
        durationMs,
      }
    } else {
      return {
        runId: run.run_id,
        status: finalResult.run.status,
        textOutput: finalResult.output.content,
        outputType: "text",
        sources,
        durationMs,
      }
    }
  } catch (error) {
    const taskError = classifyTaskApiError(error)
    if (taskError.code !== "CIRCUIT_OPEN") {
      circuitBreaker.recordFailure()
    }
    throw taskError
  }
}

/**
 * Execute prospect research with structured output
 *
 * @param prospect - Prospect information
 * @param options - Additional options
 * @param config - Client configuration
 * @returns Typed prospect research result
 */
export async function executeProspectResearchTask(
  prospect: {
    name: string
    address?: string
    employer?: string
    title?: string
    city?: string
    state?: string
  },
  options?: {
    focusAreas?: Array<
      "real_estate" | "business" | "philanthropy" | "securities" | "biography"
    >
    processor?: "base" | "pro" | "preview"
    onProgress?: TaskProgressCallback
  },
  config?: TaskApiConfig
): Promise<TaskRunResult<ProspectResearchOutput>> {
  const { name, address, employer, title, city, state } = prospect
  const focusAreas = options?.focusAreas ?? [
    "real_estate",
    "business",
    "philanthropy",
    "securities",
    "biography",
  ]

  // Build professional context
  const professionalContext = [title, employer].filter(Boolean).join(" at ")
  const location = [city, state].filter(Boolean).join(", ")

  // Build input object
  const input = {
    prospect_name: name,
    address: address ?? null,
    location: location || null,
    professional_context: professionalContext || null,
    focus_areas: focusAreas,
    instructions: `Research ${name} for nonprofit major donor prospect research.

${address ? `Known address: ${address}` : ""}
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

  const taskOptions: TaskRunOptions<ProspectResearchOutput> = {
    input,
    processor: options?.processor ?? "pro",
    outputSchema: PROSPECT_RESEARCH_SCHEMA,
    sourcePolicy: {
      excludeDomains: [
        "pinterest.com",
        "instagram.com",
        "tiktok.com",
        "facebook.com",
        "twitter.com",
        "x.com",
        "reddit.com",
        "quora.com",
      ],
    },
    metadata: {
      prospect_name: name,
      research_type: "prospect_research",
    },
    resultTimeout: 120000, // 2 minutes
  }

  if (options?.onProgress) {
    return executeTaskWithProgress<ProspectResearchOutput>(
      taskOptions,
      options.onProgress,
      config
    )
  } else {
    return executeTask<ProspectResearchOutput>(taskOptions, config)
  }
}

/**
 * Get Task API status
 */
export function getTaskApiStatus(): {
  available: boolean
  configured: boolean
  enabled: boolean
  circuitOpen: boolean
  reasons: string[]
} {
  const configured = isParallelConfigured()
  const enabled = isParallelAvailable()
  const circuitBreaker = getTaskApiCircuitBreaker()
  const circuitOpen = circuitBreaker.isOpen()

  const reasons: string[] = []

  if (!configured) {
    reasons.push("PARALLEL_API_KEY not set")
  }

  if (!enabled) {
    reasons.push("PARALLEL_ENABLED is false")
  }

  if (circuitOpen) {
    reasons.push("Task API circuit breaker is open")
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
 * Reset Task API circuit breaker
 */
export function resetTaskApiCircuitBreaker(): void {
  getTaskApiCircuitBreaker().reset()
}
