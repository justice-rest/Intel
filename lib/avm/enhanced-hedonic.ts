/**
 * Enhanced Hedonic Pricing Model
 *
 * Extends the base hedonic model with:
 * - Market appreciation temporal adjustments (FRED HPI)
 * - Location-based factors (schools, walkability)
 * - Property type adjustments (condos, townhomes)
 * - Condition adjustments
 *
 * Enhanced Formula:
 * ln(P) = β₀ + β₁·ln(SQFT) + β₂·ln(LOT) + β₃·BEDS + β₄·BATHS
 *         + β₅·AGE + β₆·GARAGE + β₇·POOL + β₈·BASEMENT + β₉·FIREPLACE
 *         + γ₁·SCHOOL_RATING + γ₂·WALK_SCORE + γ₃·APPRECIATION_FACTOR
 *         + δ₁·PROP_TYPE + δ₂·CONDITION + ε
 */

import type { PropertyCharacteristics, HedonicCoefficients } from "./types"
import { calculateHedonicValue, type HedonicResult } from "./hedonic-model"
import { getAppreciationRate, type AppreciationRate } from "./fred-hpi"
import {
  getLocationFactors,
  calculateLocationMultiplier,
  type LocationFactors,
} from "./location-data"
import { createLogger } from "./logger"

const logger = createLogger("enhanced-hedonic")

// ============================================================================
// Types
// ============================================================================

export interface EnhancedHedonicResult extends HedonicResult {
  baseValue: number // From standard hedonic model
  adjustments: {
    appreciation: number // Market appreciation adjustment
    location: number // School + walkability adjustment
    propertyType: number // Condo/townhome adjustment
    condition: number // Condition adjustment
    hoa: number // HOA impact (for condos)
  }
  factors: {
    appreciationRate?: AppreciationRate
    locationFactors?: LocationFactors
    locationMultiplier?: number
    propertyTypeMultiplier: number
    conditionMultiplier: number
    hoaImpact: number
  }
  enhancedConfidence: number
}

export interface EnhancedHedonicInput {
  property: Partial<PropertyCharacteristics>
  coefficients: HedonicCoefficients
  // Optional enhancements
  enableAppreciationAdjustment?: boolean
  enableLocationFactors?: boolean
  enablePropertyTypeAdjustment?: boolean
  lastSalePrice?: number
  lastSaleDate?: Date
  monthlyHoa?: number
  condition?: "excellent" | "good" | "average" | "fair" | "poor"
  propertyType?: "single_family" | "condo" | "townhouse" | "multi_family"
}

// ============================================================================
// Property Type Adjustments
// ============================================================================

/**
 * Property type multipliers
 * Single family homes are the baseline (1.0)
 */
const PROPERTY_TYPE_MULTIPLIERS: Record<string, number> = {
  single_family: 1.0,
  townhouse: 0.92, // -8% typically due to shared walls, less land
  condo: 0.85, // -15% typically due to no land, HOA restrictions
  multi_family: 1.1, // +10% due to income potential
}

/**
 * Calculate property type adjustment
 */
function getPropertyTypeMultiplier(
  propertyType?: string
): { multiplier: number; explanation: string } {
  const type = propertyType?.toLowerCase() || "single_family"
  const multiplier = PROPERTY_TYPE_MULTIPLIERS[type] || 1.0

  let explanation = "Single-family home (baseline)"
  if (type === "townhouse") {
    explanation = "Townhouse: -8% (shared walls, smaller lot)"
  } else if (type === "condo") {
    explanation = "Condo: -15% (no land ownership, HOA restrictions)"
  } else if (type === "multi_family") {
    explanation = "Multi-family: +10% (income potential)"
  }

  return { multiplier, explanation }
}

// ============================================================================
// Condition Adjustments
// ============================================================================

/**
 * Condition multipliers
 * Average condition is the baseline (1.0)
 */
const CONDITION_MULTIPLIERS: Record<string, number> = {
  excellent: 1.1, // +10% for excellent condition
  good: 1.05, // +5% for good condition
  average: 1.0, // Baseline
  fair: 0.92, // -8% for fair condition
  poor: 0.8, // -20% for poor condition
}

/**
 * Calculate condition adjustment
 */
