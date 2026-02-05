"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { CloudArrowUp, FilePdf, X } from "@phosphor-icons/react"
import { useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"

interface DocumentUploadProps {
  onUpload: (file: File, tags: string[]) => Promise<void>
  isUploading: boolean
  maxFileSize?: number
}

export function DocumentUpload({
  onUpload,
  isUploading,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [tags, setTags] = useState<string>("")
  const [error, setError] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const validateFile = useCallback((file: File): string | null => {
    if (file.type !== "application/pdf") {
      return "Only PDF files are supported"
    }
    if (file.size > maxFileSize) {
      return `File too large. Maximum size is ${maxFileSize / (1024 * 1024)}MB`
    }
    return null
  }, [maxFileSize])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      setError("")

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        const file = files[0]
        const validationError = validateFile(file)
        if (validationError) {
          setError(validationError)
        } else {
          setSelectedFile(file)
        }
      }
    },
    [validateFile]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("")
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
      } else {
        setSelectedFile(file)
      }
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    try {
      setError("")
      const tagArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      await onUpload(selectedFile, tagArray)

      // Reset form
      setSelectedFile(null)
      setTags("")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    setTags("")
    setError("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-4">
      {/* Drag and drop area */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-border relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
          isDragging && "border-primary bg-primary/5",
          !isDragging && "hover:border-muted-foreground/50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />

        <AnimatePresence mode="wait">
          {!selectedFile ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-3 text-center"
            >
              <CloudArrowUp className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  Drag and drop your PDF here
                </p>
                <p className="text-muted-foreground text-xs">
                  or click to browse (max {maxFileSize / (1024 * 1024)}MB)
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                Choose File
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="selected"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex w-full items-center gap-3"
            >
              <FilePdf className="text-primary h-10 w-10 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {selectedFile.name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              {!isUploading && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCancel}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="text-destructive rounded-md bg-destructive/10 p-3 text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Tags input and upload button */}
      {selectedFile && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-3"
        >
          <div>
            <label
              htmlFor="tags"
              className="text-muted-foreground mb-1 block text-xs"
            >
              Tags (optional, comma-separated)
            </label>
            <Input
              id="tags"
              type="text"
              placeholder="e.g., Annual Reports, Research, Donor Data"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              disabled={isUploading}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex-1"
            >
              {isUploading ? "Uploading..." : "Upload Document"}
            </Button>
            {!isUploading && (
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Upload progress indicator */}
      {isUploading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <motion.div
              className="bg-primary h-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{
                duration: 30, // Estimated processing time
                ease: "linear" as const,
              }}
            />
          </div>
          <p className="text-muted-foreground text-center text-xs">
            Processing document... This may take a minute.
          </p>
        </motion.div>
      )}
    </div>
  )
}
