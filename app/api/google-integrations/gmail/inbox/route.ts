/**
 * Gmail Inbox API Route
 * GET: Fetch recent inbox messages
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  isGoogleIntegrationEnabled,
  hasGmailAccess,
  getInbox,
  GOOGLE_ERROR_MESSAGES,
} from "@/lib/google"

export async function GET(request: NextRequest) {
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

    // Check Gmail access
    const hasAccess = await hasGmailAccess(user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { error: GOOGLE_ERROR_MESSAGES.notConnected },
        { status: 403 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q") || undefined
    const maxResults = Math.min(
      parseInt(searchParams.get("maxResults") || "20", 10),
      50
    )
    const pageToken = searchParams.get("pageToken") || undefined

    // Fetch inbox
    const result = await getInbox(user.id, {
      query,
      maxResults,
      pageToken,
    })

    return NextResponse.json({
      success: true,
      emails: result.emails,
      count: result.emails.length,
      nextPageToken: result.nextPageToken,
    })
  } catch (error) {
    console.error("[Gmail Inbox API] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch inbox" },
      { status: 500 }
    )
  }
}
