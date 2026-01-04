/**
 * Batch Processing Module
 *
 * Production-ready batch research system with:
 * - Schema validation with retry (Instructor-style)
 * - Checkpoint-based resume capability
 * - Circuit breaker protection
 * - Multi-source triangulation
 * - Direct API verification (SEC, FEC, ProPublica)
 * - Adaptive research depth
 * - Full data provenance tracking
 *
 * NOTE: report-generator.ts is NOT exported here because it imports
 * server-only dependencies (AI tools). Import it directly in API routes:
 * import { generateProspectReport, processBatchItem } from "@/lib/batch-processing/report-generator"
 *
 * @example
 * ```ts
 * import {
 *   createResearchPipeline,
 *   createCheckpointManager,
 *   getBatchProcessingCircuitBreakers,
 * } from "@/lib/batch-processing"
 *
 * const pipeline = createResearchPipeline()
 * const result = await pipeline.executeForItem(itemId, prospect, { apiKey })
 * ```
 */

// ============================================================================
// CORE EXPORTS (existing)
// ============================================================================

// Types
export * from "./types"

// Configuration
export * from "./config"

// Parser
export * from "./parser"

// ============================================================================
// SCHEMAS & EXTRACTION
// ============================================================================

export {
  ProspectResearchOutputSchema,
  LenientProspectResearchOutputSchema,
  validateProspectOutput,
  parseLenientProspectOutput,
  generateValidationErrorPrompt,
  type ValidatedProspectResearchOutput,
  type LenientProspectResearchOutput,
} from "./schemas/prospect-output"

export {
  extractWithValidation,
  extractProspectResearchOutput,
  extractOnce,
  extractJsonFromResponse,
  hasMinimalData,
  calculateDataQualityScore,
  type ExtractionOptions,
  type ExtractionResult,
} from "./extraction/validated-parser"

// ============================================================================
// CHECKPOINTS
// ============================================================================

// NOTE: CheckpointManager uses server-only Supabase client.
// Import directly in API routes: import { CheckpointManager } from "@/lib/batch-processing/checkpoints/manager"
// Only InMemoryCheckpointManager is safe for client-side imports.
export { InMemoryCheckpointManager } from "./checkpoints/in-memory-manager"

export type {
  CheckpointStatus,
  PipelineStepName,
  CheckpointRecord,
  StepMeta,
  StepResult,
  StepContext,
  PipelineStepDefinition,
  PipelineResult,
  ICheckpointManager,
} from "./checkpoints/types"

// ============================================================================
// RESILIENCE
// ============================================================================

export {
  CircuitBreaker,
  circuitBreakerRegistry,
  getBatchProcessingCircuitBreakers,
  isCircuitBreakerError,
  executeWithFallback,
  CIRCUIT_BREAKER_CONFIGS,
} from "./resilience/circuit-breaker"

export {
  executeWithRetry,
  executeWithRetryOrThrow,
  createRetryPolicy,
  isRateLimitError,
  isTimeoutError,
  BATCH_PROCESSING_RETRY_POLICIES,
} from "./resilience/retry-policy"

export {
  TokenBucketRateLimiter,
  rateLimiterRegistry,
  getBatchProcessingRateLimiters,
  batchWithRateLimit,
} from "./resilience/rate-limiter"

// ============================================================================
// PIPELINE
// ============================================================================

// NOTE: Pipeline uses server-only dependencies (Supabase, AI tools).
// Import directly in API routes:
//   import { ResearchPipeline, createResearchPipeline } from "@/lib/batch-processing/pipeline/research-pipeline"
//   import { StepExecutor, createStepExecutor } from "@/lib/batch-processing/pipeline/step-executor"
//
// Re-export types only (safe for client):
export type {
  ResearchPipelineConfig,
  ResearchPipelineResult,
} from "./pipeline/research-pipeline"

// ============================================================================
// IDEMPOTENCY
// ============================================================================

// NOTE: Idempotency manager uses server-only Supabase client.
// Import directly in API routes:
//   import { withIdempotency, createIdempotencyManager } from "@/lib/batch-processing/idempotency/keys"
//
// Only client-safe utilities exported here:
export { generateIdempotencyKey, hashInput } from "./idempotency/utils"

// ============================================================================
// DEAD LETTER QUEUE
// ============================================================================

// NOTE: DLQ manager uses server-only Supabase client.
// Import directly in API routes:
//   import { createDLQManager, dlqManager } from "@/lib/batch-processing/dead-letter/manager"
//
// Only types exported here:
export type {
  DLQResolution,
  DeadLetterItem,
  DLQStats,
} from "./dead-letter/manager"

// ============================================================================
// TRIANGULATION
// ============================================================================

export {
  triangulateData,
  quickMerge,
  calculateFieldConfidence,
  calculateOverallConfidence,
  SOURCE_REGISTRY,
  identifySource,
  getSourceAuthority,
  type TriangulatedResult,
  type ConfidenceLevel,
  type SourceCitation,
  type FieldConfidence,
  type SourceCategory,
} from "./triangulation"

// ============================================================================
// VERIFICATION
// ============================================================================

export {
  verifySecInsider,
  searchSecProxy,
  verifyFecContributions,
  hasFecContributions,
  verifyNonprofitAffiliations,
  searchNonprofits,
  getNonprofitDetails,
} from "./verification"

// ============================================================================
// ADAPTIVE DEPTH
// ============================================================================

export {
  extractIndicators,
  selectDepth,
  selectDepthFromOutput,
  analyzeBatchDepth,
  getDepthDescription,
  DEPTH_CONFIGS,
  type ResearchDepth,
  type DepthConfig,
  type DepthSelectionResult,
  type PreliminaryIndicators,
} from "./adaptive/depth-selector"

// ============================================================================
// PROVENANCE
// ============================================================================

// NOTE: Provenance manager uses server-only Supabase client.
// Import directly in API routes:
//   import { createProvenanceManager, provenanceManager } from "@/lib/batch-processing/provenance/manager"
//
// Only types exported here:
export type {
  ProvenanceRecord,
  ProvenanceInput,
  AuditReport,
} from "./provenance/manager"

// ============================================================================
// WEBHOOKS
// ============================================================================

export {
  sendWebhookNotification,
  buildWebhookPayload,
  triggerBatchCompletionWebhook,
  type WebhookPayload,
  type WebhookResult,
} from "./webhooks"

// ============================================================================
// REALTIME
// ============================================================================

// NOTE: Realtime hooks use client-side Supabase and React hooks.
// Import directly in components:
//   import { useBatchRealtimeUpdates, useBatchItemsRealtime } from "@/lib/batch-processing/realtime"
