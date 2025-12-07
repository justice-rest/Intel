/**
 * OpenCorporates API Configuration
 * Provides company ownership, officers, and filing data
 *
 * API Documentation: https://api.opencorporates.com/documentation/API-Reference
 *
 * NOTE: OpenCorporates REQUIRES an API key for production use.
 * Free access is only available for:
 * - Registered nonprofits
 * - Academic researchers
 * - Journalists
 * - Open data projects (share-alike license)
 *
 * Apply for access at: https://opencorporates.com/api_accounts/new
 *
 * For most users, rely on:
 * - SEC EDGAR (free) for public company officers/directors
 * - Web search (Linkup) for private company info
 */

/**
 * OpenCorporates API base URL
 */
export const OPENCORPORATES_API_BASE_URL = "https://api.opencorporates.com/v0.4"

/**
 * Check if OpenCorporates API key is configured
 */
export function isOpenCorporatesKeyConfigured(): boolean {
  return !!process.env.OPENCORPORATES_API_KEY
}

/**
 * Get OpenCorporates API key from environment
 */
export function getOpenCorporatesApiKey(): string | null {
  return process.env.OPENCORPORATES_API_KEY || null
}

/**
 * OpenCorporates is ONLY enabled if API key is configured
 * This prevents errors for users without access
 */
export function isOpenCorporatesEnabled(): boolean {
  return isOpenCorporatesKeyConfigured()
}

/**
 * Default configuration for OpenCorporates API requests
 */
export const OPENCORPORATES_DEFAULTS = {
  perPage: 30,           // Results per page (max 100)
  timeout: 30000,        // 30 seconds
  format: "json",        // Response format
} as const

/**
 * Common jurisdiction codes for US states
 */
export const US_JURISDICTION_CODES: Record<string, string> = {
  "AL": "us_al", "AK": "us_ak", "AZ": "us_az", "AR": "us_ar", "CA": "us_ca",
  "CO": "us_co", "CT": "us_ct", "DE": "us_de", "FL": "us_fl", "GA": "us_ga",
  "HI": "us_hi", "ID": "us_id", "IL": "us_il", "IN": "us_in", "IA": "us_ia",
  "KS": "us_ks", "KY": "us_ky", "LA": "us_la", "ME": "us_me", "MD": "us_md",
  "MA": "us_ma", "MI": "us_mi", "MN": "us_mn", "MS": "us_ms", "MO": "us_mo",
  "MT": "us_mt", "NE": "us_ne", "NV": "us_nv", "NH": "us_nh", "NJ": "us_nj",
  "NM": "us_nm", "NY": "us_ny", "NC": "us_nc", "ND": "us_nd", "OH": "us_oh",
  "OK": "us_ok", "OR": "us_or", "PA": "us_pa", "RI": "us_ri", "SC": "us_sc",
  "SD": "us_sd", "TN": "us_tn", "TX": "us_tx", "UT": "us_ut", "VT": "us_vt",
  "VA": "us_va", "WA": "us_wa", "WV": "us_wv", "WI": "us_wi", "WY": "us_wy",
  "DC": "us_dc",
} as const
