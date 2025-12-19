/**
 * Find Business Ownership Tool
 *
 * AI tool for finding all businesses owned or controlled by a person.
 * Uses the unified person search system with ownership inference.
 *
 * This tool is CRITICAL for prospect research:
 * - Search by person name → Find all their business affiliations
 * - Ownership inference from officer roles (President/CEO = likely owner)
 * - SEC EDGAR integration for public company insider status
 *
 * Why Officer ≈ Owner for Small Businesses:
 * - LLC: Managing Member = Owner who manages
 * - S-Corp: Sole Owner = President/CEO/Secretary (often all three)
 * - Partnership: General Partner = Listed in filings
 *
 * UI Integration:
 * - Returns sources array in Linkup-compatible format for SourcesList component
 * - Provides rawContent for AI consumption
 * - Includes ownership likelihood scoring
 */

import { tool } from "ai"
import { z } from "zod"
import {
  searchBusinessesByPerson,
  quickPersonSearch,
  getOwnershipSummary,
  type PersonBusinessResult,
  type PersonSearchResult,
  getLikelihoodLabel,
  getLikelihoodColor,
} from "@/lib/scraper"
import { isPlaywrightAvailable, isScrapingEnabled } from "@/lib/scraper"

// ============================================================================
// TYPES
// ============================================================================

interface OwnershipSource {
  name: string
  url: string
  snippet: string
}

export interface FindBusinessOwnershipResult {
  // Main answer text (for AI and streaming)
  answer: string
  // Sources for SourcesList UI component (Linkup-compatible format)
  sources: OwnershipSource[]
  // Original query
  personName: string
  // Detailed results
  businesses: PersonBusinessResult[]
  // Ownership summary
  summary: {
    confirmed: number
    highLikelihood: number
    mediumLikelihood: number
    lowLikelihood: number
    total: number
    uniqueStates: string[]
  }
  // Search metadata
  statesSearched: string[]
  statesSucceeded: string[]
  statesFailed: string[]
  searchDuration: number
  // Error info
  error?: string
  warnings?: string[]
}

// ============================================================================
// SCHEMAS
// ============================================================================

const findBusinessOwnershipSchema = z.object({
  personName: z
    .string()
    .describe(
      "Full name of the person to search for (e.g., 'John Smith', 'Tim Cook'). " +
      "Searches state registries for officer/director positions and SEC for insider status. " +
      "For small businesses, officer roles (President, CEO, Manager) indicate likely ownership."
    ),
  states: z
    .array(z.string())
    .optional()
    .describe(
      "Specific states to search (2-letter codes: 'fl', 'ny', 'ca', 'de', etc.). " +
      "49 US states supported (Texas excluded - use searchWeb). If omitted, searches Florida only (quickest). " +
      "Examples: ['fl'] for Florida only, ['fl', 'de', 'ny'] for multiple states."
    ),
  includeSecEdgar: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Include SEC EDGAR search for public company ownership (10%+ shareholders). " +
      "Only works for people who are insiders at public companies."
    ),
  fetchDetailPages: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Fetch entity detail pages for FULL officer lists. " +
      "Slower but provides complete data. Set true for thorough research."
    ),
  quickMode: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Use quick mode (Florida only) for fast initial results. " +
      "Good for quick verification, not comprehensive."
    ),
  limit: z
    .number()
    .optional()
    .default(25)
    .describe("Maximum results per state (default: 25)"),
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert business result to source format for UI
 */
function businessResultToSource(result: PersonBusinessResult): OwnershipSource {
  const likelihoodEmoji = {
    confirmed: "✅",
    high: "🟢",
    medium: "🟡",
    low: "🔴",
  }

  const emoji = likelihoodEmoji[result.ownershipLikelihood] || "⚪"
  const statusText = result.status ? `(${result.status})` : ""

  return {
    name: `${emoji} ${result.companyName} ${statusText}`,
    url: result.sourceUrl,
    snippet: `${result.roles.join(", ")} | ${result.state} | Ownership: ${getLikelihoodLabel(result.ownershipLikelihood)} - ${result.ownershipReason}`,
  }
}

/**
 * Format ownership results for AI
 */
