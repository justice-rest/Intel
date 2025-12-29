/**
 * OneDrive Integration - Main Route
 *
 * GET /api/onedrive-integration - Get connection status
 * DELETE /api/onedrive-integration - Disconnect OneDrive account
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import {
  getIntegrationStatus,
  deleteToken,
  getToken,
  isOneDriveConfigured,
} from "@/lib/onedrive"

/**
 * GET - Get connection status
 */
export async function GET() {
  try {
    // Get authenticated user
    if (!isSupabaseEnabled) {
      return NextResponse.json({
        connected: false,
        status: "disconnected",
        indexedFiles: 0,
        processingFiles: 0,
        configured: false,
      })
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

    // Get integration status
    const status = await getIntegrationStatus(user.id)

    return NextResponse.json({
      ...status,
      configured: isOneDriveConfigured(),
    })
  } catch (error) {
    console.error("[OneDriveStatus] Error:", error)
    return NextResponse.json(
      { error: "Failed to get OneDrive status" },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Disconnect OneDrive account
 */
export async function DELETE() {
  try {
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

    // Check if connected
    const token = await getToken(user.id)
    if (!token) {
      return NextResponse.json(
        { error: "OneDrive is not connected" },
        { status: 400 }
      )
    }

    // Delete all OneDrive documents for this user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("onedrive_documents")
      .delete()
      .eq("user_id", user.id)

    // Delete OAuth token
    await deleteToken(user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[OneDriveDisconnect] Error:", error)
    return NextResponse.json(
      { error: "Failed to disconnect OneDrive" },
      { status: 500 }
    )
  }
}
