/**
 * RomyScore Calculator
 * Deterministic scoring system for consistent prospect research scores
 *
 * This module calculates scores from RAW DATA POINTS, ensuring consistency
 * across multiple searches for the same person.
 */

import {
  ROMY_SCORE_WEIGHTS,
  getScoreTier,
  normalizePersonName,
  createScoreCacheKey,
} from "./config"

// ============================================================================
// TYPES
// ============================================================================

/**
 * Raw data points used for scoring
 * These come from various tools (property_valuation, opencorporates, etc.)
 */
export interface RomyScoreDataPoints {
  // Property indicators
  propertyValue?: number                    // Estimated property value in dollars
  additionalPropertyCount?: number          // Number of additional properties owned

  // Business indicators
  businessRoles?: Array<{
    role: string                            // Job title/role
    companyName: string                     // Company name
    isPublicCompany?: boolean              // Is this a publicly traded company?
  }>

  // Foundation/nonprofit indicators
  foundationAffiliations?: string[]         // Names of foundations/nonprofits

  // Political giving indicators
  totalPoliticalGiving?: number             // Total FEC contributions in dollars

  // Public net worth (from Wikidata or other sources)
  publicNetWorth?: number                   // Net worth if publicly known

  // Sanctions/compliance status
  sanctionsStatus?: "HIGH" | "MEDIUM" | "LOW" | "CLEAR"
}

/**
 * Detailed score breakdown
 */
export interface RomyScoreBreakdown {
  totalScore: number
  maxPossibleScore: 41

  // Component scores
  propertyScore: number
  businessScore: number
  additionalIndicatorsScore: number

  // Detailed breakdown
  components: {
    propertyValue: { value: number | null; points: number }
    highestBusinessRole: { role: string | null; company: string | null; points: number }
    multipleProperties: { count: number; points: number }
    multipleBusinesses: { count: number; points: number }
    publicCompanyExecutive: { companies: string[]; points: number }
    foundationAffiliations: { count: number; points: number }
    politicalGiving: { total: number; points: number }
    publicNetWorth: { value: number | null; points: number }
  }

  // Tier info
  tier: {
    name: string
    capacity: string
    giftCapacityRange: string
  }

