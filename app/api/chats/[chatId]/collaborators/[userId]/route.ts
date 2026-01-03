/**
 * Collaborator Management API
 * PUT /api/chats/[chatId]/collaborators/[userId] - Update collaborator role
 * DELETE /api/chats/[chatId]/collaborators/[userId] - Remove collaborator
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  checkUserChatRole,
  getUserChatRole,
  logAccessEvent,
} from "@/lib/collaboration"
import { getPermissionsChannel } from "@/lib/collaboration/config"
import type { UpdateCollaboratorRoleRequest } from "@/lib/collaboration"

/**
 * PUT /api/chats/[chatId]/collaborators/[userId]
 * Update a collaborator's role
 * Requires: Owner role
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ chatId: string; userId: string }> }
) {
  try {
    const supabase = await createClient()
    const { chatId, userId: targetUserId } = await params

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
        { error: "Only chat owners can update collaborator roles" },
        { status: 403 }
      )
    }

    // Cannot change own role as owner
    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: "Cannot change your own role" },
        { status: 400 }
      )
    }

    // Parse request body
    const body: UpdateCollaboratorRoleRequest = await request.json()
    const { role } = body

    // Validate role (owners cannot be created via this endpoint)
    if (!["editor", "viewer"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'editor' or 'viewer'" },
        { status: 400 }
      )
    }

    // Get target user's current role
    const currentRole = await getUserChatRole(supabase, targetUserId, chatId)

    if (!currentRole) {
      return NextResponse.json(
        { error: "Collaborator not found" },
        { status: 404 }
      )
    }

    // Cannot demote an owner (would need ownership transfer)
    if (currentRole === "owner") {
      return NextResponse.json(
        { error: "Cannot change owner's role. Use ownership transfer instead." },
        { status: 400 }
      )
    }

    // Update the role
    const { error: updateError } = await supabase
      .from("chat_collaborators")
      .update({ role })
      .eq("chat_id", chatId)
      .eq("user_id", targetUserId)

    if (updateError) {
      console.error("[collaborators] Update error:", updateError)
      return NextResponse.json(
        { error: "Failed to update collaborator role" },
        { status: 500 }
      )
    }

    // Log access event
    await logAccessEvent(supabase, {
      chatId,
      actorUserId: user.id,
      targetUserId,
      action: "role_changed",
      details: { old_role: currentRole, new_role: role },
    })

    // Broadcast role change to the user's permissions channel
    // This allows the client to update their local state
    const channel = supabase.channel(getPermissionsChannel(targetUserId))
    await channel.send({
      type: "broadcast",
      event: "role_changed",
      payload: {
        chat_id: chatId,
        new_role: role,
      },
    })

    return NextResponse.json({ success: true, role })
  } catch (err: unknown) {
    console.error("[collaborators] PUT error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/chats/[chatId]/collaborators/[userId]
 * Remove a collaborator from a chat
 * Requires: Owner role OR self-removal
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ chatId: string; userId: string }> }
) {
  try {
    const supabase = await createClient()
    const { chatId, userId: targetUserId } = await params

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

    const isSelfRemoval = targetUserId === user.id

    // Check permissions: owner can remove anyone, user can remove themselves
    if (!isSelfRemoval) {
      const { hasAccess } = await checkUserChatRole(
        supabase,
        user.id,
        chatId,
        "owner"
      )

      if (!hasAccess) {
        return NextResponse.json(
          { error: "Only chat owners can remove collaborators" },
          { status: 403 }
        )
      }
    }

    // Get target user's current role
    const targetRole = await getUserChatRole(supabase, targetUserId, chatId)

    if (!targetRole) {
      return NextResponse.json(
        { error: "Collaborator not found" },
        { status: 404 }
      )
    }

    // Cannot remove the last owner
    if (targetRole === "owner") {
      // Count owners
      const { count } = await supabase
        .from("chat_collaborators")
        .select("*", { count: "exact", head: true })
        .eq("chat_id", chatId)
        .eq("role", "owner")

      if (count === 1) {
        return NextResponse.json(
          { error: "Cannot remove the last owner. Transfer ownership first." },
          { status: 400 }
        )
      }
    }

    // Remove the collaborator
    const { error: deleteError } = await supabase
      .from("chat_collaborators")
      .delete()
      .eq("chat_id", chatId)
      .eq("user_id", targetUserId)

    if (deleteError) {
      console.error("[collaborators] Delete error:", deleteError)
      return NextResponse.json(
        { error: "Failed to remove collaborator" },
        { status: 500 }
      )
    }

    // Log access event
    await logAccessEvent(supabase, {
      chatId,
      actorUserId: user.id,
      targetUserId,
      action: "collaborator_removed",
      details: {
        removed_role: targetRole,
        self_removal: isSelfRemoval,
      },
    })

    // Broadcast revocation to the removed user's permissions channel
    // This triggers immediate disconnect and redirect on their client
    const channel = supabase.channel(getPermissionsChannel(targetUserId))
    await channel.send({
      type: "broadcast",
      event: "access_revoked",
      payload: {
        chat_id: chatId,
        reason: isSelfRemoval ? "self_removal" : "removed_by_owner",
      },
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("[collaborators] DELETE error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
