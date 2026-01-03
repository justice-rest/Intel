"use client"

/**
 * Revocation Listener Hook
 * Listens for access revocation signals and handles cleanup
 */

import { useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { useUser } from "@/lib/user-store/provider"
import { getPermissionsChannel } from "@/lib/collaboration/config"
import { toast } from "@/components/ui/toast"
import type { RevocationEvent, RoleChangeEvent } from "../types"

interface UseRevocationListenerOptions {
  chatId: string
  onRevoked?: (event: RevocationEvent) => void
  onRoleChanged?: (event: RoleChangeEvent) => void
}

/**
 * Hook to listen for access revocation and role change signals
 * Automatically handles cleanup and redirects when access is revoked
 */
export function useRevocationListener({
  chatId,
  onRevoked,
  onRoleChanged,
}: UseRevocationListenerOptions) {
  const router = useRouter()
  const { user } = useUser()

  const handleRevocation = useCallback(
    (event: RevocationEvent) => {
      // Only handle events for the current chat
      if (event.chat_id !== chatId) return

      // Call custom handler if provided
      onRevoked?.(event)

      // Show toast notification
      const message =
        event.reason === "self_removal"
          ? "You have left this conversation"
          : "Your access to this conversation has been revoked"

      toast({
        title: "Access Revoked",
        description: message,
        status: "error",
      })

      // Clear local cache for this chat
      // Note: IndexedDB cleanup would go here

      // Redirect to home after a brief delay
      setTimeout(() => {
        router.push("/")
      }, 1500)
    },
    [chatId, onRevoked, router]
  )

  const handleRoleChange = useCallback(
    (event: RoleChangeEvent) => {
      // Only handle events for the current chat
      if (event.chat_id !== chatId) return

      // Call custom handler if provided
      onRoleChanged?.(event)

      // Show toast notification about role change
      const roleLabel =
        event.new_role === "editor"
          ? "edit"
          : event.new_role === "viewer"
          ? "view"
          : event.new_role

      toast({
        title: "Role Updated",
        description: `Your role has been changed. You can now ${roleLabel} this conversation.`,
        status: "info",
      })
    },
    [chatId, onRoleChanged]
  )

  useEffect(() => {
    if (!user?.id || !isSupabaseEnabled) return

    const supabase = createClient()
    if (!supabase) return

    const channel = supabase.channel(getPermissionsChannel(user.id))

    channel
      .on("broadcast", { event: "access_revoked" }, ({ payload }) => {
        handleRevocation(payload as RevocationEvent)
      })
      .on("broadcast", { event: "role_changed" }, ({ payload }) => {
        handleRoleChange(payload as RoleChangeEvent)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, handleRevocation, handleRoleChange])
}
