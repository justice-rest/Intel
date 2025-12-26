/**
 * Google Drive API Client
 * Handles file listing, downloading, and content extraction
 */

import { getValidAccessToken } from "../oauth/token-manager"
import {
  GOOGLE_OAUTH_CONFIG,
  DRIVE_PROCESSING_CONFIG,
  GOOGLE_RATE_LIMITS,
  calculateRetryDelay,
  RETRY_CONFIG,
  getExportFormat,
  isGoogleWorkspaceType,
  isSupportedMimeType,
} from "../config"
import type {
  DriveFile,
  DriveFileList,
  DriveFileContent,
  DriveProcessingStatus,
} from "../types"
import { GoogleApiError, RateLimitError } from "../types"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Make an authenticated request to the Drive API
 */
async function driveRequest<T>(
  userId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getValidAccessToken(userId)

  const url = `${GOOGLE_OAUTH_CONFIG.driveApiUrl}${endpoint}`

  let lastError: Error | null = null

  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...options.headers,
        },
        signal: AbortSignal.timeout(GOOGLE_OAUTH_CONFIG.timeout),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        if (response.status === 429) {
          const retryAfter = parseInt(
            response.headers.get("Retry-After") || "60",
            10
          )
          throw new RateLimitError(
            "Drive API rate limit exceeded",
            retryAfter * 1000
          )
        }

        throw new GoogleApiError(
          `Drive API error: ${errorData.error?.message || response.statusText}`,
          response.status,
          errorData.error?.code,
          response.status >= 500 || response.status === 429
        )
      }

      // Check if response is JSON or binary
      const contentType = response.headers.get("Content-Type") || ""
      if (contentType.includes("application/json")) {
        return response.json()
      }

      // For file content, return the response itself
      return response as unknown as T
    } catch (error) {
      lastError = error as Error

      if (
        error instanceof RateLimitError ||
        (error instanceof GoogleApiError && !error.retryable)
      ) {
        throw error
      }

      if (attempt < RETRY_CONFIG.maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, calculateRetryDelay(attempt))
        )
      }
    }
  }

  throw lastError || new Error("Drive API request failed after retries")
}

/**
 * Add rate limiting delay between requests
 */
