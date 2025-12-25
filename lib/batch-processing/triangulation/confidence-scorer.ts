/**
 * Confidence Scorer
 *
 * Calculates confidence levels for data fields based on:
 * - Source authority
 * - Source agreement
 * - Recency of data
 * - Data completeness
 */

import { getSourceAuthority, identifySource, type SourceCategory } from "./source-registry"

// ============================================================================
// TYPES
// ============================================================================

export type ConfidenceLevel = "VERIFIED" | "CORROBORATED" | "SINGLE_SOURCE" | "ESTIMATED" | "CONFLICTED"

export interface SourceCitation {
  url: string
  name?: string
  value: unknown
  authority: number
  category: SourceCategory
  timestamp?: Date
}

export interface FieldConfidence {
  value: unknown
  confidence: ConfidenceLevel
  confidenceScore: number  // 0.0 - 1.0
  sources: SourceCitation[]
  conflictNote?: string
  methodology?: string
}

export interface ConfidenceScoringOptions {
  /**
   * Minimum authority for a source to count as "verified"
   * @default 0.9
   */
  verifiedThreshold: number

  /**
   * Number of sources needed for "corroborated"
   * @default 2
   */
  corroborationCount: number

  /**
   * Maximum variance allowed for numeric values to count as agreeing
   * @default 0.2 (20%)
   */
  numericVarianceTolerance: number
}

const DEFAULT_OPTIONS: ConfidenceScoringOptions = {
  verifiedThreshold: 0.9,
  corroborationCount: 2,
  numericVarianceTolerance: 0.2,
}

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

/**
 * Calculate confidence for a field with multiple source values
 */
export function calculateFieldConfidence(
  values: Array<{ value: unknown; sourceUrl: string; sourceName?: string; timestamp?: Date }>,
  options: Partial<ConfidenceScoringOptions> = {}
): FieldConfidence {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  if (values.length === 0) {
    return {
      value: null,
      confidence: "ESTIMATED",
      confidenceScore: 0,
      sources: [],
    }
  }

  // Build source citations with authority scores
  const sources: SourceCitation[] = values.map((v) => {
    const source = identifySource(v.sourceUrl)
    return {
      url: v.sourceUrl,
      name: v.sourceName || source?.name || "Unknown",
      value: v.value,
      authority: source?.authority ?? 0.5,
      category: source?.category ?? "llm_synthesis",
      timestamp: v.timestamp,
    }
  })

  // Sort by authority (highest first)
  sources.sort((a, b) => b.authority - a.authority)

  const topSource = sources[0]
  const topAuthority = topSource.authority

  // Case 1: Single source
  if (sources.length === 1) {
    if (topAuthority >= opts.verifiedThreshold) {
      return {
        value: topSource.value,
        confidence: "VERIFIED",
        confidenceScore: topAuthority,
        sources,
      }
    }

    return {
      value: topSource.value,
      confidence: "SINGLE_SOURCE",
      confidenceScore: topAuthority * 0.7,
      sources,
    }
  }

  // Case 2: Multiple sources - check for agreement
  const { agreeing, conflicting, consensusValue, variance } = analyzeValueAgreement(
    sources,
    opts.numericVarianceTolerance
  )

  if (conflicting.length > 0) {
    // Sources disagree - use highest authority value but flag conflict
    return {
      value: topSource.value,
      confidence: "CONFLICTED",
      confidenceScore: topAuthority * 0.6,
      sources,
      conflictNote: buildConflictNote(agreeing, conflicting),
    }
  }

  // Case 3: Sources agree
  if (agreeing.length >= opts.corroborationCount) {
    // Multiple agreeing sources
    const avgAuthority = agreeing.reduce((sum, s) => sum + s.authority, 0) / agreeing.length

    if (topAuthority >= opts.verifiedThreshold) {
      return {
        value: consensusValue,
        confidence: "VERIFIED",
        confidenceScore: Math.min(1.0, avgAuthority + 0.1),
        sources: agreeing,
      }
    }

    return {
      value: consensusValue,
      confidence: "CORROBORATED",
      confidenceScore: Math.min(0.95, avgAuthority + 0.15),
      sources: agreeing,
    }
  }

  // Case 4: Single effective source (others had no value)
  return {
    value: topSource.value,
    confidence: topAuthority >= opts.verifiedThreshold ? "VERIFIED" : "SINGLE_SOURCE",
    confidenceScore: topAuthority * 0.8,
    sources,
  }
}

// ============================================================================
// VALUE AGREEMENT ANALYSIS
// ============================================================================

interface AgreementAnalysis {
  agreeing: SourceCitation[]
  conflicting: SourceCitation[]
  consensusValue: unknown
  variance: number
}

/**
 * Analyze agreement between source values
 */
function analyzeValueAgreement(
  sources: SourceCitation[],
  varianceTolerance: number
): AgreementAnalysis {
  const topValue = sources[0].value
  const agreeing: SourceCitation[] = []
  const conflicting: SourceCitation[] = []

  for (const source of sources) {
    if (valuesAgree(topValue, source.value, varianceTolerance)) {
      agreeing.push(source)
    } else if (source.value !== null && source.value !== undefined) {
      conflicting.push(source)
    }
  }

  // Calculate consensus value (average for numbers, mode for strings)
  const consensusValue = calculateConsensus(agreeing)

  // Calculate variance for numeric values
  const variance = calculateVariance(agreeing)

  return { agreeing, conflicting, consensusValue, variance }
}

