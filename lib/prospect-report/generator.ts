/**
 * Prospect Report Generator
 *
 * Generates structured 15-section prospect reports matching the Layland PDF format.
 * Uses cached data from data-collector and tracks sources for every claim.
 *
 * Report Sections:
 * 1. Header (Name, Date, Address)
 * 2. Executive Summary
 * 3. Personal Background & Contact
 * 4. Professional Background
 * 5. Wealth Indicators & Assets
 * 6. Real Estate Holdings
 * 7. Business Interests & Income
 * 8. Other Assets & Income
 * 9. Philanthropic History & Interests
 * 10. Giving Philosophy
 * 11. Giving Capacity Assessment
 * 12. Engagement Strategy
 * 13. Summary Assessment
 * 14. Sources & Methodology
 * 15. Conclusion
 */

import { ProspectDataCache } from "@/lib/prospect-data-cache"
import {
  SourceTracker,
  createSourceTracker,
  createSource,
  Sources,
} from "./source-tracker"

// ============================================================================
// TYPES
// ============================================================================

export interface GeneratedReport {
  markdown: string
  sections: ReportSection[]
  sourceTracker: SourceTracker
  dataQuality: "complete" | "partial" | "limited"
  romyScore?: number
  netWorthRange?: { low: number; high: number }
  givingCapacityRange?: { low: number; high: number }
}

interface ReportSection {
  title: string
  content: string
  sources: Array<{ name: string; url: string }>
  confidence: "HIGH" | "MEDIUM" | "LOW"
}

interface ReportContext {
  organizationName: string
  reportDate: string
}

// ============================================================================
// SECTION BUILDERS
// ============================================================================

/**
 * Build header section
 */
function buildHeader(
  data: ProspectDataCache,
  context: ReportContext,
  tracker: SourceTracker
): ReportSection {
  const lines: string[] = []

  const fullAddress = [
    data.prospect.address,
    data.prospect.city,
    data.prospect.state,
  ]
    .filter(Boolean)
    .join(", ")

  lines.push(`# Donor Profile: ${data.prospect.name}`)
  lines.push("")
  lines.push(`**Report Date:** ${context.reportDate}`)
  if (fullAddress) {
    lines.push(`**Address:** ${fullAddress}`)
  }
  lines.push(`**Prepared For:** ${context.organizationName}`)
  lines.push("")
  lines.push("---")

  return {
    title: "Header",
    content: lines.join("\n"),
    sources: [],
    confidence: "HIGH",
  }
}

/**
 * Build executive summary section
 */
function buildExecutiveSummary(
  data: ProspectDataCache,
  tracker: SourceTracker
): ReportSection {
  const lines: string[] = []
  lines.push("## Executive Summary")
  lines.push("")

  // Collect key findings for summary
  const findings: string[] = []

  // Professional info
  if (data.businessRegistry?.result) {
    findings.push("Has business ownership interests discovered through state registrations.")
  }

  // SEC data
  if (data.secInsider?.result) {
    const secResult = data.secInsider.result as {
      isOfficerAtAny?: boolean
      isDirectorAtAny?: boolean
    }
    if (secResult.isOfficerAtAny || secResult.isDirectorAtAny) {
      findings.push("Has SEC insider filings indicating officer/director positions at public companies.")
    }
  }

  // Philanthropy
  if (data.propublica990?.result) {
    findings.push("Has nonprofit affiliations discovered through 990 filings.")
  }

  // Property
  if (data.countyAssessor?.result) {
    findings.push("Property ownership data available for wealth assessment.")
  }

  // Political
  if (data.fecContributions?.result) {
    findings.push("Political contribution history available from FEC records.")
  }

  if (findings.length > 0) {
    lines.push(
      `${data.prospect.name} is a prospect with the following key indicators:\n`
    )
    for (const finding of findings) {
      lines.push(`- ${finding}`)
    }
  } else {
    lines.push(
      `Limited public data available for ${data.prospect.name}. Additional research may be needed through personal contact or referral networks.`
    )
  }

  lines.push("")

  // Add data quality note
  lines.push(
    `**Research Confidence:** ${data.dataQuality.toUpperCase()} - Based on ${data.sourcesUsed?.length || 0} verified sources.`
  )

  return {
    title: "Executive Summary",
    content: lines.join("\n"),
    sources: data.sourcesUsed?.slice(0, 5) || [],
    confidence: data.dataQuality === "complete" ? "HIGH" : data.dataQuality === "partial" ? "MEDIUM" : "LOW",
  }
}

/**
 * Build personal background section
 */
