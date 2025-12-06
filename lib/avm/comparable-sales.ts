/**
 * Comparable Sales Approach Implementation
 *
 * The Sales Comparison Approach is the most widely used appraisal method.
 * It adjusts comparable property sale prices based on feature differences
 * between the subject property and comparable sales.
 *
 * Core Formula:
 * Adjusted_Value = Comp_Sale_Price + Σ(Adjustment_i)
 *
 * Adjustment Calculation:
 * Adjustment_i = (Subject_Feature_i - Comp_Feature_i) × Price_Per_Unit_i
 *
 * Final Value:
 * Estimated_Value = Σ(wᵢ × Adjusted_Comp_Valueᵢ) / Σ(wᵢ)
 *
 * Where weights (wᵢ) are based on:
 * - Similarity score (physical characteristics match)
 * - Proximity (distance from subject)
 * - Recency (time since sale)
 * - Transaction type (arms-length preferred)
 */

import type {
  PropertyCharacteristics,
  ComparableSale,
  AdjustedComparable,
  HedonicCoefficients,
} from "./types"
import {
  COMP_CONFIG,
  COMP_SIMILARITY_WEIGHTS,
  MAX_ADJUSTMENT_PERCENT,
} from "./config"

// ============================================================================
// Types
// ============================================================================

/**
 * Result of comparable sales calculation
 */
export interface CompSalesResult {
  value: number
  adjustedComps: AdjustedComparable[]
  totalWeight: number
  averageAdjustment: number
  averageSimilarity: number
}

// ============================================================================
// Weight Calculation
// ============================================================================

/**
 * Calculate weight for a comparable based on similarity, distance, and recency
 *
 * Similarity Score Calculation:
 * Similarity = 1 - [
 *   α₁·|ΔSqFt/SqFt| +
 *   α₂·|ΔBeds| +
 *   α₃·|ΔBaths| +
 *   α₄·Distance/MaxDist +
 *   α₅·DaysSinceSale/MaxDays
 * ]
 *
 * Where α values are feature importance weights (Σαᵢ = 1)
 */
function calculateCompWeight(
  comp: ComparableSale,
  subject: Partial<PropertyCharacteristics>
): number {
  let penalty = 0

  // Square footage difference (normalized)
  if (subject.squareFeet && comp.squareFeet) {
    const sqftDiff =
      Math.abs(subject.squareFeet - comp.squareFeet) / subject.squareFeet
    penalty += COMP_SIMILARITY_WEIGHTS.sqftDifference * Math.min(1, sqftDiff)
  }

  // Bedroom difference
  if (subject.bedrooms !== undefined && comp.bedrooms !== undefined) {
    const bedroomDiff = Math.abs(subject.bedrooms - comp.bedrooms)
    penalty +=
      COMP_SIMILARITY_WEIGHTS.bedroomDifference * Math.min(1, bedroomDiff / 3)
  }

  // Bathroom difference
  if (subject.bathrooms !== undefined && comp.bathrooms !== undefined) {
    const bathroomDiff = Math.abs(subject.bathrooms - comp.bathrooms)
    penalty +=
      COMP_SIMILARITY_WEIGHTS.bathroomDifference * Math.min(1, bathroomDiff / 2)
  }

  // Distance penalty
  if (comp.distanceMiles !== undefined) {
    const distancePenalty =
      comp.distanceMiles / COMP_CONFIG.maxRadiusMiles
    penalty +=
      COMP_SIMILARITY_WEIGHTS.distance * Math.min(1, distancePenalty)
  }

  // Recency penalty
  const daysSinceSale = Math.floor(
    (Date.now() - new Date(comp.saleDate).getTime()) / (1000 * 60 * 60 * 24)
  )
  const recencyPenalty = daysSinceSale / COMP_CONFIG.maxAgeDays
  penalty += COMP_SIMILARITY_WEIGHTS.recency * Math.min(1, recencyPenalty)

  // Age difference (if available)
  if (subject.yearBuilt && comp.yearBuilt) {
    const subjectAge = new Date().getFullYear() - subject.yearBuilt
    const compAge = new Date().getFullYear() - comp.yearBuilt
    const ageDiff = Math.abs(subjectAge - compAge)
    penalty += COMP_SIMILARITY_WEIGHTS.age * Math.min(1, ageDiff / 30)
  }

  // Similarity score = 1 - penalty (clamped to 0.1 minimum)
  const similarity = Math.max(0.1, 1 - penalty)

  // Bonus for arms-length transactions
  const transactionBonus = comp.saleType === "arms_length" ? 1.0 : 0.85

  return similarity * transactionBonus
}

