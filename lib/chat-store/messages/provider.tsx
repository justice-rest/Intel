"use client"

import { toast } from "@/components/ui/toast"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { useStandaloneChatSession } from "@/lib/chat-store/session/standalone-provider"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { useUnreadOptional } from "@/lib/unread"
import { useNotificationsOptional } from "@/lib/notifications"
import { useChats } from "@/lib/chat-store/chats/provider"
import type { UIMessage as MessageAISDK } from "ai"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { writeToIndexedDB } from "../persist"
import {
  cacheMessages,
  clearMessagesForChat,
  getCachedMessages,
  getMessagesFromDb,
  setMessages as saveMessages,
} from "./api"
import type { AppMessage } from "@/app/types/message.types"
import { getCreatedAt } from "@/app/types/message.types"

interface MessagesContextType {
  messages: MessageAISDK[]
  isLoading: boolean
  setMessages: React.Dispatch<React.SetStateAction<MessageAISDK[]>>
  refresh: () => Promise<void>
  saveAllMessages: (messages: MessageAISDK[]) => Promise<void>
  cacheAndAddMessage: (message: MessageAISDK) => Promise<void>
  resetMessages: () => Promise<void>
  deleteMessages: () => Promise<void>
}

const MessagesContext = createContext<MessagesContextType | null>(null)

export function useMessages() {
  const context = useContext(MessagesContext)
  if (!context)
    throw new Error("useMessages must be used within MessagesProvider")
  return context
}

