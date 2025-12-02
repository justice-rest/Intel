"use client"

import { cn } from "@/lib/utils"
import { CaretDown, FileText } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

interface Citation {
  document: string
  page: number | null
  content: string
  similarity: number
  documentId: string
  chunkId: string
}

type CitationSourcesProps = {
  citations: Citation[]
  className?: string
  onPreview?: (documentId: string) => void
}

const TRANSITION = {
  type: "spring" as const,
  duration: 0.2,
  bounce: 0,
}

export function CitationSources({
  citations,
  className,
  onPreview,
}: CitationSourcesProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!citations || citations.length === 0) {
    return null
  }

  // Group citations by document
  const citationsByDocument = citations.reduce(
    (acc, citation) => {
      if (!acc[citation.documentId]) {
        acc[citation.documentId] = {
          name: citation.document,
          citations: [],
        }
      }
      acc[citation.documentId].citations.push(citation)
      return acc
    },
    {} as Record<
      string,
      {
        name: string
        citations: Citation[]
      }
    >
  )

  const documentCount = Object.keys(citationsByDocument).length
  const totalCitations = citations.length

  return (
    <div className={cn("my-4", className)}>
      <div className="border-border flex flex-col gap-0 overflow-hidden rounded-md border">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
          className="hover:bg-accent flex w-full flex-row items-center rounded-t-md px-3 py-2 transition-colors"
        >
          <div className="flex flex-1 flex-row items-center gap-2 text-left text-sm">
            <FileText className="h-4 w-4" weight="fill" />
            <span className="font-medium">
              Sources from your documents
            </span>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-xs">
                {totalCitations} passage{totalCitations > 1 ? "s" : ""} from{" "}
                {documentCount} document{documentCount > 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <CaretDown
            className={cn(
              "h-4 w-4 transition-transform",
              isExpanded ? "rotate-180 transform" : ""
            )}
          />
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={TRANSITION}
              className="overflow-hidden"
            >
              <div className="space-y-3 px-3 pt-3 pb-3">
                {Object.entries(citationsByDocument).map(
                  ([documentId, { name, citations: docCitations }]) => (
                    <div key={documentId} className="space-y-2">
                      {/* Document header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="text-primary h-4 w-4 flex-shrink-0" />
                          <span className="text-sm font-medium">{name}</span>
                        </div>
                        {onPreview && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onPreview(documentId)}
                            className="h-7 text-xs"
                          >
                            View Document
                          </Button>
                        )}
                      </div>

                      {/* Citations from this document */}
                      <div className="space-y-2">
                        {docCitations.map((citation, index) => (
                          <div
                            key={citation.chunkId}
                            className="bg-muted/50 rounded-md p-3 text-sm"
                          >
                            <div className="mb-1 flex items-center gap-2">
                              {citation.page && (
                                <span className="text-muted-foreground text-xs">
                                  Page {citation.page}
                                </span>
                              )}
                              <span className="text-muted-foreground text-xs">
                                • {citation.similarity}% match
                              </span>
                            </div>
                            <p className="text-muted-foreground line-clamp-3 text-xs leading-relaxed">
                              "{citation.content}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
