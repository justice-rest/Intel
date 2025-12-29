/**
 * Notion Integration - OAuth Callback Route
 *
 * GET /api/notion-integration/callback
 * Handles OAuth callback, exchanges code for token, and stores encrypted token
 */

import { NextRequest, NextResponse } from "next/server"
import {
  validateOAuthState,
  exchangeCodeForToken,
  storeToken,
  getNotionRedirectUri,
  NOTION_ERROR_MESSAGES,
} from "@/lib/notion"

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

    // Handle OAuth errors from Notion
    if (error) {
      console.error("[NotionCallback] OAuth error:", error)
      return NextResponse.redirect(
        getSettingsUrl({
          notion_error: "Connection was cancelled or denied",
        })
      )
    }

    // Validate required parameters
    if (!code || !state) {
      console.error("[NotionCallback] Missing code or state")
      return NextResponse.redirect(
        getSettingsUrl({
          notion_error: "Invalid callback parameters",
        })
      )
    }

    // Validate OAuth state and get user ID
    const userId = await validateOAuthState(state)
    if (!userId) {
      console.error("[NotionCallback] Invalid or expired state")
      return NextResponse.redirect(
        getSettingsUrl({
          notion_error: NOTION_ERROR_MESSAGES.invalidState,
        })
      )
    }

    // Exchange code for token
    const redirectUri = getNotionRedirectUri()
    const tokenResponse = await exchangeCodeForToken(code, redirectUri)

    // Store encrypted token
    await storeToken(userId, tokenResponse)

    // Log audit event
    // TODO: Add to cloud_integration_audit_log

    // Redirect to settings with success message
    const workspaceName = tokenResponse.workspace_name || "Notion"
    return NextResponse.redirect(
      getSettingsUrl({
        notion_success: `Connected to ${workspaceName}`,
      })
    )
  } catch (error) {
    console.error("[NotionCallback] Error:", error)
    return NextResponse.redirect(
      getSettingsUrl({
        notion_error: "Failed to complete Notion connection",
      })
    )
  }
}
