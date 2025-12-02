/**
 * Batch Reports RAG Types
 *
 * Type definitions for batch prospect report search and retrieval
 */

// ============================================================================
// SEARCH RESULT TYPES
// ============================================================================

/**
 * Result from batch report semantic search
 */
export interface BatchReportSearchResult {
  id: string
  prospect_name: string
  report_content: string | null
  romy_score: number | null
  capacity_rating: string | null
  estimated_net_worth: number | null
  estimated_gift_capacity: number | null
  sources_found: Array<{ name: string; url: string }> | null
  similarity: number
  created_at: string
}

/**
 * Parameters for searching batch reports
 */
export interface BatchReportSearchParams {
  query: string
  userId: string
  limit?: number
  similarityThreshold?: number
}

/**
 * Condensed summary for prompt injection
 */
export interface BatchReportSummary {
  prospect_name: string
  romy_score: number | null
  romy_score_tier: string | null
  capacity_rating: string | null
  estimated_net_worth: number | null
  estimated_gift_capacity: number | null
}

// ============================================================================
// STORAGE TYPES
// ============================================================================

/**
 * Parameters for generating a batch report embedding
 */
export interface GenerateEmbeddingParams {
  itemId: string
  reportContent: string
  prospectName: string
}

/**
 * Result of embedding generation
 */
export interface EmbeddingGenerationResult {
  success: boolean
  itemId: string
  error?: string
}

/**
 * Result of backfill operation
 */
export interface BackfillResult {
  processed: number
  failed: number
  skipped: number
}

// ============================================================================
// AUTO-INJECT TYPES
// ============================================================================

/**
 * Parameters for auto-injection retrieval
 */
export interface AutoInjectParams {
  conversationContext: string
  userId: string
  count?: number
}
