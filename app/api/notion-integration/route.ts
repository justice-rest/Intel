/**
 * Notion Integration - Main Route
 *
 * GET /api/notion-integration - Get connection status
 * DELETE /api/notion-integration - Disconnect Notion account
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import {
  getIntegrationStatus,
  deleteToken,
  getToken,
  isNotionConfigured,
} from "@/lib/notion"

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
        indexedPages: 0,
        processingPages: 0,
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
      configured: isNotionConfigured(),
    })
  } catch (error) {
    console.error("[NotionStatus] Error:", error)
    return NextResponse.json(
      { error: "Failed to get Notion status" },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Disconnect Notion account
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
        { error: "Notion is not connected" },
        { status: 400 }
      )
    }

    // Delete all Notion documents for this user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("notion_documents")
      .delete()
      .eq("user_id", user.id)

    // Delete OAuth token
    await deleteToken(user.id)

    // TODO: Log audit event

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[NotionDisconnect] Error:", error)
    return NextResponse.json(
      { error: "Failed to disconnect Notion" },
      { status: 500 }
    )
  }
}
