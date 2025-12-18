/**
 * Business Registry Scraper Tool
 *
 * AI tool for searching business registries using web scraping.
 * Uses playwright-extra with stealth plugin to bypass bot detection.
 *
 * Features:
 * - OpenCorporates web scraping (when no API key configured)
 * - State Secretary of State registries:
 *   - Florida (Sunbiz) - Most reliable
 *   - New York (DOS) - Uses Open Data API (FREE)
 *   - California (bizfile)
 *   - Delaware (ICIS) - Has CAPTCHA warning
 *
 * UI Integration:
 * - Returns sources array in Linkup-compatible format for SourcesList component
 * - Provides rawContent for AI consumption
 * - Includes answer field for synthesized results
 */

import { tool } from "ai"
import { z } from "zod"
import {
  scrapeBusinessRegistry,
  scrapeOpenCorporatesCompanies,
  scrapeOpenCorporatesOfficers,
  scrapeOpenCorporatesCompanyDetails,
  type ScrapedBusinessEntity,
  type ScrapedOfficer,
  type ScraperSource,
  isScrapingEnabled,
  isPlaywrightAvailable,
} from "@/lib/scraper"
import { isOpenCorporatesEnabled } from "@/lib/opencorporates/config"

// ============================================================================
// TYPES (matching Linkup format for UI compatibility)
// ============================================================================

interface ScraperToolSource {
  name: string
  url: string
  snippet: string
}

export interface BusinessRegistrySearchResult {
  // Main answer text (for AI and streaming)
  answer: string
  // Sources for SourcesList UI component (Linkup-compatible format)
  sources: ScraperToolSource[]
  // Original query
  query: string
  // Search type
  searchType: "company" | "officer"
  // Detailed results for AI
  results: Array<ScrapedBusinessEntity | ScrapedOfficer>
  // Source metadata
  sourcesSearched: ScraperSource[]
  sourcesSuccessful: ScraperSource[]
  sourcesFailed: ScraperSource[]
  // Stats
  totalFound: number
  // Error info
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
      "For companies: Use full legal name (e.g., 'Apple Inc', 'Blackstone Group LP'). " +
      "For officers: Use 'First Last' format (e.g., 'Tim Cook', 'John Smith')."
    ),
  searchType: z
    .enum(["company", "officer"])
    .optional()
    .default("company")
    .describe(
      "Search type: 'company' finds business entities, 'officer' finds person's corporate positions. " +
      "Use 'officer' to discover someone's business affiliations and board seats."
    ),
  sources: z
    .array(z.enum(["opencorporates", "florida", "newYork", "california", "delaware"]))
    .optional()
    .describe(
      "Specific registries to search. Default: opencorporates + florida + newYork. " +
      "Add 'delaware' for Fortune 500 companies (65% are registered there). " +
      "Add 'california' for tech companies."
    ),
  jurisdiction: z
    .string()
    .optional()
    .describe(
      "Limit to specific state: 'us_de' (Delaware), 'us_fl' (Florida), 'us_ny' (New York), " +
      "'us_ca' (California). Leave empty to search all."
    ),
  limit: z
    .number()
    .optional()
    .default(15)
    .describe("Maximum results per source (default: 15, max: 30)"),
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert scraped business to source format for UI
 */
function businessToSource(business: ScrapedBusinessEntity): ScraperToolSource {
  const statusText = business.status
    ? `${business.status}${business.incorporationDate ? ` since ${business.incorporationDate}` : ""}`
    : business.incorporationDate
      ? `Formed ${business.incorporationDate}`
      : "Status unknown"

  return {
    name: `${business.name} (${business.jurisdiction.toUpperCase()})`,
    url: business.sourceUrl,
    snippet: `${statusText}. ${business.entityType || "Business entity"}${business.registeredAddress ? ` at ${business.registeredAddress}` : ""}`,
  }
}

/**
 * Convert scraped officer to source format for UI
 */
function officerToSource(officer: ScrapedOfficer): ScraperToolSource {
  const statusText = officer.current ? "Current" : "Former"
  const dateText = officer.startDate ? ` (since ${officer.startDate})` : ""

  return {
    name: `${officer.companyName} - ${officer.position}`,
    url: officer.sourceUrl,
    snippet: `${statusText} ${officer.position} at ${officer.companyName}${dateText}. Jurisdiction: ${officer.jurisdiction.toUpperCase()}`,
  }
}

/**
 * Format company results for AI
 */
