/**
 * Prospect Intelligence Enrichment API
 *
 * POST: Enrich a single prospect with comprehensive intelligence
 *
 * This endpoint provides three enrichment modes:
 * - QUICK_SCREEN: Fast wealth indicators (~5 seconds)
 * - STANDARD: Full prospect profile (~30 seconds)
 * - DEEP_INTELLIGENCE: Comprehensive with AI synthesis (~2 minutes)
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { enrichProspect, EnrichmentRequest, EnrichmentMode } from "@/lib/batch-processing/enrichment"
import { getEffectiveApiKey } from "@/lib/user-keys"

export const runtime = "nodejs"
export const maxDuration = 120  // 2 minutes for deep intelligence

interface EnrichRequestBody {
  prospect: {
    name: string
    address?: string
    city?: string
    state?: string
    zip?: string
    email?: string
    phone?: string
    company?: string
    title?: string
    additionalContext?: string
  }
  mode?: EnrichmentMode
  options?: {
    includeRelationships?: boolean
    includeTiming?: boolean
    includeCompetitive?: boolean
    organizationName?: string
  }
}

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      )
    }

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    const body: EnrichRequestBody = await request.json()

    // Validate required fields
    if (!body.prospect?.name?.trim()) {
      return NextResponse.json(
        { error: "Prospect name is required" },
        { status: 400 }
      )
    }

    // Default to STANDARD mode
    const mode: EnrichmentMode = body.mode || "STANDARD"

    // Validate mode
    if (!["QUICK_SCREEN", "STANDARD", "DEEP_INTELLIGENCE"].includes(mode)) {
      return NextResponse.json(
        { error: "Invalid enrichment mode. Use QUICK_SCREEN, STANDARD, or DEEP_INTELLIGENCE" },
        { status: 400 }
      )
    }

    // Get user's API key
    let apiKey: string | undefined
    try {
      apiKey = (await getEffectiveApiKey(user.id, "openrouter")) || undefined
    } catch {
      apiKey = undefined
    }

    if (!apiKey) {
      apiKey = process.env.OPENROUTER_API_KEY
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key available. Add your OpenRouter key in Settings." },
        { status: 400 }
      )
    }

    console.log(`[EnrichAPI] Starting ${mode} enrichment for ${body.prospect.name}`)

    // Build enrichment request
    const enrichmentRequest: EnrichmentRequest = {
      prospect: body.prospect,
      mode,
      options: body.options,
    }

    // Run enrichment
    const result = await enrichProspect(enrichmentRequest, apiKey)

    if (!result.success) {
      console.error(`[EnrichAPI] Enrichment failed: ${result.error}`)
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Enrichment failed",
          usage: result.usage,
        },
        { status: 500 }
      )
    }

    const processingTime = Date.now() - startTime
    console.log(`[EnrichAPI] Completed ${mode} enrichment in ${processingTime}ms`)

    return NextResponse.json({
      success: true,
      intelligence: result.intelligence,
      usage: result.usage,
      processingTimeMs: processingTime,
    })
  } catch (error) {
    console.error("[EnrichAPI] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}
