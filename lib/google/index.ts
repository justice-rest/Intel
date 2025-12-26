/**
 * Google Integration Module
 * Barrel export for Gmail and Google Drive integrations
 */

// Types
export * from "./types"

// Configuration
export {
  GOOGLE_INTEGRATION_CONFIG,
  isGoogleIntegrationEnabled,
  isUserInRollout,
  GOOGLE_OAUTH_CONFIG,
  getGoogleCallbackUrl,
  GOOGLE_SCOPES,
  DEFAULT_GMAIL_SCOPES,
  DEFAULT_DRIVE_SCOPES,
  ALL_GOOGLE_SCOPES,
  hasGmailScope,
  hasDriveScope,
  GOOGLE_RATE_LIMITS,
  GMAIL_CONFIG,
  DRIVE_PROCESSING_CONFIG,
  isSupportedMimeType,
  getExportFormat,
  isGoogleWorkspaceType,
  CIRCUIT_BREAKER_CONFIG,
  RETRY_CONFIG,
  calculateRetryDelay,
  STYLE_ANALYSIS_CONFIG,
  GOOGLE_ERROR_MESSAGES,
} from "./config"

// OAuth Token Management
export {
  storeTokens,
  getTokens,
  deleteTokens,
  updateTokenStatus,
  refreshAccessToken,
  getValidAccessToken,
  getUserInfoFromToken,
  exchangeCodeForTokens,
  revokeTokens,
  getIntegrationStatus,
  hasScope,
  hasGmailAccess,
  hasDriveAccess,
} from "./oauth/token-manager"

// Gmail Client
export {
  getInbox,
  getSentEmails,
  getThread,
  getMessage,
  createDraft,
  updateDraft,
  deleteDraft,
  getDraft,
  listDrafts,
  getProfile,
  searchEmails,
  getUnreadCount,
} from "./gmail/client"

// Gmail Style Analysis
export {
  analyzeWritingStyle,
  getWritingStyleProfile,
  buildStylePrompt,
} from "./gmail/style-analyzer"

// Drive Client
export {
  getFile,
  listFiles,
  downloadFile,
  extractTextContent,
  storeDocumentRecord,
  updateDocumentStatus,
  getIndexedDocuments,
  deleteDocumentRecord,
  getDocumentCount,
  hasReachedDocumentLimit,
} from "./drive/client"

// OAuth State Management
export {
  storeOAuthState,
  retrieveOAuthState,
} from "./oauth/state-manager"