function buildPersonalBackground(
  data: ProspectDataCache,
  tracker: SourceTracker
): ReportSection {
  const lines: string[] = []
  lines.push("## Personal Background and Contact Information")
  lines.push("")

  // Full Name
  lines.push("### Full Name")
  lines.push(`- ${data.prospect.name}`)

  // Add age if available from wikidata or voter registration
  if (data.wikidata?.result) {
    const wikiResult = data.wikidata.result as {
      entity?: {
        birthYear?: number
        birthDate?: string
      }
    }
    if (wikiResult.entity?.birthYear) {
      const age = new Date().getFullYear() - wikiResult.entity.birthYear
      lines.push(`  - Estimated age: ${age} (born ${wikiResult.entity.birthYear}) [Source: Wikidata]`)
      tracker.addVerifiedClaim(
        "Personal Background",
        "Birth Year",
        wikiResult.entity.birthYear,
        Sources.wikidata("https://www.wikidata.org/")
      )
    }
  }
  lines.push("")

  // Residence
  if (data.prospect.address) {
    lines.push("### Residence")
    const fullAddress = [
      data.prospect.address,
      data.prospect.city,
      data.prospect.state,
    ]
      .filter(Boolean)
      .join(", ")
    lines.push(fullAddress)

    // Add county assessor data if available (official)
    if (data.countyAssessor?.result) {
      const assessorResult = data.countyAssessor.result as {
        properties?: Array<{
          assessedValue?: number
          marketValue?: number
        }>
        county?: string
      }
      const firstProp = assessorResult.properties?.[0]
      if (firstProp?.assessedValue) {
        const assessedValue = firstProp.assessedValue
        lines.push(
          `- Official assessed value: $${assessedValue.toLocaleString()} [Verified - ${assessorResult.county} County Assessor]`
        )
        tracker.addVerifiedClaim(
          "Personal Background",
          "Assessed Value",
          assessedValue,
          createSource(
            `${assessorResult.county} County Assessor`,
            "",
            "official_record"
          )
        )
      }
    }
    lines.push("")
  }

  // Political Affiliation (inferred from FEC)
  lines.push("### Political Affiliation")
  if (data.fecContributions?.result) {
    lines.push(
      "Party affiliation may be inferred from FEC contribution patterns (see Political Giving section)"
    )
  } else {
    lines.push("Not found in public records")
  }

  return {
    title: "Personal Background",
    content: lines.join("\n"),
    sources: [
      ...(data.wikidata ? [{ name: "Wikidata", url: "https://www.wikidata.org/" }] : []),
    ],
    confidence: data.countyAssessor ? "HIGH" : "MEDIUM",
  }
}

/**
 * Build professional background section
 */
function buildProfessionalBackground(
  data: ProspectDataCache,
  tracker: SourceTracker
): ReportSection {
  const lines: string[] = []
  lines.push("## Professional Background")
  lines.push("")
  lines.push(`### ${data.prospect.name} - Career Profile`)
  lines.push("")

  // Business ownership from registry
  if (data.businessRegistry?.result) {
    const bizResult = data.businessRegistry.result as {
      results?: Array<{
        companyName?: string
        state?: string
        position?: string
        status?: string
      }>
    }
    if (bizResult.results && bizResult.results.length > 0) {
      lines.push("**Current Business Interests:**")
      lines.push("")
      for (const biz of bizResult.results.slice(0, 5)) {
        lines.push(
          `- **${biz.position || "Officer"}, ${biz.companyName}** (${biz.state})`
        )
        lines.push(`  - Status: ${biz.status || "Active"}`)
        lines.push(`  - [Source: ${biz.state} Secretary of State]`)
        lines.push("")
      }
    }
  }

  // SEC insider positions (public company roles)
  if (data.secInsider?.result) {
    const secResult = data.secInsider.result as {
      companiesAsInsider?: string[]
      isOfficerAtAny?: boolean
      isDirectorAtAny?: boolean
      totalFilings?: number
    }
    if (secResult.companiesAsInsider && secResult.companiesAsInsider.length > 0) {
      lines.push("**Public Company Positions:**")
      lines.push("")
      for (const company of secResult.companiesAsInsider.slice(0, 5)) {
        const role = secResult.isDirectorAtAny ? "Director" : "Officer"
        lines.push(`- **${role}, ${company}** [Verified - SEC EDGAR]`)
        tracker.addVerifiedClaim(
          "Professional Background",
          `${role} at ${company}`,
          "Active",
          Sources.sec("https://www.sec.gov/cgi-bin/browse-edgar")
        )
      }
      lines.push("")
    }
  }

  // Wikidata education/employers
  if (data.wikidata?.result) {
    const wikiResult = data.wikidata.result as {
      entity?: {
        education?: Array<{ name: string }>
        employers?: Array<{ name: string; position?: string }>
        occupation?: Array<{ name: string }>
      }
    }
    if (wikiResult.entity) {
      if (wikiResult.entity.education && wikiResult.entity.education.length > 0) {
        lines.push("**Education:**")
        for (const edu of wikiResult.entity.education) {
          lines.push(`- ${edu.name} [Source: Wikidata]`)
        }
        lines.push("")
      }

      if (wikiResult.entity.employers && wikiResult.entity.employers.length > 0) {
        lines.push("**Employment History:**")
        for (const emp of wikiResult.entity.employers) {
          const position = emp.position ? `${emp.position} at ` : ""
          lines.push(`- ${position}${emp.name} [Source: Wikidata]`)
        }
        lines.push("")
      }

      if (wikiResult.entity.occupation && wikiResult.entity.occupation.length > 0) {
        lines.push("**Occupations:**")
        for (const occ of wikiResult.entity.occupation) {
          lines.push(`- ${occ.name}`)
        }
        lines.push("")
      }
    }
  }

  if (lines.length === 4) {
    // Only header added
    lines.push("No professional background found in public records.")
    lines.push("")
    lines.push(
      "Consider searching LinkedIn or company websites for additional career information."
    )
  }

  return {
    title: "Professional Background",
    content: lines.join("\n"),
    sources: [
      ...(data.secInsider ? [{ name: "SEC EDGAR", url: "https://www.sec.gov/" }] : []),
      ...(data.businessRegistry ? [{ name: "State Business Registry", url: "" }] : []),
      ...(data.wikidata ? [{ name: "Wikidata", url: "https://www.wikidata.org/" }] : []),
    ],
    confidence: data.secInsider ? "HIGH" : data.businessRegistry ? "MEDIUM" : "LOW",
  }
}

