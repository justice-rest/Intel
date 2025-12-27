/**
 * CRM Provider Configuration
 * Defines supported CRM integrations and their API settings
 */

import BloomerangIcon from "@/components/icons/bloomerang"
import VirtuousIcon from "@/components/icons/virtuous"
import NeonCRMIcon from "@/components/icons/neoncrm"
import DonorPerfectIcon from "@/components/icons/donorperfect"
import SalesforceIcon from "@/components/icons/salesforce"
import BlackbaudIcon from "@/components/icons/blackbaud"
import EveryActionIcon from "@/components/icons/everyaction"
import type { CRMProviderConfig, CRMProvider } from "./types"

// ============================================================================
// CRM PROVIDERS
// ============================================================================

export const CRM_PROVIDERS: CRMProviderConfig[] = [
  {
    id: "bloomerang",
    name: "Bloomerang",
    icon: BloomerangIcon,
    baseUrl: "https://api.bloomerang.co/v2",
    placeholder: "Enter your Bloomerang API key",
    getKeyUrl: "https://bloomerang.co/product/integrations-data-management/api/",
    authHeader: "X-API-Key",
    description: "Connect your Bloomerang CRM to sync constituent and donation data.",
  },
  {
    id: "virtuous",
    name: "Virtuous",
    icon: VirtuousIcon,
    baseUrl: "https://api.virtuoussoftware.com/api",
    placeholder: "Enter your Virtuous API key",
    getKeyUrl: "https://support.virtuous.org/hc/en-us/articles/360052340251-Virtuous-API-Authentication",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    description: "Connect your Virtuous CRM to sync contact and gift data.",
  },
  {
    id: "neoncrm",
    name: "Neon CRM",
    icon: NeonCRMIcon,
    baseUrl: "https://api.neoncrm.com/v2",
    placeholder: "Enter your Neon CRM API key",
    getKeyUrl: "https://developer.neoncrm.com/getting-started/",
    authHeader: "Authorization",
    authType: "basic",
    description: "Connect Neon CRM to sync constituent and donation data.",
    secondaryPlaceholder: "Enter your Neon CRM Org ID",
    secondaryLabel: "Organization ID",
  },
  {
    id: "donorperfect",
    name: "DonorPerfect",
    icon: DonorPerfectIcon,
    baseUrl: "https://www.donorperfect.net/prod/xmlrequest.asp",
    placeholder: "Enter your DonorPerfect API key",
    getKeyUrl: "https://www.donorperfect.com/support",
    authHeader: "X-API-Key", // Not actually used - auth is via query param
    description: "Connect DonorPerfect to sync donor and gift data.",
  },
  {
    id: "salesforce",
    name: "Salesforce NPSP",
    icon: SalesforceIcon,
    baseUrl: "https://login.salesforce.com",
    placeholder: "Enter your Salesforce access token",
    getKeyUrl: "https://help.salesforce.com/s/articleView?id=sf.connected_app_create.htm",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    authType: "basic", // OAuth credentials stored as base64 JSON
    description: "Connect Salesforce NPSP to sync contacts and opportunities.",
    secondaryPlaceholder: "Enter your Salesforce instance URL (e.g., https://yourorg.my.salesforce.com)",
    secondaryLabel: "Instance URL",
    beta: true,
  },
  {
    id: "blackbaud",
    name: "Raiser's Edge NXT",
    icon: BlackbaudIcon,
    baseUrl: "https://api.sky.blackbaud.com",
    placeholder: "Enter your SKY API access token",
    getKeyUrl: "https://developer.blackbaud.com/skyapi/docs/getting-started",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    authType: "basic", // OAuth + subscription key stored as base64 JSON
    description: "Connect Raiser's Edge NXT via SKY API to sync constituents and gifts.",
    secondaryPlaceholder: "Enter your SKY API subscription key",
    secondaryLabel: "Subscription Key",
    beta: true,
  },
  {
    id: "everyaction",
    name: "EveryAction",
    icon: EveryActionIcon,
    baseUrl: "https://api.securevan.com/v4",
    placeholder: "Enter your EveryAction API key",
    getKeyUrl: "https://docs.everyaction.com/reference/authentication",
    authHeader: "Authorization",
    authType: "basic", // HTTP Basic with applicationName:apiKey|dbMode
    description: "Connect EveryAction (NGP VAN) to sync people and contributions.",
    secondaryPlaceholder: "Enter your application name",
    secondaryLabel: "Application Name",
    beta: true,
  },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getCRMProvider(providerId: CRMProvider): CRMProviderConfig | undefined {
  return CRM_PROVIDERS.find((p) => p.id === providerId)
}

export function getCRMProviderName(providerId: CRMProvider): string {
  return getCRMProvider(providerId)?.name || providerId
}

export function isCRMProvider(provider: string): provider is CRMProvider {
  return CRM_PROVIDERS.some((p) => p.id === provider)
}

// ============================================================================
// API CONFIGURATION
// ============================================================================

/**
 * Per-provider rate limits based on API documentation:
 * - Bloomerang: No published limit (use 100ms)
 * - Virtuous: 10,000 requests/hour = 2.78 req/sec (use 400ms for safety margin)
 * - Neon CRM: 5 req/sec for most endpoints, 1 req/sec for search (use 250ms)
 * - DonorPerfect: No rate limit, but 500-row query limit
 * - Salesforce: 100,000 daily API calls (use 100ms, respect 429 responses)
 * - Blackbaud: 10 calls/sec (use 120ms for safety)
 * - EveryAction: No published limit, throttling during peak (use 200ms)
 */
export const CRM_RATE_LIMITS: Record<CRMProvider, number> = {
  bloomerang: 100,    // ms between requests (no published limit)
  virtuous: 400,      // ms between requests (10,000/hour = 2.78/sec, use 2.5/sec for safety)
  neoncrm: 250,       // ms between requests (5/sec for most endpoints)
  donorperfect: 100,  // ms between requests (no rate limit)
  salesforce: 100,    // ms between requests (high daily limit, respect 429)
  blackbaud: 120,     // ms between requests (10 calls/sec = 100ms, add buffer)
  everyaction: 200,   // ms between requests (no published limit, be conservative)
}

export const CRM_API_CONFIG = {
  // Request timeout in milliseconds
  timeout: 30000,

  // Default pagination settings
  defaultPageSize: 100,
  maxPageSize: 500,

  // Default rate limiting (fallback if provider-specific not used)
  // Using most conservative value for backward compatibility
  rateLimitDelay: 400, // ms between requests (safe for all providers)

  // Retry settings
  maxRetries: 3,
  retryDelay: 1000, // ms
} as const

/**
 * Get rate limit delay for a specific provider
 */
export function getProviderRateLimitDelay(provider: CRMProvider): number {
  return CRM_RATE_LIMITS[provider] || CRM_API_CONFIG.rateLimitDelay
}

// ============================================================================
// SYNC CONFIGURATION
// ============================================================================

export const CRM_SYNC_CONFIG = {
  // Maximum records to sync per batch
  batchSize: 100,

  // Maximum total records per user (to prevent abuse)
  maxRecordsPerUser: 50000,

  // Minimum time between syncs (in minutes)
  minSyncInterval: 5,

  // Default sync type
  defaultSyncType: "full" as const,

  // === ENTERPRISE-GRADE SYNC FAILURE HANDLING ===

  // Stop sync if failure rate exceeds this threshold (0-1)
  // e.g., 0.10 = stop if more than 10% of records fail
  failureThreshold: 0.10,

  // Minimum number of records before applying failure threshold
  // (prevents early abort on small batches)
  minRecordsForThreshold: 10,

  // Maximum consecutive failures before stopping
  maxConsecutiveFailures: 5,

  // Enable transaction-style rollback on threshold breach
  enableRollbackOnThreshold: true,

  // === STRUCTURED LOGGING ===

  // Enable structured logging with request IDs
  enableStructuredLogging: true,

  // Log level for sync operations
  logLevel: "info" as "debug" | "info" | "warn" | "error",
} as const

// ============================================================================
// SYNC ERROR HANDLING UTILITIES
// ============================================================================

export interface SyncProgress {
  requestId: string
  provider: CRMProvider
  phase: "constituents" | "donations" | "complete" | "failed"
  totalRecords: number
  processedRecords: number
  failedRecords: number
  startTime: Date
  currentBatch: number
  totalBatches: number
  errors: SyncError[]
}

export interface SyncError {
  recordId?: string
  message: string
  code?: string
  timestamp: Date
  recoverable: boolean
}

/**
 * Check if sync should be aborted based on failure threshold
 */
export function shouldAbortSync(progress: SyncProgress): {
  abort: boolean
  reason?: string
} {
  const { totalRecords, failedRecords } = progress
  const config = CRM_SYNC_CONFIG

  // Check minimum records threshold
  if (totalRecords < config.minRecordsForThreshold) {
    return { abort: false }
  }

  // Calculate failure rate
  const failureRate = failedRecords / totalRecords

  if (failureRate > config.failureThreshold) {
    return {
      abort: true,
      reason: `Failure rate ${(failureRate * 100).toFixed(1)}% exceeds threshold of ${(config.failureThreshold * 100).toFixed(0)}%`,
    }
  }

  // Check consecutive failures
  const consecutiveFailures = progress.errors
    .slice(-config.maxConsecutiveFailures)
    .filter((e) => !e.recoverable).length

  if (consecutiveFailures >= config.maxConsecutiveFailures) {
    return {
      abort: true,
      reason: `${consecutiveFailures} consecutive unrecoverable failures`,
    }
  }

  return { abort: false }
}

/**
 * Generate a unique request ID for sync operations
 */
export function generateSyncRequestId(provider: CRMProvider): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `sync-${provider}-${timestamp}-${random}`
}

/**
 * Create structured log entry for sync operations
 */
export function createSyncLogEntry(
  requestId: string,
  level: "debug" | "info" | "warn" | "error",
  message: string,
  data?: Record<string, unknown>
): void {
  if (!CRM_SYNC_CONFIG.enableStructuredLogging) {
    return
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    requestId,
    level,
    message,
    ...data,
  }

  const logFn = console[level] || console.log
  logFn(`[CRM Sync]`, JSON.stringify(logEntry))
}
