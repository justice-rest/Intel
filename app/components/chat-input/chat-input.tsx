"use client"

import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/prompt-kit/prompt-input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { ArrowUpIcon, StopIcon, Waveform } from "@phosphor-icons/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { ButtonFileUpload } from "./button-file-upload"
import { VoiceRecordButton } from "./voice-record-button"
import { FileList } from "./file-list"
import { PopoverContentUpgradeRequired } from "./popover-content-upgrade-required"
import { PopoverContentWelcome } from "./popover-content-welcome"
import { type ResearchMode } from "./research-mode-selector"
import { ResearchSelector } from "@/components/common/model-selector/base"
import { SlashCommandMenu } from "./slash-command-menu"
import { useSlashCommandMenu } from "./use-slash-command-menu"
import { MentionMenu } from "./mention-menu"
import { useMentionMenu, type MentionTarget, type Collaborator } from "./use-mention-menu"
import type { AIStatus } from "@/lib/presence"

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
  researchMode: ResearchMode | null
  setResearchMode: (mode: ResearchMode | null) => void
  quotedText?: { text: string; messageId: string } | null
  showWelcome?: boolean
  firstName?: string | null
  onWelcomeDismiss?: () => void
  hasActiveSubscription?: boolean
  /** Callback for slash commands. Returns true if command was handled. */
  onSlashCommand?: (command: string) => boolean
  /** Whether the user has view-only access (collaboration) */
  isViewerRole?: boolean
  /** Callback when typing status changes (collaboration) */
  onTypingChange?: (isTyping: boolean) => void
  /** AI status from a collaborator (blocks input when collaborator's AI is responding) */
  collaboratorAIStatus?: AIStatus | null
  /** List of collaborators for @mention support */
  collaborators?: Collaborator[]
  /** Whether this is a collaborative chat (enables @mention of collaborators) */
  isCollaborativeChat?: boolean
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
  onSlashCommand,
  isViewerRole,
  onTypingChange,
  collaboratorAIStatus,
  collaborators,
  isCollaborativeChat,
}: ChatInputProps) {
  const isOnlyWhitespace = (text: string) => !/[^\s]/.test(text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false)
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false)
  const [cursorPosition, setCursorPosition] = useState(0)

  // Check if a collaborator's AI is currently responding
  const isCollaboratorAIResponding = collaboratorAIStatus !== null && collaboratorAIStatus !== undefined

  // Unified processing state: blocks input during submission AND streaming
  // Also blocks when a collaborator's AI is responding (prevents race conditions)
  const isProcessing = isSubmitting || status === "submitted" || status === "streaming"
  const isAnyAIResponding = isProcessing || isCollaboratorAIResponding

  // Track if input is disabled (viewer role or any AI responding)
  const isInputDisabled = isViewerRole || isAnyAIResponding

  // Track typing status for collaboration
  const wasTypingRef = useRef(false)

  useEffect(() => {
    if (!onTypingChange || isViewerRole) return

    const isTyping = value.length > 0 && !isOnlyWhitespace(value)

    // Only notify on change
    if (isTyping !== wasTypingRef.current) {
      wasTypingRef.current = isTyping
      onTypingChange(isTyping)
    }
  }, [value, onTypingChange, isViewerRole])

  // Slash command menu state
  const handleCommandSelect = useCallback(
    (command: string) => {
      // Execute the slash command
      if (onSlashCommand) {
        onSlashCommand(command)
      }
      onValueChange("") // Clear input after command execution
    },
    [onSlashCommand, onValueChange]
  )

  const {
    isOpen: isCommandMenuOpen,
    filteredCommands,
    selectedIndex,
    hasQuery,
    handleKeyDown: handleCommandMenuKeyDown,
    selectCommand,
    setSelectedIndex,
  } = useSlashCommandMenu({
    inputValue: value,
    onSelectCommand: handleCommandSelect,
  })

  // Reference for mention start position (updated by the hook)
  const mentionStartPosRef = useRef(-1)

  // @Mention menu state - needs to be defined before handleMentionSelect
  const mentionMenuState = useMentionMenu({
    inputValue: value,
    cursorPosition,
    onSelectMention: (mention: MentionTarget) => {
      // Replace the @query with @DisplayName
      const textarea = textareaRef.current
      if (!textarea) return

      const mentionStartPosition = mentionStartPosRef.current
      if (mentionStartPosition === -1) return

      // Build the mention text (use display name with spaces replaced)
      const mentionText = `@${mention.displayName} `

      // Replace from @ to cursor with the mention
      const beforeMention = value.slice(0, mentionStartPosition)
      const afterCursor = value.slice(cursorPosition)
      const newValue = beforeMention + mentionText + afterCursor

      onValueChange(newValue)

      // Move cursor to after the mention
      const newCursorPos = mentionStartPosition + mentionText.length
      requestAnimationFrame(() => {
        textarea.setSelectionRange(newCursorPos, newCursorPos)
        setCursorPosition(newCursorPos)
      })
    },
    collaborators,
    isCollaborativeChat,
  })

  // Keep ref in sync with hook state
  mentionStartPosRef.current = mentionMenuState.mentionStartPosition

  const {
    isOpen: isMentionMenuOpen,
    filteredMentions,
    selectedIndex: mentionSelectedIndex,
    handleKeyDown: handleMentionMenuKeyDown,
    selectMention,
    setSelectedIndex: setMentionSelectedIndex,
  } = mentionMenuState

  // Track cursor position on selection change
  const handleSelectionChange = useCallback(() => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart)
    }
  }, [])

  // Auto-open welcome popover when showWelcome prop changes to true
  useEffect(() => {
    if (showWelcome) {
      setIsWelcomeOpen(true)
    }
  }, [showWelcome])

  const handleSend = useCallback(() => {
    // If collaborator's AI is responding, don't allow sending
    if (isCollaboratorAIResponding) {
      return
    }

    // If currently processing (submitted or streaming), stop the generation
    if (isProcessing) {
      if (status === "submitted" || status === "streaming") {
        stop()
      }
      return
    }

    // Check for slash command first
    if (onSlashCommand && value.trim().startsWith("/")) {
      if (onSlashCommand(value.trim())) {
        onValueChange("") // Clear input after handling command
        return
      }
    }

    // Check subscription before sending (only for authenticated users)
    if (isUserAuthenticated && hasActiveSubscription === false) {
      setIsUpgradeOpen(true)
      return
    }

    onSend()
  }, [isCollaboratorAIResponding, isProcessing, onSend, status, stop, isUserAuthenticated, hasActiveSubscription, onSlashCommand, value, onValueChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Block all Enter key actions while any AI is responding
      if (isAnyAIResponding && e.key === "Enter") {
        e.preventDefault()
        return
      }

      // Let command menu handle navigation keys first (arrows, tab, enter, escape)
      if (isCommandMenuOpen && handleCommandMenuKeyDown(e)) {
        return
      }

      // Let mention menu handle navigation keys (arrows, tab, enter, escape)
      if (isMentionMenuOpen && handleMentionMenuKeyDown(e)) {
        return
      }

      // Handle escape to clear slash command
      if (e.key === "Escape" && value.trim().startsWith("/")) {
        e.preventDefault()
        onValueChange("")
        return
      }

      if (e.key === "Enter" && !e.shiftKey) {
        if (isOnlyWhitespace(value)) {
          return
        }

        e.preventDefault()

        // Check for slash command first
        if (onSlashCommand && value.trim().startsWith("/")) {
          if (onSlashCommand(value.trim())) {
            onValueChange("") // Clear input after handling command
            return
          }
        }

        // Check subscription before sending (only for authenticated users)
        if (isUserAuthenticated && hasActiveSubscription === false) {
          setIsUpgradeOpen(true)
          return
        }

        onSend()
      }
    },
    [isAnyAIResponding, onSend, value, isUserAuthenticated, hasActiveSubscription, onSlashCommand, onValueChange, isCommandMenuOpen, handleCommandMenuKeyDown, isMentionMenuOpen, handleMentionMenuKeyDown]
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
            {/* Slash command menu - positioned above the input */}
            <SlashCommandMenu
              isOpen={isCommandMenuOpen}
              commands={filteredCommands}
              selectedIndex={selectedIndex}
              onSelect={selectCommand}
              onHover={setSelectedIndex}
              hasQuery={hasQuery}
            />
            {/* @Mention menu - positioned above the input */}
            <MentionMenu
              isOpen={isMentionMenuOpen && !isCommandMenuOpen}
              mentions={filteredMentions}
              selectedIndex={mentionSelectedIndex}
              onSelect={selectMention}
              onHover={setMentionSelectedIndex}
            />
            <PromptInput
              className="bg-popover relative z-10 p-0 pt-1 shadow-xs backdrop-blur-xl"
              maxHeight={300}
              value={value}
              onValueChange={onValueChange}
            >
              <FileList files={files} onFileRemove={onFileRemove} />
              <PromptInputTextarea
                ref={textareaRef}
                placeholder={
                  isViewerRole
                    ? "View-only access"
                    : isCollaboratorAIResponding
                    ? `${collaboratorAIStatus?.display_name}'s AI is responding...`
                    : "Donor's full name and street address (& employer if known)"
                }
                onKeyDown={handleKeyDown}
                onKeyUp={handleSelectionChange}
                onClick={handleSelectionChange}
                onPaste={handlePaste}
                onInput={handleSelectionChange}
                disabled={isInputDisabled}
                className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <PromptInputActions className="mt-3 w-full justify-between p-2">
                <div className="flex gap-2">
                  <ButtonFileUpload
                    onFileUpload={onFileUpload}
                    isUserAuthenticated={isUserAuthenticated}
                    model={selectedModel}
                  />
                  <ResearchSelector
                    selectedMode={researchMode}
                    onModeChange={setResearchMode}
                    isUserAuthenticated={isUserAuthenticated}
                    className="h-9 rounded-full"
                  />
                </div>
                {/* Show voice button when input is empty, send button when there's text */}
                {!isProcessing && (!value || isOnlyWhitespace(value)) ? (
                  <VoiceRecordButton
                    onTranscription={(text) => {
                      onValueChange(value ? `${value} ${text}` : text)
                      textareaRef.current?.focus()
                    }}
                    disabled={isProcessing}
                  />
                ) : (
                  <PromptInputAction
                    tooltip={isProcessing ? "Stop" : "Send"}
                  >
                    <Button
                      size="sm"
                      className="size-9 rounded-full transition-all duration-300 ease-out"
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
                )}
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
