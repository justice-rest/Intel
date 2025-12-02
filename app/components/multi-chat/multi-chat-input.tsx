"use client"

import { MultiModelSelector } from "@/components/common/multi-model-selector/base"
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/prompt-kit/prompt-input"
import { Button } from "@/components/ui/button"
import { ArrowUp, Stop } from "@phosphor-icons/react"
import React, { useCallback } from "react"

type MultiChatInputProps = {
  value: string
  onValueChange: (value: string) => void
  onSend: () => void
  isSubmitting?: boolean
  files: File[]
  onFileUpload: (files: File[]) => void
  onFileRemove: (file: File) => void
  selectedModelIds: string[]
  onSelectedModelIdsChange: (modelIds: string[]) => void
  isUserAuthenticated: boolean
  stop: () => void
  status?: "submitted" | "streaming" | "ready" | "error"
  anyLoading?: boolean
}

export function MultiChatInput({
  value,
  onValueChange,
  onSend,
  isSubmitting,
  selectedModelIds,
  onSelectedModelIdsChange,
  stop,
  status,
  anyLoading,
}: MultiChatInputProps) {
  const isOnlyWhitespace = (text: string) => !/[^\s]/.test(text)

  // Unified processing state: blocks input during submission AND streaming
  const isProcessing = isSubmitting || anyLoading || status === "submitted" || status === "streaming"

  const handleSend = useCallback(() => {
    // If currently processing, stop the generation
    if (isProcessing) {
      if (status === "submitted" || status === "streaming") {
        stop()
      }
      return
    }

    onSend()
  }, [isProcessing, onSend, status, stop])

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
        onSend()
      }
    },
    [isProcessing, onSend, value]
  )

  return (
    <div className="relative flex w-full flex-col gap-4">
      <div className="relative order-2 px-2 pb-3 sm:pb-4 md:order-1">
        <PromptInput
          className="bg-popover relative z-10 p-0 pt-1 shadow-xs backdrop-blur-xl"
          maxHeight={200}
          value={value}
          onValueChange={onValueChange}
        >
          <PromptInputTextarea
            placeholder="Donor’s full name and street address (& employer if known)"
            onKeyDown={handleKeyDown}
            className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
          />
          <PromptInputActions className="mt-5 w-full justify-between px-3 pb-3">
            <div className="flex gap-2">
              <MultiModelSelector
                selectedModelIds={selectedModelIds}
                setSelectedModelIds={onSelectedModelIdsChange}
              />
            </div>
            <PromptInputAction
              tooltip={isProcessing ? "Stop" : "Send"}
            >
              <Button
                size="sm"
                className="size-9 rounded-full transition-all duration-300 ease-out"
                disabled={
                  !isProcessing && (
                    !value ||
                    isOnlyWhitespace(value) ||
                    selectedModelIds.length === 0
                  )
                }
                type="button"
                onClick={handleSend}
                aria-label={isProcessing ? "Stop" : "Send message"}
              >
                {isProcessing ? (
                  <Stop className="size-4" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  )
}
