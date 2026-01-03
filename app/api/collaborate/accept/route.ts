/**
 * Accept Collaboration Share Link API
 * POST /api/collaborate/accept - Accept a share link and join as collaborator
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  validateShareLink,
  verifyShareLinkPassword,
  getUserChatRole,
  logAccessEvent,
} from "@/lib/collaboration"
import type { AcceptShareLinkRequest, AcceptShareLinkResponse } from "@/lib/collaboration"

/**
 * POST /api/collaborate/accept
 * Accept a share link and become a collaborator
 * Requires: Authenticated user (any)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

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
      return NextResponse.json(
        { error: "Please sign in to accept this share link" },
        { status: 401 }
      )
    }

    // Parse request body
    const body: AcceptShareLinkRequest = await request.json()
    const { token, password } = body

    if (!token) {
      return NextResponse.json(
        { error: "Missing share link token" },
        { status: 400 }
      )
    }

    // Validate share link
    const validation = await validateShareLink(supabase, token)

    if (!validation.valid || !validation.link) {
      return NextResponse.json(
        { error: validation.error || "Invalid share link" },
        { status: validation.isRateLimited ? 429 : 400 }
      )
    }

    const link = validation.link

    // Check if password is required
    if (validation.requiresPassword) {
      if (!password) {
        return NextResponse.json(
          { error: "This share link requires a password", requires_password: true },
          { status: 403 }
        )
      }

      // Verify password
      const passwordValid = await verifyShareLinkPassword(
        supabase,
        link.id,
        password
      )

      if (!passwordValid) {
        // Log failed password attempt
        await logAccessEvent(supabase, {
          chatId: link.chat_id,
          actorUserId: user.id,
          action: "link_password_failed",
          details: { link_id: link.id },
        })

        return NextResponse.json(
          { error: "Incorrect password" },
          { status: 403 }
        )
      }
    }

    // Check if user already has access to this chat
    const existingRole = await getUserChatRole(supabase, user.id, link.chat_id)

    if (existingRole) {
      // User already has access, just redirect them
      return NextResponse.json({
        success: true,
        chat_id: link.chat_id,
        role: existingRole,
        redirect_url: `/c/${link.chat_id}`,
        already_member: true,
      } as AcceptShareLinkResponse & { already_member: boolean })
    }

    // Add user as collaborator
    const { error: insertError } = await supabase
      .from("chat_collaborators")
      .insert({
        chat_id: link.chat_id,
        user_id: user.id,
        role: link.grants_role,
        invited_by: link.created_by,
        invited_via_link_id: link.id,
      })

    if (insertError) {
      // Check for unique constraint violation (race condition)
      if (insertError.code === "23505") {
        // User was added while we were processing
        return NextResponse.json({
          success: true,
          chat_id: link.chat_id,
          role: link.grants_role,
          redirect_url: `/c/${link.chat_id}`,
          already_member: true,
        })
      }

      console.error("[collaborate/accept] Insert error:", insertError)
      return NextResponse.json(
        { error: "Failed to join chat" },
        { status: 500 }
      )
    }

    // Increment use count
    await supabase
      .from("chat_share_links")
      .update({ use_count: link.use_count + 1 })
      .eq("id", link.id)

    // Log access event
    await logAccessEvent(supabase, {
      chatId: link.chat_id,
      actorUserId: user.id,
      targetUserId: user.id,
      action: "link_used",
      details: {
        link_id: link.id,
        granted_role: link.grants_role,
      },
    })

    // Log collaborator added event
    await logAccessEvent(supabase, {
      chatId: link.chat_id,
      actorUserId: link.created_by, // The person who created the link
      targetUserId: user.id,
      action: "collaborator_added",
      details: {
        role: link.grants_role,
        via_link: true,
        link_id: link.id,
      },
    })

    const response: AcceptShareLinkResponse = {
      success: true,
      chat_id: link.chat_id,
      role: link.grants_role,
      redirect_url: `/c/${link.chat_id}`,
    }

    return NextResponse.json(response)
  } catch (err: unknown) {
    console.error("[collaborate/accept] Unhandled error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
