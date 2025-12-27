"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  FilePdf,
  X,
  Spinner,
  CaretLeft,
  CaretRight,
  Download,
  Copy,
  Check,
  BookOpen,
  TextAa,
  Calendar,
  Tag,
  Warning,
  FileText,
} from "@phosphor-icons/react"
import { formatRelativeTime } from "@/lib/utils"
import { toast } from "@/components/ui/toast"

interface DocumentPage {
  pageNumber: number
  content: string
  chunkCount: number
}

interface DocumentPreview {
  document: {
    id: string
    fileName: string
    fileType: string
    pageCount: number | null
    wordCount: number | null
    language: string
    tags: string[]
    status: string
    createdAt: string
  }
  pages: DocumentPage[]
  totalChunks: number
  truncated?: boolean
}

interface DocumentPreviewModalProps {
  documentId: string | null
  onClose: () => void
  onDownload: (documentId: string) => void
}

export function DocumentPreviewModal({
  documentId,
  onClose,
  onDownload,
}: DocumentPreviewModalProps) {
  const [preview, setPreview] = useState<DocumentPreview | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [copied, setCopied] = useState(false)
  const copiedTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current)
      }
    }
  }, [])

  // Fetch document preview when documentId changes
  useEffect(() => {
    if (!documentId) {
      setPreview(null)
      setError(null)
      return
    }

    const fetchPreview = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/rag/preview/${documentId}`)

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to load preview")
        }

        const data = await response.json()
        setPreview(data)
        setCurrentPage(1)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load preview")
      } finally {
        setIsLoading(false)
      }
    }

    fetchPreview()
  }, [documentId])

  // Keyboard navigation
  useEffect(() => {
    if (!documentId || !preview || preview.pages.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && currentPage > 1) {
        setCurrentPage((p) => p - 1)
      } else if (e.key === "ArrowRight" && currentPage < preview.pages.length) {
        setCurrentPage((p) => p + 1)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [documentId, preview, currentPage])

  const setCopiedWithTimeout = useCallback(() => {
    setCopied(true)
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current)
    }
    copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
  }, [])

  const handleCopyPage = async () => {
    if (!preview || !preview.pages[currentPage - 1]) return

    try {
      await navigator.clipboard.writeText(preview.pages[currentPage - 1].content)
      setCopiedWithTimeout()
      toast({
        title: "Copied",
        description: "Page content copied to clipboard",
      })
    } catch {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        status: "error",
      })
    }
  }

  const handleCopyAll = async () => {
    if (!preview || preview.pages.length === 0) return

    try {
      const allContent = preview.pages
        .map((p) => `--- Page ${p.pageNumber} ---\n\n${p.content}`)
        .join("\n\n")
      await navigator.clipboard.writeText(allContent)
      setCopiedWithTimeout()
      toast({
        title: "Copied",
        description: "All content copied to clipboard",
      })
    } catch {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        status: "error",
      })
    }
  }

  const totalPages = preview?.pages.length || 0
  const currentPageData = preview?.pages[currentPage - 1]
  const hasContent = preview && totalPages > 0

  return (
    <Dialog open={!!documentId} onOpenChange={() => onClose()}>
      <DialogContent
        className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 bg-background"
        aria-describedby="preview-description"
      >
        {/* Hidden description for accessibility */}
        <p id="preview-description" className="sr-only">
          Document preview showing extracted text content. Use arrow keys to navigate between pages.
        </p>

        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <FilePdf className="h-8 w-8 text-primary flex-shrink-0" weight="fill" />
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold truncate">
                  {preview?.document.fileName || "Loading..."}
                </DialogTitle>
                {preview && (
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {preview.document.pageCount && (
                      <span className="flex items-center gap-1">
                        <BookOpen size={12} />
                        {preview.document.pageCount} pages
                      </span>
                    )}
                    {preview.document.wordCount && (
                      <span className="flex items-center gap-1">
                        <TextAa size={12} />
                        {preview.document.wordCount.toLocaleString()} words
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatRelativeTime(new Date(preview.document.createdAt))}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tags */}
          {preview?.document.tags && preview.document.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <Tag size={12} className="text-muted-foreground" />
              {preview.document.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Spinner className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading document...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center px-4">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="h-6 w-6 text-destructive" />
                </div>
                <p className="text-sm text-destructive font-medium">{error}</p>
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          ) : preview && !hasContent ? (
            /* Empty document case */
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center px-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  No content available
                </p>
                <p className="text-xs text-muted-foreground">
                  This document has no extractable text content.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => documentId && onDownload(documentId)}
                  className="gap-2 mt-2"
                >
                  <Download className="h-4 w-4" />
                  Download Original
                </Button>
              </div>
            </div>
          ) : hasContent && currentPageData ? (
            <>
              {/* Truncation warning */}
              {preview?.truncated && (
                <div className="px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
                  <Warning className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Large document truncated for preview. Download to see full content.
                  </p>
                </div>
              )}

              {/* Page Content */}
              <ScrollArea className="flex-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentPage}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="p-6"
                  >
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground/90 bg-muted/30 rounded-lg p-4 border border-border">
                        {currentPageData.content}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </ScrollArea>

              {/* Footer with pagination */}
              <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-4 flex-shrink-0 bg-muted/30">
                {/* Page Navigation */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    aria-label="Previous page"
                  >
                    <CaretLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[100px] text-center">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    aria-label="Next page"
                  >
                    <CaretRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPage}
                    className="gap-2"
                    aria-label="Copy current page content"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Copy Page
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyAll}
                    className="gap-2"
                    aria-label="Copy all pages content"
                  >
                    <Copy className="h-4 w-4" />
                    Copy All
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => documentId && onDownload(documentId)}
                    className="gap-2"
                    aria-label="Download original document"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
