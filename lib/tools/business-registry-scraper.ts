/**
 * Business Registry Search Tool
 *
 * AI tool for searching business registries using the BEST available source.
 *
 * Priority order:
 * 1. State Open Data APIs (FREE, reliable)
 *    - Colorado: data.colorado.gov
 *    - New York: data.ny.gov
 * 2. OpenCorporates API (comprehensive, FREE for nonprofits)
 *    - All 50 US states + 140+ international jurisdictions
 * 3. Web scraping (fallback)
 *    - Florida, California (fallback only)
 *
 * Features:
 * - Automatic source selection based on availability
 * - Company name search
 * - Officer/director search (find person's business affiliations)
 * - Returns sources array for SourcesList UI component
 */

import { tool } from "ai"
import { z } from "zod"
import {
  searchBusinesses,
  searchByOfficer,
  getDataSourcesStatus,
  getReliableStates,
  type ScrapedBusinessEntity,
} from "@/lib/scraper"

// ============================================================================
// TYPES
// ============================================================================

interface ToolSource {
  name: string
  url: string
  snippet: string
}

export interface BusinessRegistrySearchResult {
  answer: string
  sources: ToolSource[]
  query: string
  searchType: "company" | "officer"
  results: ScrapedBusinessEntity[]
  sourcesUsed: Array<{
    state: string
    source: string
    success: boolean
    count: number
    error?: string
  }>
  totalFound: number
  duration: number
  error?: string
  warnings?: string[]
}

// ============================================================================
// SCHEMAS
// ============================================================================

