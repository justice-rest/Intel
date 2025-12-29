/**
 * Parallel AI Health Check Endpoint
 *
 * Provides detailed health status for the Parallel integration including:
 * - Feature flag status
 * - Circuit breaker states
 * - Usage metrics and costs
 * - Error rates and recent failures
 *
 * SECURITY: Sensitive metrics require authorization via:
 * - HEALTH_CHECK_SECRET header (for monitoring tools)
 * - Or admin session (future implementation)
 *
 * @see /lib/parallel/client.ts
 * @see /lib/parallel/monitoring.ts
 */

import { NextResponse } from "next/server"
import { getParallelStatus } from "@/lib/parallel/client"
import { getTaskApiStatus } from "@/lib/parallel/task-api"
import { getTaskGroupsStatus } from "@/lib/parallel/task-groups"
import { getFindAllStatus } from "@/lib/parallel/findall"
import {
  getMetrics,
  getHealthStatus,
  calculateCostSavings,
  getRecentLogs,
} from "@/lib/parallel/monitoring"
import {
  getParallelFlagStatus,
  getUserRolloutStatus,
} from "@/lib/feature-flags/parallel-migration"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Verify authorization for accessing detailed health metrics
 *
 * Accepts either:
 * - X-Health-Check-Secret header matching HEALTH_CHECK_SECRET env var
 * - Authorization: Bearer <HEALTH_CHECK_SECRET>
 *
 * @returns true if authorized, false otherwise
 */
function isAuthorized(request: Request): boolean {
  const healthSecret = process.env.HEALTH_CHECK_SECRET

  // If no secret is configured, allow access (development mode)
  // In production, HEALTH_CHECK_SECRET should always be set
  if (!healthSecret) {
    // Only allow in development
    if (process.env.NODE_ENV === "production") {
      return false
    }
    return true
  }

  // Check X-Health-Check-Secret header
  const headerSecret = request.headers.get("X-Health-Check-Secret")
  if (headerSecret && headerSecret === healthSecret) {
    return true
  }

  // Check Authorization: Bearer header
  const authHeader = request.headers.get("Authorization")
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ")
    if (scheme?.toLowerCase() === "bearer" && token === healthSecret) {
      return true
    }
  }

  return false
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const verbose = searchParams.get("verbose") === "true"
  const testUserId = searchParams.get("testUserId")

  // Check authorization for detailed/sensitive information
  const authorized = isAuthorized(request)

  // Get all status information
  const clientStatus = getParallelStatus()
  const taskApiStatus = getTaskApiStatus()
  const taskGroupsStatus = getTaskGroupsStatus()
  const findAllStatus = getFindAllStatus()
  const flagStatus = getParallelFlagStatus()
  const healthStatus = getHealthStatus()

  // Basic health response (always public - needed for load balancer health checks)
  const response: Record<string, unknown> = {
    status: healthStatus.healthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),

    // Basic availability (non-sensitive)
    parallel: {
      available: clientStatus.available,
      configured: clientStatus.configured,
      enabled: clientStatus.enabled,
    },

    // Circuit breaker states (non-sensitive)
    circuitBreakers: {
      search: clientStatus.searchCircuitOpen ? "open" : "closed",
      extract: clientStatus.extractCircuitOpen ? "open" : "closed",
      taskApi: taskApiStatus.circuitOpen ? "open" : "closed",
      taskGroups: taskGroupsStatus.circuitOpen ? "open" : "closed",
      findAll: findAllStatus.circuitOpen ? "open" : "closed",
    },

    // Task API status
    taskApi: {
      available: taskApiStatus.available,
      configured: taskApiStatus.configured,
      enabled: taskApiStatus.enabled,
    },

    // Task Groups status
    taskGroups: {
      available: taskGroupsStatus.available,
      configured: taskGroupsStatus.configured,
      enabled: taskGroupsStatus.enabled,
    },

    // FindAll status
    findAll: {
      available: findAllStatus.available,
      configured: findAllStatus.configured,
      enabled: findAllStatus.enabled,
    },
  }

  // Add detailed information only if authorized
  if (authorized) {
    const metrics = getMetrics()
    const costSavings = calculateCostSavings()

    // Add reasons (could reveal config issues)
    response.parallel = {
      ...response.parallel as object,
      reasons: clientStatus.reasons,
    }

    // Add uptime
    response.uptime = process.uptime()

    // Feature flags (sensitive - reveals rollout strategy)
    response.flags = {
      enabled: flagStatus.flags.PARALLEL_ENABLED,
      chatSearch: flagStatus.flags.PARALLEL_CHAT_SEARCH,
      batchSearch: flagStatus.flags.PARALLEL_BATCH_SEARCH,
      taskApi: flagStatus.flags.PARALLEL_TASK_API,
      extract: flagStatus.flags.PARALLEL_EXTRACT,
      findall: flagStatus.flags.PARALLEL_FINDALL,
      monitor: flagStatus.flags.PARALLEL_MONITOR,
      rolloutPercent: flagStatus.flags.PARALLEL_ROLLOUT_PERCENT,
    }

    // Health metrics (could reveal usage patterns)
    response.health = {
      errorRate: (healthStatus.errorRate * 100).toFixed(2) + "%",
      avgResponseTimeMs: Math.round(healthStatus.avgResponseTimeMs),
      warnings: healthStatus.warnings,
    }

    // Cost savings (sensitive - reveals business metrics)
    response.costs = {
      parallelCostUsd: costSavings.parallelCost.toFixed(4),
      estimatedLegacyCostUsd: costSavings.estimatedLegacyCost.toFixed(4),
      savingsUsd: costSavings.savingsUsd.toFixed(4),
      savingsPercent: costSavings.savingsPercent.toFixed(1) + "%",
    }

    // Add verbose information if requested
    if (verbose) {
      response.metrics = {
        totalCalls: metrics.totalCalls,
        successfulCalls: metrics.successfulCalls,
        failedCalls: metrics.failedCalls,
        totalCostUsd: metrics.totalCostUsd.toFixed(4),
        avgResponseTimeMs: Math.round(metrics.avgResponseTimeMs),
        callsByEndpoint: metrics.callsByEndpoint,
        costByEndpoint: Object.fromEntries(
          Object.entries(metrics.costByEndpoint).map(([k, v]) => [
            k,
            v.toFixed(4),
          ])
        ),
        errorsByType: metrics.errorsByType,
        periodStartAt: metrics.periodStartAt,
      }

      response.recentLogs = getRecentLogs(10)

      // Last 24 hours hourly breakdown
      response.hourlyUsage = metrics.hourlyUsage.slice(-24).map((h) => ({
        hour: h.hour,
        calls: h.calls,
        errors: h.errors,
        costUsd: h.costUsd.toFixed(4),
        avgResponseTimeMs: Math.round(h.avgResponseTimeMs),
      }))
    }

    // Add test user rollout status if requested (only when authorized)
    if (testUserId) {
      response.testUserRollout = getUserRolloutStatus(testUserId)
    }
  } else {
    // Add note about authorization for detailed metrics
    response.note = "Detailed metrics require authorization. Set X-Health-Check-Secret header."
  }

  // Return appropriate HTTP status
  const httpStatus = healthStatus.healthy ? 200 : 503

  return NextResponse.json(response, { status: httpStatus })
}
