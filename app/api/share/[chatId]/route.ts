import { isSupabaseEnabled } from "@/lib/supabase/config"
import { createGuestServerClient } from "@/lib/supabase/server-guest"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  if (!isSupabaseEnabled) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 }
    )
  }

  const { chatId } = await params

  // Use service role to bypass RLS
  const supabase = await createGuestServerClient()

  if (!supabase) {
    return NextResponse.json(
      { error: "Failed to create database client" },
      { status: 500 }
    )
  }

  // Fetch chat - explicitly filter by public = true for security
  const { data: chatData, error: chatError } = await supabase
    .from("chats")
    .select("id, title, created_at, public")
    .eq("id", chatId)
    .eq("public", true)
    .single()

  if (chatError) {
    console.error("[Share API] Chat error:", chatError.message)
    return NextResponse.json(
      { error: "Chat not found or not public", details: chatError.message },
      { status: 404 }
    )
  }

  if (!chatData) {
    return NextResponse.json(
      { error: "Chat not found or not public" },
      { status: 404 }
    )
  }

  // Fetch messages
  const { data: messagesData, error: messagesError } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })

  if (messagesError) {
    console.error("[Share API] Messages error:", messagesError.message)
    return NextResponse.json(
      { error: "Failed to fetch messages", details: messagesError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    chat: chatData,
    messages: messagesData || [],
  })
}
