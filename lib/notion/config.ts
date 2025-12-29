/**
 * Notion Integration Configuration
 *
 * OAuth endpoints, API settings, rate limits, and feature flags
 */

import { APP_DOMAIN } from "@/lib/config"

// ============================================================================
// OAUTH CONFIGURATION
// ============================================================================

export const NOTION_OAUTH_CONFIG = {
  // OAuth endpoints
  authUrl: "https://api.notion.com/v1/oauth/authorize",
  tokenUrl: "https://api.notion.com/v1/oauth/token",

  // API base URL
  apiBaseUrl: "https://api.notion.com/v1",

  // Required API version header
  apiVersion: "2022-06-28",

  // Request timeout
  timeout: 30000,

  // State expiry for CSRF protection (5 minutes)
  stateExpiry: 5 * 60 * 1000,
} as const

// ============================================================================
// PROCESSING CONFIGURATION
// ============================================================================

export const NOTION_PROCESSING_CONFIG = {
  // Supported block types for text extraction
  supportedBlockTypes: [
    "paragraph",
    "heading_1",
    "heading_2",
    "heading_3",
    "bulleted_list_item",
    "numbered_list_item",
    "toggle",
    "quote",
    "callout",
    "code",
    "table",
    "table_row",
    "divider",
    "to_do",
    "synced_block",
    "column_list",
    "column",
  ] as const,

  // Limits
  maxDocumentsPerUser: 100,
  maxBlocksPerPage: 1000, // Pagination limit per request
  maxDepth: 5, // Maximum nesting depth for recursive block fetching
  maxTextLength: 100000, // Maximum characters per document

  // Batch processing
  batchSize: 100,
} as const

// ============================================================================
// RATE LIMITING
// ============================================================================

export const NOTION_RATE_LIMITS = {
  // Notion API rate limit: 3 requests per second
  requestsPerSecond: 3,
  delayBetweenRequests: 350, // ms (slightly over 333ms for safety)
  maxRetriesOnRateLimit: 3,
  retryDelayBase: 1000, // ms
} as const

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const NOTION_INTEGRATION_CONFIG = {
  // Feature flag - can be disabled via environment variable
  enabled: process.env.NOTION_INTEGRATION_ENABLED !== "false",
} as const

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const NOTION_ERROR_MESSAGES = {
  notConfigured: "Notion integration is not configured. Please set NOTION_CLIENT_ID and NOTION_CLIENT_SECRET.",
  notConnected: "Notion account is not connected.",
  tokenRevoked: "Notion access was revoked. Please reconnect your account.",
  rateLimited: "Rate limit reached. Please wait and try again.",
  pageNotAccessible: "This page is not shared with the integration.",
  invalidState: "Invalid OAuth state. Please try again.",
  alreadyConnected: "Notion account is already connected.",
  documentLimitReached: "You have reached the maximum number of indexed documents.",
} as const

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if Notion integration is properly configured
 */
export function isNotionConfigured(): boolean {
  return !!(
    process.env.NOTION_CLIENT_ID &&
    process.env.NOTION_CLIENT_SECRET &&
    NOTION_INTEGRATION_CONFIG.enabled
  )
}

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(attempt: number): number {
  const baseDelay = NOTION_RATE_LIMITS.retryDelayBase
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  // Add jitter (0-30% of delay)
  const jitter = Math.random() * 0.3 * exponentialDelay
  return Math.min(exponentialDelay + jitter, 30000) // Cap at 30 seconds
}

/**
 * Get redirect URI for OAuth callback
 * Uses APP_DOMAIN for consistency with other integrations
 */
export function getNotionRedirectUri(): string {
  const isDev = process.env.NODE_ENV === "development"
  const baseUrl = isDev ? "http://localhost:3000" : APP_DOMAIN
  return `${baseUrl}/api/notion-integration/callback`
}
