/**
 * Message Reactions Types
 * Types for emoji reactions on messages in collaborative chats
 */

// A single reaction from a user
export interface Reaction {
  id: number
  message_id: number
  user_id: string
  emoji: string
  created_at: string
}

// Reaction with user info for display
export interface ReactionWithUser extends Reaction {
  user?: {
    display_name: string | null
    profile_image: string | null
  }
}

// Aggregated reactions for a message (grouped by emoji)
export interface ReactionGroup {
  emoji: string
  count: number
  users: {
    user_id: string
    display_name: string | null
    profile_image: string | null
  }[]
  hasReacted: boolean // Whether current user has reacted with this emoji
}

// Context value for reactions
export interface ReactionsContextValue {
  // Get reactions for a message
  getReactionsForMessage: (messageId: number) => ReactionGroup[]

  // Add a reaction
  addReaction: (messageId: number, emoji: string) => Promise<void>

  // Remove a reaction
  removeReaction: (messageId: number, emoji: string) => Promise<void>

  // Toggle a reaction (add if not present, remove if present)
  toggleReaction: (messageId: number, emoji: string) => Promise<void>

  // Loading state
  isLoading: boolean
}

// Common emojis for quick reactions
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const
export type QuickReaction = typeof QUICK_REACTIONS[number]
