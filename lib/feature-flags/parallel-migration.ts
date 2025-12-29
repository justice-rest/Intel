/**
 * Parallel AI Migration Feature Flags
 *
 * Controls the gradual rollout of Parallel AI as the sole search provider.
 * No fallback to LinkUp or Perplexity - aggressive mode.
 *
 * USAGE:
 * - Set PARALLEL_ENABLED=true to start rollout
 * - Set PARALLEL_ROLLOUT_PERCENT to control what % of users get Parallel
 * - Feature-specific flags control individual APIs
 *
 * SAFETY:
 * - Uses consistent hashing so same user always gets same experience
 * - Feature flags are granular - can disable individual features
 * - If Parallel is disabled, users see "research unavailable" message
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ParallelMigrationFlags {
  /**
   * Master kill switch - disables ALL Parallel features
   * Set to false to completely disable Parallel and show "research unavailable"
   */
  PARALLEL_ENABLED: boolean

  /**
   * Phase 1: Chat prospect research tool
   * Replaces linkup_prospect_research and perplexity_prospect_research
   */
  PARALLEL_CHAT_SEARCH: boolean

  /**
   * Phase 2: Batch processing with Task API
   * Structured JSON output, replaces batch LinkUp + Sonar calls
   */
  PARALLEL_BATCH_SEARCH: boolean

  /**
   * Phase 2b: Use Task API for structured output
   * Returns JSON directly instead of parsing text
   */
  PARALLEL_TASK_API: boolean

  /**
   * Phase 3: URL content extraction
   * Replaces Firecrawl for extracting content from URLs
   */
  PARALLEL_EXTRACT: boolean

  /**
   * Phase 4: Prospect discovery (NEW FEATURE)
   * FindAll API - discover prospects matching criteria
   */
  PARALLEL_FINDALL: boolean

  /**
   * Phase 5: Real-time monitoring (NEW FEATURE)
   * Monitor API - watch for news/events about prospects
   */
  PARALLEL_MONITOR: boolean

  /**
   * Rollout percentage (0-100)
   * Controls what percentage of users get Parallel
   * Uses consistent hashing - same user always gets same result
   */
  PARALLEL_ROLLOUT_PERCENT: number
}

// ============================================================================
// DEFAULT FLAGS
// ============================================================================

/**
 * Default flags - ALL DISABLED for safety
 * Must explicitly enable via environment variables
 */
const DEFAULT_FLAGS: ParallelMigrationFlags = {
  PARALLEL_ENABLED: false,
  PARALLEL_CHAT_SEARCH: false,
  PARALLEL_BATCH_SEARCH: false,
  PARALLEL_TASK_API: false,
  PARALLEL_EXTRACT: false,
  PARALLEL_FINDALL: false,
  PARALLEL_MONITOR: false,
  PARALLEL_ROLLOUT_PERCENT: 0,
}

// ============================================================================
// FLAG RETRIEVAL
// ============================================================================

/**
 * Get current feature flags from environment variables
 * Environment variables override defaults
 *
 * @returns Current feature flag configuration
 */
export function getParallelFlags(): ParallelMigrationFlags {
  // Parse and clamp rollout percentage to valid range [0, 100]
  const rawRollout = parseInt(process.env.PARALLEL_ROLLOUT_PERCENT || "0", 10)
  const rolloutPercent = Number.isNaN(rawRollout)
    ? 0
    : Math.max(0, Math.min(100, rawRollout))

  return {
    PARALLEL_ENABLED: process.env.PARALLEL_ENABLED === "true",
    PARALLEL_CHAT_SEARCH: process.env.PARALLEL_CHAT_SEARCH === "true",
    PARALLEL_BATCH_SEARCH: process.env.PARALLEL_BATCH_SEARCH === "true",
    PARALLEL_TASK_API: process.env.PARALLEL_TASK_API === "true",
    PARALLEL_EXTRACT: process.env.PARALLEL_EXTRACT === "true",
    PARALLEL_FINDALL: process.env.PARALLEL_FINDALL === "true",
    PARALLEL_MONITOR: process.env.PARALLEL_MONITOR === "true",
    PARALLEL_ROLLOUT_PERCENT: rolloutPercent,
  }
}

