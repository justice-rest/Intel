/**
 * OpenSanctions API Configuration
 * Provides PEP (Politically Exposed Persons) and sanctions screening
 *
 * API Documentation: https://www.opensanctions.org/api/
 *
 * COMPLETELY FREE:
 * - Open source sanctions and PEP data
 * - No API key required for basic usage
 * - Includes data from 100+ sources worldwide
 *
 * Data includes:
 * - Sanctions lists (OFAC, EU, UN, etc.)
 * - Politically Exposed Persons (PEPs)
 * - Criminals and wanted persons
 * - Debarred entities
 */

/**
 * OpenSanctions API base URL
 */
export const OPENSANCTIONS_API_BASE_URL = "https://api.opensanctions.org"

/**
 * Check if OpenSanctions API key is configured (optional)
 */
export function isOpenSanctionsKeyConfigured(): boolean {
  return !!process.env.OPENSANCTIONS_API_KEY
}

/**
 * Get OpenSanctions API key from environment (optional)
 */
export function getOpenSanctionsApiKey(): string | null {
  return process.env.OPENSANCTIONS_API_KEY || null
}

/**
 * OpenSanctions is always enabled (free API)
 */
export function isOpenSanctionsEnabled(): boolean {
  return true
}

/**
 * Default configuration for OpenSanctions API requests
 */
export const OPENSANCTIONS_DEFAULTS = {
  limit: 25,             // Results per request
  timeout: 30000,        // 30 seconds
  fuzzy: true,           // Enable fuzzy matching
  threshold: 0.5,        // Match threshold (0.0 - 1.0)
} as const

/**
 * OpenSanctions datasets (schemas)
 */
export const OPENSANCTIONS_DATASETS = {
  // Core datasets
  default: "default",           // All data combined
  sanctions: "sanctions",       // Sanctions lists only
  peps: "peps",                 // PEPs only
  crime: "crime",               // Criminal records

  // Specific sources
  ofac: "us_ofac_sdn",          // US Treasury OFAC SDN
  eu: "eu_sanctions",           // EU Sanctions
  un: "un_sc_sanctions",        // UN Security Council
} as const

/**
 * Risk levels based on match results
 */
export const RISK_LEVELS = {
  HIGH: "HIGH",           // Match on sanctions list
  MEDIUM: "MEDIUM",       // Match as PEP
  LOW: "LOW",             // Potential match, needs review
  CLEAR: "CLEAR",         // No matches found
} as const
