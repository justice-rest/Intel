/**
 * OneDrive Integration - OAuth Callback Route
 *
 * GET /api/onedrive-integration/callback
 * Handles OAuth callback, exchanges code for token, and stores encrypted token
 */

import { NextRequest, NextResponse } from "next/server"
import {
  validateOAuthState,
  exchangeCodeForToken,
  storeToken,
  getUserInfoFromToken,
  getOneDriveRedirectUri,
  ONEDRIVE_ERROR_MESSAGES,
} from "@/lib/onedrive"

// Settings page URL with connectors tab
function getSettingsUrl(params?: Record<string, string>): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_VERCEL_URL || ""
  const protocol = baseUrl.includes("localhost") ? "http" : "https"
  const cleanUrl = baseUrl.replace(/^https?:\/\//, "")
  const url = new URL(`${protocol}://${cleanUrl}`)

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }

  return url.toString()
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")
    const errorDescription = searchParams.get("error_description")

    // Handle OAuth errors from Microsoft
    if (error) {
      console.error("[OneDriveCallback] OAuth error:", error, errorDescription)
      return NextResponse.redirect(
        getSettingsUrl({
          onedrive_error: errorDescription || "Connection was cancelled or denied",
        })
      )
    }

    // Validate required parameters
    if (!code || !state) {
      console.error("[OneDriveCallback] Missing code or state")
      return NextResponse.redirect(
        getSettingsUrl({
          onedrive_error: "Invalid callback parameters",
        })
      )
    }

    // Validate OAuth state and get user ID
    const userId = await validateOAuthState(state)
    if (!userId) {
      console.error("[OneDriveCallback] Invalid or expired state")
      return NextResponse.redirect(
        getSettingsUrl({
          onedrive_error: ONEDRIVE_ERROR_MESSAGES.invalidState,
        })
      )
    }

    // Exchange code for token
    const redirectUri = getOneDriveRedirectUri()
    const tokenResponse = await exchangeCodeForToken(code, redirectUri)

    // Get user info from Microsoft Graph
    const userInfo = await getUserInfoFromToken(tokenResponse.access_token)

    // Store encrypted token
    await storeToken(userId, tokenResponse, userInfo)

    // Redirect to settings with success message
    const displayName = userInfo.displayName || userInfo.mail || "Microsoft"
    return NextResponse.redirect(
      getSettingsUrl({
        onedrive_success: `Connected to ${displayName}'s OneDrive`,
      })
    )
  } catch (error) {
    console.error("[OneDriveCallback] Error:", error)
    return NextResponse.redirect(
      getSettingsUrl({
        onedrive_error: "Failed to complete OneDrive connection",
      })
    )
  }
}
