/**
 * Google Drive File Processing API Route
 * POST: Import and process a file from Google Drive with full RAG indexing
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
import { chunkText, getChunkingStats } from "@/lib/rag/chunker"
import { generateEmbeddingsInBatches } from "@/lib/rag/embeddings"
import { RAG_CHUNK_SIZE, RAG_CHUNK_OVERLAP } from "@/lib/rag/config"
import { encode } from "gpt-tokenizer"

interface ProcessFileRequest {
  fileId: string
  fileName?: string
  mimeType?: string
}

// Vercel Pro timeout
export const maxDuration = 300 // 5 minutes

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
      console.log(`[Drive Process API] Extracting content from ${file.name}...`)
      const textContent = await extractTextContent(user.id, file.id, file.mimeType)

      if (!textContent || textContent.trim().length < 50) {
        throw new Error("Document appears to be empty or contains insufficient text content")
      }

      console.log(`[Drive Process API] Extracted ${textContent.length} characters`)

      // Chunk the text
      const wordCount = textContent.split(/\s+/).filter((w) => w.length > 0).length
      const estimatedPages = Math.ceil(wordCount / 250)
      const chunks = chunkText(textContent, estimatedPages, RAG_CHUNK_SIZE, RAG_CHUNK_OVERLAP)

      if (chunks.length === 0) {
        throw new Error("Failed to create text chunks from document")
      }

      const stats = getChunkingStats(chunks)
      console.log(`[Drive Process API] Created ${stats.totalChunks} chunks, ${stats.totalTokens} tokens`)

      // Get OpenRouter API key for embeddings
      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error("OpenRouter API key not configured for embeddings")
      }

      // Generate embeddings for all chunks
      console.log(`[Drive Process API] Generating embeddings for ${chunks.length} chunks...`)
      const chunkTexts = chunks.map((c) => c.content)
      const embeddings = await generateEmbeddingsInBatches(chunkTexts, apiKey)

      console.log(`[Drive Process API] Generated ${embeddings.length} embeddings`)

      // Create RAG document record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ragDocument, error: ragDocError } = await (supabase as any)
        .from("rag_documents")
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_url: file.webViewLink || null,
          file_size: file.size ? parseInt(file.size, 10) : null,
          page_count: estimatedPages,
          word_count: wordCount,
          language: "en",
          tags: ["google-drive"],
          status: "ready",
        })
        .select("id")
        .single()

      if (ragDocError) {
        console.error("[Drive Process API] Failed to create RAG document:", ragDocError)
        throw new Error("Failed to create document record")
      }

      const ragDocumentId = ragDocument.id

      // Insert chunks with embeddings
      const chunkRecords = chunks.map((chunk, index) => ({
        document_id: ragDocumentId,
        user_id: user.id,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        page_number: chunk.pageNumber || null,
        embedding: JSON.stringify(embeddings[index]),
        token_count: chunk.tokenCount,
      }))

      // Insert in batches to avoid hitting row limits
      const BATCH_SIZE = 50
      for (let i = 0; i < chunkRecords.length; i += BATCH_SIZE) {
        const batch = chunkRecords.slice(i, i + BATCH_SIZE)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase as any)
          .from("rag_document_chunks")
          .insert(batch)

        if (insertError) {
          console.error(`[Drive Process API] Chunk batch insert error:`, insertError)
          // Clean up on failure
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("rag_documents")
            .delete()
            .eq("id", ragDocumentId)
          throw new Error("Failed to store document chunks")
        }
      }

      console.log(`[Drive Process API] Stored ${chunkRecords.length} chunks with embeddings`)

      // Update Drive document record with RAG reference
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("google_drive_documents")
        .update({
          rag_document_id: ragDocumentId,
          status: "ready",
          last_synced_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("drive_file_id", file.id)

      await updateDocumentStatus(user.id, file.id, "ready")

      // Log success
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("google_integration_audit_log").insert({
          user_id: user.id,
          action: "drive_file_process",
          status: "success",
          metadata: {
            drive_file_id: file.id,
            file_name: file.name,
            rag_document_id: ragDocumentId,
            chunk_count: chunks.length,
            token_count: stats.totalTokens,
            event: "processing_completed",
          },
        })
      } catch (auditError) {
        console.error("[Drive Process API] Audit log error:", auditError)
      }

      return NextResponse.json({
        success: true,
        documentId: file.id,
        ragDocumentId,
        fileName: file.name,
        mimeType: file.mimeType,
        contentLength: textContent.length,
        chunkCount: chunks.length,
        tokenCount: stats.totalTokens,
        status: "ready",
        message: `Successfully indexed "${file.name}" with ${chunks.length} chunks`,
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

      // Log failure
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("google_integration_audit_log").insert({
          user_id: user.id,
          action: "drive_file_process",
          status: "failure",
          error_message: processingError instanceof Error ? processingError.message : "Unknown error",
          metadata: {
            drive_file_id: file.id,
            file_name: file.name,
            event: "processing_failed",
          },
        })
      } catch (auditError) {
        console.error("[Drive Process API] Audit log error:", auditError)
      }

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
