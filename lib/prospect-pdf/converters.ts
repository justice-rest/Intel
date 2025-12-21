/**
 * Data Converters for Prospect PDF Generation
 *
 * Converts various data formats to ProspectReportData for PDF generation.
 */

import type { ProspectReportData } from "./template"

// ============================================================================
// TYPES
// ============================================================================

/**
 * Batch prospect item format (from batch-processing)
 */
export interface BatchProspectItem {
  input_data: {
    name: string
    address?: string
    full_address?: string
    city?: string
    state?: string
    zip?: string
    [key: string]: unknown
  }
  report_content?: string
  romy_score?: number
  romy_score_tier?: string
  capacity_rating?: string
  estimated_net_worth?: number
  estimated_gift_capacity?: number
  recommended_ask?: number
  sources_found?: Array<{ name: string; url: string }>
}

/**
 * Prospect data cache format (from prospect-data-cache)
 */
export interface ProspectDataCache {
  prospect: {
    name: string
    address?: string
    city?: string
    state?: string
  }
  dataQuality: "complete" | "partial" | "limited"
  sourcesUsed?: Array<{ name: string; url: string }>
  romyScore?: number
  propertyValuation?: { result?: unknown }
  countyAssessor?: { result?: unknown }
  businessRegistry?: { result?: unknown }
  secInsider?: { result?: unknown }
  fecContributions?: { result?: unknown }
  propublica990?: { result?: unknown }
  wikidata?: { result?: unknown }
  voterRegistration?: { result?: unknown }
  familyDiscovery?: { result?: unknown }
}

// ============================================================================
// MARKDOWN PARSER (for extracting sections from report_content)
// ============================================================================

/**
 * Extract a section from markdown report content
 */
function extractSection(content: string, sectionName: string): string {
  // Try to find section by heading
  const patterns = [
    new RegExp(`##\\s*${sectionName}[\\s\\S]*?(?=##|$)`, "i"),
    new RegExp(`###\\s*${sectionName}[\\s\\S]*?(?=###|##|$)`, "i"),
    new RegExp(`\\*\\*${sectionName}\\*\\*[:\\s]*([^\\n]+)`, "i"),
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) {
      // Clean up the extracted content
      let extracted = match[0]
        .replace(/^#+\s*[^\n]+\n/, "") // Remove heading
        .replace(/\*\*[^*]+\*\*/g, (m) => m.replace(/\*\*/g, "")) // Remove bold markers
        .trim()
      return extracted
    }
  }

  return ""
}

/**
 * Extract bullet points from a section
 */
function extractBulletPoints(content: string, sectionName: string): string[] {
  const section = extractSection(content, sectionName)
  if (!section) return []

  const bullets = section.match(/^[-*]\s+.+$/gm) || []
  return bullets.map((b) => b.replace(/^[-*]\s+/, "").trim())
}

/**
 * Format currency for display
 */
