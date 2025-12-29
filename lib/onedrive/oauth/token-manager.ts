/**
 * OneDrive OAuth Token Manager
 *
 * Handles encrypted token storage, refresh, and revocation detection
 * for Microsoft Graph API / OneDrive integration.
 */

import { encryptKey, decryptKey } from "@/lib/encryption"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import {
  ONEDRIVE_OAUTH_CONFIG,
  ONEDRIVE_RATE_LIMITS,
  ONEDRIVE_ERROR_MESSAGES,
  getOneDriveClientId,
  getOneDriveClientSecret,
} from "../config"
import type {
  OneDriveTokenResponse,
  OneDriveStoredToken,
  OneDriveDecryptedToken,
  OneDriveIntegrationStatus,
  MicrosoftUser,
} from "../types"
import { OneDriveApiError, OneDriveTokenError } from "../types"

// ============================================================================
// TOKEN ENCRYPTION
// ============================================================================

/**
 * Encrypt OAuth tokens for secure storage
 */
function encryptTokens(tokens: OneDriveDecryptedToken): Pick<
  OneDriveStoredToken,
  | "access_token_encrypted"
  | "access_token_iv"
  | "refresh_token_encrypted"
  | "refresh_token_iv"
  | "expires_at"
  | "scopes"
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
function decryptTokens(encrypted: OneDriveStoredToken): OneDriveDecryptedToken {
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
    microsoftId: encrypted.microsoft_id,
    microsoftEmail: encrypted.microsoft_email,
    displayName: encrypted.display_name,
  }
}

// ============================================================================
// TOKEN STORAGE OPERATIONS
// ============================================================================

/**
 * Store encrypted OAuth tokens for a user
 */
export async function storeToken(
  userId: string,
  tokenResponse: OneDriveTokenResponse,
  userInfo: MicrosoftUser
): Promise<void> {
  if (!isSupabaseEnabled) {
    throw new Error(ONEDRIVE_ERROR_MESSAGES.notConfigured)
  }

  const supabase = await createClient()
  if (!supabase) {
    throw new Error(ONEDRIVE_ERROR_MESSAGES.notConfigured)
  }

  // Calculate expiry time
  const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000)
  const scopes = tokenResponse.scope.split(" ")

  const tokens: OneDriveDecryptedToken = {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt,
    scopes,
    microsoftId: userInfo.id,
    microsoftEmail: userInfo.mail || userInfo.userPrincipalName,
    displayName: userInfo.displayName,
  }

  const encrypted = encryptTokens(tokens)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("onedrive_oauth_tokens")
    .upsert(
      {
        user_id: userId,
        ...encrypted,
        microsoft_id: userInfo.id,
        microsoft_email: userInfo.mail || userInfo.userPrincipalName,
        display_name: userInfo.displayName,
        status: "active" as const,
        last_error: null,
      },
      {
        onConflict: "user_id",
      }
    )

  if (error) {
    console.error("[OneDriveTokenManager] Failed to store tokens:", error)
    throw new Error(`Failed to store OneDrive tokens: ${error.message}`)
  }
}

/**
 * Get decrypted tokens for a user
 * Returns null if not connected or tokens are invalid
 */
export async function getToken(userId: string): Promise<OneDriveDecryptedToken | null> {
  if (!isSupabaseEnabled) {
    return null
  }

  const supabase = await createClient()
  if (!supabase) {
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("onedrive_oauth_tokens")
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
    return decryptTokens(data as OneDriveStoredToken)
  } catch (decryptError) {
    console.error("[OneDriveTokenManager] Failed to decrypt tokens:", decryptError)
    // Mark as error status if decryption fails
    await updateTokenStatus(userId, "error", "Token decryption failed")
    return null
  }
}

/**
 * Delete tokens for a user (disconnect)
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
    .from("onedrive_oauth_tokens")
    .delete()
    .eq("user_id", userId)

  if (error) {
    console.error("[OneDriveTokenManager] Failed to delete tokens:", error)
    throw new Error(`Failed to delete OneDrive tokens: ${error.message}`)
  }
}

/**
 * Update token status (for marking as expired, revoked, etc.)
 */
export async function updateTokenStatus(
  userId: string,
  status: "active" | "expired" | "revoked" | "error",
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
    .from("onedrive_oauth_tokens")
    .update({
      status,
      error_message: errorMessage || null,
    })
    .eq("user_id", userId)

  if (error) {
    console.error("[OneDriveTokenManager] Failed to update status:", error)
  }
}

// ============================================================================
// TOKEN REFRESH
// ============================================================================

/**
 * Calculate retry delay with exponential backoff
 */
