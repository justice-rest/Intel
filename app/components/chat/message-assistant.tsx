import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/prompt-kit/message"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { exportToPdf } from "@/lib/pdf-export"
import { exportProspectToPdf } from "@/lib/prospect-pdf/client-export"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { cn } from "@/lib/utils"
import type { Message as MessageAISDK } from "@ai-sdk/react"
import { ArrowClockwise, Check, CheckCircle, Copy, FilePdf, Spinner, SpinnerGap } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "framer-motion"
import { useCallback, useRef, useState } from "react"
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
  // Verification status (from Perplexity Sonar)
  verified?: boolean
  verifying?: boolean
  verification_result?: {
    corrections?: string[]
    gapsFilled?: string[]
    confidenceScore?: number
    sources?: string[]
    wasModified?: boolean
  }
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
  verified,
  verifying,
  verification_result,
}: MessageAssistantProps) {
  const { preferences } = useUserPreferences()
  const { chatId } = useChatSession()
  const { getChatById } = useChats()
  const [isExporting, setIsExporting] = useState(false)
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

      // Check if content looks like a prospect report (has typical sections)
      const isProspectReport =
        children.includes("## Executive Summary") ||
        children.includes("## Summary") ||
        children.includes("### Real Estate") ||
        children.includes("### Wealth") ||
        children.includes("RōmyScore") ||
        children.includes("Gift Capacity")

      if (isProspectReport) {
        // Use the branded PDF API for prospect reports
        const response = await fetch("/api/prospect-pdf", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prospectName: title.replace(/^(Donor Profile|Prospect Report|Research):?\s*/i, "") || "Prospect",
            location: "See report details",
            reportDate: new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            executiveSummary: extractSection(children, "Executive Summary") ||
              extractSection(children, "Summary") ||
              children.substring(0, 500),
            personal: {
              fullName: title.replace(/^(Donor Profile|Prospect Report|Research):?\s*/i, "") || "Prospect",
            },
            professional: {
              currentPositions: extractSection(children, "Current Position") ||
                extractSection(children, "Business"),
              education: extractSection(children, "Education"),
            },
            realEstate: {
              primaryResidence: extractSection(children, "Real Estate") ||
                extractSection(children, "Property"),
            },
            businessInterests: {
              currentEquity: extractSection(children, "Business") ||
                extractSection(children, "Ownership"),
            },
            otherAssets: {},
            lifestyleIndicators: {
              netWorthAssessment: extractSection(children, "Net Worth") ||
                extractSection(children, "Wealth"),
            },
            philanthropic: {
              documentedInterests: extractSection(children, "Philanthrop") ||
                extractSection(children, "Giving"),
            },
            givingCapacity: {
              recommendedAskRange: extractSection(children, "Recommended Ask") ||
                extractSection(children, "Gift Capacity") ||
                "See report",
            },
            engagement: {},
            summary: {
              prospectGrade: extractSection(children, "Capacity Rating") ||
                extractSection(children, "Rating"),
            },
            conclusion: extractSection(children, "Conclusion") ||
              extractSection(children, "Cultivation") ||
              "See full report for details.",
          }),
        })

        if (response.ok) {
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.href = url
          link.download =
            response.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ||
            `romy-report-${Date.now()}.pdf`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        } else {
          // Fallback to simple PDF export
          console.warn("Branded PDF API failed, falling back to simple export")
          await fallbackExportPdf()
        }
      } else {
        // Use simple PDF export for non-report content
        await fallbackExportPdf()
      }
    } catch (error) {
      console.error("Failed to export PDF:", error)
      // Try fallback
      await fallbackExportPdf()
    } finally {
      setIsExporting(false)
    }
  }

  const fallbackExportPdf = async () => {
    if (!children) return
    const chat = chatId ? getChatById(chatId) : null
    const title = chat?.title || "Rōmy Response"
    const formattedDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    // Check if content looks like a prospect report
    const isProspectReport =
      children.includes("## Executive Summary") ||
      children.includes("## Summary") ||
      children.includes("### Real Estate") ||
      children.includes("### Wealth") ||
      children.includes("RōmyScore") ||
      children.includes("Gift Capacity")

    if (isProspectReport) {
      // Use branded client-side PDF export
      await exportProspectToPdf({
        prospectName: title.replace(/^(Donor Profile|Prospect Report|Research):?\s*/i, "") || "Prospect",
        location: "See report details",
        reportDate: formattedDate,
        executiveSummary: extractSection(children, "Executive Summary") ||
          extractSection(children, "Summary") ||
          children.substring(0, 500),
        personal: {
          fullName: title.replace(/^(Donor Profile|Prospect Report|Research):?\s*/i, "") || "Prospect",
        },
        professional: {
          currentPositions: extractSection(children, "Current Position") ||
            extractSection(children, "Business"),
          education: extractSection(children, "Education"),
        },
        realEstate: {
          primaryResidence: extractSection(children, "Real Estate") ||
            extractSection(children, "Property"),
        },
        businessInterests: {
          currentEquity: extractSection(children, "Business") ||
            extractSection(children, "Ownership"),
        },
        otherAssets: {},
        lifestyleIndicators: {
          netWorthAssessment: extractSection(children, "Net Worth") ||
            extractSection(children, "Wealth"),
        },
        philanthropic: {
          documentedInterests: extractSection(children, "Philanthrop") ||
            extractSection(children, "Giving"),
        },
        givingCapacity: {
          recommendedAskRange: extractSection(children, "Recommended Ask") ||
            extractSection(children, "Gift Capacity") ||
            "See report",
        },
        engagement: {},
        summary: {
          prospectGrade: extractSection(children, "Capacity Rating") ||
            extractSection(children, "Rating"),
        },
        conclusion: extractSection(children, "Conclusion") ||
          extractSection(children, "Cultivation") ||
          "See full report for details.",
      })
    } else {
      // Use simple PDF export for non-report content
      await exportToPdf(children, {
        title,
        date: formattedDate,
        logoSrc: "/BrandmarkRōmy.png",
      })
    }
  }

  // Helper to extract sections from markdown
  const extractSection = (content: string, sectionName: string): string => {
    const patterns = [
      new RegExp(`##\\s*${sectionName}[\\s\\S]*?(?=##|$)`, "i"),
      new RegExp(`###\\s*${sectionName}[\\s\\S]*?(?=###|##|$)`, "i"),
      new RegExp(`\\*\\*${sectionName}[^*]*\\*\\*[:\\s]*([^\\n]+)`, "i"),
    ]

    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match) {
        let extracted = match[0]
          .replace(/^#+\s*[^\n]+\n/, "")
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .trim()
        if (extracted.length > 0 && extracted.length < 2000) {
          return extracted
        }
      }
    }
    return ""
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

        {/* Verification status badge */}
        <AnimatePresence mode="wait">
          {verifying && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              key="verifying"
              className="mt-2"
            >
              <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
                <Spinner className="mr-1.5 h-3 w-3 animate-spin" />
                Verifying response
              </div>
            </motion.div>
          )}
          {verified && !verifying && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              key="verified"
              className="mt-2"
            >
              <div
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-1 text-xs",
                  verification_result?.wasModified
                    ? "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                    : "border border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
                )}
              >
                <CheckCircle className="mr-1.5 h-3 w-3" weight="fill" />
                {verification_result?.wasModified ? "Enhanced" : "Verified"}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
