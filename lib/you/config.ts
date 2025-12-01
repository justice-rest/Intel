/**
 * You.com Search API Configuration
 * Centralized configuration for You.com agentic web search integration
 */

/**
 * You.com API base URL
 */
export const YOU_API_BASE_URL = "https://ydc-index.io/v1"

/**
 * Check if You.com API key is configured
 */
export function isYouEnabled(): boolean {
  return !!process.env.YOU_API_KEY
}

/**
 * Get You.com API key from environment
 * @throws Error if YOU_API_KEY is not configured
 */
export function getYouApiKey(): string {
  const apiKey = process.env.YOU_API_KEY

  if (!apiKey) {
    throw new Error(
      "YOU_API_KEY is not configured. Please add it to your environment variables."
    )
  }

  return apiKey
}

/**
 * Get You.com API key if available, otherwise return null
 */
export function getYouApiKeyOptional(): string | null {
  return process.env.YOU_API_KEY || null
}

/**
 * Default configuration for You.com search
 * Optimized for prospect research and comprehensive results
 */
export const YOU_DEFAULTS = {
  count: 10,                    // Number of results per section (web/news)
  safesearch: "moderate" as const,
  country: "US" as const,
  language: "EN" as const,
} as const

/**
 * Freshness filter options
 */
export type YouFreshness = "day" | "week" | "month" | "year"

/**
 * Safesearch options
 */
export type YouSafesearch = "off" | "moderate" | "strict"
