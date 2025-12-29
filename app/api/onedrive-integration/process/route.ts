/**
 * OneDrive Integration - Process Route
 *
 * POST /api/onedrive-integration/process - Import a file into RAG system
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { createHash } from "crypto"
import {
  getValidAccessToken,
  getFile,
  downloadFile,
  getFilePath,
  isSupportedFileType,
  ONEDRIVE_ERROR_MESSAGES,
  ONEDRIVE_PROCESSING_CONFIG,
} from "@/lib/onedrive"

/**
 * Generate a hash of file content for change detection
 */
function generateContentHash(content: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(content)).digest("hex")
}

/**
 * Count words in text (approximate)
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json()
    const { fileId, fileName, mimeType } = body as {
      fileId: string
      fileName: string
      mimeType: string
    }

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId is required" },
        { status: 400 }
      )
    }

    // Check if file type is supported
    if (!isSupportedFileType(mimeType)) {
      return NextResponse.json(
        { error: ONEDRIVE_ERROR_MESSAGES.unsupportedType },
        { status: 400 }
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

    // Check document limit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { count: docCount } = await sb
      .from("onedrive_documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    if ((docCount || 0) >= ONEDRIVE_PROCESSING_CONFIG.maxDocumentsPerUser) {
      return NextResponse.json(
        { error: ONEDRIVE_ERROR_MESSAGES.documentLimitReached },
        { status: 400 }
      )
    }

    // Check if already indexed
    const { data: existingDoc } = await sb
      .from("onedrive_documents")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("onedrive_item_id", fileId)
      .single()

    if (existingDoc && existingDoc.status === "ready") {
      return NextResponse.json(
        { error: "File is already indexed", documentId: existingDoc.id },
        { status: 400 }
      )
    }

    // Get file metadata from OneDrive
    const fileMetadata = await getFile(accessToken, fileId)

    // Check file size
    if (fileMetadata.size && fileMetadata.size > ONEDRIVE_PROCESSING_CONFIG.maxFileSizeBytes) {
      return NextResponse.json(
        { error: ONEDRIVE_ERROR_MESSAGES.fileTooLarge },
        { status: 400 }
      )
    }

    // Create or update document record with processing status
    const docId = existingDoc?.id || undefined
    const { data: docRecord, error: docError } = await sb
      .from("onedrive_documents")
      .upsert(
        {
          ...(docId ? { id: docId } : {}),
          user_id: user.id,
          onedrive_item_id: fileId,
          onedrive_file_name: fileName || fileMetadata.name,
          onedrive_file_path: getFilePath(fileMetadata),
          onedrive_mime_type: mimeType || fileMetadata.file?.mimeType,
          onedrive_web_url: fileMetadata.webUrl,
          onedrive_last_modified_time: fileMetadata.lastModifiedDateTime,
          file_size: fileMetadata.size,
          status: "processing",
          error_message: null,
        },
        { onConflict: "user_id,onedrive_item_id" }
      )
      .select()
      .single()

    if (docError || !docRecord) {
      console.error("[OneDriveProcess] Failed to create document record:", docError)
      return NextResponse.json(
        { error: "Failed to create document record" },
        { status: 500 }
      )
    }

    try {
      // Download file content
      const content = await downloadFile(accessToken, fileId)

      // Generate content hash
      const contentHash = generateContentHash(content)

      // Extract text based on file type
      // For now, we'll just count the raw size as a placeholder
      // TODO: Integrate with existing office-processor and pdf-processor
      let wordCount = 0

      // For text files, we can extract content directly
      if (mimeType.startsWith("text/") || mimeType === "application/json") {
        const textContent = new TextDecoder().decode(content)
        wordCount = countWords(textContent)
      }

      // Update document record with extracted data
      await sb
        .from("onedrive_documents")
        .update({
          word_count: wordCount,
          content_hash: contentHash,
          status: "ready", // For now, mark as ready without RAG processing
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", docRecord.id)

      // TODO: Integrate with RAG system for chunking and embedding
      // This would involve:
      // 1. Use office-processor or pdf-processor to extract text
      // 2. Chunk the content using existing chunker
      // 3. Generate embeddings
      // 4. Store in rag_documents and rag_document_chunks
      // 5. Update onedrive_documents.rag_document_id

      return NextResponse.json({
        success: true,
        document: {
          id: docRecord.id,
          fileId,
          fileName: fileName || fileMetadata.name,
          mimeType,
          fileSize: fileMetadata.size,
          wordCount,
          status: "ready",
        },
      })
    } catch (processError) {
      // Update document status to failed
      await sb
        .from("onedrive_documents")
        .update({
          status: "failed",
          error_message: processError instanceof Error ? processError.message : "Processing failed",
        })
        .eq("id", docRecord.id)

      throw processError
    }
  } catch (error) {
    console.error("[OneDriveProcess] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process file" },
      { status: 500 }
    )
  }
}
