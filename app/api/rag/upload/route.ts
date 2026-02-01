import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  processPDF,
  isValidPDF,
  chunkText,
  generateEmbeddingsInBatches,
  checkUploadLimit,
  RAG_MAX_FILE_SIZE,
  RAG_ALLOWED_FILE_TYPES,
  RAG_EMBEDDING_BATCH_SIZE,
} from "@/lib/rag"
import { getCustomerData, normalizePlanId } from "@/lib/subscription/autumn-client"

// Ensure Node.js runtime for long-running operations
export const runtime = "nodejs"
export const maxDuration = 300 // 5 minutes for large PDF processing

export async function POST(request: Request) {
  console.log("[RAG Upload] POST request received")

  try {
    // Parse form data
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const tags = formData.get("tags") as string | null

    console.log(`[RAG Upload] File received: ${file?.name}, size: ${file?.size}`)

    if (!file) {
      console.log("[RAG Upload] No file provided")
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > RAG_MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${RAG_MAX_FILE_SIZE / (1024 * 1024)}MB`,
        },
        { status: 400 }
      )
    }

    // Validate file type
    if (!RAG_ALLOWED_FILE_TYPES.includes(file.type as any)) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      )
    }

    // Get authenticated user
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

    // Check if user has Scale plan (use higher timeout - RAG is not latency-critical)
    const customerData = await getCustomerData(user.id, 5000)
    const currentProductId = customerData?.products?.[0]?.id
    const planType = normalizePlanId(currentProductId)

    console.log(`[RAG Upload] Plan check - userId: ${user.id}, productId: ${currentProductId}, planType: ${planType}, hasCustomerData: ${!!customerData}`)

    if (planType !== "scale") {
      console.log(`[RAG Upload] Access denied - planType "${planType}" is not "scale"`)
      return NextResponse.json(
        { error: "Scale plan required for RAG features" },
        { status: 403 }
      )
    }

    // Check upload limits
    await checkUploadLimit(user.id, file.size)

    // Read file buffer
    console.log("[RAG Upload] Reading file buffer...")
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log(`[RAG Upload] Buffer created: ${buffer.length} bytes`)

    // Validate PDF magic bytes
    console.log("[RAG Upload] Validating PDF format...")
    if (!isValidPDF(buffer)) {
      console.log("[RAG Upload] Invalid PDF file (magic bytes check failed)")
      return NextResponse.json(
        { error: "Invalid PDF file" },
        { status: 400 }
      )
    }
    console.log("[RAG Upload] PDF validation passed")

    // Parse tags
    const tagArray = tags
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : []

    // Upload file to Supabase storage
    console.log("[RAG Upload] Uploading to Supabase storage...")
    const fileName = `${user.id}/${Date.now()}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("rag-documents")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.log("[RAG Upload] Storage upload failed:", uploadError)
      throw new Error(`Failed to upload file: ${uploadError.message}`)
    }
    console.log("[RAG Upload] File uploaded to storage successfully")

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("rag-documents").getPublicUrl(fileName)

    // Create document record with 'processing' status
    console.log("[RAG Upload] Creating document record...")
    const { data: document, error: docError } = await (supabase as any)
      .from("rag_documents")
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        file_type: file.type,
        tags: tagArray,
        status: "processing",
      })
      .select()
      .single()

    if (docError) {
      console.log("[RAG Upload] Failed to create document record:", docError)
      throw new Error(`Failed to create document record: ${docError.message}`)
    }
    console.log(`[RAG Upload] Document record created: ${document.id}`)

    // Process PDF (extract text and metadata)
    console.log("[RAG Upload] Starting PDF processing...")
    let pdfData
    try {
      pdfData = await processPDF(buffer)
      console.log("[RAG Upload] PDF processing completed successfully")
    } catch (error) {
      // Update document status to failed
      await (supabase as any)
        .from("rag_documents")
        .update({
          status: "failed",
          error_message:
            error instanceof Error ? error.message : "PDF processing failed",
        })
        .eq("id", document.id)

      throw error
    }

    // Chunk the text
    const chunks = chunkText(pdfData.text, pdfData.pageCount)

    if (chunks.length === 0) {
      await (supabase as any)
        .from("rag_documents")
        .update({
          status: "failed",
          error_message: "No text content found in PDF",
        })
        .eq("id", document.id)

      return NextResponse.json(
        { error: "No text content found in PDF" },
        { status: 400 }
      )
    }

    // Get OpenRouter API key
    const openrouterKey = process.env.OPENROUTER_API_KEY
    if (!openrouterKey) {
      throw new Error("OpenRouter API key not configured")
    }

    // Generate embeddings for all chunks
    let embeddings: number[][]
    try {
      const chunkTexts = chunks.map((c) => c.content)
      embeddings = await generateEmbeddingsInBatches(
        chunkTexts,
        openrouterKey,
        RAG_EMBEDDING_BATCH_SIZE
      )
    } catch (error) {
      // Update document status to failed
      await (supabase as any)
        .from("rag_documents")
        .update({
          status: "failed",
          error_message:
            error instanceof Error
              ? error.message
              : "Failed to generate embeddings",
        })
        .eq("id", document.id)

      throw new Error(
        `Failed to generate embeddings: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }

    // Insert chunks with embeddings into database
    const chunkRecords = chunks.map((chunk, index) => {
      // Sanitize content to remove problematic characters that PostgreSQL rejects
      let sanitizedContent = chunk.content
        // Remove null bytes (PostgreSQL doesn't allow \u0000 in text fields)
        .replace(/\u0000/g, "")
        // Remove other problematic control characters
        .replace(/[\u0001-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, "")

      return {
        document_id: document.id,
        user_id: user.id,
        chunk_index: chunk.chunkIndex,
        content: sanitizedContent,
        page_number: chunk.pageNumber,
        embedding: `[${embeddings[index].join(',')}]`, // Format as pgvector string: [0.1,0.2,0.3]
        token_count: chunk.tokenCount,
      }
    })

    const { error: chunksError } = await (supabase as any)
      .from("rag_document_chunks")
      .insert(chunkRecords)

    if (chunksError) {
      // Update document status to failed
      await (supabase as any)
        .from("rag_documents")
        .update({
          status: "failed",
          error_message: `Failed to save chunks: ${chunksError.message}`,
        })
        .eq("id", document.id)

      throw new Error(`Failed to insert chunks: ${chunksError.message}`)
    }

    // Update document with metadata and status
    const { data: finalDocument, error: updateError } = await (supabase as any)
      .from("rag_documents")
      .update({
        page_count: pdfData.pageCount,
        word_count: pdfData.wordCount,
        language: pdfData.language,
        status: "ready",
        processed_at: new Date().toISOString(),
      })
      .eq("id", document.id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`)
    }

    // Return success response with explicit JSON serialization
    const responseData = {
      document: finalDocument,
      chunks_created: chunks.length,
      message: "Document uploaded and processed successfully",
    }

    return new NextResponse(JSON.stringify(responseData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    console.error("RAG upload error:", error)

    // Ensure error response is always valid JSON
    const errorMessage =
      error instanceof Error ? error.message : "Failed to upload document"

    const errorResponse = {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }

    return new NextResponse(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    })
  }
}
