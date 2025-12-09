/**
 * Nonprofit Board/Officer Search Tool
 *
 * Search for nonprofit board positions and officer roles held by a specific person.
 * Combines multiple data sources to find where someone serves:
 * - ProPublica 990 database (organization-based, cross-referenced)
 * - SEC DEF 14A proxy statements (public company nonprofit board disclosure)
 * - Web search for board announcements
 *
 * This addresses a key competitor feature:
 * - DonorSearch emphasizes finding board connections
 * - iWave tracks nonprofit affiliations
 * - WealthEngine maps philanthropic networks
 *
 * Free alternative to premium board/affiliation mapping services.
 */

import { tool } from "ai"
import { z } from "zod"
import { LinkupClient } from "linkup-sdk"
import { getLinkupApiKey, isLinkupEnabled } from "@/lib/linkup/config"

// ============================================================================
// CONSTANTS
// ============================================================================

const PROPUBLICA_API_BASE = "https://projects.propublica.org/nonprofits/api/v2"
const SEC_EFTS_BASE = "https://efts.sec.gov/LATEST/search-index"
const TIMEOUT_MS = 30000

// ============================================================================
// SCHEMAS
// ============================================================================

const nonprofitBoardSearchSchema = z.object({
  personName: z
    .string()
    .describe("Full name of the person to search for (e.g., 'Tim Cook', 'Mary Barra')"),
  searchDepth: z
    .enum(["quick", "thorough"])
    .optional()
    .default("thorough")
    .describe("Search depth: 'quick' for fast results, 'thorough' for comprehensive search"),
  includePublicCompanyBoards: z
    .boolean()
    .optional()
    .default(true)
    .describe("Also search SEC filings for public company board positions"),
})

// ============================================================================
// TYPES
// ============================================================================

interface BoardPosition {
  organizationName: string
  organizationType: "nonprofit" | "public_company" | "private" | "unknown"
  role: string
  ein?: string
  ticker?: string
  assets?: number
  source: string
  sourceUrl?: string
  confidence: "high" | "medium" | "low"
  yearDiscovered?: number
}

