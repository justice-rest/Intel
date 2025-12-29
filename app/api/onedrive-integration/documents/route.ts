/**
 * OneDrive Integration - Documents Route
 *
 * GET /api/onedrive-integration/documents - List indexed documents
 * DELETE /api/onedrive-integration/documents - Remove a document from index
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"

interface OneDriveDocument {
  id: string
  onedrive_item_id: string
  onedrive_file_name: string
  onedrive_file_path?: string
  onedrive_mime_type: string
  onedrive_web_url?: string
  status: "pending" | "processing" | "ready" | "failed"
  file_size?: number
  word_count?: number
  created_at: string
  last_synced_at?: string
}

/**
 * GET - List indexed OneDrive documents
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
      .from("onedrive_documents")
      .select("id, onedrive_item_id, onedrive_file_name, onedrive_file_path, onedrive_mime_type, onedrive_web_url, status, file_size, word_count, created_at, last_synced_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (docsError) {
      console.error("[OneDriveDocuments] Error fetching documents:", docsError)
      return NextResponse.json({ documents: [], count: 0 })
    }

    return NextResponse.json({
      documents: documents as OneDriveDocument[],
      count: documents?.length || 0,
    })
  } catch (error) {
    console.error("[OneDriveDocuments] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch OneDrive documents" },
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
    const { fileId } = body as { fileId: string }

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId is required" },
        { status: 400 }
      )
    }

    // Delete document
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from("onedrive_documents")
      .delete()
      .eq("user_id", user.id)
      .eq("onedrive_item_id", fileId)

    if (deleteError) {
      console.error("[OneDriveDocuments] Error deleting document:", deleteError)
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      )
    }

    // TODO: Also delete associated RAG document chunks

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[OneDriveDocuments] Error:", error)
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    )
  }
}
