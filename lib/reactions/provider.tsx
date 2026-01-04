"use client"

/**
 * Reactions Provider
 * Real-time emoji reactions for messages in collaborative chats
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { useUser } from "@/lib/user-store/provider"
import type {
  Reaction,
  ReactionGroup,
  ReactionsContextValue,
} from "./types"

const ReactionsContext = createContext<ReactionsContextValue | null>(null)

export function useReactions(): ReactionsContextValue {
  const context = useContext(ReactionsContext)
  if (!context) {
    throw new Error("useReactions must be used within a ReactionsProvider")
  }
  return context
}

// Optional hook that returns null outside provider
export function useReactionsOptional(): ReactionsContextValue | null {
  return useContext(ReactionsContext)
}

interface ReactionsProviderProps {
  chatId: string | null
  children: ReactNode
}

export function ReactionsProvider({ chatId, children }: ReactionsProviderProps) {
  const { user } = useUser()
  const [reactions, setReactions] = useState<Map<number, Reaction[]>>(new Map())
  const [userCache, setUserCache] = useState<Map<string, { display_name: string | null; profile_image: string | null }>>(new Map())
  const [isLoading, setIsLoading] = useState(false)

  // Fetch initial reactions for all messages in the chat
  useEffect(() => {
    if (!chatId || !isSupabaseEnabled) return

    const supabase = createClient()
    if (!supabase) return

    let cancelled = false

    const fetchReactions = async () => {
      setIsLoading(true)
      try {
        // Get all message IDs for this chat
        const { data: messages } = await supabase
          .from("messages")
          .select("id")
          .eq("chat_id", chatId)

        if (cancelled || !messages?.length) {
          setIsLoading(false)
          return
        }

        const messageIds = messages.map((m) => m.id)

        // Get all reactions for these messages
        const { data: reactionsData, error } = await supabase
          .from("message_reactions")
          .select(`
            id,
            message_id,
            user_id,
            emoji,
            created_at
          `)
          .in("message_id", messageIds)
          .order("created_at", { ascending: true })

        if (error) {
          console.error("[reactions] Failed to fetch reactions:", error)
          setIsLoading(false)
          return
        }

        if (cancelled) return

        // Group reactions by message_id
        const reactionsMap = new Map<number, Reaction[]>()
        for (const r of reactionsData || []) {
          const existing = reactionsMap.get(r.message_id) || []
          existing.push(r)
          reactionsMap.set(r.message_id, existing)
        }
        setReactions(reactionsMap)

        // Fetch user info for all unique user IDs
        const userIds = [...new Set((reactionsData || []).map((r) => r.user_id))]
        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("id, display_name, profile_image")
            .in("id", userIds)

          if (usersData) {
            const cache = new Map<string, { display_name: string | null; profile_image: string | null }>()
            for (const u of usersData) {
              cache.set(u.id, { display_name: u.display_name, profile_image: u.profile_image })
            }
            setUserCache(cache)
          }
        }
      } catch (err) {
        console.error("[reactions] Error fetching reactions:", err)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchReactions()

    return () => {
      cancelled = true
    }
  }, [chatId])

  // Subscribe to real-time reaction changes
  useEffect(() => {
    if (!chatId || !isSupabaseEnabled) return

    const supabase = createClient()
    if (!supabase) return

    // Get message IDs for this chat (we need them for filtering)
    let messageIds: number[] = []

    const setupSubscription = async () => {
      const { data: messages } = await supabase
        .from("messages")
        .select("id")
        .eq("chat_id", chatId)

      messageIds = messages?.map((m) => m.id) || []

      // We can't filter by message_id in realtime, so we filter in the handler
      const channel = supabase
        .channel(`reactions:${chatId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "message_reactions",
          },
          async (payload) => {
            const newReaction = payload.new as Reaction

            // Check if this reaction belongs to our chat's messages
            if (!messageIds.includes(newReaction.message_id)) return

            setReactions((prev) => {
              const newMap = new Map(prev)
              const existing = newMap.get(newReaction.message_id) || []
              // Don't add if already exists
              if (existing.some((r) => r.id === newReaction.id)) return prev
              newMap.set(newReaction.message_id, [...existing, newReaction])
              return newMap
            })

            // Fetch user info if not cached
            if (!userCache.has(newReaction.user_id)) {
              const { data: userData } = await supabase
                .from("users")
                .select("id, display_name, profile_image")
                .eq("id", newReaction.user_id)
                .single()

              if (userData) {
                setUserCache((prev) => {
                  const newCache = new Map(prev)
                  newCache.set(userData.id, {
                    display_name: userData.display_name,
                    profile_image: userData.profile_image,
                  })
                  return newCache
                })
              }
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "message_reactions",
          },
          (payload) => {
            const deletedReaction = payload.old as Reaction

            // Check if this reaction belongs to our chat's messages
            if (!messageIds.includes(deletedReaction.message_id)) return

            setReactions((prev) => {
              const newMap = new Map(prev)
              const existing = newMap.get(deletedReaction.message_id) || []
              const filtered = existing.filter((r) => r.id !== deletedReaction.id)
              if (filtered.length === 0) {
                newMap.delete(deletedReaction.message_id)
              } else {
                newMap.set(deletedReaction.message_id, filtered)
              }
              return newMap
            })
          }
        )
        .subscribe()

      return channel
    }

    let channelRef: RealtimeChannel | null = null
    setupSubscription().then((channel) => {
      channelRef = channel
    })

    return () => {
      if (channelRef) {
        const supabase = createClient()
        supabase?.removeChannel(channelRef)
      }
    }
  }, [chatId, userCache])

  // Get reactions for a specific message, grouped by emoji
  const getReactionsForMessage = useCallback(
    (messageId: number): ReactionGroup[] => {
      const messageReactions = reactions.get(messageId) || []

      // Group by emoji
      const emojiGroups = new Map<string, ReactionGroup>()

      for (const reaction of messageReactions) {
        const existing = emojiGroups.get(reaction.emoji)
        const userInfo = userCache.get(reaction.user_id)

        if (existing) {
          existing.count++
          existing.users.push({
            user_id: reaction.user_id,
            display_name: userInfo?.display_name || null,
            profile_image: userInfo?.profile_image || null,
          })
          if (reaction.user_id === user?.id) {
            existing.hasReacted = true
          }
        } else {
          emojiGroups.set(reaction.emoji, {
            emoji: reaction.emoji,
            count: 1,
            users: [{
              user_id: reaction.user_id,
              display_name: userInfo?.display_name || null,
              profile_image: userInfo?.profile_image || null,
            }],
            hasReacted: reaction.user_id === user?.id,
          })
        }
      }

      return Array.from(emojiGroups.values())
    },
    [reactions, userCache, user?.id]
  )

  // Add a reaction
  const addReaction = useCallback(
    async (messageId: number, emoji: string) => {
      if (!user?.id || !isSupabaseEnabled) return

      const supabase = createClient()
      if (!supabase) return

      try {
        const { error } = await supabase
          .from("message_reactions")
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji,
          })

        if (error) {
          // Ignore duplicate error (user already reacted with this emoji)
          if (error.code !== "23505") {
            console.error("[reactions] Failed to add reaction:", error)
          }
        }
      } catch (err) {
        console.error("[reactions] Error adding reaction:", err)
      }
    },
    [user?.id]
  )

  // Remove a reaction
  const removeReaction = useCallback(
    async (messageId: number, emoji: string) => {
      if (!user?.id || !isSupabaseEnabled) return

      const supabase = createClient()
      if (!supabase) return

      try {
        const { error } = await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", user.id)
          .eq("emoji", emoji)

        if (error) {
          console.error("[reactions] Failed to remove reaction:", error)
        }
      } catch (err) {
        console.error("[reactions] Error removing reaction:", err)
      }
    },
    [user?.id]
  )

  // Toggle a reaction
  const toggleReaction = useCallback(
    async (messageId: number, emoji: string) => {
      const groups = getReactionsForMessage(messageId)
      const group = groups.find((g) => g.emoji === emoji)

      if (group?.hasReacted) {
        await removeReaction(messageId, emoji)
      } else {
        await addReaction(messageId, emoji)
      }
    },
    [getReactionsForMessage, addReaction, removeReaction]
  )

  const value: ReactionsContextValue = {
    getReactionsForMessage,
    addReaction,
    removeReaction,
    toggleReaction,
    isLoading,
  }

  return (
    <ReactionsContext.Provider value={value}>
      {children}
    </ReactionsContext.Provider>
  )
}