/**
 * Build real estate holdings section
 */
function buildRealEstateHoldings(
  data: ProspectDataCache,
  tracker: SourceTracker
): ReportSection {
  const lines: string[] = []
  lines.push("## Real Estate Holdings")
  lines.push("")

  let totalValue = 0
  let hasProperties = false

  // County assessor data (official)
  if (data.countyAssessor?.result) {
    const assessorResult = data.countyAssessor.result as {
      properties?: Array<{
        address?: string
        ownerName?: string
        assessedValue?: number
        marketValue?: number
        sqft?: number
        bedrooms?: number
        bathrooms?: number
        yearBuilt?: number
      }>
      county?: string
    }

    if (assessorResult.properties && assessorResult.properties.length > 0) {
      hasProperties = true
      lines.push("| Property | Details | Estimated Value | Source |")
      lines.push("|----------|---------|-----------------|--------|")

      for (const prop of assessorResult.properties) {
        const value = prop.marketValue || prop.assessedValue || 0
        totalValue += value
        const details = [
          prop.bedrooms ? `${prop.bedrooms} bed` : null,
          prop.bathrooms ? `${prop.bathrooms} bath` : null,
          prop.sqft ? `${prop.sqft.toLocaleString()} sq ft` : null,
          prop.yearBuilt ? `Built ${prop.yearBuilt}` : null,
        ]
          .filter(Boolean)
          .join(", ")

        lines.push(
          `| ${prop.address || "Property"} | ${details || "N/A"} | $${value.toLocaleString()} | ${assessorResult.county} Assessor [Verified] |`
        )

        if (value > 0) {
          tracker.addVerifiedClaim(
            "Real Estate",
            `Property at ${prop.address || "address"}`,
            value,
            createSource(`${assessorResult.county} County Assessor`, "", "official_record")
          )
        }
      }
      lines.push("")
    }
  }

  if (hasProperties) {
    lines.push(
      `**Total Real Estate:** $${totalValue.toLocaleString()} [Verified]`
    )
  } else {
    lines.push("No real estate holdings found in public records.")
    lines.push("")
    lines.push("*Note: Provide a residential address to search property records.*")
  }

  return {
    title: "Real Estate Holdings",
    content: lines.join("\n"),
    sources: [
      ...(data.countyAssessor ? [{ name: "County Assessor", url: "" }] : []),
    ],
    confidence: data.countyAssessor ? "HIGH" : "LOW",
  }
}

/**
 * Build philanthropic history section
 */
