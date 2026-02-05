"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  File,
  FileSpreadsheet,
  FileCode,
  X,
  Search,
  FolderOpen,
  Check,
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  size?: string
  webViewLink?: string
  iconLink?: string
  thumbnailLink?: string
}

interface SelectedFile extends DriveFile {
  status: "pending" | "processing" | "ready" | "failed"
  error?: string
}

interface GoogleDriveBrowserProps {
  onFilesImported?: (count: number) => void
}

// Map MIME types to icons
function getFileIcon(mimeType: string) {
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") {
    return <FileSpreadsheet className="size-5 text-green-600" />
  }
  if (mimeType.includes("document") || mimeType.includes("wordprocessing") || mimeType === "application/pdf") {
    return <FileText className="size-5 text-blue-600" />
  }
  if (mimeType.includes("json") || mimeType.includes("markdown") || mimeType === "text/plain") {
    return <FileCode className="size-5 text-purple-600" />
  }
  return <File className="size-5 text-muted-foreground" />
}

// Format file size
function formatSize(sizeBytes?: string): string {
  if (!sizeBytes) return ""
  const bytes = parseInt(sizeBytes, 10)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Format date
function formatDate(dateString?: string): string {
  if (!dateString) return ""
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function GoogleDriveBrowser({ onFilesImported }: GoogleDriveBrowserProps) {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [showImportProgress, setShowImportProgress] = useState(false)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch files from Drive
  const {
    data: filesData,
    isLoading: isLoadingFiles,
    error: filesError,
    refetch: refetchFiles,
  } = useQuery({
    queryKey: ["drive-files", debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "50" })
      if (debouncedSearch) {
        params.set("q", debouncedSearch)
      }
      const res = await fetchClient(`/api/google-integrations/drive/files?${params}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to fetch files")
      }
      return res.json()
    },
    enabled: isOpen,
    staleTime: 30000, // Cache for 30 seconds
  })

  const files: DriveFile[] = useMemo(() => filesData?.files || [], [filesData])

  // Toggle file selection
  const toggleFileSelection = useCallback((file: DriveFile) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev)
      if (next.has(file.id)) {
        next.delete(file.id)
      } else {
        next.add(file.id)
      }
      return next
    })
  }, [])

  // Process file mutation
  const processFileMutation = useMutation({
    mutationFn: async (file: SelectedFile) => {
      const res = await fetchClient("/api/google-integrations/drive/process", {
        method: "POST",
        body: JSON.stringify({
          fileId: file.id,
          fileName: file.name,
          mimeType: file.mimeType,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to process file")
      }
      return res.json()
    },
  })

  // Start import process
  const handleStartImport = useCallback(() => {
    // Get selected files
    const filesToImport = files.filter((f) => selectedFileIds.has(f.id))
    if (filesToImport.length === 0) return

    // Initialize with pending status
    setSelectedFiles(
      filesToImport.map((f) => ({ ...f, status: "pending" as const }))
    )
    setShowImportProgress(true)
  }, [files, selectedFileIds])

  // Process all files
  const handleImport = async () => {
    if (selectedFiles.length === 0) return

    setIsImporting(true)
    let successCount = 0

    for (const file of selectedFiles) {
      // Update status to processing
      setSelectedFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, status: "processing" as const } : f
        )
      )

      try {
        await processFileMutation.mutateAsync(file)
        setSelectedFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, status: "ready" as const } : f
          )
        )
        successCount++
      } catch (error) {
        setSelectedFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: "failed" as const,
                  error: error instanceof Error ? error.message : "Import failed",
                }
              : f
          )
        )
      }
    }

    setIsImporting(false)

    if (successCount > 0) {
      toast({
        title: "Import Complete",
        description: `Successfully imported ${successCount} of ${selectedFiles.length} files`,
      })
      queryClient.invalidateQueries({ queryKey: ["google-integration-status"] })
      queryClient.invalidateQueries({ queryKey: ["drive-documents"] })
      onFilesImported?.(successCount)
    }
  }

  const removeFile = (fileId: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  const clearCompleted = () => {
    setSelectedFiles((prev) => prev.filter((f) => f.status !== "ready"))
  }

  const handleClose = () => {
    if (!isImporting) {
      setIsOpen(false)
      setShowImportProgress(false)
      setSelectedFileIds(new Set())
      setSelectedFiles([])
      setSearchQuery("")
    }
  }

  const handleBack = () => {
    if (!isImporting) {
      setShowImportProgress(false)
      setSelectedFiles([])
    }
  }

  const pendingFiles = selectedFiles.filter((f) => f.status === "pending")
  const completedFiles = selectedFiles.filter((f) => f.status === "ready")
  const failedFiles = selectedFiles.filter((f) => f.status === "failed")

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="w-full"
      >
        <FolderOpen className="mr-2 size-4" />
        Browse Drive Files
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {showImportProgress ? (
                <>
                  <Upload className="size-5" />
                  Import Files
                </>
              ) : (
                <>
                  <FolderOpen className="size-5" />
                  Google Drive
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {showImportProgress
                ? "Selected files will be processed and indexed for AI search."
                : "Select files to import into Rōmy for AI-powered search."}
            </DialogDescription>
          </DialogHeader>

          {!showImportProgress ? (
            // File browser view
            <div className="flex flex-col flex-1 min-h-0 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search files..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-[#333] rounded-lg bg-white dark:bg-[#222] text-black dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white"
                />
              </div>

              {/* File list */}
              <div className="flex-1 min-h-0 overflow-y-auto border border-gray-200 dark:border-[#333] rounded-lg bg-white dark:bg-[#1a1a1a]">
                {isLoadingFiles ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filesError ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <AlertCircle className="size-8 mb-2" />
                    <p className="text-sm">Failed to load files</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => refetchFiles()}
                      className="mt-2"
                    >
                      Try again
                    </Button>
                  </div>
                ) : files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <File className="size-8 mb-2" />
                    <p className="text-sm">
                      {debouncedSearch ? "No files match your search" : "No compatible files found"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {files.map((file) => {
                      const isSelected = selectedFileIds.has(file.id)
                      return (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => toggleFileSelection(file)}
                          className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-100 dark:hover:bg-[#333] transition-colors ${
                            isSelected ? "bg-gray-100 dark:bg-[#333]" : ""
                          }`}
                        >
                          <div className={`flex-shrink-0 size-5 rounded border flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-black dark:bg-white border-black dark:border-white text-white dark:text-black"
                              : "border-gray-300 dark:border-[#555]"
                          }`}>
                            {isSelected && <Check className="size-3" />}
                          </div>
                          {getFileIcon(file.mimeType)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(file.modifiedTime)}
                              {file.size && ` • ${formatSize(file.size)}`}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Selection summary and actions */}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">
                  {selectedFileIds.size} file{selectedFileIds.size !== 1 ? "s" : ""} selected
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStartImport}
                    disabled={selectedFileIds.size === 0}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Import progress view
            <div className="space-y-3">
              {/* File List */}
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                <AnimatePresence mode="popLayout">
                  {selectedFiles.map((file) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      {getFileIcon(file.mimeType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        {file.error && (
                          <p className="text-xs text-destructive">{file.error}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {file.status === "pending" && (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                        {file.status === "processing" && (
                          <Loader2 className="size-4 animate-spin text-blue-500" />
                        )}
                        {file.status === "ready" && (
                          <CheckCircle className="size-4 text-green-500" />
                        )}
                        {file.status === "failed" && (
                          <AlertCircle className="size-4 text-destructive" />
                        )}
                        {file.status === "pending" && !isImporting && (
                          <button
                            onClick={() => removeFile(file.id)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            <X className="size-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Summary */}
              {selectedFiles.length > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3">
                  <span>
                    {pendingFiles.length > 0 && `${pendingFiles.length} pending`}
                    {completedFiles.length > 0 &&
                      `${pendingFiles.length > 0 ? ", " : ""}${completedFiles.length} completed`}
                    {failedFiles.length > 0 &&
                      `${pendingFiles.length > 0 || completedFiles.length > 0 ? ", " : ""}${failedFiles.length} failed`}
                  </span>
                  {completedFiles.length > 0 && !isImporting && (
                    <button
                      onClick={clearCompleted}
                      className="text-xs hover:underline"
                    >
                      Clear completed
                    </button>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {!isImporting && pendingFiles.length > 0 && (
                  <Button variant="outline" onClick={handleBack}>
                    Back
                  </Button>
                )}
                {pendingFiles.length > 0 && (
                  <Button
                    onClick={handleImport}
                    disabled={isImporting}
                    className="flex-1"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>Import {pendingFiles.length} File{pendingFiles.length !== 1 ? "s" : ""}</>
                    )}
                  </Button>
                )}
                {!isImporting && (
                  <Button variant="outline" onClick={handleClose}>
                    {pendingFiles.length > 0 ? "Cancel" : "Done"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
