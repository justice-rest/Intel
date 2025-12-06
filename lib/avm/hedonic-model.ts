/**
 * Hedonic Pricing Model Implementation
 *
 * The hedonic model decomposes property value into constituent characteristics.
 * Based on economic theory that a property's value is the sum of its individual
 * attribute values.
 *
 * Standard Log-Linear Form:
 * ln(P) = β₀ + β₁·ln(SQFT) + β₂·ln(LOT) + β₃·BEDS + β₄·BATHS
 *         + β₅·AGE + β₆·GARAGE + β₇·POOL + β₈·BASEMENT + β₉·FIREPLACE + ε
 *
 * Why Log-Linear?
 * - Captures diminishing returns (going from 1,000 to 1,500 sqft adds more value
 *   than 3,000 to 3,500 sqft)
 * - Ensures predicted prices are always positive
 * - Coefficients represent percentage changes (elasticities)
 */

import type { PropertyCharacteristics, HedonicCoefficients } from "./types"
import { VALIDATION_RANGES } from "./config"

// ============================================================================
// Types
// ============================================================================

/**
 * Result of hedonic pricing calculation
 */
export interface HedonicResult {
  value: number
  confidence: number // 0-1, based on data completeness
  components: HedonicComponents
}

/**
 * Breakdown of value components
 */
