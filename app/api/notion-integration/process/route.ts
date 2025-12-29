/**
 * Notion Integration - Process Route
 *
 * POST /api/notion-integration/process - Import a page into RAG system
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import {
  getValidAccessToken,
  getPage,
  getDatabase,
  getAllBlocks,
  extractPageContent,
  extractDatabaseContent,
  generateContentHash,
  getIconString,
  NOTION_ERROR_MESSAGES,
  NOTION_PROCESSING_CONFIG,
} from "@/lib/notion"
import type { NotionPage, NotionDatabase } from "@/lib/notion"

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
    const { pageId, type = "page" } = body as { pageId: string; type?: "page" | "database" }

    if (!pageId) {
      return NextResponse.json(
        { error: "pageId is required" },
        { status: 400 }
      )
    }

    // Clean page ID (remove dashes if present)
    const cleanPageId = pageId.replace(/-/g, "")

    // Get access token
    let accessToken: string
    try {
      accessToken = await getValidAccessToken(user.id)
    } catch {
      return NextResponse.json(
        { error: NOTION_ERROR_MESSAGES.notConnected },
        { status: 400 }
      )
    }

    // Check document limit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { count: docCount } = await sb
      .from("notion_documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    if ((docCount || 0) >= NOTION_PROCESSING_CONFIG.maxDocumentsPerUser) {
      return NextResponse.json(
        { error: NOTION_ERROR_MESSAGES.documentLimitReached },
        { status: 400 }
      )
    }

    // Check if already indexed
    const { data: existingDoc } = await sb
      .from("notion_documents")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("notion_page_id", cleanPageId)
      .single()

    if (existingDoc && existingDoc.status === "ready") {
      return NextResponse.json(
        { error: "Page is already indexed", documentId: existingDoc.id },
        { status: 400 }
      )
    }

    // Create or update document record with processing status
    const docId = existingDoc?.id || undefined
    const { data: docRecord, error: docError } = await sb
      .from("notion_documents")
      .upsert(
        {
          ...(docId ? { id: docId } : {}),
          user_id: user.id,
          notion_page_id: cleanPageId,
          notion_page_title: "Processing...",
          notion_object_type: type,
          status: "processing",
          error_message: null,
        },
        { onConflict: "user_id,notion_page_id" }
      )
      .select()
      .single()

    if (docError || !docRecord) {
      console.error("[NotionProcess] Failed to create document record:", docError)
      return NextResponse.json(
        { error: "Failed to create document record" },
        { status: 500 }
      )
    }

    try {
      // Fetch page or database metadata
      let pageData: NotionPage | NotionDatabase
      if (type === "database") {
        pageData = await getDatabase(accessToken, cleanPageId)
      } else {
        pageData = await getPage(accessToken, cleanPageId)
      }

      // Fetch all blocks
      const blocks = await getAllBlocks(accessToken, cleanPageId, {
        maxBlocks: NOTION_PROCESSING_CONFIG.maxBlocksPerPage,
        maxDepth: NOTION_PROCESSING_CONFIG.maxDepth,
      })

      // Extract content
      let extracted
      if (type === "database") {
        extracted = extractDatabaseContent(pageData as NotionDatabase, blocks)
      } else {
        extracted = extractPageContent(pageData as NotionPage, blocks)
      }

      // Generate content hash
      const contentHash = generateContentHash(extracted.content)

      // Update document record with extracted data
      await sb
        .from("notion_documents")
        .update({
          notion_page_title: extracted.title,
          notion_url: pageData.url,
          notion_last_edited_time: pageData.last_edited_time,
          notion_icon: getIconString(pageData.icon),
          word_count: extracted.wordCount,
          block_count: extracted.blockCount,
          content_hash: contentHash,
          status: "ready", // For now, mark as ready without RAG processing
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", docRecord.id)

      // TODO: Integrate with RAG system for chunking and embedding
      // This would involve:
      // 1. Chunk the content using existing chunker
      // 2. Generate embeddings
      // 3. Store in rag_documents and rag_document_chunks
      // 4. Update notion_documents.rag_document_id

      return NextResponse.json({
        success: true,
        document: {
          id: docRecord.id,
          pageId: cleanPageId,
          title: extracted.title,
          type,
          wordCount: extracted.wordCount,
          blockCount: extracted.blockCount,
          status: "ready",
        },
      })
    } catch (processError) {
      // Update document status to failed
      await sb
        .from("notion_documents")
        .update({
          status: "failed",
          error_message: processError instanceof Error ? processError.message : "Processing failed",
        })
        .eq("id", docRecord.id)

      throw processError
    }
  } catch (error) {
    console.error("[NotionProcess] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process page" },
      { status: 500 }
    )
  }
}
