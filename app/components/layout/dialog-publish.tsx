"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import XIcon from "@/components/icons/x"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { APP_DOMAIN } from "@/lib/config"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import {
  CaretDown,
  CaretUp,
  Check,
  Copy,
  Globe,
  PaperPlaneTilt,
  Spinner,
} from "@phosphor-icons/react"
import type React from "react"
import { useState } from "react"

export function DialogPublish() {
  const [openDialog, setOpenDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { chatId } = useChatSession()
  const isMobile = useBreakpoint(768)
  const [copied, setCopied] = useState(false)

  // Email share state
  const [recipientEmail, setRecipientEmail] = useState("")
  const [recipientName, setRecipientName] = useState("")
  const [personalNote, setPersonalNote] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  if (!isSupabaseEnabled) {
    return null
  }

  if (!chatId) {
    return null
  }

  const publicLink = `${APP_DOMAIN}/share/${chatId}`

  const openPage = () => {
    setOpenDialog(false)

    window.open(publicLink, "_blank")
  }

  const shareOnX = () => {
    setOpenDialog(false)

    const X_TEXT = `Check out this public page I created with Rōmy! ${publicLink}`
    window.open(`https://x.com/intent/tweet?text=${X_TEXT}`, "_blank")
  }

  const handlePublish = async () => {
    setIsLoading(true)

    try {
      // Use API endpoint for proper permission checking
      const res = await fetch(`/api/chats/${chatId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public: true }),
      })

      if (res.ok) {
        setIsLoading(false)
        setOpenDialog(true)
      } else {
        const data = await res.json()
        console.error("[publish] Error:", data.error)
        setIsLoading(false)
        // Could show a toast here for better UX
      }
    } catch (error) {
      console.error("[publish] Failed:", error)
      setIsLoading(false)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(publicLink)

    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  const handleSendEmail = async () => {
    if (!recipientEmail.trim()) return

    setIsSendingEmail(true)
    setEmailError(null)

    try {
      const res = await fetch("/api/share-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          recipientEmail: recipientEmail.trim(),
          recipientName: recipientName.trim() || undefined,
          personalNote: personalNote.trim() || undefined,
        }),
      })

      if (res.ok) {
        setEmailSent(true)
        setTimeout(() => setEmailSent(false), 3000)
        setRecipientEmail("")
        setRecipientName("")
        setPersonalNote("")
        setShowAdvanced(false)
      } else {
        const data = await res.json()
        setEmailError(data.error || "Failed to send email")
      }
    } catch {
      setEmailError("Failed to send email")
    }

    setIsSendingEmail(false)
  }

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const trigger = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-muted bg-background rounded-full p-1.5 transition-colors"
            onClick={handlePublish}
            disabled={isLoading}
          >
            {isLoading ? (
              <Spinner className="size-5 animate-spin" />
            ) : (
              <Globe className="size-5" />
            )}
            <span className="sr-only">Make public</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Make public</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  const content = (
    <>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <div className="flex items-center gap-1">
            <div className="relative flex-1">
              <Input id="slug" value={publicLink} readOnly className="flex-1" />
              <Button
                variant="outline"
                onClick={copyLink}
                className="bg-background hover:bg-background absolute top-0 right-0 rounded-l-none transition-colors"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={openPage} className="flex-1">
          View Page
        </Button>
        <Button onClick={shareOnX} className="flex-1">
          Share on <XIcon className="text-primary-foreground size-4" />
        </Button>
      </div>

      {/* Email Share Section */}
      <div className="relative mt-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-popover px-2 text-muted-foreground">
            or send via email
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {/* Email input with Send button */}
        <div className="flex items-center gap-2">
          <Input
            type="email"
            placeholder="Enter recipient's email"
            value={recipientEmail}
            onChange={(e) => {
              setRecipientEmail(e.target.value)
              setEmailError(null)
            }}
            className="flex-1"
          />
          <Button
            onClick={handleSendEmail}
            disabled={
              !recipientEmail.trim() ||
              !isValidEmail(recipientEmail) ||
              isSendingEmail
            }
            size="icon"
            className="shrink-0"
          >
            {isSendingEmail ? (
              <Spinner className="size-4 animate-spin" />
            ) : emailSent ? (
              <Check className="size-4" />
            ) : (
              <PaperPlaneTilt className="size-4" />
            )}
          </Button>
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
        >
          {showAdvanced ? (
            <CaretUp className="size-3" />
          ) : (
            <CaretDown className="size-3" />
          )}
          Add a personal note
        </button>

        {/* Advanced fields (collapsible) */}
        {showAdvanced && (
          <div className="grid gap-3">
            <Input
              placeholder="Recipient's name (optional)"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
            <Textarea
              placeholder="Add a personal note (optional)"
              value={personalNote}
              onChange={(e) => setPersonalNote(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>
        )}

        {/* Feedback messages */}
        {emailSent && (
          <p className="text-sm text-green-600">Email sent successfully!</p>
        )}
        {emailError && <p className="text-sm text-red-600">{emailError}</p>}
      </div>
    </>
  )

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer open={openDialog} onOpenChange={setOpenDialog}>
          <DrawerContent className="bg-background border-border">
            <DrawerHeader>
              <DrawerTitle>Your conversation is now public!</DrawerTitle>
              <DrawerDescription>
                Anyone with the link can now view this conversation and may
                appear in community feeds, featured pages, or search results in
                the future.
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-4 px-4 pb-6">{content}</div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <>
      {trigger}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Your conversation is now public!</DialogTitle>
            <DialogDescription>
              Anyone with the link can now view this conversation and may appear
              in community feeds, featured pages, or search results in the
              future.
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    </>
  )
}
