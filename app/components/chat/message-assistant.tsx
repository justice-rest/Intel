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
import { cn } from "@/lib/utils"
import type { UIMessage as MessageAISDK } from "ai"
import { ArrowClockwise, Check, Copy, FilePdf, SpinnerGap } from "@phosphor-icons/react"
import { useCallback, useMemo, useRef, useState } from "react"
import { getSources } from "./get-sources"
import { getCitations } from "./get-citations"
import { QuoteButton } from "./quote-button"
import { Reasoning } from "./reasoning"
import { SearchImages, type ImageResult } from "./search-images"
import { SourcesList } from "./sources-list"
import { CitationSources } from "./citation-sources"
import { ToolInvocation } from "./tool-invocation"
import { useAssistantMessageSelection } from "./useAssistantMessageSelection"
import { NotesTrigger } from "./notes/notes-trigger"

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

  const sources = getSources(parts || [])
  const citations = getCitations(parts || []) // Extract RAG citations
  // In v5, tool parts have type starting with "tool-" prefix (e.g., "tool-imageSearch")
  // Filter for both old "tool-invocation" type and new "tool-*" pattern
  const toolInvocationParts = (parts || []).filter(
    (part) => part.type === "tool-invocation" || part.type.startsWith("tool-")
  )
  // In v5, reasoning parts have .text property, not .reasoning
  const reasoningParts = (parts || []).find((part) => part.type === "reasoning") as { type: "reasoning"; text?: string; reasoning?: string } | undefined
  const contentNullOrEmpty = children === null || children === ""
  const isLastStreaming = status === "streaming" && isLast
  // Handle both v4 (toolInvocation.state === "result") and v5 (state === "output-available") tool structures
  const searchImageResults =
    (parts || [])
      .filter((part) => {
        // Check for v5 tool-imageSearch type
        if (part.type === "tool-imageSearch") {
          const toolPart = part as unknown as { state: string; output?: { content?: Array<{ type: string; results?: unknown[] }> } }
          return toolPart.state === "output-available" &&
                 toolPart.output?.content?.[0]?.type === "images"
        }
        // Check for v4 tool-invocation type (backward compatibility)
        if (part.type === "tool-invocation") {
          const v4Part = part as unknown as { toolInvocation?: { state: string; toolName: string; result?: { content?: Array<{ type: string; results?: unknown[] }> } } }
          return v4Part.toolInvocation?.state === "result" &&
                 v4Part.toolInvocation?.toolName === "imageSearch" &&
                 v4Part.toolInvocation?.result?.content?.[0]?.type === "images"
        }
        return false
      })
      .flatMap((part) => {
        // Extract results from v5 structure
        if (part.type === "tool-imageSearch") {
          const toolPart = part as unknown as { output?: { content?: Array<{ results?: unknown[] }> } }
          return (toolPart.output?.content?.[0]?.results ?? []) as ImageResult[]
        }
        // Extract results from v4 structure
        if (part.type === "tool-invocation") {
          const v4Part = part as unknown as { toolInvocation?: { result?: { content?: Array<{ results?: unknown[] }> } } }
          return (v4Part.toolInvocation?.result?.content?.[0]?.results ?? []) as ImageResult[]
        }
        return [] as ImageResult[]
      }) ?? [] as ImageResult[]

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
        {reasoningParts && (reasoningParts.text || reasoningParts.reasoning) && (
          <Reasoning
            reasoning={reasoningParts.text || reasoningParts.reasoning || ""}
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
