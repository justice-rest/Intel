/**
 * Notion Integration Module
 *
 * Main exports for Notion OAuth, API client, and utilities
 */

// Configuration
export {
  NOTION_OAUTH_CONFIG,
  NOTION_PROCESSING_CONFIG,
  NOTION_RATE_LIMITS,
  NOTION_INTEGRATION_CONFIG,
  NOTION_ERROR_MESSAGES,
  isNotionConfigured,
  calculateRetryDelay,
  getNotionRedirectUri,
} from "./config"

// Types
export type {
  NotionOAuthTokens,
  NotionOAuthTokensEncrypted,
  NotionConnectionStatus,
  NotionTokenResponse,
  NotionOwner,
  NotionIntegrationStatus,
  NotionPage,
  NotionDatabase,
  NotionSearchResult,
  NotionSearchResponse,
  NotionBlockType,
  NotionBlock,
  NotionBlocksResponse,
  NotionRichText,
  NotionMention,
  NotionPartialUser,
  NotionParent,
  NotionIcon,
  NotionFile,
  NotionDate,
  NotionProperty,
  NotionDatabaseProperty,
  NotionDocumentStatus,
  NotionDocument,
} from "./types"

export { NotionApiError, NotionTokenError } from "./types"

// OAuth Token Manager
export {
  storeToken,
  getToken,
  deleteToken,
  updateTokenStatus,
  getValidAccessToken,
  exchangeCodeForToken,
  getIntegrationStatus,
  isConnected,
} from "./oauth/token-manager"

// OAuth State Manager (CSRF protection)
export {
  generateOAuthState,
  validateOAuthState,
  deleteOAuthState,
  buildAuthorizationUrl,
} from "./oauth/state-manager"

// API Client
export {
  searchPages,
  getAllPages,
  getPage,
  getDatabase,
  getBlocks,
  getAllBlocks,
  getPageTitle,
  getDatabaseTitle,
  getIconString,
} from "./api/client"

// Content Extractor
export {
  extractRichText,
  blockToText,
  extractTextFromBlocks,
  extractPageContent,
  extractDatabaseContent,
  countWords,
  generateContentHash,
  truncateContent,
} from "./api/content-extractor"
