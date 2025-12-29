/**
 * OneDrive API Client
 *
 * Microsoft Graph API client for OneDrive file operations.
 * Handles file listing, searching, and downloading.
 */

import {
  ONEDRIVE_OAUTH_CONFIG,
  ONEDRIVE_RATE_LIMITS,
  ONEDRIVE_PROCESSING_CONFIG,
} from "../config"
import type {
  DriveItem,
  DriveItemList,
  DriveSearchResult,
} from "../types"
import { OneDriveApiError } from "../types"

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate retry delay with exponential backoff
 */
function calculateRetryDelay(attempt: number, retryAfter?: number): number {
  if (retryAfter) {
    return retryAfter * 1000
  }
  return Math.min(
    ONEDRIVE_RATE_LIMITS.retryAfterDefault * Math.pow(2, attempt),
    30000 // Max 30 seconds
  )
}

/**
 * Make a request to Microsoft Graph API with retry logic
 */
async function graphRequest<T>(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${ONEDRIVE_OAUTH_CONFIG.graphBaseUrl}${endpoint}`

  let lastError: Error | null = null

  for (let attempt = 0; attempt < ONEDRIVE_RATE_LIMITS.maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
        signal: AbortSignal.timeout(ONEDRIVE_OAUTH_CONFIG.timeout),
      })

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "1", 10)
        await new Promise((resolve) =>
          setTimeout(resolve, calculateRetryDelay(attempt, retryAfter))
        )
        continue
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new OneDriveApiError(
          errorData.error?.message || `Graph API error: ${response.statusText}`,
          response.status,
          errorData.error?.code
        )
      }

      return await response.json()
    } catch (error) {
      lastError = error as Error

      // Don't retry on 4xx errors (except 429 which is handled above)
      if (error instanceof OneDriveApiError && error.statusCode >= 400 && error.statusCode < 500) {
        throw error
      }

      // Wait before retry
      if (attempt < ONEDRIVE_RATE_LIMITS.maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, calculateRetryDelay(attempt))
        )
      }
    }
  }

  throw lastError || new Error("Graph API request failed after retries")
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * List files in user's OneDrive root or a specific folder
 * Returns files that can be processed (supported MIME types)
 */
export async function listFiles(
  accessToken: string,
  options: {
    folderId?: string
    pageSize?: number
    nextLink?: string
  } = {}
): Promise<DriveItemList> {
  const { folderId, pageSize = 50, nextLink } = options

  // If we have a nextLink, use it directly
  if (nextLink) {
    return graphRequest<DriveItemList>(accessToken, nextLink)
  }

  // Build the endpoint
  let endpoint: string
  if (folderId) {
    endpoint = `/me/drive/items/${folderId}/children`
  } else {
    endpoint = `/me/drive/root/children`
  }

  // Add query parameters
  const params = new URLSearchParams({
    $top: pageSize.toString(),
    $select: "id,name,size,createdDateTime,lastModifiedDateTime,webUrl,parentReference,file,folder",
    $orderby: "lastModifiedDateTime desc",
  })

  const result = await graphRequest<DriveItemList>(
    accessToken,
    `${endpoint}?${params.toString()}`
  )

  // Filter to only supported file types
  const supportedTypes = ONEDRIVE_PROCESSING_CONFIG.supportedMimeTypes as readonly string[]
  result.value = result.value.filter((item) => {
    // Include folders for navigation
    if (item.folder) return true
    // Include files with supported MIME types
    return item.file && supportedTypes.includes(item.file.mimeType)
  })

  return result
}

/**
 * Search for files in user's OneDrive
 */
export async function searchFiles(
  accessToken: string,
  query: string,
  options: {
    pageSize?: number
    nextLink?: string
  } = {}
): Promise<DriveSearchResult> {
  const { pageSize = 25, nextLink } = options

  // If we have a nextLink, use it directly
  if (nextLink) {
    return graphRequest<DriveSearchResult>(accessToken, nextLink)
  }

  // Microsoft Graph search endpoint
  const params = new URLSearchParams({
    $top: pageSize.toString(),
    $select: "id,name,size,createdDateTime,lastModifiedDateTime,webUrl,parentReference,file,folder",
  })

  const result = await graphRequest<DriveSearchResult>(
    accessToken,
    `/me/drive/root/search(q='${encodeURIComponent(query)}')?${params.toString()}`
  )

  // Filter to only supported file types
  const supportedTypes = ONEDRIVE_PROCESSING_CONFIG.supportedMimeTypes as readonly string[]
  result.value = result.value.filter((item) => {
    // Include files with supported MIME types
    return item.file && supportedTypes.includes(item.file.mimeType)
  })

  return result
}

/**
 * Get a specific file's metadata
 */
export async function getFile(
  accessToken: string,
  fileId: string
): Promise<DriveItem> {
  return graphRequest<DriveItem>(
    accessToken,
    `/me/drive/items/${fileId}?$select=id,name,size,createdDateTime,lastModifiedDateTime,webUrl,parentReference,file,@microsoft.graph.downloadUrl`
  )
}

/**
 * Download file content
 * Returns the raw file content as ArrayBuffer
 */
export async function downloadFile(
  accessToken: string,
  fileId: string
): Promise<ArrayBuffer> {
  // Get file metadata with download URL
  const file = await getFile(accessToken, fileId)

  // Check file size
  if (file.size && file.size > ONEDRIVE_PROCESSING_CONFIG.maxFileSizeBytes) {
    throw new OneDriveApiError(
      `File is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is ${ONEDRIVE_PROCESSING_CONFIG.maxFileSizeBytes / 1024 / 1024}MB.`,
      413,
      "file_too_large"
    )
  }

  // Use the download URL from the file metadata
  const downloadUrl = file["@microsoft.graph.downloadUrl"]
  if (!downloadUrl) {
    // Fallback to content endpoint
    const response = await fetch(
      `${ONEDRIVE_OAUTH_CONFIG.graphBaseUrl}/me/drive/items/${fileId}/content`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(ONEDRIVE_OAUTH_CONFIG.timeout * 2), // Longer timeout for downloads
      }
    )

    if (!response.ok) {
      throw new OneDriveApiError(
        `Failed to download file: ${response.statusText}`,
        response.status
      )
    }

    return response.arrayBuffer()
  }

  // Download from the pre-authenticated URL
  const response = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(ONEDRIVE_OAUTH_CONFIG.timeout * 2),
  })

  if (!response.ok) {
    throw new OneDriveApiError(
      `Failed to download file: ${response.statusText}`,
      response.status
    )
  }

  return response.arrayBuffer()
}

/**
 * Get all files matching the filter, handling pagination
 */
export async function getAllFiles(
  accessToken: string,
  options: {
    folderId?: string
    maxFiles?: number
  } = {}
): Promise<DriveItem[]> {
  const { folderId, maxFiles = 100 } = options
  const allFiles: DriveItem[] = []
  let nextLink: string | undefined

  do {
    const result = await listFiles(accessToken, {
      folderId,
      nextLink,
      pageSize: Math.min(50, maxFiles - allFiles.length),
    })

    allFiles.push(...result.value)
    nextLink = result["@odata.nextLink"]
  } while (nextLink && allFiles.length < maxFiles)

  return allFiles.slice(0, maxFiles)
}

/**
 * Get file path from parentReference
 */
export function getFilePath(item: DriveItem): string {
  if (!item.parentReference?.path) {
    return `/${item.name}`
  }
  // Remove the /drive/root: prefix
  const path = item.parentReference.path.replace(/^\/drive\/root:/, "")
  return `${path}/${item.name}`
}

/**
 * Check if a file type is supported for processing
 */
export function isSupportedFileType(mimeType: string): boolean {
  const supportedTypes = ONEDRIVE_PROCESSING_CONFIG.supportedMimeTypes as readonly string[]
  return supportedTypes.includes(mimeType)
}
