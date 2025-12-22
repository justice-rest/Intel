"use client"

import {
  MorphingDialog,
  MorphingDialogClose,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogImage,
  MorphingDialogTrigger,
} from "@/components/motion-primitives/morphing-dialog"
import {
  MessageAction,
  MessageActions,
  Message as MessageContainer,
  MessageContent,
} from "@/components/prompt-kit/message"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { cn } from "@/lib/utils"
import { Message as MessageType } from "@ai-sdk/react"
import {
  Check,
  Copy,
  PencilSimpleIcon,
  PencilSimpleSlashIcon,
} from "@phosphor-icons/react"
import Image from "next/image"
import React, { useEffect, useRef, useState } from "react"

const getTextPreview = (url: string, fileName: string) => {
  // If it's a data URL, extract base64
  if (url.startsWith("data:")) {
    const base64 = url.split(",")[1]
    try {
      return atob(base64).substring(0, 200) + "..."
    } catch {
      return "Text file: " + fileName
    }
  }
  // For regular URLs, just show file name
  return "Text file: " + fileName
}

const getFileIcon = (contentType: string) => {
  if (contentType === "application/pdf") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  }
  if (contentType?.startsWith("text") || contentType === "application/json") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }
  // Excel/CSV
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

export type MessageUserProps = {
  hasScrollAnchor?: boolean
  attachments?: MessageType["experimental_attachments"]
  children: string
  copied: boolean
  copyToClipboard: () => void
  id: string
  className?: string
  onReload?: () => void
  onEdit?: (id: string, newText: string) => void
  messageGroupId?: string | null
  isUserAuthenticated?: boolean
}

