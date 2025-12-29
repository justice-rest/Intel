/**
 * OneDrive Integration Module
 *
 * Exports all OneDrive-related functionality for Microsoft Graph API integration.
 */

// Configuration
export {
  ONEDRIVE_OAUTH_CONFIG,
  ONEDRIVE_RATE_LIMITS,
  ONEDRIVE_PROCESSING_CONFIG,
  ONEDRIVE_ERROR_MESSAGES,
  isOneDriveConfigured,
  getOneDriveClientId,
  getOneDriveClientSecret,
  getOneDriveRedirectUri,
} from "./config"

// Types
export type {
  OneDriveTokenResponse,
  OneDriveStoredToken,
  OneDriveDecryptedToken,
  MicrosoftUser,
  DriveItem,
  DriveItemList,
  DriveSearchResult,
  OneDriveIntegrationStatus,
  OneDriveDocument,
  OneDriveFileForImport,
} from "./types"

export { OneDriveApiError, OneDriveTokenError } from "./types"

// OAuth Token Manager
export {
  storeToken,
  getToken,
  deleteToken,
  updateTokenStatus,
  refreshAccessToken,
  getValidAccessToken,
  getUserInfoFromToken,
  exchangeCodeForToken,
  isConnected,
  getIntegrationStatus,
} from "./oauth/token-manager"

// OAuth State Manager
export {
  generateOAuthState,
  validateOAuthState,
  buildAuthorizationUrl,
  cleanupExpiredStates,
} from "./oauth/state-manager"

// API Client
export {
  listFiles,
  searchFiles,
  getFile,
  downloadFile,
  getAllFiles,
  getFilePath,
  isSupportedFileType,
} from "./api/client"
