/**
 * Google OAuth Token Manager
 * Handles encrypted token storage, refresh, and revocation detection
 */

import { encryptKey, decryptKey } from "@/lib/encryption"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import {
  GOOGLE_OAUTH_CONFIG,
  RETRY_CONFIG,
  calculateRetryDelay,
  GOOGLE_ERROR_MESSAGES,
} from "../config"
import type {
  GoogleOAuthTokens,
  GoogleOAuthTokensEncrypted,
  GoogleConnectionStatus,
  GoogleUserInfo,
  GoogleIntegrationStatus,
} from "../types"
import { TokenRefreshError, GoogleApiError } from "../types"

// ============================================================================
// TYPES
// ============================================================================

interface RefreshTokenResponse {
  access_token: string
  expires_in: number
  scope?: string
  token_type: string
}

interface TokenExchangeResponse extends RefreshTokenResponse {
  refresh_token: string
  id_token?: string
}

// ============================================================================
// TOKEN ENCRYPTION
// ============================================================================

/**
 * Encrypt OAuth tokens for secure storage
 */
function encryptTokens(tokens: GoogleOAuthTokens): Omit<
  GoogleOAuthTokensEncrypted,
  "google_email" | "google_id" | "status" | "last_refresh_at" | "last_error"
> {
  const accessTokenEncrypted = encryptKey(tokens.accessToken)
  const refreshTokenEncrypted = encryptKey(tokens.refreshToken)

  return {
    access_token_encrypted: accessTokenEncrypted.encrypted,
    access_token_iv: accessTokenEncrypted.iv,
    refresh_token_encrypted: refreshTokenEncrypted.encrypted,
    refresh_token_iv: refreshTokenEncrypted.iv,
    expires_at: tokens.expiresAt.toISOString(),
    scopes: tokens.scopes,
  }
}

/**
 * Decrypt stored tokens
 */
function decryptTokens(encrypted: GoogleOAuthTokensEncrypted): GoogleOAuthTokens {
  const accessToken = decryptKey(
    encrypted.access_token_encrypted,
    encrypted.access_token_iv
  )
  const refreshToken = decryptKey(
    encrypted.refresh_token_encrypted,
    encrypted.refresh_token_iv
  )

  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(encrypted.expires_at),
    scopes: encrypted.scopes,
  }
}

// ============================================================================
// TOKEN STORAGE OPERATIONS
// ============================================================================

/**
 * Store encrypted OAuth tokens for a user
 */
export async function storeTokens(
  userId: string,
  tokens: GoogleOAuthTokens,
  userInfo: GoogleUserInfo
): Promise<void> {
  if (!isSupabaseEnabled) {
    throw new Error(GOOGLE_ERROR_MESSAGES.notConfigured)
  }

  const supabase = await createClient()
  if (!supabase) {
    throw new Error(GOOGLE_ERROR_MESSAGES.notConfigured)
  }

  const encrypted = encryptTokens(tokens)

  // Using 'any' cast as table is not yet in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("google_oauth_tokens")
    .upsert(
      {
        user_id: userId,
        ...encrypted,
        google_email: userInfo.email,
        google_id: userInfo.id,
        status: "active" as const,
        last_refresh_at: new Date().toISOString(),
        last_error: null,
      },
      {
        onConflict: "user_id",
      }
    )

  if (error) {
    console.error("[GoogleTokenManager] Failed to store tokens:", error)
    throw new Error(`Failed to store Google tokens: ${error.message}`)
  }
}

/**
 * Get decrypted tokens for a user
 * Returns null if not connected or tokens are invalid
 */
export async function getTokens(userId: string): Promise<GoogleOAuthTokens | null> {
  if (!isSupabaseEnabled) {
    return null
  }

  const supabase = await createClient()
  if (!supabase) {
    return null
  }

  // Using 'any' cast as table is not yet in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("google_oauth_tokens")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (error || !data) {
    return null
  }

  // Check if tokens are revoked or have an error status
  if (data.status === "revoked" || data.status === "error") {
    return null
  }

  try {
    return decryptTokens(data as GoogleOAuthTokensEncrypted)
  } catch (decryptError) {
    console.error("[GoogleTokenManager] Failed to decrypt tokens:", decryptError)
    // Mark as error status if decryption fails
    await updateTokenStatus(userId, "error", "Token decryption failed")
    return null
  }
}

/**
 * Delete tokens for a user (disconnect)
 */
