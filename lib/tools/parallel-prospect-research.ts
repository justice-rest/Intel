/**
 * Parallel AI Prospect Research Tool
 *
 * Production-grade prospect research using Parallel AI's Task API.
 * Returns STRUCTURED JSON with field-level citations for accurate, verifiable reports.
 *
 * OPTIMIZATION STRATEGY:
 * - Task API ($0.025/call with core processor) instead of Search API ($0.005)
 * - 5x cost but dramatically better quality:
 *   - Structured JSON output (no parsing required)
 *   - Field-level citations (know which source supports each fact)
 *   - AI synthesis built-in (not raw excerpts)
 *   - Confidence levels for each finding
 *
 * @see https://docs.parallel.ai/task-api/task-quickstart
 */

import { tool } from "ai"
import { z } from "zod"
import {
  parallelSearch,
  parallelExtract,
  getParallelStatus,
  type ParallelSearchOptions,
  type ParallelError,
} from "@/lib/parallel/client"
import {
  executeProspectResearchTask,
  getTaskApiStatus,
  type ProspectResearchOutput,
  type TaskRunResult,
} from "@/lib/parallel/task-api"
import { trackSearchCall, trackExtractCall } from "@/lib/parallel/monitoring"
import {
  shouldUseParallel,
  isParallelAvailable,
} from "@/lib/feature-flags/parallel-migration"

// ============================================================================
// TYPES
// ============================================================================

/**
 * Enhanced result type with both structured data AND formatted markdown
 * - `structuredData`: Typed JSON for direct AI use (no parsing needed)
 * - `research`: Formatted markdown for backward compatibility
 * - `sources`: Enhanced with field attribution for transparency
 */
