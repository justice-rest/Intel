/**
 * Read Receipts Module
 * Handles read status tracking for collaborative chats
 */

import { SupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/app/types/database.types"

type TypedSupabaseClient = SupabaseClient<Database>

export interface ReadReceipt {
  user_id: string
  display_name: string | null
  profile_image: string | null
  read_at: string
}

export interface ChatReadStatus {
  chat_id: string
  user_id: string
  last_read_message_id: number
  read_at: string
}

/**
 * Mark messages as read for a user in a chat
 * Uses GREATEST to ensure we only update if the new message ID is higher
 */
export async function markMessagesAsRead(
  supabase: TypedSupabaseClient,
  chatId: string,
  userId: string,
  lastMessageId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use upsert with on conflict
    const { error } = await supabase
      .from("chat_read_receipts")
      .upsert(
        {
          chat_id: chatId,
          user_id: userId,
          last_read_message_id: lastMessageId,
          read_at: new Date().toISOString(),
        },
        {
          onConflict: "chat_id,user_id",
          ignoreDuplicates: false,
        }
      )

    if (error) {
      console.error("[read-receipts] Failed to mark as read:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("[read-receipts] Error:", err)
    return { success: false, error: errorMessage }
  }
}

/**
 * Get read receipts for a chat
 * Returns which users have read up to which message
 */
export async function getChatReadReceipts(
  supabase: TypedSupabaseClient,
  chatId: string
): Promise<ChatReadStatus[]> {
  const { data, error } = await supabase
    .from("chat_read_receipts")
    .select("chat_id, user_id, last_read_message_id, read_at")
    .eq("chat_id", chatId)
    .order("read_at", { ascending: false })

  if (error) {
    console.error("[read-receipts] Failed to get receipts:", error)
    return []
  }

  return (data || []).map((r) => ({
    chat_id: r.chat_id,
    user_id: r.user_id,
    last_read_message_id: r.last_read_message_id,
    read_at: r.read_at,
  }))
}

/**
 * Get users who have read a specific message
 * Uses the helper function in the database
 */
export async function getMessageReaders(
  supabase: TypedSupabaseClient,
  chatId: string,
  messageId: number
): Promise<ReadReceipt[]> {
  const { data, error } = await supabase.rpc("get_message_readers", {
    p_chat_id: chatId,
    p_message_id: messageId,
  })

  if (error) {
    console.error("[read-receipts] Failed to get message readers:", error)
    return []
  }

  return (data || []) as ReadReceipt[]
}

/**
 * Get the current user's read status for a chat
 */
export async function getUserReadStatus(
  supabase: TypedSupabaseClient,
  chatId: string,
  userId: string
): Promise<ChatReadStatus | null> {
  const { data, error } = await supabase
    .from("chat_read_receipts")
    .select("chat_id, user_id, last_read_message_id, read_at")
    .eq("chat_id", chatId)
    .eq("user_id", userId)
    .single()

  if (error || !data) {
    return null
  }

  return {
    chat_id: data.chat_id,
    user_id: data.user_id,
    last_read_message_id: data.last_read_message_id,
    read_at: data.read_at,
  }
}
