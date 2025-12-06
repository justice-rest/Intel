/**
 * Confidence Score and FSD (Forecast Standard Deviation) Calculation
 *
 * The confidence score indicates how reliable the valuation estimate is.
 * It's based on the Forecast Standard Deviation (FSD) and multiple quality factors.
 *
 * FSD Calculation:
 * FSD = σ(Percentage_Errors) = √[Σ(eᵢ - ē)² / (n-1)]
 *
 * Where:
 * - eᵢ = (AVM_Value - Actual_Sale_Price) / Actual_Sale_Price
 * - ē = Mean of percentage errors
 * - n = Number of observations
 *
 * Statistical Interpretation:
 * - 68% probability: Actual value within ±1×FSD of estimate
 * - 95% probability: Actual value within ±2×FSD of estimate
 * - 99% probability: Actual value within ±3×FSD of estimate
 *
 * Industry Standard Thresholds (Freddie Mac HVE):
 * - High Confidence: FSD ≤ 13%
 * - Medium Confidence: 13% < FSD ≤ 20%
 * - Low Confidence: FSD > 20%
 */

import type {
  PropertyCharacteristics,
  ComparableSale,
  OnlineEstimate,
  ConfidenceResult,
  ConfidenceLevel,
} from "./types"
import { CONFIDENCE_THRESHOLDS, COMP_CONFIG, FSD_THRESHOLDS } from "./config"

// ============================================================================
// Types
// ============================================================================

/**
 * Inputs for confidence calculation
 */
export interface ConfidenceInput {
  property: Partial<PropertyCharacteristics>
  comparables: ComparableSale[]
  onlineEstimates: OnlineEstimate[]
  hedonicValue: number | null
  compValue: number | null
  onlineAvg: number | null
}

// ============================================================================
// Data Quality Metrics
// ============================================================================

/**
 * Calculate data completeness score (0-1)
 * Based on how many property fields are populated
 */
function calculateDataCompleteness(
  property: Partial<PropertyCharacteristics>
): number {
  const requiredFields = [
    property.squareFeet,
    property.bedrooms,
    property.bathrooms,
    property.yearBuilt,
  ]

  const optionalFields = [
    property.lotSizeSqFt,
    property.garageSpaces,
    property.hasPool,
    property.hasBasement,
    property.hasFireplace,
    property.city,
    property.state,
    property.zipCode,
  ]

  const requiredFilled = requiredFields.filter(
    (f) => f !== undefined && f !== null
  ).length
  const optionalFilled = optionalFields.filter(
    (f) => f !== undefined && f !== null
  ).length

  // Required fields are weighted more heavily
  const requiredWeight = 0.7
  const optionalWeight = 0.3

  const requiredScore = requiredFilled / requiredFields.length
  const optionalScore = optionalFilled / optionalFields.length

  return requiredScore * requiredWeight + optionalScore * optionalWeight
}

/**
 * Calculate comparable count score (0-1)
 * Based on number of comparables relative to ideal count
 */
function calculateCompCountScore(compCount: number): number {
  if (compCount >= COMP_CONFIG.minCompsForHighConfidence) {
    return 1.0
  }
  if (compCount === 0) {
    return 0.0
  }
  return compCount / COMP_CONFIG.minCompsForHighConfidence
}

/**
 * Calculate estimate agreement score (coefficient of variation)
 * Lower CV = better agreement = higher confidence
 */
function calculateEstimateAgreement(values: number[]): number {
  if (values.length < 2) {
    return 0 // Cannot calculate CV with fewer than 2 values
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean === 0) {
    return 1 // Avoid division by zero
  }

  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
    (values.length - 1)
  const stdDev = Math.sqrt(variance)
  const cv = stdDev / mean

  // Return CV capped at 1 (100% disagreement)
  return Math.min(1, cv)
}

/**
 * Calculate average days since comparable sales
 */
