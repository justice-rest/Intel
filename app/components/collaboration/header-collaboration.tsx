"use client"

/**
 * Collaboration Dialogs Renderer
 * Renders collaboration dialogs inside CollaborationWrapper
 * Responds to store state set by header button
 */

import { useEffect } from "react"
import { useCollaboratorsOptional } from "@/lib/collaboration"
import { usePresenceOptional } from "@/lib/presence"
import { useCollaborationDialogStore } from "@/lib/collaboration/dialog-store"
import { useChatId } from "@/lib/chat-store/session/use-chat-id"
import { useChats } from "@/lib/chat-store/chats/provider"
import { PresenceIndicator } from "./presence-indicator"
import { DialogShareChat } from "./dialog-share-chat"
import { DialogManageCollaborators } from "./dialog-manage-collaborators"

/**
 * Collaboration Dialogs
 * Renders dialogs that respond to the global store
 * Must be rendered inside CollaborationWrapper for context access
 */
export function CollaborationDialogs() {
  const chatId = useChatId()
  const { getChatById } = useChats()
  const collaborators = useCollaboratorsOptional()
  const { openDialog, closeDialog } = useCollaborationDialogStore()

  // Don't render if no chatId or no collaboration context
  if (!chatId || !collaborators) {
    return null
  }

  const currentChat = getChatById(chatId)
  const chatTitle = currentChat?.title || "Untitled"
  const isOwner = collaborators.isOwner

  // Determine which dialog to show based on role
  const showShareDialog = openDialog === "share" && isOwner
  const showCollaboratorsDialog = openDialog === "collaborators" || (openDialog === "share" && !isOwner)

  return (
    <>
      <DialogShareChat
        isOpen={showShareDialog}
        setIsOpen={(open) => !open && closeDialog()}
        chatTitle={chatTitle}
      />
      <DialogManageCollaborators
        isOpen={showCollaboratorsDialog}
        setIsOpen={(open) => !open && closeDialog()}
      />
    </>
  )
}

/**
 * Presence Indicator Wrapper
 * Shows online collaborators - only renders when there are collaborators
 */
export function CollaborationPresence() {
  const chatId = useChatId()
  const collaborators = useCollaboratorsOptional()
  const presence = usePresenceOptional()

  if (!chatId || !collaborators || !presence) {
    return null
  }

  const hasCollaborators = (collaborators.collaborators?.length ?? 0) > 1

  if (!hasCollaborators) {
    return null
  }

  return <PresenceIndicator maxVisible={3} />
}

/**
 * Header Collaboration (Legacy)
 * Kept for backwards compatibility - now just renders dialogs
 * @deprecated Use CollaborationDialogs instead
 */
export function HeaderCollaboration() {
  return <CollaborationDialogs />
}
