/**
 * OneDrive Integration - Connect Route
 *
 * POST /api/onedrive-integration/connect
 * Initiates OAuth flow by generating state and returning authorization URL
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import {
  isOneDriveConfigured,
  generateOAuthState,
  buildAuthorizationUrl,
  isConnected,
  ONEDRIVE_ERROR_MESSAGES,
} from "@/lib/onedrive"

export async function POST() {
  try {
    // Check if OneDrive is configured
    if (!isOneDriveConfigured()) {
      return NextResponse.json(
        { error: ONEDRIVE_ERROR_MESSAGES.notConfigured },
        { status: 503 }
      )
    }

    // Get authenticated user
    if (!isSupabaseEnabled) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    // Check if already connected
    const alreadyConnected = await isConnected(user.id)
    if (alreadyConnected) {
      return NextResponse.json(
        { error: ONEDRIVE_ERROR_MESSAGES.alreadyConnected },
        { status: 400 }
      )
    }

    // Generate OAuth state for CSRF protection
    const state = await generateOAuthState(user.id)

    // Build authorization URL
    const authUrl = buildAuthorizationUrl(state)

    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error("[OneDriveConnect] Error:", error)
    return NextResponse.json(
      { error: "Failed to initiate OneDrive connection" },
      { status: 500 }
    )
  }
}
