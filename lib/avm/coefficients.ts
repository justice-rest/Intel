/**
 * AVM Coefficient Lookup Module
 *
 * This module provides functions for:
 * - Fetching market-specific hedonic coefficients from database
 * - Fallback hierarchy: ZIP → City → County → State → National
 * - Graceful degradation when Supabase is unavailable
 * - Address parsing for location extraction
 */

import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import type {
  HedonicCoefficients,
  HedonicCoefficientsRow,
  LocationLookup,
  ParsedAddress,
  MarketAreaType,
} from "./types"
import {
  NATIONAL_HEDONIC_COEFFICIENTS,
  COEFFICIENT_LOOKUP_TIMEOUT_MS,
} from "./config"

// ============================================================================
// Constants
// ============================================================================

/**
 * US state abbreviations for validation
 */
const US_STATES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC", "PR", "VI", "GU", "AS", "MP",
])

/**
 * Fallback order for coefficient lookup
 */
const LOOKUP_HIERARCHY: MarketAreaType[] = [
  "zip",
  "city",
  "county",
  "state",
  "national",
]

// ============================================================================
// Database Row Conversion
// ============================================================================

/**
 * Convert database row to HedonicCoefficients interface
 */
function rowToCoefficients(row: HedonicCoefficientsRow): HedonicCoefficients {
  return {
    id: row.id,
    marketArea: row.market_area,
    marketAreaType: row.market_area_type as MarketAreaType,
    stateCode: row.state_code || undefined,
    intercept: Number(row.intercept),
    lnSqftCoef: Number(row.ln_sqft_coef),
    lnLotSizeCoef: Number(row.ln_lot_size_coef),
    bedroomCoef: Number(row.bedroom_coef),
    bathroomCoef: Number(row.bathroom_coef),
    ageCoef: Number(row.age_coef),
    garageCoef: Number(row.garage_coef),
    poolCoef: Number(row.pool_coef),
    basementCoef: Number(row.basement_coef),
    fireplaceCoef: Number(row.fireplace_coef),
    adjSqftPer100: Number(row.adj_sqft_per_100),
    adjBedroom: Number(row.adj_bedroom),
    adjBathroom: Number(row.adj_bathroom),
    adjAgePerYear: Number(row.adj_age_per_year),
    adjGarage: Number(row.adj_garage),
    adjPool: Number(row.adj_pool),
    rSquared: row.r_squared ? Number(row.r_squared) : undefined,
    sampleSize: row.sample_size || undefined,
    medianPrice: row.median_price ? Number(row.median_price) : undefined,
    coefficientOfVariation: row.coefficient_of_variation
      ? Number(row.coefficient_of_variation)
      : undefined,
    effectiveDate: row.effective_date,
    expiryDate: row.expiry_date || undefined,
    isActive: row.is_active,
    dataSource: row.data_source || undefined,
  }
}

// ============================================================================
// Address Parsing
// ============================================================================

/**
 * Parse a US address string to extract location components
 *
 * Handles formats like:
 * - "123 Main St, Austin, TX 78701"
 * - "123 Main Street, Austin, Texas 78701"
 * - "123 Main St Austin TX 78701"
 */
export function parseAddress(address: string): ParsedAddress {
  const result: ParsedAddress = { fullAddress: address }

  // Normalize the address
  const normalized = address
    .replace(/[,]+/g, ",")
    .replace(/\s+/g, " ")
    .trim()

  // Try to extract ZIP code (5 digits or 5+4)
  const zipMatch = normalized.match(/\b(\d{5})(?:-\d{4})?\b/)
  if (zipMatch) {
    result.zipCode = zipMatch[1]
  }

  // Try to extract state
  // First try two-letter abbreviation
  const stateAbbrMatch = normalized.match(/\b([A-Z]{2})\b(?:\s*\d{5})?/i)
  if (stateAbbrMatch) {
    const stateUpper = stateAbbrMatch[1].toUpperCase()
    if (US_STATES.has(stateUpper)) {
      result.state = stateUpper
    }
  }

  // Try to extract city - typically comes before state
  const parts = normalized.split(/[,\s]+/)
  if (parts.length >= 3 && result.state) {
    // Find state position and take word(s) before it as city
    const stateIndex = parts.findIndex(
      (p) => p.toUpperCase() === result.state
    )
    if (stateIndex > 0) {
      // Look backwards for city name (skip street types)
      const streetTypes = new Set([
        "ST", "STREET", "AVE", "AVENUE", "BLVD", "BOULEVARD",
        "DR", "DRIVE", "RD", "ROAD", "LN", "LANE", "CT", "COURT",
        "PL", "PLACE", "WAY", "CIR", "CIRCLE", "TRL", "TRAIL",
      ])

      const cityParts: string[] = []
      for (let i = stateIndex - 1; i >= 0; i--) {
        const part = parts[i].toUpperCase().replace(/[.,]/g, "")
        if (/^\d+$/.test(part)) break // Stop at numbers (likely street number)
        if (streetTypes.has(part)) break // Stop at street type
        if (["APT", "UNIT", "STE", "SUITE", "#"].includes(part)) break
        cityParts.unshift(parts[i].replace(/[.,]/g, ""))
      }

      if (cityParts.length > 0) {
        result.city = cityParts.join(" ")
      }
    }
  }

  // Extract street number (first number in address)
  const streetNumMatch = normalized.match(/^(\d+)\s/)
  if (streetNumMatch) {
    result.streetNumber = streetNumMatch[1]
  }

  return result
}