const businessRegistrySearchSchema = z.object({
  query: z
    .string()
    .describe(
      "Company name OR person name to search. " +
      "For companies: Use full legal name (e.g., 'Apple Inc', 'Blackstone Group'). " +
      "For officers: Use 'First Last' format (e.g., 'Tim Cook', 'John Smith')."
    ),
  searchType: z
    .enum(["company", "officer"])
    .optional()
    .default("company")
    .describe(
      "Search type: 'company' finds business entities, 'officer' finds person's corporate positions."
    ),
  states: z
    .array(z.string())
    .optional()
    .describe(
      "Specific US states to search (e.g., ['CA', 'DE', 'NY']). " +
      "Leave empty to search all available sources. " +
      "Add 'DE' for Fortune 500 companies (65% are registered there)."
    ),
  limit: z
    .number()
    .optional()
    .default(20)
    .describe("Maximum results to return (default: 20, max: 50)"),
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert business entity to source for UI
 */
function businessToSource(business: ScrapedBusinessEntity): ToolSource {
  const statusText = business.status
    ? `${business.status}${business.incorporationDate ? ` since ${business.incorporationDate}` : ""}`
    : business.incorporationDate
      ? `Formed ${business.incorporationDate}`
      : "Status unknown"

  return {
    name: `${business.name} (${business.jurisdiction.toUpperCase().replace("US_", "")})`,
    url: business.sourceUrl,
    snippet: `${statusText}. ${business.entityType || "Business entity"}${business.registeredAddress ? ` • ${business.registeredAddress}` : ""}`,
  }
}

/**
 * Format company search answer for AI
 */
function formatCompanyAnswer(
  query: string,
  results: ScrapedBusinessEntity[],
  sourcesUsed: Array<{ state: string; source: string; success: boolean; count: number; error?: string }>
): string {
  const successfulSources = sourcesUsed.filter((s) => s.success)
  const failedSources = sourcesUsed.filter((s) => !s.success)

  if (results.length === 0) {
    const lines: string[] = []
    lines.push(`## No Results Found for "${query}"\n`)

    if (failedSources.length > 0) {
      lines.push("**Sources checked:**")
      failedSources.forEach((s) => {
        lines.push(`- ${s.state}: ${s.error || "No results"}`)
      })
      lines.push("")
    }

    lines.push("**Suggestions:**")
    lines.push("- Try different search terms or spelling variations")
    lines.push("- Only CO, NY, FL state registries are supported (free APIs)")
    lines.push("- Use `searchWeb` tool for broader web search results")

    return lines.join("\n")
  }

  const lines: string[] = []
  lines.push(`## Business Registry Results for "${query}"\n`)
  lines.push(`**Sources:** ${successfulSources.map((s) => s.source).join(", ")}`)
  lines.push(`**Total Found:** ${results.length} companies\n`)

  // Group by status
  const active = results.filter((b) =>
    b.status?.toLowerCase().includes("active") ||
    b.status?.toLowerCase().includes("good standing") ||
    !b.status?.toLowerCase().includes("inactive")
  )
  const inactive = results.filter((b) =>
    b.status?.toLowerCase().includes("inactive") ||
    b.status?.toLowerCase().includes("dissolved") ||
    b.status?.toLowerCase().includes("delinquent")
  )

  if (active.length > 0) {
    lines.push("### Active Companies\n")
    active.slice(0, 10).forEach((b, i) => {
      lines.push(`${i + 1}. **${b.name}**`)
      lines.push(`   - Jurisdiction: ${b.jurisdiction.toUpperCase().replace("US_", "")}`)
      if (b.entityNumber) lines.push(`   - Entity #: ${b.entityNumber}`)
      if (b.status) lines.push(`   - Status: ${b.status}`)
      if (b.incorporationDate) lines.push(`   - Formed: ${b.incorporationDate}`)
      if (b.entityType) lines.push(`   - Type: ${b.entityType}`)
      if (b.registeredAddress) lines.push(`   - Address: ${b.registeredAddress}`)
      if (b.registeredAgent) lines.push(`   - Agent: ${b.registeredAgent}`)
      if (b.officers && b.officers.length > 0) {
        lines.push(`   - Officers: ${b.officers.slice(0, 3).map((o) => `${o.name} (${o.position})`).join(", ")}${b.officers.length > 3 ? ` +${b.officers.length - 3} more` : ""}`)
      }
      lines.push("")
    })
  }

  if (inactive.length > 0 && active.length < 5) {
    lines.push("### Inactive/Dissolved Companies\n")
    inactive.slice(0, 5).forEach((b, i) => {
      lines.push(`${i + 1}. **${b.name}** - ${b.status || "Inactive"}`)
      lines.push(`   - Jurisdiction: ${b.jurisdiction.toUpperCase().replace("US_", "")}`)
      if (b.incorporationDate) lines.push(`   - Formed: ${b.incorporationDate}`)
      lines.push("")
    })
  }

  // Add source status
  if (failedSources.length > 0) {
    lines.push("### Sources with Issues\n")
    failedSources.forEach((s) => {
      lines.push(`- ${s.state}: ${s.error}`)
    })
    lines.push("")
  }

  // Wealth indicators
  lines.push("### Wealth Indicators\n")
  const jurisdictions = new Set(results.map((b) => b.jurisdiction.toLowerCase()))

  if (active.length >= 5) {
    lines.push("- **HIGH** - Multiple active business registrations suggest significant entrepreneurial activity")
  } else if (active.length >= 2) {
    lines.push("- **MODERATE** - Multiple active businesses indicate business involvement")
  } else if (active.length === 1) {
    lines.push("- **POTENTIAL** - One active business found")
  }

  if (jurisdictions.has("us_de")) {
    lines.push("- Delaware registration suggests sophisticated legal/tax planning")
  }

  return lines.join("\n")
}

/**
 * Format officer search answer for AI
 */
function formatOfficerAnswer(
  query: string,
  results: ScrapedBusinessEntity[],
  sourcesUsed: Array<{ state: string; source: string; success: boolean; count: number; error?: string }>
): string {
  const successfulSources = sourcesUsed.filter((s) => s.success)

  if (results.length === 0) {
    const lines: string[] = []
    lines.push(`## No Officer Positions Found for "${query}"\n`)
    lines.push("**Suggestions:**")
    lines.push("- Try full name variations (with/without middle name)")
    lines.push("- Use `sec_insider_search` for public company officer positions")
    lines.push("- Only Colorado agent search is available (CO Open Data API)")
    lines.push("- Use `searchWeb` for broader web search results")
    return lines.join("\n")
  }

  const lines: string[] = []
  lines.push(`## Corporate Positions for "${query}"\n`)
  lines.push(`**Sources:** ${successfulSources.map((s) => s.source).join(", ")}`)
  lines.push(`**Companies Found:** ${results.length}\n`)

  // List companies with officer info
  results.slice(0, 15).forEach((b, i) => {
    lines.push(`${i + 1}. **${b.name}** (${b.jurisdiction.toUpperCase().replace("US_", "")})`)
    if (b.status) lines.push(`   - Status: ${b.status}`)
    if (b.officers && b.officers.length > 0) {
      b.officers.forEach((o) => {
        lines.push(`   - ${o.position}${o.startDate ? ` (since ${o.startDate})` : ""}`)
      })
    }
    lines.push("")
  })

  // Wealth indicators
  lines.push("### Wealth Indicators\n")
  const uniqueCompanies = results.length

  if (uniqueCompanies >= 5) {
    lines.push("- **HIGH** - Multiple corporate affiliations suggest significant business involvement")
  } else if (uniqueCompanies >= 2) {
    lines.push("- **MODERATE** - Multiple business relationships found")
  } else if (uniqueCompanies === 1) {
    lines.push("- **POTENTIAL** - One business affiliation found")
  }

  return lines.join("\n")
}

// ============================================================================
// TOOL
// ============================================================================

export const businessRegistryScraperTool = tool({
  description:
    "Search business registries for company ownership and corporate officer positions. " +
    "**BEST SOURCES (in order):** " +
    "1) Colorado & New York Open Data APIs (FREE, reliable). " +
    "2) OpenCorporates API - all 50 US states (FREE for nonprofits). " +
    "3) Web scraping for FL, CA, DE (fallback). " +
    "**COMPANY SEARCH:** Find business entities, registration status, officers. " +
    "**OFFICER SEARCH:** Find a person's corporate positions and affiliations. " +
    "Delaware hosts 65% of Fortune 500 companies.",
  parameters: businessRegistrySearchSchema,
  execute: async ({
    query,
    searchType = "company",
    states,
    limit = 20,
  }): Promise<BusinessRegistrySearchResult> => {
    console.log("[Business Registry] Starting search:", { query, searchType, states })
    const startTime = Date.now()

    // Validate query
    if (!query || query.trim().length < 2) {
      return {
        answer: "Please provide a valid search query (at least 2 characters).",
        sources: [],
        query,
        searchType,
        results: [],
        sourcesUsed: [],
        totalFound: 0,
        duration: Date.now() - startTime,
        error: "Invalid query",
      }
    }

    try {
      let result: Awaited<ReturnType<typeof searchBusinesses>>

      if (searchType === "officer") {
        result = await searchByOfficer(query, {
          states,
          limit: Math.min(limit, 50),
        })
      } else {
        result = await searchBusinesses(query, {
          states,
          limit: Math.min(limit, 50),
        })
      }

      // Convert results to UI sources
      const uiSources = result.results.slice(0, 20).map(businessToSource)

      // Generate answer
      const answer = searchType === "officer"
        ? formatOfficerAnswer(query, result.results, result.sources)
        : formatCompanyAnswer(query, result.results, result.sources)

      // Collect warnings
      const warnings: string[] = []
      const failedSources = result.sources.filter((s) => !s.success && s.error)
      if (failedSources.length > 0) {
        failedSources.forEach((s) => {
          if (s.error && !s.error.includes("API key not configured")) {
            warnings.push(`${s.state}: ${s.error}`)
          }
        })
      }

      console.log(`[Business Registry] Completed in ${result.duration}ms. Found ${result.totalFound} results.`)

      return {
        answer,
        sources: uiSources,
        query,
        searchType,
        results: result.results,
        sourcesUsed: result.sources,
        totalFound: result.totalFound,
        duration: result.duration,
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error("[Business Registry] Error:", errorMessage)

      // Provide manual search links as fallback
      const manualLinks: ToolSource[] = [
        { name: "Florida Sunbiz", url: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName", snippet: "Florida Division of Corporations" },
        { name: "New York DOS", url: "https://apps.dos.ny.gov/publicInquiry/", snippet: "New York Department of State" },
        { name: "Delaware ICIS", url: "https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx", snippet: "Delaware (65% of Fortune 500)" },
        { name: "California bizfile", url: "https://bizfileonline.sos.ca.gov/search/business", snippet: "California Secretary of State" },
        { name: "Colorado SOS", url: "https://www.sos.state.co.us/biz/BusinessEntityCriteriaExt.do", snippet: "Colorado Secretary of State" },
      ]

      return {
        answer: `## Search Error\n\n${errorMessage}\n\n**Manual Search:**\nUse the sources below to search directly.`,
        sources: manualLinks,
        query,
        searchType,
        results: [],
        sourcesUsed: [],
        totalFound: 0,
        duration: Date.now() - startTime,
        error: errorMessage,
      }
    }
  },
})

/**
 * Get status of available data sources
 */
export function getBusinessRegistryStatus(): ReturnType<typeof getDataSourcesStatus> {
  return getDataSourcesStatus()
}

/**
 * Check if business registry tool should be enabled
 * Always enabled - provides fallback links even when APIs unavailable
 */
export function shouldEnableBusinessRegistryScraperTool(): boolean {
  return true
}

/**
 * Check if full functionality is available
 * Returns true since we use free state APIs (CO, NY, FL)
 */
export function isBusinessRegistryFullyAvailable(): boolean {
  return getReliableStates().length > 0
}
