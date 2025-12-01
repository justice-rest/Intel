/**
 * Tavily Search Configuration
 * Centralized configuration for Tavily search integration
 */

/**
 * Check if Tavily API key is configured
 */
export function isTavilyEnabled(): boolean {
  return !!process.env.TAVILY_API_KEY
}

/**
 * Get Tavily API key from environment
 * @throws Error if TAVILY_API_KEY is not configured
 */
export function getTavilyApiKey(): string {
  const apiKey = process.env.TAVILY_API_KEY

  if (!apiKey) {
    throw new Error(
      "TAVILY_API_KEY is not configured. Please add it to your environment variables."
    )
  }

  return apiKey
}

/**
 * Get Tavily API key if available, otherwise return null
 */
export function getTavilyApiKeyOptional(): string | null {
  return process.env.TAVILY_API_KEY || null
}

/**
 * Default configuration for Tavily search
 * Using "basic" depth for cost efficiency (1 credit vs 2 for advanced)
 */
export const TAVILY_DEFAULTS = {
  searchDepth: "basic" as const,  // 1 credit vs 2 for "advanced"
  maxResults: 5,                   // Keep low for cost and latency
  includeAnswer: true,             // Pre-synthesized answer like Linkup
  topic: "general" as const,       // Default topic
} as const

/**
 * Tavily search depth options
 * - basic: Fast and cheap (1 credit)
 * - advanced: More thorough (2 credits)
 */
export type TavilySearchDepth = "basic" | "advanced"

/**
 * Tavily topic options
 * - general: Default web search
 * - news: Current events and news articles
 * - finance: Financial data and market news
 */
export type TavilyTopic = "general" | "news" | "finance"
