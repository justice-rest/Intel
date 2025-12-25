/**
 * Adaptive Depth Selector
 *
 * Dynamically selects research depth based on preliminary prospect indicators.
 * Spends more effort on high-value prospects, less on low-potential ones.
 *
 * Depth Levels:
 * - DEEP: Major donor potential (3 passes, full verification, 60-90s)
 * - STANDARD: Mid-level prospect (1 pass + optional, 30-45s)
 * - QUICK: Annual fund likely (single pass, 15-20s)
 */

import type { ProspectResearchOutput } from "../types"
import { parseLenientProspectOutput } from "../schemas/prospect-output"

// ============================================================================
// TYPES
// ============================================================================

export type ResearchDepth = "DEEP" | "STANDARD" | "QUICK"

export interface DepthConfig {
  /**
   * Number of Perplexity passes
   */
  passes: number

  /**
   * Whether to run LinkUp search
   */
  runLinkup: boolean

  /**
   * Whether to run Grok search
   */
  runGrok: boolean

  /**
   * Whether to run verification (SEC, FEC, ProPublica)
   */
  runVerification: boolean

  /**
   * Timeout for the entire pipeline (ms)
   */
  timeout: number

  /**
   * Estimated processing time (for user feedback)
   */
  estimatedTime: string
}

export interface DepthSelectionResult {
  depth: ResearchDepth
  config: DepthConfig
  score: number
  reason: string
  indicators: PreliminaryIndicators
}

export interface PreliminaryIndicators {
  hasPropertyValue: boolean
  estimatedPropertyValue: number | null
  hasBusinessOwnership: boolean
  hasExecutiveTitle: boolean
  hasPoliticalGiving: boolean
  hasSecFilings: boolean
  hasFoundationAffiliation: boolean
  romyScore: number
  dataCompleteness: number  // 0-1
}

// ============================================================================
// DEPTH CONFIGURATIONS
// ============================================================================

export const DEPTH_CONFIGS: Record<ResearchDepth, DepthConfig> = {
  DEEP: {
    passes: 3,
    runLinkup: true,
    runGrok: true,
    runVerification: true,
    timeout: 90000,
    estimatedTime: "60-90 seconds",
  },
  STANDARD: {
    passes: 2,
    runLinkup: true,
    runGrok: false,
    runVerification: false,
    timeout: 45000,
    estimatedTime: "30-45 seconds",
  },
  QUICK: {
    passes: 1,
    runLinkup: false,
    runGrok: false,
    runVerification: false,
    timeout: 25000,
    estimatedTime: "15-20 seconds",
  },
}

// ============================================================================
// THRESHOLDS
// ============================================================================

export interface DepthThresholds {
  /**
   * Minimum ROMY score for DEEP research
   * @default 20
   */
  deepMinScore: number

  /**
   * Minimum ROMY score for STANDARD research
   * @default 10
   */
  standardMinScore: number

  /**
   * Minimum property value for DEEP research
   * @default 1000000
   */
  deepMinPropertyValue: number

  /**
   * Having SEC filings automatically triggers DEEP
   * @default true
   */
  secFilingsTriggerDeep: boolean

  /**
   * Having foundation affiliation triggers at least STANDARD
   * @default true
   */
  foundationTriggerStandard: boolean
}

const DEFAULT_THRESHOLDS: DepthThresholds = {
  deepMinScore: 20,
  standardMinScore: 10,
  deepMinPropertyValue: 1000000,
  secFilingsTriggerDeep: true,
  foundationTriggerStandard: true,
}

// ============================================================================
// INDICATOR EXTRACTION
// ============================================================================

/**
 * Extract preliminary indicators from initial research pass
 */
