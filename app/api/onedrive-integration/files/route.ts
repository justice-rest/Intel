/**
 * OneDrive Integration - Files Route
 *
 * GET /api/onedrive-integration/files - List accessible files
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import {
  getValidAccessToken,
  listFiles,
  searchFiles,
  getFilePath,
  ONEDRIVE_ERROR_MESSAGES,
} from "@/lib/onedrive"
import type { OneDriveFileForImport } from "@/lib/onedrive"

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    if (!isSupabaseEnabled) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    // Get access token
    let accessToken: string
    try {
      accessToken = await getValidAccessToken(user.id)
    } catch {
      return NextResponse.json(
        { error: ONEDRIVE_ERROR_MESSAGES.notConnected },
        { status: 400 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("query") || undefined
    const folderId = searchParams.get("folderId") || undefined
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10)
    const nextLink = searchParams.get("nextLink") || undefined

    // Fetch files (either search or list)
    let result
    if (query) {
      result = await searchFiles(accessToken, query, { pageSize, nextLink })
    } else {
      result = await listFiles(accessToken, { folderId, pageSize, nextLink })
    }

    // Get already indexed file IDs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: indexedDocs } = await (supabase as any)
      .from("onedrive_documents")
      .select("onedrive_item_id, status")
      .eq("user_id", user.id)

    const indexedMap = new Map<string, string>(
      (indexedDocs || []).map((doc: { onedrive_item_id: string; status: string }) => [
        doc.onedrive_item_id,
        doc.status,
      ])
    )

    // Transform results
    const files: OneDriveFileForImport[] = result.value
      .filter((item) => item.file) // Only files, not folders
      .map((item) => ({
        id: item.id,
        name: item.name,
        mimeType: item.file?.mimeType || "application/octet-stream",
        size: item.size || 0,
        path: getFilePath(item),
        webUrl: item.webUrl,
        lastModifiedTime: item.lastModifiedDateTime,
        indexed: indexedMap.has(item.id),
        indexStatus: indexedMap.get(item.id) || null,
      }))

    // Get folders for navigation
    const folders = result.value
      .filter((item) => item.folder)
      .map((item) => ({
        id: item.id,
        name: item.name,
        childCount: item.folder?.childCount || 0,
        path: getFilePath(item),
      }))

    return NextResponse.json({
      files,
      folders,
      total: files.length,
      nextLink: result["@odata.nextLink"] || null,
    })
  } catch (error) {
    console.error("[OneDriveFiles] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch OneDrive files" },
      { status: 500 }
    )
  }
}