/**
 * Calculate similarity score between subject and comparable (0-1)
 */
export function calculateSimilarityScore(
  comp: ComparableSale,
  subject: Partial<PropertyCharacteristics>
): number {
  return calculateCompWeight(comp, subject)
}

// ============================================================================
// Adjustment Calculation
// ============================================================================

/**
 * Calculate adjustments for a single comparable
 *
 * Adjustment Logic:
 * - If subject has MORE of a feature than comp, add positive adjustment
 *   (comp price needs to be increased to match subject)
 * - If subject has LESS of a feature, add negative adjustment
 *   (comp price needs to be decreased to match subject)
 */
function calculateAdjustments(
  comp: ComparableSale,
  subject: Partial<PropertyCharacteristics>,
  coefficients: HedonicCoefficients
): { adjustments: Record<string, number>; total: number } {
  const adjustments: Record<string, number> = {}
  let total = 0

  // Square footage adjustment
  if (subject.squareFeet && comp.squareFeet) {
    const sqftDiff = subject.squareFeet - comp.squareFeet
    const adjustment = (sqftDiff / 100) * coefficients.adjSqftPer100
    adjustments.sqft = adjustment
    total += adjustment
  }

  // Bedroom adjustment
  if (subject.bedrooms !== undefined && comp.bedrooms !== undefined) {
    const bedroomDiff = subject.bedrooms - comp.bedrooms
    const adjustment = bedroomDiff * coefficients.adjBedroom
    adjustments.bedrooms = adjustment
    total += adjustment
  }

  // Bathroom adjustment
  if (subject.bathrooms !== undefined && comp.bathrooms !== undefined) {
    const bathroomDiff = subject.bathrooms - comp.bathrooms
    const adjustment = bathroomDiff * coefficients.adjBathroom
    adjustments.bathrooms = adjustment
    total += adjustment
  }

  // Age adjustment (positive if comp is older)
  if (subject.yearBuilt && comp.yearBuilt) {
    const subjectAge = new Date().getFullYear() - subject.yearBuilt
    const compAge = new Date().getFullYear() - comp.yearBuilt
    const ageDiff = compAge - subjectAge // Positive if comp is older
    const adjustment = ageDiff * coefficients.adjAgePerYear
    adjustments.age = adjustment
    total += adjustment
  }

  // Garage adjustment
  if (subject.garageSpaces !== undefined && comp.garageSpaces !== undefined) {
    const garageDiff = subject.garageSpaces - comp.garageSpaces
    const adjustment = garageDiff * coefficients.adjGarage
    adjustments.garage = adjustment
    total += adjustment
  }

  // Pool adjustment
  if (subject.hasPool !== undefined && comp.hasPool !== undefined) {
    const poolDiff = (subject.hasPool ? 1 : 0) - (comp.hasPool ? 1 : 0)
    const adjustment = poolDiff * coefficients.adjPool
    adjustments.pool = adjustment
    total += adjustment
  }

  return { adjustments, total }
}

// ============================================================================
// Main Calculation
// ============================================================================

/**
 * Calculate adjusted comparable value using sales comparison approach
 *
 * @param subject - Subject property characteristics
 * @param comparables - Array of comparable sales
 * @param coefficients - Adjustment factors (from market-specific or national)
 * @returns Comparable sales result with weighted average and adjusted comps
 */