export interface NonprofitBoardSearchResult {
  personName: string
  totalPositions: number
  nonprofitPositions: BoardPosition[]
  publicCompanyPositions: BoardPosition[]
  otherPositions: BoardPosition[]
  wealthIndicator: string
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// HELPERS
// ============================================================================

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

function formatCurrency(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}

function formatEin(ein: string | number): string {
  const einStr = String(ein).replace(/-/g, "").padStart(9, "0")
  return `${einStr.slice(0, 2)}-${einStr.slice(2)}`
}

// ============================================================================
// DATA FETCHERS
// ============================================================================

/**
 * Search SEC for proxy statements mentioning the person
 * Proxy statements (DEF 14A) list all directors and often their nonprofit affiliations
 */
async function searchSecProxyForPerson(personName: string): Promise<BoardPosition[]> {
  const positions: BoardPosition[] = []

  try {
    const searchQuery = encodeURIComponent(`"${personName}"`)
    const url = `${SEC_EFTS_BASE}?q=${searchQuery}&dateRange=custom&startdt=2020-01-01&forms=DEF%2014A&from=0&size=10`

    const response = await withTimeout(
      fetch(url, { headers: { Accept: "application/json" } }),
      15000,
      "SEC proxy search timeout"
    )

    if (!response.ok) return positions

    const data = await response.json()
    const hits = data.hits?.hits || []

    for (const hit of hits) {
      const source = hit._source || {}
      const displayNames = source.display_names || []
      const fileDate = source.file_date || ""

      // The company filing the proxy statement
      for (const companyName of displayNames) {
        // Skip if it's the person's name
        if (companyName.toLowerCase().includes(personName.split(" ")[1]?.toLowerCase() || "")) {
          continue
        }

        positions.push({
          organizationName: companyName,
          organizationType: "public_company",
          role: "Board Director (SEC Proxy)",
          source: "SEC DEF 14A",
          sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(companyName)}&type=DEF%2014A`,
          confidence: "high",
          yearDiscovered: fileDate ? parseInt(fileDate.substring(0, 4)) : undefined,
        })
      }
    }

    // Deduplicate by company name
    const seen = new Set<string>()
    return positions.filter((p) => {
      const key = p.organizationName.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  } catch (error) {
    console.error("[NonprofitBoardSearch] SEC proxy search failed:", error)
    return positions
  }
}

/**
 * Search SEC for Form 4 filings (insider transactions)
 * Shows which public companies the person is affiliated with
 */
async function searchSecInsiderForPerson(personName: string): Promise<BoardPosition[]> {
  const positions: BoardPosition[] = []

  try {
    const searchQuery = encodeURIComponent(`"${personName}"`)
    const url = `${SEC_EFTS_BASE}?q=${searchQuery}&dateRange=custom&startdt=2020-01-01&forms=4,3&from=0&size=15`

    const response = await withTimeout(
      fetch(url, { headers: { Accept: "application/json" } }),
      15000,
      "SEC insider search timeout"
    )

    if (!response.ok) return positions

    const data = await response.json()
    const hits = data.hits?.hits || []

    const companiesSeen = new Set<string>()

    for (const hit of hits) {
      const source = hit._source || {}
      const displayNames = source.display_names || []
      const form = source.form || "4"
      const fileDate = source.file_date || ""

      for (const companyName of displayNames) {
        // Skip person's name and duplicates
        const personLastName = personName.split(" ").pop()?.toLowerCase() || ""
        if (
          companyName.toLowerCase().includes(personLastName) ||
          companiesSeen.has(companyName.toLowerCase())
        ) {
          continue
        }
        companiesSeen.add(companyName.toLowerCase())

        positions.push({
          organizationName: companyName,
          organizationType: "public_company",
          role: `Corporate Insider (Form ${form})`,
          source: "SEC EDGAR",
          sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(companyName)}&type=4&owner=only`,
          confidence: "high",
          yearDiscovered: fileDate ? parseInt(fileDate.substring(0, 4)) : undefined,
        })
      }
    }

    return positions
  } catch (error) {
    console.error("[NonprofitBoardSearch] SEC insider search failed:", error)
    return positions
  }
}

/**
 * Use web search to find nonprofit board positions
 */
