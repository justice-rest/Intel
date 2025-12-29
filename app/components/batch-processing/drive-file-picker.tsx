"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  GoogleDriveLogo,
  Spinner,
  FileXls,
  FileCsv,
  ArrowClockwise,
  CheckCircle,
  WarningCircle,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "@/components/ui/toast"
import { hasDriveScope } from "@/lib/google/config"

interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  size?: string
  iconLink?: string
  webViewLink?: string
}

interface DriveFilePickerProps {
  onFileSelect: (file: { name: string; content: ArrayBuffer; mimeType: string }) => Promise<void>
  isLoading?: boolean
  className?: string
}

/**
 * Google Drive file picker for batch research
 * Allows users to select Excel/CSV files directly from their Drive
 */
export function DriveFilePicker({ onFileSelect, isLoading: externalLoading, className }: DriveFilePickerProps) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [files, setFiles] = useState<DriveFile[]>([])
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if user has Google Drive connected
  useEffect(() => {
    checkDriveConnection()
  }, [])

  const checkDriveConnection = async () => {
    try {
      const response = await fetch("/api/google-integrations")
      if (response.ok) {
        const data = await response.json()
        // Check if connected AND has Drive scope
        const hasConnection = data.connected && hasDriveScope(data.scopes || [])
        setIsConnected(hasConnection)
        if (hasConnection) {
          fetchDriveFiles()
        }
      } else {
        setIsConnected(false)
      }
    } catch {
      setIsConnected(false)
    }
  }

  const fetchDriveFiles = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Fetch only spreadsheet files
      const query = encodeURIComponent(
        "(mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or " +
        "mimeType='application/vnd.google-apps.spreadsheet' or " +
        "mimeType='text/csv') and trashed=false"
      )
      const response = await fetch(`/api/google-integrations/drive/files?q=${query}&pageSize=20`)

      if (response.ok) {
        const data = await response.json()
        setFiles(data.files || [])
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to fetch files")
      }
    } catch (err) {
      setError("Failed to fetch Drive files")
      console.error("Error fetching Drive files:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = () => {
    // Open settings modal to integrations tab (settings is a modal, not a page)
    window.dispatchEvent(
      new CustomEvent("open-settings", { detail: { tab: "integrations" } })
    )
  }

  const handleFileClick = useCallback((file: DriveFile) => {
    setSelectedFile(file)
  }, [])

  const handleSelectFile = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    setError(null)

    try {
      // Fetch file content from Drive
      const response = await fetch(
        `/api/google-integrations/drive/files/${selectedFile.id}/download`,
        { method: "GET" }
      )

      if (!response.ok) {
        throw new Error("Failed to download file from Drive")
      }

      const content = await response.arrayBuffer()

      await onFileSelect({
        name: selectedFile.name,
        content,
        mimeType: selectedFile.mimeType,
      })

      toast({ title: `Selected ${selectedFile.name} from Drive`, status: "success" })
      setSelectedFile(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to process file"
      setError(message)
      toast({ title: message, status: "error" })
    } finally {
      setIsProcessing(false)
    }
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
      return <FileXls className="h-5 w-5 text-green-600" weight="fill" />
    }
    if (mimeType.includes("csv")) {
      return <FileCsv className="h-5 w-5 text-blue-600" weight="fill" />
    }
    return <FileXls className="h-5 w-5 text-muted-foreground" />
  }

  const formatFileSize = (bytes: string | undefined) => {
    if (!bytes) return ""
    const size = parseInt(bytes, 10)
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / 1024 / 1024).toFixed(1)} MB`
  }

  // Not yet checked connection status
  if (isConnected === null) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Not connected to Google Drive
  if (!isConnected) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8 gap-4", className)}>
        <div className="rounded-full bg-muted p-4">
          <GoogleDriveLogo className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h3 className="font-medium">Connect Google Drive</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Import prospect lists directly from your Drive
          </p>
        </div>
        <Button onClick={handleConnect} variant="outline" className="gap-2">
          <GoogleDriveLogo className="h-4 w-4" />
          Connect Google Drive
        </Button>
      </div>
    )
  }

  // Connected but loading files
  if (isLoading) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8 gap-3", className)}>
        <Spinner className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading Drive files...</p>
      </div>
    )
  }

  // Connected with files
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GoogleDriveLogo className="h-5 w-5 text-yellow-500" weight="fill" />
          <span className="font-medium">Google Drive</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchDriveFiles}
          disabled={isLoading}
          className="gap-1"
        >
          <ArrowClockwise className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* File list */}
      {files.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileXls className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No Excel or CSV files found in your Drive</p>
          <p className="text-xs mt-1">Upload a spreadsheet to your Drive to import it here</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {files.map((file) => (
              <motion.button
                key={file.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onClick={() => handleFileClick(file)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                  selectedFile?.id === file.id
                    ? "border-primary bg-primary/5"
                    : "border-transparent bg-muted/50 hover:bg-muted"
                )}
              >
                {getFileIcon(file.mimeType)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                    {file.modifiedTime && (
                      <>
                        {" • "}
                        {new Date(file.modifiedTime).toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>
                {selectedFile?.id === file.id && (
                  <CheckCircle className="h-5 w-5 text-primary" weight="fill" />
                )}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <WarningCircle className="h-4 w-4 flex-shrink-0" weight="fill" />
          <span>{error}</span>
        </div>
      )}

      {/* Select button */}
      {selectedFile && (
        <Button
          onClick={handleSelectFile}
          disabled={isProcessing || externalLoading}
          className="w-full gap-2"
        >
          {isProcessing ? (
            <>
              <Spinner className="h-4 w-4 animate-spin" />
              Importing from Drive...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              Import {selectedFile.name}
            </>
          )}
        </Button>
      )}
    </div>
  )
}
