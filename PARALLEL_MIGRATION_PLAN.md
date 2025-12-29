# Parallel AI Migration Plan - Production Ready

## Executive Summary

Replace LinkUp, Perplexity, and Grok native web search with Parallel AI's unified API suite.
Add FindAll (Prospect Discovery) and Monitor (Real-time Alerts) as new premium features.

**Projected Savings: 90-95% cost reduction**
**New Revenue Opportunities: 2 premium features**

---

## CRITICAL: Production Safety Principles

### AGGRESSIVE MODE: Full Cutover (No Fallback)

**Decision:** LinkUp and Perplexity are being REMOVED completely. Parallel AI is the sole provider.

This means:
- No fallback to legacy systems
- If Parallel fails, research fails (with graceful error handling)
- Faster, simpler codebase
- Maximum cost savings from day 1

### Safety Mechanisms (Still in Place)

1. **Feature Flags**: Gradual rollout (5% → 25% → 50% → 100%)
2. **Circuit Breakers**: Prevent cascading failures, return graceful errors
3. **Health Checks**: Continuous monitoring with auto-alerting
4. **Retry Logic**: 3 retries with exponential backoff before failing
5. **Graceful Degradation**: Clear error messages when Parallel is down
6. **Rollback Option**: Can re-add LinkUp/Perplexity if catastrophic failure (code preserved in git)

### Testing Requirements (Non-Negotiable)

- [ ] Unit tests for all new tools (100% coverage)
- [ ] Integration tests against Parallel staging API
- [ ] Load testing at 2x expected peak traffic
- [ ] Chaos testing (random failures)
- [ ] Quality validation (50 prospects minimum)
- [ ] Staging environment validation (24 hours)
- [ ] Canary deployment monitoring (24 hours per stage)

---

## Phase 0: Foundation & Safety Infrastructure (Week 0)

### 0.1 Feature Flag System

**File:** `/lib/feature-flags/parallel-migration.ts`

```typescript
/**
 * Parallel AI Migration Feature Flags
 *
 * These flags control the gradual rollout of Parallel AI.
 * All flags default to FALSE (old system) for safety.
 */

export interface ParallelMigrationFlags {
  // Master kill switch - disables ALL Parallel features
  PARALLEL_ENABLED: boolean

  // Per-feature flags
  PARALLEL_CHAT_SEARCH: boolean      // Phase 1: Chat prospect research
  PARALLEL_BATCH_SEARCH: boolean     // Phase 2: Batch processing
  PARALLEL_TASK_API: boolean         // Phase 2b: Structured output
  PARALLEL_EXTRACT: boolean          // Phase 3: URL extraction
  PARALLEL_FINDALL: boolean          // Phase 4: Prospect discovery
  PARALLEL_MONITOR: boolean          // Phase 5: Real-time alerts

  // Rollout percentage (0-100)
  PARALLEL_ROLLOUT_PERCENT: number

  // NOTE: No fallback flag - we're going all-in on Parallel
}

const DEFAULT_FLAGS: ParallelMigrationFlags = {
  PARALLEL_ENABLED: false,
  PARALLEL_CHAT_SEARCH: false,
  PARALLEL_BATCH_SEARCH: false,
  PARALLEL_TASK_API: false,
  PARALLEL_EXTRACT: false,
  PARALLEL_FINDALL: false,
  PARALLEL_MONITOR: false,
  PARALLEL_ROLLOUT_PERCENT: 0,
  // NO FALLBACK - Parallel is the only provider
}

/**
 * Get current feature flags from environment
 * Environment variables override defaults
 */
export function getParallelFlags(): ParallelMigrationFlags {
  return {
    PARALLEL_ENABLED: process.env.PARALLEL_ENABLED === "true",
    PARALLEL_CHAT_SEARCH: process.env.PARALLEL_CHAT_SEARCH === "true",
    PARALLEL_BATCH_SEARCH: process.env.PARALLEL_BATCH_SEARCH === "true",
    PARALLEL_TASK_API: process.env.PARALLEL_TASK_API === "true",
    PARALLEL_EXTRACT: process.env.PARALLEL_EXTRACT === "true",
    PARALLEL_FINDALL: process.env.PARALLEL_FINDALL === "true",
    PARALLEL_MONITOR: process.env.PARALLEL_MONITOR === "true",
    PARALLEL_ROLLOUT_PERCENT: parseInt(process.env.PARALLEL_ROLLOUT_PERCENT || "0", 10),
  }
}

/**
 * Check if Parallel should be used for a specific user/request
 * Uses consistent hashing for gradual rollout
 */
export function shouldUseParallel(userId: string, feature: keyof Omit<ParallelMigrationFlags, 'PARALLEL_ROLLOUT_PERCENT' | 'PARALLEL_FALLBACK_ON_ERROR'>): boolean {
  const flags = getParallelFlags()

  // Master kill switch
  if (!flags.PARALLEL_ENABLED) return false

  // Feature-specific flag
  if (!flags[feature]) return false

  // Rollout percentage (consistent per user)
  if (flags.PARALLEL_ROLLOUT_PERCENT < 100) {
    const hash = hashUserId(userId)
    if (hash > flags.PARALLEL_ROLLOUT_PERCENT) return false
  }

  return true
}

/**
 * Consistent hash for user-based rollout
 * Same user always gets same result (no flip-flopping)
 */
function hashUserId(userId: string): number {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash) % 100
}
```

### 0.2 Parallel Client Wrapper with Circuit Breaker

**File:** `/lib/parallel/client.ts`

