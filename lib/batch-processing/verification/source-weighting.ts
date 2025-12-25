/**
 * Source Weighting System
 *
 * Provides authority-based weighting for different data sources
 * to calculate more accurate confidence scores.
 *
 * Source Authority Hierarchy:
 * 1.0  - Official government APIs (SEC EDGAR, FEC.gov, IRS)
 * 0.95 - Government public records (County Assessor, State SOS)
 * 0.9  - Official nonprofit data (ProPublica 990s, GuideStar)
 * 0.8  - Curated commercial databases (Zillow, Redfin)
 * 0.7  - Professional networks (LinkedIn)
 * 0.6  - Major news sources (NYT, WSJ, Bloomberg)
 * 0.5  - General news sources
 * 0.4  - LLM synthesis with citations
 * 0.3  - LLM synthesis without citations
 * 0.2  - Social media
 */

// ============================================================================
// TYPES
// ============================================================================

export type SourceCategory =
  | "GOVERNMENT_API"      // SEC, FEC, IRS direct APIs
  | "GOVERNMENT_RECORDS"  // County assessor, state SOS
  | "NONPROFIT_DATA"      // ProPublica, GuideStar
  | "COMMERCIAL_DB"       // Zillow, Redfin, property databases
  | "PROFESSIONAL"        // LinkedIn, company websites
  | "MAJOR_NEWS"          // NYT, WSJ, Bloomberg, Forbes
  | "GENERAL_NEWS"        // Local news, general publications
  | "LLM_WITH_CITATIONS"  // LLM output with source URLs
  | "LLM_NO_CITATIONS"    // LLM output without sources
  | "SOCIAL_MEDIA"        // Twitter, Facebook, etc.
  | "UNKNOWN"             // Unclassified source

export interface SourceWeight {
  category: SourceCategory
  authority: number  // 0-1
  description: string
  reliabilityNotes: string
}

export interface WeightedSource {
  url: string
  domain: string
  category: SourceCategory
  authority: number
  title?: string
  snippet?: string
}

export interface ConfidenceCalculation {
  overallConfidence: number  // 0-1
  sourceBreakdown: Array<{
    category: SourceCategory
    count: number
    avgAuthority: number
    contribution: number
  }>
  topSources: WeightedSource[]
  weaknesses: string[]
  recommendations: string[]
}

// ============================================================================
// SOURCE AUTHORITY REGISTRY
// ============================================================================

export const SOURCE_WEIGHTS: Record<SourceCategory, SourceWeight> = {
  GOVERNMENT_API: {
    category: "GOVERNMENT_API",
    authority: 1.0,
    description: "Direct government API data",
    reliabilityNotes: "Most authoritative - official filings and records",
  },
  GOVERNMENT_RECORDS: {
    category: "GOVERNMENT_RECORDS",
    authority: 0.95,
    description: "Government public records",
    reliabilityNotes: "Official but may be outdated - property records, business filings",
  },
  NONPROFIT_DATA: {
    category: "NONPROFIT_DATA",
    authority: 0.9,
    description: "Nonprofit data aggregators",
    reliabilityNotes: "Based on IRS 990 filings - highly reliable for foundation data",
  },
  COMMERCIAL_DB: {
    category: "COMMERCIAL_DB",
    authority: 0.8,
    description: "Commercial property/financial databases",
    reliabilityNotes: "Good for estimates but not official values",
  },
  PROFESSIONAL: {
    category: "PROFESSIONAL",
    authority: 0.7,
    description: "Professional networks and company sites",
    reliabilityNotes: "Self-reported data - verify current status",
  },
  MAJOR_NEWS: {
    category: "MAJOR_NEWS",
    authority: 0.6,
    description: "Major news publications",
    reliabilityNotes: "Journalistic standards but may have errors",
  },
  GENERAL_NEWS: {
    category: "GENERAL_NEWS",
    authority: 0.5,
    description: "General news sources",
    reliabilityNotes: "Variable quality - use for context only",
  },
  LLM_WITH_CITATIONS: {
    category: "LLM_WITH_CITATIONS",
    authority: 0.4,
    description: "LLM synthesis with source citations",
    reliabilityNotes: "Can hallucinate - verify cited sources",
  },
  LLM_NO_CITATIONS: {
    category: "LLM_NO_CITATIONS",
    authority: 0.3,
    description: "LLM synthesis without citations",
    reliabilityNotes: "High hallucination risk - treat as unverified",
  },
  SOCIAL_MEDIA: {
    category: "SOCIAL_MEDIA",
    authority: 0.2,
    description: "Social media sources",
    reliabilityNotes: "Self-reported, often outdated or exaggerated",
  },
  UNKNOWN: {
    category: "UNKNOWN",
    authority: 0.3,
    description: "Unknown or unclassified source",
    reliabilityNotes: "Cannot assess reliability - treat with caution",
  },
}

// ============================================================================
// DOMAIN CLASSIFICATION
// ============================================================================