export interface HedonicComponents {
  baseValue: number // exp(intercept)
  sqftContribution: number
  lotContribution: number
  bedroomContribution: number
  bathroomContribution: number
  ageContribution: number
  garageContribution: number
  poolContribution: number
  basementContribution: number
  fireplaceContribution: number
  totalLnPrice: number
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate and clamp numeric value to valid range
 */
function validateRange(
  value: number | undefined,
  range: { min: number; max: number }
): number | undefined {
  if (value === undefined || value === null) return undefined
  if (isNaN(value)) return undefined
  return Math.max(range.min, Math.min(range.max, value))
}

/**
 * Validate property characteristics
 */
function validateCharacteristics(
  property: Partial<PropertyCharacteristics>
): Partial<PropertyCharacteristics> {
  return {
    ...property,
    squareFeet: validateRange(property.squareFeet, VALIDATION_RANGES.squareFeet),
    lotSizeSqFt: validateRange(property.lotSizeSqFt, VALIDATION_RANGES.lotSizeSqFt),
    bedrooms: validateRange(property.bedrooms, VALIDATION_RANGES.bedrooms),
    bathrooms: validateRange(property.bathrooms, VALIDATION_RANGES.bathrooms),
    yearBuilt: validateRange(property.yearBuilt, VALIDATION_RANGES.yearBuilt),
    garageSpaces: validateRange(property.garageSpaces, VALIDATION_RANGES.garageSpaces),
  }
}

// ============================================================================
// Hedonic Calculation
// ============================================================================

/**
 * Calculate property value using hedonic pricing model
 *
 * @param property - Property characteristics
 * @param coefficients - Hedonic coefficients (market-specific or national)
 * @returns Hedonic result with value, confidence, and component breakdown
 */
export function calculateHedonicValue(
  property: Partial<PropertyCharacteristics>,
  coefficients: HedonicCoefficients
): HedonicResult | null {
  // Validate input
  const validated = validateCharacteristics(property)
  const {
    squareFeet,
    lotSizeSqFt,
    bedrooms,
    bathrooms,
    yearBuilt,
    garageSpaces,
    hasPool,
    hasBasement,
    hasFireplace,
  } = validated

  // Minimum required: square footage
  if (!squareFeet || squareFeet <= 0) {
    return null
  }

  // Initialize components
  const components: HedonicComponents = {
    baseValue: 0,
    sqftContribution: 0,
    lotContribution: 0,
    bedroomContribution: 0,
    bathroomContribution: 0,
    ageContribution: 0,
    garageContribution: 0,
    poolContribution: 0,
    basementContribution: 0,
    fireplaceContribution: 0,
    totalLnPrice: 0,
  }

  // Track data completeness for confidence
  let fieldsUsed = 1 // sqft always used
  const totalFields = 9

  // Start with intercept
  let lnPrice = coefficients.intercept
  components.baseValue = Math.exp(coefficients.intercept)

  // Square footage (required, log form)
  const lnSqft = Math.log(squareFeet)
  const sqftComponent = coefficients.lnSqftCoef * lnSqft
  lnPrice += sqftComponent
  components.sqftContribution = sqftComponent

  // Lot size (optional, log form)
  if (lotSizeSqFt && lotSizeSqFt > 0) {
    const lnLot = Math.log(lotSizeSqFt)
    const lotComponent = coefficients.lnLotSizeCoef * lnLot
    lnPrice += lotComponent
    components.lotContribution = lotComponent
    fieldsUsed++
  }

  // Bedrooms (optional, linear)
  if (bedrooms !== undefined && bedrooms >= 0) {
    const bedroomComponent = coefficients.bedroomCoef * bedrooms
    lnPrice += bedroomComponent
    components.bedroomContribution = bedroomComponent
    fieldsUsed++
  }

  // Bathrooms (optional, linear)
  if (bathrooms !== undefined && bathrooms >= 0) {
    const bathroomComponent = coefficients.bathroomCoef * bathrooms
    lnPrice += bathroomComponent
    components.bathroomContribution = bathroomComponent
    fieldsUsed++
  }

  // Age (calculated from year built)
  if (yearBuilt && yearBuilt > 1800) {
    const currentYear = new Date().getFullYear()
    const age = currentYear - yearBuilt
    const ageComponent = coefficients.ageCoef * age
    lnPrice += ageComponent
    components.ageContribution = ageComponent
    fieldsUsed++
  }

  // Garage spaces (optional, linear)
  if (garageSpaces !== undefined && garageSpaces >= 0) {
    const garageComponent = coefficients.garageCoef * garageSpaces
    lnPrice += garageComponent
    components.garageContribution = garageComponent
    fieldsUsed++
  }

  // Pool (optional, binary)
  if (hasPool !== undefined) {
    const poolComponent = coefficients.poolCoef * (hasPool ? 1 : 0)
    lnPrice += poolComponent
    components.poolContribution = poolComponent
    fieldsUsed++
  }

  // Basement (optional, binary)
  if (hasBasement !== undefined) {
    const basementComponent = coefficients.basementCoef * (hasBasement ? 1 : 0)
    lnPrice += basementComponent
    components.basementContribution = basementComponent
    fieldsUsed++
  }

  // Fireplace (optional, binary)
  if (hasFireplace !== undefined) {
    const fireplaceComponent =
      coefficients.fireplaceCoef * (hasFireplace ? 1 : 0)
    lnPrice += fireplaceComponent
    components.fireplaceContribution = fireplaceComponent
    fieldsUsed++
  }

  components.totalLnPrice = lnPrice

  // Convert from log to actual price
  const value = Math.exp(lnPrice)

  // Confidence based on data completeness
  const confidence = fieldsUsed / totalFields

  return { value, confidence, components }
}

// ============================================================================
// Marginal Value Calculations
// ============================================================================

/**
 * Calculate marginal value of one additional square foot
 *
 * For continuous variables in log form:
 * ∂P/∂X = βₓ · (P/X)
 *
 * Example: If β₁ = 0.45, P = $400,000, and SQFT = 2,000:
 * Marginal_Value_SQFT = 0.45 × ($400,000 / 2,000) = $90/sqft
 */
export function calculateMarginalValueSqft(
  estimatedValue: number,
  squareFeet: number,
  lnSqftCoef: number
): number {
  if (squareFeet <= 0) return 0
  return lnSqftCoef * (estimatedValue / squareFeet)
}

/**
 * Calculate marginal value of one additional bedroom
 * For linear coefficients: ∂P/∂X = βₓ · P
 */
export function calculateMarginalValueBedroom(
  estimatedValue: number,
  bedroomCoef: number
): number {
  return bedroomCoef * estimatedValue
}

/**
 * Calculate marginal value of one additional bathroom
 */
export function calculateMarginalValueBathroom(
  estimatedValue: number,
  bathroomCoef: number
): number {
  return bathroomCoef * estimatedValue
}

/**
 * Calculate depreciation per year of age
 * Note: This is typically negative
 */
export function calculateDepreciationPerYear(
  estimatedValue: number,
  ageCoef: number
): number {
  return ageCoef * estimatedValue
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Explain the hedonic model result in human-readable format
 */
export function explainHedonicResult(
  result: HedonicResult,
  property: Partial<PropertyCharacteristics>
): string {
  const { value, confidence, components } = result

  const lines: string[] = [
    "### Hedonic Model Breakdown",
    "",
    `**Estimated Value:** $${Math.round(value).toLocaleString()}`,
    `**Model Confidence:** ${(confidence * 100).toFixed(0)}% (based on data completeness)`,
    "",
    "**Value Components:**",
  ]

  // Base value
  lines.push(`- Base value: $${Math.round(components.baseValue).toLocaleString()}`)

  // Square footage
  if (property.squareFeet) {
    const sqftEffect = Math.exp(components.sqftContribution)
    lines.push(
      `- ${property.squareFeet.toLocaleString()} sqft: ${sqftEffect.toFixed(2)}x multiplier`
    )
  }

  // Lot size
  if (property.lotSizeSqFt && components.lotContribution !== 0) {
    const lotEffect = Math.exp(components.lotContribution)
    lines.push(
      `- ${(property.lotSizeSqFt / 43560).toFixed(2)} acre lot: ${lotEffect.toFixed(2)}x multiplier`
    )
  }

  // Bedrooms
  if (property.bedrooms !== undefined && components.bedroomContribution !== 0) {
    const bedroomPercent = (Math.exp(components.bedroomContribution) - 1) * 100
    lines.push(
      `- ${property.bedrooms} bedrooms: ${bedroomPercent >= 0 ? "+" : ""}${bedroomPercent.toFixed(1)}%`
    )
  }

  // Bathrooms
  if (property.bathrooms !== undefined && components.bathroomContribution !== 0) {
    const bathroomPercent = (Math.exp(components.bathroomContribution) - 1) * 100
    lines.push(
      `- ${property.bathrooms} bathrooms: ${bathroomPercent >= 0 ? "+" : ""}${bathroomPercent.toFixed(1)}%`
    )
  }

  // Age
  if (property.yearBuilt && components.ageContribution !== 0) {
    const age = new Date().getFullYear() - property.yearBuilt
    const agePercent = (Math.exp(components.ageContribution) - 1) * 100
    lines.push(
      `- ${age} years old: ${agePercent >= 0 ? "+" : ""}${agePercent.toFixed(1)}%`
    )
  }

  // Features
  if (property.garageSpaces && components.garageContribution !== 0) {
    const garagePercent = (Math.exp(components.garageContribution) - 1) * 100
    lines.push(
      `- ${property.garageSpaces} garage spaces: +${garagePercent.toFixed(1)}%`
    )
  }

  if (property.hasPool && components.poolContribution !== 0) {
    const poolPercent = (Math.exp(components.poolContribution) - 1) * 100
    lines.push(`- Pool: +${poolPercent.toFixed(1)}%`)
  }

  if (property.hasBasement && components.basementContribution !== 0) {
    const basementPercent = (Math.exp(components.basementContribution) - 1) * 100
    lines.push(`- Basement: +${basementPercent.toFixed(1)}%`)
  }

  if (property.hasFireplace && components.fireplaceContribution !== 0) {
    const fireplacePercent =
      (Math.exp(components.fireplaceContribution) - 1) * 100
    lines.push(`- Fireplace: +${fireplacePercent.toFixed(1)}%`)
  }

  return lines.join("\n")
}
