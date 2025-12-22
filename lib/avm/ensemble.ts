/**
 * AVM Ensemble Model Implementation
 *
 * Combines multiple valuation methods into a single weighted estimate:
 * - Hedonic Pricing Model (35% default weight)
 * - Comparable Sales Approach (45% default weight)
 * - Online Estimates (20% default weight)
 *
 * Ensemble Formula:
 * Final_Value = α₁·Hedonic_Value + α₂·Comp_Value + α₃·Online_Avg
 *
 * Where α coefficients are normalized weights satisfying Σαᵢ = 1.
 * Weights redistribute proportionally when data sources are missing.
 */

import type {
  OnlineEstimate,
  HedonicCoefficients,
  AVMResult,
  EnsembleInput,
} from "./types"
import { calculateHedonicValue } from "./hedonic-model"
import { calculateCompValue } from "./comparable-sales"
import { calculateConfidence, calculateValueRange } from "./confidence-score"
import { MODEL_WEIGHTS, formatCurrency, formatPercent, NATIONAL_HEDONIC_COEFFICIENTS } from "./config"

// ============================================================================
// Coefficients Source Description
// ============================================================================

/**
 * Describe the source of coefficients (national defaults since database lookup removed)
 */
function describeCoefficientsSource(_coefficients: HedonicCoefficients): string {
  return "National average coefficients"
}

// ============================================================================
// Online Estimate Aggregation
// ============================================================================

/**
 * Calculate average of online estimates
 */
function calculateOnlineAverage(estimates: OnlineEstimate[]): number | null {
  if (estimates.length === 0) {
    return null
  }
  const sum = estimates.reduce((acc, e) => acc + e.value, 0)
  return sum / estimates.length
}

// ============================================================================
// Weight Normalization
// ============================================================================

/**
 * Normalize weights when some data sources are missing
 * Ensures weights sum to 1.0
 */
function normalizeWeights(
  hedonicAvailable: boolean,
  compAvailable: boolean,
  onlineAvailable: boolean
): { hedonic: number; comp: number; online: number } {
  let totalWeight = 0

  if (hedonicAvailable) totalWeight += MODEL_WEIGHTS.hedonic
  if (compAvailable) totalWeight += MODEL_WEIGHTS.comparable
  if (onlineAvailable) totalWeight += MODEL_WEIGHTS.online

  if (totalWeight === 0) {
    return { hedonic: 0, comp: 0, online: 0 }
  }

  return {
    hedonic: hedonicAvailable ? MODEL_WEIGHTS.hedonic / totalWeight : 0,
    comp: compAvailable ? MODEL_WEIGHTS.comparable / totalWeight : 0,
    online: onlineAvailable ? MODEL_WEIGHTS.online / totalWeight : 0,
  }
}

// ============================================================================
// Main Ensemble Calculation
// ============================================================================

/**
 * Calculate final AVM value using ensemble of models
 *
 * @param input - Property, comparables, online estimates, and coefficients
 * @returns Complete AVM result with value, confidence, and breakdown
 */