const DOMAIN_PATTERNS: Array<{ pattern: RegExp; category: SourceCategory }> = [
  // Government APIs
  { pattern: /sec\.gov/i, category: "GOVERNMENT_API" },
  { pattern: /fec\.gov/i, category: "GOVERNMENT_API" },
  { pattern: /irs\.gov/i, category: "GOVERNMENT_API" },
  { pattern: /usaspending\.gov/i, category: "GOVERNMENT_API" },
  { pattern: /data\.gov/i, category: "GOVERNMENT_API" },

  // Government Records
  { pattern: /\.gov$/i, category: "GOVERNMENT_RECORDS" },
  { pattern: /countyclerk/i, category: "GOVERNMENT_RECORDS" },
  { pattern: /assessor/i, category: "GOVERNMENT_RECORDS" },
  { pattern: /sos\.state/i, category: "GOVERNMENT_RECORDS" },
  { pattern: /secretary.*state/i, category: "GOVERNMENT_RECORDS" },

  // Nonprofit Data
  { pattern: /propublica\.org/i, category: "NONPROFIT_DATA" },
  { pattern: /guidestar/i, category: "NONPROFIT_DATA" },
  { pattern: /candid\.org/i, category: "NONPROFIT_DATA" },
  { pattern: /open990/i, category: "NONPROFIT_DATA" },
  { pattern: /foundationcenter/i, category: "NONPROFIT_DATA" },

  // Commercial Databases
  { pattern: /zillow\.com/i, category: "COMMERCIAL_DB" },
  { pattern: /redfin\.com/i, category: "COMMERCIAL_DB" },
  { pattern: /realtor\.com/i, category: "COMMERCIAL_DB" },
  { pattern: /trulia\.com/i, category: "COMMERCIAL_DB" },
  { pattern: /crunchbase\.com/i, category: "COMMERCIAL_DB" },
  { pattern: /pitchbook\.com/i, category: "COMMERCIAL_DB" },
  { pattern: /bloomberg\.com\/profile/i, category: "COMMERCIAL_DB" },
  { pattern: /dnb\.com/i, category: "COMMERCIAL_DB" },

  // Professional
  { pattern: /linkedin\.com/i, category: "PROFESSIONAL" },
  { pattern: /glassdoor\.com/i, category: "PROFESSIONAL" },
  { pattern: /angel\.co/i, category: "PROFESSIONAL" },
  { pattern: /about\.[a-z]+\.com/i, category: "PROFESSIONAL" },

  // Major News
  { pattern: /nytimes\.com/i, category: "MAJOR_NEWS" },
  { pattern: /wsj\.com/i, category: "MAJOR_NEWS" },
  { pattern: /bloomberg\.com/i, category: "MAJOR_NEWS" },
  { pattern: /reuters\.com/i, category: "MAJOR_NEWS" },
  { pattern: /forbes\.com/i, category: "MAJOR_NEWS" },
  { pattern: /ft\.com/i, category: "MAJOR_NEWS" },
  { pattern: /washingtonpost\.com/i, category: "MAJOR_NEWS" },
  { pattern: /latimes\.com/i, category: "MAJOR_NEWS" },
  { pattern: /cnbc\.com/i, category: "MAJOR_NEWS" },
  { pattern: /fortune\.com/i, category: "MAJOR_NEWS" },
  { pattern: /businessinsider\.com/i, category: "MAJOR_NEWS" },

  // General News
  { pattern: /news/i, category: "GENERAL_NEWS" },
  { pattern: /\.com\/article/i, category: "GENERAL_NEWS" },
  { pattern: /patch\.com/i, category: "GENERAL_NEWS" },

  // Social Media
  { pattern: /twitter\.com/i, category: "SOCIAL_MEDIA" },
  { pattern: /x\.com/i, category: "SOCIAL_MEDIA" },
  { pattern: /facebook\.com/i, category: "SOCIAL_MEDIA" },
  { pattern: /instagram\.com/i, category: "SOCIAL_MEDIA" },
  { pattern: /tiktok\.com/i, category: "SOCIAL_MEDIA" },
]

/**
 * Classify a URL into a source category
 */
