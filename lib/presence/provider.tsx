"use client"

/**
 * Presence Provider
 * Real-time presence tracking and typing indicators for collaborative chats
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { useUser } from "@/lib/user-store/provider"
import {
  getPresenceChannel,
  getCollabChannel,
  PRESENCE_CONFIG,
  TYPING_CONFIG,
} from "@/lib/collaboration/config"
import type {
  PresenceContextValue,
  PresenceUser,
  PresenceStatus,
  TypingUser,
} from "./types"

const PresenceContext = createContext<PresenceContextValue | null>(null)

export function usePresence() {
  const context = useContext(PresenceContext)
  if (!context) {
    throw new Error("usePresence must be used within a PresenceProvider")
  }
  return context
}

// Optional hook that returns null outside provider (for conditional use)
export function usePresenceOptional(): PresenceContextValue | null {
  return useContext(PresenceContext)
}

interface PresenceProviderProps {
  chatId: string
  children: ReactNode
}

export function PresenceProvider({ chatId, children }: PresenceProviderProps) {
  const { user } = useUser()
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [myStatus, setMyStatus] = useState<PresenceStatus>("active")

  // Refs for cleanup
  const presenceChannelRef = useRef<RealtimeChannel | null>(null)
  const collabChannelRef = useRef<RealtimeChannel | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const awayTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Track last activity for idle detection
  const lastActivityRef = useRef<number>(Date.now())

  // Get user display info
  const displayName = user?.display_name || user?.email?.split("@")[0] || "Anonymous"
  const profileImage = user?.profile_image || null

  // Clear typing users that have timed out
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setTypingUsers((prev) =>
        prev.filter(
          (u) => now - u.started_at < TYPING_CONFIG.TIMEOUT_MS
        )
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Setup presence channel
  useEffect(() => {
    if (!chatId || !user?.id || !isSupabaseEnabled) return

    const supabase = createClient()
    if (!supabase) return

    const presenceChannel = supabase.channel(getPresenceChannel(chatId), {
      config: {
        presence: {
          key: user.id,
        },
      },
    })

    presenceChannelRef.current = presenceChannel

    // Track presence state changes
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState()
        const users: PresenceUser[] = []

        for (const [userId, presences] of Object.entries(state)) {
          // Get the most recent presence for this user
          // Supabase adds presence_ref to the tracked data
          const presenceData = presences[0] as (PresenceUser & { presence_ref?: string }) | undefined
          if (presenceData && userId !== user.id) {
            // Extract our PresenceUser fields
            users.push({
              user_id: presenceData.user_id,
              display_name: presenceData.display_name,
              profile_image: presenceData.profile_image,
              online_at: presenceData.online_at,
              status: presenceData.status,
            })
          }
        }

        setOnlineUsers(users)
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        // A user joined
        console.log("[presence] User joined:", key)
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        // A user left
        console.log("[presence] User left:", key)
        // Also remove from typing if they were typing
        setTypingUsers((prev) => prev.filter((u) => u.user_id !== key))
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true)
          // Track our presence
          await presenceChannel.track({
            user_id: user.id,
            display_name: displayName,
            profile_image: profileImage,
            online_at: Date.now(),
            status: myStatus,
          } as PresenceUser)
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setIsConnected(false)
        }
      })

    return () => {
      presenceChannel.unsubscribe()
      supabase.removeChannel(presenceChannel)
    }
  }, [chatId, user?.id, displayName, profileImage])

  // Setup collaboration channel for typing indicators
  useEffect(() => {
    if (!chatId || !user?.id || !isSupabaseEnabled) return

    const supabase = createClient()
    if (!supabase) return

    const collabChannel = supabase.channel(getCollabChannel(chatId))

    collabChannelRef.current = collabChannel

    collabChannel
      .on("broadcast", { event: "typing_start" }, ({ payload }) => {
        if (payload.user_id === user.id) return // Ignore own events

        setTypingUsers((prev) => {
          // Update or add typing user
          const existing = prev.findIndex((u) => u.user_id === payload.user_id)
          const typingUser: TypingUser = {
            user_id: payload.user_id,
            display_name: payload.display_name,
            started_at: Date.now(),
          }

          if (existing >= 0) {
            const updated = [...prev]
            updated[existing] = typingUser
            return updated
          }

          return [...prev, typingUser]
        })
      })
      .on("broadcast", { event: "typing_stop" }, ({ payload }) => {
        if (payload.user_id === user.id) return

        setTypingUsers((prev) =>
          prev.filter((u) => u.user_id !== payload.user_id)
        )
      })
      .subscribe()

    return () => {
      collabChannel.unsubscribe()
      supabase.removeChannel(collabChannel)
    }
  }, [chatId, user?.id])

  // Update presence status based on activity
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now()

    // Reset to active if idle/away
    if (myStatus !== "active") {
      setMyStatus("active")
    }

    // Clear existing timeouts
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current)
    if (awayTimeoutRef.current) clearTimeout(awayTimeoutRef.current)

    // Set idle timeout
    idleTimeoutRef.current = setTimeout(() => {
      setMyStatus("idle")
    }, PRESENCE_CONFIG.IDLE_THRESHOLD_MS)

    // Set away timeout
    awayTimeoutRef.current = setTimeout(() => {
      setMyStatus("away")
    }, PRESENCE_CONFIG.AWAY_THRESHOLD_MS)
  }, [myStatus])

  // Track user activity
  useEffect(() => {
    if (typeof window === "undefined") return

    const events = ["mousedown", "keydown", "scroll", "touchstart"]

    events.forEach((event) => {
      window.addEventListener(event, updateActivity, { passive: true })
    })

    // Initial activity
    updateActivity()

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, updateActivity)
      })
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current)
      if (awayTimeoutRef.current) clearTimeout(awayTimeoutRef.current)
    }
  }, [updateActivity])

  // Update presence channel when status changes
  useEffect(() => {
    if (!presenceChannelRef.current || !user?.id) return

    presenceChannelRef.current.track({
      user_id: user.id,
      display_name: displayName,
      profile_image: profileImage,
      online_at: Date.now(),
      status: myStatus,
    } as PresenceUser)
  }, [myStatus, user?.id, displayName, profileImage])

  // Set typing with debounce
  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!collabChannelRef.current || !user?.id) return

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }

      if (isTyping) {
        // Debounce typing start
        typingTimeoutRef.current = setTimeout(() => {
          collabChannelRef.current?.send({
            type: "broadcast",
            event: "typing_start",
            payload: {
              user_id: user.id,
              display_name: displayName,
            },
          })
        }, TYPING_CONFIG.DEBOUNCE_MS)
      } else {
        // Send stop immediately
        collabChannelRef.current.send({
          type: "broadcast",
          event: "typing_stop",
          payload: {
            user_id: user.id,
          },
        })
      }
    },
    [user?.id, displayName]
  )

  // Set status manually
  const setStatus = useCallback((status: PresenceStatus) => {
    setMyStatus(status)
  }, [])

  const value: PresenceContextValue = {
    onlineUsers,
    typingUsers,
    isConnected,
    myStatus,
    setTyping,
    setStatus,
  }

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  )
}