export async function calculateEnsembleValue(
  input: EnsembleInput
): Promise<AVMResult> {
  const { property, comparables, onlineEstimates } = input

  // Use provided coefficients or national defaults
  const coefficients: HedonicCoefficients = input.coefficients || NATIONAL_HEDONIC_COEFFICIENTS
  const coefficientsSource = input.coefficients ? "provided" : "national_defaults"

  // Calculate individual model values
  const hedonicResult = calculateHedonicValue(property, coefficients)
  const compResult = calculateCompValue(property, comparables, coefficients)
  const onlineAvg = calculateOnlineAverage(onlineEstimates)

  // Determine which models produced values
  const hedonicValue = hedonicResult?.value || null
  const compValue = compResult?.value || null

  // Normalize weights based on available data
  const weights = normalizeWeights(
    hedonicValue !== null,
    compValue !== null,
    onlineAvg !== null
  )

  // Check if we have any values
  const hasAnyValue = hedonicValue || compValue || onlineAvg
  if (!hasAnyValue) {
    return createErrorResult(
      property.address || "Unknown",
      "Insufficient data for valuation. Please provide property square footage, comparable sales, or online estimates.",
      []
    )
  }

  // Calculate weighted ensemble value
  let estimatedValue = 0
  if (hedonicValue !== null) estimatedValue += hedonicValue * weights.hedonic
  if (compValue !== null) estimatedValue += compValue * weights.comp
  if (onlineAvg !== null) estimatedValue += onlineAvg * weights.online

  // Calculate confidence score
  const confidence = calculateConfidence({
    property,
    comparables,
    onlineEstimates,
    hedonicValue,
    compValue,
    onlineAvg,
  })

  // Calculate value range based on FSD
  const valueRange = calculateValueRange(estimatedValue, confidence.fsd)

  // Calculate price per square foot
  const pricePerSqFt = property.squareFeet
    ? estimatedValue / property.squareFeet
    : undefined

  // Collect sources from online estimates and comparables
  const sources: Array<{ name: string; url: string }> = []

  // Add online estimate sources
  onlineEstimates.forEach((e) => {
    if (e.sourceUrl) {
      const sourceName = e.source.charAt(0).toUpperCase() + e.source.slice(1)
      sources.push({
        name: `${sourceName} Estimate: ${formatCurrency(e.value)}`,
        url: e.sourceUrl,
      })
    }
  })

  // Add top comparable sales as sources
  if (compResult) {
    compResult.adjustedComps.slice(0, 5).forEach((ac) => {
      if (ac.comp.sourceUrl) {
        sources.push({
          name: `Comp: ${ac.comp.address} - ${formatCurrency(ac.originalPrice)}`,
          url: ac.comp.sourceUrl,
        })
      }
    })
  }

  // Format output for AI consumption
  const rawContent = formatAVMOutput({
    address: property.address || "Unknown Address",
    estimatedValue: Math.round(estimatedValue),
    valueLow: Math.round(valueRange.low),
    valueHigh: Math.round(valueRange.high),
    pricePerSqFt: pricePerSqFt ? Math.round(pricePerSqFt) : undefined,
    confidence,
    hedonicValue: hedonicValue ? Math.round(hedonicValue) : undefined,
    compValue: compValue ? Math.round(compValue) : undefined,
    onlineAvg: onlineAvg ? Math.round(onlineAvg) : undefined,
    weights,
    comparablesUsed: compResult?.adjustedComps.length || 0,
    estimateSources: onlineEstimates.map((e) => e.source),
    coefficientsSource: describeCoefficientsSource(coefficients),
  })

  return {
    address: property.address || "",
    estimatedValue: Math.round(estimatedValue),
    valueLow: Math.round(valueRange.low),
    valueHigh: Math.round(valueRange.high),
    pricePerSqFt: pricePerSqFt ? Math.round(pricePerSqFt) : undefined,
    confidenceScore: confidence.score,
    confidenceLevel: confidence.level,
    fsd: confidence.fsd,
    hedonicValue: hedonicValue ? Math.round(hedonicValue) : undefined,
    compAdjustedValue: compValue ? Math.round(compValue) : undefined,
    onlineEstimateAvg: onlineAvg ? Math.round(onlineAvg) : undefined,
    hedonicWeight: weights.hedonic,
    compWeight: weights.comp,
    onlineWeight: weights.online,
    coefficientsSource: coefficientsSource,
    comparablesUsed: compResult?.adjustedComps.length || 0,
    estimateSources: onlineEstimates.map((e) => e.source),
    rawContent,
    sources,
  }
}

// ============================================================================
// Output Formatting
// ============================================================================

/**
 * Format AVM output for AI consumption (Markdown)
 */
