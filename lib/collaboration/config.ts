/**
 * Collaboration Configuration
 * Central configuration for chat collaboration features
 */

import { APP_DOMAIN } from "@/lib/config"

// Share link configuration
export const SHARE_LINK_CONFIG = {
  // Rate limiting for password attempts
  MAX_PASSWORD_ATTEMPTS: 5,
  PASSWORD_LOCKOUT_MINUTES: 15,

  // Token generation (matches migration: 32 bytes base64url)
  TOKEN_LENGTH: 43, // base64url of 32 bytes

  // URL patterns
  ACCEPT_PATH: "/collaborate", // /collaborate/[token]
} as const

/**
 * Generate full share link URL from token
 */
export function getShareLinkUrl(token: string): string {
  return `${APP_DOMAIN}${SHARE_LINK_CONFIG.ACCEPT_PATH}/${token}`
}

/**
 * Parse share link token from URL or raw token
 */
export function parseShareLinkToken(input: string): string | null {
  // If it's a full URL, extract the token
  if (input.includes("/")) {
    const parts = input.split("/")
    const token = parts[parts.length - 1]
    // Validate token format (base64url, ~43 chars)
    if (token && token.length >= 40 && token.length <= 50) {
      return token
    }
    return null
  }

  // If it's just a token
  if (input.length >= 40 && input.length <= 50) {
    return input
  }

  return null
}

// Realtime channel prefixes
export const REALTIME_CHANNELS = {
  PRESENCE: "presence:chat:",
  COLLAB: "collab:chat:",
  PERMISSIONS: "permissions:user:",
} as const

/**
 * Get presence channel name for a chat
 */
export function getPresenceChannel(chatId: string): string {
  return `${REALTIME_CHANNELS.PRESENCE}${chatId}`
}

/**
 * Get collaboration channel name for a chat (typing indicators, etc.)
 */
export function getCollabChannel(chatId: string): string {
  return `${REALTIME_CHANNELS.COLLAB}${chatId}`
}

/**
 * Get permissions channel name for a user (revocation signals)
 */
export function getPermissionsChannel(userId: string): string {
  return `${REALTIME_CHANNELS.PERMISSIONS}${userId}`
}

// Presence timing configuration
export const PRESENCE_CONFIG = {
  HEARTBEAT_INTERVAL_MS: 30000, // 30 seconds
  IDLE_THRESHOLD_MS: 60000, // 1 minute
  AWAY_THRESHOLD_MS: 300000, // 5 minutes
} as const

// Typing indicator configuration
export const TYPING_CONFIG = {
  DEBOUNCE_MS: 300, // Wait 300ms before broadcasting typing start
  TIMEOUT_MS: 5000, // Auto-clear after 5 seconds of no stop event
} as const
