/**
 * Brave Search Configuration
 * Centralized configuration for Brave Search API integration
 */

/**
 * Check if Brave Search API key is configured
 */
export function isBraveEnabled(): boolean {
  return !!process.env.BRAVE_API_KEY
}

/**
 * Get Brave Search API key from environment
 * @throws Error if BRAVE_API_KEY is not configured
 */
export function getBraveApiKey(): string {
  const apiKey = process.env.BRAVE_API_KEY

  if (!apiKey) {
    throw new Error(
      "BRAVE_API_KEY is not configured. Please add it to your environment variables."
    )
  }

  return apiKey
}

/**
 * Get Brave Search API key if available, otherwise return null
 */
export function getBraveApiKeyOptional(): string | null {
  return process.env.BRAVE_API_KEY || null
}

/**
 * Brave Search API endpoint
 */
export const BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search"

/**
 * Default configuration for Brave Search
 */
export const BRAVE_DEFAULTS = {
  count: 10,                    // Number of results to return (max: 20)
  safesearch: "moderate" as const,  // Content filter level
  timeout: 30000,               // 30 second timeout
} as const

/**
 * Brave Search safesearch options
 * - off: No filtering
 * - moderate: Filter explicit content (default)
 * - strict: Strict filtering
 */
export type BraveSafesearch = "off" | "moderate" | "strict"

/**
 * Brave Search freshness options
 * - pd: Past day (24 hours)
 * - pw: Past week
 * - pm: Past month
 * - py: Past year
 * - undefined: No time filter (all time)
 */
export type BraveFreshness = "pd" | "pw" | "pm" | "py" | undefined
