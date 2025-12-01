import { tool } from "ai"
import { z } from "zod"
import {
  getBraveApiKey,
  isBraveEnabled,
  BRAVE_API_URL,
  BRAVE_DEFAULTS,
  type BraveFreshness,
} from "../brave/config"

/**
 * Schema for Brave Search parameters
 */
export const braveSearchParametersSchema = z.object({
  query: z.string().describe("The search query"),
  count: z
    .number()
    .optional()
    .default(BRAVE_DEFAULTS.count)
    .describe("Number of results to return (max: 20)"),
  freshness: z
    .enum(["pd", "pw", "pm", "py"])
    .optional()
    .describe(
      "Time filter: 'pd' (past day), 'pw' (past week), 'pm' (past month), 'py' (past year)"
    ),
})

export type BraveSearchParameters = z.infer<typeof braveSearchParametersSchema>

/**
 * Single result from Brave Search
 */
export interface BraveSearchResult {
  title: string
  url: string
  snippet: string
}

/**
 * Response from Brave Search tool
 */
export interface BraveSearchResponse {
  results: BraveSearchResult[]
  query: string
}

/**
 * Brave API response structure
 */
interface BraveApiResponse {
  web?: {
    results?: Array<{
      title?: string
      url: string
      description?: string
      age?: string
    }>
  }
  query?: {
    original?: string
  }
}

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
 * Brave Search Tool (searchWebGeneral)
 * General-purpose web search using Brave Search API
 *
 * Features:
 * - Privacy-focused search engine
 * - Independent index (not reliant on Google/Bing)
 * - Freshness filter for time-sensitive queries
 * - 30 second timeout for reliability
 */
export const braveSearchTool = tool({
  description:
    "General-purpose web search using Brave Search. Best for: broad web queries, " +
    "general information, backup when other search tools don't find results. " +
    "Use freshness='pd' for last 24 hours, 'pw' for last week, 'pm' for last month.",
  parameters: braveSearchParametersSchema,
  execute: async ({
    query,
    count = BRAVE_DEFAULTS.count,
    freshness,
  }: BraveSearchParameters): Promise<BraveSearchResponse> => {
    console.log("[Brave Search] Starting search:", { query, count, freshness })
    const startTime = Date.now()

    // Check if Brave is enabled
    if (!isBraveEnabled()) {
      console.error("[Brave Search] BRAVE_API_KEY not configured")
      return { results: [], query }
    }

    try {
      const apiKey = getBraveApiKey()

      // Build query parameters
      const params = new URLSearchParams({
        q: query,
        count: String(Math.min(count, 20)), // Max 20 results
        safesearch: BRAVE_DEFAULTS.safesearch,
      })

      // Add freshness filter if specified
      if (freshness) {
        params.append("freshness", freshness)
      }

      const url = `${BRAVE_API_URL}?${params.toString()}`
      console.log("[Brave Search] Fetching:", url.replace(apiKey, "***"))

      // Make API request with timeout
      const response = await withTimeout(
        fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": apiKey,
          },
        }),
        BRAVE_DEFAULTS.timeout,
        `Brave Search timed out after ${BRAVE_DEFAULTS.timeout / 1000} seconds`
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[Brave Search] API error:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        })
        return { results: [], query }
      }

      const data = (await response.json()) as BraveApiResponse

      // Map results to standard format
      const results: BraveSearchResult[] = (data.web?.results || []).map(
        (r) => ({
          title: r.title || "Untitled",
          url: r.url,
          snippet: r.description || "",
        })
      )

      const duration = Date.now() - startTime
      console.log("[Brave Search] Search completed successfully:", {
        resultCount: results.length,
        durationMs: duration,
        query,
      })

      return {
        results,
        query,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred"
      const isTimeout = errorMessage.includes("timed out")

      console.error("[Brave Search] Search failed:", {
        error: errorMessage,
        durationMs: duration,
        query,
        isTimeout,
      })

      // Return empty results instead of throwing - allows AI to continue
      return { results: [], query }
    }
  },
})

/**
 * Check if Brave Search tool should be enabled
 * Returns true if BRAVE_API_KEY is configured
 */
export function shouldEnableBraveTool(): boolean {
  return isBraveEnabled()
}