async function rateLimitDelay(): Promise<void> {
  await new Promise((resolve) =>
    setTimeout(resolve, GOOGLE_RATE_LIMITS.drive.delayBetweenRequests)
  )
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Get file metadata
 */
export async function getFile(userId: string, fileId: string): Promise<DriveFile> {
  return driveRequest<DriveFile>(
    userId,
    `/files/${fileId}?fields=id,name,mimeType,modifiedTime,createdTime,size,webViewLink,webContentLink,iconLink,thumbnailLink,parents,owners`
  )
}

/**
 * List files in Drive (with optional query)
 */
export async function listFiles(
  userId: string,
  options: {
    query?: string
    pageSize?: number
    pageToken?: string
    orderBy?: string
  } = {}
): Promise<DriveFileList> {
  const params = new URLSearchParams({
    pageSize: String(options.pageSize || 20),
    fields:
      "files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,thumbnailLink),nextPageToken,kind,incompleteSearch",
  })

  if (options.query) {
    params.set("q", options.query)
  }

  if (options.pageToken) {
    params.set("pageToken", options.pageToken)
  }

  if (options.orderBy) {
    params.set("orderBy", options.orderBy)
  }

  return driveRequest<DriveFileList>(userId, `/files?${params.toString()}`)
}

/**
 * Download file content
 */
export async function downloadFile(
  userId: string,
  fileId: string,
  mimeType: string
): Promise<DriveFileContent> {
  // Check file size first
  const metadata = await getFile(userId, fileId)

  if (
    metadata.size &&
    parseInt(metadata.size, 10) > DRIVE_PROCESSING_CONFIG.maxFileSize
  ) {
    throw new Error(
      `File is too large. Maximum size is ${DRIVE_PROCESSING_CONFIG.maxFileSize / 1024 / 1024}MB.`
    )
  }

  if (!isSupportedMimeType(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`)
  }

  await rateLimitDelay()

  let downloadUrl: string
  let exportMimeType: string | null = null

  if (isGoogleWorkspaceType(mimeType)) {
    // Google Workspace files need to be exported
    exportMimeType = getExportFormat(mimeType)
    if (!exportMimeType) {
      throw new Error(`Cannot export file type: ${mimeType}`)
    }
    downloadUrl = `/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`
  } else {
    // Regular files can be downloaded directly
    downloadUrl = `/files/${fileId}?alt=media`
  }

  const response = await driveRequest<Response>(userId, downloadUrl)

  const content = await response.arrayBuffer()

  return {
    content: Buffer.from(content),
    mimeType: exportMimeType || mimeType,
    name: metadata.name,
    size: content.byteLength,
  }
}

/**
 * Extract text content from a file
 */
export async function extractTextContent(
  userId: string,
  fileId: string,
  mimeType: string
): Promise<string> {
  const file = await downloadFile(userId, fileId, mimeType)

  // For text-based formats, decode directly
  const textMimeTypes = [
    "text/plain",
    "text/csv",
    "text/markdown",
    "application/json",
  ]

  if (textMimeTypes.some((t) => file.mimeType.includes(t))) {
    if (Buffer.isBuffer(file.content)) {
      return file.content.toString("utf-8")
    }
    return file.content as string
  }

  // For PDFs and Office docs, we'd need additional processing
  // Return raw content for now (would need pdf-parse or similar)
  if (file.mimeType.includes("pdf")) {
    // TODO: Integrate with existing PDF processing pipeline
    return `[PDF content from ${file.name} - size: ${file.size} bytes]`
  }

  return Buffer.isBuffer(file.content)
    ? file.content.toString("utf-8")
    : String(file.content)
}

// ============================================================================
// DOCUMENT TRACKING
// ============================================================================

/**
 * Store document record in database
 */
export async function storeDocumentRecord(
  userId: string,
  file: DriveFile,
  ragDocumentId?: string
): Promise<void> {
  if (!isSupabaseEnabled) return

  const supabase = await createClient()
  if (!supabase) return

  try {
    // Using 'any' cast as table is not yet in generated types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("google_drive_documents").upsert(
      {
        user_id: userId,
        drive_file_id: file.id,
        drive_file_name: file.name,
        drive_mime_type: file.mimeType,
        drive_modified_time: file.modifiedTime || null,
        drive_web_view_link: file.webViewLink || null,
        rag_document_id: ragDocumentId || null,
        status: ragDocumentId ? "ready" : "pending",
        file_size: file.size ? parseInt(file.size, 10) : null,
        last_synced_at: new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: "user_id,drive_file_id" }
    )
  } catch (error) {
    console.error("[DriveClient] Failed to store document record:", error)
  }
}

/**
 * Update document status
 */
export async function updateDocumentStatus(
  userId: string,
  driveFileId: string,
  status: DriveProcessingStatus,
  errorMessage?: string
): Promise<void> {
  if (!isSupabaseEnabled) return

  const supabase = await createClient()
  if (!supabase) return

  try {
    // Using 'any' cast as table is not yet in generated types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("google_drive_documents")
      .update({
        status,
        error_message: errorMessage || null,
        last_checked_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("drive_file_id", driveFileId)
  } catch (error) {
    console.error("[DriveClient] Failed to update document status:", error)
  }
}

/**
 * Get user's indexed documents
 */
export async function getIndexedDocuments(
  userId: string
): Promise<
  Array<{
    id: string
    driveFileId: string
    name: string
    mimeType: string
    status: DriveProcessingStatus
    lastSynced: string
  }>
> {
  if (!isSupabaseEnabled) return []

  const supabase = await createClient()
  if (!supabase) return []

  try {
    // Using 'any' cast as table is not yet in generated types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("google_drive_documents")
      .select(
        "id, drive_file_id, drive_file_name, drive_mime_type, status, last_synced_at"
      )
      .eq("user_id", userId)
      .order("last_synced_at", { ascending: false })

    if (error || !data) return []

    return data.map(
      (doc: {
        id: string
        drive_file_id: string
        drive_file_name: string
        drive_mime_type: string
        status: DriveProcessingStatus
        last_synced_at: string
      }) => ({
        id: doc.id,
        driveFileId: doc.drive_file_id,
        name: doc.drive_file_name,
        mimeType: doc.drive_mime_type,
        status: doc.status,
        lastSynced: doc.last_synced_at,
      })
    )
  } catch (error) {
    console.error("[DriveClient] Failed to get indexed documents:", error)
    return []
  }
}

/**
 * Delete document record
 */
export async function deleteDocumentRecord(
  userId: string,
  driveFileId: string
): Promise<void> {
  if (!isSupabaseEnabled) return

  const supabase = await createClient()
  if (!supabase) return

  try {
    // Using 'any' cast as table is not yet in generated types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("google_drive_documents")
      .delete()
      .eq("user_id", userId)
      .eq("drive_file_id", driveFileId)
  } catch (error) {
    console.error("[DriveClient] Failed to delete document record:", error)
  }
}

/**
 * Get document count for user
 */
export async function getDocumentCount(userId: string): Promise<number> {
  if (!isSupabaseEnabled) return 0

  const supabase = await createClient()
  if (!supabase) return 0

  try {
    // Using 'any' cast as table is not yet in generated types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (supabase as any)
      .from("google_drive_documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)

    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}

/**
 * Check if user has reached document limit
 */
export async function hasReachedDocumentLimit(userId: string): Promise<boolean> {
  const count = await getDocumentCount(userId)
  return count >= DRIVE_PROCESSING_CONFIG.maxDocumentsPerUser
}