export function extractIndicators(data: Partial<ProspectResearchOutput>): PreliminaryIndicators {
  const parsed = parseLenientProspectOutput(data)

  const hasPropertyValue =
    parsed.wealth.real_estate.total_value !== null &&
    parsed.wealth.real_estate.total_value > 0

  const hasBusinessOwnership = parsed.wealth.business_ownership.length > 0

  const hasExecutiveTitle = parsed.wealth.business_ownership.some((b) => {
    const role = b.role?.toLowerCase() || ""
    return (
      role.includes("ceo") ||
      role.includes("president") ||
      role.includes("founder") ||
      role.includes("owner") ||
      role.includes("chairman") ||
      role.includes("partner")
    )
  })

  const hasPoliticalGiving = parsed.philanthropy.political_giving.total > 0

  const hasSecFilings = parsed.wealth.securities.has_sec_filings

  const hasFoundationAffiliation =
    parsed.philanthropy.foundation_affiliations.length > 0 ||
    parsed.philanthropy.nonprofit_boards.length > 0

  // Calculate data completeness (how many fields are filled)
  let filledFields = 0
  let totalFields = 0

  // Check key fields
  const checkField = (value: unknown) => {
    totalFields++
    if (value !== null && value !== undefined && value !== "" && value !== 0) {
      filledFields++
    }
  }

  checkField(parsed.wealth.real_estate.total_value)
  checkField(parsed.wealth.business_ownership.length > 0)
  checkField(parsed.wealth.securities.has_sec_filings)
  checkField(parsed.philanthropy.political_giving.total)
  checkField(parsed.philanthropy.foundation_affiliations.length > 0)
  checkField(parsed.background.age)
  checkField(parsed.background.career_summary)
  checkField(parsed.sources.length > 0)

  return {
    hasPropertyValue,
    estimatedPropertyValue: parsed.wealth.real_estate.total_value,
    hasBusinessOwnership,
    hasExecutiveTitle,
    hasPoliticalGiving,
    hasSecFilings,
    hasFoundationAffiliation,
    romyScore: parsed.metrics.romy_score,
    dataCompleteness: totalFields > 0 ? filledFields / totalFields : 0,
  }
}

// ============================================================================
// DEPTH SELECTION
// ============================================================================

/**
 * Select research depth based on preliminary indicators
 */
export function selectDepth(
  indicators: PreliminaryIndicators,
  thresholds: Partial<DepthThresholds> = {}
): DepthSelectionResult {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds }

  // Calculate a composite score for decision making
  let score = indicators.romyScore

  // Boost score based on indicators
  if (indicators.hasPropertyValue && indicators.estimatedPropertyValue) {
    if (indicators.estimatedPropertyValue >= 2000000) score += 5
    else if (indicators.estimatedPropertyValue >= 1000000) score += 3
    else if (indicators.estimatedPropertyValue >= 500000) score += 2
  }

  if (indicators.hasExecutiveTitle) score += 5
  if (indicators.hasSecFilings) score += 8
  if (indicators.hasFoundationAffiliation) score += 3
  if (indicators.hasPoliticalGiving) score += 2

  // Decision logic
  const reasons: string[] = []

  // DEEP triggers
  if (indicators.hasSecFilings && t.secFilingsTriggerDeep) {
    reasons.push("SEC insider filings detected")
    return {
      depth: "DEEP",
      config: DEPTH_CONFIGS.DEEP,
      score,
      reason: reasons.join("; "),
      indicators,
    }
  }

  if (score >= t.deepMinScore) {
    reasons.push(`High ROMY score (${score}+)`)
    return {
      depth: "DEEP",
      config: DEPTH_CONFIGS.DEEP,
      score,
      reason: reasons.join("; "),
      indicators,
    }
  }

  if (indicators.estimatedPropertyValue && indicators.estimatedPropertyValue >= t.deepMinPropertyValue) {
    reasons.push(`High property value ($${(indicators.estimatedPropertyValue / 1000000).toFixed(1)}M+)`)
    return {
      depth: "DEEP",
      config: DEPTH_CONFIGS.DEEP,
      score,
      reason: reasons.join("; "),
      indicators,
    }
  }

  if (indicators.hasExecutiveTitle && indicators.hasBusinessOwnership) {
    reasons.push("Business executive detected")
    return {
      depth: "DEEP",
      config: DEPTH_CONFIGS.DEEP,
      score,
      reason: reasons.join("; "),
      indicators,
    }
  }

  // STANDARD triggers
  if (score >= t.standardMinScore) {
    reasons.push(`Moderate ROMY score (${score})`)
    return {
      depth: "STANDARD",
      config: DEPTH_CONFIGS.STANDARD,
      score,
      reason: reasons.join("; "),
      indicators,
    }
  }

  if (indicators.hasFoundationAffiliation && t.foundationTriggerStandard) {
    reasons.push("Foundation/nonprofit affiliation detected")
    return {
      depth: "STANDARD",
      config: DEPTH_CONFIGS.STANDARD,
      score,
      reason: reasons.join("; "),
      indicators,
    }
  }

  if (indicators.hasPropertyValue || indicators.hasBusinessOwnership) {
    reasons.push("Wealth indicators present")
    return {
      depth: "STANDARD",
      config: DEPTH_CONFIGS.STANDARD,
      score,
      reason: reasons.join("; "),
      indicators,
    }
  }

  // Default to QUICK
  reasons.push("Low wealth indicators, annual fund likely")
  return {
    depth: "QUICK",
    config: DEPTH_CONFIGS.QUICK,
    score,
    reason: reasons.join("; "),
    indicators,
  }
}

