"use client"

import { useState, useEffect, useCallback } from "react"
import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { GearSixIcon, SpinnerGap } from "@phosphor-icons/react"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { toast } from "@/components/ui/toast"

interface DialogChatInstructionsProps {
  /** Custom trigger element. If not provided, uses default button. */
  trigger?: React.ReactNode
}

export function DialogChatInstructions({
  trigger,
}: DialogChatInstructionsProps) {
  const [open, setOpen] = useState(false)
  const isMobile = useBreakpoint(768)
  const isDesktop = !isMobile
  const { chatId } = useChatSession()
  const { getChatById, updateChatInstructions } = useChats()

  const chat = chatId ? getChatById(chatId) : null
  const [instructions, setInstructions] = useState(chat?.system_prompt || "")
  const [isSaving, setIsSaving] = useState(false)

  // Update local state when chat changes
  useEffect(() => {
    if (chat) {
      setInstructions(chat.system_prompt || "")
    }
  }, [chat?.system_prompt])

  const handleSave = useCallback(async () => {
    if (!chatId) return

    setIsSaving(true)
    try {
      await updateChatInstructions(chatId, instructions)
      toast({
        title: "Instructions updated",
        description: "The AI will follow these instructions in this chat.",
        status: "success",
      })
      setOpen(false)
    } catch (error) {
      console.error("Failed to save instructions:", error)
      toast({
        title: "Failed to save",
        description: "Please try again.",
        status: "error",
      })
    } finally {
      setIsSaving(false)
    }
  }, [chatId, instructions, updateChatInstructions])

  const handleClear = useCallback(() => {
    setInstructions("")
  }, [])

  const defaultTrigger = (
    <Button variant="ghost" size="sm" className="gap-2">
      <GearSixIcon className="size-4" />
      <span className="hidden sm:inline">Instructions</span>
    </Button>
  )

  const content = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="instructions" className="text-sm font-medium">
          Custom Instructions
        </Label>
        <p className="text-sm text-muted-foreground">
          Add instructions that the AI should follow when responding in this chat.
          These apply to all messages in this conversation.
        </p>
        <Textarea
          id="instructions"
          placeholder="Example: Always respond in a formal tone. Focus on nonprofit fundraising best practices. Include specific dollar amounts when discussing giving capacity."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          className="min-h-[200px] resize-none"
          maxLength={10000}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{instructions.length.toLocaleString()} / 10,000 characters</span>
          {instructions && (
            <button
              type="button"
              onClick={handleClear}
              className="text-destructive hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <h4 className="text-sm font-medium mb-1">Tips for effective instructions:</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>- Be specific about the tone and style you want</li>
          <li>- Mention key topics or areas of focus</li>
          <li>- Include any formatting preferences</li>
          <li>- Specify any constraints or things to avoid</li>
        </ul>
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Chat Instructions</DialogTitle>
            <DialogDescription>
              Configure how the AI should behave in this conversation.
            </DialogDescription>
          </DialogHeader>
          {content}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <SpinnerGap className="size-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Instructions"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger || defaultTrigger}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Chat Instructions</DrawerTitle>
          <DrawerDescription>
            Configure how the AI should behave in this conversation.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4">{content}</div>
        <DrawerFooter className="pt-4">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <SpinnerGap className="size-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              "Save Instructions"
            )}
          </Button>
          <DrawerClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
