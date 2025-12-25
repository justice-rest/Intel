/**
 * Triangulation Engine
 *
 * Merges data from multiple sources with confidence scoring.
 * Resolves conflicts, flags discrepancies, and produces a unified output.
 */

import type { ProspectResearchOutput, ResearchMetrics, ResearchWealth, ResearchPhilanthropy } from "../types"
import { parseLenientProspectOutput, type LenientProspectResearchOutput } from "../schemas/prospect-output"
import {
  calculateFieldConfidence,
  calculateOverallConfidence,
  type FieldConfidence,
  type ConfidenceLevel,
} from "./confidence-scorer"
import { getSourceAuthority, identifySource } from "./source-registry"

// ============================================================================
// TYPES
// ============================================================================

export interface TriangulatedResult {
  output: LenientProspectResearchOutput
  confidence: {
    overall: number
    verifiedFields: number
    corroboratedFields: number
    conflictedFields: number
    details: Record<string, FieldConfidence>
  }
  sources: Array<{
    name: string
    url: string
    authority: number
    fieldsProvided: string[]
  }>
  conflicts: Array<{
    field: string
    values: Array<{ source: string; value: unknown }>
    resolution: string
  }>
}

export interface SourceData {
  sourceName: string
  sourceUrl?: string
  data: Partial<ProspectResearchOutput>
}

// ============================================================================
// TRIANGULATION ENGINE
// ============================================================================

/**
 * Triangulate data from multiple sources into a single output
 */
export function triangulateData(sources: SourceData[]): TriangulatedResult {
  if (sources.length === 0) {
    return {
      output: parseLenientProspectOutput({}),
      confidence: {
        overall: 0,
        verifiedFields: 0,
        corroboratedFields: 0,
        conflictedFields: 0,
        details: {},
      },
      sources: [],
      conflicts: [],
    }
  }

  const fieldValues: Record<string, Array<{ value: unknown; sourceUrl: string; sourceName: string }>> = {}
  const sourceDetails: Map<string, { fieldsProvided: string[]; authority: number }> = new Map()
  const conflicts: TriangulatedResult["conflicts"] = []

  // Collect values from all sources
  for (const source of sources) {
    const authority = source.sourceUrl ? getSourceAuthority(source.sourceUrl) : 0.5

    if (!sourceDetails.has(source.sourceName)) {
      sourceDetails.set(source.sourceName, { fieldsProvided: [], authority })
    }

    // Extract fields from this source
    const extracted = extractFields(source.data)

    for (const [fieldPath, value] of Object.entries(extracted)) {
      if (value !== null && value !== undefined) {
        if (!fieldValues[fieldPath]) {
          fieldValues[fieldPath] = []
        }

        fieldValues[fieldPath].push({
          value,
          sourceUrl: source.sourceUrl || "",
          sourceName: source.sourceName,
        })

        sourceDetails.get(source.sourceName)!.fieldsProvided.push(fieldPath)
      }
    }
  }

  // Calculate confidence for each field
  const fieldConfidences: Record<string, FieldConfidence> = {}
  const mergedOutput: Record<string, unknown> = {}

  for (const [fieldPath, values] of Object.entries(fieldValues)) {
    const confidence = calculateFieldConfidence(values)
    fieldConfidences[fieldPath] = confidence
    setNestedValue(mergedOutput, fieldPath, confidence.value)

    // Track conflicts
    if (confidence.confidence === "CONFLICTED" && confidence.conflictNote) {
      conflicts.push({
        field: fieldPath,
        values: values.map((v) => ({ source: v.sourceName, value: v.value })),
        resolution: `Using highest authority value: ${JSON.stringify(confidence.value)}`,
      })
    }
  }

  // Calculate overall confidence
  const overallConfidence = calculateOverallConfidence(fieldConfidences)

  // Build final output
  const output = parseLenientProspectOutput(structureOutput(mergedOutput))

  // Merge sources list
  const mergedSources = mergeSourceLists(sources)

  return {
    output,
    confidence: {
      overall: overallConfidence.overallScore,
      verifiedFields: overallConfidence.verifiedCount,
      corroboratedFields: overallConfidence.corroboratedCount,
      conflictedFields: overallConfidence.conflictedCount,
      details: fieldConfidences,
    },
    sources: Array.from(sourceDetails.entries()).map(([name, details]) => ({
      name,
      url: sources.find((s) => s.sourceName === name)?.sourceUrl || "",
      authority: details.authority,
      fieldsProvided: details.fieldsProvided,
    })),
    conflicts,
  }
}

