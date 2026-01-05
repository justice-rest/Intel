/**
 * Publish Chat API
 * POST /api/chats/[chatId]/publish - Make a chat public
 *
 * This endpoint allows chat owners to make a chat public.
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * POST /api/chats/[chatId]/publish
 * Make a chat public
 * Requires: Chat owner
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

    // Update the chat - RLS will enforce that user owns the chat
    const { data, error } = await supabase
      .from("chats")
      .update({ public: makePublic })
      .eq("id", chatId)
      .eq("user_id", user.id) // Ensure user owns the chat
      .select()
      .single()

    if (error) {
      console.error("[publish] Update error:", error)

      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Chat not found or you don't have permission" },
          { status: 404 }
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
