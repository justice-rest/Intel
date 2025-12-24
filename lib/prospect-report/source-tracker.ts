/**
 * Source Tracker
 *
 * Tracks sources for every claim in a prospect report.
 * Enables per-claim citation and confidence scoring.
 *
 * Key features:
 * - Track sources per claim
 * - Mark claims as [Verified], [Estimated], [Unverified]
 * - Calculate confidence levels per section
 * - Generate Sources & Methodology section
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SourceReference {
  name: string
  url: string
  confidence: "high" | "medium" | "low"
  retrievedAt?: string
  dataType?: string // e.g., "official_record", "web_search", "api_response"
}

export interface SourcedClaim {
  claim: string
  value: string | number
  sources: SourceReference[]
  isEstimated: boolean
  isVerified: boolean
  methodology?: string
  confidenceLevel: "high" | "medium" | "low" | "very_low"
}

export interface SectionConfidence {
  section: string
  claimCount: number
  verifiedCount: number
  estimatedCount: number
  unverifiedCount: number
  overallConfidence: "HIGH" | "MEDIUM" | "LOW"
  sources: SourceReference[]
}

// Source confidence rankings
const SOURCE_CONFIDENCE_RANK: Record<string, number> = {
  // Official government records - highest confidence
  "SEC EDGAR": 100,
  "SEC.gov": 100,
  "FEC.gov": 100,
  "FEC": 100,
  "County Assessor": 95,
  "County Tax Records": 95,
  "State Secretary of State": 90,
  "Florida Sunbiz": 90,
  "California bizfile": 90,
  "Delaware ICIS": 90,
  "New York DOS": 90,
  "Voter Registration": 90,

  // IRS data via intermediaries - high confidence
  "ProPublica 990": 85,
  "ProPublica Nonprofit Explorer": 85,
  "IRS Form 990": 85,

  // Structured data APIs - high confidence
  "Wikidata": 70,
  "OpenCorporates": 75,
  "GLEIF LEI": 80,

  // Web sources - medium confidence
  "Zillow": 60,
  "Redfin": 60,
  "Realtor.com": 60,
  "LinkedIn": 55,
  "Company Website": 50,
  "News Article": 45,
  "Web Search": 40,
  "Linkup": 40,

  // Estimates - lower confidence
  "Calculated Estimate": 30,
  "Industry Benchmark": 35,
  "Inferred": 20,
}

// ============================================================================
// SOURCE TRACKER CLASS
// ============================================================================

export class SourceTracker {
  private claims: Map<string, SourcedClaim[]> = new Map()
  private allSources: SourceReference[] = []

  /**
   * Add a verified claim with official source
   */
  addVerifiedClaim(
    section: string,
    claim: string,
    value: string | number,
    source: SourceReference
  ): void {
    this.addClaim(section, {
      claim,
      value,
      sources: [source],
      isEstimated: false,
      isVerified: true,
      confidenceLevel: this.getConfidenceLevel([source]),
    })
  }

  /**
   * Add an estimated claim with methodology
   */
  addEstimatedClaim(
    section: string,
    claim: string,
    value: string | number,
    methodology: string,
    sources: SourceReference[] = []
  ): void {
    this.addClaim(section, {
      claim,
      value,
      sources,
      isEstimated: true,
      isVerified: false,
      methodology,
      confidenceLevel: "low",
    })
  }

  /**
   * Add an unverified claim from web search
   */
  addUnverifiedClaim(
    section: string,
    claim: string,
    value: string | number,
    sources: SourceReference[]
  ): void {
    this.addClaim(section, {
      claim,
      value,
      sources,
      isEstimated: false,
      isVerified: false,
      confidenceLevel: this.getConfidenceLevel(sources),
    })
  }

  /**
   * Add a claim with full control
   */
  addClaim(section: string, claim: SourcedClaim): void {
    const sectionClaims = this.claims.get(section) || []
    sectionClaims.push(claim)
    this.claims.set(section, sectionClaims)

    // Track all sources
    for (const source of claim.sources) {
      if (!this.allSources.some((s) => s.url === source.url)) {
        this.allSources.push(source)
      }
    }
  }

  /**
   * Get all claims for a section
   */
  getClaims(section: string): SourcedClaim[] {
    return this.claims.get(section) || []
  }

  /**
   * Get all sections
   */
  getSections(): string[] {
    return Array.from(this.claims.keys())
  }

  /**
   * Get all unique sources
   */
  getAllSources(): SourceReference[] {
    return this.allSources
  }

  /**
   * Calculate confidence level for a section
   */
  getSectionConfidence(section: string): SectionConfidence {
    const claims = this.getClaims(section)

    const verifiedCount = claims.filter((c) => c.isVerified).length
    const estimatedCount = claims.filter((c) => c.isEstimated).length
    const unverifiedCount = claims.filter((c) => !c.isVerified && !c.isEstimated).length

    // Collect unique sources for this section
    const sectionSources: SourceReference[] = []
    for (const claim of claims) {
      for (const source of claim.sources) {
        if (!sectionSources.some((s) => s.url === source.url)) {
          sectionSources.push(source)
        }
      }
    }

    // Calculate overall confidence
    let overallConfidence: "HIGH" | "MEDIUM" | "LOW"
    if (claims.length === 0) {
      overallConfidence = "LOW"
    } else if (verifiedCount / claims.length >= 0.7) {
      overallConfidence = "HIGH"
    } else if (verifiedCount / claims.length >= 0.3 || estimatedCount / claims.length <= 0.5) {
      overallConfidence = "MEDIUM"
    } else {
      overallConfidence = "LOW"
    }

    return {
      section,
      claimCount: claims.length,
      verifiedCount,
      estimatedCount,
      unverifiedCount,
      overallConfidence,
      sources: sectionSources,
    }
  }

  /**
   * Format a claim for report output
   */
  formatClaim(claim: SourcedClaim): string {
    let marker = ""
    if (claim.isVerified) {
      marker = "[Verified]"
    } else if (claim.isEstimated) {
      marker = `[Estimated - ${claim.methodology || "See methodology"}]`
    } else if (claim.confidenceLevel === "low" || claim.confidenceLevel === "very_low") {
      marker = "[Unverified]"
    } else {
      marker = "[Corroborated]"
    }

    const sourceNames = claim.sources.map((s) => s.name).join(", ")
    const sourceRef = sourceNames ? `[Source: ${sourceNames}]` : ""

    return `${claim.claim}: ${claim.value} ${marker} ${sourceRef}`.trim()
  }

  /**
   * Generate the Sources & Methodology section for the report
   */
  formatSourcesSection(): string {
    const lines: string[] = [
      "## Sources and Research Methodology",
      "",
      "### Primary Sources Verified",
    ]

    // Group sources by confidence
    const highConfidence = this.allSources.filter((s) => this.getSourceRank(s.name) >= 80)
    const mediumConfidence = this.allSources.filter(
      (s) => this.getSourceRank(s.name) >= 50 && this.getSourceRank(s.name) < 80
    )
    const lowConfidence = this.allSources.filter((s) => this.getSourceRank(s.name) < 50)

    if (highConfidence.length > 0) {
      for (const source of highConfidence) {
        lines.push(`- **${source.name}**: Official government or institutional record`)
        if (source.url) {
          lines.push(`  - URL: ${source.url}`)
        }
      }
    }

    if (mediumConfidence.length > 0) {
      lines.push("")
      lines.push("### Secondary Sources (Corroborated)")
      for (const source of mediumConfidence) {
        lines.push(`- **${source.name}**`)
        if (source.url) {
          lines.push(`  - URL: ${source.url}`)
        }
      }
    }

    if (lowConfidence.length > 0) {
      lines.push("")
      lines.push("### Web Sources (Lower Confidence)")
      for (const source of lowConfidence) {
        lines.push(`- ${source.name}`)
      }
    }

    // Add corroboration summary
    lines.push("")
    lines.push("### Information Corroboration")

    const sections = this.getSections()
    for (const section of sections) {
      const confidence = this.getSectionConfidence(section)
      if (confidence.claimCount > 0) {
        lines.push(
          `- **${section}**: ${confidence.verifiedCount}/${confidence.claimCount} claims verified (${confidence.overallConfidence} confidence)`
        )
      }
    }

    // Add overall confidence
    lines.push("")
    lines.push(`### Research Confidence Level: ${this.getOverallConfidence()}`)
    lines.push("")
    lines.push(this.getConfidenceExplanation())

    return lines.join("\n")
  }

  /**
   * Get overall confidence for the entire report
   */
  getOverallConfidence(): "HIGH" | "MEDIUM" | "LOW" {
    const allClaims: SourcedClaim[] = []
    for (const claims of this.claims.values()) {
      allClaims.push(...claims)
    }

    if (allClaims.length === 0) return "LOW"

    const verifiedCount = allClaims.filter((c) => c.isVerified).length
    const ratio = verifiedCount / allClaims.length

    if (ratio >= 0.6) return "HIGH"
    if (ratio >= 0.3) return "MEDIUM"
    return "LOW"
  }

  /**
   * Get explanation for confidence level
   */
  private getConfidenceExplanation(): string {
    const confidence = this.getOverallConfidence()
    const allClaims: SourcedClaim[] = []
    for (const claims of this.claims.values()) {
      allClaims.push(...claims)
    }

    const verifiedCount = allClaims.filter((c) => c.isVerified).length
    const estimatedCount = allClaims.filter((c) => c.isEstimated).length

    switch (confidence) {
      case "HIGH":
        return `This report has HIGH confidence. ${verifiedCount} of ${allClaims.length} claims are verified from official sources including SEC EDGAR, FEC, and county property records.`
      case "MEDIUM":
        return `This report has MEDIUM confidence. ${verifiedCount} of ${allClaims.length} claims are verified from official sources. ${estimatedCount} claims are estimates based on available indicators.`
      case "LOW":
        return `This report has LOW confidence. Limited official records were found. Many values are estimates or from web sources that could not be independently verified. Additional research recommended.`
    }
  }

  /**
   * Get confidence level from sources
   */
  private getConfidenceLevel(sources: SourceReference[]): "high" | "medium" | "low" | "very_low" {
    if (sources.length === 0) return "very_low"

    const maxRank = Math.max(...sources.map((s) => this.getSourceRank(s.name)))

    if (maxRank >= 80) return "high"
    if (maxRank >= 50) return "medium"
    if (maxRank >= 30) return "low"
    return "very_low"
  }

  /**
   * Get confidence rank for a source name
   */
  private getSourceRank(sourceName: string): number {
    // Check exact match first
    if (SOURCE_CONFIDENCE_RANK[sourceName]) {
      return SOURCE_CONFIDENCE_RANK[sourceName]
    }

    // Check partial matches
    const lowerName = sourceName.toLowerCase()
    for (const [key, rank] of Object.entries(SOURCE_CONFIDENCE_RANK)) {
      if (lowerName.includes(key.toLowerCase())) {
        return rank
      }
    }

    // Default to low confidence
    return 30
  }

  /**
   * Create a summary of data quality for the report header
   */
  getDataQualitySummary(): {
    quality: "complete" | "partial" | "limited"
    verifiedSources: number
    totalClaims: number
    verifiedClaims: number
    estimatedClaims: number
  } {
    const allClaims: SourcedClaim[] = []
    for (const claims of this.claims.values()) {
      allClaims.push(...claims)
    }

    const verifiedClaims = allClaims.filter((c) => c.isVerified).length
    const estimatedClaims = allClaims.filter((c) => c.isEstimated).length
    const verifiedSources = this.allSources.filter((s) => this.getSourceRank(s.name) >= 80).length

    let quality: "complete" | "partial" | "limited"
    if (verifiedSources >= 3 && verifiedClaims / allClaims.length >= 0.5) {
      quality = "complete"
    } else if (verifiedSources >= 1 || verifiedClaims > 0) {
      quality = "partial"
    } else {
      quality = "limited"
    }

    return {
      quality,
      verifiedSources,
      totalClaims: allClaims.length,
      verifiedClaims,
      estimatedClaims,
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new source tracker instance
 */
export function createSourceTracker(): SourceTracker {
  return new SourceTracker()
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a source reference from common data sources
 */
export function createSource(
  name: string,
  url: string,
  dataType?: string
): SourceReference {
  const confidence = getSourceConfidence(name)
  return {
    name,
    url,
    confidence,
    retrievedAt: new Date().toISOString(),
    dataType,
  }
}

/**
 * Get confidence level for a source name
 */
export function getSourceConfidence(sourceName: string): "high" | "medium" | "low" {
  const rank = SOURCE_CONFIDENCE_RANK[sourceName] || 30

  if (rank >= 80) return "high"
  if (rank >= 50) return "medium"
  return "low"
}

/**
 * Common source creators for convenience
 */
export const Sources = {
  sec: (url: string) => createSource("SEC EDGAR", url, "official_record"),
  fec: (url: string) => createSource("FEC.gov", url, "official_record"),
  propublica: (url: string) => createSource("ProPublica 990", url, "official_record"),
  countyAssessor: (county: string, url: string) =>
    createSource(`${county} County Assessor`, url, "official_record"),
  voterRegistration: (state: string, url: string) =>
    createSource(`${state} Voter Registration`, url, "official_record"),
  stateRegistry: (state: string, url: string) =>
    createSource(`${state} Secretary of State`, url, "official_record"),
  wikidata: (url: string) => createSource("Wikidata", url, "api_response"),
  zillow: (url: string) => createSource("Zillow", url, "web_search"),
  redfin: (url: string) => createSource("Redfin", url, "web_search"),
  linkup: (url: string) => createSource("Linkup", url, "web_search"),
  webSearch: (url: string) => createSource("Web Search", url, "web_search"),
  estimate: (methodology: string) =>
    createSource("Calculated Estimate", "", "estimate"),
}
