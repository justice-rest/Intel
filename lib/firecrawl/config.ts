/**
 * Firecrawl Search Configuration
 * Centralized configuration for Firecrawl web search and scraping integration
 */

/**
 * Check if Firecrawl API key is configured
 */
export function isFirecrawlEnabled(): boolean {
  return !!process.env.FIRECRAWL_API_KEY
}

/**
 * Get Firecrawl API key from environment
 * @throws Error if FIRECRAWL_API_KEY is not configured
 */
export function getFirecrawlApiKey(): string {
  const apiKey = process.env.FIRECRAWL_API_KEY

  if (!apiKey) {
    throw new Error(
      "FIRECRAWL_API_KEY is not configured. Please add it to your environment variables."
    )
  }

  return apiKey
}

/**
 * Get Firecrawl API key if available, otherwise return null
 */
export function getFirecrawlApiKeyOptional(): string | null {
  return process.env.FIRECRAWL_API_KEY || null
}

/**
 * Default configuration for Firecrawl search
 * Optimized for cost efficiency (search only, no scraping)
 * Cost: 2 credits per 10 results (without scraping)
 */
export const FIRECRAWL_DEFAULTS = {
  limit: 5,                // Keep low for cost efficiency
  scrapeContent: false,    // Don't scrape by default (saves credits)
} as const
