/**
 * Gmail Draft API Route - Individual Draft Operations
 * GET: Get a specific draft
 * PUT: Update a draft
 * DELETE: Delete/discard a draft
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  isGoogleIntegrationEnabled,
  hasGmailAccess,
  getDraft,
  updateDraft,
  deleteDraft,
  getProfile,
  GOOGLE_ERROR_MESSAGES,
} from "@/lib/google"

// ============================================================================
// GET - Get a specific draft
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ draftId: string }> }
) {
  try {
    const { draftId } = await params

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

    const hasAccess = await hasGmailAccess(user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { error: GOOGLE_ERROR_MESSAGES.notConnected },
        { status: 403 }
      )
    }

    const draft = await getDraft(user.id, draftId)

    return NextResponse.json({
      success: true,
      draft,
    })
  } catch (error) {
    console.error("[Draft API] GET Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get draft" },
      { status: 500 }
    )
  }
}

// ============================================================================
// PUT - Update a draft
// ============================================================================

interface UpdateDraftRequest {
  to: string[]
  cc?: string[]
  subject: string
  body: string
  threadId?: string
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ draftId: string }> }
) {
  try {
    const { draftId } = await params

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

    const hasAccess = await hasGmailAccess(user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { error: GOOGLE_ERROR_MESSAGES.notConnected },
        { status: 403 }
      )
    }

    const body: UpdateDraftRequest = await request.json()

    if (!body.to || body.to.length === 0) {
      return NextResponse.json(
        { error: "At least one recipient is required" },
        { status: 400 }
      )
    }

    if (!body.subject && !body.body) {
      return NextResponse.json(
        { error: "Subject or body is required" },
        { status: 400 }
      )
    }

    // Get user's email address
    const profile = await getProfile(user.id)

    // Update the draft in Gmail
    const updatedDraft = await updateDraft(
      user.id,
      draftId,
      {
        to: body.to,
        cc: body.cc,
        subject: body.subject,
        body: body.body,
        threadId: body.threadId,
      },
      profile.emailAddress
    )

    // Update local record
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("gmail_drafts")
        .update({
          to_recipients: body.to,
          cc_recipients: body.cc || [],
          subject: body.subject,
          body_preview: body.body.slice(0, 200),
          status: "edited",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("draft_id", draftId)
    } catch (dbError) {
      console.error("[Draft API] Failed to update local record:", dbError)
    }

    // Log the action
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("google_integration_audit_log").insert({
        user_id: user.id,
        action: "draft_update",
        status: "success",
        metadata: { draft_id: draftId },
      })
    } catch (auditError) {
      console.error("[Draft API] Audit log error:", auditError)
    }

    return NextResponse.json({
      success: true,
      draft: updatedDraft,
      message: "Draft updated successfully",
    })
  } catch (error) {
    console.error("[Draft API] PUT Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update draft" },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Delete/discard a draft
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ draftId: string }> }
) {
  try {
    const { draftId } = await params

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

    const hasAccess = await hasGmailAccess(user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { error: GOOGLE_ERROR_MESSAGES.notConnected },
        { status: 403 }
      )
    }

    // Delete from Gmail
    await deleteDraft(user.id, draftId)

    // Update local record status
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("gmail_drafts")
        .update({ status: "discarded" })
        .eq("user_id", user.id)
        .eq("draft_id", draftId)
    } catch (dbError) {
      console.error("[Draft API] Failed to update local record:", dbError)
    }

    // Log the action
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("google_integration_audit_log").insert({
        user_id: user.id,
        action: "draft_discard",
        status: "success",
        metadata: { draft_id: draftId },
      })
    } catch (auditError) {
      console.error("[Draft API] Audit log error:", auditError)
    }

    return NextResponse.json({
      success: true,
      message: "Draft discarded successfully",
    })
  } catch (error) {
    console.error("[Draft API] DELETE Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete draft" },
      { status: 500 }
    )
  }
}
