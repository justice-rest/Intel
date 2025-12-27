/**
 * TrueNCOA Configuration
 * API settings and environment configuration
 */

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

/**
 * Use testing environment in development, production in production
 * Testing environment is FREE and doesn't consume credits
 */
export const TRUENCOA_ENV = process.env.NODE_ENV === "production" ? "production" : "testing"

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * TrueNCOA API endpoints by environment
 * - Testing: HTTP (no SSL), FREE, for development
 * - Production: HTTPS (SSL), $20/file for results download
 */
export const TRUENCOA_ENDPOINTS = {
  testing: {
    baseUrl: "https://api.testing.truencoa.com",
    appUrl: "https://app.testing.truencoa.com",
    description: "Free sandbox environment for development",
  },
  production: {
    baseUrl: "https://api.truencoa.com",
    appUrl: "https://app.truencoa.com",
    description: "Production environment ($20/file for full results)",
  },
} as const

export type TrueNCOAEnvironment = keyof typeof TRUENCOA_ENDPOINTS

/**
 * Get the current API base URL
 */
export function getTrueNCOABaseUrl(env?: TrueNCOAEnvironment): string {
  const targetEnv = env || TRUENCOA_ENV
  return TRUENCOA_ENDPOINTS[targetEnv].baseUrl
}

// ============================================================================
// API CONFIGURATION
// ============================================================================

export const TRUENCOA_CONFIG = {
  // Request timeout (30 seconds)
  timeout: 30000,

  // Retry settings
  maxRetries: 3,
  retryDelay: 2000, // ms

  // Rate limiting (recommended 1 req/sec)
  rateLimitDelay: 1000, // ms between requests

  // Polling settings for async processing
  pollInterval: 5000, // 5 seconds
  maxPollTime: 300000, // 5 minutes max wait

  // Batch settings
  maxRecordsPerFile: 100000, // TrueNCOA supports large files
  recommendedBatchSize: 1000, // Recommended for optimal processing

  // Headers
  contentType: "application/json",
} as const

// ============================================================================
// PRICING INFORMATION
// ============================================================================

export const TRUENCOA_PRICING = {
  // FREE tier includes:
  freeFeatures: [
    "File upload and processing",
    "Validation summary (counts)",
    "NCOA match summary",
    "Deliverability rates",
    "Move statistics",
    "API access for development",
    "Testing environment access",
  ],

  // Paid tier ($20/file):
  paidFeatures: [
    "Full corrected address export (CSV/JSON)",
    "Individual record details",
    "Move effective dates",
    "CASS standardized addresses",
    "ZIP+4 extensions",
    "DPV indicators",
  ],

  pricePerFile: 20, // USD
  noRecurringFees: true,
  noSizeLimits: true,
} as const

// ============================================================================
// NCOA CODE MAPPINGS
// ============================================================================

/**
 * Human-readable descriptions for NCOA action codes
 */
export const NCOA_ACTION_DESCRIPTIONS: Record<string, string> = {
  A: "COA Match - New address found",
  "91": "Secondary number dropped from match",
  "92": "No NCOA match, but ZIP+4 corrected",
  N: "No move found",
  F: "Forwardable address",
  "": "No action taken",
}

/**
 * Human-readable descriptions for move types
 */
export const NCOA_MOVE_TYPE_DESCRIPTIONS: Record<string, string> = {
  I: "Individual move",
  F: "Family move",
  B: "Business move",
  "": "Not a move",
}

/**
 * Human-readable descriptions for DPV indicators
 */
export const DPV_INDICATOR_DESCRIPTIONS: Record<string, string> = {
  Y: "Confirmed deliverable",
  D: "Primary confirmed, secondary missing",
  S: "Secondary number confirmed",
  N: "Undeliverable",
  "": "Not validated",
}

// ============================================================================
// VALIDATION HELPER
// ============================================================================

/**
 * Validate TrueNCOA credentials format
 */
export function validateCredentialsFormat(id: string, key: string): { valid: boolean; error?: string } {
  if (!id || typeof id !== "string") {
    return { valid: false, error: "API ID is required" }
  }

  if (!key || typeof key !== "string") {
    return { valid: false, error: "API Key is required" }
  }

  const trimmedId = id.trim()
  const trimmedKey = key.trim()

  if (trimmedId.length < 3) {
    return { valid: false, error: "API ID is too short" }
  }

  if (trimmedKey.length < 8) {
    return { valid: false, error: "API Key is too short" }
  }

  // Check for email format if ID looks like an email
  if (trimmedId.includes("@") && !isValidEmail(trimmedId)) {
    return { valid: false, error: "Invalid email format for API ID" }
  }

  return { valid: true }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// ============================================================================
// EXPORT DEFAULT ENDPOINT
// ============================================================================

export const TRUENCOA_BASE_URL = getTrueNCOABaseUrl()