function formatAVMOutput(data: {
  address: string
  estimatedValue: number
  valueLow: number
  valueHigh: number
  pricePerSqFt?: number
  confidence: { score: number; level: string; fsd: number }
  hedonicValue?: number
  compValue?: number
  onlineAvg?: number
  weights: { hedonic: number; comp: number; online: number }
  comparablesUsed: number
  estimateSources: string[]
  coefficientsSource: string
}): string {
  const lines: string[] = [
    `# Property Valuation: ${data.address}`,
    "",
    "## Estimated Value",
    `**${formatCurrency(data.estimatedValue)}**`,
    `Range: ${formatCurrency(data.valueLow)} - ${formatCurrency(data.valueHigh)}`,
    "",
    "## Confidence",
    `- **Score:** ${data.confidence.score}/100 (${data.confidence.level.toUpperCase()})`,
    `- **FSD:** ${formatPercent(data.confidence.fsd)}`,
    "",
    "## Model Components",
  ]

  // Hedonic model
  if (data.hedonicValue) {
    lines.push(
      `- **Hedonic Model** (${formatPercent(data.weights.hedonic)}): ${formatCurrency(data.hedonicValue)}`
    )
  }

  // Comparable sales
  if (data.compValue) {
    lines.push(
      `- **Comparable Sales** (${formatPercent(data.weights.comp)}, ${data.comparablesUsed} comps): ${formatCurrency(data.compValue)}`
    )
  }

  // Online estimates
  if (data.onlineAvg) {
    const sourceList = data.estimateSources.join(", ")
    lines.push(
      `- **Online Estimates** (${formatPercent(data.weights.online)}, ${sourceList}): ${formatCurrency(data.onlineAvg)}`
    )
  }

  // Price per sqft
  if (data.pricePerSqFt) {
    lines.push("")
    lines.push(`**Price/SqFt:** ${formatCurrency(data.pricePerSqFt)}/sqft`)
  }

  // Coefficients source
  lines.push("")
  lines.push(`**Market Coefficients:** ${data.coefficientsSource}`)

  // Interpretation
  lines.push("")
  lines.push("## Interpretation")

  // Check if we only have online estimates (no county/hedonic or comps)
  const onlyOnlineEstimates = !data.hedonicValue && !data.compValue && data.onlineAvg

  if (onlyOnlineEstimates) {
    lines.push(
      "**LOW CONFIDENCE WARNING:** This estimate is based on online sources only (Zillow, Redfin, etc.) without official county assessor data or recent comparable sales. Online estimates can vary significantly from actual value - verify with county assessor records for accurate assessment."
    )
    lines.push("")
  }

  if (data.confidence.level === "high") {
    lines.push(
      "This valuation has high confidence and is suitable for preliminary lending decisions."
    )
  } else if (data.confidence.level === "medium") {
    lines.push(
      "This valuation has medium confidence. Good for initial estimates but consider getting an appraisal for major decisions."
    )
  } else {
    lines.push(
      "This valuation has low confidence due to limited data. A professional appraisal is recommended."
    )
  }

  // Statistical note
  lines.push("")
  lines.push(
    `*Based on the FSD of ${formatPercent(data.confidence.fsd)}, there is approximately a 68% chance the actual value falls within ${formatCurrency(data.valueLow)} - ${formatCurrency(data.valueHigh)}.*`
  )

  return lines.join("\n")
}

/**
 * Create error result when valuation fails
 */
function createErrorResult(
  address: string,
  errorMessage: string,
  sources: Array<{ name: string; url: string }>
): AVMResult {
  return {
    address,
    estimatedValue: 0,
    valueLow: 0,
    valueHigh: 0,
    confidenceScore: 0,
    confidenceLevel: "low",
    fsd: 1,
    hedonicWeight: 0,
    compWeight: 0,
    onlineWeight: 0,
    comparablesUsed: 0,
    estimateSources: [],
    rawContent: `# Property Valuation: ${address}\n\n**Error:** ${errorMessage}\n\n## Suggestions\n- Run searchWeb queries to gather property data, Zillow/Redfin estimates, and recent sales\n- Provide property square footage at minimum\n- Include 3-5 comparable sales for best results`,
    sources,
    error: errorMessage,
  }
}