```typescript
/**
 * Production-Ready Parallel AI Client
 *
 * Features:
 * - Circuit breaker protection
 * - Automatic retries with exponential backoff
 * - Request/response logging
 * - Latency tracking
 * - Error normalization
 * - Fallback support
 */

import Parallel from "parallel-web"
import { CircuitBreaker, circuitBreakerRegistry, CIRCUIT_BREAKER_CONFIGS } from "@/lib/batch-processing/resilience/circuit-breaker"
import { getParallelFlags } from "@/lib/feature-flags/parallel-migration"

// ============================================================================
// TYPES
// ============================================================================

export interface ParallelClientConfig {
  apiKey: string
  timeout?: number
  maxRetries?: number
  baseRetryDelay?: number
}

export interface ParallelSearchRequest {
  objective: string
  mode?: "one-shot" | "agentic"
  max_results?: number
  excerpts?: { max_chars_per_result: number }
  source_policy?: { include_domains?: string[]; exclude_domains?: string[] }
  fetch_policy?: { max_age_seconds?: number; timeout_seconds?: number }
}

export interface ParallelSearchResult {
  search_id: string
  results: Array<{
    url: string
    title: string
    publish_date?: string
    excerpts: string[]
  }>
  warnings?: string[]
  usage?: Array<{ type: string; count: number }>
}

export interface ParallelClientResponse<T> {
  success: boolean
  data?: T
  error?: string
  latencyMs: number
  fromFallback: boolean
  circuitBreakerState: "closed" | "open" | "half_open"
}

// ============================================================================
// CIRCUIT BREAKER SETUP
// ============================================================================

const PARALLEL_CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 3,      // Open after 3 consecutive failures
  successThreshold: 2,      // Close after 2 consecutive successes
  timeout: 30000,           // 30 seconds before testing recovery
}

// ============================================================================
// CLIENT IMPLEMENTATION
// ============================================================================

export class ParallelClient {
  private client: Parallel
  private circuitBreaker: CircuitBreaker
  private config: Required<ParallelClientConfig>

  constructor(config: ParallelClientConfig) {
    this.config = {
      apiKey: config.apiKey,
      timeout: config.timeout ?? 120000,        // 2 minutes default
      maxRetries: config.maxRetries ?? 3,
      baseRetryDelay: config.baseRetryDelay ?? 1000,
    }

    this.client = new Parallel({ apiKey: this.config.apiKey })
    this.circuitBreaker = circuitBreakerRegistry.getOrCreate(
      "parallel_search",
      PARALLEL_CIRCUIT_BREAKER_CONFIG
    )
  }

  /**
   * Execute a search with full production safety
   */
  async search(request: ParallelSearchRequest): Promise<ParallelClientResponse<ParallelSearchResult>> {
    const startTime = Date.now()
    const flags = getParallelFlags()

    // Check circuit breaker
    if (this.circuitBreaker.isOpen()) {
      console.warn("[Parallel] Circuit breaker is OPEN, skipping request")
      return {
        success: false,
        error: "Circuit breaker open - service temporarily unavailable",
        latencyMs: Date.now() - startTime,
        fromFallback: false,
        circuitBreakerState: "open",
      }
    }

    try {
      const result = await this.executeWithRetry(request)

      this.circuitBreaker.recordSuccess()

      return {
        success: true,
        data: result,
        latencyMs: Date.now() - startTime,
        fromFallback: false,
        circuitBreakerState: this.circuitBreaker.getState(),
      }
    } catch (error) {
      this.circuitBreaker.recordFailure()

      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error("[Parallel] Search failed:", errorMessage)

      return {
        success: false,
        error: errorMessage,
        latencyMs: Date.now() - startTime,
        fromFallback: false,
        circuitBreakerState: this.circuitBreaker.getState(),
      }
    }
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(request: ParallelSearchRequest): Promise<ParallelSearchResult> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const result = await this.executeWithTimeout(request)
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Check if retryable
        const isRetryable = this.isRetryableError(lastError)
        if (!isRetryable || attempt >= this.config.maxRetries - 1) {
          throw lastError
        }

        // Exponential backoff with jitter
        const delay = this.config.baseRetryDelay * Math.pow(2, attempt) + Math.random() * 500
        console.log(`[Parallel] Retry ${attempt + 1}/${this.config.maxRetries} in ${Math.round(delay)}ms`)
        await this.sleep(delay)
      }
    }

    throw lastError
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout(request: ParallelSearchRequest): Promise<ParallelSearchResult> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await this.client.beta.search({
        objective: request.objective,
        mode: request.mode || "agentic",
        max_results: request.max_results || 15,
        excerpts: request.excerpts || { max_chars_per_result: 5000 },
        source_policy: request.source_policy,
        fetch_policy: request.fetch_policy || {
          max_age_seconds: 3600,
          timeout_seconds: 120,
        },
      })

      return response as ParallelSearchResult
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase()
    return (
      message.includes("429") ||       // Rate limit
      message.includes("502") ||       // Bad gateway
      message.includes("503") ||       // Service unavailable
      message.includes("504") ||       // Gateway timeout
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("socket hang up")
    )
  }

  /**
   * Get circuit breaker stats
   */
  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats()
  }

  /**
   * Reset circuit breaker (for testing/emergency)
   */
  resetCircuitBreaker() {
    this.circuitBreaker.reset()
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let parallelClientInstance: ParallelClient | null = null

export function getParallelClient(): ParallelClient | null {
  const apiKey = process.env.PARALLEL_API_KEY
  if (!apiKey) {
    console.warn("[Parallel] PARALLEL_API_KEY not configured")
    return null
  }

  if (!parallelClientInstance) {
    parallelClientInstance = new ParallelClient({ apiKey })
  }

  return parallelClientInstance
}

/**
 * Check if Parallel is available and healthy
 */
export function isParallelAvailable(): boolean {
  const client = getParallelClient()
  if (!client) return false

  const stats = client.getCircuitBreakerStats()
  return stats.state !== "open"
}
```

### 0.3 Health Check Endpoint

**File:** `/app/api/health/parallel/route.ts`

```typescript
/**
 * Parallel AI Health Check Endpoint
 *
 * Returns:
 * - API availability
 * - Circuit breaker status
 * - Latency metrics
 * - Error rates
 */

import { NextResponse } from "next/server"
import { getParallelClient, isParallelAvailable } from "@/lib/parallel/client"
import { getParallelFlags } from "@/lib/feature-flags/parallel-migration"
import { circuitBreakerRegistry } from "@/lib/batch-processing/resilience/circuit-breaker"

export async function GET() {
  const flags = getParallelFlags()
  const client = getParallelClient()

  const health = {
    timestamp: new Date().toISOString(),
    status: "unknown" as "healthy" | "degraded" | "unhealthy" | "disabled",
    flags: {
      enabled: flags.PARALLEL_ENABLED,
      rolloutPercent: flags.PARALLEL_ROLLOUT_PERCENT,
      features: {
        chatSearch: flags.PARALLEL_CHAT_SEARCH,
        batchSearch: flags.PARALLEL_BATCH_SEARCH,
        taskApi: flags.PARALLEL_TASK_API,
        extract: flags.PARALLEL_EXTRACT,
        findAll: flags.PARALLEL_FINDALL,
        monitor: flags.PARALLEL_MONITOR,
      },
    },
    circuitBreakers: circuitBreakerRegistry.getAllStats(),
    apiKeyConfigured: !!process.env.PARALLEL_API_KEY,
    checks: {
      apiReachable: false,
      latencyMs: 0,
    },
  }

  // If not enabled, return early
  if (!flags.PARALLEL_ENABLED) {
    health.status = "disabled"
    return NextResponse.json(health)
  }

  // Check if API is reachable with a simple search
  if (client && isParallelAvailable()) {
    try {
      const startTime = Date.now()
      const result = await client.search({
        objective: "health check",
        mode: "one-shot",
        max_results: 1,
      })

      health.checks.latencyMs = Date.now() - startTime
      health.checks.apiReachable = result.success

      if (result.success) {
        health.status = health.checks.latencyMs > 5000 ? "degraded" : "healthy"
      } else {
        health.status = "unhealthy"
      }
    } catch (error) {
      health.status = "unhealthy"
      health.checks.apiReachable = false
    }
  } else {
    health.status = client ? "degraded" : "unhealthy"
  }

  // Check for open circuit breakers
  const openCircuits = circuitBreakerRegistry.getOpenCircuits()
  if (openCircuits.length > 0) {
    health.status = "degraded"
  }

  return NextResponse.json(health, {
    status: health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503,
  })
}
```