function formatOwnershipAnswer(result: PersonSearchResult): string {
  const lines: string[] = []

  if (!result.success || result.businesses.length === 0) {
    lines.push(`## No Business Affiliations Found for "${result.personSearched}"\n`)
    lines.push("**Possible reasons:**")
    lines.push("- Person may not be an officer/director at any registered businesses")
    lines.push("- Name may be spelled differently in official records")
    lines.push("- Businesses may be registered under different name variations")
    lines.push("")
    lines.push("**Suggestions:**")
    lines.push("- Try alternate name spellings")
    lines.push("- Search with/without middle name or initial")
    lines.push("- Use `sec_insider_search` for public company affiliations")
    lines.push("- Use `searchWeb` for broader results")
    return lines.join("\n")
  }

  const summary = getOwnershipSummary(result.businesses)

  lines.push(`## Business Ownership Profile: ${result.personSearched}\n`)
  lines.push(`**Total Affiliations Found:** ${summary.total}`)
  lines.push(`**States Covered:** ${summary.uniqueStates.join(", ") || "None"}`)
  lines.push(`**Search Duration:** ${result.searchDuration}ms\n`)

  // Ownership summary
  lines.push("### Ownership Confidence Breakdown\n")
  if (summary.confirmed > 0) {
    lines.push(`- ✅ **Confirmed:** ${summary.confirmed} (SEC filings prove ownership)`)
  }
  if (summary.highLikelihood > 0) {
    lines.push(`- 🟢 **High Likelihood:** ${summary.highLikelihood} (Executive roles = likely owner)`)
  }
  if (summary.mediumLikelihood > 0) {
    lines.push(`- 🟡 **Medium Likelihood:** ${summary.mediumLikelihood} (Director/Agent roles)`)
  }
  if (summary.lowLikelihood > 0) {
    lines.push(`- 🔴 **Low Likelihood:** ${summary.lowLikelihood} (Minor roles)`)
  }
  lines.push("")

  // Group by ownership likelihood
  const confirmed = result.businesses.filter(b => b.ownershipLikelihood === "confirmed")
  const high = result.businesses.filter(b => b.ownershipLikelihood === "high")
  const medium = result.businesses.filter(b => b.ownershipLikelihood === "medium")
  const low = result.businesses.filter(b => b.ownershipLikelihood === "low")

  // Show confirmed first
  if (confirmed.length > 0) {
    lines.push("### ✅ Confirmed Ownership (SEC Filings)\n")
    confirmed.forEach((b, i) => {
      lines.push(`${i + 1}. **${b.companyName}** (${b.state})`)
      lines.push(`   - Roles: ${b.roles.join(", ")}`)
      lines.push(`   - Status: ${b.status || "Unknown"}`)
      if (b.entityType) lines.push(`   - Type: ${b.entityType}`)
      lines.push(`   - Reason: ${b.ownershipReason}`)
      lines.push("")
    })
  }

  // Then high likelihood
  if (high.length > 0) {
    lines.push("### 🟢 High Likelihood Ownership\n")
    high.slice(0, 10).forEach((b, i) => {
      lines.push(`${i + 1}. **${b.companyName}** (${b.state})`)
      lines.push(`   - Roles: ${b.roles.join(", ")}`)
      lines.push(`   - Status: ${b.status || "Unknown"}`)
      if (b.entityType) lines.push(`   - Type: ${b.entityType}`)
      if (b.incorporationDate) lines.push(`   - Formed: ${b.incorporationDate}`)
      lines.push(`   - Reason: ${b.ownershipReason}`)
      lines.push("")
    })
    if (high.length > 10) {
      lines.push(`... and ${high.length - 10} more high-likelihood affiliations\n`)
    }
  }

  // Medium likelihood
  if (medium.length > 0) {
    lines.push("### 🟡 Medium Likelihood (Director/Agent Roles)\n")
    medium.slice(0, 5).forEach((b, i) => {
      lines.push(`${i + 1}. **${b.companyName}** - ${b.roles.join(", ")} (${b.state})`)
    })
    if (medium.length > 5) {
      lines.push(`... and ${medium.length - 5} more medium-likelihood affiliations\n`)
    }
    lines.push("")
  }

  // Low likelihood (brief mention)
  if (low.length > 0) {
    lines.push(`### 🔴 Low Likelihood: ${low.length} additional affiliations (minor roles)\n`)
  }

  // Wealth indicators
  lines.push("### Wealth Indicators & Prospect Research Notes\n")

  if (summary.confirmed > 0 || summary.highLikelihood >= 3) {
    lines.push("- **HIGH PROSPECT VALUE** - Multiple confirmed or likely ownerships indicate significant wealth")
  } else if (summary.highLikelihood >= 1) {
    lines.push("- **MODERATE PROSPECT VALUE** - At least one likely business ownership")
  } else if (summary.mediumLikelihood >= 2) {
    lines.push("- **POTENTIAL PROSPECT** - Multiple director/agent roles suggest business involvement")
  }

  // Check for Delaware presence
  if (summary.uniqueStates.includes("DE")) {
    lines.push("- **Delaware entities detected** - Sophisticated legal/tax planning suggests higher wealth")
  }

  // Entity type insights
  const llcs = result.businesses.filter(b =>
    b.entityType?.toLowerCase().includes("llc") ||
    b.entityType?.toLowerCase().includes("limited liability")
  )
  if (llcs.length >= 2) {
    lines.push(`- **Multiple LLCs (${llcs.length})** - May indicate real estate or investment holdings`)
  }

  // Warnings
  if (result.warnings && result.warnings.length > 0) {
    lines.push("\n### Search Notes")
    result.warnings.forEach(w => lines.push(`- ⚠️ ${w}`))
  }

  return lines.join("\n")
}

