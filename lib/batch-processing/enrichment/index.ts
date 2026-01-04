/**
 * Prospect Intelligence Engine - Module Exports
 *
 * A revolutionary prospect enrichment system that surpasses competitors like
 * DonorSearch, iWave, WealthEngine, and Windfall by providing:
 *
 * 1. Multi-source triangulation with per-field confidence scoring
 * 2. AI-synthesized strategic briefs (not just data dumps)
 * 3. Gift timing intelligence (optimal moment to ask)
 * 4. Relationship mapping (board connections, shared networks)
 * 5. Competitive giving intelligence (where else they give)
 * 6. Actionable cultivation strategy
 *
 * @example
 * ```typescript
 * import { enrichProspect, EnrichmentMode } from "@/lib/batch-processing/enrichment"
 *
 * const result = await enrichProspect({
 *   prospect: { name: "John Smith", city: "San Francisco", state: "CA" },
 *   mode: "STANDARD",
 * })
 *
 * if (result.success) {
 *   console.log(result.intelligence.executiveSummary)
 *   console.log(result.intelligence.strategy.ask.recommendedAmount)
 * }
 * ```
 */

// Types
export type {
  // Confidence & Source Types
  DataConfidence,
  SourceCategory,
  SourceCitation,
  EnrichedDataPoint,

  // Wealth Intelligence
  PropertyIntelligence,
  BusinessIntelligence,
  SecuritiesIntelligence,
  WealthIntelligence,

  // Philanthropic Intelligence
  PoliticalGivingIntelligence,
  FoundationIntelligence,
  MajorGiftRecord,
  PhilanthropicIntelligence,

  // Relationship Intelligence
  ConnectionIntelligence,
  RelationshipIntelligence,

  // Timing Intelligence
  TimingSignalType,
  TimingSignal,
  TimingIntelligence,

  // Strategy Types
  AskStrategy,
  CultivationStrategy,
  ConversationIntelligence,
  CompetitiveIntelligence,

  // Main Output
  ProspectIntelligence,

  // Request/Response
  EnrichmentMode,
  EnrichmentRequest,
  EnrichmentResponse,

  // Batch Types
  BatchEnrichmentJob,
  BatchEnrichmentItem,
} from "./types"

// Data Sources
export {
  DATA_SOURCES,
  getSourcesForDataType,
  getBestSourceForDataType,
  calculateTriangulatedConfidence,
  estimateEnrichmentCost,
  type DataSourceConfig,
} from "./data-sources"

// AI Synthesis
export {
  generateExecutiveSummary,
  generateAskStrategy,
  generateCultivationStrategy,
  generateConversationIntelligence,
  generateCompetitiveIntelligence,
  synthesizeFullStrategy,
  type ExecutiveSummary,
} from "./ai-synthesis"

// Main Engine
export { enrichProspect } from "./engine"

// Queue System
export {
  EnrichmentQueue,
  createBatchEnrichmentJob,
  runBatchEnrichment,
  type EnrichmentQueueItem,
  type EnrichmentProgressEvent,
  type QueueConfig,
} from "./queue"

// Research History & Change Detection
export {
  detectChanges,
  generateProspectKey,
  createResearchSnapshot,
  getStalenessWarning,
  type ResearchSnapshot,
  type ChangeDetectionResult,
  type ChangeItem,
} from "./history"
