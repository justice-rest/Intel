/**
 * Batch Reports Search Tool
 * Allows AI to search previously researched prospects from batch processing
 *
 * Enables the AI to proactively look up prospect information when discussing
 * individuals who have been researched via batch processing.
 */

import { tool } from "ai"
import { z } from "zod"
import { searchBatchReports } from "@/lib/batch-reports/retrieval"
import { DEFAULT_SIMILARITY_THRESHOLD } from "@/lib/batch-reports/config"

// Parameter schema for batch reports search
const batchReportsSearchSchema = z.object({
  query: z
    .string()
    .describe(
      "Prospect name or characteristics to search for. Examples: 'John Smith', 'prospects with high net worth', 'major donors'"
    ),
  limit: z
    .number()
    .optional()
    .default(5)
    .describe("Maximum number of prospects to return (default: 5, max: 20)"),
})

type BatchReportsSearchParams = z.infer<typeof batchReportsSearchSchema>

/**
 * Create a batch reports search tool bound to a specific user
 * @param userId - User ID to search reports for
 */
export const createBatchReportsSearchTool = (userId: string) =>
  (tool as any)({
    description:
      "Search your previously researched prospects from batch processing. Use this to find details about prospects you've already researched, including their RomyScore, capacity rating, net worth estimates, gift capacity, and philanthropic profiles. This is useful when discussing prospects by name or looking for prospects with specific characteristics.",
    parameters: batchReportsSearchSchema,
    execute: async ({ query, limit }: BatchReportsSearchParams) => {
      try {
        // Get OpenRouter API key from environment
        const openrouterKey = process.env.OPENROUTER_API_KEY
        if (!openrouterKey) {
          return {
            success: false,
            error: "Prospect search is not configured (missing API key)",
            prospects: [],
          }
        }

        // Search batch reports using the bound userId
        const results = await searchBatchReports(
          {
            query,
            userId,
            limit: Math.min(limit, 20), // Cap at 20
            similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
          },
          openrouterKey
        )

        if (results.length === 0) {
          return {
            success: true,
            message: "No matching prospects found in your batch research history.",
            prospects: [],
            query,
          }
        }

        // Format results for the AI with relevant prospect details
        const formattedProspects = results.map((result) => {
          // Get tier name from score
          let tier = "Unknown"
          if (result.romy_score !== null) {
            if (result.romy_score >= 31) tier = "Transformational"
            else if (result.romy_score >= 21) tier = "Principal"
            else if (result.romy_score >= 11) tier = "Leadership"
            else tier = "Annual"
          }

          // Format currency values
          const formatCurrency = (value: number | null): string | null => {
            if (value === null || value === undefined) return null
            if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
            if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
            return `$${value.toLocaleString()}`
          }

          return {
            name: result.prospect_name,
            romy_score: result.romy_score,
            score_tier: tier,
            capacity_rating: result.capacity_rating,
            estimated_net_worth: formatCurrency(result.estimated_net_worth),
            estimated_gift_capacity: formatCurrency(result.estimated_gift_capacity),
            sources_count: result.sources_found?.length || 0,
            similarity: Math.round(result.similarity * 100),
            researched_on: result.created_at,
            // Include full report for detailed context
            full_report: result.report_content,
          }
        })

        return {
          success: true,
          prospects: formattedProspects,
          count: results.length,
          query,
          message: `Found ${results.length} matching ${results.length === 1 ? "prospect" : "prospects"} in your research history.`,
        }
      } catch (error) {
        console.error("[BatchReportsSearch] Error:", error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to search prospects",
          prospects: [],
        }
      }
    },
  })

/**
 * Tool name for registration
 */
export const BATCH_REPORTS_SEARCH_TOOL_NAME = "search_prospects"
