"use client"

import { useState, useEffect, useCallback } from "react"
import { useCustomer } from "autumn-js/react"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { normalizePlanId } from "@/lib/subscription/autumn-client"
import { formatBytes } from "@/lib/rag/config"
import { DocumentUpload } from "./document-upload"
import { DocumentList } from "./document-list"
import { UpgradePrompt } from "./upgrade-prompt"
import { toast } from "@/components/ui/toast"
import type { RAGDocument, RAGStorageUsage } from "@/lib/rag/types"

export function DataSection() {
  const { customer } = useCustomer()

  const [documents, setDocuments] = useState<RAGDocument[]>([])
  const [usage, setUsage] = useState<RAGStorageUsage>({
    document_count: 0,
    total_bytes: 0,
    chunk_count: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)

  // Check if user has Scale plan
  const currentProductId = customer?.products?.[0]?.id
  const planType = normalizePlanId(currentProductId)
  const hasUltraAccess = planType === "scale"

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    if (!hasUltraAccess) return

    try {
      setIsLoading(true)
      const response = await fetch("/api/rag/documents")

      if (!response.ok) {
        throw new Error("Failed to fetch documents")
      }

      const data = await response.json()
      setDocuments(data.documents || [])
      setUsage(data.usage || { document_count: 0, total_bytes: 0, chunk_count: 0 })
    } catch (error) {
      console.error("Failed to fetch documents:", error)
      toast({
        title: "Error",
        description: "Failed to load documents",
        status: "error",
      })
    } finally {
      setIsLoading(false)
    }
  }, [hasUltraAccess])

  // Load documents on mount
  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Handle upload
  const handleUpload = async (file: File, tags: string[]) => {
    try {
      setIsUploading(true)

      const formData = new FormData()
      formData.append("file", file)
      formData.append("tags", tags.join(","))

      // Create abort controller for timeout handling (5 minute timeout)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minutes

      try {
        const response = await fetch("/api/rag/upload", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        // Handle response with defensive parsing
        let errorMessage = "Upload failed"

        if (!response.ok) {
          try {
            const error = await response.json()
            errorMessage = error.error || errorMessage
          } catch (_parseError) {
            // If JSON parsing fails, try to get text response
            const text = await response.text().catch(() => "")
            errorMessage = text || `Server error: ${response.status} ${response.statusText}`
          }
          throw new Error(errorMessage)
        }

        // Parse success response defensively
        try {
          await response.json()
        } catch (_parseError) {
          // If JSON parsing fails on success response, check if it's a timeout issue
          console.error("Failed to parse upload response:", _parseError)
          throw new Error(
            "Upload may have timed out. Please check if the document appears in your list below. If not, try uploading a smaller file or try again later."
          )
        }

        toast({
          title: "Success",
          description: "Document uploaded and processed successfully",
        })

        // Refresh document list
        await fetchDocuments()
      } catch (fetchError) {
        clearTimeout(timeoutId)

        // Handle abort/timeout
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          throw new Error(
            "Upload timed out after 5 minutes. Please try uploading a smaller file or check your connection."
          )
        }

        throw fetchError
      }
    } catch (error) {
      console.error("Upload error:", error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred",
        status: "error",
      })
      throw error // Re-throw to let DocumentUpload handle it
    } finally {
      setIsUploading(false)
    }
  }

  // Handle delete
  const handleDelete = async (documentId: string) => {
    try {
      const response = await fetch(`/api/rag/documents?id=${documentId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Delete failed")
      }

      toast({
        title: "Success",
        description: "Document deleted successfully",
      })

      // Refresh document list
      await fetchDocuments()
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "An error occurred",
        status: "error",
      })
    }
  }

  // Handle preview
  const handlePreview = (_documentId: string) => {
    // TODO: Implement preview modal
    toast({
      title: "Preview",
      description: "Preview feature coming soon",
    })
  }

  // Handle download
  const handleDownload = async (documentId: string) => {
    try {
      const response = await fetch(`/api/rag/download/${documentId}`)

      if (!response.ok) {
        throw new Error("Download failed")
      }

      const { url } = await response.json()

      // Open in new tab
      window.open(url, "_blank")
    } catch (error) {
      console.error("Download error:", error)
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "An error occurred",
        status: "error",
      })
    }
  }

  // If not Ultra plan, show gated UI
  if (!hasUltraAccess) {
    return (
      <div>
        <h3 className="mb-3 text-sm font-medium">Documents</h3>
        <div className="cursor-not-allowed opacity-50">
          <div className="border-border rounded-lg border-2 border-dashed p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-muted-foreground text-sm">
                RAG document management is a Scale plan feature
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-primary hover:underline text-sm font-medium cursor-pointer opacity-100">
                    Click to learn more
                  </button>
                </PopoverTrigger>
                <UpgradePrompt />
              </Popover>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-medium">Documents</h3>
          <span className="text-muted-foreground text-xs">
            {usage.document_count}/50 • {formatBytes(usage.total_bytes)}/500MB
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          Upload PDFs to power AI search across your documents
        </p>
      </div>

      {/* Upload area */}
      <DocumentUpload onUpload={handleUpload} isUploading={isUploading} />

      {/* Document list */}
      <DocumentList
        documents={documents}
        onDelete={handleDelete}
        onPreview={handlePreview}
        onDownload={handleDownload}
        isLoading={isLoading}
      />
    </div>
  )
}
