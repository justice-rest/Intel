/**
 * Batch Preflight Validation API
 * GET: Check if batch processing is ready to run
 *
 * This endpoint performs pre-flight checks before starting a batch job:
 * - Validates API keys are available
 * - Tests LinkUp search connectivity
 * - Tests OpenRouter connectivity
 * - Returns detailed status for each dependency
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getEffectiveApiKey } from "@/lib/user-keys"

export const runtime = "nodejs"
export const maxDuration = 30

interface PreflightCheck {
  name: string
  status: "ok" | "warning" | "error"
  message: string
  details?: string
}

interface PreflightResponse {
  ready: boolean
  checks: PreflightCheck[]
  summary: string
}

export async function GET() {
  const checks: PreflightCheck[] = []
  let ready = true

  try {
    const supabase = await createClient()

    // Check 1: Database connection
    if (!supabase) {
      checks.push({
        name: "Database",
        status: "error",
        message: "Database not configured",
        details: "Supabase connection is required for batch processing",
      })
      ready = false
    } else {
      checks.push({
        name: "Database",
        status: "ok",
        message: "Connected",
      })
    }

    // Check 2: User authentication
    let userId: string | null = null
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        checks.push({
          name: "Authentication",
          status: "error",
          message: "Not authenticated",
          details: "Please sign in to use batch processing",
        })
        ready = false
      } else {
        userId = user.id
        checks.push({
          name: "Authentication",
          status: "ok",
          message: "Authenticated",
        })
      }
    }

    // Check 3: LinkUp API key
    const linkupApiKey = process.env.LINKUP_API_KEY
    if (!linkupApiKey) {
      checks.push({
        name: "LinkUp Search",
        status: "error",
        message: "API key not configured",
        details: "LINKUP_API_KEY environment variable is required for web research",
      })
      ready = false
    } else {
      // Test LinkUp connectivity with a simple search
      try {
        const testResponse = await fetch("https://api.linkup.so/v1/search", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${linkupApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            q: "test",
            depth: "standard",
            outputType: "sourcedAnswer",
          }),
          signal: AbortSignal.timeout(10000), // 10 second timeout
        })

        if (testResponse.ok) {
          checks.push({
            name: "LinkUp Search",
            status: "ok",
            message: "Connected and ready",
          })
        } else if (testResponse.status === 429) {
          checks.push({
            name: "LinkUp Search",
            status: "warning",
            message: "Rate limited",
            details: "LinkUp API is rate limited. Processing may be slower.",
          })
          // Don't fail - just warn
        } else if (testResponse.status === 401) {
          checks.push({
            name: "LinkUp Search",
            status: "error",
            message: "Invalid API key",
            details: "Please check your LINKUP_API_KEY",
          })
          ready = false
        } else {
          checks.push({
            name: "LinkUp Search",
            status: "warning",
            message: `API returned ${testResponse.status}`,
            details: "LinkUp may be experiencing issues",
          })
        }
      } catch (linkupError) {
        const errorMessage = linkupError instanceof Error ? linkupError.message : String(linkupError)
        if (errorMessage.includes("timeout") || errorMessage.includes("abort")) {
          checks.push({
            name: "LinkUp Search",
            status: "warning",
            message: "Connection timeout",
            details: "LinkUp API is slow to respond. Processing may be affected.",
          })
        } else {
          checks.push({
            name: "LinkUp Search",
            status: "warning",
            message: "Connection error",
            details: errorMessage,
          })
        }
      }
    }

    // Check 4: OpenRouter API key (either env or user-provided)
    let openrouterKey: string | undefined
    try {
      if (userId) {
        openrouterKey = (await getEffectiveApiKey(userId, "openrouter")) || undefined
      }
    } catch {
      // Ignore - will check env key
    }

    if (!openrouterKey) {
      openrouterKey = process.env.OPENROUTER_API_KEY
    }

    if (!openrouterKey) {
      checks.push({
        name: "AI Provider (OpenRouter)",
        status: "error",
        message: "No API key available",
        details: "Either set OPENROUTER_API_KEY or add your own key in Settings",
      })
      ready = false
    } else {
      // Test OpenRouter connectivity
      try {
        const testResponse = await fetch("https://openrouter.ai/api/v1/auth/key", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${openrouterKey}`,
          },
          signal: AbortSignal.timeout(10000),
        })

        if (testResponse.ok) {
          const keyData = await testResponse.json()
          checks.push({
            name: "AI Provider (OpenRouter)",
            status: "ok",
            message: "Connected and ready",
            details: keyData.data?.limit_remaining
              ? `Credits remaining: ${keyData.data.limit_remaining}`
              : undefined,
          })
        } else if (testResponse.status === 401) {
          checks.push({
            name: "AI Provider (OpenRouter)",
            status: "error",
            message: "Invalid API key",
            details: "Please check your OpenRouter API key",
          })
          ready = false
        } else {
          checks.push({
            name: "AI Provider (OpenRouter)",
            status: "warning",
            message: `API returned ${testResponse.status}`,
            details: "OpenRouter may be experiencing issues",
          })
        }
      } catch (openrouterError) {
        const errorMessage = openrouterError instanceof Error ? openrouterError.message : String(openrouterError)
        checks.push({
          name: "AI Provider (OpenRouter)",
          status: "warning",
          message: "Connection error",
          details: errorMessage,
        })
      }
    }

    // Build summary
    const errorCount = checks.filter(c => c.status === "error").length
    const warningCount = checks.filter(c => c.status === "warning").length

    let summary: string
    if (errorCount > 0) {
      summary = `${errorCount} error(s) must be resolved before processing`
    } else if (warningCount > 0) {
      summary = `Ready to process with ${warningCount} warning(s)`
    } else {
      summary = "All systems ready for batch processing"
    }

    const response: PreflightResponse = {
      ready,
      checks,
      summary,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[Preflight] Error:", error)
    return NextResponse.json(
      {
        ready: false,
        checks: [{
          name: "System",
          status: "error",
          message: "Preflight check failed",
          details: error instanceof Error ? error.message : String(error),
        }],
        summary: "Unable to complete preflight checks",
      },
      { status: 500 }
    )
  }
}
