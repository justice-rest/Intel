/**
 * Presence Types
 * Types for real-time presence and typing indicators
 */

// User presence state
export type PresenceStatus = "active" | "idle" | "away"

// User presence data tracked in channel
export interface PresenceUser {
  user_id: string
  display_name: string
  profile_image: string | null
  online_at: number
  status: PresenceStatus
}

// Typing indicator state
export interface TypingUser {
  user_id: string
  display_name: string
  started_at: number
}

// Revocation event payload
export interface RevocationEvent {
  chat_id: string
  reason: "removed_by_owner" | "self_removal" | "role_changed"
  new_role?: string
}

// Role change event payload
export interface RoleChangeEvent {
  chat_id: string
  new_role: string
}

// Presence context value
export interface PresenceContextValue {
  // Online users in the current chat
  onlineUsers: PresenceUser[]
  // Users currently typing
  typingUsers: TypingUser[]
  // Connection status
  isConnected: boolean
  // Current user's presence status
  myStatus: PresenceStatus
  // Actions
  setTyping: (isTyping: boolean) => void
  setStatus: (status: PresenceStatus) => void
}

// Message sync event types
export type MessageSyncEventType = "INSERT" | "UPDATE" | "DELETE"

export interface MessageSyncEvent {
  type: MessageSyncEventType
  message: {
    id: number
    chat_id: string
    user_id: string | null
    content: string | null
    role: string
    created_at: string | null
  }
}