export async function deleteTokens(userId: string): Promise<void> {
  if (!isSupabaseEnabled) {
    return
  }

  const supabase = await createClient()
  if (!supabase) {
    return
  }

  // Using 'any' cast as table is not yet in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("google_oauth_tokens")
    .delete()
    .eq("user_id", userId)

  if (error) {
    console.error("[GoogleTokenManager] Failed to delete tokens:", error)
    throw new Error(`Failed to delete Google tokens: ${error.message}`)
  }
}

/**
 * Update token status (for marking as expired, revoked, etc.)
 */
export async function updateTokenStatus(
  userId: string,
  status: GoogleConnectionStatus,
  errorMessage?: string
): Promise<void> {
  if (!isSupabaseEnabled) {
    return
  }

  const supabase = await createClient()
  if (!supabase) {
    return
  }

  // Map to database-compatible status
  const dbStatus = status === "connected" ? "active" : status

  // Using 'any' cast as table is not yet in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("google_oauth_tokens")
    .update({
      status: dbStatus,
      last_error: errorMessage || null,
    })
    .eq("user_id", userId)

  if (error) {
    console.error("[GoogleTokenManager] Failed to update status:", error)
  }
}

// ============================================================================
// TOKEN REFRESH
// ============================================================================

/**
 * Refresh access token using refresh token
 * Handles revocation detection and retries
 */
export async function refreshAccessToken(userId: string): Promise<GoogleOAuthTokens> {
  const currentTokens = await getTokens(userId)
  if (!currentTokens) {
    throw new TokenRefreshError(GOOGLE_ERROR_MESSAGES.notConnected, false)
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(GOOGLE_OAUTH_CONFIG.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: currentTokens.refreshToken,
          grant_type: "refresh_token",
        }),
        signal: AbortSignal.timeout(GOOGLE_OAUTH_CONFIG.timeout),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Check for token revocation
        if (
          response.status === 400 &&
          (errorData.error === "invalid_grant" ||
            errorData.error_description?.includes("revoked"))
        ) {
          await updateTokenStatus(userId, "revoked", "Refresh token was revoked")
          throw new TokenRefreshError(GOOGLE_ERROR_MESSAGES.tokenRevoked, true)
        }

        throw new GoogleApiError(
          `Token refresh failed: ${errorData.error || response.statusText}`,
          response.status,
          errorData.error,
          response.status >= 500
        )
      }

      const data: RefreshTokenResponse = await response.json()

      // Calculate new expiry time
      const expiresAt = new Date(Date.now() + data.expires_in * 1000)

      // Update stored tokens with new access token
      const newTokens: GoogleOAuthTokens = {
        accessToken: data.access_token,
        refreshToken: currentTokens.refreshToken, // Refresh token typically doesn't change
        expiresAt,
        scopes: data.scope?.split(" ") || currentTokens.scopes,
      }

      // Get user info to maintain in storage
      const userInfo = await getUserInfoFromToken(newTokens.accessToken)

      await storeTokens(userId, newTokens, userInfo)

      return newTokens
    } catch (error) {
      lastError = error as Error

      // Don't retry on revocation or non-retryable errors
      if (
        error instanceof TokenRefreshError ||
        (error instanceof GoogleApiError && !error.retryable)
      ) {
        throw error
      }

      // Wait before retry with exponential backoff
      if (attempt < RETRY_CONFIG.maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, calculateRetryDelay(attempt))
        )
      }
    }
  }

  throw lastError || new Error("Token refresh failed after retries")
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const tokens = await getTokens(userId)
  if (!tokens) {
    throw new TokenRefreshError(GOOGLE_ERROR_MESSAGES.notConnected, false)
  }

  // Check if token is expired or will expire soon
  const now = Date.now()
  const expiresAt = tokens.expiresAt.getTime()
  const bufferTime = GOOGLE_OAUTH_CONFIG.refreshBuffer

  if (now >= expiresAt - bufferTime) {
    // Token is expired or will expire soon, refresh it
    const newTokens = await refreshAccessToken(userId)
    return newTokens.accessToken
  }

  return tokens.accessToken
}

// ============================================================================
// USER INFO
// ============================================================================

/**
 * Get Google user info using access token
 */
export async function getUserInfoFromToken(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_OAUTH_CONFIG.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(GOOGLE_OAUTH_CONFIG.timeout),
  })

  if (!response.ok) {
    throw new GoogleApiError(
      "Failed to get user info",
      response.status,
      undefined,
      false
    )
  }

  const data = await response.json()

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    picture: data.picture,
  }
}