/**
 * Select depth directly from preliminary research output
 */
export function selectDepthFromOutput(
  output: Partial<ProspectResearchOutput>,
  thresholds?: Partial<DepthThresholds>
): DepthSelectionResult {
  const indicators = extractIndicators(output)
  return selectDepth(indicators, thresholds)
}

// ============================================================================
// BATCH OPTIMIZATION
// ============================================================================

export interface BatchDepthAnalysis {
  total: number
  deep: number
  standard: number
  quick: number
  estimatedTotalTime: number  // seconds
  estimatedCost: number  // rough estimate based on tokens
}

/**
 * Analyze a batch of prospects and estimate processing requirements
 */
export function analyzeBatchDepth(
  prospects: Array<{ indicators?: PreliminaryIndicators; output?: Partial<ProspectResearchOutput> }>,
  thresholds?: Partial<DepthThresholds>
): BatchDepthAnalysis {
  let deep = 0
  let standard = 0
  let quick = 0

  for (const prospect of prospects) {
    const indicators = prospect.indicators || (prospect.output ? extractIndicators(prospect.output) : null)

    if (!indicators) {
      // No data yet, assume standard
      standard++
      continue
    }

    const result = selectDepth(indicators, thresholds)

    switch (result.depth) {
      case "DEEP":
        deep++
        break
      case "STANDARD":
        standard++
        break
      case "QUICK":
        quick++
        break
    }
  }

  // Estimate time (in seconds)
  const estimatedTotalTime = deep * 75 + standard * 37 + quick * 17

  // Estimate cost (rough: deep = $0.15, standard = $0.08, quick = $0.04)
  const estimatedCost = deep * 0.15 + standard * 0.08 + quick * 0.04

  return {
    total: prospects.length,
    deep,
    standard,
    quick,
    estimatedTotalTime,
    estimatedCost,
  }
}

/**
 * Get research depth recommendation text for UI
 */
export function getDepthDescription(depth: ResearchDepth): string {
  switch (depth) {
    case "DEEP":
      return "Full research with multi-pass search, verification, and triangulation. Best for major donor prospects."
    case "STANDARD":
      return "Balanced research with follow-up passes and optional verification. Suitable for mid-level prospects."
    case "QUICK":
      return "Fast single-pass research. Appropriate for annual fund screening."
  }
}
