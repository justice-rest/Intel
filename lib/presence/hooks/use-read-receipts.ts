"use client"

/**
 * Read Receipts Hook
 * Manages read status tracking for collaborative chats
 *
 * Features:
 * - Fetches current read receipts
 * - Real-time updates via Supabase subscription
 * - Marks messages as read
 * - Auto-marks when viewing messages
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { useUser } from "@/lib/user-store/provider"
import type { ChatReadStatus, ReadReceipt } from "@/lib/collaboration/read-receipts"

export interface ReadReceiptsContextValue {
  // Current read status for all users
  readStatuses: ChatReadStatus[]
  // Whether data is loading
  isLoading: boolean
  // Error if any
  error: Error | null
  // Current user's last read message ID
  myLastReadMessageId: number | null
  // Mark messages as read up to a specific message ID
  markAsRead: (lastMessageId: number) => Promise<void>
  // Get users who have read a specific message
  getReadersForMessage: (messageId: number) => ReadReceipt[]
  // Check if a message has been read by anyone other than current user
  hasBeenRead: (messageId: number) => boolean
}

interface UseReadReceiptsOptions {
  chatId: string
  /** Enable auto-marking when scrolling (default: true) */
  autoMark?: boolean
}

/**
 * Hook for managing read receipts in collaborative chats
 */
export function useReadReceipts({
  chatId,
  autoMark = true,
}: UseReadReceiptsOptions): ReadReceiptsContextValue {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const [readersCache, setReadersCache] = useState<Map<number, ReadReceipt[]>>(new Map())
  const lastMarkedRef = useRef<number>(0)
  const markingRef = useRef<boolean>(false)

  // Fetch read receipts
  const {
    data: readStatuses = [],
    isLoading,
    error,
    refetch,
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

    // Subscribe to read receipt changes
    const channel = supabase
      .channel(`read-receipts:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE
          schema: "public",
          table: "chat_read_receipts",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          // Invalidate and refetch on any change
          queryClient.invalidateQueries({ queryKey: ["read-receipts", chatId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId, user?.id, queryClient])

  // Mark messages as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (lastMessageId: number) => {
      if (!chatId || !user?.id) {
        throw new Error("Cannot mark as read: missing chatId or user")
      }

      // Skip if already marked this message or higher
      if (lastMessageId <= lastMarkedRef.current) {
        return
      }

      // Prevent concurrent marking
      if (markingRef.current) {
        return
      }

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

  // Mark messages as read
  const markAsRead = useCallback(
    async (lastMessageId: number) => {
      await markAsReadMutation.mutateAsync(lastMessageId)
    },
    [markAsReadMutation]
  )

  // Get readers for a specific message
  const getReadersForMessage = useCallback(
    (messageId: number): ReadReceipt[] => {
      // Check cache first
      if (readersCache.has(messageId)) {
        return readersCache.get(messageId) || []
      }

      // Calculate from current read statuses
      // Users who have read up to or beyond this message
      const readers: ReadReceipt[] = readStatuses
        .filter(
          (s) =>
            s.last_read_message_id >= messageId &&
            s.user_id !== user?.id // Exclude current user
        )
        .map((s) => ({
          user_id: s.user_id,
          display_name: null, // Would need to join with users table
          profile_image: null,
          read_at: s.read_at,
        }))

      return readers
    },
    [readStatuses, readersCache, user?.id]
  )

  // Check if message has been read by anyone else
  const hasBeenRead = useCallback(
    (messageId: number): boolean => {
      return readStatuses.some(
        (s) => s.last_read_message_id >= messageId && s.user_id !== user?.id
      )
    },
    [readStatuses, user?.id]
  )

  return {
    readStatuses,
    isLoading,
    error: error as Error | null,
    myLastReadMessageId,
    markAsRead,
    getReadersForMessage,
    hasBeenRead,
  }
}

/**
 * Hook to auto-mark messages as read when they come into view
 * Uses Intersection Observer for efficiency
 */
export function useAutoMarkAsRead({
  chatId,
  messageId,
  markAsRead,
  enabled = true,
}: {
  chatId: string
  messageId: number
  markAsRead: (id: number) => Promise<void>
  enabled?: boolean
}) {
  const elementRef = useRef<HTMLDivElement>(null)
  const hasMarkedRef = useRef(false)

  useEffect(() => {
    if (!enabled || !chatId || hasMarkedRef.current) return

    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && !hasMarkedRef.current) {
          hasMarkedRef.current = true
          markAsRead(messageId).catch((err) => {
            console.error("[read-receipts] Auto-mark failed:", err)
            hasMarkedRef.current = false // Allow retry
          })
        }
      },
      {
        root: null,
        rootMargin: "0px",
        threshold: 0.5, // 50% visible
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [chatId, messageId, markAsRead, enabled])

  return elementRef
}
