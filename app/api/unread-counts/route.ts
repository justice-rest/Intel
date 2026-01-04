import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * GET /api/unread-counts
 * Returns unread message counts for all chats the user has access to.
 *
 * Response format:
 * {
 *   counts: {
 *     [chatId]: number // unread count
 *   }
 * }
 */
export async function GET() {
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

    // Get unread counts using a database function that:
    // 1. Gets all chats the user has access to (owned + collaborated)
    // 2. For each chat, counts messages after the user's last_read_message_id
    // 3. Returns a map of chatId -> unreadCount

    // For efficiency, we use a single query with joins
    const { data, error } = await supabase.rpc("get_user_unread_counts", {
      p_user_id: user.id,
    })

    if (error) {
      // Function might not exist yet - return empty counts
      console.warn("[unread-counts] RPC failed:", error.message)
      return NextResponse.json({ counts: {} })
    }

    // Transform array to object for easier client-side use
    const counts: Record<string, number> = {}
    if (data && Array.isArray(data)) {
      for (const row of data) {
        if (row.chat_id && row.unread_count > 0) {
          counts[row.chat_id] = row.unread_count
        }
      }
    }

    return NextResponse.json({ counts })
  } catch (error) {
    console.error("[unread-counts] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
