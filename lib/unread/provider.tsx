"use client"

/**
 * Unread Messages Provider
 * Manages unread message counts across all chats for the current user.
 *
 * Features:
 * - Fetches unread counts on mount
 * - Provides getUnreadCount helper
 * - Can be invalidated when messages are read
 */

import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { useUser } from "@/lib/user-store/provider"

interface UnreadContextValue {
  /** Map of chatId -> unread count */
  unreadCounts: Record<string, number>
  /** Whether data is loading */
  isLoading: boolean
  /** Get unread count for a specific chat */
  getUnreadCount: (chatId: string) => number
  /** Total unread count across all chats */
  totalUnread: number
  /** Refresh unread counts */
  refresh: () => void
  /** Mark a chat as read (clear unread count locally) */
  markChatRead: (chatId: string) => void
}

const UnreadContext = createContext<UnreadContextValue | null>(null)

export function useUnread(): UnreadContextValue {
  const context = useContext(UnreadContext)
  if (!context) {
    throw new Error("useUnread must be used within UnreadProvider")
  }
  return context
}

export function useUnreadOptional(): UnreadContextValue | null {
  return useContext(UnreadContext)
}

interface UnreadProviderProps {
  children: ReactNode
}

export function UnreadProvider({ children }: UnreadProviderProps) {
  const { user } = useUser()
  const queryClient = useQueryClient()

  // Fetch unread counts
  const {
    data: unreadCounts = {},
    isLoading,
  } = useQuery({
    queryKey: ["unread-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      if (!isSupabaseEnabled) return {}

      try {
        const res = await fetch("/api/unread-counts")
        if (!res.ok) {
          console.warn("[unread] Failed to fetch counts:", res.status)
          return {}
        }

        const data = await res.json()
        return data.counts || {}
      } catch (error) {
        console.error("[unread] Error fetching counts:", error)
        return {}
      }
    },
    enabled: !!user?.id && isSupabaseEnabled,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
    refetchOnWindowFocus: true,
  })

  // Get unread count for a specific chat
  const getUnreadCount = useCallback(
    (chatId: string): number => {
      return unreadCounts[chatId] || 0
    },
    [unreadCounts]
  )

  // Calculate total unread
  const totalUnread = Object.values(unreadCounts).reduce(
    (sum, count) => sum + count,
    0
  )

  // Refresh unread counts
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["unread-counts"] })
  }, [queryClient])

  // Mark a chat as read (optimistic update + API call)
  const markChatRead = useCallback(
    async (chatId: string) => {
      // Optimistic update - immediately remove unread count
      queryClient.setQueryData<Record<string, number>>(
        ["unread-counts"],
        (prev) => {
          if (!prev) return prev
          const updated = { ...prev }
          delete updated[chatId]
          return updated
        }
      )

      // Call the API to persist the read status
      try {
        const res = await fetch("/api/mark-chat-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId }),
        })

        if (!res.ok) {
          console.warn("[unread] Failed to mark chat as read:", res.status)
        }
      } catch (error) {
        console.error("[unread] Error marking chat as read:", error)
      }
    },
    [queryClient]
  )

  const value: UnreadContextValue = {
    unreadCounts,
    isLoading,
    getUnreadCount,
    totalUnread,
    refresh,
    markChatRead,
  }

  return (
    <UnreadContext.Provider value={value}>
      {children}
    </UnreadContext.Provider>
  )
}
