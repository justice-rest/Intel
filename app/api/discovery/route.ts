/**
 * Prospect Discovery API
 *
 * POST: Execute discovery search to find prospects matching criteria
 *
 * @module app/api/discovery
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  validateDiscoveryRequest,
  discoverProspects,
  DEFAULT_DISCOVERY_CONFIG,
  type DiscoveryResult,
  type DiscoveryErrorCode,
} from "@/lib/discovery"

export const runtime = "nodejs"
export const maxDuration = 60 // 60 seconds for discovery

// ============================================================================
// RATE LIMITING (In-Memory for now - should use Redis in production)
// ============================================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): {
  allowed: boolean
  remaining: number
  resetInSeconds: number
} {
  const now = Date.now()
  const hourMs = 60 * 60 * 1000
  const limit = DEFAULT_DISCOVERY_CONFIG.rateLimitPerHour

  const entry = rateLimitMap.get(userId)

  // No entry or expired
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + hourMs })
    return {
      allowed: true,
      remaining: limit - 1,
      resetInSeconds: Math.ceil(hourMs / 1000),
    }
  }

  // Check limit
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  // Increment and allow
  entry.count++
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
  }
}

// Cleanup old entries periodically
setInterval(
  () => {
    const now = Date.now()
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetAt < now) {
        rateLimitMap.delete(key)
      }
    }
  },
  5 * 60 * 1000
) // Every 5 minutes

// ============================================================================
// ERROR RESPONSE HELPERS
// ============================================================================

interface ErrorResponse {
  success: false
  error: string
  code: DiscoveryErrorCode
  details?: Record<string, unknown>
}

function errorResponse(
  message: string,
  code: DiscoveryErrorCode,
  status: number,
  details?: Record<string, unknown>
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
      details,
    },
    { status }
  )
}

// ============================================================================
// POST: Execute Discovery Search
// ============================================================================

export async function POST(request: Request): Promise<NextResponse<DiscoveryResult | ErrorResponse>> {
  const startTime = Date.now()

  try {
    // ========================================================================
    // AUTHENTICATION
    // ========================================================================

    const supabase = await createClient()

    if (!supabase) {
      return errorResponse(
        "Database not configured",
        "SERVER_ERROR",
        503
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return errorResponse(
        "Please sign in to use Prospect Discovery",
        "UNAUTHORIZED",
        401
      )
    }

    // ========================================================================
    // RATE LIMITING
    // ========================================================================

    const rateLimit = checkRateLimit(user.id)

    if (!rateLimit.allowed) {
      const minutes = Math.ceil(rateLimit.resetInSeconds / 60)
      return errorResponse(
        `You've reached the hourly limit for discovery searches. Try again in ${minutes} minute${minutes !== 1 ? "s" : ""}.`,
        "RATE_LIMITED",
        429,
        {
          remaining: rateLimit.remaining,
          resetInSeconds: rateLimit.resetInSeconds,
        }
      )
    }

    // ========================================================================
    // REQUEST VALIDATION
    // ========================================================================

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return errorResponse(
        "Invalid JSON in request body",
        "INVALID_REQUEST",
        400
      )
    }

    const validation = validateDiscoveryRequest(body)

    if (!validation.valid) {
      return errorResponse(
        validation.errors.join(". "),
        "INVALID_REQUEST",
        400,
        { validationErrors: validation.errors }
      )
    }

    const discoveryRequest = validation.sanitized!

    // ========================================================================
    // EXECUTE DISCOVERY
    // ========================================================================

    console.log(
      `[Discovery API] User ${user.id} searching: "${discoveryRequest.prompt.substring(0, 50)}..." (max: ${discoveryRequest.maxResults})`
    )

    const result = await discoverProspects(discoveryRequest)

    // ========================================================================
    // LOG USAGE (for analytics)
    // ========================================================================

    const durationMs = Date.now() - startTime
    console.log(
      `[Discovery API] Completed in ${durationMs}ms. Found ${result.prospects.length} prospects. Success: ${result.success}`
    )

    // Optionally log to database for analytics
    // This is fire-and-forget, don't await
    logDiscoveryUsage(supabase, user.id, discoveryRequest, result).catch((err) =>
      console.error("[Discovery API] Failed to log usage:", err)
    )

    // ========================================================================
    // RESPONSE
    // ========================================================================

    // Add rate limit info to response headers
    const response = NextResponse.json(result, {
      status: result.success ? 200 : 500,
    })

    response.headers.set("X-RateLimit-Limit", String(DEFAULT_DISCOVERY_CONFIG.rateLimitPerHour))
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining))
    response.headers.set("X-RateLimit-Reset", String(rateLimit.resetInSeconds))

    return response
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Discovery API] Unhandled error:", errorMessage)

    return errorResponse(
      "An unexpected error occurred. Please try again.",
      "SERVER_ERROR",
      500,
      { internalError: errorMessage }
    )
  }
}

// ============================================================================
// USAGE LOGGING (Fire-and-forget)
// ============================================================================

async function logDiscoveryUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  request: { prompt: string; maxResults: number; templateId?: string },
  result: DiscoveryResult
): Promise<void> {
  if (!supabase) return

  try {
    // Log to a discovery_usage table if it exists
    // For now, just log to console - can add table later
    const logEntry = {
      userId,
      prompt: request.prompt.substring(0, 500),
      templateId: request.templateId,
      maxResults: request.maxResults,
      prospectsFound: result.prospects.length,
      success: result.success,
      durationMs: result.durationMs,
      costCents: result.estimatedCostCents,
      timestamp: new Date().toISOString(),
    }

    console.log("[Discovery Usage]", JSON.stringify(logEntry))
  } catch {
    // Ignore logging errors
  }
}

// ============================================================================
// GET: Get discovery status and limits
// ============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get rate limit status
    const now = Date.now()
    const entry = rateLimitMap.get(user.id)
    const limit = DEFAULT_DISCOVERY_CONFIG.rateLimitPerHour

    let remaining = limit
    let resetInSeconds = 3600

    if (entry && entry.resetAt > now) {
      remaining = Math.max(0, limit - entry.count)
      resetInSeconds = Math.ceil((entry.resetAt - now) / 1000)
    }

    return NextResponse.json({
      available: true,
      config: {
        maxResults: DEFAULT_DISCOVERY_CONFIG.maxResultsLimit,
        minResults: DEFAULT_DISCOVERY_CONFIG.minResultsLimit,
        defaultResults: DEFAULT_DISCOVERY_CONFIG.defaultResults,
        costPerSearchCents: DEFAULT_DISCOVERY_CONFIG.costPerSearchCents,
        costPerEnrichmentCents: DEFAULT_DISCOVERY_CONFIG.costPerEnrichmentCents,
      },
      rateLimit: {
        limit,
        remaining,
        resetInSeconds,
      },
    })
  } catch (error) {
    console.error("[Discovery API] GET error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
