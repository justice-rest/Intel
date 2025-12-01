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
    "ESSENTIAL prospect research tool for deep wealth screening. Returns synthesized answers with source citations. " +
    "**HOME VALUATION RESEARCH:** Search '[address] home value', '[address] property records', '[address] Zillow estimate', " +
    "'[county] assessor [address]' to find property values, purchase prices, and tax assessments. Run MULTIPLE searches with different query formats. " +
    "**BUSINESS OWNERSHIP RESEARCH:** Search '[name] owner', '[name] founder CEO', '[name] business company', " +
    "'[name] LLC registered agent', '[state] corporation [name]' to find business interests. Cross-reference with state SOS records. " +
    "**ALSO SEARCH FOR:** SEC filings, FEC political contributions, foundation 990s, charitable giving, news archives, professional backgrounds. " +
    "**CRITICAL:** Don't stop at one search. Run 3-5 targeted searches with varied query terms to build a complete picture. " +
    "Each search costs ~$0.005 - thoroughness is expected, not optional.",
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
