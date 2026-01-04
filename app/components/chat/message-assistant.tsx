import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/prompt-kit/message"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { exportToPdf } from "@/lib/pdf-export"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { useReactionsOptional } from "@/lib/reactions"
import { cn } from "@/lib/utils"
import type { Message as MessageAISDK } from "@ai-sdk/react"
import { ArrowClockwise, Check, Copy, FilePdf, SpinnerGap } from "@phosphor-icons/react"
import { useCallback, useMemo, useRef, useState } from "react"
import { getSources } from "./get-sources"
import { getCitations } from "./get-citations"
import { QuoteButton } from "./quote-button"
import { Reasoning } from "./reasoning"
import { SearchImages } from "./search-images"
import { SourcesList } from "./sources-list"
import { CitationSources } from "./citation-sources"
import { ToolInvocation } from "./tool-invocation"
import { useAssistantMessageSelection } from "./useAssistantMessageSelection"
import { NotesTrigger } from "./notes/notes-trigger"
import { ReactionDisplay, ReactionPicker } from "./reactions"
import { formatMessageTimestamp, formatFullTimestamp } from "./format-timestamp"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type MessageAssistantProps = {
  children: string
  isLast?: boolean
  hasScrollAnchor?: boolean
  copied?: boolean
  copyToClipboard?: () => void
  onReload?: () => void
  parts?: MessageAISDK["parts"]
  status?: "streaming" | "ready" | "submitted" | "error"
  className?: string
  messageId: string
  onQuote?: (text: string, messageId: string) => void
  /** Message creation timestamp */
  createdAt?: Date
}