export function classifySource(url: string): SourceCategory {
  try {
    const urlLower = url.toLowerCase()

    for (const { pattern, category } of DOMAIN_PATTERNS) {
      if (pattern.test(urlLower)) {
        return category
      }
    }

    return "UNKNOWN"
  } catch {
    return "UNKNOWN"
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/**
 * Weight and classify sources
 */
export function weightSources(
  sources: Array<{ url: string; title?: string; snippet?: string }>
): WeightedSource[] {
  return sources.map((source) => {
    const category = classifySource(source.url)
    const weight = SOURCE_WEIGHTS[category]

    return {
      url: source.url,
      domain: extractDomain(source.url),
      category,
      authority: weight.authority,
      title: source.title,
      snippet: source.snippet,
    }
  })
}

// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================

/**
 * Calculate overall confidence score based on weighted sources
 */
export function calculateSourceBasedConfidence(
  sources: Array<{ url: string; title?: string; snippet?: string }>,
  hasApiVerification: boolean = false,
  apiVerificationPassed: boolean = false
): ConfidenceCalculation {
  const weighted = weightSources(sources)
  const weaknesses: string[] = []
  const recommendations: string[] = []

  // Group by category
  const byCategory = new Map<SourceCategory, WeightedSource[]>()
  for (const source of weighted) {
    const existing = byCategory.get(source.category) || []
    existing.push(source)
    byCategory.set(source.category, existing)
  }

  // Calculate category breakdown
  const sourceBreakdown: ConfidenceCalculation["sourceBreakdown"] = []
  for (const [category, sources] of byCategory) {
    const avgAuthority = sources.reduce((sum, s) => sum + s.authority, 0) / sources.length
    sourceBreakdown.push({
      category,
      count: sources.length,
      avgAuthority,
      contribution: sources.length * avgAuthority,
    })
  }

  // Sort by contribution
  sourceBreakdown.sort((a, b) => b.contribution - a.contribution)

  // Calculate overall confidence
  // Formula: weighted average of source authorities + API verification bonus
  const totalWeight = weighted.reduce((sum, s) => sum + s.authority, 0)
  const sourceCount = weighted.length

  let baseConfidence = sourceCount > 0 ? totalWeight / sourceCount : 0

  // Adjust for source diversity (having multiple source types is better)
  const categoryCount = byCategory.size
  if (categoryCount >= 3) {
    baseConfidence *= 1.1 // 10% bonus for diverse sources
  }

  // Adjust for high-authority sources
  const hasGovSource = byCategory.has("GOVERNMENT_API") || byCategory.has("GOVERNMENT_RECORDS")
  const hasNonprofitSource = byCategory.has("NONPROFIT_DATA")
  const hasCommercialSource = byCategory.has("COMMERCIAL_DB")

  if (hasGovSource) {
    baseConfidence *= 1.15 // 15% bonus for government sources
  }

  // API verification adjustment
  if (hasApiVerification) {
    if (apiVerificationPassed) {
      baseConfidence *= 1.2 // 20% bonus for passed verification
    } else {
      baseConfidence *= 0.7 // 30% penalty for failed verification
      weaknesses.push("API verification found discrepancies with source data")
    }
  }

  // Cap at 1.0
  const overallConfidence = Math.min(1.0, baseConfidence)

  // Generate weaknesses
  if (!hasGovSource) {
    weaknesses.push("No government or official sources cited")
  }

  if (byCategory.has("LLM_NO_CITATIONS") && !hasGovSource && !hasNonprofitSource) {
    weaknesses.push("Heavily reliant on LLM synthesis without authoritative verification")
  }

  if (sourceCount < 3) {
    weaknesses.push("Limited number of sources (< 3)")
  }

  // Generate recommendations
  if (!hasGovSource) {
    recommendations.push("Verify key claims against SEC, FEC, or government records")
  }

  if (!hasNonprofitSource && !hasCommercialSource) {
    recommendations.push("Cross-reference with ProPublica or property records")
  }

  if (overallConfidence < 0.5) {
    recommendations.push("Low confidence - consider manual verification before outreach")
  }

  // Get top sources (highest authority)
  const topSources = [...weighted]
    .sort((a, b) => b.authority - a.authority)
    .slice(0, 5)

  return {
    overallConfidence,
    sourceBreakdown,
    topSources,
    weaknesses,
    recommendations,
  }
}

/**
 * Get a human-readable confidence label
 */
export function getConfidenceLabel(confidence: number): {
  label: string
  color: "green" | "yellow" | "orange" | "red"
  description: string
} {
  if (confidence >= 0.8) {
    return {
      label: "HIGH",
      color: "green",
      description: "Multiple authoritative sources confirm key data points",
    }
  }
  if (confidence >= 0.6) {
    return {
      label: "MEDIUM",
      color: "yellow",
      description: "Good source coverage but some data unverified",
    }
  }
  if (confidence >= 0.4) {
    return {
      label: "LOW",
      color: "orange",
      description: "Limited sources - verify before major gift outreach",
    }
  }
  return {
    label: "VERY LOW",
    color: "red",
    description: "Insufficient verification - treat as preliminary data only",
  }
}

/**
 * Calculate field-level confidence based on which sources provide that field
 */
export function calculateFieldConfidence(
  fieldName: string,
  sources: Array<{ url: string; providesField: boolean }>
): {
  confidence: number
  sourcesProviding: number
  highestAuthority: number
} {
  const providingSources = sources.filter((s) => s.providesField)

  if (providingSources.length === 0) {
    return { confidence: 0, sourcesProviding: 0, highestAuthority: 0 }
  }

  const weighted = weightSources(
    providingSources.map((s) => ({ url: s.url }))
  )

  const highestAuthority = Math.max(...weighted.map((w) => w.authority))
  const avgAuthority = weighted.reduce((sum, w) => sum + w.authority, 0) / weighted.length

  // Confidence is boosted by multiple sources agreeing
  const agreementBonus = Math.min(0.2, (providingSources.length - 1) * 0.05)

  return {
    confidence: Math.min(1.0, avgAuthority + agreementBonus),
    sourcesProviding: providingSources.length,
    highestAuthority,
  }
}
