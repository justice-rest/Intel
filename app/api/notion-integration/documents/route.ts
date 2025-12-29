/**
 * Notion Integration - Documents Route
 *
 * GET /api/notion-integration/documents - List indexed documents
 * DELETE /api/notion-integration/documents - Remove a document from index
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"

interface NotionDocument {
  id: string
  notion_page_id: string
  notion_page_title: string
  notion_object_type: "page" | "database"
  notion_url?: string
  notion_icon?: string
  status: "pending" | "processing" | "ready" | "failed"
  word_count?: number
  block_count?: number
  created_at: string
  last_synced_at?: string
}

/**
 * GET - List indexed Notion documents
 */
export async function GET() {
  try {
    // Get authenticated user
    if (!isSupabaseEnabled) {
      return NextResponse.json({ documents: [], count: 0 })
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

    // Fetch documents
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: documents, error: docsError } = await (supabase as any)
      .from("notion_documents")
      .select("id, notion_page_id, notion_page_title, notion_object_type, notion_url, notion_icon, status, word_count, block_count, created_at, last_synced_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (docsError) {
      console.error("[NotionDocuments] Error fetching documents:", docsError)
      return NextResponse.json({ documents: [], count: 0 })
    }

    return NextResponse.json({
      documents: documents as NotionDocument[],
      count: documents?.length || 0,
    })
  } catch (error) {
    console.error("[NotionDocuments] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch Notion documents" },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove a document from the index
 */
export async function DELETE(request: NextRequest) {
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
    const { pageId } = body as { pageId: string }

    if (!pageId) {
      return NextResponse.json(
        { error: "pageId is required" },
        { status: 400 }
      )
    }

    // Clean page ID (remove dashes if present)
    const cleanPageId = pageId.replace(/-/g, "")

    // Delete document
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from("notion_documents")
      .delete()
      .eq("user_id", user.id)
      .eq("notion_page_id", cleanPageId)

    if (deleteError) {
      console.error("[NotionDocuments] Error deleting document:", deleteError)
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      )
    }

    // TODO: Also delete associated RAG document chunks
    // This would involve:
    // 1. Get rag_document_id from notion_documents before deleting
    // 2. Delete rag_document_chunks with that rag_document_id
    // 3. Delete rag_documents with that id

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[NotionDocuments] Error:", error)
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    )
  }
}