export function MessageAssistant({
  children,
  isLast,
  hasScrollAnchor,
  copied,
  copyToClipboard,
  onReload,
  parts,
  status,
  className,
  messageId,
  onQuote,
  createdAt,
}: MessageAssistantProps) {
  const { preferences } = useUserPreferences()
  const { chatId } = useChatSession()
  const { getChatById } = useChats()
  const [isExporting, setIsExporting] = useState(false)

  // Reactions (optional - only available in collaborative chats)
  const reactionsContext = useReactionsOptional()

  // Parse numeric message ID for reactions
  const numericMessageId = useMemo(() => {
    const parsed = parseInt(messageId, 10)
    return isNaN(parsed) ? null : parsed
  }, [messageId])

  // Get reactions for this message
  const reactions = useMemo(() => {
    if (!reactionsContext || !numericMessageId) return []
    return reactionsContext.getReactionsForMessage(numericMessageId)
  }, [reactionsContext, numericMessageId])

  // Handle reaction toggle
  const handleReactionToggle = useCallback(
    async (emoji: string) => {
      if (!reactionsContext || !numericMessageId) return
      await reactionsContext.toggleReaction(numericMessageId, emoji)
    },
    [reactionsContext, numericMessageId]
  )

  // Handle adding new reaction
  const handleAddReaction = useCallback(
    async (emoji: string) => {
      if (!reactionsContext || !numericMessageId) return
      await reactionsContext.addReaction(numericMessageId, emoji)
    },
    [reactionsContext, numericMessageId]
  )
  const sources = getSources(parts)
  const citations = getCitations(parts) // Extract RAG citations
  const toolInvocationParts = parts?.filter(
    (part) => part.type === "tool-invocation"
  )
  const reasoningParts = parts?.find((part) => part.type === "reasoning")
  const contentNullOrEmpty = children === null || children === ""
  const isLastStreaming = status === "streaming" && isLast
  const searchImageResults =
    parts
      ?.filter(
        (part) =>
          part.type === "tool-invocation" &&
          part.toolInvocation?.state === "result" &&
          part.toolInvocation?.toolName === "imageSearch" &&
          part.toolInvocation?.result?.content?.[0]?.type === "images"
      )
      .flatMap((part) =>
        part.type === "tool-invocation" &&
        part.toolInvocation?.state === "result" &&
        part.toolInvocation?.toolName === "imageSearch" &&
        part.toolInvocation?.result?.content?.[0]?.type === "images"
          ? (part.toolInvocation?.result?.content?.[0]?.results ?? [])
          : []
      ) ?? []

  const isQuoteEnabled = true
  const messageRef = useRef<HTMLDivElement>(null)
  const { selectionInfo, clearSelection } = useAssistantMessageSelection(
    messageRef,
    isQuoteEnabled
  )
  const handleQuoteBtnClick = useCallback(() => {
    if (selectionInfo && onQuote) {
      onQuote(selectionInfo.text, selectionInfo.messageId)
      clearSelection()
    }
  }, [selectionInfo, onQuote, clearSelection])

  const handleExportPdf = async () => {
    if (!children) return

    setIsExporting(true)
    try {
      const chat = chatId ? getChatById(chatId) : null
      const title = chat?.title || "Rōmy Response"
      const formattedDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      // Use server-side PDF export for all content (high-quality Puppeteer rendering)
      await exportToPdf(children, {
        title,
        date: formattedDate,
      })
    } catch (error) {
      console.error("Failed to export PDF:", error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Message
      className={cn(
        "group flex w-full max-w-3xl flex-1 items-start gap-4 px-6 pb-2",
        hasScrollAnchor && "min-h-scroll-anchor",
        className
      )}
    >
      <div
        ref={messageRef}
        className={cn(
          "relative flex min-w-full flex-col gap-2",
          isLast && "pb-8"
        )}
        {...(isQuoteEnabled && { "data-message-id": messageId })}
      >
        {reasoningParts && reasoningParts.reasoning && (
          <Reasoning
            reasoning={reasoningParts.reasoning}
            isStreaming={status === "streaming"}
          />
        )}

        {toolInvocationParts &&
          toolInvocationParts.length > 0 &&
          preferences.showToolInvocations && (
            <ToolInvocation toolInvocations={toolInvocationParts} />
          )}

        {searchImageResults.length > 0 && (
          <SearchImages results={searchImageResults} />
        )}

        {contentNullOrEmpty ? null : (
          <MessageContent
            className={cn(
              "prose dark:prose-invert relative min-w-full bg-transparent p-0",
              "prose-h1:scroll-m-20 prose-h1:text-2xl prose-h1:font-semibold prose-h2:mt-8 prose-h2:scroll-m-20 prose-h2:text-xl prose-h2:mb-3 prose-h2:font-medium prose-h3:scroll-m-20 prose-h3:text-base prose-h3:font-medium prose-h4:scroll-m-20 prose-h5:scroll-m-20 prose-h6:scroll-m-20 prose-strong:font-medium prose-table:block prose-table:overflow-y-auto"
            )}
            markdown={true}
          >
            {children}
          </MessageContent>
        )}

        {sources && sources.length > 0 && <SourcesList sources={sources} />}

        {citations && citations.length > 0 && (
          <CitationSources citations={citations} />
        )}

        {/* Reactions display - show existing reactions */}
        {reactions.length > 0 && (
          <ReactionDisplay
            reactions={reactions}
            onToggle={handleReactionToggle}
            className="-ml-1"
          />
        )}

        {/* Timestamp - visible on hover */}
        {createdAt && !isLastStreaming && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity -mt-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[10px] text-muted-foreground/70 cursor-default">
                  {formatMessageTimestamp(createdAt)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {formatFullTimestamp(createdAt)}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {Boolean(isLastStreaming || contentNullOrEmpty) ? null : (
          <MessageActions
            className={cn(
              "-ml-2 flex gap-0 opacity-0 transition-opacity group-hover:opacity-100"
            )}
          >
            <MessageAction
              tooltip={copied ? "Copied!" : "Copy text"}
              side="bottom"
            >
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
            {/* Reaction picker - only visible in collaborative chats */}
            {reactionsContext && numericMessageId && (
              <MessageAction tooltip="Add reaction" side="bottom">
                <ReactionPicker onSelect={handleAddReaction} />
              </MessageAction>
            )}
            <MessageAction
              tooltip={isExporting ? "Exporting..." : "Export PDF"}
              side="bottom"
            >
              <button
                className="hover:bg-accent/60 text-muted-foreground hover:text-foreground flex size-7.5 items-center justify-center rounded-full bg-transparent transition disabled:opacity-50"
                aria-label="Export PDF"
                onClick={handleExportPdf}
                type="button"
                disabled={isExporting}
              >
                {isExporting ? (
                  <SpinnerGap className="size-4 animate-spin" />
                ) : (
                  <FilePdf className="size-4" />
                )}
              </button>
            </MessageAction>
            <MessageAction tooltip="Notes" side="bottom">
              <NotesTrigger messageId={messageId} />
            </MessageAction>
            {isLast ? (
              <MessageAction
                tooltip="Regenerate"
                side="bottom"
                delayDuration={0}
              >
                <button
                  className="hover:bg-accent/60 text-muted-foreground hover:text-foreground flex size-7.5 items-center justify-center rounded-full bg-transparent transition"
                  aria-label="Regenerate"
                  onClick={onReload}
                  type="button"
                >
                  <ArrowClockwise className="size-4" />
                </button>
              </MessageAction>
            ) : null}
          </MessageActions>
        )}

        {isQuoteEnabled && selectionInfo && selectionInfo.messageId && (
          <QuoteButton
            mousePosition={selectionInfo.position}
            onQuote={handleQuoteBtnClick}
            messageContainerRef={messageRef}
            onDismiss={clearSelection}
          />
        )}
      </div>
    </Message>
  )
}
