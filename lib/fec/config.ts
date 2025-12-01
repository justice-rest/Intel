/**
 * FEC (Federal Election Commission) API Configuration
 * Centralized configuration for OpenFEC API integration
 *
 * API Documentation: https://api.open.fec.gov/developers/
 * Get your API key at: https://api.data.gov/signup/
 */

/**
 * Check if FEC API key is configured
 */
export function isFecEnabled(): boolean {
  return !!process.env.FEC_API_KEY
}

/**
 * Get FEC API key from environment
 * @throws Error if FEC_API_KEY is not configured
 */
export function getFecApiKey(): string {
  const apiKey = process.env.FEC_API_KEY

  if (!apiKey) {
    throw new Error(
      "FEC_API_KEY is not configured. Please add it to your environment variables. " +
      "Get a free API key at https://api.data.gov/signup/"
    )
  }

  return apiKey
}

/**
 * Get FEC API key if available, otherwise return null
 */
export function getFecApiKeyOptional(): string | null {
  return process.env.FEC_API_KEY || null
}

/**
 * FEC API base URL
 */
export const FEC_API_BASE_URL = "https://api.open.fec.gov/v1"

/**
 * Default configuration for FEC API requests
 * Rate limit: 1,000 requests per hour with an API key
 */
export const FEC_DEFAULTS = {
  perPage: 20,           // Results per page (max 100)
  sortNullsLast: true,   // Put null values at end
  sortHideNull: false,   // Don't hide null values
} as const

/**
 * FEC contribution sort options
 */
export type FecContributionSort =
  | "contribution_receipt_date"
  | "-contribution_receipt_date"
  | "contribution_receipt_amount"
  | "-contribution_receipt_amount"