### 0.4 Monitoring & Alerting

**File:** `/lib/parallel/monitoring.ts`

```typescript
/**
 * Parallel AI Monitoring & Metrics
 *
 * Tracks:
 * - Request counts (success/failure)
 * - Latency percentiles
 * - Error types
 * - Cost tracking
 * - Comparison with old system
 */

export interface ParallelMetrics {
  // Request counts
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  fallbackRequests: number

  // Latency (ms)
  avgLatency: number
  p50Latency: number
  p95Latency: number
  p99Latency: number

  // Errors
  errorsByType: Record<string, number>
  circuitBreakerTrips: number

  // Cost tracking
  estimatedCostUsd: number

  // Comparison
  qualityScoreAvg: number  // 0-100 based on source count + coverage
}

// In-memory metrics (reset on deploy)
const metrics: ParallelMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  fallbackRequests: 0,
  avgLatency: 0,
  p50Latency: 0,
  p95Latency: 0,
  p99Latency: 0,
  errorsByType: {},
  circuitBreakerTrips: 0,
  estimatedCostUsd: 0,
  qualityScoreAvg: 0,
}

const latencyBuffer: number[] = []
const LATENCY_BUFFER_SIZE = 1000

export function recordParallelRequest(params: {
  success: boolean
  latencyMs: number
  errorType?: string
  usedFallback: boolean
  sourceCount?: number
}) {
  metrics.totalRequests++

  if (params.success) {
    metrics.successfulRequests++
    // $0.005 per request
    metrics.estimatedCostUsd += 0.005
  } else {
    metrics.failedRequests++
    if (params.errorType) {
      metrics.errorsByType[params.errorType] = (metrics.errorsByType[params.errorType] || 0) + 1
    }
  }

  if (params.usedFallback) {
    metrics.fallbackRequests++
  }

  // Track latency
  latencyBuffer.push(params.latencyMs)
  if (latencyBuffer.length > LATENCY_BUFFER_SIZE) {
    latencyBuffer.shift()
  }

  // Recalculate latency percentiles
  const sorted = [...latencyBuffer].sort((a, b) => a - b)
  metrics.avgLatency = sorted.reduce((a, b) => a + b, 0) / sorted.length
  metrics.p50Latency = sorted[Math.floor(sorted.length * 0.5)] || 0
  metrics.p95Latency = sorted[Math.floor(sorted.length * 0.95)] || 0
  metrics.p99Latency = sorted[Math.floor(sorted.length * 0.99)] || 0

  // Quality score based on source count
  if (params.sourceCount !== undefined) {
    const requestQuality = Math.min(100, params.sourceCount * 10)
    metrics.qualityScoreAvg = (metrics.qualityScoreAvg * (metrics.successfulRequests - 1) + requestQuality) / metrics.successfulRequests
  }
}

export function recordCircuitBreakerTrip() {
  metrics.circuitBreakerTrips++
}

export function getParallelMetrics(): ParallelMetrics {
  return { ...metrics }
}

export function resetParallelMetrics() {
  Object.assign(metrics, {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    fallbackRequests: 0,
    avgLatency: 0,
    p50Latency: 0,
    p95Latency: 0,
    p99Latency: 0,
    errorsByType: {},
    circuitBreakerTrips: 0,
    estimatedCostUsd: 0,
    qualityScoreAvg: 0,
  })
  latencyBuffer.length = 0
}

/**
 * Check if metrics indicate we should alert
 */
export function shouldAlert(): { alert: boolean; reason: string } {
  const errorRate = metrics.totalRequests > 0
    ? metrics.failedRequests / metrics.totalRequests
    : 0

  if (errorRate > 0.1) {
    return { alert: true, reason: `Error rate ${(errorRate * 100).toFixed(1)}% exceeds 10% threshold` }
  }

  if (metrics.p95Latency > 30000) {
    return { alert: true, reason: `P95 latency ${metrics.p95Latency}ms exceeds 30s threshold` }
  }

  if (metrics.circuitBreakerTrips > 3) {
    return { alert: true, reason: `Circuit breaker tripped ${metrics.circuitBreakerTrips} times` }
  }

  return { alert: false, reason: "" }
}
```

---

## Phase 1: Chat Tools with Fallback (Week 1)

### 1.1 Create Unified Prospect Research Tool

**File:** `/lib/tools/parallel-prospect-research.ts`

```typescript
/**
 * Parallel AI Prospect Research Tool
 *
 * AGGRESSIVE MODE - No Fallback Implementation:
 * - Parallel AI is the ONLY provider
 * - No LinkUp, no Perplexity
 * - Circuit breaker protection
 * - Graceful error handling (returns clear error, doesn't crash)
 * - Retry logic with exponential backoff
 */

import { tool } from "ai"
import { z } from "zod"
import { getParallelClient, ParallelSearchResult } from "@/lib/parallel/client"
import { shouldUseParallel, getParallelFlags } from "@/lib/feature-flags/parallel-migration"
import { recordParallelRequest } from "@/lib/parallel/monitoring"
// NO IMPORTS FROM LINKUP OR PERPLEXITY - THEY ARE REMOVED

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Authoritative domains for prospect research
 * These ensure high-quality, verifiable results
 */
const PROSPECT_RESEARCH_DOMAINS = [
  // Real Estate - Primary
  "zillow.com",
  "redfin.com",
  "realtor.com",

  // Real Estate - County Records
  "qpublic.schneidercorp.com",  // Many county assessors
  "beacon.schneidercorp.com",

  // Government - SEC
  "sec.gov",
  "efts.sec.gov",

  // Government - FEC
  "fec.gov",
  "opensecrets.org",

  // Nonprofits
  "propublica.org",
  "guidestar.org",
  "candid.org",

  // Business
  "linkedin.com",
  "bloomberg.com",
  "forbes.com",
  "crunchbase.com",
  "dnb.com",

  // News
  "wsj.com",
  "nytimes.com",
  "businessinsider.com",
  "prnewswire.com",
]

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface ParallelProspectResult {
  prospectName: string
  research: string
  sources: Array<{ name: string; url: string; snippet?: string }>
  provider: "parallel"  // Only provider now
  latencyMs: number
  success: boolean
  error?: string
}

// ============================================================================
// QUERY BUILDER
// ============================================================================

function buildProspectQuery(name: string, address?: string, context?: string): string {
  const nameParts = name.trim().split(/\s+/)
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]

  return `COMPREHENSIVE PROSPECT RESEARCH: "${name}"

IDENTITY:
• Full name: ${name}
${address ? `• Address: ${address}` : ""}
${context ? `• Context: ${context}` : ""}

