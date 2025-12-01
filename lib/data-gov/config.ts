/**
 * US Government Data API Configuration
 * Centralized configuration for api.data.gov services
 *
 * Note: Most federal APIs (USAspending, Treasury Fiscal Data, Federal Register)
 * are completely free and don't require API keys. This config is provided for
 * consistency with other tools and potential future authenticated endpoints.
 *
 * Get a free API key at: https://api.data.gov/signup/
 * Rate limit: 1,000 requests/hour with API key
 */

/**
 * Check if Data.gov API key is configured
 * Note: Not required for most federal APIs, but useful for rate limit increases
 */
export function isDataGovEnabled(): boolean {
  // Always return true since the APIs we use don't require keys
  // The key is optional and just provides higher rate limits
  return true
}

/**
 * Get Data.gov API key from environment (optional)
 * Falls back to "DEMO_KEY" which has lower rate limits
 */
export function getDataGovApiKey(): string {
  return process.env.DATA_GOV_API_KEY || "DEMO_KEY"
}

/**
 * Get Data.gov API key if available, otherwise return null
 */
export function getDataGovApiKeyOptional(): string | null {
  return process.env.DATA_GOV_API_KEY || null
}

/**
 * API Base URLs for US Government data services
 */
export const US_GOV_API_URLS = {
  // USAspending - Federal contracts, grants, loans
  // Docs: https://api.usaspending.gov/
  USASPENDING: "https://api.usaspending.gov/api/v2",

  // Treasury Fiscal Data - Debt, revenue, spending
  // Docs: https://fiscaldata.treasury.gov/api-documentation/
  TREASURY: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2",

  // Federal Register - Regulations, rules, notices
  // Docs: https://www.federalregister.gov/developers/documentation/api/v1
  FEDERAL_REGISTER: "https://www.federalregister.gov/api/v1",
} as const

/**
 * Default configuration for US Government data requests
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

/**
 * Treasury dataset types
 */
export type TreasuryDataset = "debt_to_penny" | "treasury_statement" | "interest_rates"

/**
 * Federal Register document types
 */
export type FederalRegisterDocType = "rule" | "proposed_rule" | "notice" | "presidential_document"

/**
 * Data source options for the unified tool
 */
export type UsGovDataSource = "usaspending" | "treasury" | "federal_register"
