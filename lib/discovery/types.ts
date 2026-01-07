/**
 * Prospect Discovery Types
 *
 * Type definitions for the Prospect Discovery feature that allows users
 * to describe ideal donors and discover matching real-world prospects.
 *
 * @module lib/discovery/types
 */

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

/**
 * Placeholder definition for template prompts
 */
export interface TemplatePlaceholder {
  /** Placeholder key in template (e.g., "[city]") */
  key: string
  /** Display label for the input field */
  label: string
  /** Input type */
  type: "text" | "select"
  /** Options for select type */
  options?: string[]
  /** Whether this placeholder is required */
  required: boolean
  /** Default value (optional) */
  defaultValue?: string
}

/**
 * Pre-built discovery template prompt
 */
export interface DiscoveryTemplate {
  /** Unique identifier */
  id: string
  /** Display title */
  title: string
  /** Short description shown on card */
  description: string
  /** Full prompt text with placeholders */
  prompt: string
  /** Placeholders to fill */
  placeholders?: TemplatePlaceholder[]
  /** Category for grouping */
  category: "business" | "philanthropy" | "wealth" | "demographics"
  /** Estimated cost in cents */
  estimatedCostCents: number
  /** Icon name from Phosphor icons */
  icon?: string
}

// ============================================================================
// REQUEST TYPES
// ============================================================================

/**
 * Discovery search request from client
 */
export interface DiscoveryRequest {
  /** Natural language prompt describing ideal prospects */
  prompt: string
  /** Maximum number of prospects to find (5-25) */
  maxResults: number
  /** Template ID if using a template */
  templateId?: string
  /** Optional location filter */
  location?: {
    city?: string
    state?: string
    region?: string
  }
  /** Optional focus areas for targeted search */
  focusAreas?: DiscoveryFocusArea[]
  /** Use Deep Research mode (LinkUp deep mode) - Growth/Scale plans only */
  deepResearch?: boolean
}

/**
 * Focus areas for discovery search
 */
export type DiscoveryFocusArea =
  | "real_estate"
  | "business"
  | "philanthropy"
  | "securities"
  | "biography"

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Confidence level for a discovered prospect
 */
export type ProspectConfidence = "high" | "medium" | "low"

/**
 * Source citation for a discovered prospect
 */
export interface ProspectSource {
  /** Source name/title */
  name: string
  /** Source URL */
  url: string
  /** Relevant snippet from source */
  snippet?: string
}

/**
 * Individual discovered prospect
 */
export interface DiscoveredProspect {
  /** Full name of the prospect */
  name: string
  /** Job title or role */
  title?: string
  /** Company or organization name */
  company?: string
  /** City */
  city?: string
  /** State (2-letter code) */
  state?: string
  /** Confidence level based on source quality */
  confidence: ProspectConfidence
  /** Reasons why this prospect matches the criteria */
  matchReasons: string[]
  /** Sources where this prospect was found */
  sources: ProspectSource[]
  /** Unique identifier for selection */
  id: string
}

/**
 * Discovery search result
 */
export interface DiscoveryResult {
  /** Whether the search was successful */
  success: boolean
  /** List of discovered prospects */
  prospects: DiscoveredProspect[]
  /** Total prospects found (before deduplication) */
  totalFound: number
  /** The query that was executed */
  queryExecuted: string
  /** Duration in milliseconds */
  durationMs: number
  /** Estimated cost in cents */
  estimatedCostCents: number
  /** Number of LinkUp queries executed */
  queryCount: number
  /** Any warnings (e.g., partial results) */
  warnings?: string[]
  /** Error message if success is false */
  error?: string
  /** Error code for programmatic handling */
  errorCode?: DiscoveryErrorCode
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Error codes for discovery failures
 */
export type DiscoveryErrorCode =
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "LINKUP_UNAVAILABLE"
  | "NO_RESULTS"
  | "TIMEOUT"
  | "INSUFFICIENT_CREDITS"
  | "SERVER_ERROR"

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  /** Remaining requests in current window */
  remaining: number
  /** Total allowed in window */
  limit: number
  /** Seconds until reset */
  resetInSeconds: number
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

/**
 * Discovery session state for the UI
 */
export interface DiscoverySession {
  /** Session ID */
  id: string
  /** Original request */
  request: DiscoveryRequest
  /** Search result */
  result: DiscoveryResult | null
  /** IDs of selected prospects */
  selectedProspectIds: Set<string>
  /** Session status */
  status: "idle" | "searching" | "completed" | "error"
  /** Timestamp */
  createdAt: Date
}

/**
 * Template with filled placeholders
 */
export interface FilledTemplate {
  /** The template */
  template: DiscoveryTemplate
  /** Filled placeholder values */
  values: Record<string, string>
  /** Final prompt after placeholder replacement */
  filledPrompt: string
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Discovery feature configuration
 */
export interface DiscoveryConfig {
  /** Maximum results per search */
  maxResultsLimit: number
  /** Minimum results per search */
  minResultsLimit: number
  /** Default results count */
  defaultResults: number
  /** Rate limit per hour */
  rateLimitPerHour: number
  /** Cost per discovery search in cents */
  costPerSearchCents: number
  /** Cost per enrichment in cents */
  costPerEnrichmentCents: number
  /** Maximum prompt length */
  maxPromptLength: number
  /** Minimum prompt length */
  minPromptLength: number
  /** Search timeout in milliseconds */
  searchTimeoutMs: number
}

/**
 * Default discovery configuration
 */
export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  maxResultsLimit: 25,
  minResultsLimit: 5,
  defaultResults: 15,
  rateLimitPerHour: 10,
  costPerSearchCents: 2, // $0.02 for 3 LinkUp queries
  costPerEnrichmentCents: 4, // $0.04 per prospect
  maxPromptLength: 2000,
  minPromptLength: 10,
  searchTimeoutMs: 60000,
}

// ============================================================================
// BATCH INTEGRATION TYPES
// ============================================================================

/**
 * Prospect data for batch job creation
 * Compatible with existing ProspectInputData from batch-processing
 */
export interface DiscoveryProspectInput {
  /** Full name (required) */
  name: string
  /** City (optional) */
  city?: string
  /** State (optional) */
  state?: string
  /** Company (optional) */
  company?: string
  /** Title (optional) */
  title?: string
  /** Notes including match reasons */
  notes?: string
}

/**
 * Request to create batch job from discovery
 */
export interface CreateBatchFromDiscoveryRequest {
  /** Job name */
  name: string
  /** Prospects to enrich */
  prospects: DiscoveryProspectInput[]
  /** Original discovery prompt for reference */
  sourcePrompt?: string
}