function formatCompanyAnswer(
  query: string,
  results: ScrapedBusinessEntity[],
  sources: { searched: ScraperSource[]; successful: ScraperSource[]; failed: ScraperSource[] }
): string {
  if (results.length === 0) {
    return `No companies found matching "${query}" in ${sources.searched.join(", ")}.\n\n` +
      "**Suggestions:**\n" +
      "- Try different search terms or spelling variations\n" +
      "- Search additional states (add 'delaware' or 'california')\n" +
      "- Use searchWeb tool for broader results"
  }

  const lines: string[] = []
  lines.push(`## Business Registry Results for "${query}"\n`)
  lines.push(`**Sources:** ${sources.successful.length > 0 ? sources.successful.join(", ") : "None successful"}`)
  lines.push(`**Total Found:** ${results.length} companies\n`)

  // Group by status
  const active = results.filter((b) =>
    b.status?.toLowerCase().includes("active") ||
    !b.status?.toLowerCase().includes("inactive")
  )
  const inactive = results.filter((b) =>
    b.status?.toLowerCase().includes("inactive") ||
    b.status?.toLowerCase().includes("dissolved")
  )

  if (active.length > 0) {
    lines.push("### Active Companies\n")
    active.slice(0, 10).forEach((b, i) => {
      lines.push(`${i + 1}. **${b.name}**`)
      lines.push(`   - Jurisdiction: ${b.jurisdiction.toUpperCase()}`)
      if (b.entityNumber) lines.push(`   - Entity #: ${b.entityNumber}`)
      if (b.status) lines.push(`   - Status: ${b.status}`)
      if (b.incorporationDate) lines.push(`   - Formed: ${b.incorporationDate}`)
      if (b.entityType) lines.push(`   - Type: ${b.entityType}`)
      if (b.registeredAddress) lines.push(`   - Address: ${b.registeredAddress}`)
      if (b.registeredAgent) lines.push(`   - Agent: ${b.registeredAgent}`)
      if (b.officers && b.officers.length > 0) {
        lines.push(`   - Officers: ${b.officers.map((o) => `${o.name} (${o.position})`).join(", ")}`)
      }
      lines.push("")
    })
  }

  if (inactive.length > 0 && active.length < 5) {
    lines.push("### Inactive/Dissolved Companies\n")
    inactive.slice(0, 5).forEach((b, i) => {
      lines.push(`${i + 1}. **${b.name}** - ${b.status || "Inactive"}`)
      lines.push(`   - Jurisdiction: ${b.jurisdiction.toUpperCase()}`)
      if (b.incorporationDate) lines.push(`   - Formed: ${b.incorporationDate}`)
      lines.push("")
    })
  }

  // Prospect research insights
  lines.push("### Wealth Indicators\n")
  const jurisdictions = new Set(results.map((b) => b.jurisdiction))

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
  if (jurisdictions.has("us_nv")) {
    lines.push("- Nevada registration may indicate privacy preferences")
  }

  return lines.join("\n")
}

/**
 * Format officer results for AI
 */
function formatOfficerAnswer(
  query: string,
  results: ScrapedOfficer[],
  sources: { searched: ScraperSource[]; successful: ScraperSource[]; failed: ScraperSource[] }
): string {
  if (results.length === 0) {
    return `No officer/director positions found for "${query}" in ${sources.searched.join(", ")}.\n\n` +
      "**Suggestions:**\n" +
      "- Try full name variations (with/without middle name)\n" +
      "- Use sec_insider_search for public company positions\n" +
      "- Use searchWeb for broader results"
  }

  const lines: string[] = []
  lines.push(`## Corporate Positions for "${query}"\n`)
  lines.push(`**Sources:** ${sources.successful.length > 0 ? sources.successful.join(", ") : "None successful"}`)
  lines.push(`**Total Positions Found:** ${results.length}\n`)

  // Group by current/former
  const current = results.filter((o) => o.current)
  const former = results.filter((o) => !o.current)

  // Group current by company
  const currentByCompany = new Map<string, ScrapedOfficer[]>()
  current.forEach((o) => {
    const key = o.companyName
    if (!currentByCompany.has(key)) currentByCompany.set(key, [])
    currentByCompany.get(key)!.push(o)
  })

  if (currentByCompany.size > 0) {
    lines.push("### Current Positions\n")
    let i = 1
    for (const [company, positions] of currentByCompany) {
      lines.push(`${i}. **${company}** (${positions[0].jurisdiction.toUpperCase()})`)
      positions.forEach((p) => {
        lines.push(`   - ${p.position}${p.startDate ? ` since ${p.startDate}` : ""}`)
      })
      lines.push("")
      i++
      if (i > 10) break
    }
  }

  if (former.length > 0 && current.length < 5) {
    lines.push("### Former Positions\n")
    const formerByCompany = new Map<string, ScrapedOfficer[]>()
    former.forEach((o) => {
      const key = o.companyName
      if (!formerByCompany.has(key)) formerByCompany.set(key, [])
      formerByCompany.get(key)!.push(o)
    })

    let i = 1
    for (const [company, positions] of formerByCompany) {
      lines.push(`${i}. **${company}** - ${positions.map((p) => p.position).join(", ")}`)
      lines.push("")
      i++
      if (i > 5) break
    }
  }

  // Prospect research insights
  lines.push("### Wealth Indicators\n")
  const uniqueCompanies = new Set(results.map((o) => o.companyName))

  if (current.length >= 5) {
    lines.push("- **HIGH** - Multiple current corporate leadership positions indicate significant influence and likely wealth")
  } else if (current.length >= 2) {
    lines.push("- **MODERATE** - Multiple active positions suggest established business leader")
  } else if (current.length === 1) {
    lines.push("- **POTENTIAL** - One current corporate position found")
  }

  if (uniqueCompanies.size >= 5) {
    lines.push(`- Portfolio includes ${uniqueCompanies.size}+ companies (current and former)`)
  }

  // Look for director vs officer roles
  const directorRoles = results.filter((o) =>
    o.position.toLowerCase().includes("director") ||
    o.position.toLowerCase().includes("board")
  )
  if (directorRoles.length >= 2) {
    lines.push("- Multiple board/director positions suggest high-level executive profile")
  }

  return lines.join("\n")
}

