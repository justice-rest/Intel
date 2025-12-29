/**
 * Parallel AI Monitoring System
 *
 * Tracks usage metrics, costs, errors, and performance for Parallel API calls.
 * Provides real-time visibility into the health and cost-efficiency of the integration.
 *
 * Metrics are stored in-memory with optional persistence to Redis (if configured).
 */

import type { SearchResult, ExtractResponse } from "parallel-web/resources/beta/beta"
import type { ParallelErrorCode } from "./client"

// ============================================================================
// TYPES
// ============================================================================

export interface ParallelMetrics {
  /** Total API calls made */
  totalCalls: number
  /** Successful API calls */
  successfulCalls: number
  /** Failed API calls */
  failedCalls: number
  /** Total cost in USD (estimated) */
  totalCostUsd: number
  /** Average response time in ms */
  avgResponseTimeMs: number
  /** Error breakdown by type */
  errorsByType: Record<ParallelErrorCode, number>
  /** Calls by endpoint */
  callsByEndpoint: {
    search: number
    extract: number
    task: number
    findall: number
    monitor: number
  }
  /** Cost by endpoint */
  costByEndpoint: {
    search: number
    extract: number
    task: number
    findall: number
    monitor: number
  }
  /** Hourly usage for the last 24 hours */
  hourlyUsage: HourlyUsageRecord[]
  /** Last reset timestamp */
  lastResetAt: string
  /** Period start timestamp */
  periodStartAt: string
}

export interface HourlyUsageRecord {
  hour: string // ISO timestamp of hour start
  calls: number
  errors: number
  costUsd: number
  avgResponseTimeMs: number
}

export interface CallMetadata {
  endpoint: "search" | "extract" | "task" | "findall" | "monitor"
  userId?: string
  chatId?: string
  startTime: number
  endTime?: number
  success?: boolean
  errorCode?: ParallelErrorCode
  costUsd?: number
  resultCount?: number
}

// ============================================================================
// COST ESTIMATION
// ============================================================================

/**
 * Parallel AI pricing (as of 2025)
 * @see https://parallel.ai/pricing
 */
const PARALLEL_PRICING = {
  search: 0.005, // $0.005 per search request
  extract: 0.001, // $0.001 per page extracted
  task: 0.015, // $5-25 per 1K, average ~$15/1K = $0.015 per task
  findall: 0.145, // $60-230 per 1K, average ~$145/1K = $0.145 per candidate
  monitor: 0.01, // Estimated per check
}

export function estimateSearchCost(result: SearchResult): number {
  // Base cost per search
  return PARALLEL_PRICING.search
}

export function estimateExtractCost(result: ExtractResponse): number {
  // Cost per page extracted
  const pageCount = result.results.length
  return PARALLEL_PRICING.extract * pageCount
}

export function estimateTaskCost(): number {
  return PARALLEL_PRICING.task
}

export function estimateFindAllCost(candidateCount: number): number {
  return PARALLEL_PRICING.findall * candidateCount
}

export function estimateMonitorCost(): number {
  return PARALLEL_PRICING.monitor
}

// ============================================================================
// IN-MEMORY METRICS STORE
// ============================================================================

const METRICS_RESET_INTERVAL_HOURS = 24
const MAX_HOURLY_RECORDS = 168 // 7 days of hourly data

function createEmptyMetrics(): ParallelMetrics {
  const now = new Date().toISOString()
  return {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    totalCostUsd: 0,
    avgResponseTimeMs: 0,
    errorsByType: {} as Record<ParallelErrorCode, number>,
    callsByEndpoint: {
      search: 0,
      extract: 0,
      task: 0,
      findall: 0,
      monitor: 0,
    },
    costByEndpoint: {
      search: 0,
      extract: 0,
      task: 0,
      findall: 0,
      monitor: 0,
    },
    hourlyUsage: [],
    lastResetAt: now,
    periodStartAt: now,
  }
}

let metricsStore: ParallelMetrics = createEmptyMetrics()
let responseTimes: number[] = [] // For calculating rolling average

// ============================================================================
// METRICS OPERATIONS
// ============================================================================

/**
 * Record a successful API call
 */
export function recordSuccess(metadata: CallMetadata & { costUsd: number }): void {
  const responseTimeMs = metadata.endTime
    ? metadata.endTime - metadata.startTime
    : 0

  metricsStore.totalCalls++
  metricsStore.successfulCalls++
  metricsStore.totalCostUsd += metadata.costUsd
  metricsStore.callsByEndpoint[metadata.endpoint]++
  metricsStore.costByEndpoint[metadata.endpoint] += metadata.costUsd

  // Update response time average (keep last 1000 samples)
  responseTimes.push(responseTimeMs)
  if (responseTimes.length > 1000) {
    responseTimes = responseTimes.slice(-1000)
  }
  metricsStore.avgResponseTimeMs =
    responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length

  // Update hourly usage
  updateHourlyUsage({
    calls: 1,
    errors: 0,
    costUsd: metadata.costUsd,
    responseTimeMs,
  })
}