function getConditionMultiplier(
  condition?: string
): { multiplier: number; explanation: string } {
  const cond = condition?.toLowerCase() || "average"
  const multiplier = CONDITION_MULTIPLIERS[cond] || 1.0

  let explanation = "Average condition (baseline)"
  if (cond === "excellent") {
    explanation = "Excellent condition: +10%"
  } else if (cond === "good") {
    explanation = "Good condition: +5%"
  } else if (cond === "fair") {
    explanation = "Fair condition: -8%"
  } else if (cond === "poor") {
    explanation = "Poor condition: -20%"
  }

  return { multiplier, explanation }
}

// ============================================================================
// HOA Impact
// ============================================================================

/**
 * Calculate HOA impact on value
 *
 * HOA fees reduce effective affordability:
 * - Each $100/month in HOA fees reduces purchasing power by ~$15,000-20,000
 * - This is because buyers budget total monthly payment
 *
 * Formula: Value adjustment = -HOA * 150 (conservative estimate)
 */
function calculateHoaImpact(monthlyHoa?: number): number {
  if (!monthlyHoa || monthlyHoa <= 0) return 0

  // Each $1 of monthly HOA reduces value by ~$150
  // This is based on typical mortgage payment calculations
  // (assuming HOA comes from the same monthly housing budget)
  return -monthlyHoa * 150
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Calculate enhanced hedonic value with all adjustments
 */
export async function calculateEnhancedHedonicValue(
  input: EnhancedHedonicInput
): Promise<EnhancedHedonicResult | null> {
  const {
    property,
    coefficients,
    enableAppreciationAdjustment = true,
    enableLocationFactors = true,
    enablePropertyTypeAdjustment = true,
    lastSalePrice,
    lastSaleDate,
    monthlyHoa,
    condition,
    propertyType,
  } = input

  logger.debug("Calculating enhanced hedonic value", {
    address: property.address,
    enableAppreciation: enableAppreciationAdjustment,
    enableLocation: enableLocationFactors,
    enablePropertyType: enablePropertyTypeAdjustment,
  })

  // Step 1: Calculate base hedonic value
  const baseResult = calculateHedonicValue(property, coefficients)
  if (!baseResult) {
    logger.warn("Base hedonic calculation failed", { address: property.address })
    return null
  }

  let adjustedValue = baseResult.value
  const adjustments = {
    appreciation: 0,
    location: 0,
    propertyType: 0,
    condition: 0,
    hoa: 0,
  }
  const factors: EnhancedHedonicResult["factors"] = {
    propertyTypeMultiplier: 1.0,
    conditionMultiplier: 1.0,
    hoaImpact: 0,
  }

  // Track confidence adjustments
  let confidenceBonus = 0

  // Step 2: Apply market appreciation adjustment
  if (enableAppreciationAdjustment && lastSalePrice && lastSaleDate) {
    try {
      const appreciationRate = await getAppreciationRate(
        property.city,
        property.state
      )
      factors.appreciationRate = appreciationRate

      // Calculate months since last sale
      const monthsSinceSale = Math.floor(
        (Date.now() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      )

      if (monthsSinceSale > 0 && monthsSinceSale <= 60) {
        // Cap at 5 years
        const appreciationMultiplier = Math.pow(
          1 + appreciationRate.monthly,
          monthsSinceSale
        )
        // Weight the appreciation-adjusted sale price with hedonic model
        const appreciatedSalePrice = lastSalePrice * appreciationMultiplier
        const blendedValue = adjustedValue * 0.6 + appreciatedSalePrice * 0.4

        adjustments.appreciation = blendedValue - adjustedValue
        adjustedValue = blendedValue

        if (appreciationRate.confidence === "high") {
          confidenceBonus += 0.05
        }

        logger.debug("Applied appreciation adjustment", {
          monthsSinceSale,
          rate: appreciationRate.annualized,
          adjustment: adjustments.appreciation,
        })
      }
    } catch (error) {
      logger.warn("Failed to apply appreciation adjustment", {}, error as Error)
    }
  }

  // Step 3: Apply location factors
  if (enableLocationFactors && property.address) {
    try {
      const locationFactors = await getLocationFactors(property.address)
      factors.locationFactors = locationFactors

      const { multiplier, explanation } =
        calculateLocationMultiplier(locationFactors)
      factors.locationMultiplier = multiplier

      const locationAdjustment = adjustedValue * (multiplier - 1)
      adjustments.location = locationAdjustment
      adjustedValue += locationAdjustment

      if (locationFactors.confidence === "high") {
        confidenceBonus += 0.05
      }

      logger.debug("Applied location adjustment", {
        multiplier,
        explanation,
        adjustment: adjustments.location,
      })
    } catch (error) {
      logger.warn("Failed to apply location factors", {}, error as Error)
    }
  }

  // Step 4: Apply property type adjustment
  if (enablePropertyTypeAdjustment) {
    const { multiplier: propTypeMultiplier, explanation: propTypeExplanation } =
      getPropertyTypeMultiplier(propertyType || property.propertyType)
    factors.propertyTypeMultiplier = propTypeMultiplier

    if (propTypeMultiplier !== 1.0) {
      const propTypeAdjustment = adjustedValue * (propTypeMultiplier - 1)
      adjustments.propertyType = propTypeAdjustment
      adjustedValue += propTypeAdjustment

      logger.debug("Applied property type adjustment", {
        type: propertyType || property.propertyType,
        multiplier: propTypeMultiplier,
        explanation: propTypeExplanation,
      })
    }
  }

  // Step 5: Apply condition adjustment
  const { multiplier: condMultiplier, explanation: condExplanation } =
    getConditionMultiplier(condition || property.condition)
  factors.conditionMultiplier = condMultiplier

  if (condMultiplier !== 1.0) {
    const conditionAdjustment = adjustedValue * (condMultiplier - 1)
    adjustments.condition = conditionAdjustment
    adjustedValue += conditionAdjustment

    logger.debug("Applied condition adjustment", {
      condition: condition || property.condition,
      multiplier: condMultiplier,
      explanation: condExplanation,
    })
  }

  // Step 6: Apply HOA impact
  const hoaImpact = calculateHoaImpact(monthlyHoa)
  factors.hoaImpact = hoaImpact

  if (hoaImpact !== 0) {
    adjustments.hoa = hoaImpact
    adjustedValue += hoaImpact

    logger.debug("Applied HOA impact", {
      monthlyHoa,
      impact: hoaImpact,
    })
  }

  // Calculate enhanced confidence
  const enhancedConfidence = Math.min(
    1.0,
    baseResult.confidence + confidenceBonus
  )

  const result: EnhancedHedonicResult = {
    value: Math.round(adjustedValue),
    confidence: enhancedConfidence,
    components: baseResult.components,
    baseValue: Math.round(baseResult.value),
    adjustments: {
      appreciation: Math.round(adjustments.appreciation),
      location: Math.round(adjustments.location),
      propertyType: Math.round(adjustments.propertyType),
      condition: Math.round(adjustments.condition),
      hoa: Math.round(adjustments.hoa),
    },
    factors,
    enhancedConfidence,
  }

  logger.info("Enhanced hedonic calculation complete", {
    address: property.address,
    baseValue: result.baseValue,
    adjustedValue: result.value,
    totalAdjustment: result.value - result.baseValue,
  })

  return result
}

/**
 * Format enhanced hedonic result for display
 */
export function formatEnhancedHedonicResult(
  result: EnhancedHedonicResult
): string {
  const lines: string[] = [
    "### Enhanced Hedonic Model Breakdown",
    "",
    `**Base Value:** $${result.baseValue.toLocaleString()}`,
    "",
    "**Adjustments:**",
  ]

  if (result.adjustments.appreciation !== 0) {
    const sign = result.adjustments.appreciation > 0 ? "+" : ""
    lines.push(
      `- Market Appreciation: ${sign}$${result.adjustments.appreciation.toLocaleString()}`
    )
  }

  if (result.adjustments.location !== 0) {
    const sign = result.adjustments.location > 0 ? "+" : ""
    lines.push(
      `- Location (Schools/Walkability): ${sign}$${result.adjustments.location.toLocaleString()}`
    )
  }

  if (result.adjustments.propertyType !== 0) {
    const sign = result.adjustments.propertyType > 0 ? "+" : ""
    lines.push(
      `- Property Type: ${sign}$${result.adjustments.propertyType.toLocaleString()}`
    )
  }

  if (result.adjustments.condition !== 0) {
    const sign = result.adjustments.condition > 0 ? "+" : ""
    lines.push(
      `- Condition: ${sign}$${result.adjustments.condition.toLocaleString()}`
    )
  }

  if (result.adjustments.hoa !== 0) {
    lines.push(`- HOA Impact: $${result.adjustments.hoa.toLocaleString()}`)
  }

  lines.push("")
  lines.push(`**Enhanced Value:** $${result.value.toLocaleString()}`)
  lines.push(
    `**Confidence:** ${(result.enhancedConfidence * 100).toFixed(0)}%`
  )

  return lines.join("\n")
}
