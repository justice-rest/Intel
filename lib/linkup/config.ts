/**
 * Linkup Search Configuration
 * Centralized configuration for Linkup search integration
 */

/**
 * Check if Linkup API key is configured
 */
export function isLinkupEnabled(): boolean {
  return !!process.env.LINKUP_API_KEY
}

/**
 * Get Linkup API key from environment
 * @throws Error if LINKUP_API_KEY is not configured
 */
export function getLinkupApiKey(): string {
  const apiKey = process.env.LINKUP_API_KEY

  if (!apiKey) {
    throw new Error(
      "LINKUP_API_KEY is not configured. Please add it to your environment variables."
    )
  }

  return apiKey
}

/**
 * Get Linkup API key if available, otherwise return null
 */
export function getLinkupApiKeyOptional(): string | null {
  return process.env.LINKUP_API_KEY || null
}

/**
 * Default configuration for Linkup search
 */
export const LINKUP_DEFAULTS = {
  depth: "standard" as const, // "standard" for fast, "deep" for complex queries
  outputType: "sourcedAnswer" as const, // Pre-synthesized answer with sources
  maxResults: 10, // Number of sources to return
} as const

/**
 * Linkup search depth options
 * - standard: Fast, suited for simple queries
 * - deep: Agentic workflow, slower but handles complex queries
 */
export type LinkupDepth = "standard" | "deep"

/**
 * Linkup output type options
 * - sourcedAnswer: Synthesized answer with citations
 * - searchResults: Raw search results
 * - structured: Custom schema response
 */
export type LinkupOutputType = "sourcedAnswer" | "searchResults" | "structured"
