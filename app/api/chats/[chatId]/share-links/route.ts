/**
 * Share Links API
 * POST /api/chats/[chatId]/share-links - Create a new share link
 * GET /api/chats/[chatId]/share-links - List share links for a chat
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  checkUserChatRole,
  generateSecureToken,
  getChatShareLinks,
  hashShareLinkPassword,
  logAccessEvent,
} from "@/lib/collaboration"
import { getShareLinkUrl } from "@/lib/collaboration/config"
import type { CreateShareLinkRequest, CreateShareLinkResponse } from "@/lib/collaboration"
import {
  sendEmail,
  isEmailEnabled,
  getCollaborationInviteEmailHtml,
  getCollaborationInviteEmailSubject,
} from "@/lib/email"

/**
 * POST /api/chats/[chatId]/share-links
 * Create a new share link for collaboration
 * Requires: Owner role
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const supabase = await createClient()
    const { chatId } = await params

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      )
    }

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check user has owner role
    const { hasAccess, userRole } = await checkUserChatRole(
      supabase,
      user.id,
      chatId,
      "owner"
    )

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Only chat owners can create share links" },
        { status: 403 }
      )
    }

    // Parse request body
    const body: CreateShareLinkRequest & {
      recipient_email?: string
      recipient_name?: string
      personal_note?: string
    } = await request.json()
    const {
      grants_role = "viewer",
      password,
      max_uses = null,
      label,
      recipient_email,
      recipient_name,
      personal_note,
    } = body

    // Validate grants_role
    if (!["editor", "viewer"].includes(grants_role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'editor' or 'viewer'" },
        { status: 400 }
      )
    }

    // Generate secure token
    const token = generateSecureToken()

    // Hash password if provided
    let password_hash: string | null = null
    if (password && password.trim()) {
      password_hash = await hashShareLinkPassword(supabase, password.trim())
    }

    // Create share link
    const { data: link, error: createError } = await supabase
      .from("chat_share_links")
      .insert({
        chat_id: chatId,
        token,
        password_hash,
        grants_role,
        max_uses,
        label: label?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (createError) {
      console.error("[share-links] Create error:", createError)
      return NextResponse.json(
        { error: "Failed to create share link" },
        { status: 500 }
      )
    }

    // Log access event
    await logAccessEvent(supabase, {
      chatId,
      actorUserId: user.id,
      action: "link_created",
      details: {
        link_id: link.id,
        grants_role,
        has_password: !!password_hash,
        max_uses,
        recipient_email: recipient_email || null,
      },
    })

    // Send email invitation if recipient_email provided
    let emailSent = false
    if (recipient_email && recipient_email.trim()) {
      if (isEmailEnabled()) {
        try {
          // Get sender's display name
          const { data: senderProfile } = await supabase
            .from("users")
            .select("display_name, email")
            .eq("id", user.id)
            .single()

          const senderName = senderProfile?.display_name ||
            senderProfile?.email?.split("@")[0] ||
            "Someone"

          // Get chat title
          const { data: chat } = await supabase
            .from("chats")
            .select("title")
            .eq("id", chatId)
            .single()

          const chatTitle = chat?.title || "Untitled Conversation"

          // Send invitation email
          const inviteLink = getShareLinkUrl(link.token)
          const emailResult = await sendEmail({
            to: recipient_email.trim(),
            subject: getCollaborationInviteEmailSubject(senderName, grants_role as "editor" | "viewer"),
            html: getCollaborationInviteEmailHtml({
              senderName,
              recipientName: recipient_name?.trim(),
              chatTitle,
              role: grants_role as "editor" | "viewer",
              inviteLink,
              hasPassword: !!password_hash,
              personalNote: personal_note?.trim(),
            }),
          })

          emailSent = emailResult.success
          if (!emailResult.success) {
            console.warn("[share-links] Email send failed:", emailResult.error)
          }
        } catch (emailError) {
          console.error("[share-links] Email error:", emailError)
          // Don't fail the request if email fails - link was still created
        }
      } else {
        console.log("[share-links] Email not enabled, skipping invitation email")
      }
    }

    // Return response (without password_hash)
    const response: CreateShareLinkResponse & { email_sent?: boolean } = {
      id: link.id,
      token: link.token,
      full_url: getShareLinkUrl(link.token),
      grants_role: link.grants_role as "editor" | "viewer",
      has_password: !!password_hash,
      max_uses: link.max_uses,
      label: link.label,
      created_at: link.created_at,
      email_sent: recipient_email ? emailSent : undefined,
    }

    return NextResponse.json(response, { status: 201 })
  } catch (err: unknown) {
    console.error("[share-links] Unhandled error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/chats/[chatId]/share-links
 * List active share links for a chat
 * Requires: Editor+ role
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const supabase = await createClient()
    const { chatId } = await params

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      )
    }

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check user has editor+ role
    const { hasAccess } = await checkUserChatRole(
      supabase,
      user.id,
      chatId,
      "editor"
    )

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      )
    }

    // Get share links
    const links = await getChatShareLinks(supabase, chatId)

    // Add full URLs
    const linksWithUrls = links.map((link) => ({
      ...link,
      full_url: getShareLinkUrl(link.token),
    }))

    return NextResponse.json({ links: linksWithUrls })
  } catch (err: unknown) {
    console.error("[share-links] GET error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
