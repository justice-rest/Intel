"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn, formatRelativeTime } from "@/lib/utils"
import {
  FilePdf,
  MagnifyingGlass,
  DotsThreeVertical,
  Download,
  Trash,
  Eye,
  Spinner,
  CheckCircle,
  WarningCircle,
  Clock,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"
import { useState } from "react"
import type { RAGDocument } from "@/lib/rag/types"

interface DocumentListProps {
  documents: RAGDocument[]
  onDelete: (documentId: string) => Promise<void>
  onPreview: (documentId: string) => void
  onDownload: (documentId: string) => void
  isLoading?: boolean
}

function StatusBadge({ status }: { status: RAGDocument["status"] }) {
  const config = {
    uploading: {
      icon: Clock,
      label: "Uploading",
      className: "bg-blue-500/10 text-blue-500",
    },
    processing: {
      icon: Spinner,
      label: "Processing",
      className: "bg-[#422F10] text-yellow-600",
    },
    ready: {
      icon: CheckCircle,
      label: "Ready",
      className: "bg-[#B183FF]/20 text-[#B183FF]",
    },
    failed: {
      icon: WarningCircle,
      label: "Failed",
      className: "bg-red-500/10 text-red-500",
    },
  }

  const { icon: Icon, label, className } = config[status]

  return (
    <Badge variant="secondary" className={cn("gap-1", className)}>
      <Icon className="h-3 w-3" weight="fill" />
      {label}
    </Badge>
  )
}

function DocumentItem({
  document,
  onDelete,
  onPreview,
  onDownload,
}: {
  document: RAGDocument
  onDelete: (id: string) => Promise<void>
  onPreview: (id: string) => void
  onDownload: (id: string) => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this document?")) return

    try {
      setIsDeleting(true)
      await onDelete(document.id)
    } catch (error) {
      console.error("Delete failed:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="border-border group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
    >
      {/* PDF Icon */}
      <FilePdf className="text-primary h-8 w-8 flex-shrink-0" weight="fill" />

      {/* Document Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-sm font-medium">{document.file_name}</h4>
          <StatusBadge status={document.status} />
        </div>

        {/* Tags */}
        {document.tags && document.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {document.tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
          {document.page_count && (
            <span>{document.page_count} pages</span>
          )}
          {document.word_count && <span>•</span>}
          {document.word_count && (
            <span>{document.word_count.toLocaleString()} words</span>
          )}
          <span>•</span>
          <span>{formatRelativeTime(new Date(document.created_at))}</span>
          {document.error_message && (
            <>
              <span>•</span>
              <span className="text-destructive">{document.error_message}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      {document.status === "ready" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              disabled={isDeleting}
            >
              <DotsThreeVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onPreview(document.id)}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(document.id)}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive"
            >
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {document.status !== "ready" && !isDeleting && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash className="h-4 w-4" />
        </Button>
      )}

      {isDeleting && (
        <div className="flex-shrink-0">
          <Spinner className="h-4 w-4 animate-spin" />
        </div>
      )}
    </motion.div>
  )
}

export function DocumentList({
  documents,
  onDelete,
  onPreview,
  onDownload,
  isLoading,
}: DocumentListProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredDocuments = documents.filter((doc) => {
    if (!searchQuery) return true

    const query = searchQuery.toLowerCase()
    return (
      doc.file_name.toLowerCase().includes(query) ||
      doc.tags?.some((tag) => tag.toLowerCase().includes(query))
    )
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <MagnifyingGlass className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Document List */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <FilePdf className="text-muted-foreground mb-3 h-12 w-12" />
          <p className="text-muted-foreground text-sm">
            No documents yet. Upload your first PDF to get started.
          </p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <MagnifyingGlass className="text-muted-foreground mb-3 h-12 w-12" />
          <p className="text-muted-foreground text-sm">
            No documents match your search.
          </p>
        </div>
      ) : (
        <motion.div layout className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredDocuments.map((document) => (
              <DocumentItem
                key={document.id}
                document={document}
                onDelete={onDelete}
                onPreview={onPreview}
                onDownload={onDownload}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
