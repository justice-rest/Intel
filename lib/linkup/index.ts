/**
 * LinkUp Search Integration Module
 *
 * Enterprise-grade web search integration for prospect research.
 * Provides comprehensive, cited research with circuit breaker protection.
 *
 * USAGE:
 *
 * ```typescript
 * // For chat tools
 * import { createLinkUpProspectResearchTool, shouldEnableLinkUpTools } from "@/lib/linkup"
 *
 * if (shouldEnableLinkUpTools()) {
 *   const tool = createLinkUpProspectResearchTool(isDeepMode)
 * }
 *
 * // For batch processing
 * import { linkupBatchSearch } from "@/lib/linkup"
 *
 * const result = await linkupBatchSearch({
 *   name: "John Smith",
 *   address: "123 Main St, San Francisco, CA 94102",
 *   employer: "Acme Corp",
 * })
 * ```
 */

// Client exports
export {
  linkupSearch,
  linkupParallelSearch,
  getLinkUpStatus,
  resetLinkUpCircuitBreaker,
  estimateSearchCost,
  type LinkUpSearchOptions,
  type LinkUpSearchResult,
  type LinkUpError,
  type LinkUpErrorCode,
} from "./client"

// Config exports
export {
  getLinkUpFlags,
  getLinkUpConfig,
  isLinkUpConfigured,
  isLinkUpAvailable,
  LINKUP_PRICING,
  PRIORITY_DOMAINS,
  BLOCKED_DOMAINS,
  type LinkUpConfig,
  type LinkUpFeatureFlags,
} from "./config"

// Monitoring exports
export {
  getMetrics,
  resetMetrics,
  getHealthStatus,
  getRecentLogs,
  trackSearchCall,
  type LinkUpMetrics,
  type HealthStatus,
  type LogEntry,
} from "./monitoring"

// Tool exports (re-exported from tools module for convenience)
export {
  createLinkUpProspectResearchTool,
  linkupProspectResearchTool,
  linkupBatchSearch,
  shouldEnableLinkUpTools,
  getLinkUpAvailabilityMessage,
  type LinkUpProspectResult,
  type ProspectStructuredData,
} from "@/lib/tools/linkup-prospect-research"
