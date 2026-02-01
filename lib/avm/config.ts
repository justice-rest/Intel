/**
 * AVM (Automated Valuation Model) Configuration
 *
 * This module provides:
 * - National default hedonic coefficients (fallback when DB unavailable)
 * - Comparable sales adjustment factors
 * - Ensemble model weights
 * - Confidence thresholds
 * - Validation constants
 */

import type { HedonicCoefficients } from "./types"

// ============================================================================
// Enable Check
// ============================================================================

/**
 * Check if AVM tools should be enabled
 * AVM uses existing search infrastructure, so always enabled
 */
export function isAVMEnabled(): boolean {
  return true // Uses existing LinkUp search infrastructure
}

// ============================================================================
// National Default Coefficients
// ============================================================================

/**
 * National average hedonic pricing coefficients
 * Based on published housing research and appraisal standards
 *
 * These serve as fallbacks when:
 * 1. Market-specific coefficients are not in database
 * 2. Supabase is unavailable
 * 3. Database query fails
 *
 * Formula: ln(P) = intercept + lnSqftCoef*ln(SQFT) + lnLotSizeCoef*ln(LOT) + ...
 */
export const NATIONAL_HEDONIC_COEFFICIENTS: HedonicCoefficients = {
  marketArea: "US",
  marketAreaType: "national",

  // Intercept (base ln(price) when all features = 0)
  // exp(11.2) ≈ $73,000 - base value before feature adjustments
  intercept: 11.2,

  // Log-form coefficients (elasticities)
  // These represent percentage changes in price for percentage changes in feature
  lnSqftCoef: 0.45, // 1% sqft increase → 0.45% price increase
  lnLotSizeCoef: 0.12, // 1% lot increase → 0.12% price increase

  // Linear coefficients (represent premium per unit)
  bedroomCoef: 0.02, // Each bedroom → ~2% premium
  bathroomCoef: 0.08, // Each bathroom → ~8% premium
  ageCoef: -0.005, // Each year of age → -0.5% depreciation
  garageCoef: 0.04, // Each garage space → ~4% premium
  poolCoef: 0.05, // Pool → ~5% premium
  basementCoef: 0.03, // Basement → ~3% premium
  fireplaceCoef: 0.02, // Fireplace → ~2% premium

  // Comparable sales adjustment factors (dollars)
  adjSqftPer100: 15000, // $15K per 100 sqft difference
  adjBedroom: 10000, // $10K per bedroom difference
  adjBathroom: 7500, // $7.5K per bathroom difference
  adjAgePerYear: 1000, // $1K per year of age difference
  adjGarage: 8000, // $8K per garage space difference
  adjPool: 20000, // $20K for pool adjustment

  dataSource: "National averages (fallback)",
}

// ============================================================================
// Ensemble Model Weights
// ============================================================================

/**
 * Default weights for combining valuation methods
 * Weights sum to 1.0 and redistribute proportionally when data sources missing
 */
export const MODEL_WEIGHTS = {
  hedonic: 0.35, // 35% weight to hedonic model
  comparable: 0.45, // 45% weight to comparable sales (most important)
  online: 0.2, // 20% weight to online estimates (Zillow, Redfin)
} as const

/**
 * Minimum weights - even if data is sparse, don't go below these
 * This prevents over-reliance on a single method
 */
export const MIN_MODEL_WEIGHTS = {
  hedonic: 0.15,
  comparable: 0.20,
  online: 0.10,
} as const

// ============================================================================
// Confidence Thresholds
// ============================================================================

/**
 * Confidence thresholds based on Freddie Mac HVE (Home Value Explorer) standards
 * Used to classify valuation confidence levels
 */
export const CONFIDENCE_THRESHOLDS = {
  high: 80, // High confidence: score >= 80
  medium: 60, // Medium confidence: 60 <= score < 80
  // Low: score < 60
} as const

/**
 * FSD (Forecast Standard Deviation) thresholds
 * Industry standard ranges for AVM accuracy
 */
export const FSD_THRESHOLDS = {
  excellent: 0.08, // FSD <= 8% - Very accurate
  good: 0.13, // FSD <= 13% - Lending-grade
  acceptable: 0.20, // FSD <= 20% - Preliminary estimates
  // Poor: FSD > 20%
} as const

// ============================================================================
// Comparable Sales Configuration
// ============================================================================

/**
 * Configuration for comparable sales search and weighting
 */
export const COMP_CONFIG = {
  // Maximum search radius for comparables (miles)
  maxRadiusMiles: 2.0,

  // Default search radius (miles)
  defaultRadiusMiles: 1.0,

  // Maximum age of comparable sales (days)
  maxAgeDays: 180,

  // Preferred age for highest weight (days)
  preferredAgeDays: 90,

  // Maximum number of comps to use in calculation
  maxComps: 10,

  // Minimum comps for high confidence
  minCompsForHighConfidence: 5,

  // Minimum comps to produce any estimate
  minCompsForEstimate: 1,
} as const

/**
 * Weight factors for comparable similarity scoring
 * Higher values = more importance in similarity calculation
 */
export const COMP_SIMILARITY_WEIGHTS = {
  sqftDifference: 0.30, // Size match is critical
  bedroomDifference: 0.15, // Bedroom count matters
  bathroomDifference: 0.15, // Bathroom count matters
  distance: 0.20, // Proximity is important
  recency: 0.15, // Recent sales preferred
  age: 0.05, // Age similarity is minor factor
} as const

// ============================================================================
// Validation Constants
// ============================================================================

/**
 * Valid ranges for property characteristics
 * Used to validate input and filter outliers
 */
export const VALIDATION_RANGES = {
  squareFeet: { min: 100, max: 50000 },
  lotSizeSqFt: { min: 500, max: 10000000 }, // 500 sqft to ~230 acres
  bedrooms: { min: 0, max: 20 },
  bathrooms: { min: 0, max: 15 },
  yearBuilt: { min: 1800, max: new Date().getFullYear() + 1 },
  garageSpaces: { min: 0, max: 10 },
  stories: { min: 1, max: 6 },
  salePrice: { min: 10000, max: 100000000 }, // $10K to $100M
} as const

/**
 * Maximum adjustment percentage for a single comp
 * If total adjustments exceed this %, the comp is likely not comparable
 */
export const MAX_ADJUSTMENT_PERCENT = 0.25 // 25% max adjustment

// ============================================================================
// Timeouts
// ============================================================================

/**
 * Timeout for AVM calculations (milliseconds)
 */
export const AVM_TIMEOUT_MS = 30000 // 30 seconds

/**
 * Timeout for database coefficient lookup (milliseconds)
 */
export const COEFFICIENT_LOOKUP_TIMEOUT_MS = 5000 // 5 seconds

// ============================================================================
// Output Formatting
// ============================================================================

/**
 * Format currency for display
 */
export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return "N/A"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format currency with abbreviated suffix (K, M, B)
 */
export function formatCurrencyShort(value: number | undefined | null): string {
  if (value === undefined || value === null) return "N/A"
  const absValue = Math.abs(value)
  const sign = value < 0 ? "-" : ""

  if (absValue >= 1e9) return `${sign}$${(absValue / 1e9).toFixed(2)}B`
  if (absValue >= 1e6) return `${sign}$${(absValue / 1e6).toFixed(2)}M`
  if (absValue >= 1e3) return `${sign}$${(absValue / 1e3).toFixed(0)}K`
  return `${sign}$${absValue.toLocaleString()}`
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return "N/A"
  return `${(value * 100).toFixed(1)}%`
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "N/A"
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return dateStr
  }
}
