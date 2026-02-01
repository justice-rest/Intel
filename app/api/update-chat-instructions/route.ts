import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { chatId, instructions } = body

    if (!chatId) {
      return NextResponse.json(
        { error: "Chat ID is required" },
        { status: 400 }
      )
    }

    // Validate instructions (can be empty string to clear)
    if (typeof instructions !== "string") {
      return NextResponse.json(
        { error: "Instructions must be a string" },
        { status: 400 }
      )
    }

    // Limit instructions length
    const MAX_INSTRUCTIONS_LENGTH = 10000
    if (instructions.length > MAX_INSTRUCTIONS_LENGTH) {
      return NextResponse.json(
        { error: `Instructions cannot exceed ${MAX_INSTRUCTIONS_LENGTH} characters` },
        { status: 400 }
      )
    }

    // Update the system_prompt field - RLS enforces ownership
    const { data: updatedChat, error: updateError } = await (supabase as any)
      .from("chats")
      .update({ system_prompt: instructions || null })
      .eq("id", chatId)
      .eq("user_id", user.id) // Only owner can update
      .select()
      .single()

    if (updateError) {
      console.error("[update-chat-instructions] Update error:", updateError)

      if (updateError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Chat not found or you don't have permission" },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { error: "Failed to update instructions" },
        { status: 500 }
      )
    }

    if (!updatedChat) {
      return NextResponse.json(
        { error: "Chat not found or you don't have permission" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      chatId,
      instructions: instructions || null,
    })
  } catch (error) {
    console.error("[update-chat-instructions] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
