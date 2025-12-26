"use client"

import { useState, useCallback, useEffect } from "react"
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
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  File,
  X,
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

// Google Picker API types - using 'any' for the complex Google API objects
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GooglePickerAPI = any

interface GooglePickerResponse {
  action: string
  docs?: Array<{
    id: string
    name: string
    mimeType: string
    sizeBytes?: number
    url: string
    lastEditedUtc?: number
  }>
}

declare global {
  interface Window {
    google?: {
      picker: GooglePickerAPI
    }
    gapi?: {
      load: (
        api: string,
        config: (() => void) | {
          callback: () => void
          onerror?: () => void
          timeout?: number
          ontimeout?: () => void
        }
      ) => void
    }
  }
}

interface SelectedFile {
  id: string
  name: string
  mimeType: string
  size?: number
  status: "pending" | "processing" | "ready" | "failed"
  error?: string
}

// MIME types we support for processing
const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",")

interface GoogleDrivePickerProps {
  onFilesImported?: (count: number) => void
}

export function GoogleDrivePicker({ onFilesImported }: GoogleDrivePickerProps) {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [isPickerReady, setIsPickerReady] = useState(false)
  const [isLoadingPicker, setIsLoadingPicker] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [isImporting, setIsImporting] = useState(false)

  // Load Google Picker API
  const loadPickerApi = useCallback(async () => {
    if (window.google?.picker) {
      setIsPickerReady(true)
      return true
    }

    setIsLoadingPicker(true)

    return new Promise<boolean>((resolve) => {
      // Timeout after 10 seconds
      const timeout = setTimeout(() => {
        console.error("[Google Picker] Load timeout")
        setIsLoadingPicker(false)
        resolve(false)
      }, 10000)

      const initPicker = () => {
        if (!window.gapi) {
          console.error("[Google Picker] gapi not available")
          clearTimeout(timeout)
          setIsLoadingPicker(false)
          resolve(false)
          return
        }

        window.gapi.load("picker", {
          callback: () => {
            clearTimeout(timeout)
            setIsPickerReady(true)
            setIsLoadingPicker(false)
            resolve(true)
          },
          onerror: () => {
            console.error("[Google Picker] Failed to load picker module")
            clearTimeout(timeout)
            setIsLoadingPicker(false)
            resolve(false)
          },
          timeout: 5000,
          ontimeout: () => {
            console.error("[Google Picker] Picker module load timeout")
            clearTimeout(timeout)
            setIsLoadingPicker(false)
            resolve(false)
          }
        })
      }

      // Check if script already exists
      const existingScript = document.querySelector(
        'script[src="https://apis.google.com/js/api.js"]'
      )

      if (existingScript && window.gapi) {
        initPicker()
        return
      }

      // If script exists but gapi not ready, wait for it
      if (existingScript && !window.gapi) {
        const checkGapi = setInterval(() => {
          if (window.gapi) {
            clearInterval(checkGapi)
            initPicker()
          }
        }, 100)

        // Stop checking after 5 seconds
        setTimeout(() => {
          clearInterval(checkGapi)
          if (!window.gapi) {
            clearTimeout(timeout)
            setIsLoadingPicker(false)
            resolve(false)
          }
        }, 5000)
        return
      }

      const script = document.createElement("script")
      script.src = "https://apis.google.com/js/api.js"
      script.async = true
      script.onload = initPicker
      script.onerror = () => {
        console.error("[Google Picker] Failed to load gapi script")
        clearTimeout(timeout)
        setIsLoadingPicker(false)
        resolve(false)
      }
      document.head.appendChild(script)
    })
  }, [])

  // Open the picker
  const openPicker = useCallback(async () => {
    try {
      // Fetch picker token
      const tokenRes = await fetchClient("/api/google-integrations/drive/picker-token")
      if (!tokenRes.ok) {
        const error = await tokenRes.json()
        throw new Error(error.error || "Failed to get picker token")
      }
      const { accessToken, clientId, developerKey } = await tokenRes.json()

      if (!accessToken) {
        throw new Error("No access token received")
      }

      // Ensure picker API is loaded
      if (!isPickerReady) {
        const loaded = await loadPickerApi()
        if (!loaded) {
          throw new Error("Failed to load Google Picker. Please check if the Picker API is enabled in Google Cloud Console.")
        }
      }

      // Build and show picker
      const google = window.google
      if (!google?.picker) {
        throw new Error("Google Picker not available")
      }

      // Create the callback handler
      const pickerCallback = (data: GooglePickerResponse) => {
        if (data.action === google.picker.Action.PICKED && data.docs) {
          const files: SelectedFile[] = data.docs.map((doc) => ({
            id: doc.id,
            name: doc.name,
            mimeType: doc.mimeType,
            size: doc.sizeBytes,
            status: "pending" as const,
          }))
          setSelectedFiles(files)
          setIsOpen(true)
        }
      }

      // Create a DocsView that shows documents the user can select
      // Using the actual Google Picker API
      const docsView = new google.picker.DocsView()
        .setIncludeFolders(false)
        .setSelectFolderEnabled(false)
        .setMimeTypes(SUPPORTED_MIME_TYPES)

      // Build the picker
      const pickerBuilder = new google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setTitle("Select files to import")
        .addView(docsView)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setCallback(pickerCallback)
        .setMaxItems(20) // Limit to 20 files at once

      // Use developer key if available (required for some configurations)
      if (developerKey) {
        pickerBuilder.setDeveloperKey(developerKey)
      }

      // Set app ID from client ID (required for picker to work)
      if (clientId) {
        const appId = clientId.split("-")[0]
        pickerBuilder.setAppId(appId)
      }

      // Build and show the picker
      const picker = pickerBuilder.build()
      picker.setVisible(true)
    } catch (error) {
      console.error("[Google Drive Picker] Error:", error)
      toast({
        title: "Picker Error",
        description: error instanceof Error ? error.message : "Failed to open file picker",
      })
    }
  }, [isPickerReady, loadPickerApi])

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

  // Import all selected files
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
    // Only close if not importing
    if (!isImporting) {
      setIsOpen(false)
      // Clear files after animation
      setTimeout(() => setSelectedFiles([]), 300)
    }
  }

  // Preload picker API when component mounts
  useEffect(() => {
    loadPickerApi()
  }, [loadPickerApi])

  const pendingFiles = selectedFiles.filter((f) => f.status === "pending")
  const completedFiles = selectedFiles.filter((f) => f.status === "ready")
  const failedFiles = selectedFiles.filter((f) => f.status === "failed")

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openPicker}
        disabled={isLoadingPicker}
        className="w-full"
      >
        {isLoadingPicker ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Upload className="mr-2 size-4" />
        )}
        Import from Drive
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Import Files
            </DialogTitle>
            <DialogDescription>
              Selected files will be processed and indexed for AI search.
            </DialogDescription>
          </DialogHeader>

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
                    <File className="size-5 text-muted-foreground flex-shrink-0" />
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
        </DialogContent>
      </Dialog>
    </>
  )
}
