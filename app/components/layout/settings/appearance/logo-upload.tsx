"use client"

import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  UploadSimple,
  Trash,
  Image as ImageIcon,
  Spinner,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import {
  validateLogoFile,
  MAX_LOGO_SIZE_BYTES,
  ALLOWED_LOGO_TYPES,
} from "@/lib/pdf-branding"

interface LogoUploadProps {
  logoUrl: string | null
  logoBase64: string | null
  onUpload: (file: File) => Promise<void>
  onDelete: () => Promise<void>
  disabled?: boolean
}

export function LogoUpload({
  logoUrl,
  logoBase64,
  onUpload,
  onDelete,
  disabled = false,
}: LogoUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasLogo = Boolean(logoUrl || logoBase64)
  const previewUrl = logoBase64 || logoUrl

  // Handle file selection
  const handleFile = useCallback(
    async (file: File) => {
      setError(null)

      // Validate file
      const validation = validateLogoFile(file)
      if (!validation.isValid) {
        setError(validation.error || "Invalid file")
        return
      }

      setIsUploading(true)
      try {
        await onUpload(file)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed")
      } finally {
        setIsUploading(false)
      }
    },
    [onUpload]
  )

  // Handle file input change
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFile(file)
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [handleFile]
  )

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const file = e.dataTransfer.files?.[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  // Handle delete
  const handleDelete = useCallback(async () => {
    setError(null)
    setIsDeleting(true)
    try {
      await onDelete()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setIsDeleting(false)
    }
  }, [onDelete])

  // Click to upload
  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const maxMB = MAX_LOGO_SIZE_BYTES / (1024 * 1024)
  const isLoading = isUploading || isDeleting

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Logo</Label>
      <p className="text-muted-foreground text-xs">
        Upload a custom logo for your PDF reports. Max {maxMB}MB. PNG, JPG, or
        GIF.
      </p>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_LOGO_TYPES.join(",")}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isLoading}
      />

      {hasLogo ? (
        // Show logo preview with delete option
        <div className="flex items-start gap-4">
          <div className="bg-muted relative flex h-20 w-32 items-center justify-center overflow-hidden rounded-md border">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Logo preview"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <ImageIcon className="text-muted-foreground size-8" />
            )}
            {isLoading && (
              <div className="bg-background/80 absolute inset-0 flex items-center justify-center">
                <Spinner className="text-primary size-6 animate-spin" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClick}
              disabled={disabled || isLoading}
            >
              <UploadSimple className="mr-1 size-4" />
              Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={disabled || isLoading}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash className="mr-1 size-4" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        // Show upload dropzone
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "flex h-24 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed transition-colors",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
            (disabled || isLoading) && "cursor-not-allowed opacity-50"
          )}
        >
          {isUploading ? (
            <Spinner className="text-muted-foreground size-6 animate-spin" />
          ) : (
            <>
              <UploadSimple className="text-muted-foreground mb-2 size-6" />
              <p className="text-muted-foreground text-xs">
                {isDragOver ? "Drop logo here" : "Click or drag to upload"}
              </p>
            </>
          )}
        </div>
      )}

      {/* Error message */}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}
