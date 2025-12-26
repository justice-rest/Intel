/**
 * Gmail Thread API Route
 * GET: Fetch a full email thread
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  isGoogleIntegrationEnabled,
  hasGmailAccess,
  getThread,
  GOOGLE_ERROR_MESSAGES,
} from "@/lib/google"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params

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

    // Fetch thread
    const result = await getThread(user.id, threadId)

    return NextResponse.json({
      success: true,
      threadId: result.threadId,
      messageCount: result.messageCount,
      messages: result.messages,
    })
  } catch (error) {
    console.error("[Gmail Thread API] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch thread" },
      { status: 500 }
    )
  }
}