/**
 * Record a failed API call
 */
export function recordFailure(
  metadata: CallMetadata & { errorCode: ParallelErrorCode }
): void {
  const responseTimeMs = metadata.endTime
    ? metadata.endTime - metadata.startTime
    : 0

  metricsStore.totalCalls++
  metricsStore.failedCalls++
  metricsStore.callsByEndpoint[metadata.endpoint]++

  // Track error types
  metricsStore.errorsByType[metadata.errorCode] =
    (metricsStore.errorsByType[metadata.errorCode] || 0) + 1

  // Update hourly usage
  updateHourlyUsage({
    calls: 1,
    errors: 1,
    costUsd: 0,
    responseTimeMs,
  })
}

/**
 * Update hourly usage tracking
 */
function updateHourlyUsage(data: {
  calls: number
  errors: number
  costUsd: number
  responseTimeMs: number
}): void {
  const now = new Date()
  const hourStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours()
  ).toISOString()

  // Find or create current hour record
  let currentHour = metricsStore.hourlyUsage.find((h) => h.hour === hourStart)

  if (!currentHour) {
    currentHour = {
      hour: hourStart,
      calls: 0,
      errors: 0,
      costUsd: 0,
      avgResponseTimeMs: 0,
    }
    metricsStore.hourlyUsage.push(currentHour)

    // Trim old records
    if (metricsStore.hourlyUsage.length > MAX_HOURLY_RECORDS) {
      metricsStore.hourlyUsage = metricsStore.hourlyUsage.slice(
        -MAX_HOURLY_RECORDS
      )
    }
  }

  // Update the record
  const prevTotal = currentHour.calls * currentHour.avgResponseTimeMs
  currentHour.calls += data.calls
  currentHour.errors += data.errors
  currentHour.costUsd += data.costUsd
  // Guard against division by zero
  currentHour.avgResponseTimeMs =
    currentHour.calls > 0
      ? (prevTotal + data.responseTimeMs) / currentHour.calls
      : 0
}

/**
 * Get current metrics snapshot
 */
export function getMetrics(): ParallelMetrics {
  return { ...metricsStore }
}

/**
 * Reset metrics (typically done daily or on demand)
 */
export function resetMetrics(): void {
  metricsStore = createEmptyMetrics()
  responseTimes = []
}

/**
 * Get metrics for a specific time range
 */
export function getMetricsForPeriod(
  startHour: Date,
  endHour: Date
): {
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  totalCostUsd: number
  avgResponseTimeMs: number
} {
  const startIso = new Date(
    startHour.getFullYear(),
    startHour.getMonth(),
    startHour.getDate(),
    startHour.getHours()
  ).toISOString()

  const endIso = new Date(
    endHour.getFullYear(),
    endHour.getMonth(),
    endHour.getDate(),
    endHour.getHours()
  ).toISOString()

  const relevantHours = metricsStore.hourlyUsage.filter(
    (h) => h.hour >= startIso && h.hour <= endIso
  )

  if (relevantHours.length === 0) {
    return {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalCostUsd: 0,
      avgResponseTimeMs: 0,
    }
  }

  const totalCalls = relevantHours.reduce((sum, h) => sum + h.calls, 0)
  const totalErrors = relevantHours.reduce((sum, h) => sum + h.errors, 0)
  const totalCostUsd = relevantHours.reduce((sum, h) => sum + h.costUsd, 0)
  // Guard against division by zero
  const avgResponseTimeMs =
    totalCalls > 0
      ? relevantHours.reduce((sum, h) => sum + h.avgResponseTimeMs * h.calls, 0) / totalCalls
      : 0

  return {
    totalCalls,
    successfulCalls: totalCalls - totalErrors,
    failedCalls: totalErrors,
    totalCostUsd,
    avgResponseTimeMs,
  }
}

// ============================================================================
// COST COMPARISON
// ============================================================================

/**
 * Calculate cost savings compared to legacy stack
 */
