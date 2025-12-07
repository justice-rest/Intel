/**
 * Structured Logging with Request Tracing for AVM
 *
 * Provides:
 * - Structured JSON logging for production environments
 * - Request correlation IDs for distributed tracing
 * - Performance metrics tracking
 * - Log levels with environment-based filtering
 * - Sensitive data redaction
 *
 * Integrates with:
 * - Vercel Edge Logs
 * - Datadog, Splunk, ELK stack
 * - CloudWatch, GCP Logging
 */

import { v4 as uuidv4 } from "uuid"

// ============================================================================
// Types
// ============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogContext {
  correlationId?: string
  requestId?: string
  userId?: string
  address?: string
  source?: string
  duration?: number
  [key: string]: unknown
}

export interface StructuredLog {
  timestamp: string
  level: LogLevel
  message: string
  service: "avm"
  component: string
  correlationId: string
  context?: Record<string, unknown>
  metrics?: ValuationMetrics
  error?: {
    name: string
    message: string
    stack?: string
  }
}

export interface ValuationMetrics {
  address?: string
  estimatedValue?: number
  confidenceScore?: number
  confidenceLevel?: string
  latencyMs?: number
  sourcesAttempted?: string[]
  sourcesSucceeded?: string[]
  sourcesFailureRate?: number
  cacheHit?: boolean
  hedonicWeight?: number
  compWeight?: number
  onlineWeight?: number
  comparablesUsed?: number
  dataCompleteness?: number
  fsd?: number
}

export interface RequestTrace {
  correlationId: string
  requestId: string
  startTime: number
  address: string
  steps: TraceStep[]
  metrics: ValuationMetrics
}

export interface TraceStep {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  status: "pending" | "success" | "failure" | "skipped"
  details?: Record<string, unknown>
  error?: string
}

// ============================================================================
// Configuration
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const isProduction = process.env.NODE_ENV === "production"
const minLogLevel = isProduction ? "info" : "debug"
const enableJsonLogs = isProduction || process.env.AVM_JSON_LOGS === "true"

// Sensitive fields to redact
const SENSITIVE_FIELDS = ["apiKey", "api_key", "key", "password", "secret", "token"]

// ============================================================================
// Request Trace Manager
// ============================================================================

class TraceManager {
  private traces = new Map<string, RequestTrace>()
  private maxTraces = 1000

  /**
   * Start a new request trace
   */
  start(address: string): RequestTrace {
    // Clean up old traces if needed
    if (this.traces.size >= this.maxTraces) {
      const oldestKey = this.traces.keys().next().value
      if (oldestKey) this.traces.delete(oldestKey)
    }

    const trace: RequestTrace = {
      correlationId: uuidv4(),
      requestId: uuidv4().slice(0, 8),
      startTime: Date.now(),
      address,
      steps: [],
      metrics: { address },
    }

    this.traces.set(trace.correlationId, trace)
    return trace
  }

  /**
   * Get an existing trace
   */
  get(correlationId: string): RequestTrace | undefined {
    return this.traces.get(correlationId)
  }

  /**
   * Add a step to a trace
   */
  startStep(
    correlationId: string,
    name: string,
    details?: Record<string, unknown>
  ): TraceStep | null {
    const trace = this.traces.get(correlationId)
    if (!trace) return null

    const step: TraceStep = {
      name,
      startTime: Date.now(),
      status: "pending",
      details,
    }

    trace.steps.push(step)
    return step
  }

  /**
   * Complete a step
   */
  endStep(
    correlationId: string,
    stepName: string,
    status: "success" | "failure" | "skipped",
    details?: Record<string, unknown>,
    error?: string
  ): void {
    const trace = this.traces.get(correlationId)
    if (!trace) return

    const step = trace.steps.find(
      (s) => s.name === stepName && s.status === "pending"
    )
    if (step) {
      step.endTime = Date.now()
      step.duration = step.endTime - step.startTime
      step.status = status
      if (details) step.details = { ...step.details, ...details }
      if (error) step.error = error
    }
  }

  /**
   * Update metrics
   */
  updateMetrics(
    correlationId: string,
    metrics: Partial<ValuationMetrics>
  ): void {
    const trace = this.traces.get(correlationId)
    if (!trace) return

    trace.metrics = { ...trace.metrics, ...metrics }
  }

  /**
   * Complete and return the trace
   */
  complete(correlationId: string): RequestTrace | undefined {
    const trace = this.traces.get(correlationId)
    if (!trace) return undefined

    // Calculate total latency
    trace.metrics.latencyMs = Date.now() - trace.startTime

    // Calculate source metrics
    const sourcesAttempted = trace.steps
      .filter((s) => s.name.startsWith("source:"))
      .map((s) => s.name.replace("source:", ""))
    const sourcesSucceeded = trace.steps
      .filter((s) => s.name.startsWith("source:") && s.status === "success")
      .map((s) => s.name.replace("source:", ""))

    trace.metrics.sourcesAttempted = sourcesAttempted
    trace.metrics.sourcesSucceeded = sourcesSucceeded
    trace.metrics.sourcesFailureRate =
      sourcesAttempted.length > 0
        ? 1 - sourcesSucceeded.length / sourcesAttempted.length
        : 0

    return trace
  }

  /**
   * Delete a trace
   */
  delete(correlationId: string): void {
    this.traces.delete(correlationId)
  }
}

export const traceManager = new TraceManager()

// ============================================================================
// Logger Class
// ============================================================================

class AVMLogger {
  private component: string
  private correlationId?: string

  constructor(component: string, correlationId?: string) {
    this.component = component
    this.correlationId = correlationId
  }