async function searchWebForBoardPositions(personName: string): Promise<BoardPosition[]> {
  const positions: BoardPosition[] = []

  if (!isLinkupEnabled()) {
    console.log("[NonprofitBoardSearch] Linkup not available, skipping web search")
    return positions
  }

  try {
    const client = new LinkupClient({ apiKey: getLinkupApiKey() })

    // Search for nonprofit board positions
    const query = `"${personName}" nonprofit board member OR director OR trustee foundation charity`

    const result = await withTimeout(
      client.search({
        query,
        depth: "standard",
        outputType: "sourcedAnswer",
      }),
      TIMEOUT_MS,
      "Web search timeout"
    )

    const answer = result.answer || ""

    // Extract organization mentions from the answer
    // Look for patterns like "board of [org]", "director at [org]", "trustee of [org]"
    const patterns = [
      /board\s+(?:of|at|for)\s+(?:the\s+)?([A-Z][a-zA-Z\s&'-]+(?:Foundation|Fund|Trust|Institute|Center|Society|Association|Museum|Hospital|University|College|School))/gi,
      /director\s+(?:of|at|for)\s+(?:the\s+)?([A-Z][a-zA-Z\s&'-]+(?:Foundation|Fund|Trust|Institute|Center|Society|Association))/gi,
      /trustee\s+(?:of|at|for)\s+(?:the\s+)?([A-Z][a-zA-Z\s&'-]+(?:Foundation|Fund|Trust|University|College|School))/gi,
      /serves?\s+on\s+(?:the\s+)?(?:board\s+of\s+)?(?:the\s+)?([A-Z][a-zA-Z\s&'-]+(?:Foundation|Fund|Trust|Institute))/gi,
      /([A-Z][a-zA-Z\s&'-]+(?:Foundation|Fund))\s+board/gi,
    ]

    const seen = new Set<string>()

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(answer)) !== null) {
        const orgName = match[1].trim()
        const normalizedName = orgName.toLowerCase()

        // Skip if already seen or too short
        if (seen.has(normalizedName) || orgName.length < 5) continue
        seen.add(normalizedName)

        // Determine role based on pattern
        let role = "Board Member"
        if (pattern.source.includes("director")) role = "Director"
        if (pattern.source.includes("trustee")) role = "Trustee"

        positions.push({
          organizationName: orgName,
          organizationType: "nonprofit",
          role,
          source: "Web Search",
          confidence: "medium",
        })
      }
    }

    // Also check sources for organization names
    const sources = result.sources || []
    for (const source of sources) {
      // Try to extract org name from source URL or name
      const sourceName = source.name || ""
      const sourceUrl = source.url || ""

      // Add source URL to position if it matches
      for (const pos of positions) {
        if (
          sourceName.toLowerCase().includes(pos.organizationName.toLowerCase().split(" ")[0]) ||
          sourceUrl.toLowerCase().includes(pos.organizationName.toLowerCase().replace(/\s+/g, ""))
        ) {
          pos.sourceUrl = sourceUrl
        }
      }
    }

    return positions
  } catch (error) {
    console.error("[NonprofitBoardSearch] Web search failed:", error)
    return positions
  }
}

/**
 * Search ProPublica for foundations matching the person's name
 * (indicates potential founder/chair role)
 */
async function searchProPublicaForPersonFoundations(personName: string): Promise<BoardPosition[]> {
  const positions: BoardPosition[] = []

  try {
    const lastName = personName.split(" ").pop() || personName
    const firstName = personName.split(" ")[0] || ""

    const searchTerms = [
      `${lastName} Foundation`,
      `${lastName} Family Foundation`,
      `${firstName} ${lastName} Foundation`,
    ]

    for (const term of searchTerms) {
      const url = `${PROPUBLICA_API_BASE}/search.json?q=${encodeURIComponent(term)}`

      const response = await withTimeout(
        fetch(url, { headers: { Accept: "application/json" } }),
        10000,
        "ProPublica search timeout"
      )

      if (!response.ok) continue

      const data = await response.json()
      const orgs = data.organizations || []

      for (const org of orgs.slice(0, 3)) {
        // Check if org name includes person's last name
        if (!org.name.toLowerCase().includes(lastName.toLowerCase())) continue

        // Skip if already added
        if (positions.some((p) => p.ein === formatEin(org.ein))) continue

        // Get details for assets
        let assets: number | undefined
        try {
          const detailsUrl = `${PROPUBLICA_API_BASE}/organizations/${org.ein}.json`
          const detailsRes = await fetch(detailsUrl)
          if (detailsRes.ok) {
            const details = await detailsRes.json()
            assets = details.filings_with_data?.[0]?.totassetsend
          }
        } catch {
          // Continue without assets
        }

        positions.push({
          organizationName: org.name,
          organizationType: "nonprofit",
          role: "Founder/Principal",
          ein: formatEin(org.ein),
          assets,
          source: "ProPublica 990",
          sourceUrl: `https://projects.propublica.org/nonprofits/organizations/${org.ein}`,
          confidence: "high",
        })
      }
    }

    return positions
  } catch (error) {
    console.error("[NonprofitBoardSearch] ProPublica search failed:", error)
    return positions
  }
}

/**
 * Calculate wealth indicator based on board positions
 */
function calculateWealthIndicator(
  nonprofitPositions: BoardPosition[],
  publicPositions: BoardPosition[]
): string {
  let score = 0

  // Public company boards are strong indicators
  if (publicPositions.length >= 3) score += 40
  else if (publicPositions.length >= 1) score += 25

  // Nonprofit boards, especially with large assets
  const totalNonprofitAssets = nonprofitPositions.reduce((sum, p) => sum + (p.assets || 0), 0)
  if (totalNonprofitAssets >= 100000000) score += 35
  else if (totalNonprofitAssets >= 10000000) score += 25
  else if (totalNonprofitAssets >= 1000000) score += 15

  // Number of nonprofit boards
  if (nonprofitPositions.length >= 5) score += 20
  else if (nonprofitPositions.length >= 2) score += 10

  if (score >= 70) return "VERY HIGH - Multiple board positions at major organizations"
  if (score >= 50) return "HIGH - Significant board presence suggests wealth and influence"
  if (score >= 30) return "MODERATE - Some board activity indicates community involvement"
  if (score >= 10) return "EMERGING - Limited board presence found"
  return "LIMITED - No significant board positions found"
}

/**
 * Format results for AI consumption
 */
function formatResultsForAI(
  personName: string,
  nonprofitPositions: BoardPosition[],
  publicPositions: BoardPosition[],
  otherPositions: BoardPosition[],
  wealthIndicator: string
): string {
  const totalPositions =
    nonprofitPositions.length + publicPositions.length + otherPositions.length

  const lines: string[] = [
    `# Board Position Search: ${personName}`,
    "",
    `**Total Positions Found:** ${totalPositions}`,
    `**Wealth Indicator:** ${wealthIndicator}`,
    "",
    "---",
    "",
  ]

  if (nonprofitPositions.length > 0) {
    lines.push(`## Nonprofit Board Positions (${nonprofitPositions.length})`)
    lines.push("")

    for (const pos of nonprofitPositions) {
      lines.push(`### ${pos.organizationName}`)
      lines.push(`- **Role:** ${pos.role}`)
      if (pos.ein) lines.push(`- **EIN:** ${pos.ein}`)
      if (pos.assets) lines.push(`- **Assets:** ${formatCurrency(pos.assets)}`)
      lines.push(`- **Source:** ${pos.source} (${pos.confidence} confidence)`)
      lines.push("")
    }
  }

  if (publicPositions.length > 0) {
    lines.push(`## Public Company Positions (${publicPositions.length})`)
    lines.push("")

    for (const pos of publicPositions) {
      lines.push(`### ${pos.organizationName}`)
      lines.push(`- **Role:** ${pos.role}`)
      lines.push(`- **Source:** ${pos.source}`)
      if (pos.yearDiscovered) lines.push(`- **Year:** ${pos.yearDiscovered}`)
      lines.push("")
    }
  }

  if (totalPositions === 0) {
    lines.push(`## No Board Positions Found`)
    lines.push("")
    lines.push(`No board positions were found for ${personName}. This could mean:`)
    lines.push("")
    lines.push(`- The person uses a different name professionally`)
    lines.push(`- Board positions are not publicly disclosed`)
    lines.push(`- The person serves on private company or family foundation boards`)
    lines.push("")
    lines.push(`**Suggestions:**`)
    lines.push(`- Try searching with middle name or maiden name`)
    lines.push(`- Search for their family foundation by name`)
    lines.push(`- Check LinkedIn for disclosed board positions`)
  }

  lines.push("---")
  lines.push("")
  lines.push("## About This Search")
  lines.push("")
  lines.push("This search aggregates board positions from:")
  lines.push("- SEC EDGAR (Forms 3, 4, DEF 14A for public company positions)")
  lines.push("- ProPublica 990 (nonprofit foundations)")
  lines.push("- Web search (board announcements and bios)")
  lines.push("")
  lines.push("*This is a free alternative to premium board mapping services.*")

  return lines.join("\n")
}

// ============================================================================
// TOOL
// ============================================================================

export const nonprofitBoardSearchTool = tool({
  description:
    "BOARD POSITION FINDER - Search for nonprofit and public company board positions held by a person. " +
    "Aggregates data from SEC filings (proxy statements, insider forms), ProPublica 990s, and web sources. " +
    "Essential for understanding a prospect's philanthropic network and influence. " +
    "Returns wealth indicators based on board portfolio. " +
    "Free alternative to DonorSearch, iWave, and WealthEngine board mapping features.",
  parameters: nonprofitBoardSearchSchema,
  execute: async ({
    personName,
    searchDepth = "thorough",
    includePublicCompanyBoards = true,
  }): Promise<NonprofitBoardSearchResult> => {
    console.log("[NonprofitBoardSearch] Searching for:", personName)
    const startTime = Date.now()

    const sources: Array<{ name: string; url: string }> = []

    try {
      // Parallel searches
      const searchPromises: Promise<BoardPosition[]>[] = [
        searchProPublicaForPersonFoundations(personName),
      ]

      if (searchDepth === "thorough") {
        searchPromises.push(searchWebForBoardPositions(personName))
      }

      if (includePublicCompanyBoards) {
        searchPromises.push(searchSecInsiderForPerson(personName))
        searchPromises.push(searchSecProxyForPerson(personName))
      }

      const results = await Promise.all(searchPromises)

      // Combine and categorize positions
      const allPositions = results.flat()

      const nonprofitPositions = allPositions.filter((p) => p.organizationType === "nonprofit")
      const publicPositions = allPositions.filter((p) => p.organizationType === "public_company")
      const otherPositions = allPositions.filter(
        (p) => !["nonprofit", "public_company"].includes(p.organizationType)
      )

      // Deduplicate within categories
      const dedup = (positions: BoardPosition[]): BoardPosition[] => {
        const seen = new Set<string>()
        return positions.filter((p) => {
          const key = p.organizationName.toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      }

      const dedupedNonprofit = dedup(nonprofitPositions)
      const dedupedPublic = dedup(publicPositions)
      const dedupedOther = dedup(otherPositions)

      // Collect sources
      for (const pos of [...dedupedNonprofit, ...dedupedPublic, ...dedupedOther]) {
        if (pos.sourceUrl && !sources.some((s) => s.url === pos.sourceUrl)) {
          sources.push({
            name: `${pos.source} - ${pos.organizationName}`,
            url: pos.sourceUrl,
          })
        }
      }

      // Calculate wealth indicator
      const wealthIndicator = calculateWealthIndicator(dedupedNonprofit, dedupedPublic)

      const rawContent = formatResultsForAI(
        personName,
        dedupedNonprofit,
        dedupedPublic,
        dedupedOther,
        wealthIndicator
      )

      const duration = Date.now() - startTime
      console.log(
        "[NonprofitBoardSearch] Found",
        dedupedNonprofit.length + dedupedPublic.length,
        "positions in",
        duration,
        "ms"
      )

      return {
        personName,
        totalPositions: dedupedNonprofit.length + dedupedPublic.length + dedupedOther.length,
        nonprofitPositions: dedupedNonprofit,
        publicCompanyPositions: dedupedPublic,
        otherPositions: dedupedOther,
        wealthIndicator,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[NonprofitBoardSearch] Search failed:", errorMessage)

      return {
        personName,
        totalPositions: 0,
        nonprofitPositions: [],
        publicCompanyPositions: [],
        otherPositions: [],
        wealthIndicator: "Unable to determine",
        rawContent: `# Board Position Search: ${personName}\n\n**Error:** ${errorMessage}`,
        sources: [],
        error: errorMessage,
      }
    }
  },
})

/**
 * Check if nonprofit board search should be enabled
 */
export function shouldEnableNonprofitBoardSearchTool(): boolean {
  return true // Always available
}
