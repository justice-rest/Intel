/**
 * Google Drive Documents API Route
 * GET: List indexed documents
 * DELETE: Remove a document from index
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  isGoogleIntegrationEnabled,
  hasDriveAccess,
  getIndexedDocuments,
  deleteDocumentRecord,
  GOOGLE_ERROR_MESSAGES,
} from "@/lib/google"

// ============================================================================
// GET - List indexed documents
// ============================================================================

export async function GET() {
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

    const documents = await getIndexedDocuments(user.id)

    return NextResponse.json({
      success: true,
      documents,
      count: documents.length,
    })
  } catch (error) {
    console.error("[Drive Documents API] GET Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list documents" },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Remove document from index
// ============================================================================

export async function DELETE(request: NextRequest) {
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

    const { driveFileId } = await request.json()

    if (!driveFileId) {
      return NextResponse.json(
        { error: "driveFileId is required" },
        { status: 400 }
      )
    }

    await deleteDocumentRecord(user.id, driveFileId)

    // Log the action
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("google_integration_audit_log").insert({
        user_id: user.id,
        action: "drive_file_delete",
        status: "success",
        metadata: { drive_file_id: driveFileId },
      })
    } catch (auditError) {
      console.error("[Drive Documents API] Audit log error:", auditError)
    }

    return NextResponse.json({
      success: true,
      message: "Document removed from index",
    })
  } catch (error) {
    console.error("[Drive Documents API] DELETE Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete document" },
      { status: 500 }
    )
  }
}