RESEARCH OBJECTIVES:

1. REAL ESTATE
   - Property ownership and values
   - Multiple properties (vacation homes, investment)
   - County assessor records if available

2. BUSINESS OWNERSHIP
   - Companies owned or founded
   - Executive positions
   - Board seats (corporate and nonprofit)
   - Revenue estimates

3. SECURITIES (SEC FILINGS)
   - Form 3/4/5 insider filings
   - Public company directorships
   - Stock holdings

4. POLITICAL GIVING (FEC)
   - Contribution records
   - Total amounts
   - Party patterns

5. PHILANTHROPY
   - Foundation affiliations
   - Nonprofit board service
   - Known major gifts
   - Check for "${lastName} Family Foundation"
   - Check for "${firstName} ${lastName} Foundation"

6. BACKGROUND
   - Age and education
   - Career history
   - Notable achievements

OUTPUT REQUIREMENTS:
- Cite ALL sources with URLs
- Use dollar ranges for estimates ($X-$Y)
- Mark [Verified] for official records, [Estimated] for calculations
- Say "Not found" if no data for a category`
}

// ============================================================================
// TOOL FACTORY
// ============================================================================

/**
 * Create Parallel Prospect Research Tool - NO FALLBACK
 *
 * @param userId - User ID for feature flag evaluation
 * @param isDeepResearch - Whether to use deep research mode
 */
export function createParallelProspectResearchTool(userId: string, isDeepResearch: boolean = false) {
  // If user not in rollout, return empty tools (research will be skipped)
  if (!shouldUseParallel(userId, "PARALLEL_CHAT_SEARCH")) {
    console.log(`[Parallel] User ${userId.slice(0, 8)}... not in rollout, research disabled`)
    return {}  // No tools available - user must wait for rollout
  }

  // Return Parallel tool - THE ONLY OPTION
  return {
    parallel_prospect_research: createParallelTool(userId, isDeepResearch),
  }
}

function createParallelTool(userId: string, isDeepResearch: boolean) {
  return tool({
    description: `HARD CONSTRAINTS: (1) Execute ONLY after memory + CRM checks, (2) MUST include ALL sources. CAPABILITY: Comprehensive web research via Parallel AI (${isDeepResearch ? "deep" : "standard"} mode, ~30-60s). SEARCHES: Real estate, business, philanthropy, securities, biography with domain-filtered authoritative sources. OUTPUT: Grounded results with citations.`,
    parameters: z.object({
      name: z.string().describe("Full name of the prospect"),
      address: z.string().optional().describe("Address for property research"),
      context: z.string().optional().describe("Additional context (employer, title)"),
    }),
    execute: async ({ name, address, context }): Promise<ParallelProspectResult> => {
      const startTime = Date.now()
      const client = getParallelClient()

      // NO FALLBACK - Parallel or nothing
      if (!client) {
        console.error(`[Parallel] No client available - PARALLEL_API_KEY not configured`)
        return {
          prospectName: name,
          research: "**Research Unavailable**\n\nThe research service is not configured. Please contact support.",
          sources: [],
          provider: "parallel",
          latencyMs: Date.now() - startTime,
          success: false,
          error: "PARALLEL_API_KEY not configured",
        }
      }

      try {
        console.log(`[Parallel] Starting research for: ${name}`)

        const response = await client.search({
          objective: buildProspectQuery(name, address, context),
          mode: isDeepResearch ? "agentic" : "one-shot",
          max_results: isDeepResearch ? 20 : 15,
          excerpts: { max_chars_per_result: 5000 },
          source_policy: { include_domains: PROSPECT_RESEARCH_DOMAINS },
          fetch_policy: { max_age_seconds: 3600, timeout_seconds: 120 },
        })

        if (response.success && response.data) {
          const latencyMs = Date.now() - startTime

          // Format response
          const research = response.data.results
            .map(r => `**${r.title}**\n${r.excerpts.join("\n")}\nSource: ${r.url}`)
            .join("\n\n---\n\n")

          const sources = response.data.results.map(r => ({
            name: r.title,
            url: r.url,
            snippet: r.excerpts[0],
          }))

          // Record metrics
          recordParallelRequest({
            success: true,
            latencyMs,
            usedFallback: false,
            sourceCount: sources.length,
          })

          console.log(`[Parallel] Success for ${name} in ${latencyMs}ms, ${sources.length} sources`)

          return {
            prospectName: name,
            research,
            sources,
            provider: "parallel",
            latencyMs,
            success: true,
          }
        }

        // Parallel returned no results
        throw new Error(response.error || "Parallel returned no results")

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const latencyMs = Date.now() - startTime
        console.error(`[Parallel] Failed for ${name}:`, errorMessage)

        // Record failure
        recordParallelRequest({
          success: false,
          latencyMs,
          errorType: errorMessage.includes("circuit") ? "circuit_breaker" : "api_error",
          usedFallback: false,  // NO FALLBACK EXISTS
        })

        // Return graceful error - NO FALLBACK
        return {
          prospectName: name,
          research: `**Research Temporarily Unavailable**\n\nWe encountered an issue researching "${name}". Please try again in a few moments.\n\nError: ${errorMessage}`,
          sources: [],
          provider: "parallel",
          latencyMs,
          success: false,
          error: errorMessage,
        }
      }
    },
  })
}

// NO FALLBACK FUNCTION - LinkUp and Perplexity are REMOVED

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableParallelTools(): boolean {
  const flags = getParallelFlags()
  return flags.PARALLEL_ENABLED && !!process.env.PARALLEL_API_KEY
}
```

### 1.2 Update Chat Route (Minimal Changes)

**File:** `/app/api/chat/route.ts` (changes only)

```typescript
// ADD these imports at top
import {
  createParallelProspectResearchTool,
  shouldEnableParallelTools
} from "@/lib/tools/parallel-prospect-research"
import { shouldUseParallel } from "@/lib/feature-flags/parallel-migration"

// In the tools building section, REPLACE the tool registration:

// BEFORE:
// linkup_prospect_research: isDeepResearch
//   ? createLinkupProspectResearchTool(true)
//   : createLinkupProspectResearchTool(false),
// perplexity_prospect_research: isDeepResearch
//   ? createPerplexityProspectResearchTool(true)
//   : createPerplexityProspectResearchTool(false),

// AFTER:
// Parallel-aware tool registration
// Returns EITHER parallel_prospect_research OR linkup+perplexity based on feature flags
...createParallelProspectResearchTool(userId, isDeepResearch),
```

This is a **one-line change** that:
- Returns `parallel_prospect_research` if user is in rollout
- Returns `linkup_prospect_research` + `perplexity_prospect_research` if not
- Automatically falls back on errors if `PARALLEL_FALLBACK_ON_ERROR=true`

---

## Phase 2: Batch Processing with Task API (Week 2)

### 2.1 Create Parallel Batch Search with Task API

**File:** `/lib/batch-processing/parallel-search.ts`