// ============================================================================
// ROLLOUT LOGIC
// ============================================================================

/**
 * Consistent hash for user-based rollout
 *
 * CRITICAL: Same user always gets same result (no flip-flopping between requests)
 * Uses simple string hash to generate deterministic number 0-99
 *
 * @param userId - User ID to hash (must be non-empty string)
 * @returns Number between 0 and 99
 */
function hashUserId(userId: string): number {
  // Safety: ensure userId is a non-empty string
  if (!userId || typeof userId !== "string" || userId.length === 0) {
    // Return a consistent value for invalid inputs (always excluded from rollout)
    return 99
  }

  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash) % 100
}

/**
 * Feature flag keys that can be checked
 */
type ParallelFeatureFlag =
  | "PARALLEL_CHAT_SEARCH"
  | "PARALLEL_BATCH_SEARCH"
  | "PARALLEL_TASK_API"
  | "PARALLEL_EXTRACT"
  | "PARALLEL_FINDALL"
  | "PARALLEL_MONITOR"

/**
 * Check if Parallel should be used for a specific user and feature
 *
 * Checks:
 * 1. Master kill switch (PARALLEL_ENABLED)
 * 2. Feature-specific flag
 * 3. Rollout percentage (using consistent hashing)
 *
 * @param userId - User ID for rollout percentage calculation
 * @param feature - Which feature to check
 * @returns true if Parallel should be used, false otherwise
 */
export function shouldUseParallel(userId: string, feature: ParallelFeatureFlag): boolean {
  const flags = getParallelFlags()

  // Master kill switch - if disabled, nothing works
  if (!flags.PARALLEL_ENABLED) {
    return false
  }

  // Feature-specific flag must be enabled
  if (!flags[feature]) {
    return false
  }

  // If rollout is 100%, everyone gets Parallel
  if (flags.PARALLEL_ROLLOUT_PERCENT >= 100) {
    return true
  }

  // If rollout is 0%, no one gets Parallel
  if (flags.PARALLEL_ROLLOUT_PERCENT <= 0) {
    return false
  }

  // Use consistent hashing to determine if user is in rollout
  const userHash = hashUserId(userId)
  return userHash < flags.PARALLEL_ROLLOUT_PERCENT
}

/**
 * Check if Parallel API key is configured
 *
 * @returns true if PARALLEL_API_KEY environment variable is set
 */
export function isParallelConfigured(): boolean {
  return !!process.env.PARALLEL_API_KEY
}

/**
 * Check if Parallel is fully available (enabled + configured)
 *
 * @returns true if Parallel can be used
 */
export function isParallelAvailable(): boolean {
  const flags = getParallelFlags()
  return flags.PARALLEL_ENABLED && isParallelConfigured()
}

// ============================================================================
// DEBUG / ADMIN UTILITIES
// ============================================================================

/**
 * Get detailed flag status for debugging
 * Useful for health check endpoints and admin dashboards
 *
 * @returns Detailed flag status with computed values
 */
export function getParallelFlagStatus(): {
  flags: ParallelMigrationFlags
  apiKeyConfigured: boolean
  isAvailable: boolean
  environment: string
} {
  return {
    flags: getParallelFlags(),
    apiKeyConfigured: isParallelConfigured(),
    isAvailable: isParallelAvailable(),
    environment: process.env.NODE_ENV || "development",
  }
}

/**
 * Check which bucket a user falls into for rollout
 * Useful for debugging why a specific user is/isn't getting Parallel
 *
 * @param userId - User ID to check
 * @returns User's hash value and rollout status
 */
export function getUserRolloutStatus(userId: string): {
  userId: string
  userHash: number
  rolloutPercent: number
  inRollout: boolean
} {
  const flags = getParallelFlags()
  const userHash = hashUserId(userId)

  return {
    userId: userId.slice(0, 8) + "...", // Truncate for privacy
    userHash,
    rolloutPercent: flags.PARALLEL_ROLLOUT_PERCENT,
    inRollout: userHash < flags.PARALLEL_ROLLOUT_PERCENT,
  }
}
