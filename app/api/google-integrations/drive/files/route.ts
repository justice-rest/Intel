/**
 * Google Drive Files List API Route
 * GET: List files from user's Google Drive
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  isGoogleIntegrationEnabled,
  hasDriveAccess,
  GOOGLE_ERROR_MESSAGES,
  DRIVE_PROCESSING_CONFIG,
} from "@/lib/google"
import { listFiles } from "@/lib/google/drive/client"

export async function GET(request: Request) {
  try {
    if (!isGoogleIntegrationEnabled()) {
      return NextResponse.json(
        { error: GOOGLE_ERROR_MESSAGES.notConfigured },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const hasAccess = await hasDriveAccess(user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { error: GOOGLE_ERROR_MESSAGES.notConnected },
        { status: 403 }
      )
    }

    // Parse query parameters
    const url = new URL(request.url)
    const pageSize = Math.min(
      parseInt(url.searchParams.get("pageSize") || "50", 10),
      100
    )
    const pageToken = url.searchParams.get("pageToken") || undefined
    const searchQuery = url.searchParams.get("q") || undefined
    const folderId = url.searchParams.get("folderId") || undefined

    // Build the Google Drive query
    // Filter to supported MIME types only
    const supportedTypes = DRIVE_PROCESSING_CONFIG.supportedMimeTypes
    const mimeTypeFilter = supportedTypes
      .map((type) => `mimeType='${type}'`)
      .join(" or ")

    let query = `(${mimeTypeFilter}) and trashed=false`

    // Add folder filter if specified
    if (folderId) {
      query = `'${folderId}' in parents and ${query}`
    }

    // Add text search if provided
    if (searchQuery) {
      query = `name contains '${searchQuery.replace(/'/g, "\\'")}' and ${query}`
    }

    const result = await listFiles(user.id, {
      query,
      pageSize,
      pageToken,
      orderBy: "modifiedTime desc",
    })

    return NextResponse.json({
      success: true,
      files: result.files || [],
      nextPageToken: result.nextPageToken,
    })
  } catch (error) {
    console.error("[Drive Files API] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list files" },
      { status: 500 }
    )
  }
}
