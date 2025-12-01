/**
 * USAspending API Configuration
 * Configuration for federal awards data (contracts, grants, loans)
 *
 * USAspending is completely free and doesn't require API keys.
 * Docs: https://api.usaspending.gov/
 */

/**
 * Check if USAspending tool is enabled
 * Always returns true since the API doesn't require keys
 */
export function isDataGovEnabled(): boolean {
  return true
}

/**
 * API Base URLs
 */
export const US_GOV_API_URLS = {
  // USAspending - Federal contracts, grants, loans
  // Docs: https://api.usaspending.gov/
  USASPENDING: "https://api.usaspending.gov/api/v2",
} as const

/**
 * Default configuration for USAspending requests
 */
export const US_GOV_DEFAULTS = {
  // Results per request
  limit: 10,
  // Request timeout in milliseconds
  timeoutMs: 30000,
  // Sort order
  sortOrder: "desc" as const,
} as const

/**
 * USAspending award types
 */
export type UsaspendingAwardType = "contracts" | "grants" | "loans" | "direct_payments" | "other" | "all"
