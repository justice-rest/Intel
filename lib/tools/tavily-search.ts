import { tavily } from "@tavily/core"
import { tool } from "ai"
import { z } from "zod"
import { getTavilyApiKey, isTavilyEnabled, TAVILY_DEFAULTS } from "../tavily/config"

/**
 * Schema for Tavily search parameters
 */
export const tavilySearchParametersSchema = z.object({
  query: z.string().describe("The search query"),
  topic: z
    .enum(["general", "news", "finance"])
    .optional()
    .default("general")
    .describe("Topic filter: 'news' for current events, 'finance' for financial data, 'general' for everything else"),
})

export type TavilySearchParameters = z.infer<typeof tavilySearchParametersSchema>

/**
 * Single result from Tavily search
 */
export interface TavilySearchResult {
  title: string
  url: string
  snippet: string
}

/**
 * Response from Tavily search tool
 */
export interface TavilySearchResponse {
  answer: string
  results: TavilySearchResult[]
  query: string
}

// Low latency timeout - 15 seconds for fast response
const TAVILY_TIMEOUT_MS = 15000

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
 * Tavily Search Tool
 * Fast web search optimized for AI agents with synthesized answers
 *
 * Features:
 * - Pre-synthesized answers (like Linkup's sourcedAnswer)
 * - Topic filtering (general, news, finance)
 * - Real-time information
 * - 15 second timeout for low latency
 */
export const tavilySearchTool = tool({
  description:
    "Fast web search optimized for AI agents. Best for: current events, news, " +
    "factual questions, and real-time information. Returns a synthesized answer with sources. " +
    "Use topic='news' for recent events, topic='finance' for financial data.",
  parameters: tavilySearchParametersSchema,
  execute: async ({
    query,
    topic = TAVILY_DEFAULTS.topic,
  }: TavilySearchParameters): Promise<TavilySearchResponse> => {
    console.log("[Tavily Tool] Starting search:", { query, topic })
    const startTime = Date.now()

    // Check if Tavily is enabled
    if (!isTavilyEnabled()) {
      console.error("[Tavily Tool] TAVILY_API_KEY not configured")
      return { answer: "", results: [], query }
    }

    try {
      // Initialize Tavily client
      const client = tavily({ apiKey: getTavilyApiKey() })
      console.log("[Tavily Tool] Client initialized, executing search...")

      // Perform search with basic depth for cost efficiency
      const response = await withTimeout(
        client.search(query, {
          searchDepth: TAVILY_DEFAULTS.searchDepth,
          maxResults: TAVILY_DEFAULTS.maxResults,
          includeAnswer: TAVILY_DEFAULTS.includeAnswer,
          topic,
        }),
        TAVILY_TIMEOUT_MS,
        `Tavily search timed out after ${TAVILY_TIMEOUT_MS / 1000} seconds`
      )

      // Map results to standard format
      const results: TavilySearchResult[] = response.results.map((r) => ({
        title: r.title || "Untitled",
        url: r.url,
        snippet: r.content || "",
      }))

      const duration = Date.now() - startTime
      console.log("[Tavily Tool] Search completed successfully:", {
        hasAnswer: !!response.answer,
        resultCount: results.length,
        durationMs: duration,
        query,
      })

      return {
        answer: response.answer || "",
        results,
        query,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred"
      const isTimeout = errorMessage.includes("timed out")

      console.error("[Tavily Tool] Search failed:", {
        error: errorMessage,
        durationMs: duration,
        query,
        isTimeout,
      })

      // Return empty results instead of throwing - allows AI to continue
      return { answer: "", results: [], query }
    }
  },
})

/**
 * Check if Tavily search tool should be enabled
 * Returns true if TAVILY_API_KEY is configured
 */
export function shouldEnableTavilyTool(): boolean {
  return isTavilyEnabled()
}