export function MessageUser({
  hasScrollAnchor,
  attachments,
  children,
  copied,
  copyToClipboard,
  id,
  className,
  onEdit,
  messageGroupId,
  isUserAuthenticated,
}: MessageUserProps) {
  const [editInput, setEditInput] = useState(children)
  const [isEditing, setIsEditing] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleEditCancel = () => {
    setIsEditing(false)
    setEditInput(children)
  }

  const handleSave = async () => {
    if (!editInput.trim()) return
    const UUIDLength = 36

    try {
      // Skip UUID validation for optimistic messages (they haven't synced yet)
      const isOptimisticId = id?.startsWith("optimistic-")
      if (isSupabaseEnabled && id && !isOptimisticId && id.length !== UUIDLength) {
        // Message IDs failed to sync
        toast({
          title: "Oops, something went wrong",
          description: "Please refresh your browser and try again.",
          status: "error",
        })
        return
      }
      onEdit?.(id, editInput)
    } catch {
      setEditInput(children) // Reset on failure
    } finally {
      setIsEditing(false)
    }
  }

  const handleEditStart = async () => {
    setIsEditing(true)
    setEditInput(children)
  }

  useEffect(() => {
    if (!isEditing) return
    const editTextarea = textareaRef.current
    if (!editTextarea) return
    editTextarea.style.height = "auto"
    editTextarea.style.height = `${Math.min(editTextarea.scrollHeight, editTextarea.scrollHeight)}px`
  }, [editInput, isEditing])

  return (
    <MessageContainer
      className={cn(
        "group flex w-full max-w-3xl flex-col items-end gap-0.5 px-6 pb-2",
        hasScrollAnchor && "min-h-scroll-anchor",
        className
      )}
    >
      {attachments?.map((attachment, index) => {
        const isImage = attachment.contentType?.startsWith("image")
        const isTextFile = attachment.contentType?.startsWith("text") ||
                          attachment.contentType === "application/json" ||
                          attachment.contentType === "text/csv"
        const isPDF = attachment.contentType === "application/pdf"
        const isSpreadsheet = attachment.contentType?.includes("spreadsheet") ||
                             attachment.contentType?.includes("excel")

        return (
          <div
            className="flex flex-row gap-2"
            key={`${attachment.name}-${index}`}
          >
            {isImage ? (
              <MorphingDialog
                transition={{
                  type: "spring" as const,
                  stiffness: 280,
                  damping: 18,
                  mass: 0.3,
                }}
              >
                <MorphingDialogTrigger className="z-10">
                  <Image
                    className="mb-1 w-40 rounded-md object-cover"
                    key={attachment.name}
                    src={attachment.url}
                    alt={attachment.name || "Attachment"}
                    width={160}
                    height={120}
                    unoptimized={attachment.url.startsWith("blob:")}
                  />
                </MorphingDialogTrigger>
                <MorphingDialogContainer>
                  <MorphingDialogContent className="relative rounded-lg">
                    <MorphingDialogImage
                      src={attachment.url}
                      alt={attachment.name || ""}
                      className="max-h-[90vh] max-w-[90vw] object-contain"
                    />
                  </MorphingDialogContent>
                  <MorphingDialogClose className="text-primary" />
                </MorphingDialogContainer>
              </MorphingDialog>
            ) : isTextFile || isPDF || isSpreadsheet ? (
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                download={attachment.name}
                className="text-primary mb-3 flex h-24 w-40 min-w-0 items-center justify-center rounded-md border p-2 text-xs hover:bg-accent transition-colors"
                onClick={(e) => {
                  // For blob URLs, force download instead of navigation
                  if (attachment.url.startsWith("blob:")) {
                    e.preventDefault()
                    const link = document.createElement("a")
                    link.href = attachment.url
                    link.download = attachment.name || "file"
                    link.click()
                  }
                }}
              >
                <div className="flex flex-col items-center gap-1 w-full min-w-0">
                  <div className="flex-shrink-0">
                    {getFileIcon(attachment.contentType || "")}
                  </div>
                  <span className="truncate w-full text-center font-medium px-1" title={attachment.name}>
                    {attachment.name}
                  </span>
                </div>
              </a>
            ) : null}
          </div>
        )
      })}
      {isEditing ? (
        <div
          className="bg-accent relative flex w-full max-w-xl min-w-[180px] flex-col gap-2 rounded-3xl px-5 py-2.5"
          style={{
            width: contentRef.current?.offsetWidth,
          }}
        >
          <textarea
            ref={textareaRef}
            className="w-full resize-none bg-transparent outline-none"
            value={editInput}
            onChange={(e) => setEditInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSave()
              }
              if (e.key === "Escape") {
                handleEditCancel()
              }
            }}
            autoFocus
            style={{
              maxHeight: "50vh",
              overflowY: "auto",
            }}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={handleEditCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!editInput.trim()}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <MessageContent
          className="bg-[var(--color-blue-600)] text-white prose prose-p:my-0 relative w-fit max-w-[70%] rounded-3xl px-5 py-2"
          markdown={true}
          ref={contentRef}
          components={{
            code: ({ children }) => <React.Fragment>{children}</React.Fragment>,
            pre: ({ children }) => <React.Fragment>{children}</React.Fragment>,
            h1: ({ children }) => <p>{children}</p>,
            h2: ({ children }) => <p>{children}</p>,
            h3: ({ children }) => <p>{children}</p>,
            h4: ({ children }) => <p>{children}</p>,
            h5: ({ children }) => <p>{children}</p>,
            h6: ({ children }) => <p>{children}</p>,
            p: ({ children }) => <p>{children}</p>,
            li: ({ children }) => <p>- {children}</p>,
            ul: ({ children }) => <React.Fragment>{children}</React.Fragment>,
            ol: ({ children }) => <React.Fragment>{children}</React.Fragment>,
          }}
        >
          {children}
        </MessageContent>
      )}
      <MessageActions className="flex gap-0 opacity-0 transition-opacity duration-0 group-hover:opacity-100">
        <MessageAction tooltip={copied ? "Copied!" : "Copy text"} side="bottom">
          <button
            className="hover:bg-accent/60 text-muted-foreground hover:text-foreground flex size-7.5 items-center justify-center rounded-full bg-transparent transition"
            aria-label="Copy text"
            onClick={copyToClipboard}
            type="button"
          >
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
          </button>
        </MessageAction>
        {messageGroupId === null && isUserAuthenticated && (
          // Enabled if NOT multi-model chat & user is Authenticated
          <MessageAction
            tooltip={isEditing ? "Cancel edit" : "Edit message"}
            side="bottom"
            delayDuration={0}
          >
            <button
              className="hover:bg-accent/60 text-muted-foreground hover:text-foreground flex size-7.5 items-center justify-center rounded-full bg-transparent transition"
              aria-label={isEditing ? "Cancel edit" : "Edit message"}
              onClick={isEditing ? handleEditCancel : handleEditStart}
              type="button"
            >
              {isEditing ? (
                <PencilSimpleSlashIcon className="size-4" />
              ) : (
                <PencilSimpleIcon className="size-4" />
              )}
            </button>
          </MessageAction>
        )}
      </MessageActions>
    </MessageContainer>
  )
}