export interface ParallelProspectResult {
  prospectName: string
  /** Pre-formatted markdown report for display */
  research: string
  /** STRUCTURED DATA: Typed JSON with all findings - use this for calculations/analysis */
  structuredData?: ProspectResearchOutput | null
  /** Sources with optional field attribution */
  sources: Array<{
    name: string
    url: string
    snippet?: string
    /** Which data field this source supports (from Task API basis) */
    fieldName?: string
    /** AI reasoning for why this source is relevant */
    reasoning?: string
  }>
  query: string
  mode: "standard" | "deep"
  searchId?: string
  runId?: string
  /** Duration in milliseconds */
  durationMs?: number
  error?: string
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Curated domain list for prospect research
 * Focuses on authoritative sources for wealth, philanthropy, and business data
 */
const PROSPECT_RESEARCH_DOMAINS = [
  // Property & Real Estate
  "zillow.com",
  "redfin.com",
  "realtor.com",
  "trulia.com",

  // Business & Corporate
  "linkedin.com",
  "bloomberg.com",
  "forbes.com",
  "wsj.com",
  "bizjournals.com",
  "crunchbase.com",
  "pitchbook.com",
  "dnb.com",

  // Philanthropy & Nonprofits
  "guidestar.org",
  "candid.org",
  "charitynavigator.org",
  "foundationsource.com",
  "councilofnonprofits.org",

  // Government & Public Records
  "sec.gov",
  "fec.gov",
  "propertyshark.com",
  "publicrecords.com",

  // News & Media
  "nytimes.com",
  "washingtonpost.com",
  "reuters.com",
  "apnews.com",

  // Regional Business Journals
  "bizjournals.com",
]

/**
 * Domains to exclude (low-quality or irrelevant)
 * NOTE: Parallel AI limits source_policy to max 10 domains total
 */
const BLOCKED_DOMAINS = [
  "pinterest.com",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "reddit.com",
  "quora.com",
  "yelp.com",
  "yellowpages.com",
  "whitepages.com",
  // Removed twitter.com and x.com - Grok handles Twitter/X search
]

// ============================================================================
// CHECK FUNCTIONS
// ============================================================================

/**
 * Check if Parallel tools should be enabled for a user
 *
 * @param userId - User ID for rollout check
 * @returns true if Parallel should be used
 */
export function shouldEnableParallelTools(userId?: string): boolean {
  // If no user ID, use feature flag directly
  if (!userId) {
    return isParallelAvailable()
  }

  // Check rollout for this user
  return shouldUseParallel(userId, "PARALLEL_CHAT_SEARCH")
}

/**
 * Get Parallel availability status for error messages
 */
export function getParallelAvailabilityMessage(): string {
  const status = getParallelStatus()

  if (!status.configured) {
    return "Parallel AI is not configured. Please set PARALLEL_API_KEY in your environment."
  }

  if (!status.enabled) {
    return "Parallel AI is currently disabled. Web search is temporarily unavailable."
  }

  if (status.searchCircuitOpen) {
    return "Parallel AI search is temporarily unavailable due to high error rates. Please try again later."
  }

  return "Parallel AI is available."
}

// ============================================================================
// QUERY BUILDER
// ============================================================================

/**
 * Build an optimized prospect research query for Parallel
 *
 * Uses natural language objectives that leverage Parallel's AI-powered search
 */
function buildProspectResearchObjective(
  name: string,
  address?: string,
  context?: string,
  focusAreas?: string[]
): string {
  const firstName = name.split(" ")[0]
  const lastName = name.split(" ").slice(-1)[0]

  // Default focus areas if not specified
  const areas = focusAreas?.length
    ? focusAreas
    : ["real_estate", "business_ownership", "philanthropy", "securities", "biography"]

  const focusInstructions: string[] = []

  if (areas.includes("real_estate")) {
    focusInstructions.push(
      address
        ? `Real estate: Find property value at ${address} and any additional properties owned`
        : `Real estate: Find all properties owned by ${name} with estimated values`
    )
  }

  if (areas.includes("biography")) {
    focusInstructions.push(
      `Biography: Find ${name}'s age, spouse name, education, and career history`
    )
  }

  if (areas.includes("business_ownership")) {
    focusInstructions.push(
      `Business: Find companies owned or led by ${name}, executive positions, board seats, and estimated company revenue`
    )
  }

  if (areas.includes("philanthropy")) {
    focusInstructions.push(
      `Philanthropy: Search for "${name} Foundation", "${lastName} Family Foundation", "${firstName} 1:16 Foundation", nonprofit board memberships, and major charitable gifts`
    )
  }

  if (areas.includes("securities")) {
    focusInstructions.push(
      `Securities: Find SEC Form 4 filings, insider transactions, and public company roles for ${name}`
    )
  }

  return `Research ${name} for nonprofit major donor prospect research.

${address ? `Known address: ${address}` : ""}
${context ? `Additional context: ${context}` : ""}

RESEARCH OBJECTIVES:
${focusInstructions.map((f, i) => `${i + 1}. ${f}`).join("\n")}

REQUIREMENTS:
- Provide specific dollar amounts with ranges where estimated ($X-Y million)
- Cite all sources with URLs
- Mark findings as [Verified] for official records or [Estimated] for calculations
- If information cannot be found, explain what was searched

Focus on authoritative sources: county property records, SEC filings, news articles, and nonprofit databases.`
}

/**
 * Build search queries for keyword-based search
 */
function buildSearchQueries(
  name: string,
  address?: string,
  focusAreas?: string[]
): string[] {
  const lastName = name.split(" ").slice(-1)[0]
  const queries: string[] = []

  // Always search the person's name
  queries.push(`"${name}"`)

  // Address-based queries
  if (address) {
    queries.push(`"${name}" property "${address}"`)
  }

  // Default to all areas if not specified
  const areas = focusAreas?.length
    ? focusAreas
    : ["real_estate", "business_ownership", "philanthropy", "securities", "biography"]

  if (areas.includes("philanthropy")) {
    queries.push(`"${name}" foundation OR philanthropy OR nonprofit board`)
    queries.push(`"${lastName} Family Foundation"`)
  }

  if (areas.includes("business_ownership")) {
    queries.push(`"${name}" CEO OR founder OR owner company`)
  }

  if (areas.includes("securities")) {
    queries.push(`"${name}" SEC filing OR Form 4 OR insider`)
  }

  // Limit to 5 queries for efficiency
  return queries.slice(0, 5)
}

/**
 * Extract and normalize sources from Parallel search results
 */
function normalizeParallelSources(
  results: Array<{
    url: string
    title?: string | null
    excerpts?: Array<string> | null
    publish_date?: string | null
  }>
): Array<{ name: string; url: string; snippet?: string }> {
  const sources: Array<{ name: string; url: string; snippet?: string }> = []
  const seenUrls = new Set<string>()

  for (const result of results) {
    if (!result.url || seenUrls.has(result.url)) continue
    seenUrls.add(result.url)

    // Extract domain for name if title not provided
    let name = result.title || ""
    if (!name) {
      try {
        name = new URL(result.url).hostname.replace("www.", "")
      } catch {
        name = "Source"
      }
    }

    // Combine excerpts into snippet
    const snippet = result.excerpts?.join(" ").substring(0, 300)

    sources.push({ name, url: result.url, snippet })
  }

  return sources.slice(0, 20) // Limit to 20 sources
}

/**
 * Format Search API results into a research report (legacy fallback)
 */
function formatSearchResultsReport(
  name: string,
  results: Array<{
    url: string
    title?: string | null
    excerpts?: Array<string> | null
    publish_date?: string | null
  }>,
  objective: string
): string {
  if (results.length === 0) {
    return `No results found for "${name}". The search may have been too specific or the prospect has limited online presence.`
  }

  const sections: string[] = []

  sections.push(`## Prospect Research: ${name}\n`)
  sections.push(`Found ${results.length} relevant sources.\n`)

  // Group results by type/domain for better organization
  const propertyResults = results.filter(
    (r) =>
      r.url.includes("zillow") ||
      r.url.includes("redfin") ||
      r.url.includes("realtor") ||
      r.url.includes("property")
  )

  const businessResults = results.filter(
    (r) =>
      r.url.includes("linkedin") ||
      r.url.includes("bloomberg") ||
      r.url.includes("forbes") ||
      r.url.includes("bizjournals") ||
      r.url.includes("crunchbase")
  )

  const philanthropyResults = results.filter(
    (r) =>
      r.url.includes("guidestar") ||
      r.url.includes("candid") ||
      r.url.includes("foundation") ||
      r.url.includes("charity")
  )

  const secResults = results.filter(
    (r) => r.url.includes("sec.gov") || r.url.includes("fec.gov")
  )

  const newsResults = results.filter(
    (r) =>
      r.url.includes("nytimes") ||
      r.url.includes("wsj") ||
      r.url.includes("washington") ||
      r.url.includes("reuters") ||
      r.url.includes("news")
  )

  // Format each section
  if (propertyResults.length > 0) {
    sections.push("### Real Estate\n")
    for (const r of propertyResults.slice(0, 3)) {
      sections.push(`**[${r.title || "Property Record"}](${r.url})**`)
      if (r.excerpts?.length) {
        sections.push(r.excerpts[0].substring(0, 200) + "...\n")
      }
    }
  }

  if (businessResults.length > 0) {
    sections.push("### Business & Professional\n")
    for (const r of businessResults.slice(0, 3)) {
      sections.push(`**[${r.title || "Business Record"}](${r.url})**`)
      if (r.excerpts?.length) {
        sections.push(r.excerpts[0].substring(0, 200) + "...\n")
      }
    }
  }

  if (philanthropyResults.length > 0) {
    sections.push("### Philanthropy\n")
    for (const r of philanthropyResults.slice(0, 3)) {
      sections.push(`**[${r.title || "Foundation/Nonprofit"}](${r.url})**`)
      if (r.excerpts?.length) {
        sections.push(r.excerpts[0].substring(0, 200) + "...\n")
      }
    }
  }

  if (secResults.length > 0) {
    sections.push("### Securities & Political\n")
    for (const r of secResults.slice(0, 3)) {
      sections.push(`**[${r.title || "SEC/FEC Filing"}](${r.url})**`)
      if (r.excerpts?.length) {
        sections.push(r.excerpts[0].substring(0, 200) + "...\n")
      }
    }
  }

  if (newsResults.length > 0) {
    sections.push("### News & Media\n")
    for (const r of newsResults.slice(0, 3)) {
      const date = r.publish_date ? ` (${r.publish_date})` : ""
      sections.push(`**[${r.title || "News Article"}](${r.url})**${date}`)
      if (r.excerpts?.length) {
        sections.push(r.excerpts[0].substring(0, 200) + "...\n")
      }
    }
  }

  // Add any other results not categorized
  const categorizedUrls = new Set([
    ...propertyResults.map((r) => r.url),
    ...businessResults.map((r) => r.url),
    ...philanthropyResults.map((r) => r.url),
    ...secResults.map((r) => r.url),
    ...newsResults.map((r) => r.url),
  ])

  const otherResults = results.filter((r) => !categorizedUrls.has(r.url))
  if (otherResults.length > 0) {
    sections.push("### Additional Sources\n")
    for (const r of otherResults.slice(0, 3)) {
      sections.push(`**[${r.title || "Source"}](${r.url})**`)
      if (r.excerpts?.length) {
        sections.push(r.excerpts[0].substring(0, 200) + "...\n")
      }
    }
  }

  return sections.join("\n")
}

// ============================================================================
// STRUCTURED OUTPUT FORMATTER (Task API)
// ============================================================================

/**
 * Format structured ProspectResearchOutput into markdown report
 * Used for backward compatibility with existing UI expectations
 */
function formatStructuredReport(data: ProspectResearchOutput): string {
  const sections: string[] = []

  // Header with executive summary
  sections.push(`## Prospect Research: ${data.name}\n`)
  sections.push(`${data.summary}\n`)

  // Basic Information
  const basicInfo: string[] = []
  if (data.age) basicInfo.push(`**Age:** ${data.age}`)
  if (data.spouse) basicInfo.push(`**Spouse:** ${data.spouse}`)
  if (basicInfo.length > 0) {
    sections.push("### Basic Information\n")
    sections.push(basicInfo.join(" | ") + "\n")
  }

  // Education
  if (data.education && data.education.length > 0) {
    sections.push("### Education\n")
    for (const edu of data.education) {
      const parts: string[] = []
      if (edu.degree) parts.push(edu.degree)
      parts.push(edu.institution)
      if (edu.year) parts.push(`(${edu.year})`)
      sections.push(`- ${parts.join(", ")}`)
    }
    sections.push("")
  }

  // Real Estate (with verified/estimated markers)
  if (data.realEstate && data.realEstate.length > 0) {
    sections.push("### Real Estate\n")
    for (const prop of data.realEstate) {
      let value = "Value unknown"
      if (prop.estimatedValue) {
        value = `$${formatCurrency(prop.estimatedValue)}`
      } else if (prop.valueLow && prop.valueHigh) {
        value = `$${formatCurrency(prop.valueLow)} - $${formatCurrency(prop.valueHigh)}`
      }
      const marker = prop.isVerified ? "[Verified]" : "[Estimated]"
      sections.push(`- **${prop.address}**: ${value} ${marker}`)
    }
    if (data.totalRealEstateValue) {
      sections.push(`\n**Total Real Estate Value:** $${formatCurrency(data.totalRealEstateValue)} [Estimated]`)
    }
    sections.push("")
  }

  // Business & Professional
  if (data.businesses && data.businesses.length > 0) {
    sections.push("### Business & Professional\n")
    for (const biz of data.businesses) {
      const parts: string[] = [`**${biz.role}**`, biz.name]
      if (biz.isOwner) parts.push("(Owner)")
      if (biz.estimatedRevenue) {
        parts.push(`- ~$${formatCurrency(biz.estimatedRevenue)} revenue`)
      }
      if (biz.industry) parts.push(`[${biz.industry}]`)
      sections.push(`- ${parts.join(" ")}`)
    }
    sections.push("")
  }

  // Securities/SEC Filings
  if (data.securities?.hasSecFilings && data.securities.companies?.length) {
    sections.push("### SEC Filings [Verified]\n")
    for (const company of data.securities.companies) {
      const role = company.role ? ` - ${company.role}` : ""
      sections.push(`- **${company.companyName}** (${company.ticker})${role}`)
    }
    sections.push("")
  }

  // Philanthropy
  const hasPhilanthropy = data.philanthropy && (
    (data.philanthropy.foundations?.length || 0) > 0 ||
    (data.philanthropy.boardMemberships?.length || 0) > 0 ||
    (data.philanthropy.majorGifts?.length || 0) > 0
  )

  if (hasPhilanthropy) {
    sections.push("### Philanthropy\n")

    if (data.philanthropy!.foundations?.length) {
      sections.push("**Foundations:**")
      for (const f of data.philanthropy!.foundations) {
        const role = f.role ? ` (${f.role})` : ""
        const ein = f.ein ? ` [EIN: ${f.ein}]` : ""
        sections.push(`- ${f.name}${role}${ein}`)
      }
    }

    if (data.philanthropy!.boardMemberships?.length) {
      sections.push("\n**Nonprofit Board Memberships:**")
      for (const b of data.philanthropy!.boardMemberships) {
        const role = b.role ? ` (${b.role})` : ""
        sections.push(`- ${b.organization}${role}`)
      }
    }

    if (data.philanthropy!.majorGifts?.length) {
      sections.push("\n**Major Gifts:**")
      for (const g of data.philanthropy!.majorGifts) {
        const amount = g.amount ? `$${formatCurrency(g.amount)}` : "Amount unknown"
        const year = g.year ? ` (${g.year})` : ""
        sections.push(`- ${g.recipient}: ${amount}${year}`)
      }
    }
    sections.push("")
  }

  // Political Giving
  if (data.politicalGiving?.totalAmount) {
    sections.push("### Political Giving\n")
    const party = data.politicalGiving.partyLean ? ` (${data.politicalGiving.partyLean})` : ""
    sections.push(`**Total Contributions:** $${data.politicalGiving.totalAmount.toLocaleString()}${party} [Verified - FEC]`)

    if (data.politicalGiving.recentContributions?.length) {
      sections.push("\n**Recent Contributions:**")
      for (const c of data.politicalGiving.recentContributions.slice(0, 5)) {
        const date = c.date ? ` (${c.date})` : ""
        sections.push(`- ${c.recipient}: $${c.amount.toLocaleString()}${date}`)
      }
    }
    sections.push("")
  }

  // Giving Capacity Rating
  if (data.givingCapacityRating || data.netWorthEstimate) {
    sections.push("### Giving Capacity Analysis\n")

    if (data.givingCapacityRating) {
      const ratingDescriptions: Record<string, string> = {
        A: "$1M+ capacity (major gift prospect)",
        B: "$100K-$1M capacity (leadership gift prospect)",
        C: "$25K-$100K capacity (mid-level donor)",
        D: "Under $25K capacity (annual fund)",
      }
      sections.push(`**Rating:** ${data.givingCapacityRating} - ${ratingDescriptions[data.givingCapacityRating] || ""}`)
    }

    if (data.netWorthEstimate) {
      const low = data.netWorthEstimate.low ? `$${formatCurrency(data.netWorthEstimate.low)}` : "?"
      const high = data.netWorthEstimate.high ? `$${formatCurrency(data.netWorthEstimate.high)}` : "?"
      const confidence = data.netWorthEstimate.confidence ? ` (${data.netWorthEstimate.confidence} confidence)` : ""
      sections.push(`**Estimated Net Worth:** ${low} - ${high}${confidence} [Estimated]`)
    }
  }

  return sections.join("\n")
}

/**
 * Format currency values (e.g., 1500000 → "1.5M")
 */
function formatCurrency(value: number): string {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`
  }
  return value.toLocaleString()
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const parallelProspectResearchSchema = z.object({
  name: z.string().describe("Full name of the prospect to research"),
  address: z.string().optional().describe("Address for property research (optional)"),
  context: z
    .string()
    .optional()
    .describe("Additional context like employer, title, or known affiliations (optional)"),
  focus_areas: z
    .array(
      z.enum([
        "real_estate",
        "business_ownership",
        "philanthropy",
        "securities",
        "biography",
      ])
    )
    .optional()
    .describe("Specific areas to focus research on. Default: all areas"),
})

/**
 * Parallel AI Prospect Research Tool Factory
 *
 * PRODUCTION-GRADE: Uses Task API with structured JSON output for reliable, citation-backed research.
 *
 * @param isDeepResearch - If true, uses `pro` processor for comprehensive research ($0.10/call)
 *                        If false, uses `core` processor for fast, structured results ($0.025/call)
 *
 * ARCHITECTURE:
 * 1. Primary: Task API (structured JSON with field-level citations)
 * 2. Fallback: Search API (raw excerpts) if Task API unavailable
 *
 * COST COMPARISON:
 * - Task API (core): $0.025/call - 5x more expensive but dramatically better quality
 * - Task API (pro):  $0.10/call  - for deep research
 * - Search API:      $0.005/call - fallback for budget-sensitive batch processing
 */
export function createParallelProspectResearchTool(isDeepResearch: boolean = false) {
  const processor = isDeepResearch ? "pro" : "core"
  const modeLabel = isDeepResearch ? "Deep Research" : "Standard"
  const cost = isDeepResearch ? "$0.10" : "$0.025"

  return tool({
    description: isDeepResearch
      ? // CONSTRAINT-FIRST PROMPTING: Deep Research variant (Task API Pro)
        "HARD CONSTRAINTS: " +
        "(1) Execute ONLY after memory + CRM checks, " +
        "(2) Returns STRUCTURED JSON with field-level citations, " +
        "(3) MUST find age, spouse, property values, foundation affiliations. " +
        "CAPABILITY: Comprehensive AI research via Parallel Task API (~30-60s). " +
        "OUTPUT: Structured data with age, realEstate[], businesses[], philanthropy{}, givingCapacityRating. " +
        "SOURCES: Each field includes citation with reasoning. " +
        "COST: $0.10/research (uses Pro processor for maximum accuracy)."
      : // CONSTRAINT-FIRST PROMPTING: Standard variant (Task API Core)
        "HARD CONSTRAINTS: " +
        "(1) Execute ONLY after memory + CRM checks, " +
        "(2) Returns STRUCTURED JSON with field-level citations, " +
        "(3) MUST find age and spouse name. " +
        "CAPABILITY: Fast AI research via Parallel Task API (~15-30s). " +
        "OUTPUT: Structured data with age, realEstate[], businesses[], philanthropy{}, givingCapacityRating. " +
        "ACCESS structuredData field for typed JSON - no parsing needed! " +
        "COST: $0.025/research (uses Core processor for speed + accuracy).",
    parameters: parallelProspectResearchSchema,
    execute: async (params): Promise<ParallelProspectResult> => {
      const { name, address, context, focus_areas } = params
      console.log(`[Parallel ${modeLabel}] Starting research for:`, name)
      const startTime = Date.now()

      // Check if Task API is available (preferred)
      const taskApiStatus = getTaskApiStatus()

      // =====================================================================
      // PRIMARY PATH: Task API (Structured Output)
      // =====================================================================
      if (taskApiStatus.available) {
        console.log(`[Parallel ${modeLabel}] Using Task API (${processor} processor)`)

        try {
          // Parse context into employer/title if provided
          let employer: string | undefined
          let title: string | undefined
          if (context) {
            // Try to extract employer/title from context like "CEO at Acme Corp"
            const atMatch = context.match(/(.+?)\s+at\s+(.+)/i)
            if (atMatch) {
              title = atMatch[1].trim()
              employer = atMatch[2].trim()
            } else {
              employer = context
            }
          }

          // Parse city/state from address if provided
          let city: string | undefined
          let state: string | undefined
          if (address) {
            const addressParts = address.split(",").map((p) => p.trim())
            if (addressParts.length >= 2) {
              // Try to extract city and state from last parts
              const lastPart = addressParts[addressParts.length - 1]
              const stateZipMatch = lastPart.match(/([A-Z]{2})\s+\d{5}/)
              if (stateZipMatch) {
                state = stateZipMatch[1]
                city = addressParts[addressParts.length - 2]
              }
            }
          }

          // Execute Task API research
          const result = await executeProspectResearchTask(
            { name, address, employer, title, city, state },
            {
              focusAreas: focus_areas as Array<"real_estate" | "business" | "philanthropy" | "securities" | "biography"> | undefined,
              processor: processor as "core" | "pro",
            }
          )

          const durationMs = Date.now() - startTime
          console.log(`[Parallel ${modeLabel}] Task API completed in ${durationMs}ms`)
          console.log(`[Parallel ${modeLabel}] Found ${result.sources.length} sources`)

          // Format structured output to markdown for backward compatibility
          let research: string
          let structuredData: ProspectResearchOutput | null = null

          if (result.outputType === "json" && result.output) {
            structuredData = result.output
            research = formatStructuredReport(result.output)
          } else {
            research = result.textOutput || `Research completed for "${name}" but no structured data was returned.`
          }

          // Convert Task API sources to our format (with field attribution)
          const sources = result.sources.map((s) => ({
            name: s.title || extractDomainName(s.url),
            url: s.url,
            snippet: s.excerpts?.join(" ").substring(0, 300),
            fieldName: s.fieldName,
            reasoning: s.reasoning,
          }))

          return {
            prospectName: name,
            research,
            structuredData,
            sources,
            query: `Task API research for ${name}`,
            mode: isDeepResearch ? "deep" : "standard",
            runId: result.runId,
            durationMs,
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error"
          console.warn(`[Parallel ${modeLabel}] Task API failed, falling back to Search API:`, errorMessage)

          // Fall through to Search API fallback
        }
      }

      // =====================================================================
      // FALLBACK PATH: Search API (Raw Excerpts)
      // =====================================================================
      console.log(`[Parallel ${modeLabel}] Using Search API fallback`)

      const status = getParallelStatus()
      if (!status.available) {
        const errorMessage = getParallelAvailabilityMessage()
        return {
          prospectName: name,
          research: `Web research is temporarily unavailable. ${errorMessage}`,
          sources: [],
          query: "",
          mode: isDeepResearch ? "deep" : "standard",
          error: errorMessage,
        }
      }

      try {
        // Build the search objective and queries
        const objective = buildProspectResearchObjective(
          name,
          address,
          context,
          focus_areas
        )
        const searchQueries = buildSearchQueries(name, address, focus_areas)

        // Configure search options
        const searchOptions: ParallelSearchOptions = {
          objective,
          searchQueries,
          maxResults: isDeepResearch ? 20 : 10,
          mode: isDeepResearch ? "one-shot" : "agentic",
          maxCharsPerResult: isDeepResearch ? 1500 : 800,
          blockedDomains: BLOCKED_DOMAINS,
        }

        // Execute the search
        const result = await parallelSearch(searchOptions)

        // Track the call
        trackSearchCall(startTime, result, null, {})

        const durationMs = Date.now() - startTime
        console.log(`[Parallel ${modeLabel}] Search API completed in ${durationMs}ms`)
        console.log(`[Parallel ${modeLabel}] Found ${result.results.length} results`)

        // Format the results
        const research = formatSearchResultsReport(name, result.results, objective)
        const sources = normalizeParallelSources(result.results)

        return {
          prospectName: name,
          research,
          sources,
          query: objective,
          mode: isDeepResearch ? "deep" : "standard",
          searchId: result.search_id,
          durationMs,
        }
      } catch (error) {
        const parallelError = error as ParallelError
        const errorMessage = parallelError.message || "Unknown error"
        const errorCode = parallelError.code || "UNKNOWN_ERROR"

        // Track the failure
        trackSearchCall(startTime, null, { code: errorCode }, {})

        console.error(`[Parallel ${modeLabel}] Research failed:`, errorMessage)

        return {
          prospectName: name,
          research: `Failed to research "${name}": ${errorMessage}`,
          sources: [],
          query: "",
          mode: isDeepResearch ? "deep" : "standard",
          durationMs: Date.now() - startTime,
          error: `Failed to research: ${errorMessage}`,
        }
      }
    },
  })
}

/**
 * Extract domain name from URL for source naming
 */
function extractDomainName(url: string): string {
  try {
    const hostname = new URL(url).hostname
    return hostname.replace(/^www\./, "")
  } catch {
    return "Source"
  }
}

/**
 * Default Parallel Prospect Research Tool (standard mode)
 */
export const parallelProspectResearchTool = createParallelProspectResearchTool(false)

// ============================================================================
// EXTRACT TOOL FOR URL CONTENT
// ============================================================================

/**
 * Validate URL is safe for extraction (prevent SSRF)
 * Only allow http/https URLs to public domains
 */
function isValidExternalUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    // Only allow http and https
    if (!["http:", "https:"].includes(url.protocol)) {
      return false
    }
    // Block internal/private IP ranges
    const hostname = url.hostname.toLowerCase()
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.20.") ||
      hostname.startsWith("172.21.") ||
      hostname.startsWith("172.22.") ||
      hostname.startsWith("172.23.") ||
      hostname.startsWith("172.24.") ||
      hostname.startsWith("172.25.") ||
      hostname.startsWith("172.26.") ||
      hostname.startsWith("172.27.") ||
      hostname.startsWith("172.28.") ||
      hostname.startsWith("172.29.") ||
      hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname === "metadata.google.internal" ||
      hostname === "169.254.169.254" // AWS/GCP metadata service
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}

const parallelExtractSchema = z.object({
  urls: z
    .array(z.string())
    .min(1)
    .max(10)
    .refine(
      (urls) => urls.every(isValidExternalUrl),
      { message: "All URLs must be valid external http/https URLs" }
    )
    .describe("URLs to extract content from (1-10)"),
  objective: z
    .string()
    .optional()
    .describe("Focus extraction on this objective (optional)"),
  full_content: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include full page content instead of just excerpts"),
})

/**
 * Parallel AI URL Content Extraction Tool
 *
 * Extracts relevant content from specific URLs.
 * Replaces Firecrawl for URL content extraction.
 *
 * Cost: $0.001 per page extracted
 */
export const parallelExtractTool = tool({
  description:
    "Extract content from specific URLs. Use when you have URLs from search results " +
    "and need to read the full content. Supports up to 10 URLs per request. " +
    "COST: $0.001/page. Use for: reading full articles, extracting property details, " +
    "reviewing SEC filings, or analyzing any web page content.",
  parameters: parallelExtractSchema,
  execute: async (params) => {
    const { urls, objective, full_content } = params
    console.log(`[Parallel Extract] Extracting ${urls.length} URLs`)
    const startTime = Date.now()

    // Check if Parallel is available
    const status = getParallelStatus()
    if (!status.available) {
      return {
        success: false,
        results: [],
        error: getParallelAvailabilityMessage(),
      }
    }

    try {
      const result = await parallelExtract({
        urls,
        objective,
        fullContent: full_content,
        maxCharsPerResult: full_content ? 10000 : 2000,
      })

      // Track the call
      trackExtractCall(startTime, result, null, {})

      const duration = Date.now() - startTime
      console.log(`[Parallel Extract] Completed in ${duration}ms`)
      console.log(`[Parallel Extract] Extracted ${result.results.length} pages`)

      return {
        success: true,
        extractId: result.extract_id,
        results: result.results.map((r) => ({
          url: r.url,
          title: r.title,
          content: r.full_content || r.excerpts?.join("\n\n") || "",
          publishDate: r.publish_date,
        })),
        errors: result.errors.map((e) => ({
          url: e.url,
          error: e.error_type,
          statusCode: e.http_status_code,
        })),
      }
    } catch (error) {
      const parallelError = error as ParallelError
      const errorCode = parallelError.code || "UNKNOWN_ERROR"

      // Track the failure
      trackExtractCall(startTime, null, { code: errorCode }, {})

      return {
        success: false,
        results: [],
        error: parallelError.message || "Failed to extract URL content",
      }
    }
  },
})

// ============================================================================
// EXPORTS FOR BATCH PROCESSING
// ============================================================================

/**
 * Execute Parallel search for batch processing
 *
 * @param prospect - Prospect information
 * @param mode - Search mode ("standard" or "deep")
 * @returns Search results with sources
 */
export async function parallelProspectSearch(
  prospect: { name: string; address?: string; employer?: string; title?: string },
  mode: "standard" | "deep" = "standard"
): Promise<{
  research: string
  sources: Array<{ name: string; url: string; snippet?: string }>
  searchId?: string
}> {
  const context = [prospect.employer, prospect.title].filter(Boolean).join(", ")
  const objective = buildProspectResearchObjective(
    prospect.name,
    prospect.address,
    context || undefined
  )
  const searchQueries = buildSearchQueries(prospect.name, prospect.address)

  const searchOptions: ParallelSearchOptions = {
    objective,
    searchQueries,
    maxResults: mode === "deep" ? 20 : 10,
    mode: mode === "deep" ? "one-shot" : "agentic",
    maxCharsPerResult: mode === "deep" ? 1500 : 800,
    blockedDomains: BLOCKED_DOMAINS,
  }

  const result = await parallelSearch(searchOptions)

  const research = formatSearchResultsReport(prospect.name, result.results, objective)
  const sources = normalizeParallelSources(result.results)

  return { research, sources, searchId: result.search_id }
}

/**
 * Build optimized query for batch processing
 */
export { buildProspectResearchObjective as buildParallelQuery }