/**
 * Extract location components for coefficient lookup
 */
export function extractLocation(
  address: string,
  city?: string,
  state?: string,
  zipCode?: string
): LocationLookup {
  const parsed = parseAddress(address)

  return {
    zipCode: zipCode || parsed.zipCode,
    city: city || parsed.city,
    state: state || parsed.state,
    // County would need geocoding - not available from address parsing
  }
}

// ============================================================================
// Database Lookup
// ============================================================================

/**
 * Fetch coefficients for a specific market area type and value
 */
async function fetchCoefficientsFromDb(
  marketAreaType: MarketAreaType,
  marketArea: string,
  stateCode?: string
): Promise<HedonicCoefficients | null> {
  if (!isSupabaseEnabled) {
    return null
  }

  try {
    const supabase = await createClient()
    if (!supabase) {
      return null
    }

    // Build query
    // Note: Cast to 'any' because hedonic_coefficients table may not be in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("hedonic_coefficients")
      .select("*")
      .eq("market_area_type", marketAreaType)
      .eq("is_active", true)
      .order("effective_date", { ascending: false })
      .limit(1)

    // For state lookups, match by state_code
    if (marketAreaType === "state" && stateCode) {
      query = query.eq("state_code", stateCode.toUpperCase())
    } else {
      // For other types, match by market_area (case-insensitive)
      query = query.ilike("market_area", marketArea)
    }

    // Execute with timeout
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), COEFFICIENT_LOOKUP_TIMEOUT_MS)
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queryPromise = query.single().then(({ data, error }: { data: any; error: any }) => {
      if (error || !data) return null
      return rowToCoefficients(data as HedonicCoefficientsRow)
    })

    return await Promise.race([queryPromise, timeoutPromise])
  } catch (error) {
    console.error("[AVM Coefficients] Database lookup failed:", error)
    return null
  }
}

/**
 * Fetch national default coefficients from database
 */
async function fetchNationalCoefficients(): Promise<HedonicCoefficients | null> {
  return fetchCoefficientsFromDb("national", "US")
}

// ============================================================================
// Main Lookup Function
// ============================================================================

/**
 * Get hedonic coefficients for a location using fallback hierarchy
 *
 * Lookup order:
 * 1. ZIP code (most specific)
 * 2. City
 * 3. County
 * 4. State
 * 5. National (database default)
 * 6. Hardcoded national fallback (if DB unavailable)
 *
 * @param location - Location components for lookup
 * @returns Hedonic coefficients and the source level used
 */
export async function getCoefficientsForLocation(
  location: LocationLookup
): Promise<{ coefficients: HedonicCoefficients; source: string }> {
  const { zipCode, city, state, county } = location

  // Try each level in the hierarchy
  for (const level of LOOKUP_HIERARCHY) {
    let result: HedonicCoefficients | null = null
    let lookupValue: string | undefined

    switch (level) {
      case "zip":
        if (zipCode) {
          lookupValue = zipCode
          result = await fetchCoefficientsFromDb("zip", zipCode, state)
        }
        break

      case "city":
        if (city && state) {
          lookupValue = `${city}, ${state}`
          result = await fetchCoefficientsFromDb("city", city, state)
        }
        break

      case "county":
        if (county && state) {
          lookupValue = `${county}, ${state}`
          result = await fetchCoefficientsFromDb("county", county, state)
        }
        break

      case "state":
        if (state) {
          lookupValue = state
          result = await fetchCoefficientsFromDb("state", state, state)
        }
        break

      case "national":
        lookupValue = "US"
        result = await fetchNationalCoefficients()
        break
    }

    if (result) {
      console.log(
        `[AVM Coefficients] Found ${level} coefficients for ${lookupValue}`
      )
      return {
        coefficients: result,
        source: `${level}: ${lookupValue}`,
      }
    }
  }

  // Fallback to hardcoded national defaults
  console.log("[AVM Coefficients] Using hardcoded national defaults")
  return {
    coefficients: NATIONAL_HEDONIC_COEFFICIENTS,
    source: "national: US (fallback)",
  }
}

/**
 * Get coefficients from address string
 * Convenience function that combines parsing and lookup
 */
export async function getCoefficientsForAddress(
  address: string,
  city?: string,
  state?: string,
  zipCode?: string
): Promise<{ coefficients: HedonicCoefficients; source: string }> {
  const location = extractLocation(address, city, state, zipCode)
  return getCoefficientsForLocation(location)
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if coefficients are market-specific (not national fallback)
 */
export function isMarketSpecific(coefficients: HedonicCoefficients): boolean {
  return coefficients.marketAreaType !== "national"
}

/**
 * Get a human-readable description of coefficients source
 */
export function describeCoefficientsSource(
  coefficients: HedonicCoefficients
): string {
  const { marketAreaType, marketArea, dataSource } = coefficients

  const levelDescriptions: Record<MarketAreaType, string> = {
    zip: `ZIP code ${marketArea}`,
    city: `${marketArea} area`,
    county: `${marketArea} County`,
    msa: `${marketArea} metropolitan area`,
    state: `State of ${marketArea}`,
    national: "National average",
  }

  let description = levelDescriptions[marketAreaType] || marketArea

  if (dataSource) {
    description += ` (${dataSource})`
  }

  return description
}
