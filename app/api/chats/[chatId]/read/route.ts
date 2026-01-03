/**
 * Read Receipts API
 * POST /api/chats/[chatId]/read - Mark messages as read
 * GET /api/chats/[chatId]/read - Get read receipts for a chat
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { checkUserChatRole } from "@/lib/collaboration"
import {
  markMessagesAsRead,
  getChatReadReceipts,
} from "@/lib/collaboration/read-receipts"

/**
 * POST /api/chats/[chatId]/read
 * Mark messages as read up to a specific message ID
 * Requires: Viewer+ role
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const supabase = await createClient()
    const { chatId } = await params

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      )
    }

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has at least viewer role
    const { hasAccess } = await checkUserChatRole(
      supabase,
      user.id,
      chatId,
      "viewer"
    )

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You don't have access to this chat" },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { lastMessageId } = body

    if (typeof lastMessageId !== "number" || lastMessageId < 0) {
      return NextResponse.json(
        { error: "Invalid lastMessageId" },
        { status: 400 }
      )
    }

    // Mark messages as read
    const result = await markMessagesAsRead(
      supabase,
      chatId,
      user.id,
      lastMessageId
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to mark as read" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("[read] POST error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/chats/[chatId]/read
 * Get read receipts for a chat
 * Requires: Viewer+ role
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const supabase = await createClient()
    const { chatId } = await params

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      )
    }

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has at least viewer role
    const { hasAccess } = await checkUserChatRole(
      supabase,
      user.id,
      chatId,
      "viewer"
    )

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You don't have access to this chat" },
        { status: 403 }
      )
    }

    // Get read receipts
    const receipts = await getChatReadReceipts(supabase, chatId)

    return NextResponse.json({ receipts })
  } catch (err: unknown) {
    console.error("[read] GET error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