// ============================================================================
// Synchronous Version (for testing or when coefficients are pre-loaded)
// ============================================================================

/**
 * Calculate ensemble value synchronously (when coefficients are already available)
 */
export function calculateEnsembleValueSync(
  input: EnsembleInput & { coefficients: HedonicCoefficients }
): AVMResult {
  const { property, comparables, onlineEstimates, coefficients } = input

  // Calculate individual model values
  const hedonicResult = calculateHedonicValue(property, coefficients)
  const compResult = calculateCompValue(property, comparables, coefficients)
  const onlineAvg = calculateOnlineAverage(onlineEstimates)

  const hedonicValue = hedonicResult?.value || null
  const compValue = compResult?.value || null

  // Normalize weights
  const weights = normalizeWeights(
    hedonicValue !== null,
    compValue !== null,
    onlineAvg !== null
  )

  // Check if we have any values
  if (!hedonicValue && !compValue && !onlineAvg) {
    return createErrorResult(
      property.address || "Unknown",
      "Insufficient data for valuation.",
      []
    )
  }

  // Calculate weighted ensemble
  let estimatedValue = 0
  if (hedonicValue !== null) estimatedValue += hedonicValue * weights.hedonic
  if (compValue !== null) estimatedValue += compValue * weights.comp
  if (onlineAvg !== null) estimatedValue += onlineAvg * weights.online

  // Calculate confidence
  const confidence = calculateConfidence({
    property,
    comparables,
    onlineEstimates,
    hedonicValue,
    compValue,
    onlineAvg,
  })

  const valueRange = calculateValueRange(estimatedValue, confidence.fsd)
  const pricePerSqFt = property.squareFeet
    ? estimatedValue / property.squareFeet
    : undefined

  // Collect sources
  const sources: Array<{ name: string; url: string }> = []
  onlineEstimates.forEach((e) => {
    if (e.sourceUrl) {
      sources.push({
        name: `${e.source} Estimate`,
        url: e.sourceUrl,
      })
    }
  })

  const rawContent = formatAVMOutput({
    address: property.address || "Unknown Address",
    estimatedValue: Math.round(estimatedValue),
    valueLow: Math.round(valueRange.low),
    valueHigh: Math.round(valueRange.high),
    pricePerSqFt: pricePerSqFt ? Math.round(pricePerSqFt) : undefined,
    confidence,
    hedonicValue: hedonicValue ? Math.round(hedonicValue) : undefined,
    compValue: compValue ? Math.round(compValue) : undefined,
    onlineAvg: onlineAvg ? Math.round(onlineAvg) : undefined,
    weights,
    comparablesUsed: compResult?.adjustedComps.length || 0,
    estimateSources: onlineEstimates.map((e) => e.source),
    coefficientsSource: describeCoefficientsSource(coefficients),
  })

  return {
    address: property.address || "",
    estimatedValue: Math.round(estimatedValue),
    valueLow: Math.round(valueRange.low),
    valueHigh: Math.round(valueRange.high),
    pricePerSqFt: pricePerSqFt ? Math.round(pricePerSqFt) : undefined,
    confidenceScore: confidence.score,
    confidenceLevel: confidence.level,
    fsd: confidence.fsd,
    hedonicValue: hedonicValue ? Math.round(hedonicValue) : undefined,
    compAdjustedValue: compValue ? Math.round(compValue) : undefined,
    onlineEstimateAvg: onlineAvg ? Math.round(onlineAvg) : undefined,
    hedonicWeight: weights.hedonic,
    compWeight: weights.comp,
    onlineWeight: weights.online,
    coefficientsSource: describeCoefficientsSource(coefficients),
    comparablesUsed: compResult?.adjustedComps.length || 0,
    estimateSources: onlineEstimates.map((e) => e.source),
    rawContent,
    sources,
  }
}
