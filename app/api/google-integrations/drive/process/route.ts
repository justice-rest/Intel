/**
 * Google Drive File Processing API Route
 * POST: Import and process a file from Google Drive
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  isGoogleIntegrationEnabled,
  hasDriveAccess,
  getFile,
  extractTextContent,
  storeDocumentRecord,
  updateDocumentStatus,
  hasReachedDocumentLimit,
  isSupportedMimeType,
  GOOGLE_ERROR_MESSAGES,
  DRIVE_PROCESSING_CONFIG,
} from "@/lib/google"

interface ProcessFileRequest {
  fileId: string
  fileName?: string
  mimeType?: string
}

export async function POST(request: NextRequest) {
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

    // Check document limit
    const atLimit = await hasReachedDocumentLimit(user.id)
    if (atLimit) {
      return NextResponse.json(
        {
          error: `Maximum ${DRIVE_PROCESSING_CONFIG.maxDocumentsPerUser} documents allowed. Please remove some documents first.`,
        },
        { status: 400 }
      )
    }

    const body: ProcessFileRequest = await request.json()

    if (!body.fileId) {
      return NextResponse.json(
        { error: "fileId is required" },
        { status: 400 }
      )
    }

    // Get file metadata from Drive
    const file = await getFile(user.id, body.fileId)

    // Check if file type is supported
    if (!isSupportedMimeType(file.mimeType)) {
      return NextResponse.json(
        {
          error: GOOGLE_ERROR_MESSAGES.unsupportedType,
          supportedTypes: DRIVE_PROCESSING_CONFIG.supportedMimeTypes,
        },
        { status: 400 }
      )
    }

    // Check file size
    if (
      file.size &&
      parseInt(file.size, 10) > DRIVE_PROCESSING_CONFIG.maxFileSize
    ) {
      return NextResponse.json(
        { error: GOOGLE_ERROR_MESSAGES.fileTooLarge },
        { status: 400 }
      )
    }

    // Store initial record
    await storeDocumentRecord(user.id, file)
    await updateDocumentStatus(user.id, file.id, "processing")

    // Log the action
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("google_integration_audit_log").insert({
        user_id: user.id,
        action: "drive_file_process",
        status: "success",
        metadata: {
          drive_file_id: file.id,
          file_name: file.name,
          mime_type: file.mimeType,
          event: "processing_started",
        },
      })
    } catch (auditError) {
      console.error("[Drive Process API] Audit log error:", auditError)
    }

    try {
      // Extract text content
      const textContent = await extractTextContent(user.id, file.id, file.mimeType)

      // Here we would integrate with the RAG system to index the content
      // For now, we'll mark it as ready and store metadata
      // TODO: Call RAG indexing pipeline
      // const ragDocId = await indexDocumentForRAG(user.id, file.name, textContent)

      await updateDocumentStatus(user.id, file.id, "ready")

      return NextResponse.json({
        success: true,
        documentId: file.id,
        fileName: file.name,
        mimeType: file.mimeType,
        contentLength: textContent.length,
        status: "ready",
        message: `Successfully imported "${file.name}"`,
      })
    } catch (processingError) {
      console.error("[Drive Process API] Processing error:", processingError)

      await updateDocumentStatus(
        user.id,
        file.id,
        "failed",
        processingError instanceof Error
          ? processingError.message
          : "Processing failed"
      )

      return NextResponse.json(
        {
          success: false,
          documentId: file.id,
          fileName: file.name,
          status: "failed",
          error:
            processingError instanceof Error
              ? processingError.message
              : "Failed to process file",
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("[Drive Process API] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process file" },
      { status: 500 }
    )
  }
}
