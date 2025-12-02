/**
 * Batch Reports RAG Module
 *
 * Main entry point for batch prospect report retrieval system
 * Enables AI to access previously researched prospects during conversations
 */

// Configuration
export { isBatchReportsRAGEnabled } from "./config"
export {
  AUTO_INJECT_COUNT,
  DEFAULT_SIMILARITY_THRESHOLD,
  MAX_SEARCH_RESULTS,
  OPERATION_TIMEOUT_MS,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER,
} from "./config"

// Types
export type {
  BatchReportSearchResult,
  BatchReportSearchParams,
  BatchReportSummary,
  GenerateEmbeddingParams,
  EmbeddingGenerationResult,
  BackfillResult,
  AutoInjectParams,
} from "./types"

// Storage operations
export {
  generateBatchReportEmbedding,
  backfillBatchReportEmbeddings,
  hasEmbedding,
} from "./storage"

// Retrieval operations
export {
  searchBatchReports,
  getBatchReportsForAutoInject,
  formatBatchReportsForPrompt,
  findProspectByName,
} from "./retrieval"
