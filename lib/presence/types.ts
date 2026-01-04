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

// AI Status - for broadcasting when AI is thinking/responding
export type AIStatusType = "idle" | "thinking" | "streaming" | "using_tools"

export interface AIStatus {
  user_id: string // Who triggered the AI
  display_name: string
  status: AIStatusType
  tool_name?: string // If using tools, which tool
  started_at: number
}

// Streaming content from a collaborator's AI
export interface StreamingContent {
  user_id: string
  display_name: string
  content: string
  parts?: unknown[]
  updated_at: number
}

// Extended presence context with AI status
export interface ExtendedPresenceContextValue extends PresenceContextValue {
  // AI status from all users in the chat
  aiStatus: AIStatus | null
  // Broadcast AI status to other collaborators
  broadcastAIStatus: (status: AIStatusType, toolName?: string) => void
  // Clear AI status
  clearAIStatus: () => void
  // Check if this is a collaborative chat (has other collaborators)
  isCollaborativeChat: boolean
  // Streaming content from another collaborator's AI
  collaboratorStreaming: StreamingContent | null
  // Broadcast streaming content to collaborators
  broadcastStreamingContent: (content: string, parts?: unknown[]) => void
  // Clear streaming content
  clearStreamingContent: () => void
}