export function calculateCostSavings(): {
  parallelCost: number
  estimatedLegacyCost: number
  savingsUsd: number
  savingsPercent: number
} {
  const parallelCost = metricsStore.totalCostUsd

  // Legacy costs would have been:
  // - LinkUp: $0.055 per search (deep mode)
  // - Perplexity: $0.04 per search (Sonar Pro)
  // Total: $0.095 per search
  const searchCalls = metricsStore.callsByEndpoint.search
  const estimatedLegacyCost = searchCalls * 0.095

  const savingsUsd = estimatedLegacyCost - parallelCost
  const savingsPercent =
    estimatedLegacyCost > 0 ? (savingsUsd / estimatedLegacyCost) * 100 : 0

  return {
    parallelCost,
    estimatedLegacyCost,
    savingsUsd,
    savingsPercent,
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export interface HealthStatus {
  healthy: boolean
  errorRate: number
  avgResponseTimeMs: number
  circuitBreakerStatus: "closed" | "open" | "half_open"
  recentErrors: ParallelErrorCode[]
  warnings: string[]
}

/**
 * Get health status based on recent metrics
 */
export function getHealthStatus(): HealthStatus {
  const warnings: string[] = []

  // Calculate error rate from last hour
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const recentMetrics = getMetricsForPeriod(oneHourAgo, now)

  const errorRate =
    recentMetrics.totalCalls > 0
      ? recentMetrics.failedCalls / recentMetrics.totalCalls
      : 0

  // Get recent error types
  const recentErrors = Object.entries(metricsStore.errorsByType)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([code]) => code as ParallelErrorCode)

  // Determine circuit breaker status (simplified - actual status comes from circuit breaker)
  let circuitBreakerStatus: "closed" | "open" | "half_open" = "closed"
  if (errorRate > 0.5) {
    circuitBreakerStatus = "open"
    warnings.push("High error rate detected - circuit breaker may be open")
  } else if (errorRate > 0.2) {
    circuitBreakerStatus = "half_open"
    warnings.push("Elevated error rate - monitoring closely")
  }

  // Check response times
  if (recentMetrics.avgResponseTimeMs > 10000) {
    warnings.push("High average response times detected")
  }

  // Determine overall health
  const healthy =
    errorRate < 0.2 &&
    recentMetrics.avgResponseTimeMs < 15000 &&
    circuitBreakerStatus === "closed"

  return {
    healthy,
    errorRate,
    avgResponseTimeMs: recentMetrics.avgResponseTimeMs,
    circuitBreakerStatus,
    recentErrors,
    warnings,
  }
}

// ============================================================================
// LOGGING
// ============================================================================

export interface LogEntry {
  timestamp: string
  endpoint: string
  duration: number
  success: boolean
  errorCode?: ParallelErrorCode
  costUsd?: number
  userId?: string
  chatId?: string
}

const recentLogs: LogEntry[] = []
const MAX_LOG_ENTRIES = 100

/**
 * Log an API call (for debugging/audit)
 */
export function logApiCall(entry: Omit<LogEntry, "timestamp">): void {
  recentLogs.push({
    ...entry,
    timestamp: new Date().toISOString(),
  })

  // Trim old entries
  if (recentLogs.length > MAX_LOG_ENTRIES) {
    recentLogs.shift()
  }
}

/**
 * Get recent logs
 */
export function getRecentLogs(limit = 20): LogEntry[] {
  return recentLogs.slice(-limit)
}

// ============================================================================
// CONVENIENCE WRAPPERS
// ============================================================================

/**
 * Track a search call end-to-end
 */
export function trackSearchCall(
  startTime: number,
  result: SearchResult | null,
  error: { code: ParallelErrorCode } | null,
  metadata?: { userId?: string; chatId?: string }
): void {
  const endTime = Date.now()
  const duration = endTime - startTime

  if (result && !error) {
    const costUsd = estimateSearchCost(result)
    recordSuccess({
      endpoint: "search",
      startTime,
      endTime,
      costUsd,
      success: true,
      resultCount: result.results.length,
      ...metadata,
    })
    logApiCall({
      endpoint: "search",
      duration,
      success: true,
      costUsd,
      ...metadata,
    })
  } else if (error) {
    recordFailure({
      endpoint: "search",
      startTime,
      endTime,
      errorCode: error.code,
      success: false,
      ...metadata,
    })
    logApiCall({
      endpoint: "search",
      duration,
      success: false,
      errorCode: error.code,
      ...metadata,
    })
  }
}

/**
 * Track an extract call end-to-end
 */
export function trackExtractCall(
  startTime: number,
  result: ExtractResponse | null,
  error: { code: ParallelErrorCode } | null,
  metadata?: { userId?: string; chatId?: string }
): void {
  const endTime = Date.now()
  const duration = endTime - startTime

  if (result && !error) {
    const costUsd = estimateExtractCost(result)
    recordSuccess({
      endpoint: "extract",
      startTime,
      endTime,
      costUsd,
      success: true,
      resultCount: result.results.length,
      ...metadata,
    })
    logApiCall({
      endpoint: "extract",
      duration,
      success: true,
      costUsd,
      ...metadata,
    })
  } else if (error) {
    recordFailure({
      endpoint: "extract",
      startTime,
      endTime,
      errorCode: error.code,
      success: false,
      ...metadata,
    })
    logApiCall({
      endpoint: "extract",
      duration,
      success: false,
      errorCode: error.code,
      ...metadata,
    })
  }
}
