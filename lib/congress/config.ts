/**
 * Congress.gov API Configuration
 * Provides lobbying disclosure data, bills, votes, and member information
 *
 * API Documentation: https://api.congress.gov/
 *
 * FREE API:
 * - Get API key at: https://api.congress.gov/sign-up/
 * - 1,000 requests per hour
 * - Lobbying Disclosure Act (LDA) filings
 * - Congressional member data
 * - Bills and legislation
 */

/**
 * Congress.gov API base URL
 */
export const CONGRESS_API_BASE_URL = "https://api.congress.gov/v3"

/**
 * Lobbying data alternative - Senate LDA database
 * Direct access to lobbying disclosures (no API key needed)
 */
export const SENATE_LDA_BASE_URL = "https://lda.senate.gov/api/v1"

/**
 * Check if Congress API key is configured
 */
export function isCongressApiKeyConfigured(): boolean {
  return !!process.env.CONGRESS_API_KEY
}

/**
 * Get Congress API key from environment
 */
export function getCongressApiKey(): string | null {
  return process.env.CONGRESS_API_KEY || null
}

/**
 * Lobbying search is always enabled (uses Senate LDA API - no key required)
 */
export function isLobbyingEnabled(): boolean {
  return true
}

/**
 * Default configuration for Congress/Lobbying API requests
 */
export const CONGRESS_DEFAULTS = {
  limit: 25,             // Results per request
  timeout: 30000,        // 30 seconds
  format: "json",        // Response format
} as const

/**
 * Lobbying activity codes (from LDA)
 */
export const LOBBYING_GENERAL_ISSUES = {
  "TAX": "Taxation/Internal Revenue Code",
  "BUD": "Budget/Appropriations",
  "HCR": "Health Issues",
  "TRD": "Trade",
  "DEF": "Defense",
  "ENE": "Energy/Nuclear",
  "FIN": "Financial Institutions/Investments/Securities",
  "TEC": "Science/Technology",
  "ENV": "Environment/Superfund",
  "EDU": "Education",
} as const