// ============================================================================
// TOOL
// ============================================================================

export const findBusinessOwnershipTool = tool({
  description:
    "**Find businesses owned or controlled by a person.** " +
    "USE THIS TOOL when asked: 'What businesses does [person] own?', 'Find [person]'s companies', " +
    "'Does [person] own any businesses?', 'What companies is [person] affiliated with?', " +
    "or any variation asking about a person's business ownership or corporate affiliations.\n\n" +
    "Searches 49 US state business registries to find companies where the person is an officer, " +
    "director, or registered agent. For small businesses, officer roles strongly indicate ownership.\n\n" +
    "**WHEN TO USE:**\n" +
    "- 'What businesses does Bob own in Florida?' → Use with states=['fl']\n" +
    "- 'Find all companies John Smith owns' → Use with default (all states)\n" +
    "- 'Is Jane Doe a business owner?' → Use to check ownership\n" +
    "- Prospect research on an individual → Use to find wealth indicators\n\n" +
    "**WHAT IT FINDS:**\n" +
    "- Small business ownership: Officers/directors from 49 US state registries\n" +
    "- Public company ownership: 10%+ shareholders via SEC EDGAR\n" +
    "- Registered agent positions\n\n" +
    "**OWNERSHIP CONFIDENCE:**\n" +
    "- 'confirmed': SEC filing proves insider status\n" +
    "- 'high': President/CEO/Managing Member = likely owner\n" +
    "- 'medium': Director/Registered Agent = may or may not own\n" +
    "- 'low': Minor roles, unlikely owner\n\n" +
    "**SUPPORTED STATES:** 49 US states (FL, NY, CA, DE, etc.). Texas excluded - use searchWeb for TX.\n\n" +
    "**LIMITATIONS:**\n" +
    "- Cannot find silent partners or <10% shareholders\n" +
    "- LLC members who aren't managers won't appear\n" +
    "- Texas requires paid access - use searchWeb tool instead",
  parameters: findBusinessOwnershipSchema,
  execute: async ({
    personName,
    states,
    includeSecEdgar = true,
    fetchDetailPages = false,
    quickMode = false,
    limit = 25,
  }): Promise<FindBusinessOwnershipResult> => {
    console.log("[Find Business Ownership] Starting search for:", personName)
    const startTime = Date.now()

    // Validate input
    if (!personName || personName.trim().length < 2) {
      return {
        answer: "Please provide a valid person name (at least 2 characters).",
        sources: [],
        personName,
        businesses: [],
        summary: {
          confirmed: 0,
          highLikelihood: 0,
          mediumLikelihood: 0,
          lowLikelihood: 0,
          total: 0,
          uniqueStates: [],
        },
        statesSearched: [],
        statesSucceeded: [],
        statesFailed: [],
        searchDuration: Date.now() - startTime,
        error: "Invalid person name",
      }
    }

    // Check if Playwright is available (optional - some searches work without it)
    const playwrightAvailable = await isPlaywrightAvailable()
    if (!playwrightAvailable) {
      console.log("[Find Business Ownership] Playwright not available - limited functionality")
    }

    // Check if scraping is enabled
    if (!isScrapingEnabled()) {
      return {
        answer: "Web scraping is disabled. Set `ENABLE_WEB_SCRAPING=true` in environment to enable.",
        sources: [
          { name: "Florida Sunbiz", url: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByOfficerOrRegisteredAgent", snippet: "Manual officer search" },
          { name: "SEC EDGAR", url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(personName)}&type=4&owner=only`, snippet: "SEC insider filings" },
        ],
        personName,
        businesses: [],
        summary: {
          confirmed: 0,
          highLikelihood: 0,
          mediumLikelihood: 0,
          lowLikelihood: 0,
          total: 0,
          uniqueStates: [],
        },
        statesSearched: [],
        statesSucceeded: [],
        statesFailed: [],
        searchDuration: Date.now() - startTime,
        error: "Scraping disabled",
      }
    }

    try {
      let result: PersonSearchResult

      if (quickMode) {
        // Quick mode - Florida only
        console.log("[Find Business Ownership] Using quick mode (Florida only)")
        result = await quickPersonSearch(personName, { limit })
      } else {
        // Full search
        console.log("[Find Business Ownership] Full search:", { states, includeSecEdgar, fetchDetailPages })
        result = await searchBusinessesByPerson(personName, {
          states,
          includeSecEdgar,
          fetchDetailPages,
          limit,
          parallel: true,
        })
      }

      // Generate sources for UI
      const sources: OwnershipSource[] = result.businesses
        .slice(0, 20) // Limit to 20 for UI
        .map(businessResultToSource)

      // Add manual search links if no results
      if (sources.length === 0) {
        sources.push(
          { name: "Florida Officer Search", url: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByOfficerOrRegisteredAgent", snippet: "Search Florida businesses by officer name" },
          { name: "SEC EDGAR Insider", url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(personName)}&type=4&owner=only`, snippet: "Search SEC insider filings" },
          { name: "New York DOS", url: "https://apps.dos.ny.gov/publicInquiry/", snippet: "Search New York businesses" },
        )
      }

      // Generate answer
      const answer = formatOwnershipAnswer(result)

      // Get summary
      const summary = getOwnershipSummary(result.businesses)

      const duration = Date.now() - startTime
      console.log(`[Find Business Ownership] Completed in ${duration}ms. Found ${result.totalFound} affiliations.`)

      return {
        answer,
        sources,
        personName,
        businesses: result.businesses,
        summary,
        statesSearched: result.statesSearched,
        statesSucceeded: result.statesSucceeded,
        statesFailed: result.statesFailed,
        searchDuration: result.searchDuration,
        warnings: result.warnings,
        error: result.error,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error("[Find Business Ownership] Error:", errorMessage)

      return {
        answer: `## Search Error\n\n${errorMessage}\n\n**Manual Search Options:**\nUse the sources below to search manually.`,
        sources: [
          { name: "Florida Officer Search", url: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByOfficerOrRegisteredAgent", snippet: "Search by officer name" },
          { name: "SEC EDGAR", url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(personName)}&type=4&owner=only`, snippet: "SEC insider filings" },
        ],
        personName,
        businesses: [],
        summary: {
          confirmed: 0,
          highLikelihood: 0,
          mediumLikelihood: 0,
          lowLikelihood: 0,
          total: 0,
          uniqueStates: [],
        },
        statesSearched: states || [],
        statesSucceeded: [],
        statesFailed: states || [],
        searchDuration: Date.now() - startTime,
        error: errorMessage,
      }
    }
  },
})

/**
 * Check if business ownership tool should be enabled
 */
export function shouldEnableFindBusinessOwnershipTool(): boolean {
  return true // Always enabled - provides helpful fallback
}
