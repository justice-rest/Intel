/**
 * OneDrive OAuth State Manager
 *
 * Handles CSRF protection for OAuth flow via state parameter.
 * Stores state in database with user ID association and expiry.
 */

import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import {
  ONEDRIVE_OAUTH_CONFIG,
  getOneDriveClientId,
  getOneDriveRedirectUri,
} from "../config"

/**
 * Generate a cryptographically secure random state
 */
function generateRandomState(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

/**
 * Generate OAuth state and store in database
 * Returns the state token to include in the OAuth URL
 */
export async function generateOAuthState(userId: string): Promise<string> {
  if (!isSupabaseEnabled) {
    throw new Error("Database is required for OAuth state management")
  }

  const supabase = await createClient()
  if (!supabase) {
    throw new Error("Failed to create database client")
  }

  const state = generateRandomState()
  const expiresAt = new Date(Date.now() + ONEDRIVE_OAUTH_CONFIG.stateExpiry)

  // Store state in oauth_states table (shared with other integrations)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("oauth_states")
    .insert({
      state,
      user_id: userId,
      provider: "onedrive",
      expires_at: expiresAt.toISOString(),
    })

  if (error) {
    console.error("[OneDriveStateManager] Failed to store state:", error)
    throw new Error("Failed to generate OAuth state")
  }

  return state
}

/**
 * Validate OAuth state from callback
 * Returns user ID if valid, null if invalid or expired
 */
export async function validateOAuthState(state: string): Promise<string | null> {
  if (!isSupabaseEnabled) {
    return null
  }

  const supabase = await createClient()
  if (!supabase) {
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Fetch and validate state
  const { data, error } = await sb
    .from("oauth_states")
    .select("user_id, expires_at")
    .eq("state", state)
    .eq("provider", "onedrive")
    .single()

  if (error || !data) {
    console.warn("[OneDriveStateManager] State not found:", state)
    return null
  }

  // Check expiry
  const expiresAt = new Date(data.expires_at)
  if (expiresAt < new Date()) {
    console.warn("[OneDriveStateManager] State expired:", state)
    // Clean up expired state
    await sb.from("oauth_states").delete().eq("state", state)
    return null
  }

  // Delete state after use (one-time use)
  await sb.from("oauth_states").delete().eq("state", state)

  return data.user_id
}

/**
 * Build the Microsoft OAuth authorization URL
 */
export function buildAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getOneDriveClientId(),
    response_type: "code",
    redirect_uri: getOneDriveRedirectUri(),
    response_mode: "query",
    scope: ONEDRIVE_OAUTH_CONFIG.scopes.join(" "),
    state,
    // Prompt for consent to ensure refresh token is returned
    prompt: "consent",
  })

  return `${ONEDRIVE_OAUTH_CONFIG.authUrl}?${params.toString()}`
}

/**
 * Clean up expired states (maintenance task)
 */
export async function cleanupExpiredStates(): Promise<void> {
  if (!isSupabaseEnabled) {
    return
  }

  const supabase = await createClient()
  if (!supabase) {
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("oauth_states")
    .delete()
    .eq("provider", "onedrive")
    .lt("expires_at", new Date().toISOString())

  if (error) {
    console.error("[OneDriveStateManager] Failed to cleanup states:", error)
  }
}