export function calculateCompValue(
  subject: Partial<PropertyCharacteristics>,
  comparables: ComparableSale[],
  coefficients: HedonicCoefficients
): CompSalesResult | null {
  if (!comparables.length) {
    return null
  }

  // Filter to valid comparables (within date range)
  const validComps = comparables.filter((comp) => {
    const daysSinceSale = Math.floor(
      (Date.now() - new Date(comp.saleDate).getTime()) / (1000 * 60 * 60 * 24)
    )
    return daysSinceSale <= COMP_CONFIG.maxAgeDays
  })

  if (!validComps.length) {
    return null
  }

  // Calculate adjustments and weights for each comparable
  const adjustedComps: AdjustedComparable[] = validComps.map((comp) => {
    const { adjustments, total } = calculateAdjustments(
      comp,
      subject,
      coefficients
    )
    const weight = calculateCompWeight(comp, subject)

    // Cap adjustments at MAX_ADJUSTMENT_PERCENT
    const adjustmentPercent = Math.abs(total) / comp.salePrice
    const cappedTotal =
      adjustmentPercent > MAX_ADJUSTMENT_PERCENT
        ? Math.sign(total) * MAX_ADJUSTMENT_PERCENT * comp.salePrice
        : total

    return {
      comp,
      originalPrice: comp.salePrice,
      adjustedPrice: comp.salePrice + cappedTotal,
      totalAdjustment: cappedTotal,
      adjustments,
      weight,
    }
  })

  // Sort by weight (highest first) and limit to maxComps
  adjustedComps.sort((a, b) => b.weight - a.weight)
  const topComps = adjustedComps.slice(0, COMP_CONFIG.maxComps)

  // Calculate weighted average
  const totalWeight = topComps.reduce((sum, c) => sum + c.weight, 0)

  if (totalWeight === 0) {
    return null
  }

  const weightedSum = topComps.reduce(
    (sum, c) => sum + c.adjustedPrice * c.weight,
    0
  )
  const value = weightedSum / totalWeight

  // Calculate statistics
  const averageAdjustment =
    topComps.reduce((sum, c) => sum + Math.abs(c.totalAdjustment), 0) /
    topComps.length
  const averageSimilarity =
    topComps.reduce((sum, c) => sum + c.weight, 0) / topComps.length

  return {
    value,
    adjustedComps: topComps,
    totalWeight,
    averageAdjustment,
    averageSimilarity,
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format adjustment grid for display (like appraisal adjustment grid)
 *
 * Example:
 * | Feature | Subject | Comp 1 | Difference | $/Unit | Adjustment |
 * |---------|---------|--------|------------|--------|------------|
 * | Sq Ft   | 2,000   | 1,800  | +200       | $150   | +$30,000   |
 */
export function formatAdjustmentGrid(
  adjusted: AdjustedComparable,
  subject: Partial<PropertyCharacteristics>
): string {
  const lines: string[] = [
    "| Feature | Subject | Comp | Difference | Adjustment |",
    "|---------|---------|------|------------|------------|",
  ]

  const comp = adjusted.comp
  const adjustments = adjusted.adjustments

  // Square footage
  if (subject.squareFeet && comp.squareFeet) {
    const diff = subject.squareFeet - comp.squareFeet
    const adj = adjustments.sqft || 0
    lines.push(
      `| Sq Ft | ${subject.squareFeet.toLocaleString()} | ${comp.squareFeet.toLocaleString()} | ${diff >= 0 ? "+" : ""}${diff.toLocaleString()} | $${adj >= 0 ? "+" : ""}${Math.round(adj).toLocaleString()} |`
    )
  }

  // Bedrooms
  if (subject.bedrooms !== undefined && comp.bedrooms !== undefined) {
    const diff = subject.bedrooms - comp.bedrooms
    const adj = adjustments.bedrooms || 0
    lines.push(
      `| Bedrooms | ${subject.bedrooms} | ${comp.bedrooms} | ${diff >= 0 ? "+" : ""}${diff} | $${adj >= 0 ? "+" : ""}${Math.round(adj).toLocaleString()} |`
    )
  }

  // Bathrooms
  if (subject.bathrooms !== undefined && comp.bathrooms !== undefined) {
    const diff = subject.bathrooms - comp.bathrooms
    const adj = adjustments.bathrooms || 0
    lines.push(
      `| Bathrooms | ${subject.bathrooms} | ${comp.bathrooms} | ${diff >= 0 ? "+" : ""}${diff} | $${adj >= 0 ? "+" : ""}${Math.round(adj).toLocaleString()} |`
    )
  }

  // Age
  if (subject.yearBuilt && comp.yearBuilt) {
    const subjectAge = new Date().getFullYear() - subject.yearBuilt
    const compAge = new Date().getFullYear() - comp.yearBuilt
    const diff = compAge - subjectAge
    const adj = adjustments.age || 0
    lines.push(
      `| Age (yrs) | ${subjectAge} | ${compAge} | ${diff >= 0 ? "+" : ""}${diff} | $${adj >= 0 ? "+" : ""}${Math.round(adj).toLocaleString()} |`
    )
  }

  // Total
  lines.push(
    `| **Total** | | | | **$${adjusted.totalAdjustment >= 0 ? "+" : ""}${Math.round(adjusted.totalAdjustment).toLocaleString()}** |`
  )

  return lines.join("\n")
}

/**
 * Explain comparable sales result in human-readable format
 */
export function explainCompSalesResult(result: CompSalesResult): string {
  const lines: string[] = [
    "### Comparable Sales Analysis",
    "",
    `**Estimated Value:** $${Math.round(result.value).toLocaleString()}`,
    `**Comparables Used:** ${result.adjustedComps.length}`,
    `**Average Adjustment:** $${Math.round(result.averageAdjustment).toLocaleString()}`,
    `**Average Similarity:** ${(result.averageSimilarity * 100).toFixed(0)}%`,
    "",
    "**Top Comparables:**",
  ]

  result.adjustedComps.slice(0, 5).forEach((ac, index) => {
    const comp = ac.comp
    const daysSinceSale = Math.floor(
      (Date.now() - new Date(comp.saleDate).getTime()) / (1000 * 60 * 60 * 24)
    )
    const distance = comp.distanceMiles
      ? `${comp.distanceMiles.toFixed(1)} mi`
      : "N/A"

    lines.push("")
    lines.push(`**${index + 1}. ${comp.address}**`)
    lines.push(`- Sale Price: $${comp.salePrice.toLocaleString()}`)
    lines.push(`- Adjusted Price: $${Math.round(ac.adjustedPrice).toLocaleString()}`)
    lines.push(
      `- Adjustment: $${ac.totalAdjustment >= 0 ? "+" : ""}${Math.round(ac.totalAdjustment).toLocaleString()}`
    )
    lines.push(`- Weight: ${(ac.weight * 100).toFixed(0)}%`)
    lines.push(`- Distance: ${distance} | Sold: ${daysSinceSale} days ago`)
  })

  return lines.join("\n")
}

/**
 * Get statistics about comparable sales
 */
export function getCompStatistics(comparables: ComparableSale[]): {
  count: number
  avgPrice: number
  medianPrice: number
  priceRange: { min: number; max: number }
  avgDaysAgo: number
  avgDistance: number | null
} {
  if (comparables.length === 0) {
    return {
      count: 0,
      avgPrice: 0,
      medianPrice: 0,
      priceRange: { min: 0, max: 0 },
      avgDaysAgo: 0,
      avgDistance: null,
    }
  }

  const prices = comparables.map((c) => c.salePrice).sort((a, b) => a - b)
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length
  const medianPrice =
    prices.length % 2 === 0
      ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
      : prices[Math.floor(prices.length / 2)]

  const daysAgo = comparables.map((c) =>
    Math.floor(
      (Date.now() - new Date(c.saleDate).getTime()) / (1000 * 60 * 60 * 24)
    )
  )
  const avgDaysAgo = daysAgo.reduce((a, b) => a + b, 0) / daysAgo.length

  const distances = comparables
    .map((c) => c.distanceMiles)
    .filter((d): d is number => d !== undefined)
  const avgDistance =
    distances.length > 0
      ? distances.reduce((a, b) => a + b, 0) / distances.length
      : null

  return {
    count: comparables.length,
    avgPrice,
    medianPrice,
    priceRange: { min: prices[0], max: prices[prices.length - 1] },
    avgDaysAgo,
    avgDistance,
  }
}