// ============================================================================
// FIELD EXTRACTION
// ============================================================================

/**
 * Extract fields from a research output as flat key-value pairs
 */
function extractFields(data: Partial<ProspectResearchOutput>): Record<string, unknown> {
  const fields: Record<string, unknown> = {}

  if (!data) return fields

  // Metrics
  if (data.metrics) {
    fields["metrics.estimated_net_worth_low"] = data.metrics.estimated_net_worth_low
    fields["metrics.estimated_net_worth_high"] = data.metrics.estimated_net_worth_high
    fields["metrics.estimated_gift_capacity"] = data.metrics.estimated_gift_capacity
    fields["metrics.capacity_rating"] = data.metrics.capacity_rating
    fields["metrics.romy_score"] = data.metrics.romy_score
    fields["metrics.recommended_ask"] = data.metrics.recommended_ask
    fields["metrics.confidence_level"] = data.metrics.confidence_level
  }

  // Wealth - Real Estate
  if (data.wealth?.real_estate) {
    fields["wealth.real_estate.total_value"] = data.wealth.real_estate.total_value
    if (data.wealth.real_estate.properties?.length) {
      fields["wealth.real_estate.properties"] = data.wealth.real_estate.properties
    }
  }

  // Wealth - Business
  if (data.wealth?.business_ownership?.length) {
    fields["wealth.business_ownership"] = data.wealth.business_ownership
  }

  // Wealth - Securities
  if (data.wealth?.securities) {
    fields["wealth.securities.has_sec_filings"] = data.wealth.securities.has_sec_filings
    if (data.wealth.securities.insider_at?.length) {
      fields["wealth.securities.insider_at"] = data.wealth.securities.insider_at
    }
  }

  // Philanthropy
  if (data.philanthropy) {
    if (data.philanthropy.political_giving) {
      fields["philanthropy.political_giving.total"] = data.philanthropy.political_giving.total
      fields["philanthropy.political_giving.party_lean"] = data.philanthropy.political_giving.party_lean
    }
    if (data.philanthropy.foundation_affiliations?.length) {
      fields["philanthropy.foundation_affiliations"] = data.philanthropy.foundation_affiliations
    }
    if (data.philanthropy.nonprofit_boards?.length) {
      fields["philanthropy.nonprofit_boards"] = data.philanthropy.nonprofit_boards
    }
    if (data.philanthropy.known_major_gifts?.length) {
      fields["philanthropy.known_major_gifts"] = data.philanthropy.known_major_gifts
    }
  }

  // Background
  if (data.background) {
    fields["background.age"] = data.background.age
    if (data.background.education?.length) {
      fields["background.education"] = data.background.education
    }
    fields["background.career_summary"] = data.background.career_summary
    if (data.background.family) {
      fields["background.family.spouse"] = data.background.family.spouse
      fields["background.family.children_count"] = data.background.family.children_count
    }
  }

  // Strategy
  if (data.strategy) {
    fields["strategy.readiness"] = data.strategy.readiness
    if (data.strategy.next_steps?.length) {
      fields["strategy.next_steps"] = data.strategy.next_steps
    }
    fields["strategy.best_solicitor"] = data.strategy.best_solicitor
    fields["strategy.tax_smart_option"] = data.strategy.tax_smart_option
  }

  // Executive Summary
  if (data.executive_summary) {
    fields["executive_summary"] = data.executive_summary
  }

  return fields
}