function calculateCompRecency(comparables: ComparableSale[]): number {
  if (comparables.length === 0) {
    return COMP_CONFIG.maxAgeDays // Maximum penalty if no comps
  }

  const totalDays = comparables.reduce((sum, c) => {
    const days = Math.floor(
      (Date.now() - new Date(c.saleDate).getTime()) / (1000 * 60 * 60 * 24)
    )
    return sum + days
  }, 0)

  return totalDays / comparables.length
}

// ============================================================================
// FSD Calculation
// ============================================================================

/**
 * Calculate FSD (Forecast Standard Deviation) based on model agreement
 *
 * FSD represents the expected error range as a percentage.
 * - Base FSD: 5% (irreducible uncertainty in any valuation)
 * - Add uncertainty for estimate disagreement
 * - Add uncertainty for data sparsity
 */
function calculateFSD(
  dataCompleteness: number,
  compCountScore: number,
  estimateAgreement: number,
  onlineEstimateCount: number
): number {
  // Base FSD (irreducible uncertainty)
  let fsd = 0.05

  // Add uncertainty from data incompleteness (up to 5%)
  fsd += (1 - dataCompleteness) * 0.05

  // Add uncertainty from few comparables (up to 7%)
  fsd += (1 - compCountScore) * 0.07

  // Add uncertainty from estimate disagreement (up to 10%)
  fsd += estimateAgreement * 0.10

  // Reduce uncertainty if we have multiple online estimates
  const onlineBonus = Math.min(0.03, onlineEstimateCount * 0.01)
  fsd -= onlineBonus

  // Clamp FSD to reasonable range (3% to 35%)
  return Math.max(0.03, Math.min(0.35, fsd))
}

// ============================================================================
// Main Calculation
// ============================================================================

/**
 * Calculate confidence score based on data quality metrics
 *
 * Score Calculation:
 * Score = 100
 *   - (1 - dataCompleteness) × 20
 *   - (1 - compCountScore) × 30
 *   - estimateAgreement × 25
 *   - min(15, compRecency/180 × 15)
 *   + min(10, onlineEstimateCount × 3)
 */
export function calculateConfidence(input: ConfidenceInput): ConfidenceResult {
  const {
    property,
    comparables,
    onlineEstimates,
    hedonicValue,
    compValue,
    onlineAvg,
  } = input

  // Calculate individual metrics
  const dataCompleteness = calculateDataCompleteness(property)
  const compCount = comparables.length
  const compCountScore = calculateCompCountScore(compCount)
  const compRecency = calculateCompRecency(comparables)

  // Calculate estimate agreement (CV of available values)
  const availableValues = [hedonicValue, compValue, onlineAvg].filter(
    (v): v is number => v !== null && v !== undefined
  )
  const estimateAgreement = calculateEstimateAgreement(availableValues)

  // Calculate raw score (0-100)
  let score = 100

  // Deduct for data incompleteness (max -20)
  score -= (1 - dataCompleteness) * 20

  // Deduct for few comparables (max -30)
  score -= (1 - compCountScore) * 30

  // Deduct for estimate disagreement (max -25)
  score -= estimateAgreement * 25

  // Deduct for stale comparables (max -15)
  const recencyPenalty = Math.min(15, (compRecency / COMP_CONFIG.maxAgeDays) * 15)
  score -= recencyPenalty

  // Bonus for multiple online estimates (max +10)
  const onlineBonus = Math.min(10, onlineEstimates.length * 3)
  score += onlineBonus

  // Bonus if all three valuation methods are available (+5)
  if (hedonicValue && compValue && onlineAvg) {
    score += 5
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score))

  // Determine level
  let level: ConfidenceLevel
  if (score >= CONFIDENCE_THRESHOLDS.high) {
    level = "high"
  } else if (score >= CONFIDENCE_THRESHOLDS.medium) {
    level = "medium"
  } else {
    level = "low"
  }

  // Calculate FSD
  const fsd = calculateFSD(
    dataCompleteness,
    compCountScore,
    estimateAgreement,
    onlineEstimates.length
  )

  return {
    score: Math.round(score),
    level,
    fsd,
    factors: {
      dataCompleteness,
      compCount: compCountScore,
      estimateAgreement,
      compRecency,
    },
  }
}

