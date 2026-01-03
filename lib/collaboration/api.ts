/**
 * Collaboration API Utilities
 * Server-side helpers for collaboration API routes
 */

import { SupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/app/types/database.types"
import {
  CollaboratorRole,
  AccessLogAction,
  SHARE_LINK_RATE_LIMIT,
  hasMinimumRole,
} from "./types"

type TypedSupabaseClient = SupabaseClient<Database>

/**
 * Get user's role on a chat
 * Returns null if user has no access
 */
export async function getUserChatRole(
  supabase: TypedSupabaseClient,
  userId: string,
  chatId: string
): Promise<CollaboratorRole | null> {
  // First check if user is the original owner
  const { data: chat } = await supabase
    .from("chats")
    .select("user_id")
    .eq("id", chatId)
    .single()

  if (chat?.user_id === userId) {
    return "owner"
  }

  // Then check collaborators table
  const { data: collaborator } = await supabase
    .from("chat_collaborators")
    .select("role")
    .eq("chat_id", chatId)
    .eq("user_id", userId)
    .single()

  return (collaborator?.role as CollaboratorRole) || null
}

/**
 * Check if user has at least the required role on a chat
 */
export async function checkUserChatRole(
  supabase: TypedSupabaseClient,
  userId: string,
  chatId: string,
  requiredRole: CollaboratorRole
): Promise<{ hasAccess: boolean; userRole: CollaboratorRole | null }> {
  const userRole = await getUserChatRole(supabase, userId, chatId)
  const hasAccess = hasMinimumRole(userRole, requiredRole)
  return { hasAccess, userRole }
}

/**
 * Log an access event for audit trail
 * Uses service role to bypass RLS (logs are append-only)
 */
export async function logAccessEvent(
  supabase: TypedSupabaseClient,
  params: {
    chatId: string
    actorUserId: string | null
    targetUserId?: string | null
    action: AccessLogAction
    details?: Record<string, unknown>
  }
): Promise<void> {
  const { chatId, actorUserId, targetUserId, action, details } = params

  // Insert log entry - RLS policy allows inserts for authenticated users
  // or we can use service role for system-level logging
  // Cast details to Json type for Supabase compatibility
  await supabase.from("chat_access_log").insert({
    chat_id: chatId,
    actor_user_id: actorUserId,
    target_user_id: targetUserId || null,
    action,
    details: (details || {}) as { [key: string]: string | number | boolean | null },
  })
}

/**
 * Check if a share link is rate limited due to failed password attempts
 */
export function isShareLinkRateLimited(
  failedAttempts: number,
  lastFailedAt: string | null
): boolean {
  if (failedAttempts < SHARE_LINK_RATE_LIMIT.MAX_ATTEMPTS) {
    return false
  }

  if (!lastFailedAt) {
    return false
  }

  const lastAttempt = new Date(lastFailedAt)
  const windowEnd = new Date(
    lastAttempt.getTime() + SHARE_LINK_RATE_LIMIT.WINDOW_MINUTES * 60 * 1000
  )
  return new Date() < windowEnd
}

/**
 * Generate a cryptographically secure token for share links
 * Uses Web Crypto API for server-side generation
 */
export function generateSecureToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  // Convert to base64url (URL-safe base64)
  const base64 = Buffer.from(bytes).toString("base64")
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * Get collaborators for a chat with user details
 */
export async function getChatCollaborators(
  supabase: TypedSupabaseClient,
  chatId: string
) {
  const { data, error } = await supabase
    .from("chat_collaborators")
    .select(
      `
      id,
      chat_id,
      user_id,
      role,
      invited_by,
      invited_via_link_id,
      created_at,
      updated_at,
      users:user_id (
        id,
        display_name,
        email,
        profile_image
      )
    `
    )
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  // Transform the nested user data
  return (data || []).map((collab) => ({
    ...collab,
    user: collab.users,
    users: undefined,
  }))
}

/**
 * Get active share links for a chat
 */
export async function getChatShareLinks(
  supabase: TypedSupabaseClient,
  chatId: string
) {
  const { data, error } = await supabase
    .from("chat_share_links")
    .select("*")
    .eq("chat_id", chatId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  // Remove password_hash from response
  return (data || []).map((link) => ({
    ...link,
    password_hash: undefined,
    has_password: !!link.password_hash,
  }))
}

/**
 * Validate a share link for acceptance
 */
export async function validateShareLink(
  supabase: TypedSupabaseClient,
  token: string
): Promise<{
  valid: boolean
  link?: Database["public"]["Tables"]["chat_share_links"]["Row"]
  error?: string
  requiresPassword?: boolean
  isRateLimited?: boolean
}> {
  const { data: link, error } = await supabase
    .from("chat_share_links")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .single()

  if (error || !link) {
    return { valid: false, error: "Invalid or expired share link" }
  }

  // Check if link is revoked
  if (link.revoked_at) {
    return { valid: false, error: "This share link has been revoked" }
  }

  // Check if max uses reached
  if (link.max_uses !== null && link.use_count >= link.max_uses) {
    return { valid: false, error: "This share link has reached its usage limit" }
  }

  // Check rate limiting for password-protected links
  if (link.password_hash) {
    const isLimited = isShareLinkRateLimited(
      link.failed_attempts,
      link.last_failed_attempt_at
    )
    if (isLimited) {
      return {
        valid: false,
        error: "Too many failed attempts. Please try again later.",
        isRateLimited: true,
      }
    }
    return { valid: true, link, requiresPassword: true }
  }

  return { valid: true, link }
}

/**
 * Hash a password for share link protection
 * Note: In production, this calls the database function
 */
export async function hashShareLinkPassword(
  supabase: TypedSupabaseClient,
  password: string
): Promise<string> {
  const { data, error } = await supabase.rpc("hash_share_link_password", {
    p_password: password,
  })

  if (error) {
    throw new Error("Failed to hash password")
  }

  return data as string
}

/**
 * Verify a password for a share link
 */
export async function verifyShareLinkPassword(
  supabase: TypedSupabaseClient,
  linkId: string,
  password: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("verify_share_link_password", {
    p_link_id: linkId,
    p_password: password,
  })

  if (error) {
    console.error("Password verification error:", error)
    return false
  }

  return data as boolean
}
