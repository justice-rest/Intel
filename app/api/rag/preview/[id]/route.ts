import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getDocument } from "@/lib/rag"
import { getCustomerData, normalizePlanId } from "@/lib/subscription/autumn-client"

// Limit chunks to prevent memory issues with very large documents
const MAX_CHUNKS_PER_PREVIEW = 500

/**
 * GET /api/rag/preview/[id]
 * Get document content (chunks) for preview
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const documentId = params.id

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has Scale plan
    const customerData = await getCustomerData(user.id, 5000)
    const currentProductId = customerData?.products?.[0]?.id
    const planType = normalizePlanId(currentProductId)

    if (planType !== "scale") {
      return NextResponse.json(
        { error: "Scale plan required for RAG features" },
        { status: 403 }
      )
    }

    // Get document to verify ownership
    const document = await getDocument(documentId, user.id)

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    // Check document status - only preview ready documents
    if (document.status !== "ready") {
      return NextResponse.json(
        {
          error: document.status === "processing"
            ? "Document is still processing. Please wait for processing to complete."
            : document.status === "failed"
            ? `Document processing failed: ${document.error_message || "Unknown error"}`
            : "Document is not ready for preview"
        },
        { status: 400 }
      )
    }

    // Get document chunks ordered by page and chunk index (with limit)
    const { data: chunks, error: chunksError } = await supabase
      .from("rag_document_chunks")
      .select("id, chunk_index, content, page_number, token_count")
      .eq("document_id", documentId)
      .eq("user_id", user.id)
      .order("page_number", { ascending: true, nullsFirst: true })
      .order("chunk_index", { ascending: true })
      .limit(MAX_CHUNKS_PER_PREVIEW)

    if (chunksError) {
      throw new Error(`Failed to fetch chunks: ${chunksError.message}`)
    }

    // Handle empty chunks case
    if (!chunks || chunks.length === 0) {
      return NextResponse.json({
        document: {
          id: document.id,
          fileName: document.file_name,
          fileType: document.file_type,
          pageCount: document.page_count,
          wordCount: document.word_count,
          language: document.language,
          tags: document.tags || [],
          status: document.status,
          createdAt: document.created_at,
        },
        pages: [],
        totalChunks: 0,
        truncated: false,
      })
    }

    // Group chunks by page for easier rendering (using array for efficiency)
    const pageGroups: Record<number, { contents: string[]; chunkCount: number }> = {}

    for (const chunk of chunks) {
      const pageNum = chunk.page_number || 1
      if (!pageGroups[pageNum]) {
        pageGroups[pageNum] = { contents: [], chunkCount: 0 }
      }
      pageGroups[pageNum].contents.push(chunk.content)
      pageGroups[pageNum].chunkCount++
    }

    // Convert to array format (join is more efficient than repeated concatenation)
    const pages = Object.entries(pageGroups)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([pageNum, data]) => ({
        pageNumber: Number(pageNum),
        content: data.contents.join("\n\n"),
        chunkCount: data.chunkCount,
      }))

    return NextResponse.json({
      document: {
        id: document.id,
        fileName: document.file_name,
        fileType: document.file_type,
        pageCount: document.page_count,
        wordCount: document.word_count,
        language: document.language,
        tags: document.tags || [],
        status: document.status,
        createdAt: document.created_at,
      },
      pages,
      totalChunks: chunks.length,
      truncated: chunks.length >= MAX_CHUNKS_PER_PREVIEW,
    })
  } catch (error) {
    console.error("Preview document error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to preview document",
      },
      { status: 500 }
    )
  }
}
