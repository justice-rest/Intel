/**
 * Gmail Writing Style Analysis API Route
 * GET: Get current style profile
 * POST: Trigger new style analysis
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  isGoogleIntegrationEnabled,
  hasGmailAccess,
  analyzeWritingStyle,
  getWritingStyleProfile,
  GOOGLE_ERROR_MESSAGES,
  STYLE_ANALYSIS_CONFIG,
} from "@/lib/google"

// ============================================================================
// GET - Get current style profile
// ============================================================================

export async function GET() {
  try {
    if (!isGoogleIntegrationEnabled()) {
      return NextResponse.json(
        { error: GOOGLE_ERROR_MESSAGES.notConfigured },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const hasAccess = await hasGmailAccess(user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { error: GOOGLE_ERROR_MESSAGES.notConnected },
        { status: 403 }
      )
    }

    const profile = await getWritingStyleProfile(user.id)

    if (!profile) {
      return NextResponse.json({
        success: true,
        hasProfile: false,
        message:
          "No writing style profile found. Click 'Analyze Style' to create one.",
      })
    }

    return NextResponse.json({
      success: true,
      hasProfile: true,
      profile,
    })
  } catch (error) {
    console.error("[Gmail Style API] GET Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get style profile" },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Trigger new style analysis
// ============================================================================

export async function POST() {
  try {
    if (!isGoogleIntegrationEnabled()) {
      return NextResponse.json(
        { error: GOOGLE_ERROR_MESSAGES.notConfigured },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const hasAccess = await hasGmailAccess(user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { error: GOOGLE_ERROR_MESSAGES.notConnected },
        { status: 403 }
      )
    }

    // Log the analysis attempt
    try {
      // Using 'any' cast as table is not yet in generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("google_integration_audit_log").insert({
        user_id: user.id,
        action: "style_analyze",
        status: "success",
        metadata: { event: "analysis_started" },
      })
    } catch (auditError) {
      console.error("[Gmail Style API] Audit log error:", auditError)
    }

    // Run the analysis
    const profile = await analyzeWritingStyle(user.id)

    if (!profile) {
      return NextResponse.json({
        success: false,
        message: `Need at least ${STYLE_ANALYSIS_CONFIG.minEmails} sent emails to analyze writing style.`,
      })
    }

    return NextResponse.json({
      success: true,
      profile,
      emailsAnalyzed: profile.emailsAnalyzed,
      message: `Analyzed ${profile.emailsAnalyzed} emails to learn your writing style.`,
    })
  } catch (error) {
    console.error("[Gmail Style API] POST Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze style" },
      { status: 500 }
    )
  }
}
