"use client"

/**
 * Collaborative Messages Hook
 * Subscribes to real-time message INSERT/UPDATE/DELETE events for collaborative chats
 */

import { useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { useUser } from "@/lib/user-store/provider"
import type { Message as MessageAISDK } from "ai"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

interface DatabaseMessage {
  id: number
  chat_id: string
  user_id: string | null
  content: string | null
  role: string
  created_at: string | null
}

interface UseCollaborativeMessagesOptions {
  chatId: string
  currentMessages: MessageAISDK[]
  onMessageInserted?: (message: MessageAISDK) => void
  onMessageUpdated?: (message: MessageAISDK) => void
  onMessageDeleted?: (messageId: string) => void
}

/**
 * Convert database message to AI SDK message format
 */
function dbMessageToAISDK(dbMessage: DatabaseMessage): MessageAISDK {
  return {
    id: String(dbMessage.id),
    role: dbMessage.role as "user" | "assistant" | "system",
    content: dbMessage.content || "",
    createdAt: dbMessage.created_at ? new Date(dbMessage.created_at) : new Date(),
  }
}

/**
 * Hook to subscribe to collaborative message events
 * Handles INSERT, UPDATE, and DELETE events from other users
 */
export function useCollaborativeMessages({
  chatId,
  currentMessages,
  onMessageInserted,
  onMessageUpdated,
  onMessageDeleted,
}: UseCollaborativeMessagesOptions) {
  const { user } = useUser()

  // Handle INSERT events for messages from other users
  const handleInsert = useCallback(
    (payload: RealtimePostgresChangesPayload<DatabaseMessage>) => {
      if (payload.eventType !== "INSERT") return
      const newMessage = payload.new

      // Ignore messages from current user (handled by optimistic updates)
      if (newMessage.user_id === user?.id) return

      // Check if message already exists (race condition)
      const exists = currentMessages.some(
        (m) => m.id === String(newMessage.id)
      )
      if (exists) return

      const aiMessage = dbMessageToAISDK(newMessage)
      onMessageInserted?.(aiMessage)
    },
    [user?.id, currentMessages, onMessageInserted]
  )

  // Handle UPDATE events
  const handleUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<DatabaseMessage>) => {
      if (payload.eventType !== "UPDATE") return
      const updatedMessage = payload.new
      const aiMessage = dbMessageToAISDK(updatedMessage)
      onMessageUpdated?.(aiMessage)
    },
    [onMessageUpdated]
  )

  // Handle DELETE events
  const handleDelete = useCallback(
    (payload: RealtimePostgresChangesPayload<DatabaseMessage>) => {
      if (payload.eventType !== "DELETE") return
      const deletedId = String(payload.old.id)
      onMessageDeleted?.(deletedId)
    },
    [onMessageDeleted]
  )

  useEffect(() => {
    if (!chatId || !isSupabaseEnabled) return

    const supabase = createClient()
    if (!supabase) return

    // Subscribe to all message changes for this chat
    const channel = supabase
      .channel(`messages-collab:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        handleInsert
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        handleUpdate
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        handleDelete
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId, handleInsert, handleUpdate, handleDelete])
}
