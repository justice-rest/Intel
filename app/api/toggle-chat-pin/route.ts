import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { chatId, pinned } = await request.json()

    if (!chatId || typeof pinned !== "boolean") {
      return NextResponse.json(
        { error: "Missing chatId or pinned" },
        { status: 400 }
      )
    }

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      )
    }

    // Verify user owns this chat
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check chat ownership before updating
    const { data: chat } = await supabase
      .from("chats")
      .select("user_id")
      .eq("id", chatId)
      .single()

    if (!chat || chat.user_id !== user.id) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    const toggle = pinned
      ? { pinned: true, pinned_at: new Date().toISOString() }
      : { pinned: false, pinned_at: null }

    const { error } = await supabase
      .from("chats")
      .update(toggle)
      .eq("id", chatId)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json(
        { error: "Failed to update pinned" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("toggle-chat-pin unhandled error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
