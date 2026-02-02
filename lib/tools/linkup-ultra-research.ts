/**
 * LinkUp Ultra Research Tool
 *
 * [BETA] Comprehensive multi-step research using LinkUp's /research endpoint.
 * Performs exhaustive research by breaking down complex queries, executing
 * multiple searches, and synthesizing results.
 *
 * This tool is only available when:
 * 1. User has Scale plan
 * 2. User has enabled beta features
 * 3. LINKUP_API_KEY is configured
 * 4. Ultra Research mode is selected
 */

import { tool } from "ai"
import { z } from "zod"
import { linkupResearch, getLinkUpStatus } from "@/lib/linkup/client"

/**
 * Check if LinkUp Ultra Research tool should be enabled
 */
export function shouldEnableLinkUpUltraResearchTool(): boolean {
  return getLinkUpStatus().available
}

/**
 * LinkUp Ultra Research AI Tool
 *
 * Executes comprehensive multi-step research using LinkUp's
 * research endpoint for maximum depth and coverage.
 */
export const linkupUltraResearchTool = tool({
  description: `[BETA] Comprehensive multi-step research using LinkUp's /research endpoint.
This performs exhaustive research by:
1. Analyzing the query to understand research objectives
2. Breaking down complex queries into sub-questions
3. Executing multiple searches across authoritative sources
4. Cross-referencing and validating information
5. Synthesizing a comprehensive answer with citations

Best for:
- Complex prospect investigations requiring maximum depth
- Multi-faceted research questions
- Due diligence and comprehensive background checks
- Research requiring synthesis from many sources

Note: This is slower (10 seconds to 5 minutes) but provides the most thorough results.
Uses 2 credits (same as Deep Research mode).

This is a beta feature available to Scale plan users only.`,
  parameters: z.object({
    query: z
      .string()
      .describe(
        "Research objective or question. Be detailed about what you're trying to learn. Include context like names, locations, and specific aspects to investigate."
      ),
    outputType: z
      .enum(["sourcedAnswer", "structured"])
      .optional()
      .default("sourcedAnswer")
      .describe(
        "Output format - 'sourcedAnswer' for narrative with citations (default), 'structured' for structured data"
      ),
  }),
  execute: async ({ query, outputType }) => {
    const startTime = Date.now()

    try {
      const result = await linkupResearch({
        query,
        outputType,
      })

      const durationMs = Date.now() - startTime

      return {
        content: result.answer,
        sources: result.sources,
        searchQueries: result.searchQueries,
        durationMs,
        mode: "ultra-research",
        provider: "linkup-research",
        isBeta: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Research failed"
      console.error("[LinkUp Ultra Research] Error:", message)

      return {
        error: message,
        content: `Ultra research failed: ${message}`,
        sources: [],
        mode: "ultra-research",
        provider: "linkup-research",
        isBeta: true,
      }
    }
  },
})
