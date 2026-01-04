"use client"

/**
 * Chat Instructions Button for Header
 * Opens a dialog to edit custom instructions for the current chat
 */

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { GearSixIcon } from "@phosphor-icons/react"
import { DialogChatInstructions } from "@/app/components/collaboration/dialog-chat-instructions"

export function ButtonChatInstructions() {
  const { chatId } = useChatSession()

  // Only show in chats
  if (!chatId) {
    return null
  }

  return (
    <DialogChatInstructions
      trigger={
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground hover:bg-muted bg-background rounded-full p-1.5 transition-colors"
              >
                <GearSixIcon className="size-5" />
                <span className="sr-only">Chat Instructions</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Instructions</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      }
    />
  )
}
