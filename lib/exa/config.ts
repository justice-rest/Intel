/**
 * Exa Search Configuration
 * Centralized configuration for Exa semantic search integration
 */

/**
 * Check if Exa API key is configured
 */
export function isExaEnabled(): boolean {
  return !!process.env.EXA_API_KEY
}

/**
 * Get Exa API key from environment
 * @throws Error if EXA_API_KEY is not configured
 */
export function getExaApiKey(): string {
  const apiKey = process.env.EXA_API_KEY

  if (!apiKey) {
    throw new Error(
      "EXA_API_KEY is not configured. Please add it to your environment variables."
    )
  }

  return apiKey
}

/**
 * Get Exa API key if available, otherwise return null
 */
export function getExaApiKeyOptional(): string | null {
  return process.env.EXA_API_KEY || null
}

/**
 * Default configuration for Exa search
 * Optimized for cost efficiency and low latency
 */
export const EXA_DEFAULTS = {
  numResults: 5,          // Keep low for cost (~$0.005 for 1-25 results)
  useAutoprompt: true,    // Improve query quality automatically
  type: "auto" as const,  // Let Exa choose best search type
  maxCharacters: 1000,    // Limit content length per result
} as const

/**
 * Exa search type options
 * - auto: Let Exa decide based on query
 * - neural: Semantic/embedding based search
 * - keyword: Traditional keyword matching
 */
export type ExaSearchType = "auto" | "neural" | "keyword"
