/**
 * Notion OAuth State Manager
 *
 * Handles CSRF protection via OAuth state validation.
 * Stores state in a short-lived cache for validation during callback.
 */

import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { NOTION_OAUTH_CONFIG, NOTION_ERROR_MESSAGES } from "../config"
import crypto from "crypto"

// In-memory cache for OAuth state (fallback when Supabase not available)
// Note: This won't work across multiple server instances
const stateCache = new Map<string, { userId: string; timestamp: number }>()

// ============================================================================
// STATE GENERATION AND STORAGE
// ============================================================================

/**
 * Generate and store OAuth state for CSRF protection
 */
export async function generateOAuthState(userId: string): Promise<string> {
  // Generate cryptographically secure random state
  const state = crypto.randomBytes(32).toString("hex")
  const timestamp = Date.now()

  // Try to store in Supabase first (for distributed deployments)
  if (isSupabaseEnabled) {
    try {
      const supabase = await createClient()
      if (supabase) {
        // Store state with expiry
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("oauth_states")
          .upsert({
            state,
            user_id: userId,
            provider: "notion",
            expires_at: new Date(timestamp + NOTION_OAUTH_CONFIG.stateExpiry).toISOString(),
          })
          .select()
          .single()

        return state
      }
    } catch (error) {
      // Fall back to in-memory cache if Supabase storage fails
      console.warn("[NotionStateManager] Failed to store state in Supabase, using memory cache:", error)
    }
  }

  // Fallback to in-memory cache
  stateCache.set(state, { userId, timestamp })

  // Clean up expired states from memory cache
  cleanupExpiredStates()

  return state
}

/**
 * Validate OAuth state and return the associated user ID
 */
export async function validateOAuthState(state: string): Promise<string | null> {
  // Try Supabase first
  if (isSupabaseEnabled) {
    try {
      const supabase = await createClient()
      if (supabase) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("oauth_states")
          .select("user_id, expires_at")
          .eq("state", state)
          .eq("provider", "notion")
          .single()

        if (!error && data) {
          // Check expiry
          if (new Date(data.expires_at) > new Date()) {
            // Delete the state after validation (one-time use)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from("oauth_states")
              .delete()
              .eq("state", state)

            return data.user_id
          }

          // State expired, clean it up
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("oauth_states")
            .delete()
            .eq("state", state)
        }
      }
    } catch (error) {
      console.warn("[NotionStateManager] Failed to validate state in Supabase:", error)
    }
  }

  // Fallback to in-memory cache
  const cached = stateCache.get(state)
  if (!cached) {
    return null
  }

  // Check expiry
  if (Date.now() - cached.timestamp > NOTION_OAUTH_CONFIG.stateExpiry) {
    stateCache.delete(state)
    return null
  }

  // Delete state after validation (one-time use)
  stateCache.delete(state)
  return cached.userId
}

/**
 * Delete OAuth state (cleanup on error)
 */
export async function deleteOAuthState(state: string): Promise<void> {
  // Try Supabase first
  if (isSupabaseEnabled) {
    try {
      const supabase = await createClient()
      if (supabase) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("oauth_states")
          .delete()
          .eq("state", state)
          .eq("provider", "notion")
      }
    } catch (error) {
      console.warn("[NotionStateManager] Failed to delete state from Supabase:", error)
    }
  }

  // Also delete from memory cache
  stateCache.delete(state)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Clean up expired states from memory cache
 */
function cleanupExpiredStates(): void {
  const now = Date.now()
  for (const [state, data] of stateCache.entries()) {
    if (now - data.timestamp > NOTION_OAUTH_CONFIG.stateExpiry) {
      stateCache.delete(state)
    }
  }
}

/**
 * Build Notion OAuth authorization URL
 */
export function buildAuthorizationUrl(state: string): string {
  const clientId = process.env.NOTION_CLIENT_ID
  if (!clientId) {
    throw new Error(NOTION_ERROR_MESSAGES.notConfigured)
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_VERCEL_URL
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_VERCEL_URL must be set")
  }

  const protocol = baseUrl.includes("localhost") ? "http" : "https"
  const cleanUrl = baseUrl.replace(/^https?:\/\//, "")
  const redirectUri = `${protocol}://${cleanUrl}/api/notion-integration/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    owner: "user", // Request access as the user (not workspace)
    state,
  })

  return `${NOTION_OAUTH_CONFIG.authUrl}?${params.toString()}`
}
