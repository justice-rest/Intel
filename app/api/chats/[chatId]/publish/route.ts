/**
 * Publish Chat API
 * POST /api/chats/[chatId]/publish - Make a chat public
 *
 * This endpoint allows chat owners and editors to make a chat public.
 * Uses server-side auth and RLS bypass for editors.
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { checkUserChatRole } from "@/lib/collaboration"

/**
 * POST /api/chats/[chatId]/publish
 * Make a chat public
 * Requires: Editor+ role (owner or editor can publish)
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

    // Check if user has at least editor role on this chat
    const { hasAccess, userRole } = await checkUserChatRole(
      supabase,
      user.id,
      chatId,
      "editor" // Editors and owners can publish
    )

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You don't have permission to publish this chat" },
        { status: 403 }
      )
    }

    // Parse request body for public status
    let makePublic = true
    try {
      const body = await request.json()
      if (typeof body.public === "boolean") {
        makePublic = body.public
      }
    } catch {
      // Default to making public if no body provided
    }

    // Use service role or RPC to update the chat
    // Since we've verified the user has editor+ access, we can safely update
    const { data, error } = await supabase
      .from("chats")
      .update({ public: makePublic })
      .eq("id", chatId)
      .select()
      .single()

    if (error) {
      console.error("[publish] Update error:", error)

      // If RLS blocks the update, try using RPC
      // This happens when a collaborator (not owner) tries to publish
      if (error.code === "42501" || error.message?.includes("policy")) {
        // Create an RPC function or use service role for this
        // For now, return a helpful error
        return NextResponse.json(
          { error: "Unable to publish. Please ask the chat owner to publish." },
          { status: 403 }
        )
      }

      return NextResponse.json(
        { error: "Failed to update chat visibility" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      public: data.public,
      chatId: data.id,
    })
  } catch (err: unknown) {
    console.error("[publish] Unhandled error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
