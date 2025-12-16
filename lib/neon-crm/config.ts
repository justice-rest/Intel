/**
 * Neon CRM Configuration
 * Centralized configuration for Neon CRM API v2 integration
 *
 * API Documentation: https://developer.neoncrm.com/api-v2/
 *
 * Authentication:
 * - Uses HTTP Basic Auth with Org ID (username) and API Key (password)
 * - Include NEON-API-VERSION header for version control
 *
 * Base URLs:
 * - Production/Sandbox: https://api.neoncrm.com/v2
 * - Trial: https://trial.neoncrm.com/v2
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Neon CRM API v2 base URLs
 */
export const NEON_CRM_API_URLS = {
  production: "https://api.neoncrm.com/v2",
  trial: "https://trial.neoncrm.com/v2",
} as const

/**
 * Default configuration for Neon CRM API
 */
export const NEON_CRM_DEFAULTS = {
  apiVersion: "2.10", // Latest stable version as of Dec 2024
  timeout: 30000, // 30 second timeout
  defaultLimit: 20, // Default page size
  maxLimit: 200, // Maximum page size allowed by API
} as const

// ============================================================================
// ENVIRONMENT HELPERS
// ============================================================================

/**
 * Check if Neon CRM is configured
 * Requires both ORG_ID and API_KEY to be set
 */
export function isNeonCRMEnabled(): boolean {
  return !!(process.env.NEON_CRM_ORG_ID && process.env.NEON_CRM_API_KEY)
}

/**
 * Check if this is a trial instance
 */
export function isNeonCRMTrialInstance(): boolean {
  return process.env.NEON_CRM_TRIAL === "true"
}

/**
 * Get Neon CRM Organization ID
 * @throws Error if NEON_CRM_ORG_ID is not configured
 */
export function getNeonCRMOrgId(): string {
  const orgId = process.env.NEON_CRM_ORG_ID

  if (!orgId) {
    throw new Error(
      "NEON_CRM_ORG_ID is not configured. Please add it to your environment variables."
    )
  }

  return orgId
}

/**
 * Get Neon CRM API Key
 * @throws Error if NEON_CRM_API_KEY is not configured
 */
export function getNeonCRMApiKey(): string {
  const apiKey = process.env.NEON_CRM_API_KEY

  if (!apiKey) {
    throw new Error(
      "NEON_CRM_API_KEY is not configured. Please add it to your environment variables."
    )
  }

  return apiKey
}

/**
 * Get Neon CRM credentials if available, otherwise return null
 */
export function getNeonCRMCredentialsOptional(): {
  orgId: string
  apiKey: string
} | null {
  const orgId = process.env.NEON_CRM_ORG_ID
  const apiKey = process.env.NEON_CRM_API_KEY

  if (!orgId || !apiKey) {
    return null
  }

  return { orgId, apiKey }
}

/**
 * Get the base URL for Neon CRM API
 */
export function getNeonCRMBaseUrl(): string {
  return isNeonCRMTrialInstance()
    ? NEON_CRM_API_URLS.trial
    : NEON_CRM_API_URLS.production
}

/**
 * Build Basic Auth header value from Org ID and API Key
 */
export function buildNeonCRMAuthHeader(): string {
  const orgId = getNeonCRMOrgId()
  const apiKey = getNeonCRMApiKey()

  // Basic Auth format: base64(username:password)
  const credentials = Buffer.from(`${orgId}:${apiKey}`).toString("base64")
  return `Basic ${credentials}`
}

/**
 * Build Basic Auth header value from provided credentials
 */
export function buildNeonCRMAuthHeaderFromCredentials(
  orgId: string,
  apiKey: string
): string {
  const credentials = Buffer.from(`${orgId}:${apiKey}`).toString("base64")
  return `Basic ${credentials}`
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Neon CRM Account Types
 */
export type NeonCRMAccountType = "Individual" | "Organization" | "Household"

/**
 * Neon CRM Donation Types
 */
export type NeonCRMDonationType = "Donation" | "Pledge" | "PledgePayment"

/**
 * Search field operators for advanced searches
 */
export type NeonCRMSearchOperator =
  | "EQUAL"
  | "NOT_EQUAL"
  | "CONTAIN"
  | "NOT_CONTAIN"
  | "BLANK"
  | "NOT_BLANK"
  | "LESS_THAN"
  | "GREATER_THAN"
  | "LESS_AND_EQUAL"
  | "GREATER_AND_EQUAL"

/**
 * Common pagination parameters
 */
export interface NeonCRMPagination {
  currentPage: number
  pageSize: number
  totalPages: number
  totalResults: number
}