function calculateRetryDelay(attempt: number): number {
  return Math.min(
    ONEDRIVE_RATE_LIMITS.retryAfterDefault * Math.pow(2, attempt),
    30000 // Max 30 seconds
  )
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(userId: string): Promise<OneDriveDecryptedToken> {
  const currentTokens = await getToken(userId)
  if (!currentTokens) {
    throw new OneDriveTokenError(ONEDRIVE_ERROR_MESSAGES.notConnected, "not_found")
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt < ONEDRIVE_RATE_LIMITS.maxRetries; attempt++) {
    try {
      const response = await fetch(ONEDRIVE_OAUTH_CONFIG.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: getOneDriveClientId(),
          client_secret: getOneDriveClientSecret(),
          refresh_token: currentTokens.refreshToken,
          grant_type: "refresh_token",
        }),
        signal: AbortSignal.timeout(ONEDRIVE_OAUTH_CONFIG.timeout),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Check for token revocation
        if (
          response.status === 400 &&
          (errorData.error === "invalid_grant" ||
            errorData.error_description?.includes("revoked") ||
            errorData.error_description?.includes("expired"))
        ) {
          await updateTokenStatus(userId, "revoked", "Refresh token was revoked or expired")
          throw new OneDriveTokenError(ONEDRIVE_ERROR_MESSAGES.tokenExpired, "revoked")
        }

        throw new OneDriveApiError(
          `Token refresh failed: ${errorData.error || response.statusText}`,
          response.status,
          errorData.error
        )
      }

      const data: OneDriveTokenResponse = await response.json()

      // Calculate new expiry time
      const expiresAt = new Date(Date.now() + data.expires_in * 1000)

      // Update stored tokens with new access token (and potentially new refresh token)
      const newTokens: OneDriveDecryptedToken = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || currentTokens.refreshToken, // Use new refresh token if provided
        expiresAt,
        scopes: data.scope?.split(" ") || currentTokens.scopes,
        microsoftId: currentTokens.microsoftId,
        microsoftEmail: currentTokens.microsoftEmail,
        displayName: currentTokens.displayName,
      }

      // Store updated tokens
      const tokenResponse: OneDriveTokenResponse = {
        access_token: newTokens.accessToken,
        refresh_token: newTokens.refreshToken,
        token_type: "Bearer",
        expires_in: data.expires_in,
        scope: newTokens.scopes.join(" "),
      }

      const userInfo: MicrosoftUser = {
        id: newTokens.microsoftId,
        displayName: newTokens.displayName || "",
        mail: newTokens.microsoftEmail,
        userPrincipalName: newTokens.microsoftEmail,
      }

      await storeToken(userId, tokenResponse, userInfo)

      return newTokens
    } catch (error) {
      lastError = error as Error

      // Don't retry on revocation or non-retryable errors
      if (error instanceof OneDriveTokenError) {
        throw error
      }

      // Don't retry on 4xx errors (except rate limiting)
      if (error instanceof OneDriveApiError && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
        throw error
      }

      // Wait before retry with exponential backoff
      if (attempt < ONEDRIVE_RATE_LIMITS.maxRetries - 1) {
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
 * Refreshes when token has less than 5 minutes remaining
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const tokens = await getToken(userId)
  if (!tokens) {
    throw new OneDriveTokenError(ONEDRIVE_ERROR_MESSAGES.notConnected, "not_found")
  }

  // Check if token is expired or will expire soon (5 minute buffer)
  const now = Date.now()
  const expiresAt = tokens.expiresAt.getTime()
  const bufferTime = 5 * 60 * 1000 // 5 minutes

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
 * Get Microsoft user info using access token
 */
export async function getUserInfoFromToken(accessToken: string): Promise<MicrosoftUser> {
  const response = await fetch(`${ONEDRIVE_OAUTH_CONFIG.graphBaseUrl}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(ONEDRIVE_OAUTH_CONFIG.timeout),
  })

  if (!response.ok) {
    throw new OneDriveApiError(
      "Failed to get user info",
      response.status
    )
  }

  return await response.json()
}

// ============================================================================
// OAUTH FLOW HELPERS
// ============================================================================

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<OneDriveTokenResponse> {
  const response = await fetch(ONEDRIVE_OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: getOneDriveClientId(),
      client_secret: getOneDriveClientSecret(),
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(ONEDRIVE_OAUTH_CONFIG.timeout),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new OneDriveApiError(
      `Token exchange failed: ${errorData.error_description || errorData.error || response.statusText}`,
      response.status,
      errorData.error
    )
  }

  const data: OneDriveTokenResponse = await response.json()

  if (!data.refresh_token) {
    throw new OneDriveApiError(
      "No refresh token received. Please ensure offline_access scope is requested.",
      400,
      "missing_refresh_token"
    )
  }

  return data
}

// ============================================================================
// CONNECTION STATUS
// ============================================================================

/**
 * Check if user is connected to OneDrive
 */
export async function isConnected(userId: string): Promise<boolean> {
  const tokens = await getToken(userId)
  return tokens !== null
}

/**
 * Get comprehensive integration status for a user
 */
export async function getIntegrationStatus(
  userId: string
): Promise<OneDriveIntegrationStatus> {
  if (!isSupabaseEnabled) {
    return {
      connected: false,
      status: "disconnected",
      indexedFiles: 0,
      processingFiles: 0,
      configured: false,
    }
  }

  const supabase = await createClient()
  if (!supabase) {
    return {
      connected: false,
      status: "disconnected",
      indexedFiles: 0,
      processingFiles: 0,
      configured: false,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Fetch token info
  const { data: tokenData } = await sb
    .from("onedrive_oauth_tokens")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (!tokenData) {
    return {
      connected: false,
      status: "disconnected",
      indexedFiles: 0,
      processingFiles: 0,
      configured: true,
    }
  }

  // Count indexed files
  const { count: indexedFiles } = await sb
    .from("onedrive_documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "ready")

  // Count processing files
  const { count: processingFiles } = await sb
    .from("onedrive_documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "processing")

  // Map database status to integration status
  const mapStatus = (dbStatus: string): OneDriveIntegrationStatus["status"] => {
    switch (dbStatus) {
      case "active":
        return "active"
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
    microsoftEmail: tokenData.microsoft_email,
    displayName: tokenData.display_name,
    indexedFiles: indexedFiles || 0,
    processingFiles: processingFiles || 0,
    errorMessage: tokenData.error_message,
    configured: true,
  }
}
