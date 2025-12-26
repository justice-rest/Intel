/**
 * Google Integration Configuration
 * OAuth scopes, API endpoints, rate limits, and feature flags
 */

import { APP_DOMAIN } from "@/lib/config"

// ============================================================================
// FEATURE FLAGS & ROLLOUT
// ============================================================================

export const GOOGLE_INTEGRATION_CONFIG = {
  // Master feature flag
  enabled: process.env.GOOGLE_INTEGRATION_ENABLED === "true",

  // Individual feature flags
  gmailEnabled: process.env.GMAIL_ENABLED !== "false",
  driveEnabled: process.env.DRIVE_ENABLED !== "false",
  styleAnalysisEnabled: process.env.STYLE_ANALYSIS_ENABLED !== "false",

  // Gradual rollout percentage (0-100)
  rolloutPercentage: parseInt(process.env.GOOGLE_ROLLOUT_PCT || "100", 10),
} as const

/**
 * Check if Google integration is configured
 */
export function isGoogleIntegrationEnabled(): boolean {
  return Boolean(
    GOOGLE_INTEGRATION_CONFIG.enabled &&
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET
  )
}

/**
 * Check if a user is in the rollout based on their ID
 */
export function isUserInRollout(userId: string): boolean {
  if (GOOGLE_INTEGRATION_CONFIG.rolloutPercentage >= 100) return true
  if (GOOGLE_INTEGRATION_CONFIG.rolloutPercentage <= 0) return false

  // Simple hash-based rollout
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  const percentage = Math.abs(hash % 100)
  return percentage < GOOGLE_INTEGRATION_CONFIG.rolloutPercentage
}

// ============================================================================
// OAUTH CONFIGURATION
// ============================================================================

export const GOOGLE_OAUTH_CONFIG = {
  // OAuth endpoints
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  revokeUrl: "https://oauth2.googleapis.com/revoke",
  userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",

  // API base URLs
  gmailApiUrl: "https://gmail.googleapis.com/gmail/v1",
  driveApiUrl: "https://www.googleapis.com/drive/v3",

  // Token refresh buffer (refresh 5 minutes before expiry)
  refreshBuffer: 5 * 60 * 1000,

  // Request timeout (30 seconds)
  timeout: 30000,

  // OAuth state expiry (5 minutes)
  stateExpiry: 5 * 60 * 1000,
} as const

/**
 * Get the OAuth callback URL
 */
export function getGoogleCallbackUrl(): string {
  const isDev = process.env.NODE_ENV === "development"
  const baseUrl = isDev ? "http://localhost:3000" : APP_DOMAIN
  return `${baseUrl}/api/google-integrations/callback`
}

// ============================================================================
// OAUTH SCOPES - MINIMAL PERMISSIONS
// ============================================================================

export const GOOGLE_SCOPES = {
  // Gmail scopes (Restricted - requires Google verification)
  gmail: {
    // Read emails - needed for inbox reading and style analysis
    readonly: "https://www.googleapis.com/auth/gmail.readonly",
    // Create/update drafts - NO send capability!
    compose: "https://www.googleapis.com/auth/gmail.compose",
    // Note: We deliberately do NOT include gmail.send
  },

  // Drive scopes
  drive: {
    // Per-file access via picker (Recommended, not Restricted)
    file: "https://www.googleapis.com/auth/drive.file",
    // Full read-only access (Restricted - alternative if needed)
    readonly: "https://www.googleapis.com/auth/drive.readonly",
  },

  // User info (for email/name)
  profile: {
    email: "https://www.googleapis.com/auth/userinfo.email",
  },
} as const

// Default scopes for Gmail integration
export const DEFAULT_GMAIL_SCOPES = [
  GOOGLE_SCOPES.gmail.readonly,
  GOOGLE_SCOPES.gmail.compose,
  GOOGLE_SCOPES.profile.email,
]

// Default scopes for Drive integration
export const DEFAULT_DRIVE_SCOPES = [
  GOOGLE_SCOPES.drive.file,
  GOOGLE_SCOPES.profile.email,
]

// Combined scopes for full integration
export const ALL_GOOGLE_SCOPES = [
  GOOGLE_SCOPES.gmail.readonly,
  GOOGLE_SCOPES.gmail.compose,
  GOOGLE_SCOPES.drive.file,
  GOOGLE_SCOPES.profile.email,
]

/**
 * Check if scopes include Gmail access
 */
export function hasGmailScope(scopes: string[]): boolean {
  return scopes.some((s) => s.includes("gmail"))
}

/**
 * Check if scopes include Drive access
 */
export function hasDriveScope(scopes: string[]): boolean {
  return scopes.some((s) => s.includes("drive"))
}

// ============================================================================
// RATE LIMITS
// ============================================================================

export const GOOGLE_RATE_LIMITS = {
  gmail: {
    // Gmail API quota: 1 billion units/day
    // drafts.create = 10 units, messages.get = 5 units
    maxDraftsPerHour: 100,
    maxMessagesPerRequest: 50,
    delayBetweenRequests: 100, // ms
    maxRetriesOnRateLimit: 3,
  },
  drive: {
    // Drive API: 12,000 queries/minute
    maxFilesPerRequest: 100,
    maxDownloadsPerHour: 50,
    delayBetweenRequests: 50, // ms
    maxRetriesOnRateLimit: 3,
  },
} as const

