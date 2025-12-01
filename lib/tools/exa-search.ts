import Exa from "exa-js"
import { tool } from "ai"
import { z } from "zod"
import { getExaApiKey, isExaEnabled, EXA_DEFAULTS } from "../exa/config"

/**
 * Schema for Exa search parameters
 */
export const exaSearchParametersSchema = z.object({
  query: z.string().describe("The search query - can be natural language or a question"),
  numResults: z
    .number()
    .optional()
    .default(5)
    .describe("Number of results to return (1-10). Default is 5."),
})

export type ExaSearchParameters = z.infer<typeof exaSearchParametersSchema>

/**
 * Single result from Exa search
 */
export interface ExaSearchResult {
  title: string
  url: string
  snippet: string
  publishedDate?: string
}

/**
 * Response from Exa search tool
 */
export interface ExaSearchResponse {
  results: ExaSearchResult[]
  query: string
}

// 30 second timeout for search operations
const EXA_TIMEOUT_MS = 30000

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
 * Exa Search Tool
 * Semantic/neural web search for finding similar content and research queries
 *
 * Features:
 * - Neural embeddings for semantic understanding
 * - Full web coverage (no domain restrictions)
 * - Content extraction included
 * - 15 second timeout for low latency
 */
export const exaSearchTool = tool({
  description:
    "Semantic web search using neural embeddings. Best for: finding similar content, " +
    "discovering related topics, research questions, and queries where keyword matching fails. " +
    "Searches the full web without domain restrictions. Good for finding companies, people, " +
    "and topics that are conceptually related to the query.",
  parameters: exaSearchParametersSchema,
  execute: async ({
    query,
    numResults = EXA_DEFAULTS.numResults,
  }: ExaSearchParameters): Promise<ExaSearchResponse> => {
    console.log("[Exa Tool] Starting search:", { query, numResults })
    const startTime = Date.now()

    // Check if Exa is enabled
    if (!isExaEnabled()) {
      console.error("[Exa Tool] EXA_API_KEY not configured")
      return { results: [], query }
    }

    try {
      // Initialize Exa client
      const exa = new Exa(getExaApiKey())
      console.log("[Exa Tool] Client initialized, executing search...")

      // Perform search with content retrieval
      const response = await withTimeout(
        exa.searchAndContents(query, {
          numResults: Math.min(numResults, 10), // Cap at 10 for cost
          type: EXA_DEFAULTS.type,
          useAutoprompt: EXA_DEFAULTS.useAutoprompt,
          text: { maxCharacters: EXA_DEFAULTS.maxCharacters },
        }),
        EXA_TIMEOUT_MS,
        `Exa search timed out after ${EXA_TIMEOUT_MS / 1000} seconds`
      )

      // Map results to standard format
      const results: ExaSearchResult[] = response.results.map((r) => ({
        title: r.title || "Untitled",
        url: r.url,
        snippet: r.text || "",
        publishedDate: r.publishedDate || undefined,
      }))

      const duration = Date.now() - startTime
      console.log("[Exa Tool] Search completed successfully:", {
        resultCount: results.length,
        durationMs: duration,
        query,
      })

      return { results, query }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred"
      const isTimeout = errorMessage.includes("timed out")

      console.error("[Exa Tool] Search failed:", {
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
 * Check if Exa search tool should be enabled
 * Returns true if EXA_API_KEY is configured
 */
export function shouldEnableExaTool(): boolean {
  return isExaEnabled()
}