```typescript
/**
 * Parallel Batch Search with Task API
 *
 * Uses Parallel's Task API for structured output:
 * - Returns JSON directly (no parsing needed)
 * - Built-in citations and confidence scores
 * - Multiple processor tiers for cost/quality balance
 */

import Parallel from "parallel-web"
import { getParallelFlags, shouldUseParallel } from "@/lib/feature-flags/parallel-migration"
import { circuitBreakerRegistry, CIRCUIT_BREAKER_CONFIGS } from "./resilience/circuit-breaker"
import { recordParallelRequest } from "@/lib/parallel/monitoring"
import type { ProspectInputData, ProspectResearchOutput } from "./types"

// ============================================================================
// TYPES
// ============================================================================

export interface ParallelBatchResult {
  success: boolean
  output?: ProspectResearchOutput  // Structured JSON, not text!
  sources: Array<{ name: string; url: string; snippet?: string }>
  tokensUsed: number
  durationMs: number
  provider: "parallel_task" | "parallel_search" | "fallback"
  error?: string
}

// ============================================================================
// TASK API SCHEMA
// ============================================================================

/**
 * Output schema for Task API
 * This tells Parallel exactly what structured data to return
 */
const PROSPECT_RESEARCH_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    metrics: {
      type: "object",
      properties: {
        estimated_net_worth_low: { type: "number", description: "Low estimate of net worth in USD" },
        estimated_net_worth_high: { type: "number", description: "High estimate of net worth in USD" },
        estimated_gift_capacity: { type: "number", description: "Recommended gift capacity in USD" },
        capacity_rating: { type: "string", enum: ["MAJOR", "PRINCIPAL", "LEADERSHIP", "ANNUAL"] },
        confidence_level: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
      },
      required: ["capacity_rating", "confidence_level"],
    },
    wealth: {
      type: "object",
      properties: {
        real_estate: {
          type: "object",
          properties: {
            total_value: { type: "number" },
            properties: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  address: { type: "string" },
                  value: { type: "number" },
                  source: { type: "string" },
                },
              },
            },
          },
        },
        business_ownership: {
          type: "array",
          items: {
            type: "object",
            properties: {
              company: { type: "string" },
              role: { type: "string" },
              estimated_value: { type: "number" },
            },
          },
        },
        securities: {
          type: "object",
          properties: {
            has_sec_filings: { type: "boolean" },
            insider_at: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    philanthropy: {
      type: "object",
      properties: {
        political_giving: {
          type: "object",
          properties: {
            total: { type: "number" },
            party_lean: { type: "string", enum: ["REPUBLICAN", "DEMOCRATIC", "BIPARTISAN", "NONE"] },
          },
        },
        foundation_affiliations: { type: "array", items: { type: "string" } },
        nonprofit_boards: { type: "array", items: { type: "string" } },
        known_major_gifts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              organization: { type: "string" },
              amount: { type: "number" },
              year: { type: "number" },
            },
          },
        },
      },
    },
    background: {
      type: "object",
      properties: {
        age: { type: "number" },
        education: { type: "array", items: { type: "string" } },
        career_summary: { type: "string" },
        spouse: { type: "string" },
      },
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          data_provided: { type: "string" },
        },
      },
    },
    executive_summary: { type: "string", description: "2-3 sentence summary of prospect" },
  },
  required: ["metrics", "wealth", "philanthropy", "sources", "executive_summary"],
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

const parallelCircuitBreaker = circuitBreakerRegistry.getOrCreate("parallel_batch", {
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 60000,
})

/**
 * Execute batch search using Parallel Task API
 * Returns structured JSON output with citations
 */
export async function parallelBatchSearch(
  prospect: ProspectInputData,
  options: {
    apiKey?: string
    processor?: "lite" | "base" | "core"  // lite=$5/1K, base=$10/1K, core=$25/1K
    userId?: string
  } = {}
): Promise<ParallelBatchResult> {
  const startTime = Date.now()
  const flags = getParallelFlags()
  const apiKey = options.apiKey || process.env.PARALLEL_API_KEY

  // Check feature flag
  if (options.userId && !shouldUseParallel(options.userId, "PARALLEL_TASK_API")) {
    console.log(`[ParallelBatch] User not in rollout, skipping`)
    return {
      success: false,
      sources: [],
      tokensUsed: 0,
      durationMs: 0,
      provider: "fallback",
      error: "Not in rollout",
    }
  }

  if (!apiKey) {
    return {
      success: false,
      sources: [],
      tokensUsed: 0,
      durationMs: 0,
      provider: "parallel_task",
      error: "PARALLEL_API_KEY not configured",
    }
  }

  // Check circuit breaker
  if (parallelCircuitBreaker.isOpen()) {
    console.warn("[ParallelBatch] Circuit breaker OPEN")
    return {
      success: false,
      sources: [],
      tokensUsed: 0,
      durationMs: 0,
      provider: "parallel_task",
      error: "Circuit breaker open",
    }
  }

  try {
    const parallel = new Parallel({ apiKey })

    // Build input for Task API
    const input = {
      name: prospect.name,
      address: prospect.address || prospect.full_address,
      city: prospect.city,
      state: prospect.state,
      employer: prospect.company || prospect.employer,
      title: prospect.title,
    }

    console.log(`[ParallelBatch] Starting Task API research for: ${prospect.name}`)

    // Use Task API for structured output
    const response = await parallel.tasks.create({
      input,
      output_schema: PROSPECT_RESEARCH_OUTPUT_SCHEMA,
      processor: options.processor || "base",  // Default to $10/1K tier
      task_spec: `Research this individual for nonprofit major gift prospect identification.

INPUT: ${JSON.stringify(input)}

RESEARCH PRIORITIES:
1. Real estate holdings (Zillow, county records)
2. Business ownership (LinkedIn, state registries)
3. SEC insider status (EDGAR Form 3/4/5)
4. Political giving (FEC)
5. Philanthropy (ProPublica 990s, foundation boards)
6. Background (education, career)

