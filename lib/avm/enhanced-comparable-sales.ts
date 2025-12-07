/**
 * Enhanced Comparable Sales Module
 *
 * Extends the base comparable sales approach with:
 * - Geo-distance weighting using Haversine formula
 * - Market appreciation temporal adjustments
 * - Property type matching
 * - Enhanced similarity scoring
 * - Condition adjustments
 *
 * Key Improvements:
 * 1. Precise distance calculation using lat/long
 * 2. Time-adjusted comp prices for market appreciation
 * 3. Property type compatibility scoring
 * 4. Multi-factor similarity algorithm
 */

import type {
  PropertyCharacteristics,
  ComparableSale,
  AdjustedComparable,
  HedonicCoefficients,
} from "./types"
import {
  COMP_CONFIG,
  MAX_ADJUSTMENT_PERCENT,
} from "./config"
import { adjustForAppreciation } from "./fred-hpi"
import { createLogger } from "./logger"

const logger = createLogger("enhanced-comparable-sales")

// ============================================================================
// Types
// ============================================================================

export interface EnhancedCompSalesResult {
  value: number
  adjustedComps: EnhancedAdjustedComparable[]
  totalWeight: number
  averageAdjustment: number
  averageSimilarity: number
  appreciationAdjusted: boolean
  geoWeighted: boolean
  statistics: CompStatistics
}

export interface EnhancedAdjustedComparable extends AdjustedComparable {
  geoDistance?: number // Actual distance in miles
  appreciationAdjustment?: number // Time adjustment
  propertyTypeMatch: boolean
  enhancedSimilarity: number // 0-1 scale
  adjustmentBreakdown: {
    sqft: number
    bedrooms: number
    bathrooms: number
    age: number
    garage: number
    pool: number
    appreciation: number
    location: number
  }
}

export interface CompStatistics {
  count: number
  avgPrice: number
  medianPrice: number
  priceRange: { min: number; max: number }
  avgDaysAgo: number
  avgDistance: number | null
  pricePerSqFtRange: { min: number; max: number }
  avgPricePerSqFt: number
}

export interface GeoPoint {
  latitude: number
  longitude: number
}

export interface EnhancedCompInput {
  subject: Partial<PropertyCharacteristics>
  comparables: ComparableSale[]
  coefficients: HedonicCoefficients
  // Subject location for geo-weighting
  subjectLocation?: GeoPoint
  // Enable market appreciation adjustment
  enableAppreciation?: boolean
  // Property type for matching
  propertyType?: string
}

// ============================================================================
// Geo-Distance Calculation
// ============================================================================

/**
 * Calculate distance between two points using Haversine formula
 *
 * @param point1 - First coordinate
 * @param point2 - Second coordinate
 * @returns Distance in miles
 */
