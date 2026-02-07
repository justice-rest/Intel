/**
 * Workflow Configuration
 *
 * Centralized configuration for the workflow system.
 * Feature flags control which workflows use the durable execution engine.
 *
 * All workflows are ENABLED by default for full durability.
 * Use environment variables to disable if needed (kill switch).
 */

import type { WorkflowConfig, WorkflowFeatureFlag } from "./types"

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

const isDevelopment = process.env.NODE_ENV === "development"
const isProduction = process.env.NODE_ENV === "production"

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default workflow configuration
 *
 * Full rollout defaults:
 * - Workflows enabled everywhere (dev + production)
 * - All feature flags ON by default
 * - Local world in development, Vercel World in production
 * - 100% rollout for all users
 *
 * To disable, set environment variables:
 * - WORKFLOW_ENABLED=false (global kill switch)
 * - WORKFLOW_FLAG_CRM_SYNC=false (disable specific workflow)
 */
const defaultConfig: WorkflowConfig = {
  enabled: true,
  targetWorld: isDevelopment ? "local" : "vercel",
  featureFlags: {
    "durable-crm-sync": true,
    "durable-memory-extraction": true,
    "durable-deep-research": true,
    "durable-batch-processing": true,
  },
  rolloutPercentage: 100,
}

// ============================================================================
// CONFIGURATION LOADING
// ============================================================================

/**
 * Load workflow configuration from environment variables
 */
function loadConfigFromEnv(): Partial<WorkflowConfig> {
  const config: Partial<WorkflowConfig> = {}

  // Global enable/disable
  if (process.env.WORKFLOW_ENABLED !== undefined) {
    config.enabled = process.env.WORKFLOW_ENABLED === "true"
  }

  // Target world
  const targetWorld = process.env.WORKFLOW_TARGET_WORLD
  if (targetWorld === "local" || targetWorld === "postgres" || targetWorld === "vercel") {
    config.targetWorld = targetWorld
  }

  // Rollout percentage
  const rollout = process.env.WORKFLOW_ROLLOUT_PERCENTAGE
  if (rollout !== undefined) {
    const percentage = parseInt(rollout, 10)
    if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
      config.rolloutPercentage = percentage
    }
  }

  // Feature flags from environment
  const featureFlags: Partial<Record<WorkflowFeatureFlag, boolean>> = {}

  if (process.env.WORKFLOW_FLAG_CRM_SYNC !== undefined) {
    featureFlags["durable-crm-sync"] = process.env.WORKFLOW_FLAG_CRM_SYNC === "true"
  }
  if (process.env.WORKFLOW_FLAG_MEMORY_EXTRACTION !== undefined) {
    featureFlags["durable-memory-extraction"] = process.env.WORKFLOW_FLAG_MEMORY_EXTRACTION === "true"
  }
  if (process.env.WORKFLOW_FLAG_DEEP_RESEARCH !== undefined) {
    featureFlags["durable-deep-research"] = process.env.WORKFLOW_FLAG_DEEP_RESEARCH === "true"
  }
  if (process.env.WORKFLOW_FLAG_BATCH_PROCESSING !== undefined) {
    featureFlags["durable-batch-processing"] = process.env.WORKFLOW_FLAG_BATCH_PROCESSING === "true"
  }

  if (Object.keys(featureFlags).length > 0) {
    config.featureFlags = {
      ...defaultConfig.featureFlags,
      ...featureFlags,
    }
  }

  return config
}

// ============================================================================
// MERGED CONFIGURATION
// ============================================================================

let cachedConfig: WorkflowConfig | null = null

/**
 * Get the current workflow configuration
 *
 * Merges default config with environment variables.
 * Cached for performance.
 */
export function getWorkflowConfig(): WorkflowConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  const envConfig = loadConfigFromEnv()

  cachedConfig = {
    ...defaultConfig,
    ...envConfig,
    featureFlags: {
      ...defaultConfig.featureFlags,
      ...(envConfig.featureFlags || {}),
    },
  }

  return cachedConfig
}

/**
 * Clear the configuration cache (for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null
}

// ============================================================================
// FEATURE FLAG HELPERS
// ============================================================================

/**
 * Check if a specific workflow feature flag is enabled
 *
 * @param flag - The feature flag to check
 * @param userId - Optional user ID for percentage-based rollout
 * @returns true if the feature is enabled for this user
 */
export function isWorkflowEnabled(flag: WorkflowFeatureFlag, userId?: string): boolean {
  const config = getWorkflowConfig()

  // Global kill switch
  if (!config.enabled) {
    return false
  }

  // Feature-specific flag
  if (!config.featureFlags[flag]) {
    return false
  }

  // Percentage-based rollout
  if (config.rolloutPercentage < 100 && userId) {
    // Deterministic hash based on userId for consistent experience
    const hash = hashUserId(userId)
    const threshold = config.rolloutPercentage / 100
    if (hash > threshold) {
      return false
    }
  }

  return true
}

/**
 * Hash a user ID to a value between 0 and 1
 * Used for deterministic percentage-based rollout
 */
function hashUserId(userId: string): number {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  // Normalize to 0-1 range
  return Math.abs(hash) / 2147483647
}

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Log workflow configuration on startup (development only)
 */
export function logWorkflowConfig(): void {
  if (!isDevelopment) {
    return
  }

  const config = getWorkflowConfig()
  console.log("[Workflow] Configuration:")
  console.log(`  - Enabled: ${config.enabled}`)
  console.log(`  - Target World: ${config.targetWorld}`)
  console.log(`  - Rollout: ${config.rolloutPercentage}%`)
  console.log(`  - Feature Flags:`)
  Object.entries(config.featureFlags).forEach(([flag, enabled]) => {
    console.log(`    - ${flag}: ${enabled ? "ON" : "OFF"}`)
  })
}