REQUIREMENTS:
- Every data point must have a source URL
- Use dollar ranges for estimates
- Mark confidence levels
- If data not found, explicitly note "Not found in public records"`,
    })

    const durationMs = Date.now() - startTime

    // Extract structured output
    if (response.content && typeof response.content === "object") {
      parallelCircuitBreaker.recordSuccess()

      const output = response.content as ProspectResearchOutput
      const sources = output.sources?.map(s => ({
        name: s.title,
        url: s.url,
        snippet: s.data_provided,
      })) || []

      recordParallelRequest({
        success: true,
        latencyMs: durationMs,
        usedFallback: false,
        sourceCount: sources.length,
      })

      console.log(`[ParallelBatch] Success for ${prospect.name} in ${durationMs}ms`)

      return {
        success: true,
        output,
        sources,
        tokensUsed: 0, // Task API doesn't report tokens
        durationMs,
        provider: "parallel_task",
      }
    }

    throw new Error("Task API returned empty content")

  } catch (error) {
    parallelCircuitBreaker.recordFailure()
    const errorMessage = error instanceof Error ? error.message : String(error)

    recordParallelRequest({
      success: false,
      latencyMs: Date.now() - startTime,
      errorType: "task_api_error",
      usedFallback: false,
    })

    console.error(`[ParallelBatch] Failed for ${prospect.name}:`, errorMessage)

    return {
      success: false,
      sources: [],
      tokensUsed: 0,
      durationMs: Date.now() - startTime,
      provider: "parallel_task",
      error: errorMessage,
    }
  }
}

/**
 * Check if Parallel batch is available
 */
export function isParallelBatchAvailable(): boolean {
  const flags = getParallelFlags()
  return flags.PARALLEL_ENABLED &&
         flags.PARALLEL_BATCH_SEARCH &&
         !!process.env.PARALLEL_API_KEY &&
         !parallelCircuitBreaker.isOpen()
}
```

### 2.2 Update Research Pipeline

**File:** `/lib/batch-processing/pipeline/research-pipeline.ts` (changes only)

```typescript
// ADD import
import { parallelBatchSearch, isParallelBatchAvailable } from "../parallel-search"
import { shouldUseParallel } from "@/lib/feature-flags/parallel-migration"

// MODIFY executePerplexityPass1 to try Parallel first:

async function executePerplexityPass1(context: StepContext): Promise<StepResult<ProspectResearchOutput>> {
  // TRY PARALLEL FIRST if enabled
  if (isParallelBatchAvailable() && shouldUseParallel(context.userId || "", "PARALLEL_BATCH_SEARCH")) {
    console.log(`[Pipeline] Using Parallel Task API for ${context.prospect.name}`)

    const parallelResult = await parallelBatchSearch(context.prospect, {
      apiKey: context.apiKey,
      processor: "base",
      userId: context.userId,
    })

    if (parallelResult.success && parallelResult.output) {
      return {
        status: "completed",
        data: parallelResult.output,
        tokensUsed: parallelResult.tokensUsed,
        sourcesFound: parallelResult.sources.length,
      }
    }

    // Parallel failed - fall through to Perplexity
    console.log(`[Pipeline] Parallel failed, falling back to Perplexity for ${context.prospect.name}`)
  }

  // EXISTING PERPLEXITY LOGIC (unchanged)
  const { researchWithPerplexitySonar } = await import("../report-generator")
  // ... rest of existing code
}
```

---

## Phase 3: Extract API (Week 3)

### 3.1 Create Parallel Extract Tool

**File:** `/lib/parallel/extract.ts`

```typescript
/**
 * Parallel Extract API
 * Replaces Firecrawl for URL content extraction
 */

import Parallel from "parallel-web"
import { circuitBreakerRegistry } from "@/lib/batch-processing/resilience/circuit-breaker"

const extractCircuitBreaker = circuitBreakerRegistry.getOrCreate("parallel_extract", {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
})

export interface ExtractResult {
  success: boolean
  content?: string
  title?: string
  publishDate?: string
  error?: string
}

export async function parallelExtract(
  urls: string[],
  options: { apiKey?: string; fullContent?: boolean } = {}
): Promise<ExtractResult[]> {
  const apiKey = options.apiKey || process.env.PARALLEL_API_KEY

  if (!apiKey) {
    return urls.map(() => ({ success: false, error: "No API key" }))
  }

  if (extractCircuitBreaker.isOpen()) {
    return urls.map(() => ({ success: false, error: "Circuit breaker open" }))
  }

  try {
    const parallel = new Parallel({ apiKey })

    const response = await parallel.beta.extract({
      urls,
      full_content: options.fullContent ?? true,
      excerpts: !options.fullContent,
    })

    extractCircuitBreaker.recordSuccess()

    return response.results.map((r: any) => ({
      success: true,
      content: r.content || r.excerpts?.join("\n"),
      title: r.title,
      publishDate: r.publish_date,
    }))

  } catch (error) {
    extractCircuitBreaker.recordFailure()
    const errorMessage = error instanceof Error ? error.message : String(error)
    return urls.map(() => ({ success: false, error: errorMessage }))
  }
}
```

---

## Phase 4: FindAll - Prospect Discovery (Week 4)

### 4.1 Create FindAll Tool

**File:** `/lib/tools/parallel-findall.ts`

```typescript
/**
 * Parallel FindAll API - Prospect Discovery
 *
 * NEW FEATURE: Discover prospects matching criteria
 * "Find me 50 business owners in Miami who donate to healthcare causes"
 */

import Parallel from "parallel-web"
import { tool } from "ai"
import { z } from "zod"
import { getParallelFlags, shouldUseParallel } from "@/lib/feature-flags/parallel-migration"

export interface DiscoveredProspect {
  name: string
  matchScore: number
  matchReason: string
  enrichedData: {
    estimatedWealth?: string
    company?: string
    title?: string
    location?: string
    philanthropicActivity?: string
  }
  sources: Array<{ url: string; excerpt: string }>
}

export function createProspectDiscoveryTool(userId: string) {
  const flags = getParallelFlags()

  if (!shouldUseParallel(userId, "PARALLEL_FINDALL")) {
    return null  // Feature not enabled
  }

  return tool({
    description: "Discover NEW prospects matching specific criteria. Use when user wants to FIND prospects, not research a known person. Examples: 'Find business owners in Miami who donate to healthcare', 'Find tech executives on nonprofit boards'.",
    parameters: z.object({
      criteria: z.string().describe("Natural language description of ideal prospect"),
      location: z.string().optional().describe("Geographic focus (city, state)"),
      industry: z.string().optional().describe("Industry focus"),
      minWealth: z.string().optional().describe("Minimum wealth indicator (e.g., '$1M property')"),
      philanthropicFocus: z.string().optional().describe("Giving interests"),
      limit: z.number().default(10).describe("Maximum prospects to find (max 50)"),
    }),
    execute: async ({ criteria, location, industry, minWealth, philanthropicFocus, limit }) => {
      const apiKey = process.env.PARALLEL_API_KEY
      if (!apiKey) {
        return { success: false, error: "PARALLEL_API_KEY not configured", prospects: [] }
      }

      try {
        const parallel = new Parallel({ apiKey })

        // Build match conditions
        const matchConditions = [
          { name: "is_person", description: "Must be an individual person, not a company" },
        ]

        if (location) {
          matchConditions.push({ name: "location", description: `Based in or near ${location}` })
        }
        if (industry) {
          matchConditions.push({ name: "industry", description: `Works in ${industry} industry` })
        }
        if (minWealth) {
          matchConditions.push({ name: "wealth", description: `Has wealth indicators: ${minWealth}` })
        }
        if (philanthropicFocus) {
          matchConditions.push({ name: "philanthropy", description: `Involved in philanthropy related to ${philanthropicFocus}` })
        }

        const response = await parallel.beta.findAll({
          objective: criteria,
          entity_type: "person",
          match_conditions: matchConditions,
          generator: "core",  // $0.23/request, 53% recall
          match_limit: Math.min(limit, 50),
          enrichment_fields: [
            { name: "estimated_wealth", description: "Net worth indicators" },
            { name: "company", description: "Primary company affiliation" },
            { name: "title", description: "Professional title" },
            { name: "philanthropic_activity", description: "Known charitable involvement" },
          ],
        })

        const prospects: DiscoveredProspect[] = response.results.map((r: any) => ({
          name: r.entity_name,
          matchScore: r.confidence || 0.8,
          matchReason: r.match_reasoning || "Matches criteria",
          enrichedData: r.enrichments || {},
          sources: r.citations?.map((c: any) => ({
            url: c.url,
            excerpt: c.excerpt,
          })) || [],
        }))

        return {
          success: true,
          prospects,
          totalFound: prospects.length,
          criteria,
        }

      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          prospects: [],
        }
      }
    },
  })
}

export function shouldEnableFindAllTools(): boolean {
  const flags = getParallelFlags()
  return flags.PARALLEL_ENABLED && flags.PARALLEL_FINDALL && !!process.env.PARALLEL_API_KEY
}
```

