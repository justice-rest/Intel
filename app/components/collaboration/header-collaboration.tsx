"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useCollaboratorsOptional } from "@/lib/collaboration"
import { useChatId } from "@/lib/chat-store/session/use-chat-id"
import { useChats } from "@/lib/chat-store/chats/provider"
import { Users } from "@phosphor-icons/react"
import { PresenceIndicator } from "./presence-indicator"
import { DialogShareChat } from "./dialog-share-chat"
import { DialogManageCollaborators } from "./dialog-manage-collaborators"

/**
 * Header collaboration controls
 * Shows presence indicator and collaborate button when in a chat
 */
export function HeaderCollaboration() {
  const chatId = useChatId()
  const { getChatById } = useChats()
  const collaborators = useCollaboratorsOptional()
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showCollaboratorsDialog, setShowCollaboratorsDialog] = useState(false)

  // Don't show if no chatId
  if (!chatId) {
    return null
  }

  const currentChat = getChatById(chatId)
  const chatTitle = currentChat?.title || "Untitled"
  const isOwner = collaborators?.isOwner ?? false
  const hasCollaborators = (collaborators?.collaborators?.length ?? 0) > 1

  return (
    <>
      {/* Presence indicator - only show if there are collaborators */}
      {hasCollaborators && <PresenceIndicator maxVisible={3} />}

      {/* Collaborate button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground hover:bg-muted bg-background rounded-full p-1.5 transition-colors"
              onClick={() => isOwner ? setShowShareDialog(true) : setShowCollaboratorsDialog(true)}
            >
              <Users className="size-5" />
              <span className="sr-only">
                {isOwner ? "Share with collaborators" : "View collaborators"}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isOwner ? "Share" : "Collaborators"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Dialogs */}
      <DialogShareChat
        isOpen={showShareDialog}
        setIsOpen={setShowShareDialog}
        chatTitle={chatTitle}
      />
      <DialogManageCollaborators
        isOpen={showCollaboratorsDialog}
        setIsOpen={setShowCollaboratorsDialog}
      />
    </>
  )
}