// ============================================================================
// OAUTH FLOW HELPERS
// ============================================================================

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ tokens: GoogleOAuthTokens; userInfo: GoogleUserInfo }> {
  const response = await fetch(GOOGLE_OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(GOOGLE_OAUTH_CONFIG.timeout),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new GoogleApiError(
      `Token exchange failed: ${errorData.error || response.statusText}`,
      response.status,
      errorData.error,
      false
    )
  }

  const data: TokenExchangeResponse = await response.json()

  if (!data.refresh_token) {
    throw new GoogleApiError(
      "No refresh token received. User may need to revoke access and reconnect with prompt=consent.",
      400,
      "missing_refresh_token",
      false
    )
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000)

  const tokens: GoogleOAuthTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    scopes: data.scope?.split(" ") || [],
  }

  // Get user info
  const userInfo = await getUserInfoFromToken(tokens.accessToken)

  return { tokens, userInfo }
}

/**
 * Revoke tokens with Google (when user disconnects)
 */
export async function revokeTokens(accessToken: string): Promise<void> {
  try {
    const response = await fetch(
      `${GOOGLE_OAUTH_CONFIG.revokeUrl}?token=${accessToken}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        signal: AbortSignal.timeout(GOOGLE_OAUTH_CONFIG.timeout),
      }
    )

    // Google may return 200 or 400 for revoke (400 if already revoked)
    // Both are acceptable outcomes
    if (!response.ok && response.status !== 400) {
      console.error("[GoogleTokenManager] Revoke request failed:", response.status)
    }
  } catch (error) {
    // Log but don't throw - revocation failure shouldn't block disconnect
    console.error("[GoogleTokenManager] Failed to revoke tokens:", error)
  }
}

// ============================================================================
// CONNECTION STATUS
// ============================================================================

/**
 * Get comprehensive integration status for a user
 */
export async function getIntegrationStatus(
  userId: string
): Promise<GoogleIntegrationStatus> {
  if (!isSupabaseEnabled) {
    return {
      connected: false,
      status: "disconnected",
      scopes: [],
      pendingDrafts: 0,
      indexedDocuments: 0,
    }
  }

  const supabase = await createClient()
  if (!supabase) {
    return {
      connected: false,
      status: "disconnected",
      scopes: [],
      pendingDrafts: 0,
      indexedDocuments: 0,
    }
  }

  // Using 'any' cast as tables are not yet in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Fetch token info
  const { data: tokenData } = await sb
    .from("google_oauth_tokens")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (!tokenData) {
    return {
      connected: false,
      status: "disconnected",
      scopes: [],
      pendingDrafts: 0,
      indexedDocuments: 0,
    }
  }

  // Count pending drafts
  const { count: pendingDrafts } = await sb
    .from("gmail_drafts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "pending")

  // Count indexed documents
  const { count: indexedDocuments } = await sb
    .from("google_drive_documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "ready")

  // Get writing style info
  const { data: styleData } = await sb
    .from("user_writing_style")
    .select("last_analyzed_at, emails_analyzed")
    .eq("user_id", userId)
    .single()

  // Map database status to connection status
  const mapStatus = (dbStatus: string): GoogleConnectionStatus => {
    switch (dbStatus) {
      case "active":
        return "connected"
      case "expired":
        return "expired"
      case "revoked":
        return "revoked"
      case "error":
        return "error"
      default:
        return "disconnected"
    }
  }

  return {
    connected: tokenData.status === "active",
    status: mapStatus(tokenData.status),
    googleEmail: tokenData.google_email,
    scopes: tokenData.scopes || [],
    expiresAt: tokenData.expires_at,
    lastRefreshAt: tokenData.last_refresh_at,
    errorMessage: tokenData.last_error,
    pendingDrafts: pendingDrafts || 0,
    indexedDocuments: indexedDocuments || 0,
    styleAnalyzedAt: styleData?.last_analyzed_at,
    emailsAnalyzed: styleData?.emails_analyzed,
  }
}

/**
 * Check if user has a specific scope
 */
export async function hasScope(userId: string, scope: string): Promise<boolean> {
  const tokens = await getTokens(userId)
  if (!tokens) {
    return false
  }
  return tokens.scopes.includes(scope)
}

/**
 * Check if user has any Gmail scopes
 */
export async function hasGmailAccess(userId: string): Promise<boolean> {
  const tokens = await getTokens(userId)
  if (!tokens) {
    return false
  }
  return tokens.scopes.some((s) => s.includes("gmail"))
}

/**
 * Check if user has any Drive scopes
 */
export async function hasDriveAccess(userId: string): Promise<boolean> {
  const tokens = await getTokens(userId)
  if (!tokens) {
    return false
  }
  return tokens.scopes.some((s) => s.includes("drive"))
}
