/**
 * Gemini Grounded Search Tools
 *
 * [BETA] Uses Google's Gemini with native Google Search grounding
 * to provide real-time search results with citations.
 *
 * Two tools available:
 * - geminiGroundedSearchTool: Uses Gemini 3 Flash Preview (fast, efficient)
 * - geminiUltraSearchTool: Uses Gemini 3 Pro Preview (deep, comprehensive)
 *
 * These tools are only available when:
 * 1. User has Scale plan
 * 2. User has enabled beta features
 * 3. GOOGLE_AI_API_KEY is configured
 */

import { tool } from "ai"
import { z } from "zod"
import { geminiGroundedSearch } from "@/lib/gemini/client"
import { isGeminiAvailable } from "@/lib/gemini/config"

/**
 * Check if Gemini tools should be enabled
 */
export function shouldEnableGeminiGroundedSearchTool(): boolean {
  return isGeminiAvailable()
}

/**
 * Gemini Search Tool (Flash)
 *
 * Fast web search using Gemini 3 Flash Preview with Google Search grounding.
 * Best for quick lookups and standard research queries.
 */
export const geminiGroundedSearchTool = tool({
  description: `[BETA] Fast web search using Gemini 3 Flash with Google Search grounding.

Use this tool for:
- Quick fact-checking and verification
- Current events and recent news lookups
- General information queries
- Finding specific data points (dates, numbers, names)

Returns real-time search results with source citations from Google's search index.
Optimized for speed while maintaining accuracy.`,
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Search query. Be specific about what you're looking for. Include relevant names, dates, or context for better results."
      ),
  }),
  execute: async ({ query }) => {
    const startTime = Date.now()

    try {
      const result = await geminiGroundedSearch({
        query,
        modelType: "flash",
      })
      const durationMs = Date.now() - startTime

      return {
        content: result.text,
        sources: result.sources.map((s) => ({
          name: s.title,
          url: s.uri,
        })),
        searchQueries: result.searchQueries,
        durationMs,
        model: result.model,
        provider: "gemini-flash",
        isBeta: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Search failed"
      console.error("[Gemini Search] Error:", message)

      return {
        error: message,
        content: `Search failed: ${message}`,
        sources: [],
        provider: "gemini-flash",
        isBeta: true,
      }
    }
  },
})

/**
 * Gemini Ultra Search Tool (Pro)
 *
 * Deep, comprehensive research using Gemini 3 Pro Preview with Google Search grounding.
 * Best for complex research requiring multiple search angles and thorough analysis.
 */
export const geminiUltraSearchTool = tool({
  description: `[BETA] Deep research using Gemini 3 Pro with Google Search grounding.

Use this tool for:
- Comprehensive prospect/person research
- Complex multi-faceted queries requiring thorough investigation
- Background checks and due diligence research
- Topics requiring multiple search angles and cross-referencing
- Research where accuracy and completeness are critical

This tool conducts MULTIPLE searches from different angles, cross-references sources,
and provides a comprehensive synthesis. Takes longer but delivers more thorough results.

Best used for deep/ultra research modes where quality matters more than speed.`,
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Detailed research query. Include full names, locations, organizations, and specific aspects you want investigated. The more context, the better the results."
      ),
    context: z
      .string()
      .optional()
      .describe(
        "Additional context to guide the research. Include any known information, specific focus areas, or what you're trying to learn."
      ),
  }),
  execute: async ({ query, context }) => {
    const startTime = Date.now()

    try {
      const result = await geminiGroundedSearch({
        query,
        modelType: "pro",
        context,
      })
      const durationMs = Date.now() - startTime

      return {
        content: result.text,
        sources: result.sources.map((s) => ({
          name: s.title,
          url: s.uri,
        })),
        searchQueries: result.searchQueries,
        durationMs,
        model: result.model,
        mode: "ultra-search",
        provider: "gemini-pro",
        isBeta: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Research failed"
      console.error("[Gemini Ultra Search] Error:", message)

      return {
        error: message,
        content: `Deep research failed: ${message}`,
        sources: [],
        mode: "ultra-search",
        provider: "gemini-pro",
        isBeta: true,
      }
    }
  },
})
