/**
 * Google Drive Picker Token API Route
 * GET: Returns an access token, client ID, API key, and App ID for the Google Picker
 *
 * Required environment variables:
 * - GOOGLE_CLIENT_ID: OAuth 2.0 client ID
 * - GOOGLE_PICKER_API_KEY: API key restricted to Picker API
 * - GOOGLE_APP_ID: Cloud Project Number (found in IAM & Admin > Settings)
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  isGoogleIntegrationEnabled,
  hasDriveAccess,
  getValidAccessToken,
  GOOGLE_ERROR_MESSAGES,
} from "@/lib/google"

export async function GET() {
  try {
    if (!isGoogleIntegrationEnabled()) {
      return NextResponse.json(
        { error: GOOGLE_ERROR_MESSAGES.notConfigured },
        { status: 400 }
      )
    }

    // Check for required Picker configuration
    const clientId = process.env.GOOGLE_CLIENT_ID
    const developerKey = process.env.GOOGLE_PICKER_API_KEY
    const appId = process.env.GOOGLE_APP_ID

    // Validate Picker-specific configuration
    if (!developerKey) {
      console.error("[Drive Picker] Missing GOOGLE_PICKER_API_KEY")
      return NextResponse.json(
        {
          error: "Google Picker not configured. Please add GOOGLE_PICKER_API_KEY to your environment.",
          details: "Create an API Key in Google Cloud Console, restrict it to the Picker API, and add your domain as an HTTP referrer.",
        },
        { status: 400 }
      )
    }

    if (!appId) {
      // Fall back to extracting from client ID if GOOGLE_APP_ID not set
      console.warn("[Drive Picker] GOOGLE_APP_ID not set, extracting from client ID")
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

    const hasAccess = await hasDriveAccess(user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { error: GOOGLE_ERROR_MESSAGES.notConnected },
        { status: 403 }
      )
    }

    // Get a valid access token
    const accessToken = await getValidAccessToken(user.id)
    if (!accessToken) {
      return NextResponse.json(
        { error: GOOGLE_ERROR_MESSAGES.tokenExpired },
        { status: 401 }
      )
    }

    // Determine App ID: use env var or extract from client ID
    // Client ID format: "123456789012-abc123def456.apps.googleusercontent.com"
    // The numeric prefix is the project number
    const resolvedAppId = appId || (clientId ? clientId.split("-")[0] : null)

    if (!resolvedAppId) {
      return NextResponse.json(
        {
          error: "Unable to determine App ID. Please set GOOGLE_APP_ID environment variable.",
          details: "Find your project number in Google Cloud Console: IAM & Admin > Settings",
        },
        { status: 400 }
      )
    }

    // Return all required Picker configuration
    return NextResponse.json({
      success: true,
      accessToken,
      clientId,
      developerKey,
      appId: resolvedAppId,
    })
  } catch (error) {
    console.error("[Drive Picker Token API] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get picker token" },
      { status: 500 }
    )
  }
}
