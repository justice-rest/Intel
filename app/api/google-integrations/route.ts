/**
 * Google Integrations API Routes
 * GET: Get integration status
 * DELETE: Disconnect Google account
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getIntegrationStatus,
  getTokens,
  deleteTokens,
  revokeTokens,
  isGoogleIntegrationEnabled,
  GOOGLE_ERROR_MESSAGES,
} from "@/lib/google"

// ============================================================================
// GET - Get Google integration status
// ============================================================================

export async function GET() {
  try {
    // Check if integration is enabled
    if (!isGoogleIntegrationEnabled()) {
      return NextResponse.json(
        {
          connected: false,
          status: "disconnected",
          scopes: [],
          pendingDrafts: 0,
          indexedDocuments: 0,
          message: GOOGLE_ERROR_MESSAGES.notConfigured,
        },
        { status: 200 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      )
    }

    // Get current user
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

    // Get integration status
    const status = await getIntegrationStatus(user.id)

    return NextResponse.json(status)
  } catch (error) {
    console.error("[GoogleIntegrations] Error in GET:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Disconnect Google account
// ============================================================================

export async function DELETE() {
  try {
    // Check if integration is enabled
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

    // Get current user
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

    // Get current tokens to revoke with Google
    const tokens = await getTokens(user.id)

    if (tokens) {
      // Revoke tokens with Google (best effort, don't block on failure)
      await revokeTokens(tokens.accessToken)
    }

    // Delete tokens from database
    await deleteTokens(user.id)

    // Log the disconnect action
    try {
      // Using 'any' cast as table is not yet in generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("google_integration_audit_log").insert({
        user_id: user.id,
        action: "disconnect",
        status: "success",
        metadata: {},
      })
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.error("[GoogleIntegrations] Audit log error:", auditError)
    }

    return NextResponse.json({
      success: true,
      message: "Google account disconnected successfully",
    })
  } catch (error) {
    console.error("[GoogleIntegrations] Error in DELETE:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