  /**
   * Create a child logger with additional context
   */
  child(component: string): AVMLogger {
    return new AVMLogger(
      `${this.component}:${component}`,
      this.correlationId
    )
  }

  /**
   * Set correlation ID for this logger
   */
  withCorrelation(correlationId: string): AVMLogger {
    return new AVMLogger(this.component, correlationId)
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[minLogLevel]
  }

  /**
   * Redact sensitive data
   */
  private redact(obj: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f))) {
        redacted[key] = "[REDACTED]"
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        redacted[key] = this.redact(value as Record<string, unknown>)
      } else {
        redacted[key] = value
      }
    }

    return redacted
  }

  /**
   * Format and output a log
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    metrics?: ValuationMetrics,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) return

    const correlationId =
      context?.correlationId || this.correlationId || "no-correlation"

    const structuredLog: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: "avm",
      component: this.component,
      correlationId,
    }

    if (context) {
      const { correlationId: _, ...rest } = context
      if (Object.keys(rest).length > 0) {
        structuredLog.context = this.redact(rest)
      }
    }

    if (metrics) {
      structuredLog.metrics = metrics
    }

    if (error) {
      structuredLog.error = {
        name: error.name,
        message: error.message,
        stack: isProduction ? undefined : error.stack,
      }
    }

    // Output
    if (enableJsonLogs) {
      console[level](JSON.stringify(structuredLog))
    } else {
      // Human-readable format for development
      const prefix = `[${structuredLog.timestamp}] [${level.toUpperCase()}] [${this.component}] [${correlationId.slice(0, 8)}]`

      if (error) {
        console[level](`${prefix} ${message}`, error)
      } else if (context || metrics) {
        console[level](
          `${prefix} ${message}`,
          context ? this.redact(context) : undefined,
          metrics
        )
      } else {
        console[level](`${prefix} ${message}`)
      }
    }
  }

  // Log level methods
  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context)
  }

  info(message: string, context?: LogContext, metrics?: ValuationMetrics): void {
    this.log("info", message, context, metrics)
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.log("warn", message, context, undefined, error)
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log("error", message, context, undefined, error)
  }

  /**
   * Log valuation completion with metrics
   */
  logValuation(
    message: string,
    metrics: ValuationMetrics,
    context?: LogContext
  ): void {
    this.log("info", message, context, metrics)
  }

  /**
   * Time a function and log its duration
   */
  async time<T>(
    name: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now()
    this.debug(`Starting: ${name}`, context)

    try {
      const result = await fn()
      const duration = Date.now() - startTime
      this.debug(`Completed: ${name}`, { ...context, duration })
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      this.error(`Failed: ${name}`, { ...context, duration }, error as Error)
      throw error
    }
  }

  /**
   * Log a source attempt
   */
  logSourceAttempt(
    source: string,
    status: "start" | "success" | "failure",
    details?: Record<string, unknown>
  ): void {
    const message = `Source ${source}: ${status}`

    if (status === "failure") {
      this.warn(message, { source, ...details })
    } else {
      this.debug(message, { source, ...details })
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Create a logger for a component
 */
export function createLogger(component: string): AVMLogger {
  return new AVMLogger(component)
}

/**
 * Create a logger with correlation ID
 */
export function createTracedLogger(
  component: string,
  correlationId: string
): AVMLogger {
  return new AVMLogger(component, correlationId)
}

// Pre-configured loggers for common components
export const loggers = {
  valuation: createLogger("property-valuation"),
  redfin: createLogger("redfin"),
  linkup: createLogger("linkup"),
  hedonic: createLogger("hedonic-model"),
  comparable: createLogger("comparable-sales"),
  ensemble: createLogger("ensemble"),
  cache: createLogger("cache"),
  circuitBreaker: createLogger("circuit-breaker"),
  fred: createLogger("fred-hpi"),
}

/**
 * Utility to wrap a function with logging and tracing
 */
export function withLogging<T extends (...args: unknown[]) => Promise<unknown>>(
  logger: AVMLogger,
  name: string,
  fn: T
): T {
  return (async (...args: unknown[]) => {
    const startTime = Date.now()
    logger.debug(`${name}: started`)

    try {
      const result = await fn(...args)
      logger.debug(`${name}: completed`, { duration: Date.now() - startTime })
      return result
    } catch (error) {
      logger.error(`${name}: failed`, { duration: Date.now() - startTime }, error as Error)
      throw error
    }
  }) as T
}

/**
 * Format metrics for console output
 */
export function formatMetrics(metrics: ValuationMetrics): string {
  const parts: string[] = []

  if (metrics.estimatedValue) {
    parts.push(`Value: $${metrics.estimatedValue.toLocaleString()}`)
  }
  if (metrics.confidenceScore !== undefined) {
    parts.push(`Confidence: ${metrics.confidenceScore}/100 (${metrics.confidenceLevel})`)
  }
  if (metrics.latencyMs !== undefined) {
    parts.push(`Latency: ${metrics.latencyMs}ms`)
  }
  if (metrics.cacheHit !== undefined) {
    parts.push(`Cache: ${metrics.cacheHit ? "HIT" : "MISS"}`)
  }
  if (metrics.sourcesSucceeded) {
    parts.push(`Sources: ${metrics.sourcesSucceeded.join(", ")}`)
  }

  return parts.join(" | ")
}

// Simple UUID implementation if uuid package not available
function uuidv4Fallback(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Use native crypto if available, fallback otherwise
const uuidGenerator =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? () => crypto.randomUUID()
    : uuidv4Fallback

export { uuidGenerator as generateId }
