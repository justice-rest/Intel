/**
 * CourtListener API Configuration
 * Provides free access to federal court records and judicial opinions
 *
 * API Documentation: https://www.courtlistener.com/help/api/
 *
 * FREE API:
 * - No API key required for basic usage
 * - Rate limit: 5,000 requests per hour (unauthenticated)
 * - Federal court opinions, PACER documents
 * - Judicial database (judges, financial disclosures)
 * - Oral arguments audio
 *
 * Data sources:
 * - PACER (Public Access to Court Electronic Records)
 * - All federal circuit courts
 * - Supreme Court
 * - District courts
 * - Bankruptcy courts
 */

/**
 * CourtListener API base URL
 */
export const COURTLISTENER_API_BASE_URL = "https://www.courtlistener.com/api/rest/v4"

/**
 * Check if CourtListener API token is configured (optional)
 */
export function isCourtListenerTokenConfigured(): boolean {
  return !!process.env.COURTLISTENER_API_TOKEN
}

/**
 * Get CourtListener API token from environment (optional)
 */
export function getCourtListenerApiToken(): string | null {
  return process.env.COURTLISTENER_API_TOKEN || null
}

/**
 * CourtListener is always enabled (free API)
 */
export function isCourtListenerEnabled(): boolean {
  return true
}

/**
 * Default configuration for CourtListener API requests
 */
export const COURTLISTENER_DEFAULTS = {
  pageSize: 20,          // Results per page
  timeout: 30000,        // 30 seconds
  format: "json",        // Response format
} as const

/**
 * Court types for filtering
 */
export const COURT_TYPES = {
  F: "Federal Appellate",      // Circuit courts
  FD: "Federal District",      // District courts
  FB: "Federal Bankruptcy",    // Bankruptcy courts
  FS: "Federal Special",       // Tax court, claims court, etc.
  S: "State Supreme",          // State supreme courts
  SA: "State Appellate",       // State appellate courts
} as const

/**
 * Common federal courts
 */
export const FEDERAL_COURTS = {
  scotus: "Supreme Court of the United States",
  ca1: "Court of Appeals for the First Circuit",
  ca2: "Court of Appeals for the Second Circuit",
  ca9: "Court of Appeals for the Ninth Circuit",
  cadc: "Court of Appeals for the D.C. Circuit",
  cafc: "Court of Appeals for the Federal Circuit",
} as const