/**
 * Check if two values agree within tolerance
 */
function valuesAgree(a: unknown, b: unknown, tolerance: number): boolean {
  // Null/undefined handling
  if (a === null || a === undefined) return b === null || b === undefined
  if (b === null || b === undefined) return false

  // Numeric comparison with tolerance
  if (typeof a === "number" && typeof b === "number") {
    if (a === 0 && b === 0) return true
    const maxVal = Math.max(Math.abs(a), Math.abs(b))
    const diff = Math.abs(a - b)
    return diff / maxVal <= tolerance
  }

  // Boolean comparison
  if (typeof a === "boolean" && typeof b === "boolean") {
    return a === b
  }

  // String comparison (case-insensitive, whitespace-normalized)
  if (typeof a === "string" && typeof b === "string") {
    const normalizeA = a.toLowerCase().trim().replace(/\s+/g, " ")
    const normalizeB = b.toLowerCase().trim().replace(/\s+/g, " ")
    return normalizeA === normalizeB
  }

  // Array comparison (check if same elements, order-independent)
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    const sortedA = [...a].sort()
    const sortedB = [...b].sort()
    return sortedA.every((val, i) => valuesAgree(val, sortedB[i], tolerance))
  }

  // Object comparison (deep)
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a as object)
    const keysB = Object.keys(b as object)
    if (keysA.length !== keysB.length) return false
    return keysA.every((key) =>
      valuesAgree((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], tolerance)
    )
  }

  // Default: strict equality
  return a === b
}

/**
 * Calculate consensus value from agreeing sources
 */
function calculateConsensus(sources: SourceCitation[]): unknown {
  if (sources.length === 0) return null
  if (sources.length === 1) return sources[0].value

  const firstValue = sources[0].value

  // For numbers: weighted average by authority
  if (typeof firstValue === "number") {
    const totalWeight = sources.reduce((sum, s) => sum + s.authority, 0)
    const weightedSum = sources.reduce((sum, s) => sum + (s.value as number) * s.authority, 0)
    return Math.round(weightedSum / totalWeight)
  }

  // For others: use highest authority value
  return firstValue
}

/**
 * Calculate variance for numeric values
 */
function calculateVariance(sources: SourceCitation[]): number {
  const numericValues = sources
    .map((s) => s.value)
    .filter((v): v is number => typeof v === "number")

  if (numericValues.length <= 1) return 0

  const mean = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length
  const squaredDiffs = numericValues.map((v) => Math.pow(v - mean, 2))
  const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / squaredDiffs.length

  return Math.sqrt(avgSquaredDiff)
}

/**
 * Build conflict note explaining disagreement
 */
function buildConflictNote(agreeing: SourceCitation[], conflicting: SourceCitation[]): string {
  if (conflicting.length === 0) return ""

  const conflictDetails = conflicting
    .map((s) => `${s.name}: ${formatValue(s.value)}`)
    .join(", ")

  const agreeingDetails =
    agreeing.length > 0
      ? `agrees with ${agreeing.map((s) => s.name).join(", ")}`
      : "single source"

  return `Conflict: ${conflictDetails}. Primary value ${agreeingDetails}.`
}

/**
 * Format value for display in conflict notes
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "null"
  if (typeof value === "number") return value.toLocaleString()
  if (typeof value === "string") return value.length > 50 ? `${value.slice(0, 47)}...` : value
  if (Array.isArray(value)) return `[${value.length} items]`
  return String(value)
}

// ============================================================================
// OVERALL DATA QUALITY SCORING
// ============================================================================

/**
 * Calculate overall data quality score for a research result
 */
export function calculateOverallConfidence(
  fields: Record<string, FieldConfidence>
): {
  overallScore: number
  verifiedCount: number
  corroboratedCount: number
  singleSourceCount: number
  conflictedCount: number
  missingCount: number
} {
  const values = Object.values(fields)

  const counts = {
    verifiedCount: 0,
    corroboratedCount: 0,
    singleSourceCount: 0,
    conflictedCount: 0,
    missingCount: 0,
  }

  let totalScore = 0
  let totalWeight = 0

  for (const field of values) {
    switch (field.confidence) {
      case "VERIFIED":
        counts.verifiedCount++
        break
      case "CORROBORATED":
        counts.corroboratedCount++
        break
      case "SINGLE_SOURCE":
        counts.singleSourceCount++
        break
      case "CONFLICTED":
        counts.conflictedCount++
        break
      case "ESTIMATED":
        if (field.value === null || field.value === undefined) {
          counts.missingCount++
        }
        break
    }

    totalScore += field.confidenceScore
    totalWeight++
  }

  return {
    overallScore: totalWeight > 0 ? totalScore / totalWeight : 0,
    ...counts,
  }
}
