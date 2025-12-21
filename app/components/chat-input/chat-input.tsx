"use client"

import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/prompt-kit/prompt-input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { ArrowUpIcon, StopIcon } from "@phosphor-icons/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { ButtonFileUpload } from "./button-file-upload"
import { FileList } from "./file-list"
import { PopoverContentUpgradeRequired } from "./popover-content-upgrade-required"
import { PopoverContentWelcome } from "./popover-content-welcome"
import { ResearchModeSelector, type ResearchMode } from "./research-mode-selector"

type ChatInputProps = {
  value: string
  onValueChange: (value: string) => void
  onSend: () => void
  isSubmitting?: boolean
  hasMessages?: boolean
  files: File[]
  onFileUpload: (files: File[]) => void
  onFileRemove: (file: File) => void
  onSuggestion: (suggestion: string) => void
  onSelectModel: (model: string) => void
  selectedModel: string
  isUserAuthenticated: boolean
  stop: () => void
  status?: "submitted" | "streaming" | "ready" | "error"
  setEnableSearch: (enabled: boolean) => void
  enableSearch: boolean
  researchMode: ResearchMode
  setResearchMode: (mode: ResearchMode) => void
  quotedText?: { text: string; messageId: string } | null
  showWelcome?: boolean
  firstName?: string | null
  onWelcomeDismiss?: () => void
  hasActiveSubscription?: boolean
}

export function ChatInput({
  value,
  onValueChange,
  onSend,
  isSubmitting,
  files,
  onFileUpload,
  onFileRemove,
  onSuggestion,
  onSelectModel,
  selectedModel,
  isUserAuthenticated,
  stop,
  status,
  setEnableSearch,
  enableSearch,
  researchMode,
  setResearchMode,
  quotedText,
  showWelcome,
  firstName,
  onWelcomeDismiss,
  hasActiveSubscription,
}: ChatInputProps) {
  const isOnlyWhitespace = (text: string) => !/[^\s]/.test(text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false)
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false)

  // Unified processing state: blocks input during submission AND streaming
  const isProcessing = isSubmitting || status === "submitted" || status === "streaming"

  // Auto-open welcome popover when showWelcome prop changes to true
  useEffect(() => {
    if (showWelcome) {
      setIsWelcomeOpen(true)
    }
  }, [showWelcome])

  const handleSend = useCallback(() => {
    // If currently processing (submitted or streaming), stop the generation
    if (isProcessing) {
      if (status === "submitted" || status === "streaming") {
        stop()
      }
      return
    }

    // Check subscription before sending (only for authenticated users)
    if (isUserAuthenticated && hasActiveSubscription === false) {
      setIsUpgradeOpen(true)
      return
    }

    onSend()
  }, [isProcessing, onSend, status, stop, isUserAuthenticated, hasActiveSubscription])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Block all Enter key actions while processing
      if (isProcessing && e.key === "Enter") {
        e.preventDefault()
        return
      }

      if (e.key === "Enter" && !e.shiftKey) {
        if (isOnlyWhitespace(value)) {
          return
        }

        e.preventDefault()

        // Check subscription before sending (only for authenticated users)
        if (isUserAuthenticated && hasActiveSubscription === false) {
          setIsUpgradeOpen(true)
          return
        }

        onSend()
      }
    },
    [isProcessing, onSend, value, isUserAuthenticated, hasActiveSubscription]
  )

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const hasImageContent = Array.from(items).some((item) =>
        item.type.startsWith("image/")
      )

      if (!isUserAuthenticated && hasImageContent) {
        e.preventDefault()
        return
      }

      if (isUserAuthenticated && hasImageContent) {
        const imageFiles: File[] = []

        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile()
            if (file) {
              const newFile = new File(
                [file],
                `pasted-image-${Date.now()}.${file.type.split("/")[1]}`,
                { type: file.type }
              )
              imageFiles.push(newFile)
            }
          }
        }

        if (imageFiles.length > 0) {
          onFileUpload(imageFiles)
        }
      }
      // Text pasting will work by default for everyone
    },
    [isUserAuthenticated, onFileUpload]
  )

  useEffect(() => {
    if (quotedText) {
      const quoted = quotedText.text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")
      onValueChange(value ? `${value}\n\n${quoted}\n\n` : `${quoted}\n\n`)

      requestAnimationFrame(() => {
        textareaRef.current?.focus()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotedText, onValueChange])

  // Determine which popover should be open (upgrade takes priority)
  const isWelcomePopoverOpen = isWelcomeOpen && showWelcome && !isUpgradeOpen

  return (
    <div className="relative flex w-full flex-col gap-4">
      <Popover
        open={isWelcomePopoverOpen || isUpgradeOpen}
        onOpenChange={(open) => {
          if (isUpgradeOpen) {
            setIsUpgradeOpen(open)
          } else {
            setIsWelcomeOpen(open)
            if (!open && onWelcomeDismiss) {
              onWelcomeDismiss()
            }
          }
        }}
      >
        <PopoverTrigger asChild>
          <div
            className="relative order-2 px-2 pb-3 sm:pb-4 md:order-1"
            onClick={() => textareaRef.current?.focus()}
          >
            <PromptInput
              className="bg-popover relative z-10 p-0 pt-1 shadow-xs backdrop-blur-xl"
              maxHeight={300}
              value={value}
              onValueChange={onValueChange}
            >
              <FileList files={files} onFileRemove={onFileRemove} />
              <PromptInputTextarea
                ref={textareaRef}
                placeholder="Donor's full name and street address (& employer if known)"
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
              />
              <PromptInputActions className="mt-3 w-full justify-between p-2">
                <div className="flex gap-2">
                  <ButtonFileUpload
                    onFileUpload={onFileUpload}
                    isUserAuthenticated={isUserAuthenticated}
                    model={selectedModel}
                  />
                  <ResearchModeSelector
                    selectedMode={researchMode}
                    onModeChange={setResearchMode}
                    isAuthenticated={isUserAuthenticated}
                    className="rounded-full"
                  />
                </div>
                <PromptInputAction
                  tooltip={isProcessing ? "Stop" : "Send"}
                >
                  <Button
                    size="sm"
                    className="size-9 rounded-full transition-all duration-300 ease-out"
                    disabled={!isProcessing && (!value || isOnlyWhitespace(value))}
                    type="button"
                    onClick={handleSend}
                    aria-label={isProcessing ? "Stop" : "Send message"}
                  >
                    {isProcessing ? (
                      <StopIcon className="size-4" />
                    ) : (
                      <ArrowUpIcon className="size-4" />
                    )}
                  </Button>
                </PromptInputAction>
              </PromptInputActions>
            </PromptInput>
          </div>
        </PopoverTrigger>
        {isUpgradeOpen && <PopoverContentUpgradeRequired />}
        {isWelcomePopoverOpen && (
          <PopoverContentWelcome
            firstName={firstName || undefined}
            onGetStarted={() => {
              setIsWelcomeOpen(false)
              if (onWelcomeDismiss) {
                onWelcomeDismiss()
              }
            }}
          />
        )}
      </Popover>
    </div>
  )
}
