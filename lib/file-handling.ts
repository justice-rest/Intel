// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any

import { toast } from "@/components/ui/toast"
import { SupabaseClient } from "@supabase/supabase-js"
import * as fileType from "file-type"
import { DAILY_FILE_UPLOAD_LIMIT } from "./config"
import { createClient } from "./supabase/client"
import { isSupabaseEnabled } from "./supabase/config"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const LARGE_FILE_WARNING_SIZE = 2 * 1024 * 1024 // 2MB - warn about potential token limits (more aggressive)

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]

// Text-based extensions that don't have magic bytes
const TEXT_EXTENSIONS = [".txt", ".md", ".json", ".csv"]

export type Attachment = {
  name: string
  contentType: string
  url: string
}

export async function validateFile(
  file: File
): Promise<{ isValid: boolean; error?: string }> {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
    }
  }

  // Check if it's a text-based file by extension (these don't have magic bytes)
  const fileName = file.name.toLowerCase()
  const isTextFile = TEXT_EXTENSIONS.some(ext => fileName.endsWith(ext))

  if (isTextFile) {
    // For text files, validate by MIME type and extension
    if (
      file.type === "text/plain" ||
      file.type === "text/markdown" ||
      file.type === "application/json" ||
      file.type === "text/csv" ||
      file.type === ""  // Empty MIME type is ok for .txt, .md files
    ) {
      return { isValid: true }
    }
  }

  // For binary files (images, PDFs, Excel), check magic bytes
  try {
    const buffer = await file.arrayBuffer()
    const type = await fileType.fileTypeFromBuffer(
      Buffer.from(buffer.slice(0, 4100))
    )

    if (type && ALLOWED_FILE_TYPES.includes(type.mime)) {
      return { isValid: true }
    }

    // If magic bytes detection failed but MIME type is allowed, trust the MIME type
    if (ALLOWED_FILE_TYPES.includes(file.type)) {
      return { isValid: true }
    }
  } catch (error) {
    console.error("File validation error:", error)
  }

  return {
    isValid: false,
    error: "File type not supported. Supported types: Images (JPG, PNG, GIF, WebP), PDF, and text files (TXT, MD, JSON, CSV)",
  }
}

export async function uploadFile(
  supabase: AnySupabaseClient,
  file: File,
  userId: string
): Promise<string> {
  const fileExt = file.name.split(".").pop()
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 9)
  const fileName = `${userId}/${timestamp}-${random}.${fileExt}`
  const filePath = fileName

  // Upload with upsert to avoid conflicts
  const { error, data } = await supabase.storage
    .from("chat-attachments")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    })

  if (error) {
    console.error("Storage upload error:", error)
    throw new Error(`Error uploading file: ${error.message}`)
  }

  // Get public URL - this works even with RLS enabled on the bucket
  const {
    data: { publicUrl },
  } = supabase.storage.from("chat-attachments").getPublicUrl(filePath)

  return publicUrl
}

export function createAttachment(file: File, url: string): Attachment {
  return {
    name: file.name,
    contentType: file.type,
    url,
  }
}

export async function processFiles(
  files: File[],
  chatId: string,
  userId: string
): Promise<Attachment[]> {
  if (!isSupabaseEnabled) {
    toast({
      title: "File upload not available",
      description: "File uploads require Supabase to be enabled",
      status: "error",
    })
    return []
  }

  const supabase = createClient()
  if (!supabase) {
    toast({
      title: "File upload failed",
      description: "Could not connect to storage service",
      status: "error",
    })
    return []
  }

  const attachments: Attachment[] = []
  const errors: string[] = []
  let hasLargeFile = false

  for (const file of files) {
    // Validate file
    const validation = await validateFile(file)
    if (!validation.isValid) {
      console.warn(`File ${file.name} validation failed:`, validation.error)
      errors.push(`${file.name}: ${validation.error}`)
      continue
    }

    // Check if file is large (especially PDFs which extract to text)
    if (file.size > LARGE_FILE_WARNING_SIZE && file.type === "application/pdf") {
      hasLargeFile = true
    }

    try {
      // Upload file to Supabase storage
      const url = await uploadFile(supabase, file, userId)

      if (!url) {
        throw new Error("Upload failed - no URL returned")
      }

      // Save metadata to chat_attachments table
      const { error: dbError } = await supabase.from("chat_attachments").insert({
        chat_id: chatId,
        user_id: userId,
        file_url: url,
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
        file_size: file.size,
      })

      if (dbError) {
        console.error("Database insertion failed:", dbError)

        // Try to clean up uploaded file
        try {
          const filePath = `${userId}/${url.split("/").pop()}`
          await supabase.storage.from("chat-attachments").remove([filePath])
        } catch (cleanupError) {
          console.error("Cleanup failed:", cleanupError)
        }

        throw new Error(`Database insertion failed: ${dbError.message}`)
      }

      // Successfully uploaded and saved
      attachments.push(createAttachment(file, url))
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error)
      const errorMessage = error instanceof Error ? error.message : "Upload failed"
      errors.push(`${file.name}: ${errorMessage}`)
    }
  }

  // Show summary of errors if any
  if (errors.length > 0) {
    toast({
      title: `${errors.length} file(s) failed to upload`,
      description: errors.join("\n"),
      status: "error",
    })
  }

  // Show success message if at least one file uploaded
  if (attachments.length > 0) {
    toast({
      title: `${attachments.length} file(s) uploaded successfully`,
      status: "success",
    })
  }

  // Warn about large PDFs that might exceed token limits
  if (hasLargeFile) {
    toast({
      title: "Large PDF detected",
      description: "PDFs over 2MB will be automatically truncated to ~12,500 tokens (about 50 pages). For best results with large documents: (1) Break into smaller sections, (2) Ask specific questions about parts of the document, or (3) Use the document upload feature for semantic search instead.",
      status: "info",
    })
  }

  return attachments
}

export class FileUploadLimitError extends Error {
  code: string
  constructor(message: string) {
    super(message)
    this.code = "DAILY_FILE_LIMIT_REACHED"
  }
}

export async function checkFileUploadLimit(userId: string) {
  if (!isSupabaseEnabled) return 0

  const supabase = createClient()

  if (!supabase) {
    toast({
      title: "File upload is not supported in this deployment",
      status: "info",
    })
    return 0
  }

  const now = new Date()
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )

  const { count, error } = await supabase
    .from("chat_attachments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfToday.toISOString())

  if (error) throw new Error(error.message)
  if (count && count >= DAILY_FILE_UPLOAD_LIMIT) {
    throw new FileUploadLimitError("Daily file upload limit reached.")
  }

  return count
}
