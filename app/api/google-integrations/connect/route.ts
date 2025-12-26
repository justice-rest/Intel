/**
 * Google OAuth Connect Route
 * POST: Initiate OAuth flow, returns authorization URL
 */

import { NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@/lib/supabase/server"
import {
  isGoogleIntegrationEnabled,
  isUserInRollout,
  GOOGLE_OAUTH_CONFIG,
  ALL_GOOGLE_SCOPES,
  DEFAULT_GMAIL_SCOPES,
  DEFAULT_DRIVE_SCOPES,
  getGoogleCallbackUrl,
  GOOGLE_ERROR_MESSAGES,
} from "@/lib/google"
import { storeOAuthState } from "@/lib/google/oauth/state-manager"
import type { GoogleOAuthState } from "@/lib/google"

// ============================================================================
// POST - Initiate OAuth flow
// ============================================================================

interface ConnectRequest {
  scopes?: "gmail" | "drive" | "all"
  forceConsent?: boolean
}

export async function POST(request: Request) {
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

    // Check if user is in rollout
    if (!isUserInRollout(user.id)) {
      return NextResponse.json(
        { error: "Google integration is not yet available for your account" },
        { status: 403 }
      )
    }

    // Parse request body (optional parameters)
    let body: ConnectRequest = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is fine, use defaults
    }

    // Determine which scopes to request
    let scopes: string[]
    switch (body.scopes) {
      case "gmail":
        scopes = DEFAULT_GMAIL_SCOPES
        break
      case "drive":
        scopes = DEFAULT_DRIVE_SCOPES
        break
      case "all":
      default:
        scopes = ALL_GOOGLE_SCOPES
        break
    }

    // Create OAuth state for CSRF protection
    const oauthState: GoogleOAuthState = {
      userId: user.id,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString("hex"),
    }

    const stateKey = storeOAuthState(oauthState)

    // Build authorization URL
    const redirectUri = getGoogleCallbackUrl()
    const authParams = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline", // Required for refresh token
      state: stateKey,
      // Include email scope for user info
      include_granted_scopes: "true",
    })

    // Force consent prompt if requested or if reconnecting
    // This ensures we get a refresh token
    if (body.forceConsent) {
      authParams.set("prompt", "consent")
    } else {
      // Use select_account to let user choose account, consent for refresh token
      authParams.set("prompt", "consent")
    }

    const authUrl = `${GOOGLE_OAUTH_CONFIG.authUrl}?${authParams.toString()}`

    // Log the connect attempt
    try {
      // Using 'any' cast as table is not yet in generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("google_integration_audit_log").insert({
        user_id: user.id,
        action: "connect",
        status: "success",
        metadata: {
          scopes_requested: scopes,
          event: "oauth_initiated",
        },
      })
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.error("[GoogleConnect] Audit log error:", auditError)
    }

    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error("[GoogleConnect] Error in POST:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
