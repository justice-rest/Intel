/**
 * OAuth State Manager
 * Manages temporary OAuth state for CSRF protection
 */

import crypto from "crypto"
import { GOOGLE_OAUTH_CONFIG } from "../config"
import type { GoogleOAuthState } from "../types"

// Temporary storage for OAuth state (in production, use Redis or DB)
// This is acceptable for OAuth state which is short-lived
const stateStore = new Map<string, { state: GoogleOAuthState; expiresAt: number }>()

// Cleanup expired states periodically
function cleanupExpiredStates() {
  const now = Date.now()
  for (const [key, value] of stateStore.entries()) {
    if (value.expiresAt < now) {
      stateStore.delete(key)
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupExpiredStates, 5 * 60 * 1000)
}

/**
 * Store OAuth state for CSRF protection
 */
export function storeOAuthState(state: GoogleOAuthState): string {
  const stateKey = crypto.randomBytes(32).toString("hex")
  const expiresAt = Date.now() + GOOGLE_OAUTH_CONFIG.stateExpiry

  stateStore.set(stateKey, { state, expiresAt })

  return stateKey
}

/**
 * Retrieve and validate OAuth state
 */
export function retrieveOAuthState(stateKey: string): GoogleOAuthState | null {
  const stored = stateStore.get(stateKey)

  if (!stored) {
    return null
  }

  // Check if expired
  if (stored.expiresAt < Date.now()) {
    stateStore.delete(stateKey)
    return null
  }

  // Remove state after retrieval (one-time use)
  stateStore.delete(stateKey)

  return stored.state
}
