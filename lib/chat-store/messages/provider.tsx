"use client"

import { toast } from "@/components/ui/toast"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { useStandaloneChatSession } from "@/lib/chat-store/session/standalone-provider"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import type { Message as MessageAISDK } from "ai"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { writeToIndexedDB } from "../persist"
import {
  cacheMessages,
  clearMessagesForChat,
  getCachedMessages,
  getMessagesFromDb,
  setMessages as saveMessages,
} from "./api"

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

  // Subscribe to realtime updates for message changes (verification updates)
  useEffect(() => {
    if (!chatId || !isSupabaseEnabled) return

    const supabase = createClient()
    if (!supabase) return

    const channel = supabase
      .channel(`messages-updates:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          // Update the specific message in state when it's updated (e.g., after verification)
          const updatedMessage = payload.new as {
            id: number // Database ID is a number
            content: string
            verified?: boolean
            verifying?: boolean
            verification_result?: Record<string, unknown>
          }

          // Convert to string for comparison since message IDs in state are strings
          const updatedMessageId = String(updatedMessage.id)

          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === updatedMessageId) {
                // Update content and add verification metadata
                return {
                  ...msg,
                  content: updatedMessage.content,
                  verified: updatedMessage.verified,
                  verifying: updatedMessage.verifying,
                  verification_result: updatedMessage.verification_result,
                } as MessageAISDK
              }
              return msg
            })
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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