export function MessagesProvider({
  children,
  chatIdOverride,
}: {
  children: React.ReactNode
  chatIdOverride?: string | null
}) {
  const [messages, setMessages] = useState<MessageAISDK[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const urlSession = useChatSession()
  const standaloneSession = useStandaloneChatSession()
  const prevChatIdRef = useRef<string | null | undefined>(undefined)

  // Priority: prop override > standalone context > URL-based context
  const chatId =
    chatIdOverride !== undefined
      ? chatIdOverride
      : standaloneSession.chatId ?? urlSession.chatId

  // Get unread context to mark chat as read when viewing
  const unreadContext = useUnreadOptional()

  // Get notifications context to show notifications for new messages
  const notificationsContext = useNotificationsOptional()

  // Get chats context to get chat title for notifications
  const { chats } = useChats()

  useEffect(() => {
    // Track if this is initial mount (not a chatId change during navigation)
    const isInitialMount = prevChatIdRef.current === undefined
    prevChatIdRef.current = chatId

    // Handle null chatId - clear messages
    if (chatId === null) {
      setMessages([])
      setIsLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      // Only show loading state on initial mount, not during navigation
      // This prevents flash during chat-to-chat navigation
      if (isInitialMount) {
        setIsLoading(true)
      }

      const cached = await getCachedMessages(chatId)
      if (cancelled) return

      // Set cached messages immediately - this is the key to preventing flash
      // During navigation: old messages → cached messages (no empty state)
      setMessages(cached)

      try {
        const fresh = await getMessagesFromDb(chatId)
        if (cancelled) return
        // Only update if we got actual data from Supabase
        // Don't overwrite cached messages with empty results (could be network error)
        if (fresh.length > 0 || cached.length === 0) {
          const hasChanged =
            cached.length !== fresh.length ||
            fresh.some((m) => !cached.find((c) => c.id === m.id))
          if (hasChanged) {
            setMessages(fresh)
          }
          cacheMessages(chatId, fresh)
        }
        // If fresh is empty but cache has data, keep showing cached messages

        // Mark chat as read when viewing (after messages are loaded)
        if (chatId && unreadContext?.markChatRead) {
          unreadContext.markChatRead(chatId)
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [chatId])

  // Subscribe to realtime updates for message changes (verification updates + collaboration)
  useEffect(() => {
    if (!chatId || !isSupabaseEnabled) return

    const supabase = createClient()
    if (!supabase) return

    // Store current user ID in a ref-like variable that persists across the effect
    // We'll fetch it once and use it in handlers
    let currentUserId: string | null = null
    let userIdFetched = false
    let isSubscribed = false
    let isCancelled = false

    // Generate unique instance ID for this subscription (prevents "subscribe multiple times" error in split-view)
    const instanceId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

    const setupSubscription = async () => {
      if (isCancelled) return null

      // Fetch user ID BEFORE setting up handlers
      try {
        const { data } = await supabase.auth.getUser()
        currentUserId = data.user?.id || null
        userIdFetched = true
      } catch (error) {
        console.error("Failed to get current user for realtime:", error)
        userIdFetched = true // Still mark as fetched to allow subscription
      }

      if (isCancelled) return null

      const channel = supabase
        .channel(`messages-updates:${chatId}:${instanceId}`)
        // Handle UPDATE events (existing behavior - verification updates, etc.)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `chat_id=eq.${chatId}`,
          },
          (payload) => {
            // Update the specific message in state when it's updated
            const updatedMessage = payload.new as {
              id: number // Database ID is a number
              content: string
            }

            // Convert to string for comparison since message IDs in state are strings
            const updatedMessageId = String(updatedMessage.id)

            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === updatedMessageId) {
                  return {
                    ...msg,
                    content: updatedMessage.content,
                  } as MessageAISDK
                }
                return msg
              })
            )
          }
        )
        // Handle INSERT events (new messages from collaborators)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `chat_id=eq.${chatId}`,
          },
          (payload) => {
            const newMessage = payload.new as {
              id: number
              content: string
              role: string
              user_id: string | null
              parts: unknown[] | null
              experimental_attachments: unknown[] | null
              model: string | null
              created_at: string
            }

            // Skip if this is our own USER message (we already have it via optimistic update)
            // IMPORTANT: Only skip if user_id matches AND both are non-null
            // Assistant messages have user_id = null, which should NOT be skipped
            // This prevents the null === null race condition
            if (
              userIdFetched &&
              currentUserId !== null &&
              newMessage.user_id !== null &&
              newMessage.user_id === currentUserId
            ) {
              return
            }

            // Trigger notification for new message from collaborator
            // Only for user messages (role === "user") from other users
            if (
              notificationsContext?.isEnabled &&
              newMessage.role === "user" &&
              newMessage.user_id !== null &&
              chatId
            ) {
              const chat = chats.find((c) => c.id === chatId)
              notificationsContext.showMessageNotification({
                chatId,
                chatTitle: chat?.title || "Chat",
                senderName: "Collaborator", // We don't have the sender name here
                messagePreview: newMessage.content || "New message",
              })
            }

            const messageId = String(newMessage.id)

            // Check if message already exists (avoid duplicates)
            setMessages((prev) => {
              const exists = prev.some((msg) => msg.id === messageId)
              if (exists) {
                return prev
              }

              // Get effective content - fallback to placeholder if empty (xAI/Grok requires non-empty)
              let effectiveContent = newMessage.content || ""
              if (!effectiveContent.trim()) {
                // Try to extract from parts if available
                if (newMessage.parts && Array.isArray(newMessage.parts)) {
                  const texts: string[] = []
                  for (const part of newMessage.parts as Array<{ type?: string; text?: string }>) {
                    if (part?.type === "text" && part.text?.trim()) {
                      texts.push(part.text)
                    }
                  }
                  effectiveContent = texts.join("\n")
                }
                // Final fallback
                if (!effectiveContent.trim()) {
                  effectiveContent = newMessage.role === "assistant" ? "[Assistant response]" : "[User message]"
                }
              }

              // Convert DB message to AI SDK format
              // Include user_id for sender attribution in collaborative chats
              // Filter "data" role to be valid AI SDK role
              // In AI SDK v5, UIMessage uses parts array instead of content string
              const validRole = newMessage.role === "data" ? "assistant" : (newMessage.role as "user" | "assistant" | "system")
              const aiMessage = {
                id: messageId,
                parts: [{ type: "text" as const, text: effectiveContent }],
                role: validRole,
                createdAt: new Date(newMessage.created_at),
                user_id: newMessage.user_id || undefined,
              } as MessageAISDK & { user_id?: string }

              // Sort by created_at to maintain order
              const updated = [...prev, aiMessage].sort((a, b) => {
                const aTime = getCreatedAt(a as AppMessage)?.getTime() || 0
                const bTime = getCreatedAt(b as AppMessage)?.getTime() || 0
                return aTime - bTime
              })

              // Also cache the updated messages
              writeToIndexedDB("messages", { id: chatId, messages: updated })

              return updated
            })
          }
        )
        // Handle DELETE events (message deletion from collaborators)
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
            filter: `chat_id=eq.${chatId}`,
          },
          (payload) => {
            const deletedMessage = payload.old as { id: number }
            const deletedMessageId = String(deletedMessage.id)

            setMessages((prev) => {
              const updated = prev.filter((msg) => msg.id !== deletedMessageId)
              // Update cache
              writeToIndexedDB("messages", { id: chatId, messages: updated })
              return updated
            })
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            isSubscribed = true
          }
        })

      return channel
    }

    let channelRef: ReturnType<typeof supabase.channel> | null = null
    setupSubscription().then((channel) => {
      if (!isCancelled && channel) {
        channelRef = channel
      } else if (channel) {
        // Effect was cancelled while setting up, cleanup immediately
        supabase.removeChannel(channel)
      }
    })

    return () => {
      isCancelled = true
      if (channelRef) {
        supabase.removeChannel(channelRef)
      }
    }
  }, [chatId])

  const refresh = async () => {
    if (!chatId) return

    try {
      const fresh = await getMessagesFromDb(chatId)
      setMessages(fresh)
    } catch {
      toast({ title: "Failed to refresh messages", status: "error" })
    }
  }

  const cacheAndAddMessage = async (message: MessageAISDK) => {
    if (!chatId) return

    try {
      setMessages((prev) => {
        const updated = [...prev, message]
        writeToIndexedDB("messages", { id: chatId, messages: updated })
        return updated
      })
    } catch {
      toast({ title: "Failed to save message", status: "error" })
    }
  }

  const saveAllMessages = async (newMessages: MessageAISDK[]) => {
    // @todo: manage the case where the chatId is null (first time the user opens the chat)
    if (!chatId) return

    try {
      await saveMessages(chatId, newMessages)
      setMessages(newMessages)
    } catch {
      toast({ title: "Failed to save messages", status: "error" })
    }
  }

  const deleteMessages = async () => {
    if (!chatId) return

    setMessages([])
    await clearMessagesForChat(chatId)
  }

  const resetMessages = async () => {
    setMessages([])
  }

  return (
    <MessagesContext.Provider
      value={{
        messages,
        isLoading,
        setMessages,
        refresh,
        saveAllMessages,
        cacheAndAddMessage,
        resetMessages,
        deleteMessages,
      }}
    >
      {children}
    </MessagesContext.Provider>
  )
}
