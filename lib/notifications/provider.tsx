"use client"

/**
 * Notifications Provider
 * Manages browser notifications for new messages and other events.
 *
 * Features:
 * - Request notification permission
 * - Show browser notifications for new messages
 * - Track notification preferences
 * - Handle notification clicks to navigate to chats
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"

type NotificationPermission = "default" | "granted" | "denied"

interface NotificationsContextValue {
  /** Current notification permission status */
  permission: NotificationPermission
  /** Whether notifications are supported in this browser */
  isSupported: boolean
  /** Whether notifications are enabled (permission granted + user hasn't disabled) */
  isEnabled: boolean
  /** Request permission to show notifications */
  requestPermission: () => Promise<boolean>
  /** Show a notification for a new message */
  showMessageNotification: (options: MessageNotificationOptions) => void
  /** Enable/disable notifications (user preference) */
  setEnabled: (enabled: boolean) => void
  /** Check if a specific chat is muted */
  isChatMuted: (chatId: string) => boolean
  /** Mute notifications for a specific chat */
  muteChat: (chatId: string) => void
  /** Unmute notifications for a specific chat */
  unmuteChat: (chatId: string) => void
  /** Get list of muted chat IDs */
  mutedChats: string[]
}

interface MessageNotificationOptions {
  chatId: string
  chatTitle: string
  senderName: string
  messagePreview: string
  senderAvatar?: string
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider")
  }
  return context
}

export function useNotificationsOptional(): NotificationsContextValue | null {
  return useContext(NotificationsContext)
}

interface NotificationsProviderProps {
  children: ReactNode
}

const STORAGE_KEY = "romy-notifications-enabled"
const MUTED_CHATS_KEY = "romy-muted-chats"

export function NotificationsProvider({ children }: NotificationsProviderProps) {
  const router = useRouter()
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [isSupported, setIsSupported] = useState(false)
  const [userEnabled, setUserEnabled] = useState(true)
  const [mutedChats, setMutedChats] = useState<string[]>([])

  // Check if notifications are supported
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setIsSupported(true)
      setPermission(Notification.permission as NotificationPermission)
    }

    // Load user preference
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setUserEnabled(stored === "true")
    }

    // Load muted chats
    const storedMuted = localStorage.getItem(MUTED_CHATS_KEY)
    if (storedMuted !== null) {
      try {
        const parsed = JSON.parse(storedMuted)
        if (Array.isArray(parsed)) {
          setMutedChats(parsed)
        }
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [])

  // Request permission to show notifications
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false

    try {
      const result = await Notification.requestPermission()
      setPermission(result as NotificationPermission)
      return result === "granted"
    } catch (error) {
      console.error("[notifications] Error requesting permission:", error)
      return false
    }
  }, [isSupported])

  // Show a notification for a new message
  const showMessageNotification = useCallback(
    ({
      chatId,
      chatTitle,
      senderName,
      messagePreview,
      senderAvatar,
    }: MessageNotificationOptions) => {
      // Don't show if not enabled or no permission
      if (!isSupported || permission !== "granted" || !userEnabled) {
        return
      }

      // Don't show if chat is muted
      if (mutedChats.includes(chatId)) {
        return
      }

      // Don't show if the window is focused (user is actively viewing)
      if (document.hasFocus()) {
        return
      }

      // Truncate message preview
      const truncatedPreview =
        messagePreview.length > 100
          ? messagePreview.substring(0, 100) + "..."
          : messagePreview

      const notification = new Notification(senderName, {
        body: truncatedPreview,
        icon: senderAvatar || "/icon-192.png",
        tag: `chat-${chatId}`, // Prevents duplicate notifications for same chat
        badge: "/icon-192.png",
        data: { chatId },
        silent: false,
        requireInteraction: false,
      })

      // Handle click - navigate to the chat
      notification.onclick = () => {
        window.focus()
        router.push(`/c/${chatId}`)
        notification.close()
      }

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close()
      }, 5000)
    },
    [isSupported, permission, userEnabled, mutedChats, router]
  )

  // Set user preference for notifications
  const setEnabled = useCallback((enabled: boolean) => {
    setUserEnabled(enabled)
    localStorage.setItem(STORAGE_KEY, String(enabled))
  }, [])

  // Check if a chat is muted
  const isChatMuted = useCallback(
    (chatId: string): boolean => {
      return mutedChats.includes(chatId)
    },
    [mutedChats]
  )

  // Mute a chat
  const muteChat = useCallback((chatId: string) => {
    setMutedChats((prev) => {
      if (prev.includes(chatId)) return prev
      const updated = [...prev, chatId]
      localStorage.setItem(MUTED_CHATS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // Unmute a chat
  const unmuteChat = useCallback((chatId: string) => {
    setMutedChats((prev) => {
      const updated = prev.filter((id) => id !== chatId)
      localStorage.setItem(MUTED_CHATS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const isEnabled = isSupported && permission === "granted" && userEnabled

  const value: NotificationsContextValue = {
    permission,
    isSupported,
    isEnabled,
    requestPermission,
    showMessageNotification,
    setEnabled,
    isChatMuted,
    muteChat,
    unmuteChat,
    mutedChats,
  }

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}
