/**
 * Gmail Drafts API Route
 * GET: List all drafts
 * POST: Create a new draft
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  isGoogleIntegrationEnabled,
  hasGmailAccess,
  listDrafts,
  createDraft,
  getProfile,
  GOOGLE_ERROR_MESSAGES,
  GMAIL_CONFIG,
} from "@/lib/google"

// Simple email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim())
}

/**
 * Sanitize email body to prevent potential issues
 * Removes script tags and other dangerous content
 */
function sanitizeEmailBody(body: string): string {
  return body
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
}

// ============================================================================
// GET - List all drafts
// ============================================================================

export async function GET(request: NextRequest) {
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

    const hasAccess = await hasGmailAccess(user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { error: GOOGLE_ERROR_MESSAGES.notConnected },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20", 10),
      50
    )

    // Fetch drafts from database (AI-created + manually tracked)
    let dbDrafts: any[] = []
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("gmail_drafts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit)

      if (!error && data) {
        dbDrafts = data
      }
    } catch (dbError) {
      console.error("[Gmail Drafts API] DB Error:", dbError)
    }

    // If no DB records, fall back to Gmail API
    if (dbDrafts.length === 0) {
      const gmailDrafts = await listDrafts(user.id, limit)
      return NextResponse.json({
        success: true,
        drafts: gmailDrafts.map((d: any) => ({
          id: d.id,
          user_id: user.id,
          draft_id: d.id,
          thread_id: d.threadId || null,
          to_recipients: d.to || [],
          cc_recipients: [],
          subject: d.subject || "",
          body_preview: d.snippet || "",
          chat_id: null,
          created_by_ai: false,
          status: "pending",
          created_at: new Date().toISOString(),
        })),
        count: gmailDrafts.length,
      })
    }

    return NextResponse.json({
      success: true,
      drafts: dbDrafts,
      count: dbDrafts.length,
    })
  } catch (error) {
    console.error("[Gmail Drafts API] GET Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list drafts" },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Create a new draft
// ============================================================================

interface CreateDraftRequest {
  to: string[]
  subject: string
  body: string
  cc?: string[]
  bcc?: string[]
  threadId?: string
  chatId?: string
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

    const hasAccess = await hasGmailAccess(user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { error: GOOGLE_ERROR_MESSAGES.notConnected },
        { status: 403 }
      )
    }

    // Parse request body
    const body: CreateDraftRequest = await request.json()

    // Validate inputs
    if (!body.to || body.to.length === 0) {
      return NextResponse.json(
        { error: "At least one recipient is required" },
        { status: 400 }
      )
    }

    if (body.to.length > GMAIL_CONFIG.maxRecipientsPerDraft) {
      return NextResponse.json(
        { error: `Maximum ${GMAIL_CONFIG.maxRecipientsPerDraft} recipients allowed` },
        { status: 400 }
      )
    }

    // Validate email formats for all recipients
    const invalidEmails = body.to.filter((email) => !isValidEmail(email))
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { error: `Invalid email format: ${invalidEmails.join(", ")}` },
        { status: 400 }
      )
    }

    // Validate CC emails if provided
    if (body.cc && body.cc.length > 0) {
      const invalidCcEmails = body.cc.filter((email) => !isValidEmail(email))
      if (invalidCcEmails.length > 0) {
        return NextResponse.json(
          { error: `Invalid CC email format: ${invalidCcEmails.join(", ")}` },
          { status: 400 }
        )
      }
    }

    // Validate BCC emails if provided
    if (body.bcc && body.bcc.length > 0) {
      const invalidBccEmails = body.bcc.filter((email) => !isValidEmail(email))
      if (invalidBccEmails.length > 0) {
        return NextResponse.json(
          { error: `Invalid BCC email format: ${invalidBccEmails.join(", ")}` },
          { status: 400 }
        )
      }
    }

    if (!body.subject) {
      return NextResponse.json(
        { error: "Subject is required" },
        { status: 400 }
      )
    }

    if (body.subject.length > GMAIL_CONFIG.maxSubjectLength) {
      return NextResponse.json(
        { error: `Subject must be less than ${GMAIL_CONFIG.maxSubjectLength} characters` },
        { status: 400 }
      )
    }

    if (!body.body) {
      return NextResponse.json(
        { error: "Body is required" },
        { status: 400 }
      )
    }

    if (body.body.length > GMAIL_CONFIG.maxBodyLength) {
      return NextResponse.json(
        { error: `Body must be less than ${GMAIL_CONFIG.maxBodyLength} characters` },
        { status: 400 }
      )
    }

    // Check hourly rate limit
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count, error: countError } = await (supabase as any)
        .from("gmail_drafts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())

      if (!countError && count !== null && count >= GMAIL_CONFIG.maxDraftsPerHour) {
        return NextResponse.json(
          { error: `Rate limit exceeded. Maximum ${GMAIL_CONFIG.maxDraftsPerHour} drafts per hour.` },
          { status: 429 }
        )
      }
    } catch (rateLimitError) {
      console.error("[Gmail Drafts API] Rate limit check error:", rateLimitError)
      // Continue if rate limit check fails - don't block user
    }

    // Get user's email address
    const profile = await getProfile(user.id)
    if (!profile?.emailAddress) {
      return NextResponse.json(
        { error: "Could not retrieve your Gmail profile. Please reconnect your account." },
        { status: 500 }
      )
    }

    // Sanitize email body
    const sanitizedBody = sanitizeEmailBody(body.body)

    // Create draft
    const draft = await createDraft(
      user.id,
      {
        to: body.to,
        cc: body.cc,
        bcc: body.bcc,
        subject: body.subject,
        body: sanitizedBody,
        threadId: body.threadId,
      },
      profile.emailAddress
    )

    // Store draft record in database
    let dbSaveSuccess = true
    try {
      // Using 'any' cast as table is not yet in generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase as any).from("gmail_drafts").insert({
        user_id: user.id,
        draft_id: draft.id,
        thread_id: body.threadId || null,
        to_recipients: body.to,
        cc_recipients: body.cc || [],
        subject: body.subject,
        body_preview: sanitizedBody.slice(0, 200),
        chat_id: body.chatId || null,
        created_by_ai: false, // Created via API, not AI
        status: "pending",
      })

      if (insertError) {
        console.error("[Gmail Drafts API] DB insert error:", insertError)
        dbSaveSuccess = false
      }
    } catch (dbError) {
      console.error("[Gmail Drafts API] DB Error:", dbError)
      dbSaveSuccess = false
    }

    // Log the action to audit log
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("google_integration_audit_log").insert({
        user_id: user.id,
        action: "draft_create",
        status: "success",
        metadata: {
          draft_id: draft.id,
          to_count: body.to.length,
          has_thread: !!body.threadId,
          db_saved: dbSaveSuccess,
        },
      })
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.error("[Gmail Drafts API] Audit log error:", auditError)
    }

    return NextResponse.json({
      success: true,
      draftId: draft.id,
      to: body.to,
      subject: body.subject,
      message: dbSaveSuccess
        ? "Draft created successfully"
        : "Draft created in Gmail but may not appear in draft list. Please check Gmail directly.",
      dbSaved: dbSaveSuccess,
    })
  } catch (error) {
    console.error("[Gmail Drafts API] POST Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create draft" },
      { status: 500 }
    )
  }
}