/**
 * Set a nested value in an object using dot notation
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".")
  let current: Record<string, unknown> = obj

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!(part in current) || typeof current[part] !== "object") {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }

  current[parts[parts.length - 1]] = value
}

/**
 * Structure flat merged output into proper nested structure
 */
function structureOutput(flat: Record<string, unknown>): Partial<ProspectResearchOutput> {
  const output: Record<string, unknown> = {}

  for (const [path, value] of Object.entries(flat)) {
    setNestedValue(output, path, value)
  }

  return output as Partial<ProspectResearchOutput>
}

/**
 * Merge source lists from all inputs, deduplicating by URL
 */
function mergeSourceLists(sources: SourceData[]): Array<{ title: string; url: string; data_provided: string }> {
  const seen = new Set<string>()
  const merged: Array<{ title: string; url: string; data_provided: string }> = []

  for (const source of sources) {
    if (source.data?.sources) {
      for (const s of source.data.sources) {
        if (s.url && !seen.has(s.url)) {
          seen.add(s.url)
          merged.push(s)
        }
      }
    }
  }

  return merged
}

// ============================================================================
// QUICK MERGE (without full confidence calculation)
// ============================================================================

/**
 * Quick merge of research outputs without full confidence calculation
 * Use when you just need combined data, not detailed confidence
 */
export function quickMerge(
  primary: Partial<ProspectResearchOutput>,
  secondary: Partial<ProspectResearchOutput>
): LenientProspectResearchOutput {
  const merged: Partial<ProspectResearchOutput> = { ...secondary, ...primary }

  // Merge arrays rather than replace
  if (secondary.sources && primary.sources) {
    const seenUrls = new Set(primary.sources.map((s) => s.url))
    merged.sources = [
      ...primary.sources,
      ...secondary.sources.filter((s) => !seenUrls.has(s.url)),
    ]
  }

  if (secondary.wealth?.business_ownership && primary.wealth?.business_ownership) {
    const seenCompanies = new Set(primary.wealth.business_ownership.map((b) => b.company))
    merged.wealth = {
      ...merged.wealth,
      business_ownership: [
        ...primary.wealth.business_ownership,
        ...secondary.wealth.business_ownership.filter((b) => !seenCompanies.has(b.company)),
      ],
    } as ResearchWealth
  }

  if (secondary.wealth?.real_estate?.properties && primary.wealth?.real_estate?.properties) {
    const seenAddresses = new Set(primary.wealth.real_estate.properties.map((p) => p.address))
    merged.wealth = {
      ...merged.wealth,
      real_estate: {
        ...(merged.wealth?.real_estate || {}),
        properties: [
          ...primary.wealth.real_estate.properties,
          ...secondary.wealth.real_estate.properties.filter((p) => !seenAddresses.has(p.address)),
        ],
      },
    } as ResearchWealth
  }

  // Use higher values for net worth
  if (merged.metrics) {
    merged.metrics.estimated_net_worth_low = Math.max(
      primary.metrics?.estimated_net_worth_low || 0,
      secondary.metrics?.estimated_net_worth_low || 0
    ) || null
    merged.metrics.estimated_net_worth_high = Math.max(
      primary.metrics?.estimated_net_worth_high || 0,
      secondary.metrics?.estimated_net_worth_high || 0
    ) || null
    merged.metrics.romy_score = Math.max(
      primary.metrics?.romy_score || 0,
      secondary.metrics?.romy_score || 0
    )
  }

  return parseLenientProspectOutput(merged)
}

// ============================================================================
// EXPORTS
// ============================================================================

export { calculateFieldConfidence, calculateOverallConfidence } from "./confidence-scorer"
export { getSourceAuthority, identifySource, SOURCE_REGISTRY } from "./source-registry"
