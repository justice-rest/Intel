/**
 * LinkUp Search Configuration
 *
 * Centralized configuration for LinkUp API integration.
 * LinkUp is the ONLY web search provider - no fallbacks.
 * If LINKUP_API_KEY is set, web search works. If not, it doesn't.
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
// AVAILABILITY CHECK
// ============================================================================

/**
 * Check if LinkUp is available (API key is set)
 *
 * LinkUp is the ONLY web search provider. No fallbacks.
 * If API key is set, web search works. If not, it doesn't.
 */
export function isLinkUpAvailable(): boolean {
  return !!process.env.LINKUP_API_KEY
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
