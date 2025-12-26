/**
 * Google OAuth Callback Route
 * GET: Handle OAuth callback, exchange code for tokens
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  isGoogleIntegrationEnabled,
  exchangeCodeForTokens,
  storeTokens,
  getGoogleCallbackUrl,
  GOOGLE_ERROR_MESSAGES,
} from "@/lib/google"
import { retrieveOAuthState } from "@/lib/google/oauth/state-manager"

// ============================================================================
// GET - Handle OAuth callback
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  // Base URL for redirects
  const baseUrl = process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "https://intel.getromy.app"

  const settingsUrl = `${baseUrl}/settings?tab=integrations`

  try {
    // Check if integration is enabled
    if (!isGoogleIntegrationEnabled()) {
      return NextResponse.redirect(
        `${settingsUrl}&google_error=${encodeURIComponent(GOOGLE_ERROR_MESSAGES.notConfigured)}`
      )
    }

    // Handle OAuth errors from Google
    if (error) {
      console.error("[GoogleCallback] OAuth error:", error, errorDescription)

      let errorMessage = "Authorization was denied or failed"
      if (error === "access_denied") {
        errorMessage = "You denied access to your Google account"
      } else if (errorDescription) {
        errorMessage = errorDescription
      }

      return NextResponse.redirect(
        `${settingsUrl}&google_error=${encodeURIComponent(errorMessage)}`
      )
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        `${settingsUrl}&google_error=${encodeURIComponent("Invalid callback: missing code or state")}`
      )
    }

    // Validate state (CSRF protection)
    const oauthState = retrieveOAuthState(state)
    if (!oauthState) {
      return NextResponse.redirect(
        `${settingsUrl}&google_error=${encodeURIComponent("Invalid or expired authorization state. Please try again.")}`
      )
    }

    // Verify the user session matches the state
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.redirect(
        `${settingsUrl}&google_error=${encodeURIComponent("Database not configured")}`
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.redirect(
        `${settingsUrl}&google_error=${encodeURIComponent("Session expired. Please sign in and try again.")}`
      )
    }

    // Verify user ID matches the one who initiated the OAuth flow
    if (user.id !== oauthState.userId) {
      console.error("[GoogleCallback] User ID mismatch:", {
        sessionUserId: user.id,
        stateUserId: oauthState.userId,
      })

      // Log security event
      // Using 'any' cast as table is not yet in generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("google_integration_audit_log").insert({
        user_id: user.id,
        action: "connect",
        status: "failure",
        error_message: "OAuth state user ID mismatch - potential CSRF attempt",
        metadata: {
          session_user_id: user.id,
          state_user_id: oauthState.userId,
        },
      })

      return NextResponse.redirect(
        `${settingsUrl}&google_error=${encodeURIComponent("Security error: user mismatch. Please try again.")}`
      )
    }

    // Exchange authorization code for tokens
    const redirectUri = getGoogleCallbackUrl()
    const { tokens, userInfo } = await exchangeCodeForTokens(code, redirectUri)

    // Store encrypted tokens
    await storeTokens(user.id, tokens, userInfo)

    // Log successful connection
    // Using 'any' cast as table is not yet in generated types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("google_integration_audit_log").insert({
      user_id: user.id,
      action: "connect",
      status: "success",
      metadata: {
        google_email: userInfo.email,
        scopes: tokens.scopes,
        event: "oauth_completed",
      },
    })

    // Redirect to settings with success message
    return NextResponse.redirect(
      `${settingsUrl}&google_success=${encodeURIComponent(`Connected to ${userInfo.email}`)}`
    )
  } catch (error) {
    console.error("[GoogleCallback] Error:", error)

    // Log the error
    try {
      const supabase = await createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Using 'any' cast as table is not yet in generated types
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("google_integration_audit_log").insert({
            user_id: user.id,
            action: "connect",
            status: "failure",
            error_message: error instanceof Error ? error.message : "Unknown error",
            metadata: {
              event: "oauth_error",
            },
          })
        }
      }
    } catch (auditError) {
      console.error("[GoogleCallback] Audit log error:", auditError)
    }

    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to connect Google account"

    return NextResponse.redirect(
      `${settingsUrl}&google_error=${encodeURIComponent(errorMessage)}`
    )
  }
}
