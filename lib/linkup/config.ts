/**
 * LinkUp Search Configuration
 *
 * Centralized configuration for LinkUp API integration.
 * Controls feature flags, pricing, and default settings.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface LinkUpConfig {
  /** API key (from LINKUP_API_KEY env var) */
  apiKey: string
  /** Base URL for API (for testing) */
  baseURL?: string
  /** Request timeout in ms */
  timeout: number
  /** Max retries for transient failures */
  maxRetries: number
}

export interface LinkUpFeatureFlags {
  /** Master switch - enables LinkUp integration */
  LINKUP_ENABLED: boolean
  /** Use LinkUp for chat prospect research */
  LINKUP_CHAT_SEARCH: boolean
  /** Use LinkUp for batch processing */
  LINKUP_BATCH_SEARCH: boolean
  /** Use structured output for typed JSON */
  LINKUP_STRUCTURED_OUTPUT: boolean
}

// ============================================================================
// PRICING (as of December 2024)
// ============================================================================

/**
 * LinkUp pricing per request
 * @see https://linkup.so/pricing
 */
export const LINKUP_PRICING = {
  /** Standard depth search */
  standard: 0.005,
  /** Deep search (more comprehensive) */
  deep: 0.02,
  /** Fetch single URL */
  fetch: 0.001,
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_CONFIG: Omit<LinkUpConfig, "apiKey"> = {
  timeout: 60000, // 60 seconds for deep research
  maxRetries: 2,
}

export const DEFAULT_FLAGS: LinkUpFeatureFlags = {
  LINKUP_ENABLED: false,
  LINKUP_CHAT_SEARCH: true,
  LINKUP_BATCH_SEARCH: true,
  LINKUP_STRUCTURED_OUTPUT: true,
}

// ============================================================================
// DOMAIN CONFIGURATION
// ============================================================================

/**
 * High-quality domains to prioritize for prospect research
 * These sources provide verified, authoritative data
 */
export const PRIORITY_DOMAINS = [
  // Government sources (most authoritative)
  "sec.gov",
  "fec.gov",
  "propublica.org",
  "congress.gov",
  "usaspending.gov",
  // Property records
  "zillow.com",
  "redfin.com",
  "realtor.com",
  // Business data
  "linkedin.com",
  "bloomberg.com",
  "forbes.com",
  "crunchbase.com",
  "pitchbook.com",
  // Nonprofit data
  "guidestar.org",
  "charitynavigator.org",
  "foundationcenter.org",
  // News (for verification)
  "wsj.com",
  "nytimes.com",
  "reuters.com",
]

/**
 * Low-quality domains to exclude
 * Social media, user-generated content, etc.
 */
export const BLOCKED_DOMAINS = [
  "pinterest.com",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "reddit.com",
  "quora.com",
  "yelp.com",
  "yellowpages.com",
  "whitepages.com",
]

// ============================================================================
// FEATURE FLAG FUNCTIONS
// ============================================================================

/**
 * Get current feature flags from environment variables
 */
export function getLinkUpFlags(): LinkUpFeatureFlags {
  const isEnabled = process.env.LINKUP_API_KEY && process.env.LINKUP_ENABLED !== "false"

  return {
    LINKUP_ENABLED: !!isEnabled,
    LINKUP_CHAT_SEARCH:
      process.env.LINKUP_CHAT_SEARCH !== "false" && !!isEnabled,
    LINKUP_BATCH_SEARCH:
      process.env.LINKUP_BATCH_SEARCH !== "false" && !!isEnabled,
    LINKUP_STRUCTURED_OUTPUT:
      process.env.LINKUP_STRUCTURED_OUTPUT !== "false" && !!isEnabled,
  }
}

/**
 * Check if LinkUp API key is configured
 */
export function isLinkUpConfigured(): boolean {
  return !!process.env.LINKUP_API_KEY
}

/**
 * Check if LinkUp is fully available (enabled + configured)
 */
export function isLinkUpAvailable(): boolean {
  return isLinkUpConfigured() && getLinkUpFlags().LINKUP_ENABLED
}

/**
 * Get full config from environment
 */
export function getLinkUpConfig(): LinkUpConfig | null {
  const apiKey = process.env.LINKUP_API_KEY
  if (!apiKey) return null

  return {
    apiKey,
    baseURL: process.env.LINKUP_BASE_URL,
    timeout: parseInt(process.env.LINKUP_TIMEOUT || "60000", 10),
    maxRetries: parseInt(process.env.LINKUP_MAX_RETRIES || "2", 10),
  }
}