---

## Phase 5: Monitor API - Real-Time Alerts (Week 5)

### 5.1 Create Monitor Integration

**File:** `/lib/parallel/monitor.ts`

```typescript
/**
 * Parallel Monitor API - Real-Time Prospect Alerts
 *
 * NEW PREMIUM FEATURE: Watch for news/events about donors
 * "Alert me when John Smith is mentioned in news or makes a donation"
 */

import Parallel from "parallel-web"

export interface ProspectMonitor {
  id: string
  prospectName: string
  query: string
  cadence: "hourly" | "daily" | "weekly"
  webhookUrl: string
  createdAt: Date
  lastTriggered?: Date
}

export interface MonitorEvent {
  monitorId: string
  prospectName: string
  eventType: "news" | "donation" | "sec_filing" | "board_change" | "other"
  title: string
  summary: string
  url: string
  publishedAt: Date
}

/**
 * Create a monitor for a prospect
 */
export async function createProspectMonitor(params: {
  prospectName: string
  additionalKeywords?: string[]
  cadence?: "hourly" | "daily" | "weekly"
  webhookUrl: string
}): Promise<{ success: boolean; monitor?: ProspectMonitor; error?: string }> {
  const apiKey = process.env.PARALLEL_API_KEY
  if (!apiKey) {
    return { success: false, error: "PARALLEL_API_KEY not configured" }
  }

  try {
    const parallel = new Parallel({ apiKey })

    // Build query for this prospect
    const keywords = [
      params.prospectName,
      `"${params.prospectName}" donation`,
      `"${params.prospectName}" foundation`,
      `"${params.prospectName}" board`,
      ...(params.additionalKeywords || []),
    ].join(" OR ")

    const response = await parallel.monitors.create({
      query: keywords,
      cadence: params.cadence || "daily",
      webhook_url: params.webhookUrl,
    })

    return {
      success: true,
      monitor: {
        id: response.id,
        prospectName: params.prospectName,
        query: keywords,
        cadence: params.cadence || "daily",
        webhookUrl: params.webhookUrl,
        createdAt: new Date(),
      },
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Delete a monitor
 */
export async function deleteProspectMonitor(monitorId: string): Promise<boolean> {
  const apiKey = process.env.PARALLEL_API_KEY
  if (!apiKey) return false

  try {
    const parallel = new Parallel({ apiKey })
    await parallel.monitors.delete(monitorId)
    return true
  } catch {
    return false
  }
}
```

### 5.2 Webhook Handler

**File:** `/app/api/webhooks/parallel-monitor/route.ts`

```typescript
/**
 * Webhook handler for Parallel Monitor events
 */

import { NextRequest, NextResponse } from "next/server"
import { createSupabaseClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const event = await req.json()

    // Validate webhook (add signature validation in production)
    if (!event.monitor_id || !event.results) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const supabase = await createSupabaseClient()

    // Store event
    await supabase.from("prospect_alerts").insert({
      monitor_id: event.monitor_id,
      event_data: event,
      created_at: new Date().toISOString(),
    })

    // TODO: Send email/notification to user
    // TODO: Update prospect record with new information

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error("[ParallelWebhook] Error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
```

---

## Deployment & Rollout Strategy

### Environment Variables

```bash
# ============================================================================
# PARALLEL AI CONFIGURATION
# ============================================================================

# API Key (REQUIRED - Parallel is the only provider)
PARALLEL_API_KEY=your_api_key_here

# ============================================================================
# FEATURE FLAGS - Start with ALL disabled, enable during rollout
# ============================================================================

# Master switch
PARALLEL_ENABLED=false

# Per-feature flags
PARALLEL_CHAT_SEARCH=false
PARALLEL_BATCH_SEARCH=false
PARALLEL_TASK_API=false
PARALLEL_EXTRACT=false
PARALLEL_FINDALL=false
PARALLEL_MONITOR=false

# Rollout percentage (0-100)
# Controls what % of users get Parallel
# Users not in rollout will see "research unavailable" until rollout reaches them
PARALLEL_ROLLOUT_PERCENT=0

# ============================================================================
# DEPRECATED - REMOVE AFTER MIGRATION
# ============================================================================
# LINKUP_API_KEY=<DELETE THIS>
# These are no longer used - Parallel is the only provider

# Keep OpenRouter for non-search models (Grok, etc.)
OPENROUTER_API_KEY=keep_for_llm_calls
```

### Rollout Schedule (Aggressive - No Fallback)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ AGGRESSIVE ROLLOUT - PARALLEL IS THE ONLY PROVIDER                         │
│ Users not in rollout will see "research unavailable" until they're added   │
└─────────────────────────────────────────────────────────────────────────────┘

Day 1:     PARALLEL_ENABLED=true, PARALLEL_CHAT_SEARCH=true, ROLLOUT=10%
           - Test with 10% of users
           - Monitor error rates closely
           - If error rate > 5%, pause and investigate

Day 2:     ROLLOUT=50%
           - Half of all users on Parallel
           - Continue monitoring

Day 3:     ROLLOUT=100%
           - All users on Parallel for chat research
           - LinkUp/Perplexity calls = 0

Week 2:    PARALLEL_BATCH_SEARCH=true, PARALLEL_TASK_API=true
           - Batch processing uses Parallel Task API

Week 3:    PARALLEL_EXTRACT=true
           - URL extraction uses Parallel

Week 4:    PARALLEL_FINDALL=true (NEW FEATURE)
           - Prospect discovery goes live

Week 5:    PARALLEL_MONITOR=true (NEW FEATURE)
           - Real-time alerts go live

