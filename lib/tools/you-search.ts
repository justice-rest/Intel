/**
 * You.com Agentic Web Search Tool
 * Real-time web and news search with LLM-ready results
 * Acts as a backup/alternative to Linkup for prospect research
 */

import { tool } from "ai"
import { z } from "zod"
import {
  YOU_API_BASE_URL,
  YOU_DEFAULTS,
  isYouEnabled,
  getYouApiKey,
  type YouFreshness,
} from "../you/config"

/**
 * Schema for You.com search parameters
 */
export const youSearchParametersSchema = z.object({
  query: z.string().describe("The search query for web and news results"),
  count: z
    .number()
    .optional()
    .default(10)
    .describe("Number of results to return per section (1-20). Default is 10."),
  freshness: z
    .enum(["day", "week", "month", "year"])
    .optional()
    .describe("Filter results by recency: day, week, month, or year"),
  includeNews: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include news results in addition to web results. Default is true."),
})

export type YouSearchParameters = z.infer<typeof youSearchParametersSchema>

/**
 * Single web result from You.com search
 */
export interface YouWebResult {
  url: string
  title: string
  description: string
  snippets: string[]
  thumbnail_url?: string
  page_age?: string
  favicon_url?: string
}

/**
 * Single news result from You.com search
 */
export interface YouNewsResult {
  url: string
  title: string
  description: string
  page_age?: string
  thumbnail_url?: string
}

/**
 * Response from You.com search tool
 * Formatted to match the sources pattern used by other tools
 */
export interface YouSearchResponse {
  rawContent: string
  sources: Array<{ name: string; url: string; snippet?: string }>
  query: string
  webResultCount: number
  newsResultCount: number
}

// 30 second timeout for search operations
const YOU_TIMEOUT_MS = 30000

/**
 * Helper to add timeout to a promise
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

/**
 * You.com Agentic Search Tool
 * Provides real-time web and news search with comprehensive results
 *
 * Features:
 * - Combined web and news results
 * - Freshness filtering (day, week, month, year)
 * - Country and language targeting
 * - Source citations with URLs
 * - Backup for Linkup when needed
 */
export const youSearchTool = tool({
  description:
    "Agentic web search for real-time web and news results. Use as a backup or complement to searchWeb (Linkup). " +
    "Best for: breaking news, current events, recent company news, person mentions in media, " +
    "and broad web searches. Returns both web pages and news articles with source citations. " +
    "Use freshness='day' for breaking news, 'week' for recent updates, 'month' for recent coverage.",
  parameters: youSearchParametersSchema,
  execute: async ({
    query,
    count = YOU_DEFAULTS.count,
    freshness,
    includeNews = true,
  }: YouSearchParameters): Promise<YouSearchResponse> => {
    console.log("[You.com Tool] Starting search:", { query, count, freshness, includeNews })
    const startTime = Date.now()

    // Check if You.com is enabled
    if (!isYouEnabled()) {
      console.error("[You.com Tool] YOU_API_KEY not configured")
      return {
        rawContent: "You.com search is not configured. Please add YOU_API_KEY to your environment.",
        sources: [],
        query,
        webResultCount: 0,
        newsResultCount: 0,
      }
    }

    try {
      // Build request URL
      const url = new URL(`${YOU_API_BASE_URL}/search`)
      url.searchParams.set("query", query)
      url.searchParams.set("count", String(Math.min(count, 20)))
      url.searchParams.set("safesearch", YOU_DEFAULTS.safesearch)
      url.searchParams.set("country", YOU_DEFAULTS.country)
      url.searchParams.set("language", YOU_DEFAULTS.language)

      if (freshness) {
        url.searchParams.set("freshness", freshness)
      }

      console.log("[You.com Tool] Fetching:", url.toString())

      // Make request with timeout
      const response = await withTimeout(
        fetch(url.toString(), {
          method: "GET",
          headers: {
            "X-API-Key": getYouApiKey(),
            "Accept": "application/json",
          },
        }),
        YOU_TIMEOUT_MS,
        `You.com search timed out after ${YOU_TIMEOUT_MS / 1000} seconds`
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`You.com API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      // Extract web results
      const webResults: YouWebResult[] = data.results?.web || []
      const newsResults: YouNewsResult[] = includeNews ? (data.results?.news || []) : []

      // Build sources array for UI display
      const sources: Array<{ name: string; url: string; snippet?: string }> = []

      // Add web results to sources
      for (const result of webResults) {
        sources.push({
          name: result.title || "Web Result",
          url: result.url,
          snippet: result.description || result.snippets?.[0] || "",
        })
      }

      // Add news results to sources
      for (const result of newsResults) {
        sources.push({
          name: result.title || "News Result",
          url: result.url,
          snippet: result.description || "",
        })
      }

      // Build rawContent for AI analysis
      const contentParts: string[] = []

      if (webResults.length > 0) {
        contentParts.push("## Web Results\n")
        for (const result of webResults) {
          contentParts.push(`### ${result.title}`)
          contentParts.push(`URL: ${result.url}`)
          if (result.page_age) {
            contentParts.push(`Age: ${result.page_age}`)
          }
          contentParts.push(result.description || "")
          if (result.snippets && result.snippets.length > 0) {
            contentParts.push("\nSnippets:")
            for (const snippet of result.snippets) {
              contentParts.push(`- ${snippet}`)
            }
          }
          contentParts.push("")
        }
      }

      if (newsResults.length > 0) {
        contentParts.push("\n## News Results\n")
        for (const result of newsResults) {
          contentParts.push(`### ${result.title}`)
          contentParts.push(`URL: ${result.url}`)
          if (result.page_age) {
            contentParts.push(`Age: ${result.page_age}`)
          }
          contentParts.push(result.description || "")
          contentParts.push("")
        }
      }

      const rawContent = contentParts.join("\n")

      const duration = Date.now() - startTime
      console.log("[You.com Tool] Search completed successfully:", {
        webResultCount: webResults.length,
        newsResultCount: newsResults.length,
        sourceCount: sources.length,
        durationMs: duration,
        query,
      })

      return {
        rawContent,
        sources,
        query,
        webResultCount: webResults.length,
        newsResultCount: newsResults.length,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred"
      const isTimeout = errorMessage.includes("timed out")

      console.error("[You.com Tool] Search failed:", {
        error: errorMessage,
        durationMs: duration,
        query,
        isTimeout,
      })

      // Return graceful fallback - allows AI to continue
      return {
        rawContent: isTimeout
          ? "You.com search timed out. Try using searchWeb (Linkup) or tavilySearch instead."
          : `You.com search error: ${errorMessage}. Try using searchWeb (Linkup) or tavilySearch instead.`,
        sources: [],
        query,
        webResultCount: 0,
        newsResultCount: 0,
      }
    }
  },
})

/**
 * Check if You.com search tool should be enabled
 * Returns true if YOU_API_KEY is configured
 */
export function shouldEnableYouTool(): boolean {
  return isYouEnabled()
}
