/**
 * Gemini Grounded Search Tool
 *
 * [BETA] Uses Google's Gemini with native Google Search grounding
 * to provide real-time search results with citations.
 *
 * This tool is only available when:
 * 1. User has Scale plan
 * 2. User has enabled beta features
 * 3. GOOGLE_AI_API_KEY is configured
 */

import { tool } from "ai"
import { z } from "zod"
import { geminiGroundedSearch } from "@/lib/gemini/client"
import { isGeminiAvailable } from "@/lib/gemini/config"

/**
 * Check if Gemini Grounded Search tool should be enabled
 */
export function shouldEnableGeminiGroundedSearchTool(): boolean {
  return isGeminiAvailable()
}

/**
 * Gemini Grounded Search AI Tool
 *
 * Executes web searches using Google's Gemini model with native
 * Google Search grounding, providing real-time results with citations.
 */
export const geminiGroundedSearchTool = tool({
  description: `[BETA] Search the web using Google's Gemini model with native Google Search grounding.
Returns real-time search results with inline citations from Google's search index.

Best for:
- Current events and recent news
- Verifying information with multiple sources
- General web queries requiring fresh data

The response includes source citations for every claim, making it ideal for
fact-checking and cross-referencing information.

Note: This is a beta feature available to Scale plan users only.`,
  parameters: z.object({
    query: z
      .string()
      .describe(
        "Natural language search query. Be specific and detailed for better results."
      ),
  }),
  execute: async ({ query }) => {
    const startTime = Date.now()

    try {
      const result = await geminiGroundedSearch(query)
      const durationMs = Date.now() - startTime

      return {
        content: result.text,
        sources: result.sources.map((s) => ({
          name: s.title,
          url: s.uri,
        })),
        searchQueries: result.searchQueries,
        durationMs,
        provider: "gemini-grounded",
        isBeta: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Search failed"
      console.error("[Gemini Grounded Search] Error:", message)

      return {
        error: message,
        content: `Gemini grounded search failed: ${message}`,
        sources: [],
        provider: "gemini-grounded",
        isBeta: true,
      }
    }
  },
})
