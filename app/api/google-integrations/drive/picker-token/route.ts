/**
 * Google Drive Picker Token API Route
 * GET: Returns an access token and client ID for the Google Picker
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

    // Return token and client ID for picker
    return NextResponse.json({
      success: true,
      accessToken,
      clientId: process.env.GOOGLE_CLIENT_ID,
      developerKey: process.env.GOOGLE_PICKER_API_KEY || null, // Optional API key for picker
    })
  } catch (error) {
    console.error("[Drive Picker Token API] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get picker token" },
      { status: 500 }
    )
  }
}
