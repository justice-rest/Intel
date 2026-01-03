/**
 * Collaborators API
 * GET /api/chats/[chatId]/collaborators - List collaborators for a chat
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  checkUserChatRole,
  getChatCollaborators,
} from "@/lib/collaboration"

/**
 * GET /api/chats/[chatId]/collaborators
 * List collaborators for a chat with user details
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

    // Check user has viewer+ role
    const { hasAccess, userRole } = await checkUserChatRole(
      supabase,
      user.id,
      chatId,
      "viewer"
    )

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      )
    }

    // Get collaborators with user details
    const collaborators = await getChatCollaborators(supabase, chatId)

    return NextResponse.json({
      collaborators,
      currentUserRole: userRole,
    })
  } catch (err: unknown) {
    console.error("[collaborators] GET error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
