import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * POST /api/mark-chat-read
 * Marks all messages in a chat as read for the current user.
 *
 * Request body:
 * {
 *   chatId: string
 *   lastMessageId?: number  // Optional - will fetch latest if not provided
 * }
 */
export async function POST(request: Request) {
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
    const { chatId, lastMessageId } = body

    if (!chatId) {
      return NextResponse.json(
        { error: "chatId is required" },
        { status: 400 }
      )
    }

    // If lastMessageId is not provided, get the latest message ID
    let messageIdToMark = lastMessageId

    if (!messageIdToMark) {
      const { data: latestMessage, error: msgError } = await supabase
        .from("messages")
        .select("id")
        .eq("chat_id", chatId)
        .order("id", { ascending: false })
        .limit(1)
        .single()

      if (msgError && msgError.code !== "PGRST116") {
        // PGRST116 = no rows found
        console.error("[mark-chat-read] Error fetching latest message:", msgError)
        return NextResponse.json(
          { error: "Failed to get latest message" },
          { status: 500 }
        )
      }

      if (!latestMessage) {
        // No messages in chat - nothing to mark as read
        return NextResponse.json({ success: true, marked: false })
      }

      messageIdToMark = latestMessage.id
    }

    // Call the mark_messages_read function
    const { error } = await supabase.rpc("mark_messages_read", {
      p_chat_id: chatId,
      p_user_id: user.id,
      p_last_message_id: messageIdToMark,
    })

    if (error) {
      console.error("[mark-chat-read] Error marking messages as read:", error)
      return NextResponse.json(
        { error: "Failed to mark messages as read" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, marked: true, lastMessageId: messageIdToMark })
  } catch (error) {
    console.error("[mark-chat-read] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