// ============================================================================
// TOOL
// ============================================================================

export const businessRegistryScraperTool = tool({
  description:
    "Search business registries for company ownership and corporate officer positions. " +
    "Uses State Secretary of State databases (FL, NY, CA, DE) + OpenCorporates (may have CAPTCHA). " +
    "**RECOMMENDED:** NY Open Data API (FREE, reliable) and Florida Sunbiz (most accessible). " +
    "**COMPANY SEARCH:** Find business entities, registration status, incorporation dates, officers. " +
    "**OFFICER SEARCH:** Find a person's corporate positions, board seats, business affiliations. " +
    "Returns results from multiple registries in parallel. Delaware hosts 65% of Fortune 500 companies. " +
    "**NOTE:** OpenCorporates has CAPTCHA protection - state registries are more reliable for scraping.",
  parameters: businessRegistrySearchSchema,
  execute: async ({
    query,
    searchType = "company",
    sources,
    jurisdiction,
    limit = 15,
  }): Promise<BusinessRegistrySearchResult> => {
    console.log("[Business Registry Scraper] Starting search:", { query, searchType, sources, jurisdiction })
    const startTime = Date.now()

    // Validate query
    if (!query || query.trim().length < 2) {
      return {
        answer: "Please provide a valid search query (at least 2 characters).",
        sources: [],
        query,
        searchType,
        results: [],
        sourcesSearched: [],
        sourcesSuccessful: [],
        sourcesFailed: [],
        totalFound: 0,
        error: "Invalid query",
      }
    }

    // Check if OpenCorporates API is available
    if (isOpenCorporatesEnabled() && !sources) {
      // If OpenCorporates API is configured, suggest using it instead
      // but still allow scraping if user explicitly requests it
      console.log("[Business Registry Scraper] OpenCorporates API available - proceeding with scraper as requested")
    }

    // Check Playwright availability
    const playwrightAvailable = await isPlaywrightAvailable()

    if (!playwrightAvailable) {
      const manualLinks = [
        { name: "OpenCorporates Search", url: `https://opencorporates.com/${searchType === "officer" ? "officers" : "companies"}?q=${encodeURIComponent(query)}`, snippet: "Search companies and officers worldwide" },
        { name: "Florida Sunbiz", url: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName", snippet: "Florida Division of Corporations" },
        { name: "New York DOS", url: "https://apps.dos.ny.gov/publicInquiry/", snippet: "New York Department of State" },
        { name: "California bizfile", url: "https://bizfileonline.sos.ca.gov/search/business", snippet: "California Secretary of State" },
        { name: "Delaware ICIS", url: "https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx", snippet: "Delaware Division of Corporations (65% of Fortune 500)" },
      ]

      return {
        answer: `## Playwright Not Installed\n\nWeb scraping requires Playwright. Install with:\n\`\`\`bash\nnpm install playwright-extra puppeteer-extra-plugin-stealth playwright\n\`\`\`\n\n**Manual Search Links:**\nUse the sources below to search manually.`,
        sources: manualLinks,
        query,
        searchType,
        results: [],
        sourcesSearched: [],
        sourcesSuccessful: [],
        sourcesFailed: [],
        totalFound: 0,
        error: "Playwright not installed",
      }
    }

    // Check if scraping is enabled
    if (!isScrapingEnabled()) {
      return {
        answer: "Web scraping is disabled. Set `ENABLE_WEB_SCRAPING=true` in environment to enable.",
        sources: [
          { name: "OpenCorporates", url: `https://opencorporates.com/companies?q=${encodeURIComponent(query)}`, snippet: "Manual search available" },
        ],
        query,
        searchType,
        results: [],
        sourcesSearched: [],
        sourcesSuccessful: [],
        sourcesFailed: [],
        totalFound: 0,
        error: "Scraping disabled",
      }
    }

    try {
      // Determine sources to search
      // Prioritize NY Open Data (FREE API) and Florida (most scrape-friendly)
      // OpenCorporates last since it often has CAPTCHA protection
      let sourcesToSearch: ScraperSource[] = sources || ["newYork", "florida", "opencorporates"]

      // Add Delaware if searching for large corporations or if specified
      if (!sources && query.toLowerCase().includes("inc") || query.toLowerCase().includes("corp")) {
        if (!sourcesToSearch.includes("delaware")) {
          sourcesToSearch.push("delaware")
        }
      }

      // Filter by jurisdiction if specified
      if (jurisdiction) {
        const stateMap: Record<string, ScraperSource> = {
          us_fl: "florida",
          us_ny: "newYork",
          us_ca: "california",
          us_de: "delaware",
        }
        const matchedState = stateMap[jurisdiction.toLowerCase()]
        if (matchedState) {
          sourcesToSearch = sourcesToSearch.includes(matchedState)
            ? [matchedState]
            : [matchedState, ...sourcesToSearch.filter((s) => s !== matchedState)]
        }
      }

      console.log("[Business Registry Scraper] Searching sources:", sourcesToSearch)

      // Run scraper
      const { results, totalFound, successful, failed } = await scrapeBusinessRegistry(query, {
        sources: sourcesToSearch,
        searchType,
        limit: Math.min(limit, 30),
        parallel: true,
      })

      // Collect all results and warnings
      const allResults: Array<ScrapedBusinessEntity | ScrapedOfficer> = []
      const allWarnings: string[] = []
      const allSources: ScraperToolSource[] = []

      for (const [source, result] of results) {
        if (result.success && result.data.length > 0) {
          allResults.push(...result.data)

          // Convert results to sources for UI
          result.data.forEach((item) => {
            if (searchType === "company") {
              allSources.push(businessToSource(item as ScrapedBusinessEntity))
            } else {
              allSources.push(officerToSource(item as ScrapedOfficer))
            }
          })
        }

        if (result.warnings) {
          allWarnings.push(...result.warnings.map((w) => `${source}: ${w}`))
        }
        if (result.error && !result.success) {
          allWarnings.push(`${source}: ${result.error}`)
        }
      }

      // Dedupe sources by URL
      const seenUrls = new Set<string>()
      const dedupedSources = allSources.filter((s) => {
        if (seenUrls.has(s.url)) return false
        seenUrls.add(s.url)
        return true
      }).slice(0, 20) // Limit to 20 sources for UI

      // Generate answer
      const sourceInfo = {
        searched: sourcesToSearch,
        successful,
        failed,
      }

      const answer = searchType === "company"
        ? formatCompanyAnswer(query, allResults as ScrapedBusinessEntity[], sourceInfo)
        : formatOfficerAnswer(query, allResults as ScrapedOfficer[], sourceInfo)

      const duration = Date.now() - startTime
      console.log(`[Business Registry Scraper] Completed in ${duration}ms. Found ${allResults.length} results from ${successful.length} sources.`)

      return {
        answer,
        sources: dedupedSources,
        query,
        searchType,
        results: allResults,
        sourcesSearched: sourcesToSearch,
        sourcesSuccessful: successful,
        sourcesFailed: failed,
        totalFound: allResults.length,
        warnings: allWarnings.length > 0 ? allWarnings : undefined,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error("[Business Registry Scraper] Error:", errorMessage)

      return {
        answer: `## Search Error\n\n${errorMessage}\n\n**Manual Search:**\nUse the sources below to search manually.`,
        sources: [
          { name: "OpenCorporates", url: `https://opencorporates.com/${searchType === "officer" ? "officers" : "companies"}?q=${encodeURIComponent(query)}`, snippet: "Search worldwide" },
          { name: "Florida Sunbiz", url: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName", snippet: "Florida businesses" },
        ],
        query,
        searchType,
        results: [],
        sourcesSearched: sources || [],
        sourcesSuccessful: [],
        sourcesFailed: sources || [],
        totalFound: 0,
        error: errorMessage,
      }
    }
  },
})

/**
 * Check if business registry scraper tool should be enabled
 * ALWAYS enabled - provides helpful fallback even when Playwright not installed
 */
export function shouldEnableBusinessRegistryScraperTool(): boolean {
  return true
}

/**
 * Check if web scraping is actually available (for internal use)
 */
export function isBusinessRegistryScraperAvailable(): boolean {
  return isScrapingEnabled()
}
