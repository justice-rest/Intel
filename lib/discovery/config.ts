/**
 * Discovery Configuration
 * Limits, costs, and settings for the FindAll discovery system
 */

// ============================================================================
// LIMITS
// ============================================================================

/** Maximum discovery jobs per user per day */
export const DISCOVERY_DAILY_LIMIT = 10

/** Maximum discovery jobs stored per user */
export const DISCOVERY_MAX_STORED_JOBS = 50

/** Maximum candidates per discovery run */
export const DISCOVERY_MAX_CANDIDATES = 50

/** Minimum candidates per discovery run (FindAll API requirement) */
export const DISCOVERY_MIN_CANDIDATES = 5

/** Maximum match conditions per job */
export const DISCOVERY_MAX_CONDITIONS = 5

/** Maximum excluded names per job */
export const DISCOVERY_MAX_EXCLUSIONS = 100

// ============================================================================
// COSTS
// ============================================================================

/** Base cost per discovery run in USD */
export const DISCOVERY_BASE_COST_USD = 0.10

/** Cost per candidate found in USD */
export const DISCOVERY_PER_CANDIDATE_COST_USD = 0.02

/** Estimated cost per run (for display) */
export function estimateDiscoveryCost(matchLimit: number): number {
  return DISCOVERY_BASE_COST_USD + (matchLimit * DISCOVERY_PER_CANDIDATE_COST_USD)
}

// ============================================================================
// TIMEOUTS
// ============================================================================

/** Maximum time to wait for discovery to complete (10 minutes) */
export const DISCOVERY_TIMEOUT_MS = 600000

/** Polling interval when waiting for discovery (3 seconds) */
export const DISCOVERY_POLL_INTERVAL_MS = 3000

// ============================================================================
// PLAN LIMITS
// ============================================================================

export interface DiscoveryPlanLimits {
  daily_jobs: number
  max_candidates_per_job: number
  templates_available: boolean
  custom_conditions: boolean
}

export const DISCOVERY_PLAN_LIMITS: Record<string, DiscoveryPlanLimits> = {
  free: {
    daily_jobs: 2,
    max_candidates_per_job: 10,
    templates_available: true,
    custom_conditions: false,
  },
  basic: {
    daily_jobs: 5,
    max_candidates_per_job: 25,
    templates_available: true,
    custom_conditions: true,
  },
  growth: {
    daily_jobs: 10,
    max_candidates_per_job: 25,
    templates_available: true,
    custom_conditions: true,
  },
  pro: {
    daily_jobs: 20,
    max_candidates_per_job: 50,
    templates_available: true,
    custom_conditions: true,
  },
  scale: {
    daily_jobs: 50,
    max_candidates_per_job: 50,
    templates_available: true,
    custom_conditions: true,
  },
  enterprise: {
    daily_jobs: 100,
    max_candidates_per_job: 50,
    templates_available: true,
    custom_conditions: true,
  },
}

export function getDiscoveryPlanLimits(planName?: string): DiscoveryPlanLimits {
  const normalizedPlan = planName?.toLowerCase() ?? "free"
  return DISCOVERY_PLAN_LIMITS[normalizedPlan] ?? DISCOVERY_PLAN_LIMITS.free
}
