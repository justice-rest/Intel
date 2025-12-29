/**
 * OneDrive OAuth and API Configuration
 *
 * Microsoft OAuth 2.0 configuration for OneDrive access via Microsoft Graph API.
 * Uses standard OAuth 2.0 authorization code flow with PKCE recommended.
 */

// OAuth configuration
export const ONEDRIVE_OAUTH_CONFIG = {
  // Microsoft identity platform v2.0 endpoints
  authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",

  // Microsoft Graph API
  graphBaseUrl: "https://graph.microsoft.com/v1.0",

  // OAuth scopes for OneDrive access
  // - Files.Read: Read user's files
  // - Files.Read.All: Read all files user can access
  // - User.Read: Read user's basic profile (name, email)
  // - offline_access: Required for refresh tokens
  scopes: ["Files.Read", "Files.Read.All", "User.Read", "offline_access"],

  // State expiry for CSRF protection (5 minutes)
  stateExpiry: 5 * 60 * 1000,

  // Request timeout (30 seconds)
  timeout: 30000,
} as const

// Rate limiting configuration
// Microsoft Graph API limits: 10,000 requests per 10 minutes per app
export const ONEDRIVE_RATE_LIMITS = {
  requestsPerMinute: 1000, // Conservative limit
  requestsPerSecond: 20,
  retryAfterDefault: 1000, // 1 second default retry
  maxRetries: 3,
} as const

// File processing configuration
export const ONEDRIVE_PROCESSING_CONFIG = {
  // Maximum file size to process (50MB)
  maxFileSizeBytes: 50 * 1024 * 1024,

  // Maximum documents per user
  maxDocumentsPerUser: 100,

  // Supported MIME types for processing
  supportedMimeTypes: [
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
    // Text files
    "text/plain",
    "text/markdown",
    "text/csv",
    "text/tab-separated-values",
    "application/json",
    // Rich text
    "application/rtf",
  ],

  // Chunk size for reading large files (1MB)
  chunkSizeBytes: 1024 * 1024,
} as const

// Error messages
export const ONEDRIVE_ERROR_MESSAGES = {
  notConfigured: "OneDrive integration is not configured. Please contact your administrator.",
  notConnected: "OneDrive is not connected. Please connect your Microsoft account first.",
  alreadyConnected: "OneDrive is already connected to this account.",
  tokenExpired: "Your OneDrive session has expired. Please reconnect.",
  invalidState: "Invalid OAuth state. Please try connecting again.",
  authFailed: "Failed to authenticate with Microsoft. Please try again.",
  accessDenied: "Access was denied. Please ensure you granted the required permissions.",
  rateLimited: "Too many requests. Please try again later.",
  fileTooLarge: `File is too large. Maximum size is ${ONEDRIVE_PROCESSING_CONFIG.maxFileSizeBytes / (1024 * 1024)}MB.`,
  unsupportedType: "This file type is not supported for import.",
  documentLimitReached: `You have reached the maximum of ${ONEDRIVE_PROCESSING_CONFIG.maxDocumentsPerUser} documents.`,
} as const

/**
 * Check if OneDrive integration is configured
 */
export function isOneDriveConfigured(): boolean {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  )
}

/**
 * Get Microsoft OAuth client ID
 */
export function getOneDriveClientId(): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  if (!clientId) {
    throw new Error("MICROSOFT_CLIENT_ID is not configured")
  }
  return clientId
}

/**
 * Get Microsoft OAuth client secret
 */
export function getOneDriveClientSecret(): string {
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  if (!clientSecret) {
    throw new Error("MICROSOFT_CLIENT_SECRET is not configured")
  }
  return clientSecret
}

/**
 * Get OneDrive redirect URI
 */
export function getOneDriveRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_VERCEL_URL
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_VERCEL_URL is not configured")
  }
  const protocol = appUrl.includes("localhost") ? "http" : "https"
  const cleanUrl = appUrl.replace(/^https?:\/\//, "")
  return `${protocol}://${cleanUrl}/api/onedrive-integration/callback`
}
