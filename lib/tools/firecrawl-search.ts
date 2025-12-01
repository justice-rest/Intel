import FirecrawlApp from "@mendable/firecrawl-js"
import { tool } from "ai"
import { z } from "zod"
import { getFirecrawlApiKey, isFirecrawlEnabled, FIRECRAWL_DEFAULTS } from "../firecrawl/config"

/**
 * Schema for Firecrawl search parameters
 */
export const firecrawlSearchParametersSchema = z.object({
  query: z.string().describe("The search query"),
  limit: z
    .number()
    .optional()
    .default(5)
    .describe("Number of results to return (1-10). Default is 5."),
  scrapeContent: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to scrape full content from results. Costs extra credits. Default is false."),
})

export type FirecrawlSearchParameters = z.infer<typeof firecrawlSearchParametersSchema>

/**
 * Single result from Firecrawl search
 */
export interface FirecrawlSearchResult {
  title: string
  url: string
  snippet: string
  markdown?: string
}

/**
 * Response from Firecrawl search tool
 */
export interface FirecrawlSearchResponse {
  results: FirecrawlSearchResult[]
  query: string
}

// Low latency timeout - 15 seconds for fast response
const FIRECRAWL_TIMEOUT_MS = 15000

/**
 * Helper to add timeout to a promise
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

/**
 * Firecrawl Search Tool
 * Web search with optional content scraping for AI-ready data
 *
 * Features:
 * - Search without scraping (2 credits per 10 results)
 * - Optional full content scraping (+1 credit per page)
 * - Returns clean markdown when scraping enabled
 * - 15 second timeout for low latency
 */
export const firecrawlSearchTool = tool({
  description:
    "Web search and scraping tool. Best for: when you need full page content, " +
    "scraping specific websites, or getting clean markdown from web pages. " +
    "By default returns search results only (fast, cheap). " +
    "Set scrapeContent=true to get full page content as markdown (slower, costs more).",
  parameters: firecrawlSearchParametersSchema,
  execute: async ({
    query,
    limit = FIRECRAWL_DEFAULTS.limit,
    scrapeContent = FIRECRAWL_DEFAULTS.scrapeContent,
  }: FirecrawlSearchParameters): Promise<FirecrawlSearchResponse> => {
    console.log("[Firecrawl Tool] Starting search:", { query, limit, scrapeContent })
    const startTime = Date.now()

    // Check if Firecrawl is enabled
    if (!isFirecrawlEnabled()) {
      console.error("[Firecrawl Tool] FIRECRAWL_API_KEY not configured")
      return { results: [], query }
    }

    try {
      // Initialize Firecrawl client
      const app = new FirecrawlApp({ apiKey: getFirecrawlApiKey() })
      console.log("[Firecrawl Tool] Client initialized, executing search...")

      // Build search options - only include limit for basic search
      // Firecrawl's search method has strict typing for scrapeOptions
      const searchOptions = scrapeContent
        ? {
            limit: Math.min(limit, 10),
            scrapeOptions: {
              formats: ["markdown" as const],
            },
          }
        : {
            limit: Math.min(limit, 10),
          }

      // Perform search with timeout
      const response = await withTimeout(
        app.search(query, searchOptions),
        FIRECRAWL_TIMEOUT_MS,
        `Firecrawl search timed out after ${FIRECRAWL_TIMEOUT_MS / 1000} seconds`
      )

      // Map results to standard format
      // Firecrawl returns { web: [], news: [], images: [] }
      // Results can be SearchResultWeb (title, url, description) or Document (metadata.title, markdown)
      const webResults = response?.web || []
      const results: FirecrawlSearchResult[] = webResults.map((r) => {
        // Check if it's a Document type (has metadata) vs SearchResultWeb
        const isDocument = "metadata" in r || "markdown" in r

        if (isDocument) {
          // Document type from scraping - title is in metadata
          const doc = r as {
            metadata?: { title?: string; description?: string; url?: string }
            markdown?: string
            url?: string
          }
          return {
            title: doc.metadata?.title || "Untitled",
            url: doc.metadata?.url || doc.url || "",
            snippet: doc.metadata?.description || "",
            markdown: doc.markdown,
          }
        } else {
          // SearchResultWeb type - direct properties
          const web = r as { title?: string; url: string; description?: string }
          return {
            title: web.title || "Untitled",
            url: web.url,
            snippet: web.description || "",
            markdown: undefined,
          }
        }
      })

      const duration = Date.now() - startTime
      console.log("[Firecrawl Tool] Search completed successfully:", {
        resultCount: results.length,
        durationMs: duration,
        scrapeContent,
        query,
      })

      return { results, query }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred"
      const isTimeout = errorMessage.includes("timed out")

      console.error("[Firecrawl Tool] Search failed:", {
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
 * Check if Firecrawl search tool should be enabled
 * Returns true if FIRECRAWL_API_KEY is configured
 */
export function shouldEnableFirecrawlTool(): boolean {
  return isFirecrawlEnabled()
}
