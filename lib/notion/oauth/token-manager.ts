/**
 * Notion OAuth Token Manager
 *
 * Handles encrypted token storage and retrieval.
 * Note: Notion tokens do NOT expire, so no refresh functionality is needed.
 */

import { encryptKey, decryptKey } from "@/lib/encryption"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import {
  NOTION_OAUTH_CONFIG,
  NOTION_ERROR_MESSAGES,
} from "../config"
import type {
  NotionOAuthTokens,
  NotionOAuthTokensEncrypted,
  NotionConnectionStatus,
  NotionTokenResponse,
  NotionIntegrationStatus,
  NotionOwner,
} from "../types"
import { NotionTokenError } from "../types"

// ============================================================================
// TOKEN ENCRYPTION
// ============================================================================

/**
 * Encrypt OAuth token for secure storage
 */
function encryptToken(token: NotionOAuthTokens): {
  access_token_encrypted: string
  access_token_iv: string
} {
  const encrypted = encryptKey(token.accessToken)
  return {
    access_token_encrypted: encrypted.encrypted,
    access_token_iv: encrypted.iv,
  }
}

/**
 * Decrypt stored token
 */
function decryptToken(encrypted: NotionOAuthTokensEncrypted): NotionOAuthTokens {
  const accessToken = decryptKey(
    encrypted.access_token_encrypted,
    encrypted.access_token_iv
  )
  return { accessToken }
}

// ============================================================================
// TOKEN STORAGE OPERATIONS
// ============================================================================

/**
 * Extract owner email from token response
 */
function extractOwnerEmail(owner: NotionOwner): string | null {
  if (owner.type === "user" && owner.user.person?.email) {
    return owner.user.person.email
  }
  return null
}

/**
 * Extract owner ID from token response
 */
function extractOwnerId(owner: NotionOwner): string | null {
  if (owner.type === "user") {
    return owner.user.id
  }
  return null
}

/**
 * Store encrypted OAuth token for a user
 */
export async function storeToken(
  userId: string,
  tokenResponse: NotionTokenResponse
): Promise<void> {
  if (!isSupabaseEnabled) {
    throw new Error(NOTION_ERROR_MESSAGES.notConfigured)
  }

  const supabase = await createClient()
  if (!supabase) {
    throw new Error(NOTION_ERROR_MESSAGES.notConfigured)
  }

  const encrypted = encryptToken({ accessToken: tokenResponse.access_token })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("notion_oauth_tokens")
    .upsert(
      {
        user_id: userId,
        ...encrypted,
        workspace_id: tokenResponse.workspace_id,
        workspace_name: tokenResponse.workspace_name,
        workspace_icon: tokenResponse.workspace_icon,
        bot_id: tokenResponse.bot_id,
        owner_id: extractOwnerId(tokenResponse.owner),
        owner_email: extractOwnerEmail(tokenResponse.owner),
        status: "active" as const,
        last_error: null,
      },
      {
        onConflict: "user_id",
      }
    )

  if (error) {
    console.error("[NotionTokenManager] Failed to store token:", error)
    throw new Error(`Failed to store Notion token: ${error.message}`)
  }
}

/**
 * Get decrypted token for a user
 * Returns null if not connected or token is invalid
 */
export async function getToken(userId: string): Promise<NotionOAuthTokens | null> {
  if (!isSupabaseEnabled) {
    return null
  }

  const supabase = await createClient()
  if (!supabase) {
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("notion_oauth_tokens")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (error || !data) {
    return null
  }

  // Check if token is revoked or has an error status
  if (data.status === "revoked" || data.status === "error") {
    return null
  }

  try {
    return decryptToken(data as NotionOAuthTokensEncrypted)
  } catch (decryptError) {
    console.error("[NotionTokenManager] Failed to decrypt token:", decryptError)
    await updateTokenStatus(userId, "error", "Token decryption failed")
    return null
  }
}

/**
 * Delete token for a user (disconnect)
 */
export async function deleteToken(userId: string): Promise<void> {
  if (!isSupabaseEnabled) {
    return
  }

  const supabase = await createClient()
  if (!supabase) {
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("notion_oauth_tokens")
    .delete()
    .eq("user_id", userId)

  if (error) {
    console.error("[NotionTokenManager] Failed to delete token:", error)
    throw new Error(`Failed to delete Notion token: ${error.message}`)
  }
}

/**
 * Update token status (for marking as revoked, error, etc.)
 */
export async function updateTokenStatus(
  userId: string,
  status: NotionConnectionStatus,
  errorMessage?: string
): Promise<void> {
  if (!isSupabaseEnabled) {
    return
  }

  const supabase = await createClient()
  if (!supabase) {
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("notion_oauth_tokens")
    .update({
      status,
      last_error: errorMessage || null,
    })
    .eq("user_id", userId)

  if (error) {
    console.error("[NotionTokenManager] Failed to update status:", error)
  }
}

// ============================================================================
// ACCESS TOKEN RETRIEVAL
// ============================================================================

/**
 * Get a valid access token for making API calls
 * Unlike Google, Notion tokens don't expire, so no refresh needed
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const token = await getToken(userId)
  if (!token) {
    throw new NotionTokenError(NOTION_ERROR_MESSAGES.notConnected, false)
  }
  return token.accessToken
}

// ============================================================================
// TOKEN EXCHANGE
// ============================================================================

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<NotionTokenResponse> {
  const clientId = process.env.NOTION_CLIENT_ID
  const clientSecret = process.env.NOTION_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(NOTION_ERROR_MESSAGES.notConfigured)
  }

  // Notion requires Basic Auth for token exchange
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const response = await fetch(NOTION_OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(NOTION_OAUTH_CONFIG.timeout),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error("[NotionTokenManager] Token exchange failed:", errorData)
    throw new Error(`Token exchange failed: ${errorData.error || response.statusText}`)
  }

  const data: NotionTokenResponse = await response.json()
  return data
}

// ============================================================================
// CONNECTION STATUS
// ============================================================================

/**
 * Get comprehensive integration status for a user
 */
export async function getIntegrationStatus(
  userId: string
): Promise<NotionIntegrationStatus> {
  if (!isSupabaseEnabled) {
    return {
      connected: false,
      status: "disconnected",
      indexedPages: 0,
      processingPages: 0,
    }
  }

  const supabase = await createClient()
  if (!supabase) {
    return {
      connected: false,
      status: "disconnected",
      indexedPages: 0,
      processingPages: 0,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Fetch token info
  const { data: tokenData } = await sb
    .from("notion_oauth_tokens")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (!tokenData) {
    return {
      connected: false,
      status: "disconnected",
      indexedPages: 0,
      processingPages: 0,
    }
  }

  // Count indexed pages
  const { count: indexedPages } = await sb
    .from("notion_documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "ready")

  // Count processing pages
  const { count: processingPages } = await sb
    .from("notion_documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "processing")

  return {
    connected: tokenData.status === "active",
    status: tokenData.status || "disconnected",
    workspaceName: tokenData.workspace_name,
    workspaceId: tokenData.workspace_id,
    workspaceIcon: tokenData.workspace_icon,
    ownerEmail: tokenData.owner_email,
    errorMessage: tokenData.last_error,
    indexedPages: indexedPages || 0,
    processingPages: processingPages || 0,
    connectedAt: tokenData.created_at,
  }
}

/**
 * Check if user is connected to Notion
 */
export async function isConnected(userId: string): Promise<boolean> {
  const token = await getToken(userId)
  return token !== null
}