// ============================================================================
// Value Range Calculation
// ============================================================================

/**
 * Calculate value range based on FSD
 *
 * Value_Low = Estimated_Value × (1 - FSD)
 * Value_High = Estimated_Value × (1 + FSD)
 *
 * For 95% confidence interval (2×FSD):
 * Value_Low_95 = Estimated_Value × (1 - 2×FSD)
 * Value_High_95 = Estimated_Value × (1 + 2×FSD)
 */
export function calculateValueRange(
  estimatedValue: number,
  fsd: number
): { low: number; high: number; low95: number; high95: number } {
  return {
    low: estimatedValue * (1 - fsd),
    high: estimatedValue * (1 + fsd),
    low95: estimatedValue * (1 - 2 * fsd),
    high95: estimatedValue * (1 + 2 * fsd),
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get FSD quality rating
 */
export function getFSDRating(fsd: number): string {
  if (fsd <= FSD_THRESHOLDS.excellent) return "Excellent"
  if (fsd <= FSD_THRESHOLDS.good) return "Good (Lending-grade)"
  if (fsd <= FSD_THRESHOLDS.acceptable) return "Acceptable"
  return "Poor (Requires Review)"
}

/**
 * Explain confidence score in human-readable format
 */
export function explainConfidence(result: ConfidenceResult): string {
  const { score, level, fsd, factors } = result

  const lines: string[] = [
    "### Confidence Analysis",
    "",
    `**Score:** ${score}/100 (${level.toUpperCase()})`,
    `**FSD:** ${(fsd * 100).toFixed(1)}% (${getFSDRating(fsd)})`,
    "",
    "**Contributing Factors:**",
    `- Data Completeness: ${(factors.dataCompleteness * 100).toFixed(0)}%`,
    `- Comparable Count: ${(factors.compCount * 100).toFixed(0)}%`,
    `- Model Agreement: ${(100 - factors.estimateAgreement * 100).toFixed(0)}%`,
    `- Comp Recency: ${Math.round(factors.compRecency)} days avg`,
  ]

  // Add recommendations based on factors
  lines.push("")
  lines.push("**Recommendations:**")

  if (factors.dataCompleteness < 0.7) {
    lines.push("- Gather more property details (sqft, beds, baths, year built)")
  }
  if (factors.compCount < 0.6) {
    lines.push("- Find more comparable sales in the area")
  }
  if (factors.estimateAgreement > 0.15) {
    lines.push("- Models disagree significantly - verify property characteristics")
  }
  if (factors.compRecency > 120) {
    lines.push("- Comparable sales are dated - look for more recent transactions")
  }

  if (level === "high") {
    lines.push("- Valuation is suitable for preliminary decision-making")
  }

  return lines.join("\n")
}

/**
 * Get confidence level description for display
 */
export function getConfidenceLevelDescription(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
      return "High confidence - Suitable for lending decisions"
    case "medium":
      return "Medium confidence - Good for preliminary estimates"
    case "low":
      return "Low confidence - Recommend manual appraisal review"
  }
}

/**
 * Get confidence level color for UI
 */
export function getConfidenceLevelColor(level: ConfidenceLevel): {
  bg: string
  text: string
  border: string
} {
  switch (level) {
    case "high":
      return {
        bg: "bg-green-50 dark:bg-green-950/30",
        text: "text-green-700 dark:text-green-400",
        border: "border-green-200 dark:border-green-800",
      }
    case "medium":
      return {
        bg: "bg-yellow-50 dark:bg-yellow-950/30",
        text: "text-yellow-700 dark:text-yellow-400",
        border: "border-yellow-200 dark:border-yellow-800",
      }
    case "low":
      return {
        bg: "bg-red-50 dark:bg-red-950/30",
        text: "text-red-700 dark:text-red-400",
        border: "border-red-200 dark:border-red-800",
      }
  }
}
