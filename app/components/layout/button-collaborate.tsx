"use client"

/**
 * Collaborate Button for Header
 * Simple button that triggers collaboration dialogs
 * Works outside CollaborationWrapper by using a shared store
 */

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { useCollaborationDialogStore } from "@/lib/collaboration/dialog-store"
import { Users } from "@phosphor-icons/react"

export function ButtonCollaborate() {
  const { chatId } = useChatSession()
  const { setOpenDialog } = useCollaborationDialogStore()

  // Only show in chats
  if (!chatId) {
    return null
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-muted bg-background rounded-full p-1.5 transition-colors"
            onClick={() => setOpenDialog("share")}
          >
            <Users className="size-5" />
            <span className="sr-only">Share</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Share</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
