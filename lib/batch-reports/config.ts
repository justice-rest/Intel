/**
 * Batch Reports RAG Configuration
 *
 * Configuration for batch prospect report retrieval and auto-injection
 */

// ============================================================================
// FEATURE FLAGS
// ============================================================================

/**
 * Check if batch reports RAG is enabled
 * Enabled by default but can be disabled via env variable
 */
export function isBatchReportsRAGEnabled(): boolean {
  return process.env.ENABLE_BATCH_REPORTS_RAG !== "false"
}

// ============================================================================
// RETRIEVAL CONFIGURATION
// ============================================================================

/**
 * Default number of batch reports to auto-inject into context
 */
export const AUTO_INJECT_COUNT = 3

/**
 * Default similarity threshold for batch report search (0-1)
 * Lower threshold to be more permissive with matches
 */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.3

/**
 * Maximum number of reports to return from search
 */
export const MAX_SEARCH_RESULTS = 20

/**
 * Timeout for auto-injection retrieval (milliseconds)
 * Must be fast to not block chat streaming
 */
export const OPERATION_TIMEOUT_MS = 200

// ============================================================================
// EMBEDDING CONFIGURATION
// ============================================================================

/**
 * Vector embedding dimensions
 * Using 1536 to match RAG and memory systems
 */
export const EMBEDDING_DIMENSIONS = 1536

/**
 * Embedding model to use for report vectors
 */
export const EMBEDDING_MODEL = "text-embedding-3-small"

/**
 * Provider for embedding generation
 */
export const EMBEDDING_PROVIDER = "openrouter"
