import { LinkupClient } from "linkup-sdk"
import { tool } from "ai"
import { LINKUP_DEFAULTS, getLinkupApiKey, isLinkupEnabled, PROSPECT_RESEARCH_DOMAINS } from "../linkup/config"
import {
  linkupSearchParametersSchema,
  type LinkupSearchParameters,
  type LinkupSearchResponse,
} from "./types"

// Timeout for Linkup search requests (60 seconds)
// sourcedAnswer mode needs time to synthesize results
const LINKUP_SEARCH_TIMEOUT_MS = 60000

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
 * Linkup Search Tool
 * Performs web search using Linkup's search engine with pre-synthesized answers
 *
 * Features:
 * - sourcedAnswer mode for pre-synthesized responses
 * - Standard vs Deep search depth options
 * - Built-in source citations
 * - 30 second timeout to prevent hanging
 */
export const linkupSearchTool = tool({
  description:
    "Search the web for prospect research, wealth screening, and real-time data. " +
    "Returns a synthesized answer with source citations. " +
    "Use this for: property records, home valuations, SEC filings, FEC political contributions, foundation 990s, " +
    "business ownership, charitable giving history, news archives, and professional backgrounds. " +
    "Always use standard depth (the default).",
  parameters: linkupSearchParametersSchema,
  execute: async ({
    query,
    depth = LINKUP_DEFAULTS.depth,
  }: LinkupSearchParameters): Promise<LinkupSearchResponse> => {
    console.log("[Linkup Tool] Starting search with:", { query, depth })
    const startTime = Date.now()

    // Check if Linkup is enabled
    if (!isLinkupEnabled()) {
      console.error("[Linkup Tool] LINKUP_API_KEY not configured")
      throw new Error(
        "Linkup search is not configured. Please add LINKUP_API_KEY to your environment variables."
      )
    }

    try {
      // Initialize Linkup client
      const client = new LinkupClient({ apiKey: getLinkupApiKey() })
      console.log("[Linkup Tool] Linkup client initialized, executing search...")

      // Perform search with sourcedAnswer output type and timeout
      // includeDomains focuses on authoritative prospect research sources
      const searchResult = await withTimeout(
        client.search({
          query,
          depth,
          outputType: "sourcedAnswer",
          includeDomains: [...PROSPECT_RESEARCH_DOMAINS],
        }),
        LINKUP_SEARCH_TIMEOUT_MS,
        `Linkup search timed out after ${LINKUP_SEARCH_TIMEOUT_MS / 1000} seconds`
      )

      // Extract answer and sources from response
      const answer = searchResult.answer || ""
      const sources = (searchResult.sources || []).map((source: { name?: string; url: string; snippet?: string }) => ({
        name: source.name || "Untitled",
        url: source.url,
        snippet: source.snippet || "",
      }))

      const duration = Date.now() - startTime
      console.log("[Linkup Tool] Search completed successfully:", {
        answerLength: answer.length,
        sourceCount: sources.length,
        durationMs: duration,
        query,
      })

      return {
        answer,
        sources,
        query,
        depth,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred"
      const isTimeout = errorMessage.includes("timed out")

      console.error("[Linkup Tool] Search failed:", {
        error: errorMessage,
        durationMs: duration,
        query,
        isTimeout,
      })

      // Return graceful fallback instead of throwing - allows AI to continue responding
      return {
        answer: isTimeout
          ? "Web search timed out. I'll answer based on my existing knowledge instead."
          : `Web search encountered an error: ${errorMessage}. I'll answer based on my existing knowledge instead.`,
        sources: [],
        query,
        depth,
      }
    }
  },
})

/**
 * Check if Linkup search tool should be enabled
 * Returns true if LINKUP_API_KEY is configured
 */
export function shouldEnableLinkupTool(): boolean {
  return isLinkupEnabled()
}
