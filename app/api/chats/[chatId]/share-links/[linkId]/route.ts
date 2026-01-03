/**
 * Share Link Management API
 * DELETE /api/chats/[chatId]/share-links/[linkId] - Revoke a share link
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { checkUserChatRole, logAccessEvent } from "@/lib/collaboration"

/**
 * DELETE /api/chats/[chatId]/share-links/[linkId]
 * Revoke a share link
 * Requires: Owner role
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ chatId: string; linkId: string }> }
) {
  try {
    const supabase = await createClient()
    const { chatId, linkId } = await params

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
    const { hasAccess } = await checkUserChatRole(
      supabase,
      user.id,
      chatId,
      "owner"
    )

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Only chat owners can revoke share links" },
        { status: 403 }
      )
    }

    // Verify link exists and belongs to this chat
    const { data: link, error: fetchError } = await supabase
      .from("chat_share_links")
      .select("id, chat_id, is_active")
      .eq("id", linkId)
      .single()

    if (fetchError || !link) {
      return NextResponse.json(
        { error: "Share link not found" },
        { status: 404 }
      )
    }

    if (link.chat_id !== chatId) {
      return NextResponse.json(
        { error: "Share link does not belong to this chat" },
        { status: 403 }
      )
    }

    if (!link.is_active) {
      return NextResponse.json(
        { error: "Share link is already revoked" },
        { status: 400 }
      )
    }

    // Revoke the link (soft delete)
    const { error: updateError } = await supabase
      .from("chat_share_links")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
      })
      .eq("id", linkId)

    if (updateError) {
      console.error("[share-links] Revoke error:", updateError)
      return NextResponse.json(
        { error: "Failed to revoke share link" },
        { status: 500 }
      )
    }

    // Log access event
    await logAccessEvent(supabase, {
      chatId,
      actorUserId: user.id,
      action: "link_revoked",
      details: { link_id: linkId },
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("[share-links] DELETE error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
