/**
 * Google Drive File Download API Route
 * GET: Download a file from user's Google Drive
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  isGoogleIntegrationEnabled,
  hasDriveAccess,
  GOOGLE_ERROR_MESSAGES,
  DRIVE_PROCESSING_CONFIG,
} from "@/lib/google"
import { downloadFile, getFile } from "@/lib/google/drive/client"

interface RouteParams {
  params: Promise<{ fileId: string }>
}

// Supported batch file MIME types
const BATCH_SUPPORTED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "application/vnd.google-apps.spreadsheet", // Google Sheets
  "text/csv",
]

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { fileId } = await params

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      )
    }

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

    // Get file metadata first to check type and size
    const fileMetadata = await getFile(user.id, fileId)

    if (!fileMetadata) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      )
    }

    // Check if file type is supported for batch processing
    const mimeType = fileMetadata.mimeType
    if (!BATCH_SUPPORTED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${mimeType}. Only Excel (.xlsx, .xls), Google Sheets, and CSV files are supported.` },
        { status: 400 }
      )
    }

    // Check file size (10MB limit for batch files)
    const MAX_BATCH_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (fileMetadata.size && parseInt(fileMetadata.size, 10) > MAX_BATCH_FILE_SIZE) {
      return NextResponse.json(
        { error: `File is too large. Maximum size for batch files is 10MB.` },
        { status: 400 }
      )
    }

    // Download the file
    const fileContent = await downloadFile(user.id, fileId, mimeType)

    // Return the file content as binary
    return new NextResponse(fileContent.content, {
      status: 200,
      headers: {
        "Content-Type": fileContent.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileContent.name)}"`,
        "Content-Length": String(fileContent.size),
        "X-File-Name": encodeURIComponent(fileContent.name),
        "X-File-Mime-Type": fileContent.mimeType,
      },
    })
  } catch (error) {
    console.error("[Drive File Download API] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download file" },
      { status: 500 }
    )
  }
}