export function calculateHaversineDistance(
  point1: GeoPoint,
  point2: GeoPoint
): number {
  const R = 3958.8 // Earth's radius in miles

  const lat1Rad = (point1.latitude * Math.PI) / 180
  const lat2Rad = (point2.latitude * Math.PI) / 180
  const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180
  const dLon = ((point2.longitude - point1.longitude) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Parse coordinates from comparable if available
 */
function parseCompCoordinates(comp: ComparableSale): GeoPoint | null {
  // Try to get from comp properties
  const lat = (comp as { latitude?: number }).latitude
  const lon = (comp as { longitude?: number }).longitude

  if (lat && lon) {
    return { latitude: lat, longitude: lon }
  }

  return null
}

// ============================================================================
// Enhanced Similarity Scoring
// ============================================================================

/**
 * Enhanced similarity weights with more factors
 */
const ENHANCED_SIMILARITY_WEIGHTS = {
  squareFeet: 0.25, // Size is most important
  bedrooms: 0.12,
  bathrooms: 0.10,
  distance: 0.18, // Location proximity
  recency: 0.12, // Time since sale
  age: 0.08, // Property age similarity
  lotSize: 0.08, // Lot size match
  propertyType: 0.07, // Same property type bonus
}

/**
 * Calculate enhanced similarity score
 */
function calculateEnhancedSimilarity(
  comp: ComparableSale,
  subject: Partial<PropertyCharacteristics>,
  geoDistance?: number,
  propertyTypeMatch: boolean = true
): number {
  let score = 1.0

  // Square footage difference (normalized)
  if (subject.squareFeet && comp.squareFeet) {
    const sqftDiff =
      Math.abs(subject.squareFeet - comp.squareFeet) / subject.squareFeet
    score -= ENHANCED_SIMILARITY_WEIGHTS.squareFeet * Math.min(1, sqftDiff)
  }

  // Bedroom difference
  if (subject.bedrooms !== undefined && comp.bedrooms !== undefined) {
    const bedroomDiff = Math.abs(subject.bedrooms - comp.bedrooms)
    score -=
      ENHANCED_SIMILARITY_WEIGHTS.bedrooms * Math.min(1, bedroomDiff / 3)
  }

  // Bathroom difference
  if (subject.bathrooms !== undefined && comp.bathrooms !== undefined) {
    const bathroomDiff = Math.abs(subject.bathrooms - comp.bathrooms)
    score -=
      ENHANCED_SIMILARITY_WEIGHTS.bathrooms * Math.min(1, bathroomDiff / 2)
  }

  // Distance penalty (using actual geo-distance if available)
  const distance = geoDistance ?? comp.distanceMiles ?? 1
  const distancePenalty = distance / COMP_CONFIG.maxRadiusMiles
  score -= ENHANCED_SIMILARITY_WEIGHTS.distance * Math.min(1, distancePenalty)

  // Recency penalty
  const daysSinceSale = Math.floor(
    (Date.now() - new Date(comp.saleDate).getTime()) / (1000 * 60 * 60 * 24)
  )
  const recencyPenalty = daysSinceSale / COMP_CONFIG.maxAgeDays
  score -= ENHANCED_SIMILARITY_WEIGHTS.recency * Math.min(1, recencyPenalty)

  // Age difference
  if (subject.yearBuilt && comp.yearBuilt) {
    const subjectAge = new Date().getFullYear() - subject.yearBuilt
    const compAge = new Date().getFullYear() - comp.yearBuilt
    const ageDiff = Math.abs(subjectAge - compAge)
    score -= ENHANCED_SIMILARITY_WEIGHTS.age * Math.min(1, ageDiff / 30)
  }

  // Lot size difference
  if (subject.lotSizeSqFt && comp.lotSizeSqFt) {
    const lotDiff =
      Math.abs(subject.lotSizeSqFt - comp.lotSizeSqFt) / subject.lotSizeSqFt
    score -= ENHANCED_SIMILARITY_WEIGHTS.lotSize * Math.min(1, lotDiff)
  }

  // Property type match bonus
  if (!propertyTypeMatch) {
    score -= ENHANCED_SIMILARITY_WEIGHTS.propertyType
  }

  // Clamp to valid range
  return Math.max(0.1, Math.min(1.0, score))
}

// ============================================================================
// Enhanced Adjustments
// ============================================================================

/**
 * Calculate enhanced adjustments with appreciation
 */
async function calculateEnhancedAdjustments(
  comp: ComparableSale,
  subject: Partial<PropertyCharacteristics>,
  coefficients: HedonicCoefficients,
  enableAppreciation: boolean
): Promise<{
  adjustments: EnhancedAdjustedComparable["adjustmentBreakdown"]
  total: number
  appreciationAdjustment: number
}> {
  const adjustments: EnhancedAdjustedComparable["adjustmentBreakdown"] = {
    sqft: 0,
    bedrooms: 0,
    bathrooms: 0,
    age: 0,
    garage: 0,
    pool: 0,
    appreciation: 0,
    location: 0,
  }
  let total = 0
  let appreciationAdjustment = 0

  // Square footage adjustment
  if (subject.squareFeet && comp.squareFeet) {
    const sqftDiff = subject.squareFeet - comp.squareFeet
    adjustments.sqft = (sqftDiff / 100) * coefficients.adjSqftPer100
    total += adjustments.sqft
  }

  // Bedroom adjustment
  if (subject.bedrooms !== undefined && comp.bedrooms !== undefined) {
    const bedroomDiff = subject.bedrooms - comp.bedrooms
    adjustments.bedrooms = bedroomDiff * coefficients.adjBedroom
    total += adjustments.bedrooms
  }

  // Bathroom adjustment
  if (subject.bathrooms !== undefined && comp.bathrooms !== undefined) {
    const bathroomDiff = subject.bathrooms - comp.bathrooms
    adjustments.bathrooms = bathroomDiff * coefficients.adjBathroom
    total += adjustments.bathrooms
  }

  // Age adjustment
  if (subject.yearBuilt && comp.yearBuilt) {
    const subjectAge = new Date().getFullYear() - subject.yearBuilt
    const compAge = new Date().getFullYear() - comp.yearBuilt
    const ageDiff = compAge - subjectAge // Positive if comp is older
    adjustments.age = ageDiff * coefficients.adjAgePerYear
    total += adjustments.age
  }

  // Garage adjustment
  if (subject.garageSpaces !== undefined && comp.garageSpaces !== undefined) {
    const garageDiff = subject.garageSpaces - comp.garageSpaces
    adjustments.garage = garageDiff * coefficients.adjGarage
    total += adjustments.garage
  }

  // Pool adjustment
  if (subject.hasPool !== undefined && comp.hasPool !== undefined) {
    const poolDiff = (subject.hasPool ? 1 : 0) - (comp.hasPool ? 1 : 0)
    adjustments.pool = poolDiff * coefficients.adjPool
    total += adjustments.pool
  }

  // Market appreciation adjustment
  if (enableAppreciation) {
    const monthsSinceSale = Math.floor(
      (Date.now() - new Date(comp.saleDate).getTime()) /
        (1000 * 60 * 60 * 24 * 30)
    )

    if (monthsSinceSale > 0) {
      try {
        const result = await adjustForAppreciation(
          comp.salePrice,
          monthsSinceSale,
          comp.city || subject.city,
          comp.state || subject.state
        )

        appreciationAdjustment = result.adjustment
        adjustments.appreciation = appreciationAdjustment
        total += appreciationAdjustment

        logger.debug("Applied appreciation adjustment to comp", {
          address: comp.address,
          monthsSinceSale,
          adjustment: appreciationAdjustment,
          rate: result.appreciationRate,
        })
      } catch {
        logger.warn("Failed to calculate appreciation for comp", {
          address: comp.address,
        })
      }
    }
  }

  return { adjustments, total, appreciationAdjustment }
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Calculate enhanced comparable sales value
 */
export async function calculateEnhancedCompValue(
  input: EnhancedCompInput
): Promise<EnhancedCompSalesResult | null> {
  const {
    subject,
    comparables,
    coefficients,
    subjectLocation,
    enableAppreciation = true,
    propertyType,
  } = input

  if (!comparables.length) {
    logger.warn("No comparables provided")
    return null
  }

  logger.info("Calculating enhanced comp value", {
    address: subject.address,
    compCount: comparables.length,
    enableAppreciation,
    hasGeoData: !!subjectLocation,
  })

  // Filter to valid comparables (within date range)
  const validComps = comparables.filter((comp) => {
    const daysSinceSale = Math.floor(
      (Date.now() - new Date(comp.saleDate).getTime()) / (1000 * 60 * 60 * 24)
    )
    return daysSinceSale <= COMP_CONFIG.maxAgeDays
  })

  if (!validComps.length) {
    logger.warn("No valid comparables after filtering")
    return null
  }

  // Process each comparable
  const enhancedComps: EnhancedAdjustedComparable[] = []

  for (const comp of validComps) {
    // Calculate geo-distance if coordinates available
    let geoDistance: number | undefined
    if (subjectLocation) {
      const compLocation = parseCompCoordinates(comp)
      if (compLocation) {
        geoDistance = calculateHaversineDistance(subjectLocation, compLocation)
      }
    }

    // Determine property type match
    const compPropertyType = (comp as { propertyType?: string }).propertyType
    const propertyTypeMatch =
      !propertyType || !compPropertyType || propertyType === compPropertyType

    // Calculate enhanced similarity
    const enhancedSimilarity = calculateEnhancedSimilarity(
      comp,
      subject,
      geoDistance,
      propertyTypeMatch
    )

    // Calculate adjustments
    const { adjustments, total, appreciationAdjustment } =
      await calculateEnhancedAdjustments(
        comp,
        subject,
        coefficients,
        enableAppreciation
      )

    // Cap adjustments
    const adjustmentPercent = Math.abs(total) / comp.salePrice
    const cappedTotal =
      adjustmentPercent > MAX_ADJUSTMENT_PERCENT
        ? Math.sign(total) * MAX_ADJUSTMENT_PERCENT * comp.salePrice
        : total

    const enhancedComp: EnhancedAdjustedComparable = {
      comp,
      originalPrice: comp.salePrice,
      adjustedPrice: comp.salePrice + cappedTotal,
      totalAdjustment: cappedTotal,
      adjustments: {
        sqft: adjustments.sqft,
        bedrooms: adjustments.bedrooms,
        bathrooms: adjustments.bathrooms,
        age: adjustments.age,
        garage: adjustments.garage,
        pool: adjustments.pool,
      },
      weight: enhancedSimilarity,
      geoDistance,
      appreciationAdjustment,
      propertyTypeMatch,
      enhancedSimilarity,
      adjustmentBreakdown: adjustments,
    }

    enhancedComps.push(enhancedComp)
  }

  // Sort by similarity and limit
  enhancedComps.sort((a, b) => b.enhancedSimilarity - a.enhancedSimilarity)
  const topComps = enhancedComps.slice(0, COMP_CONFIG.maxComps)

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
  const statistics = calculateCompStatistics(topComps)

  const result: EnhancedCompSalesResult = {
    value: Math.round(value),
    adjustedComps: topComps,
    totalWeight,
    averageAdjustment:
      topComps.reduce((sum, c) => sum + Math.abs(c.totalAdjustment), 0) /
      topComps.length,
    averageSimilarity:
      topComps.reduce((sum, c) => sum + c.enhancedSimilarity, 0) /
      topComps.length,
    appreciationAdjusted: enableAppreciation,
    geoWeighted: !!subjectLocation,
    statistics,
  }

  logger.info("Enhanced comp calculation complete", {
    address: subject.address,
    value: result.value,
    compsUsed: topComps.length,
    avgSimilarity: result.averageSimilarity,
  })

  return result
}

/**
 * Calculate statistics for comparables
 */
function calculateCompStatistics(
  comps: EnhancedAdjustedComparable[]
): CompStatistics {
  if (comps.length === 0) {
    return {
      count: 0,
      avgPrice: 0,
      medianPrice: 0,
      priceRange: { min: 0, max: 0 },
      avgDaysAgo: 0,
      avgDistance: null,
      pricePerSqFtRange: { min: 0, max: 0 },
      avgPricePerSqFt: 0,
    }
  }

  const prices = comps.map((c) => c.originalPrice).sort((a, b) => a - b)
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length
  const medianPrice =
    prices.length % 2 === 0
      ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
      : prices[Math.floor(prices.length / 2)]

  const daysAgo = comps.map((c) =>
    Math.floor(
      (Date.now() - new Date(c.comp.saleDate).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  )
  const avgDaysAgo = daysAgo.reduce((a, b) => a + b, 0) / daysAgo.length

  const distances = comps
    .map((c) => c.geoDistance ?? c.comp.distanceMiles)
    .filter((d): d is number => d !== undefined)
  const avgDistance =
    distances.length > 0
      ? distances.reduce((a, b) => a + b, 0) / distances.length
      : null

  // Price per sqft
  const pricesPerSqFt = comps
    .filter((c) => c.comp.squareFeet && c.comp.squareFeet > 0)
    .map((c) => c.originalPrice / c.comp.squareFeet!)
    .sort((a, b) => a - b)

  return {
    count: comps.length,
    avgPrice: Math.round(avgPrice),
    medianPrice: Math.round(medianPrice),
    priceRange: { min: prices[0], max: prices[prices.length - 1] },
    avgDaysAgo: Math.round(avgDaysAgo),
    avgDistance: avgDistance ? Math.round(avgDistance * 10) / 10 : null,
    pricePerSqFtRange:
      pricesPerSqFt.length > 0
        ? {
            min: Math.round(pricesPerSqFt[0]),
            max: Math.round(pricesPerSqFt[pricesPerSqFt.length - 1]),
          }
        : { min: 0, max: 0 },
    avgPricePerSqFt:
      pricesPerSqFt.length > 0
        ? Math.round(
            pricesPerSqFt.reduce((a, b) => a + b, 0) / pricesPerSqFt.length
          )
        : 0,
  }
}

/**
 * Format enhanced comp result for display
 */
export function formatEnhancedCompResult(
  result: EnhancedCompSalesResult
): string {
  const lines: string[] = [
    "### Enhanced Comparable Sales Analysis",
    "",
    `**Estimated Value:** $${result.value.toLocaleString()}`,
    `**Comparables Used:** ${result.adjustedComps.length}`,
    `**Average Similarity:** ${(result.averageSimilarity * 100).toFixed(0)}%`,
    "",
  ]

  if (result.appreciationAdjusted) {
    lines.push("*Market appreciation adjustments applied*")
  }
  if (result.geoWeighted) {
    lines.push("*Geo-distance weighting applied*")
  }

  lines.push("")
  lines.push("**Statistics:**")
  lines.push(`- Median Price: $${result.statistics.medianPrice.toLocaleString()}`)
  lines.push(
    `- Price Range: $${result.statistics.priceRange.min.toLocaleString()} - $${result.statistics.priceRange.max.toLocaleString()}`
  )
  if (result.statistics.avgPricePerSqFt > 0) {
    lines.push(`- Avg $/SqFt: $${result.statistics.avgPricePerSqFt}`)
  }
  if (result.statistics.avgDistance !== null) {
    lines.push(`- Avg Distance: ${result.statistics.avgDistance} miles`)
  }
  lines.push(`- Avg Days Since Sale: ${result.statistics.avgDaysAgo}`)

  lines.push("")
  lines.push("**Top Comparables:**")

  result.adjustedComps.slice(0, 5).forEach((ac, index) => {
    const distance = ac.geoDistance ?? ac.comp.distanceMiles
    const distanceStr = distance ? `${distance.toFixed(1)} mi` : "N/A"

    lines.push("")
    lines.push(`**${index + 1}. ${ac.comp.address}**`)
    lines.push(`- Sale: $${ac.originalPrice.toLocaleString()}`)
    lines.push(`- Adjusted: $${Math.round(ac.adjustedPrice).toLocaleString()}`)
    lines.push(`- Similarity: ${(ac.enhancedSimilarity * 100).toFixed(0)}%`)
    lines.push(`- Distance: ${distanceStr}`)

    if (ac.appreciationAdjustment && ac.appreciationAdjustment !== 0) {
      lines.push(
        `- Appreciation: +$${Math.round(ac.appreciationAdjustment).toLocaleString()}`
      )
    }
  })

  return lines.join("\n")
}
