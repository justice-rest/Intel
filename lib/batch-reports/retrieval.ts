/**
 * Batch Reports Retrieval Module
 *
 * Handles semantic search and retrieval of batch prospect reports
 * Optimized for speed with timeouts to prevent blocking chat streaming
 */

import { createClient } from "@/lib/supabase/server"
import { generateEmbedding } from "@/lib/rag/embeddings"
import { getCachedEmbedding, setCachedEmbedding } from "@/lib/memory/embedding-cache"
import type {
  BatchReportSearchResult,
  BatchReportSearchParams,
  AutoInjectParams,
} from "./types"
import {
  DEFAULT_SIMILARITY_THRESHOLD,
  AUTO_INJECT_COUNT,
  MAX_SEARCH_RESULTS,
  OPERATION_TIMEOUT_MS,
} from "./config"

// ============================================================================
// TIMEOUT UTILITY
// ============================================================================

/**
 * Promise.race with timeout - returns fallback if operation takes too long
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  const timeout = new Promise<T>((resolve) =>
    setTimeout(() => resolve(fallback), timeoutMs)
  )
  return Promise.race([promise, timeout])
}

// ============================================================================
// SEMANTIC SEARCH
// ============================================================================

/**
 * Search batch reports using semantic similarity
 *
 * @param params - Search parameters
 * @param apiKey - OpenRouter API key for embedding generation
 * @returns Array of matching reports with similarity scores
 */
export async function searchBatchReports(
  params: BatchReportSearchParams,
  apiKey: string
): Promise<BatchReportSearchResult[]> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      console.error("[BatchReports] Supabase not configured")
      return []
    }

    // Check embedding cache first for faster response
    let embedding = getCachedEmbedding(params.query)

    if (!embedding) {
      // Generate embedding for search query
      const result = await generateEmbedding(params.query, apiKey)
      embedding = result.embedding
      // Cache for future use
      setCachedEmbedding(params.query, embedding)
    }

    // Convert embedding to JSON string for Supabase RPC
    const embeddingString = JSON.stringify(embedding)

    // Call Supabase function for vector similarity search
    // Use type assertion since search_batch_reports is not in generated types
    const { data, error } = await (supabase as any).rpc("search_batch_reports", {
      query_embedding: embeddingString,
      match_user_id: params.userId,
      match_count: Math.min(params.limit || 5, MAX_SEARCH_RESULTS),
      similarity_threshold: params.similarityThreshold || DEFAULT_SIMILARITY_THRESHOLD,
    }) as { data: BatchReportSearchResult[] | null; error: any }

    if (error) {
      console.error("[BatchReports] Search error:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("[BatchReports] Failed to search reports:", error)
    return []
  }
}

// ============================================================================
// AUTO-INJECTION
// ============================================================================

/**
 * Get relevant batch reports for auto-injection into conversation context
 *
 * OPTIMIZED: Uses timeout to prevent blocking streaming
 * If retrieval takes > 200ms, returns empty and continues without reports
 *
 * @param params - Auto-injection parameters
 * @param apiKey - OpenRouter API key
 * @returns Array of relevant reports
 */
export async function getBatchReportsForAutoInject(
  params: AutoInjectParams,
  apiKey: string
): Promise<BatchReportSearchResult[]> {
  try {
    const { conversationContext, userId, count } = params

    if (!conversationContext || conversationContext.trim().length === 0) {
      return []
    }

    // Wrap in timeout to prevent blocking streaming
    const reportsPromise = searchBatchReports(
      {
        query: conversationContext,
        userId,
        limit: count || AUTO_INJECT_COUNT,
        similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
      },
      apiKey
    )

    return await withTimeout(reportsPromise, OPERATION_TIMEOUT_MS, [])
  } catch (error) {
    console.error("[BatchReports] Failed to get reports for auto-inject:", error)
    return []
  }
}

// ============================================================================
// PROMPT FORMATTING
// ============================================================================

/**
 * Format currency value for display
 */
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "Unknown"
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`
  }
  return `$${value.toLocaleString()}`
}

/**
 * Get tier name from RomyScore
 */
function getScoreTier(score: number | null): string {
  if (score === null) return "Unknown"
  if (score >= 31) return "Transformational"
  if (score >= 21) return "Principal"
  if (score >= 11) return "Leadership"
  return "Annual"
}

/**
 * Format batch reports for injection into system prompt
 * Creates a concise summary for each prospect
 *
 * @param reports - Array of batch report search results
 * @returns Formatted string to inject into prompt
 */
export function formatBatchReportsForPrompt(
  reports: BatchReportSearchResult[]
): string {
  if (!reports || reports.length === 0) {
    return ""
  }

  const formattedReports = reports
    .map((report, index) => {
      const tier = getScoreTier(report.romy_score)
      const netWorth = formatCurrency(report.estimated_net_worth)
      const giftCapacity = formatCurrency(report.estimated_gift_capacity)
      const capacityRating = report.capacity_rating || "Unknown"

      return `${index + 1}. **${report.prospect_name}**: RomyScore ${report.romy_score || "?"}/41 (${tier}), ${capacityRating} Donor
   - Est. Net Worth: ${netWorth} | Gift Capacity: ${giftCapacity}`
    })
    .join("\n")

  return `
# Previously Researched Prospects

The following prospects have been researched previously. Use this context when discussing them:

${formattedReports}

You can use the search_prospects tool to find more details about these or other previously researched prospects.
`
}

// ============================================================================
// DIRECT LOOKUP
// ============================================================================

/**
 * Search for a specific prospect by name
 * Useful for explicit lookups when user mentions a prospect
 *
 * @param prospectName - Name of the prospect to find
 * @param userId - User ID
 * @param apiKey - OpenRouter API key
 * @returns Matching reports
 */
export async function findProspectByName(
  prospectName: string,
  userId: string,
  apiKey: string
): Promise<BatchReportSearchResult[]> {
  return searchBatchReports(
    {
      query: `Prospect: ${prospectName}`,
      userId,
      limit: 5,
      similarityThreshold: 0.6, // Lower threshold for name-based search
    },
    apiKey
  )
}
