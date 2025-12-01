/**
 * OpenCorporates API Configuration
 * API Reference: https://api.opencorporates.com/documentation/API-Reference
 *
 * OpenCorporates provides company data from 140+ jurisdictions worldwide.
 * Free tier: 200 requests/month, 50 requests/day
 */

/**
 * Check if OpenCorporates API key is configured
 */
export function isOpenCorporatesEnabled(): boolean {
  return !!process.env.OPENCORPORATES_API_KEY
}

/**
 * Get OpenCorporates API key from environment
 * @throws Error if OPENCORPORATES_API_KEY is not configured
 */
export function getOpenCorporatesApiKey(): string {
  const apiKey = process.env.OPENCORPORATES_API_KEY

  if (!apiKey) {
    throw new Error(
      "OPENCORPORATES_API_KEY is not configured. Please add it to your environment variables."
    )
  }

  return apiKey
}

/**
 * Get OpenCorporates API key if available, otherwise return null
 */
export function getOpenCorporatesApiKeyOptional(): string | null {
  return process.env.OPENCORPORATES_API_KEY || null
}

/**
 * OpenCorporates API base URL
 */
export const OPENCORPORATES_API_BASE = "https://api.opencorporates.com/v0.4"

/**
 * Default configuration for OpenCorporates API
 */
export const OPENCORPORATES_DEFAULTS = {
  perPage: 30, // Results per page (max 100)
  format: "json" as const,
} as const

/**
 * Common US jurisdiction codes for OpenCorporates
 * Format: us_XX where XX is the state abbreviation
 */
export const US_JURISDICTION_CODES = {
  alabama: "us_al",
  alaska: "us_ak",
  arizona: "us_az",
  arkansas: "us_ar",
  california: "us_ca",
  colorado: "us_co",
  connecticut: "us_ct",
  delaware: "us_de",
  florida: "us_fl",
  georgia: "us_ga",
  hawaii: "us_hi",
  idaho: "us_id",
  illinois: "us_il",
  indiana: "us_in",
  iowa: "us_ia",
  kansas: "us_ks",
  kentucky: "us_ky",
  louisiana: "us_la",
  maine: "us_me",
  maryland: "us_md",
  massachusetts: "us_ma",
  michigan: "us_mi",
  minnesota: "us_mn",
  mississippi: "us_ms",
  missouri: "us_mo",
  montana: "us_mt",
  nebraska: "us_ne",
  nevada: "us_nv",
  newHampshire: "us_nh",
  newJersey: "us_nj",
  newMexico: "us_nm",
  newYork: "us_ny",
  northCarolina: "us_nc",
  northDakota: "us_nd",
  ohio: "us_oh",
  oklahoma: "us_ok",
  oregon: "us_or",
  pennsylvania: "us_pa",
  rhodeIsland: "us_ri",
  southCarolina: "us_sc",
  southDakota: "us_sd",
  tennessee: "us_tn",
  texas: "us_tx",
  utah: "us_ut",
  vermont: "us_vt",
  virginia: "us_va",
  washington: "us_wa",
  westVirginia: "us_wv",
  wisconsin: "us_wi",
  wyoming: "us_wy",
  districtOfColumbia: "us_dc",
} as const

export type USJurisdictionCode = typeof US_JURISDICTION_CODES[keyof typeof US_JURISDICTION_CODES]