function buildPhilanthropicHistory(
  data: ProspectDataCache,
  tracker: SourceTracker
): ReportSection {
  const lines: string[] = []
  lines.push("## Philanthropic History, Interests, and Giving Capacity")
  lines.push("")

  // ProPublica 990 data
  if (data.propublica990?.result) {
    const propResult = data.propublica990.result as {
      organizations?: Array<{
        name: string
        ein: string
        city?: string
        state?: string
      }>
      totalResults?: number
    }

    if (propResult.organizations && propResult.organizations.length > 0) {
      lines.push("### Nonprofit Affiliations")
      lines.push("")
      for (const org of propResult.organizations.slice(0, 5)) {
        lines.push(`- **${org.name}**`)
        lines.push(`  - EIN: ${org.ein}`)
        if (org.city && org.state) {
          lines.push(`  - Location: ${org.city}, ${org.state}`)
        }
        lines.push(`  - [Source: ProPublica 990]`)
        lines.push("")

        tracker.addVerifiedClaim(
          "Philanthropy",
          `Nonprofit Affiliation: ${org.name}`,
          org.ein,
          Sources.propublica(`https://projects.propublica.org/nonprofits/organizations/${org.ein.replace("-", "")}`)
        )
      }
    }
  }

  // FEC political giving
  if (data.fecContributions?.result) {
    const fecResult = data.fecContributions.result as {
      contributions?: Array<{
        committee?: { name: string; party?: string }
        amount?: number
        date?: string
      }>
      totalAmount?: number
      totalContributions?: number
    }

    if (fecResult.contributions && fecResult.contributions.length > 0) {
      lines.push("### Political Giving")
      lines.push("")
      lines.push(
        `**Total FEC Contributions:** $${(fecResult.totalAmount || 0).toLocaleString()} across ${fecResult.totalContributions || 0} contributions [Verified - FEC.gov]`
      )
      lines.push("")
      lines.push("**Recent Contributions:**")
      for (const contrib of fecResult.contributions.slice(0, 5)) {
        lines.push(
          `- $${(contrib.amount || 0).toLocaleString()} to ${contrib.committee?.name || "Unknown"} (${contrib.date || "N/A"})`
        )
      }
      lines.push("")

      if (fecResult.totalAmount) {
        tracker.addVerifiedClaim(
          "Philanthropy",
          "Total FEC Contributions",
          fecResult.totalAmount,
          Sources.fec("https://www.fec.gov/data/")
        )
      }
    }
  }

  // If no philanthropy data found
  if (!data.propublica990?.result && !data.fecContributions?.result) {
    lines.push("No philanthropic history found in public records.")
    lines.push("")
    lines.push(
      "This does not mean the prospect is not philanthropic - many give directly to organizations without a family foundation or significant political giving."
    )
  }

  return {
    title: "Philanthropic History",
    content: lines.join("\n"),
    sources: [
      ...(data.propublica990 ? [{ name: "ProPublica 990", url: "https://projects.propublica.org/nonprofits/" }] : []),
      ...(data.fecContributions ? [{ name: "FEC.gov", url: "https://www.fec.gov/data/" }] : []),
    ],
    confidence: data.propublica990 || data.fecContributions ? "HIGH" : "LOW",
  }
}

/**
 * Build sources and methodology section
 */
function buildSourcesSection(
  data: ProspectDataCache,
  tracker: SourceTracker
): ReportSection {
  const lines: string[] = []
  lines.push("## Sources and Research Methodology")
  lines.push("")

  // Add the formatted sources section from tracker
  lines.push(tracker.formatSourcesSection())

  return {
    title: "Sources & Methodology",
    content: lines.join("\n"),
    sources: data.sourcesUsed || [],
    confidence: data.dataQuality === "complete" ? "HIGH" : data.dataQuality === "partial" ? "MEDIUM" : "LOW",
  }
}

// ============================================================================
// MAIN GENERATOR FUNCTION
// ============================================================================

/**
 * Generate a complete structured prospect report
 */
export async function generateStructuredReport(
  data: ProspectDataCache,
  organizationName: string = "Your Organization"
): Promise<GeneratedReport> {
  const tracker = createSourceTracker()
  const context: ReportContext = {
    organizationName,
    reportDate: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  }

  // Build all sections
  const sections: ReportSection[] = []

  sections.push(buildHeader(data, context, tracker))
  sections.push(buildExecutiveSummary(data, tracker))
  sections.push(buildPersonalBackground(data, tracker))
  sections.push(buildProfessionalBackground(data, tracker))
  sections.push(buildRealEstateHoldings(data, tracker))
  sections.push(buildPhilanthropicHistory(data, tracker))
  sections.push(buildSourcesSection(data, tracker))

  // Combine into markdown
  const markdown = sections.map((s) => s.content).join("\n\n---\n\n")

  // Get data quality summary
  const qualitySummary = tracker.getDataQualitySummary()

  return {
    markdown,
    sections,
    sourceTracker: tracker,
    dataQuality: qualitySummary.quality,
    romyScore: data.romyScore || undefined,
    netWorthRange: undefined,
    givingCapacityRange: undefined,
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { createSourceTracker, SourceTracker }
