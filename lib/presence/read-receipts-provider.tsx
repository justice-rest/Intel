"use client"

/**
 * Read Receipts Provider
 * Provides read receipt context to all chat components
 *
 * Features:
 * - Manages read status state
 * - Real-time subscription for updates
 * - Auto-marks messages when scrolling
 * - Exposes read status to child components
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { useUser } from "@/lib/user-store/provider"
import { useCollaboratorsOptional } from "@/lib/collaboration"
import type { ChatReadStatus } from "@/lib/collaboration/read-receipts"

export interface ReadReceiptsContextValue {
  /** All read statuses for the chat */
  readStatuses: ChatReadStatus[]
  /** Whether data is loading */
  isLoading: boolean
  /** Current user's last read message ID */
  myLastReadMessageId: number | null
  /** Mark messages as read up to a message ID */
  markAsRead: (lastMessageId: number) => Promise<void>
  /** Check if a message has been read by anyone else */
  hasBeenRead: (messageId: number) => boolean
  /** Get count of readers for a message (excluding current user) */
  getReaderCount: (messageId: number) => number
  /** Collaborators data for avatar display */
  collaborators: Array<{
    user_id: string
    user?: {
      display_name: string | null
      profile_image: string | null
      email?: string | null
    }
  }>
  /** Whether this is a collaborative chat (has multiple collaborators) */
  isCollaborativeChat: boolean
}

const ReadReceiptsContext = createContext<ReadReceiptsContextValue | null>(null)

export function useReadReceiptsContext(): ReadReceiptsContextValue | null {
  return useContext(ReadReceiptsContext)
}

export function useReadReceipts(): ReadReceiptsContextValue {
  const context = useContext(ReadReceiptsContext)
  if (!context) {
    throw new Error("useReadReceipts must be used within a ReadReceiptsProvider")
  }
  return context
}

interface ReadReceiptsProviderProps {
  chatId: string
  children: ReactNode
}

export function ReadReceiptsProvider({
  chatId,
  children,
}: ReadReceiptsProviderProps) {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const collaboratorsContext = useCollaboratorsOptional()
  const lastMarkedRef = useRef<number>(0)
  const markingRef = useRef<boolean>(false)

  // Fetch read receipts
  const {
    data: readStatuses = [],
    isLoading,
  } = useQuery({
    queryKey: ["read-receipts", chatId],
    queryFn: async () => {
      if (!chatId || !isSupabaseEnabled) return []

      const res = await fetch(`/api/chats/${chatId}/read`)
      if (!res.ok) {
        if (res.status === 403) return []
        throw new Error("Failed to fetch read receipts")
      }

      const data = await res.json()
      return (data.receipts || []) as ChatReadStatus[]
    },
    enabled: !!chatId && !!user?.id && isSupabaseEnabled,
    staleTime: 10000, // 10 seconds
    refetchOnWindowFocus: true,
  })

  // Subscribe to real-time updates
  useEffect(() => {
    if (!chatId || !user?.id || !isSupabaseEnabled) return

    const supabase = createClient()
    if (!supabase) return

    // Generate unique instance ID for this subscription (prevents "subscribe multiple times" error in split-view)
    const instanceId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    let isCancelled = false

    // Subscribe to read receipt changes
    const channel = supabase
      .channel(`read-receipts:${chatId}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_read_receipts",
          filter: `chat_id=eq.${chatId}`,
        },
        () => {
          if (!isCancelled) {
            // Invalidate and refetch on any change
            queryClient.invalidateQueries({ queryKey: ["read-receipts", chatId] })
          }
        }
      )
      .subscribe()

    return () => {
      isCancelled = true
      supabase.removeChannel(channel)
    }
  }, [chatId, user?.id, queryClient])

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (lastMessageId: number) => {
      if (!chatId || !user?.id) return

      // Skip if already marked this or higher
      if (lastMessageId <= lastMarkedRef.current) return

      // Prevent concurrent marking
      if (markingRef.current) return

      markingRef.current = true

      try {
        const res = await fetch(`/api/chats/${chatId}/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastMessageId }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Failed to mark as read")
        }

        lastMarkedRef.current = lastMessageId
      } finally {
        markingRef.current = false
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["read-receipts", chatId] })
    },
  })

  // Get my last read message ID
  const myLastReadMessageId = user?.id
    ? readStatuses.find((s) => s.user_id === user.id)?.last_read_message_id ?? null
    : null

  // Mark as read handler
  const markAsRead = useCallback(
    async (lastMessageId: number) => {
      await markAsReadMutation.mutateAsync(lastMessageId)
    },
    [markAsReadMutation]
  )

  // Check if message has been read
  const hasBeenRead = useCallback(
    (messageId: number): boolean => {
      return readStatuses.some(
        (s) => s.last_read_message_id >= messageId && s.user_id !== user?.id
      )
    },
    [readStatuses, user?.id]
  )

  // Get reader count
  const getReaderCount = useCallback(
    (messageId: number): number => {
      return readStatuses.filter(
        (s) => s.last_read_message_id >= messageId && s.user_id !== user?.id
      ).length
    },
    [readStatuses, user?.id]
  )

  // Transform collaborators for component use
  const collaborators = (collaboratorsContext?.collaborators || []).map((c) => ({
    user_id: c.user_id,
    user: c.user
      ? {
          display_name: c.user.display_name,
          profile_image: c.user.profile_image,
          email: c.user.email,
        }
      : undefined,
  }))

  // A chat is collaborative if it has more than 1 collaborator (owner + at least 1 other)
  const isCollaborativeChat = (collaboratorsContext?.collaborators?.length ?? 0) > 1

  const value: ReadReceiptsContextValue = {
    readStatuses,
    isLoading,
    myLastReadMessageId,
    markAsRead,
    hasBeenRead,
    getReaderCount,
    collaborators,
    isCollaborativeChat,
  }

  return (
    <ReadReceiptsContext.Provider value={value}>
      {children}
    </ReadReceiptsContext.Provider>
  )
}