  // Confidence and data quality
  dataQuality: {
    sourcesUsed: number
    confidenceLevel: "HIGH" | "MEDIUM" | "LOW"
    missingData: string[]
  }
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate property value score (0-12 points)
 */
function calculatePropertyScore(propertyValue: number | undefined): number {
  if (!propertyValue || propertyValue <= 0) return 0

  const thresholds = ROMY_SCORE_WEIGHTS.propertyValue.thresholds
  for (const threshold of thresholds) {
    if (propertyValue >= threshold.min) {
      return threshold.points
    }
  }

  return 0
}

/**
 * Calculate business ownership score (0-12 points)
 * Uses the HIGHEST role score (not cumulative)
 */
function calculateBusinessScore(
  businessRoles: RomyScoreDataPoints["businessRoles"]
): { score: number; highestRole: string | null; company: string | null } {
  if (!businessRoles || businessRoles.length === 0) {
    return { score: 0, highestRole: null, company: null }
  }

  const roleScores = ROMY_SCORE_WEIGHTS.businessOwnership.roles

  let highestScore = 0
  let highestRole: string | null = null
  let highestCompany: string | null = null

  for (const { role, companyName } of businessRoles) {
    const roleLower = role.toLowerCase()

    // Check each known role pattern
    for (const [rolePattern, points] of Object.entries(roleScores)) {
      if (roleLower.includes(rolePattern)) {
        if (points > highestScore) {
          highestScore = points
          highestRole = role
          highestCompany = companyName
        }
        break // Found a match for this role, move to next
      }
    }
  }

  return { score: highestScore, highestRole, company: highestCompany }
}

/**
 * Calculate additional indicators score (0-17 points)
 */
function calculateAdditionalIndicatorsScore(data: RomyScoreDataPoints): {
  totalScore: number
  components: {
    multipleProperties: number
    multipleBusinesses: number
    publicCompanyExecutive: number
    foundationAffiliation: number
    politicalGiving: number
    publicNetWorth: number
  }
  publicCompanies: string[]
} {
  const indicators = ROMY_SCORE_WEIGHTS.additionalIndicators.indicators
  let totalScore = 0
  const components = {
    multipleProperties: 0,
    multipleBusinesses: 0,
    publicCompanyExecutive: 0,
    foundationAffiliation: 0,
    politicalGiving: 0,
    publicNetWorth: 0,
  }
  const publicCompanies: string[] = []

  // Multiple properties
  if (data.additionalPropertyCount && data.additionalPropertyCount > 0) {
    components.multipleProperties = indicators.multipleProperties
    totalScore += indicators.multipleProperties
  }

  // Multiple businesses
  if (data.businessRoles && data.businessRoles.length > 1) {
    components.multipleBusinesses = indicators.multipleBusinesses
    totalScore += indicators.multipleBusinesses
  }

  // Public company executive
  if (data.businessRoles) {
    for (const { companyName, isPublicCompany } of data.businessRoles) {
      if (isPublicCompany) {
        publicCompanies.push(companyName)
      }
    }
    if (publicCompanies.length > 0) {
      components.publicCompanyExecutive = indicators.publicCompanyExecutive
      totalScore += indicators.publicCompanyExecutive
    }
  }

  // Foundation affiliation
  if (data.foundationAffiliations && data.foundationAffiliations.length > 0) {
    components.foundationAffiliation = indicators.foundationAffiliation
    totalScore += indicators.foundationAffiliation
  }

  // Significant political giving ($10K+)
  if (data.totalPoliticalGiving && data.totalPoliticalGiving >= 10000) {
    components.politicalGiving = indicators.significantPoliticalGiving
    totalScore += indicators.significantPoliticalGiving
  }

  // Publicly known net worth
  if (data.publicNetWorth && data.publicNetWorth > 0) {
    components.publicNetWorth = indicators.publiclyKnownNetWorth
    totalScore += indicators.publiclyKnownNetWorth
  }

  return { totalScore, components, publicCompanies }
}

/**
 * Determine data quality and confidence level
 */
function assessDataQuality(data: RomyScoreDataPoints): {
  sourcesUsed: number
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW"
  missingData: string[]
} {
  const missingData: string[] = []
  let sourcesUsed = 0

  // Check each data source
  if (data.propertyValue) {
    sourcesUsed++
  } else {
    missingData.push("Property value")
  }

  if (data.businessRoles && data.businessRoles.length > 0) {
    sourcesUsed++
  } else {
    missingData.push("Business roles")
  }

  if (data.totalPoliticalGiving !== undefined) {
    sourcesUsed++
  } else {
    missingData.push("Political giving (FEC)")
  }

  if (data.foundationAffiliations !== undefined) {
    sourcesUsed++
  } else {
    missingData.push("Foundation affiliations")
  }

  // Determine confidence level
  let confidenceLevel: "HIGH" | "MEDIUM" | "LOW"
  if (sourcesUsed >= 4) {
    confidenceLevel = "HIGH"
  } else if (sourcesUsed >= 2) {
    confidenceLevel = "MEDIUM"
  } else {
    confidenceLevel = "LOW"
  }

  return { sourcesUsed, confidenceLevel, missingData }
}

// ============================================================================
// MAIN CALCULATOR
// ============================================================================

/**
 * Calculate RomyScore from raw data points
 *
 * This is the DETERMINISTIC scoring function - given the same inputs,
 * it will always produce the same output.
 */
export function calculateRomyScore(data: RomyScoreDataPoints): RomyScoreBreakdown {
  // Calculate component scores
  const propertyScore = calculatePropertyScore(data.propertyValue)
  const businessResult = calculateBusinessScore(data.businessRoles)
  const additionalResult = calculateAdditionalIndicatorsScore(data)

  // Total score (capped at 41)
  const totalScore = Math.min(
    41,
    propertyScore + businessResult.score + additionalResult.totalScore
  )

  // Get tier info
  const tier = getScoreTier(totalScore)

  // Assess data quality
  const dataQuality = assessDataQuality(data)

  return {
    totalScore,
    maxPossibleScore: 41,

    propertyScore,
    businessScore: businessResult.score,
    additionalIndicatorsScore: additionalResult.totalScore,

    components: {
      propertyValue: {
        value: data.propertyValue || null,
        points: propertyScore,
      },
      highestBusinessRole: {
        role: businessResult.highestRole,
        company: businessResult.company,
        points: businessResult.score,
      },
      multipleProperties: {
        count: data.additionalPropertyCount || 0,
        points: additionalResult.components.multipleProperties,
      },
      multipleBusinesses: {
        count: data.businessRoles?.length || 0,
        points: additionalResult.components.multipleBusinesses,
      },
      publicCompanyExecutive: {
        companies: additionalResult.publicCompanies,
        points: additionalResult.components.publicCompanyExecutive,
      },
      foundationAffiliations: {
        count: data.foundationAffiliations?.length || 0,
        points: additionalResult.components.foundationAffiliation,
      },
      politicalGiving: {
        total: data.totalPoliticalGiving || 0,
        points: additionalResult.components.politicalGiving,
      },
      publicNetWorth: {
        value: data.publicNetWorth || null,
        points: additionalResult.components.publicNetWorth,
      },
    },

    tier,
    dataQuality,
  }
}

/**
 * Merge new data points with existing data points
 * New data ADDS to existing data, does not replace (unless explicitly higher)
 *
 * This ensures scores only go UP as more data is discovered, never down.
 */
export function mergeDataPoints(
  existing: RomyScoreDataPoints,
  newData: Partial<RomyScoreDataPoints>
): RomyScoreDataPoints {
  const merged: RomyScoreDataPoints = { ...existing }

  // Property value: take the higher value
  if (newData.propertyValue !== undefined) {
    merged.propertyValue = Math.max(
      existing.propertyValue || 0,
      newData.propertyValue
    )
  }

  // Additional properties: take the higher count
  if (newData.additionalPropertyCount !== undefined) {
    merged.additionalPropertyCount = Math.max(
      existing.additionalPropertyCount || 0,
      newData.additionalPropertyCount
    )
  }

  // Business roles: merge and deduplicate
  if (newData.businessRoles) {
    const existingRoles = existing.businessRoles || []
    const allRoles = [...existingRoles, ...newData.businessRoles]

    // Deduplicate by company name + role
    const uniqueRoles = new Map<string, typeof allRoles[0]>()
    for (const roleInfo of allRoles) {
      const key = `${roleInfo.companyName.toLowerCase()}__${roleInfo.role.toLowerCase()}`
      if (!uniqueRoles.has(key)) {
        uniqueRoles.set(key, roleInfo)
      } else {
        // If new data has isPublicCompany=true, prefer that
        if (roleInfo.isPublicCompany) {
          uniqueRoles.set(key, roleInfo)
        }
      }
    }

    merged.businessRoles = Array.from(uniqueRoles.values())
  }

  // Foundation affiliations: merge and deduplicate
  if (newData.foundationAffiliations) {
    const existingAffiliations = existing.foundationAffiliations || []
    const allAffiliations = [...existingAffiliations, ...newData.foundationAffiliations]
    merged.foundationAffiliations = [...new Set(allAffiliations.map((a) => a.toLowerCase()))]
  }

  // Political giving: take the higher total
  if (newData.totalPoliticalGiving !== undefined) {
    merged.totalPoliticalGiving = Math.max(
      existing.totalPoliticalGiving || 0,
      newData.totalPoliticalGiving
    )
  }

  // Public net worth: take the higher value
  if (newData.publicNetWorth !== undefined) {
    merged.publicNetWorth = Math.max(
      existing.publicNetWorth || 0,
      newData.publicNetWorth
    )
  }

  // Sanctions status: take the more severe status
  if (newData.sanctionsStatus) {
    const severity = { HIGH: 4, MEDIUM: 3, LOW: 2, CLEAR: 1 }
    const existingSeverity = severity[existing.sanctionsStatus || "CLEAR"]
    const newSeverity = severity[newData.sanctionsStatus]

    if (newSeverity > existingSeverity) {
      merged.sanctionsStatus = newData.sanctionsStatus
    }
  }

  return merged
}

/**
 * Format RomyScore breakdown for display
 */
export function formatRomyScoreForDisplay(breakdown: RomyScoreBreakdown): string {
  const lines: string[] = [
    `# RōmyScore™ Analysis`,
    "",
    `## Score: ${breakdown.totalScore}/41 — ${breakdown.tier.name}`,
    "",
    `**Capacity Rating:** ${breakdown.tier.capacity}`,
    `**Est. Gift Capacity:** ${breakdown.tier.giftCapacityRange}`,
    `**Confidence Level:** ${breakdown.dataQuality.confidenceLevel}`,
    "",
    "---",
    "",
    "## Score Breakdown",
    "",
    `### Property Value Score: ${breakdown.propertyScore}/12 points`,
  ]

  if (breakdown.components.propertyValue.value) {
    lines.push(`- Property Value: $${breakdown.components.propertyValue.value.toLocaleString()}`)
  } else {
    lines.push("- Property value not available")
  }

  lines.push("")
  lines.push(`### Business Ownership Score: ${breakdown.businessScore}/12 points`)

  if (breakdown.components.highestBusinessRole.role) {
    lines.push(`- Highest Role: ${breakdown.components.highestBusinessRole.role} at ${breakdown.components.highestBusinessRole.company}`)
  } else {
    lines.push("- No business roles found")
  }

  lines.push("")
  lines.push(`### Additional Indicators: ${breakdown.additionalIndicatorsScore}/17 points`)

  if (breakdown.components.multipleProperties.points > 0) {
    lines.push(`- Multiple Properties: +${breakdown.components.multipleProperties.points} pts (${breakdown.components.multipleProperties.count} additional)`)
  }
  if (breakdown.components.multipleBusinesses.points > 0) {
    lines.push(`- Multiple Businesses: +${breakdown.components.multipleBusinesses.points} pts (${breakdown.components.multipleBusinesses.count} companies)`)
  }
  if (breakdown.components.publicCompanyExecutive.points > 0) {
    lines.push(`- Public Company Executive: +${breakdown.components.publicCompanyExecutive.points} pts (${breakdown.components.publicCompanyExecutive.companies.join(", ")})`)
  }
  if (breakdown.components.foundationAffiliations.points > 0) {
    lines.push(`- Foundation Affiliations: +${breakdown.components.foundationAffiliations.points} pts (${breakdown.components.foundationAffiliations.count} foundations)`)
  }
  if (breakdown.components.politicalGiving.points > 0) {
    lines.push(`- Political Giving: +${breakdown.components.politicalGiving.points} pts ($${breakdown.components.politicalGiving.total.toLocaleString()} total)`)
  }
  if (breakdown.components.publicNetWorth.points > 0) {
    lines.push(`- Public Net Worth: +${breakdown.components.publicNetWorth.points} pt ($${breakdown.components.publicNetWorth.value?.toLocaleString()})`)
  }

  if (breakdown.dataQuality.missingData.length > 0) {
    lines.push("")
    lines.push("---")
    lines.push("")
    lines.push("## Data Gaps")
    lines.push(`Missing: ${breakdown.dataQuality.missingData.join(", ")}`)
    lines.push("")
    lines.push("_Score may increase with additional research_")
  }

  return lines.join("\n")
}

// Re-export config utilities
export { normalizePersonName, createScoreCacheKey, getScoreTier }