// ============================================================================
// GMAIL CONFIGURATION
// ============================================================================

export const GMAIL_CONFIG = {
  // Inbox fetching
  defaultInboxCount: 20,
  maxInboxCount: 50,

  // Thread fetching
  maxThreadMessages: 100,

  // Draft creation
  maxDraftsPerHour: 100,
  maxRecipientsPerDraft: 100,
  maxSubjectLength: 1000,
  maxBodyLength: 100000, // 100KB

  // Style analysis
  emailsToAnalyzeForStyle: 50,
  minEmailsForStyleAnalysis: 10,
  styleAnalysisModel: "openai/gpt-4o-mini", // Cheap model for extraction
  sampleSentencesToKeep: 10,
  signaturePhrasesToKeep: 10,
} as const

// ============================================================================
// DRIVE CONFIGURATION
// ============================================================================

export const DRIVE_PROCESSING_CONFIG = {
  // Supported MIME types for indexing
  supportedMimeTypes: [
    "application/pdf",
    "application/vnd.google-apps.document", // Google Docs
    "application/vnd.google-apps.spreadsheet", // Google Sheets
    "text/plain",
    "text/csv",
    "text/markdown",
    "application/json",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  ] as const,

  // Export formats for Google Workspace files
  exportFormats: {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
  } as const,

  // Max file size for processing (50MB)
  maxFileSize: 50 * 1024 * 1024,

  // Daily processing limit
  dailyProcessingLimit: 20,

  // Max documents per user
  maxDocumentsPerUser: 100,
} as const

/**
 * Check if a MIME type is supported for processing
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return (
    DRIVE_PROCESSING_CONFIG.supportedMimeTypes as readonly string[]
  ).includes(mimeType)
}

/**
 * Get export format for Google Workspace file
 */
export function getExportFormat(mimeType: string): string | null {
  return (
    DRIVE_PROCESSING_CONFIG.exportFormats[
      mimeType as keyof typeof DRIVE_PROCESSING_CONFIG.exportFormats
    ] || null
  )
}

/**
 * Check if MIME type is a Google Workspace type (needs export)
 */
export function isGoogleWorkspaceType(mimeType: string): boolean {
  return mimeType.startsWith("application/vnd.google-apps")
}

// ============================================================================
// CIRCUIT BREAKER CONFIGURATION
// ============================================================================

export const CIRCUIT_BREAKER_CONFIG = {
  // Number of failures before circuit opens
  failureThreshold: 5,

  // Time before attempting to close circuit (ms)
  recoveryTimeout: 60000, // 1 minute

  // Time window for counting failures (ms)
  failureWindow: 60000, // 1 minute
} as const

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

export const RETRY_CONFIG = {
  // Maximum retries for API calls
  maxRetries: 3,

  // Base delay for exponential backoff (ms)
  baseDelay: 1000,

  // Maximum delay (ms)
  maxDelay: 10000,

  // Jitter factor (0-1)
  jitterFactor: 0.2,
} as const

/**
 * Calculate retry delay with exponential backoff and jitter
 */
export function calculateRetryDelay(attempt: number): number {
  const exponentialDelay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
    RETRY_CONFIG.maxDelay
  )
  const jitter = exponentialDelay * RETRY_CONFIG.jitterFactor * Math.random()
  return exponentialDelay + jitter
}

// ============================================================================
// WRITING STYLE ANALYSIS CONFIGURATION
// ============================================================================

export const STYLE_ANALYSIS_CONFIG = {
  // Number of sent emails to analyze
  emailsToAnalyze: 50,

  // Minimum emails required for analysis
  minEmails: 10,

  // Model for style extraction (cheap, fast)
  model: "openai/gpt-4o-mini",

  // Number of sample sentences to keep
  sampleSentences: 10,

  // Number of signature phrases to keep
  signaturePhrases: 10,

  // Common greetings to look for
  commonGreetings: [
    "Hi",
    "Hello",
    "Hey",
    "Dear",
    "Good morning",
    "Good afternoon",
    "Good evening",
    "Greetings",
  ],

  // Common closings to look for
  commonClosings: [
    "Best",
    "Best regards",
    "Thanks",
    "Thank you",
    "Cheers",
    "Regards",
    "Sincerely",
    "Warm regards",
    "Kind regards",
    "Talk soon",
  ],
} as const

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const GOOGLE_ERROR_MESSAGES = {
  notConfigured: "Google integration is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment.",
  notConnected: "Google account is not connected. Please connect your Google account in Settings.",
  tokenExpired: "Google access has expired. Please reconnect your account.",
  tokenRevoked: "Google access was revoked. Please reconnect your account.",
  rateLimited: "Rate limit reached. Please wait a moment and try again.",
  quotaExceeded: "Daily quota exceeded. Please try again tomorrow.",
  fileTooLarge: `File is too large. Maximum size is ${DRIVE_PROCESSING_CONFIG.maxFileSize / 1024 / 1024}MB.`,
  unsupportedType: "This file type is not supported for processing.",
  circuitOpen: "Google API is temporarily unavailable. Please try again later.",
  networkError: "Network error connecting to Google. Please check your connection.",
} as const