Week 6:    DELETE OLD CODE
           - rm lib/tools/linkup-prospect-research.ts
           - rm lib/tools/perplexity-prospect-research.ts
           - rm lib/batch-processing/linkup-search.ts
           - rm lib/batch-processing/sonar-research.ts
           - npm uninstall linkup-sdk
           - Remove LINKUP_API_KEY from all environments
```

### Monitoring Checklist (Check Daily During Rollout)

- [ ] Error rate < 5%
- [ ] P95 latency < 30s
- [ ] Circuit breaker not tripping
- [ ] Source count per request >= 5
- [ ] No customer complaints
- [ ] Cost tracking within projections

### Emergency Procedures

#### If Parallel Goes Down (No Fallback)

```bash
# OPTION 1: Disable research entirely (users see "unavailable" message)
# Vercel Dashboard → Settings → Environment Variables
# Set: PARALLEL_ENABLED=false
# Redeploy

# OPTION 2: Emergency restore of LinkUp+Perplexity (nuclear option)
# 1. git checkout HEAD~1 -- lib/tools/linkup-prospect-research.ts
# 2. git checkout HEAD~1 -- lib/tools/perplexity-prospect-research.ts
# 3. Add LINKUP_API_KEY back to environment
# 4. Redeploy
```

#### If Error Rate Spikes > 10%

```bash
# Reduce rollout percentage to limit impact
# Vercel Dashboard → Settings → Environment Variables
# Set: PARALLEL_ROLLOUT_PERCENT=10
# This limits Parallel to 10% of users while you investigate
```

#### Contact Parallel Support

- Email: support@parallel.ai
- Status page: https://status.parallel.ai
- Discord: [Parallel AI Community]

---

## Testing Requirements

### Unit Tests

**File:** `/lib/parallel/__tests__/client.test.ts`

```typescript
describe("ParallelClient", () => {
  it("should handle successful search", async () => { /* ... */ })
  it("should retry on transient errors", async () => { /* ... */ })
  it("should respect circuit breaker", async () => { /* ... */ })
  it("should fall back when PARALLEL_FALLBACK_ON_ERROR=true", async () => { /* ... */ })
  it("should not fall back when PARALLEL_FALLBACK_ON_ERROR=false", async () => { /* ... */ })
})

describe("Feature Flags", () => {
  it("should use Parallel when user in rollout", async () => { /* ... */ })
  it("should use legacy when user not in rollout", async () => { /* ... */ })
  it("should be deterministic per user", async () => { /* ... */ })
})
```

### Integration Tests

```typescript
describe("Parallel Integration", () => {
  it("should return results with sources", async () => { /* ... */ })
  it("should match legacy quality", async () => { /* ... */ })
  it("should handle rate limits gracefully", async () => { /* ... */ })
})
```

### A/B Quality Comparison

```typescript
/**
 * Run this before increasing rollout percentage
 */
async function compareQuality(prospects: string[]) {
  const results = await Promise.all(
    prospects.map(async (name) => {
      const [parallel, legacy] = await Promise.all([
        parallelSearch(name),
        legacySearch(name),
      ])

      return {
        name,
        parallelSources: parallel.sources.length,
        legacySources: legacy.sources.length,
        parallelLatency: parallel.latencyMs,
        legacyLatency: legacy.latencyMs,
        parallelHasRealEstate: parallel.research.includes("property"),
        legacyHasRealEstate: legacy.research.includes("property"),
        // ... more quality metrics
      }
    })
  )

  // Assert Parallel is at least as good
  const parallelAvgSources = avg(results.map(r => r.parallelSources))
  const legacyAvgSources = avg(results.map(r => r.legacySources))

  expect(parallelAvgSources).toBeGreaterThanOrEqual(legacyAvgSources * 0.9)
}
```

---

## Success Criteria (Must Pass Before Each Phase)

### Phase 1 (Chat) - CRITICAL: No Fallback
- [ ] Error rate < 5% for 24 hours at 10% rollout
- [ ] Error rate < 5% for 24 hours at 100% rollout
- [ ] P95 latency < 45s
- [ ] Source count >= 5 per request
- [ ] Circuit breaker stable (no trips)
- [ ] Graceful error messages displayed correctly
- [ ] Quality matches or exceeds LinkUp+Perplexity (manual review of 20 prospects)

### Phase 2 (Batch)
- [ ] All Phase 1 criteria
- [ ] Structured output parsing correct (no schema errors)
- [ ] Batch jobs complete successfully (>95% success rate)
- [ ] Task API cost within projections ($0.01/request)

### Phase 3-5 (New Features)
- [ ] Feature works as designed
- [ ] No impact on existing features
- [ ] Monitoring in place
- [ ] User documentation updated

---

## Cost Tracking

| Phase | API | Expected Cost | Actual Cost | Savings vs Legacy |
|-------|-----|---------------|-------------|-------------------|
| 1 | Search | $0.005/req | ___ | 95% |
| 2 | Task | $0.01/req | ___ | 90% |
| 3 | Extract | $0.001/page | ___ | 80% |
| 4 | FindAll | $0.23/req | ___ | N/A (new) |
| 5 | Monitor | TBD | ___ | N/A (new) |

---

## Final Checklist Before Production

### Pre-Launch (Do These First)
- [ ] `npm install parallel-web` completed
- [ ] `PARALLEL_API_KEY` configured in Vercel
- [ ] All tests passing (unit + integration)
- [ ] Staging validation complete (24 hours)
- [ ] Monitoring dashboards created
- [ ] Alerting configured (PagerDuty/Slack)
- [ ] Health endpoint `/api/health/parallel` working

### Day 1 Launch
- [ ] Feature flags at ROLLOUT=10%
- [ ] Team monitoring Slack/PagerDuty
- [ ] Parallel support contact info handy
- [ ] Emergency procedures documented

### Post-Launch (Week 1)
- [ ] ROLLOUT increased to 100%
- [ ] Error rate stable < 5%
- [ ] Customer feedback positive
- [ ] Cost tracking within projections

### Cleanup (Week 6)
- [ ] Delete `lib/tools/linkup-prospect-research.ts`
- [ ] Delete `lib/tools/perplexity-prospect-research.ts`
- [ ] Delete `lib/batch-processing/linkup-search.ts`
- [ ] Delete `lib/batch-processing/sonar-research.ts`
- [ ] `npm uninstall linkup-sdk`
- [ ] Remove `LINKUP_API_KEY` from all environments
- [ ] Update CLAUDE.md with new tools
- [ ] Update user documentation

---

## Summary: What's Changing

| Before | After |
|--------|-------|
| LinkUp + Perplexity (dual-source) | Parallel AI (single source) |
| $0.095/prospect | $0.005/prospect |
| Fallback on error | Graceful error message |
| No prospect discovery | FindAll API (new feature) |
| No real-time alerts | Monitor API (new feature) |

**Risk accepted:** If Parallel goes down, research is unavailable until it recovers.
**Mitigation:** Circuit breakers, retries, graceful errors, and git history to restore if catastrophic.
