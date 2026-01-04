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

    // First check if user is the owner of the chat
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("id, user_id, system_prompt")
      .eq("id", chatId)
      .single()

    if (chatError || !chat) {
      return NextResponse.json(
        { error: "Chat not found" },
        { status: 404 }
      )
    }

    // Check permissions: must be owner or have editor role
    let hasPermission = chat.user_id === user.id

    if (!hasPermission) {
      // Check if user is a collaborator with editor+ role
      const { data: collaborator } = await supabase
        .from("chat_collaborators")
        .select("role")
        .eq("chat_id", chatId)
        .eq("user_id", user.id)
        .single()

      if (collaborator && (collaborator.role === "owner" || collaborator.role === "editor")) {
        hasPermission = true
      }
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: "You don't have permission to edit this chat's instructions" },
        { status: 403 }
      )
    }

    // Update the system_prompt field
    const { error: updateError } = await supabase
      .from("chats")
      .update({ system_prompt: instructions || null })
      .eq("id", chatId)

    if (updateError) {
      console.error("[update-chat-instructions] Update error:", updateError)
      return NextResponse.json(
        { error: "Failed to update instructions" },
        { status: 500 }
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
