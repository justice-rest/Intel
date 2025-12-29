/**
 * OneDrive TypeScript Type Definitions
 *
 * Types for Microsoft Graph API OneDrive integration.
 */

/**
 * OneDrive OAuth token response from Microsoft
 */
export interface OneDriveTokenResponse {
  access_token: string
  refresh_token: string
  token_type: "Bearer"
  expires_in: number // seconds until expiry
  scope: string // space-separated scopes
  ext_expires_in?: number // extended expiry for cached tokens
}

/**
 * Stored OneDrive OAuth token (encrypted)
 */
export interface OneDriveStoredToken {
  id: string
  user_id: string
  access_token_encrypted: string
  access_token_iv: string
  refresh_token_encrypted: string
  refresh_token_iv: string
  expires_at: string // ISO timestamp
  scopes: string[]
  microsoft_id: string
  microsoft_email: string
  display_name?: string
  status: "active" | "expired" | "revoked" | "error"
  error_message?: string
  delta_link?: string // for incremental sync
  created_at: string
  updated_at: string
}

/**
 * Decrypted OneDrive token for API calls
 */
export interface OneDriveDecryptedToken {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scopes: string[]
  microsoftId: string
  microsoftEmail: string
  displayName?: string
}

/**
 * Microsoft Graph user profile
 */
export interface MicrosoftUser {
  id: string
  displayName: string
  mail?: string
  userPrincipalName: string
  givenName?: string
  surname?: string
  jobTitle?: string
  officeLocation?: string
  businessPhones?: string[]
  mobilePhone?: string
}

/**
 * OneDrive item (file or folder)
 */
export interface DriveItem {
  id: string
  name: string
  size?: number
  createdDateTime: string
  lastModifiedDateTime: string
  webUrl: string

  // Parent reference
  parentReference?: {
    driveId: string
    driveType: string
    id: string
    path?: string
  }

  // File-specific properties (if it's a file)
  file?: {
    mimeType: string
    hashes?: {
      quickXorHash?: string
      sha1Hash?: string
      sha256Hash?: string
    }
  }

  // Folder-specific properties (if it's a folder)
  folder?: {
    childCount: number
  }

  // Download URL (available for files)
  "@microsoft.graph.downloadUrl"?: string

  // Thumbnails (optional)
  thumbnails?: Array<{
    id: string
    small?: { url: string; width: number; height: number }
    medium?: { url: string; width: number; height: number }
    large?: { url: string; width: number; height: number }
  }>
}

/**
 * OneDrive list response with pagination
 */
export interface DriveItemList {
  value: DriveItem[]
  "@odata.nextLink"?: string // URL for next page
  "@odata.deltaLink"?: string // URL for delta sync
}

/**
 * OneDrive search result
 */
export interface DriveSearchResult {
  value: DriveItem[]
  "@odata.nextLink"?: string
}

/**
 * OneDrive integration status
 */
export interface OneDriveIntegrationStatus {
  connected: boolean
  status: "active" | "disconnected" | "expired" | "error" | "revoked"
  microsoftEmail?: string
  displayName?: string
  indexedFiles: number
  processingFiles: number
  errorMessage?: string
  configured: boolean
}

/**
 * OneDrive document (stored in database)
 */
export interface OneDriveDocument {
  id: string
  user_id: string
  onedrive_item_id: string
  onedrive_file_name: string
  onedrive_file_path?: string
  onedrive_mime_type: string
  onedrive_web_url?: string
  onedrive_last_modified_time?: string
  rag_document_id?: string
  status: "pending" | "processing" | "ready" | "failed" | "needs_reindex"
  error_message?: string
  file_size?: number
  word_count?: number
  content_hash?: string
  last_synced_at?: string
  created_at: string
  updated_at: string
}

/**
 * File for import selection
 */
export interface OneDriveFileForImport {
  id: string
  name: string
  mimeType: string
  size: number
  path?: string
  webUrl: string
  lastModifiedTime: string
  indexed: boolean
  indexStatus: string | null
}

/**
 * Custom error class for OneDrive API errors
 */
export class OneDriveApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string
  ) {
    super(message)
    this.name = "OneDriveApiError"
  }
}

/**
 * Custom error class for OneDrive token errors
 */
export class OneDriveTokenError extends Error {
  constructor(
    message: string,
    public reason: "expired" | "revoked" | "invalid" | "not_found"
  ) {
    super(message)
    this.name = "OneDriveTokenError"
  }
}