function formatCurrency(value: number | undefined): string {
  if (!value) return "Not available"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

// ============================================================================
// CONVERTERS
// ============================================================================

/**
 * Convert batch prospect item to ProspectReportData
 */
export function batchItemToReportData(
  item: BatchProspectItem,
  preparedFor?: string
): ProspectReportData {
  const { input_data, report_content = "" } = item

  // Build location string
  const location = [input_data.city, input_data.state]
    .filter(Boolean)
    .join(", ") || "Location not provided"

  // Extract sections from report content if available
  const executiveSummary =
    extractSection(report_content, "Executive Summary") ||
    extractSection(report_content, "Summary") ||
    "No executive summary available."

  const realEstateSection = extractSection(report_content, "Real Estate")
  const businessSection = extractSection(report_content, "Business")
  const philanthropicSection =
    extractSection(report_content, "Philanthropic") ||
    extractSection(report_content, "Giving")
  const engagementSection =
    extractSection(report_content, "Cultivation") ||
    extractSection(report_content, "Engagement")

  return {
    prospectName: input_data.name,
    location,
    reportDate: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    preparedFor,
    executiveSummary,
    personal: {
      fullName: input_data.name,
      currentLocation: location,
      primaryResidence:
        input_data.address || input_data.full_address || "Not available",
    },
    professional: {
      currentPositions: extractSection(report_content, "Current Position"),
      careerTrajectory: extractSection(report_content, "Career"),
      education: extractSection(report_content, "Education"),
    },
    realEstate: {
      primaryResidence: realEstateSection || "See wealth indicators section.",
    },
    businessInterests: {
      currentEquity: businessSection || "See wealth indicators section.",
    },
    otherAssets: {},
    lifestyleIndicators: {
      netWorthAssessment: item.estimated_net_worth
        ? `Estimated Net Worth: ${formatCurrency(item.estimated_net_worth)}`
        : "Not assessed",
    },
    philanthropic: {
      documentedInterests: philanthropicSection || "Not found in public records.",
    },
    givingCapacity: {
      recommendedAskRange: item.recommended_ask
        ? formatCurrency(item.recommended_ask)
        : "Not assessed",
      singleGift: item.estimated_gift_capacity
        ? formatCurrency(item.estimated_gift_capacity)
        : undefined,
      basis: item.romy_score
        ? `Based on RōmyScore™ of ${item.romy_score}/41 (${item.romy_score_tier || ""})`
        : undefined,
    },
    engagement: {
      positioningPoints: extractBulletPoints(report_content, "Positioning"),
    },
    summary: {
      prospectGrade: item.capacity_rating || "Not assessed",
      priorityLevel: item.romy_score_tier || "Not assessed",
      strategicValue: engagementSection || undefined,
    },
    sources: {
      otherSources: item.sources_found?.map((s) => s.name) || [],
    },
    conclusion:
      extractSection(report_content, "Conclusion") ||
      `${input_data.name} has been analyzed using available public data sources. For detailed engagement strategy, please review the full research report.`,
  }
}

/**
 * Convert prospect data cache to ProspectReportData
 */
export function cacheToReportData(
  cache: ProspectDataCache,
  preparedFor?: string
): ProspectReportData {
  const { prospect, dataQuality, sourcesUsed = [] } = cache

  const location = [prospect.city, prospect.state].filter(Boolean).join(", ") ||
    "Location not provided"

  // Extract property info
  let primaryResidence = "Not found in public records."
  if (cache.propertyValuation?.result || cache.countyAssessor?.result) {
    const propData = (cache.propertyValuation?.result ||
      cache.countyAssessor?.result) as {
      address?: string
      estimatedValue?: number
      assessedValue?: number
    }
    if (propData.address) {
      primaryResidence = `${propData.address} - Est. Value: ${formatCurrency(propData.estimatedValue || propData.assessedValue)}`
    }
  }

  // Extract business info
  let businessInfo = "No business interests found."
  if (cache.businessRegistry?.result) {
    const bizData = cache.businessRegistry.result as {
      results?: Array<{ companyName?: string; position?: string }>
    }
    if (bizData.results && bizData.results.length > 0) {
      businessInfo = bizData.results
        .slice(0, 3)
        .map((b) => `${b.position || "Officer"} at ${b.companyName}`)
        .join("; ")
    }
  }

  // Extract FEC info
  let politicalGiving = "No federal contributions found."
  if (cache.fecContributions?.result) {
    const fecData = cache.fecContributions.result as {
      totalAmount?: number
      totalContributions?: number
    }
    if (fecData.totalAmount) {
      politicalGiving = `Total FEC Contributions: ${formatCurrency(fecData.totalAmount)} (${fecData.totalContributions || 0} contributions)`
    }
  }

  // Extract nonprofit info
  let nonprofitInfo = "No nonprofit affiliations found."
  if (cache.propublica990?.result) {
    const npData = cache.propublica990.result as {
      organizations?: Array<{ name: string }>
    }
    if (npData.organizations && npData.organizations.length > 0) {
      nonprofitInfo = npData.organizations
        .slice(0, 3)
        .map((o) => o.name)
        .join(", ")
    }
  }

  return {
    prospectName: prospect.name,
    location,
    reportDate: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    preparedFor,
    executiveSummary: `${prospect.name} is a prospect with ${dataQuality} data coverage. Research was conducted using ${sourcesUsed.length} verified sources.`,
    personal: {
      fullName: prospect.name,
      currentLocation: location,
      primaryResidence: prospect.address || "Not available",
    },
    professional: {
      currentPositions: businessInfo,
    },
    realEstate: {
      primaryResidence,
    },
    businessInterests: {
      currentEquity: businessInfo,
    },
    otherAssets: {},
    lifestyleIndicators: {},
    philanthropic: {
      documentedInterests: nonprofitInfo,
      annualVolume: {
        documented: politicalGiving,
      },
    },
    givingCapacity: {
      recommendedAskRange: "Assessment pending",
      basis: `Data quality: ${dataQuality.toUpperCase()}`,
    },
    engagement: {},
    summary: {
      prospectGrade: dataQuality === "complete" ? "A" : dataQuality === "partial" ? "B" : "C",
    },
    sources: {
      otherSources: sourcesUsed.map((s) => s.name),
    },
    researchLimitations:
      dataQuality === "limited"
        ? "Limited public data available. Additional research recommended."
        : undefined,
    conclusion: `Research for ${prospect.name} is ${dataQuality}. Further cultivation recommended to gather additional insights.`,
  }
}

/**
 * Create minimal report data from basic prospect info
 */
export function createMinimalReportData(
  name: string,
  options?: {
    location?: string
    address?: string
    preparedFor?: string
  }
): ProspectReportData {
  return {
    prospectName: name,
    location: options?.location || "Location not provided",
    reportDate: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    preparedFor: options?.preparedFor,
    executiveSummary: `Donor profile for ${name}. Additional research recommended to complete assessment.`,
    personal: {
      fullName: name,
      currentLocation: options?.location,
      primaryResidence: options?.address,
    },
    professional: {},
    realEstate: {},
    businessInterests: {},
    otherAssets: {},
    lifestyleIndicators: {},
    philanthropic: {},
    givingCapacity: {
      recommendedAskRange: "Assessment pending",
    },
    engagement: {},
    summary: {},
  }
}
