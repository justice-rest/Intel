/**
 * LinkUp Prospect Research Tool
 *
 * Production-grade prospect research using LinkUp's search API.
 * Returns structured data with grounded citations for accurate, verifiable reports.
 *
 * KEY INNOVATION: Multi-Query Architecture for Standard Mode
 * ============================================================
 * Instead of one broad query, we execute multiple targeted queries in parallel:
 * - Each query focuses on a specific aspect (property, business, philanthropy, etc.)
 * - Queries are crafted with domain-specific keywords and authoritative sources
 * - Results are aggregated and deduplicated for comprehensive coverage
 *
 * This makes Standard mode (~$0.025 for 5 queries) nearly as good as Deep mode ($0.02)
 * with BETTER precision due to targeted query construction.
 *
 * COST COMPARISON:
 * - Standard (single query): $0.005 - basic results
 * - Standard (multi-query):  $0.025 (5 × $0.005) - comprehensive results
 * - Deep (single query):     $0.02 - comprehensive but slower
 *
 * We use multi-query Standard for best price/performance ratio.
 */

import { tool } from "ai"
import { z } from "zod"
import {
  linkupSearch,
  linkupParallelSearch,
  getLinkUpStatus,
  estimateSearchCost,
  type LinkUpSearchOptions,
  type LinkUpSearchResult,
  type LinkUpError,
} from "@/lib/linkup/client"
import { trackSearchCall } from "@/lib/linkup/monitoring"
import { BLOCKED_DOMAINS } from "@/lib/linkup/config"

// ============================================================================
// TYPES
// ============================================================================

export interface LinkUpProspectResult {
  prospectName: string
  /** Pre-formatted research report */
  research: string
  /** Structured data extracted from research */
  structuredData?: ProspectStructuredData | null
  /** Sources with citations */
  sources: Array<{
    name: string
    url: string
    snippet?: string
    category?: string
  }>
  query: string
  mode: "standard" | "deep"
  /** Duration in milliseconds */
  durationMs?: number
  /** Number of queries executed (for multi-query mode) */
  queryCount?: number
  error?: string
}

/**
 * Structured data schema for prospect research
 * Used for both LinkUp structured output and internal parsing
 */
export interface ProspectStructuredData {
  name: string
  age?: number | null
  spouse?: string | null
  education?: Array<{
    institution: string
    degree?: string | null
    year?: number | null
  }>
  realEstate?: Array<{
    address: string
    estimatedValue?: number | null
    source?: string | null
  }>
  totalRealEstateValue?: number | null
  businesses?: Array<{
    name: string
    role: string
    estimatedRevenue?: number | null
    isOwner?: boolean
  }>
  securities?: {
    hasSecFilings?: boolean
    companies?: Array<{
      ticker: string
      companyName: string
      role?: string | null
    }>
  }
  philanthropy?: {
    foundations?: Array<{
      name: string
      role?: string | null
    }>
    boardMemberships?: Array<{
      organization: string
      role?: string | null
    }>
    majorGifts?: Array<{
      recipient: string
      amount?: number | null
      year?: number | null
    }>
  }
  politicalGiving?: {
    totalAmount?: number | null
    partyLean?: string | null
  }
  netWorthEstimate?: {
    low?: number | null
    high?: number | null
  }
  givingCapacityRating?: "A" | "B" | "C" | "D" | null
  summary: string
}

// ============================================================================
// QUERY BUILDERS
// ============================================================================

/**
 * Build targeted queries for multi-query Standard mode
 *
 * The SECRET to making Standard mode as good as Deep:
 * - Each query is highly specific with domain-appropriate keywords
 * - Queries include authoritative source indicators
 * - Results are comprehensive when aggregated
 */
function buildTargetedQueries(
  name: string,
  address?: string,
  context?: string,
  focusAreas?: string[]
): LinkUpSearchOptions[] {
  const firstName = name.split(" ")[0]
  const lastName = name.split(" ").slice(-1)[0]

  // Parse location from address
  let city = ""
  let state = ""
  if (address) {
    const parts = address.split(",").map((p) => p.trim())
    if (parts.length >= 2) {
      city = parts[parts.length - 2] || ""
      const stateMatch = parts[parts.length - 1]?.match(/([A-Z]{2})/)
      state = stateMatch?.[1] || ""
    }
  }
  const location = [city, state].filter(Boolean).join(", ")

  // Default focus areas if not specified
  const areas = focusAreas?.length
    ? focusAreas
    : ["real_estate", "business", "philanthropy", "securities", "biography"]

  const queries: LinkUpSearchOptions[] = []

  // 1. REAL ESTATE query - highly targeted for property data
  if (areas.includes("real_estate")) {
    const reQuery = address
      ? `Find the property value and real estate holdings for "${name}" at ${address}. Look for Zillow, Redfin, or county assessor records showing home value, purchase price, and any additional properties owned.`
      : `Find all real estate properties owned by "${name}"${location ? ` in ${location}` : ""}. Include property values from Zillow, Redfin, or county assessor records.`

    queries.push({
      query: reQuery,
      depth: "standard",
      outputType: "sourcedAnswer",
      includeInlineCitations: true,
      includeSources: true,
      maxResults: 10,
      excludeDomains: BLOCKED_DOMAINS,
    })
  }

  // 2. BUSINESS query - focused on corporate positions
  if (areas.includes("business")) {
    const bizQuery = `What companies does "${name}" own, lead, or serve as an executive? Find CEO, founder, owner, or board positions${context ? `. Known context: ${context}` : ""}${location ? `. Located in ${location}` : ""}. Include company names, roles, and estimated revenue if available.`

    queries.push({
      query: bizQuery,
      depth: "standard",
      outputType: "sourcedAnswer",
      includeInlineCitations: true,
      includeSources: true,
      maxResults: 10,
      excludeDomains: BLOCKED_DOMAINS,
    })
  }

  // 3. PHILANTHROPY query - foundation and nonprofit connections
  if (areas.includes("philanthropy")) {
    const philQuery = `Find philanthropic activity for "${name}". Search for:
- "${lastName} Family Foundation" or "${firstName} Foundation"
- Nonprofit board memberships
- Major charitable donations or gifts
- Foundation trustee positions
Include ProPublica 990 data, GuideStar, or news articles about donations.`

    queries.push({
      query: philQuery,
      depth: "standard",
      outputType: "sourcedAnswer",
      includeInlineCitations: true,
      includeSources: true,
      maxResults: 10,
      excludeDomains: BLOCKED_DOMAINS,
    })
  }

  // 4. SECURITIES query - SEC filings and public company roles
  if (areas.includes("securities")) {
    const secQuery = `Find SEC filings for "${name}". Look for:
- Form 4 insider trading filings
- Executive compensation in DEF 14A proxy statements
- 10-K/10-Q mentions as officer or director
Include ticker symbols, company names, and roles at public companies.`

    queries.push({
      query: secQuery,
      depth: "standard",
      outputType: "sourcedAnswer",
      includeInlineCitations: true,
      includeSources: true,
      maxResults: 8,
      excludeDomains: BLOCKED_DOMAINS,
    })
  }

  // 5. BIOGRAPHY query - personal details and background
  if (areas.includes("biography")) {
    const bioQuery = `Find biographical information for "${name}"${location ? ` from ${location}` : ""}:
- Age or birth year
- Spouse or partner name
- Education (university, degree, graduation year)
- Career history and notable achievements
Focus on authoritative sources like LinkedIn, news profiles, or university alumni.`

    queries.push({
      query: bioQuery,
      depth: "standard",
      outputType: "sourcedAnswer",
      includeInlineCitations: true,
      includeSources: true,
      maxResults: 8,
      excludeDomains: BLOCKED_DOMAINS,
    })
  }

  return queries
}

/**
 * Build a single comprehensive query for Deep mode
 */
function buildDeepQuery(
  name: string,
  address?: string,
  context?: string
): string {
  const lastName = name.split(" ").slice(-1)[0]

  return `Research "${name}" for nonprofit major donor prospect research.

${address ? `Known address: ${address}` : ""}
${context ? `Additional context: ${context}` : ""}

RESEARCH OBJECTIVES - Find ALL of the following:

1. REAL ESTATE: Property values from Zillow, Redfin, or county records. Include address, estimated value, and any additional properties.

2. BUSINESS: Companies owned or led. Look for CEO, founder, owner positions. Include company names, roles, and estimated revenue.

3. PHILANTHROPY:
   - Search for "${lastName} Family Foundation" or similar
   - Nonprofit board memberships
   - Major charitable gifts with amounts
   - Foundation roles (trustee, director)

4. SECURITIES: SEC Form 4 filings, insider status at public companies. Include ticker symbols and roles.

5. BIOGRAPHY: Age, spouse name, education (school, degree, year), career history.

6. POLITICAL GIVING: FEC contributions with total amount and party lean.

REQUIREMENTS:
- Provide specific dollar amounts where found
- Cite all sources with URLs
- Mark findings as verified or estimated
- If information cannot be found, note what was searched`
}

// ============================================================================
// RESULT AGGREGATION
// ============================================================================

/**
 * Aggregate results from multiple queries into a comprehensive report
 */
function aggregateResults(
  name: string,
  results: LinkUpSearchResult[],
  allSources: Array<{ name: string; url: string; snippet?: string }>
): { research: string; structuredData: ProspectStructuredData | null } {
  const sections: string[] = []

  sections.push(`## Prospect Research: ${name}\n`)

  // Aggregate all answers
  const answers = results
    .map((r) => r.answer)
    .filter((a) => a && a.length > 20)

  if (answers.length === 0) {
    return {
      research: `## Prospect Research: ${name}\n\nNo information found for this prospect. The search returned no results.`,
      structuredData: null,
    }
  }

  // Combine answers, removing obvious duplicates
  const seenSentences = new Set<string>()
  const uniqueContent: string[] = []

  for (const answer of answers) {
    if (!answer) continue
    // Split into paragraphs and dedupe
    const paragraphs = answer.split(/\n\n+/)
    for (const para of paragraphs) {
      const normalized = para.toLowerCase().trim().substring(0, 100)
      if (!seenSentences.has(normalized) && para.trim().length > 30) {
        seenSentences.add(normalized)
        uniqueContent.push(para.trim())
      }
    }
  }

  sections.push(uniqueContent.join("\n\n"))

  // Add sources section
  if (allSources.length > 0) {
    sections.push("\n---\n")
    sections.push("### Sources\n")
    for (const source of allSources.slice(0, 15)) {
      sections.push(`- [${source.name}](${source.url})`)
    }
  }

  // Try to extract structured data from the combined content
  const structuredData = extractStructuredData(name, uniqueContent.join("\n\n"))

  return {
    research: sections.join("\n"),
    structuredData,
  }
}

/**
 * Extract structured data from research text using regex patterns
 */
function extractStructuredData(name: string, text: string): ProspectStructuredData {
  const structured: ProspectStructuredData = {
    name,
    summary: text.substring(0, 500) + (text.length > 500 ? "..." : ""),
  }

  // Extract age
  const ageMatch = text.match(/(?:age|aged?|born|is)\s*(?:in\s+)?(\d{2,3})(?:\s+years)?/i)
  if (ageMatch) {
    const age = parseInt(ageMatch[1], 10)
    if (age > 18 && age < 120) {
      structured.age = age
    }
  }

  // Extract spouse
  const spouseMatch = text.match(/(?:spouse|wife|husband|partner|married to)\s*(?:is\s+)?["']?([A-Z][a-z]+ [A-Z][a-z]+)/i)
  if (spouseMatch) {
    structured.spouse = spouseMatch[1]
  }

  // Extract property values
  const propertyMatches = text.matchAll(/\$([0-9,]+(?:\.[0-9]+)?)\s*(?:million|M|K)?\s*(?:home|property|house|estate|residence)/gi)
  const properties: Array<{ address: string; estimatedValue: number }> = []
  let totalRE = 0
  for (const match of propertyMatches) {
    const value = parseMoneyValue(match[0])
    if (value > 50000) {
      properties.push({ address: "Property", estimatedValue: value })
      totalRE += value
    }
  }
  if (properties.length > 0) {
    structured.realEstate = properties
    structured.totalRealEstateValue = totalRE
  }

  // Extract businesses
  const bizMatches = text.matchAll(/(?:CEO|founder|owner|president|chairman)\s+(?:of\s+)?["']?([A-Z][A-Za-z\s&]+?)["']?(?:\.|,|\s+and|\s+with)/gi)
  const businesses: Array<{ name: string; role: string }> = []
  for (const match of bizMatches) {
    const bizName = match[1].trim()
    if (bizName.length > 2 && bizName.length < 50) {
      businesses.push({ name: bizName, role: match[0].split(/\s+/)[0] })
    }
  }
  if (businesses.length > 0) {
    structured.businesses = businesses
  }

  // Extract SEC mentions
  const secMatch = text.match(/SEC|Form 4|insider|10-K|10-Q|proxy/i)
  if (secMatch) {
    structured.securities = { hasSecFilings: true }
    const tickerMatches = text.matchAll(/\(([A-Z]{1,5})\)|\b([A-Z]{2,5})\s+stock/g)
    const companies: Array<{ ticker: string; companyName: string }> = []
    for (const match of tickerMatches) {
      const ticker = match[1] || match[2]
      if (ticker && ticker.length <= 5) {
        companies.push({ ticker, companyName: ticker })
      }
    }
    if (companies.length > 0) {
      structured.securities.companies = companies
    }
  }

  // Extract philanthropy
  const foundationMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Family\s+)?Foundation/g)
  if (foundationMatch) {
    structured.philanthropy = {
      foundations: foundationMatch.map((f) => ({ name: f })),
    }
  }

  // Extract political giving
  const fecMatch = text.match(/\$([0-9,]+)\s*(?:to|in)\s*(?:political|FEC|campaign|contributions)/i)
  if (fecMatch) {
    const amount = parseMoneyValue(fecMatch[0])
    structured.politicalGiving = { totalAmount: amount }
    const partyMatch = text.match(/(Republican|Democrat|Democratic|GOP)/i)
    if (partyMatch) {
      structured.politicalGiving.partyLean = partyMatch[1].toUpperCase().includes("REPUB") ? "REPUBLICAN" : "DEMOCRATIC"
    }
  }

  // Calculate giving capacity rating
  const totalWealth = (structured.totalRealEstateValue || 0) +
    (structured.businesses?.length || 0) * 1000000 // Estimate $1M per business
  if (totalWealth >= 5000000) {
    structured.givingCapacityRating = "A"
  } else if (totalWealth >= 1000000) {
    structured.givingCapacityRating = "B"
  } else if (totalWealth >= 250000) {
    structured.givingCapacityRating = "C"
  } else {
    structured.givingCapacityRating = "D"
  }

  return structured
}

/**
 * Parse money values from text (e.g., "$1.5 million" -> 1500000)
 */
function parseMoneyValue(text: string): number {
  const match = text.match(/\$?([0-9,]+(?:\.[0-9]+)?)\s*(million|M|billion|B|K|thousand)?/i)
  if (!match) return 0

  let value = parseFloat(match[1].replace(/,/g, ""))
  const multiplier = (match[2] || "").toLowerCase()

  if (multiplier.includes("billion") || multiplier === "b") {
    value *= 1000000000
  } else if (multiplier.includes("million") || multiplier === "m") {
    value *= 1000000
  } else if (multiplier.includes("thousand") || multiplier === "k") {
    value *= 1000
  }

  return value
}

// ============================================================================
// CHECK FUNCTIONS
// ============================================================================

/**
 * Check if LinkUp tools should be enabled
 */
export function shouldEnableLinkUpTools(): boolean {
  return getLinkUpStatus().available
}

/**
 * Get LinkUp availability message for error handling
 */
export function getLinkUpAvailabilityMessage(): string {
  const status = getLinkUpStatus()

  if (!status.configured) {
    return "LinkUp is not configured. Please set LINKUP_API_KEY in your environment."
  }

  if (status.circuitOpen) {
    return "LinkUp search is temporarily unavailable due to high error rates. Please try again later."
  }

  return "LinkUp is available."
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const linkupProspectResearchSchema = z.object({
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
        "business",
        "philanthropy",
        "securities",
        "biography",
      ])
    )
    .optional()
    .describe("Specific areas to focus research on. Default: all areas"),
})

/**
 * LinkUp Prospect Research Tool Factory
 *
 * Creates a tool for comprehensive prospect research.
 *
 * @param useDeepMode - If true, uses deep mode (slower but more comprehensive)
 *                      If false, uses multi-query standard mode (recommended)
 */
export function createLinkUpProspectResearchTool(useDeepMode: boolean = false) {
  const modeLabel = useDeepMode ? "Deep Research" : "Research"

  return tool({
    description: useDeepMode
      ? // Deep Research mode
        "HARD CONSTRAINTS: " +
        "(1) Execute ONLY after memory + CRM checks, " +
        "(2) Returns comprehensive research with inline citations, " +
        "(3) Searches real estate, business, philanthropy, securities, biography. " +
        "CAPABILITY: Deep AI-powered web research via LinkUp (~30-60s). " +
        "OUTPUT: Detailed findings with sources for each claim. " +
        "COST: Uses deep search for maximum comprehensiveness."
      : // Standard Research mode (multi-query)
        "HARD CONSTRAINTS: " +
        "(1) Execute ONLY after memory + CRM checks, " +
        "(2) Returns research with inline citations, " +
        "(3) Searches real estate, business, philanthropy, securities, biography. " +
        "CAPABILITY: Fast AI-powered web research via LinkUp (~15-30s). " +
        "OUTPUT: Comprehensive findings with sources. " +
        "Uses multi-query architecture for best price/performance.",
    parameters: linkupProspectResearchSchema,
    execute: async (params): Promise<LinkUpProspectResult> => {
      const { name, address, context, focus_areas } = params
      console.log(`[LinkUp ${modeLabel}] Starting research for:`, name)
      const startTime = Date.now()

      // Check availability
      const status = getLinkUpStatus()
      if (!status.available) {
        return {
          prospectName: name,
          research: `Web research is temporarily unavailable. ${getLinkUpAvailabilityMessage()}`,
          sources: [],
          query: "",
          mode: useDeepMode ? "deep" : "standard",
          error: getLinkUpAvailabilityMessage(),
        }
      }

      try {
        if (useDeepMode) {
          // ===============================================================
          // DEEP MODE: Single comprehensive query
          // ===============================================================
          const query = buildDeepQuery(name, address, context)

          const result = await linkupSearch({
            query,
            depth: "deep",
            outputType: "sourcedAnswer",
            includeInlineCitations: true,
            includeSources: true,
            maxResults: 20,
            excludeDomains: BLOCKED_DOMAINS,
          })

          const durationMs = Date.now() - startTime
          console.log(`[LinkUp Deep] Completed in ${durationMs}ms`)

          // Track the call
          trackSearchCall(startTime, "deep", result.sources?.length || 0, null)

          // Format research
          const sections: string[] = []
          sections.push(`## Prospect Research: ${name}\n`)
          sections.push(result.answer || "No information found.")

          if (result.sources && result.sources.length > 0) {
            sections.push("\n---\n")
            sections.push("### Sources\n")
            for (const source of result.sources) {
              sections.push(`- [${source.name}](${source.url})`)
            }
          }

          const research = sections.join("\n")
          const structuredData = extractStructuredData(name, result.answer || "")

          return {
            prospectName: name,
            research,
            structuredData,
            sources: (result.sources || []).map((s) => ({
              name: s.name,
              url: s.url,
              snippet: s.snippet,
            })),
            query,
            mode: "deep",
            durationMs,
            queryCount: 1,
          }
        } else {
          // ===============================================================
          // STANDARD MODE: Multi-query parallel execution
          // This is the KEY INNOVATION that makes Standard as good as Deep
          // ===============================================================
          const queries = buildTargetedQueries(name, address, context, focus_areas)

          console.log(`[LinkUp Standard] Executing ${queries.length} parallel queries`)

          const { results, aggregatedSources, successCount, errorCount } =
            await linkupParallelSearch(queries)

          const durationMs = Date.now() - startTime
          console.log(`[LinkUp Standard] Completed in ${durationMs}ms (${successCount} success, ${errorCount} errors)`)

          // Track each successful query
          for (let i = 0; i < successCount; i++) {
            trackSearchCall(startTime, "standard", results[i]?.sources?.length || 0, null)
          }

          // Aggregate results
          const { research, structuredData } = aggregateResults(name, results, aggregatedSources)

          // Categorize sources by type
          const categorizedSources = aggregatedSources.map((s) => {
            let category = "other"
            const url = s.url.toLowerCase()
            if (url.includes("sec.gov") || url.includes("edgar")) category = "securities"
            else if (url.includes("zillow") || url.includes("redfin") || url.includes("realtor") || url.includes("property")) category = "real_estate"
            else if (url.includes("linkedin") || url.includes("bloomberg") || url.includes("forbes")) category = "business"
            else if (url.includes("fec.gov")) category = "political"
            else if (url.includes("foundation") || url.includes("guidestar") || url.includes("propublica")) category = "philanthropy"
            return { ...s, category }
          })

          return {
            prospectName: name,
            research,
            structuredData,
            sources: categorizedSources,
            query: `Multi-query research for ${name}`,
            mode: "standard",
            durationMs,
            queryCount: queries.length,
          }
        }
      } catch (error) {
        const linkupError = error as LinkUpError
        const errorMessage = linkupError.message || "Unknown error"
        const errorCode = linkupError.code || "UNKNOWN_ERROR"

        // Track the failure
        trackSearchCall(startTime, useDeepMode ? "deep" : "standard", 0, { code: errorCode })

        console.error(`[LinkUp ${modeLabel}] Research failed:`, errorMessage)

        return {
          prospectName: name,
          research: `Failed to research "${name}": ${errorMessage}`,
          sources: [],
          query: "",
          mode: useDeepMode ? "deep" : "standard",
          durationMs: Date.now() - startTime,
          error: errorMessage,
        }
      }
    },
  })
}

/**
 * Default LinkUp Prospect Research Tool (standard multi-query mode)
 */
export const linkupProspectResearchTool = createLinkUpProspectResearchTool(false)

// ============================================================================
// BATCH PROCESSING EXPORT
// ============================================================================

/**
 * Execute LinkUp research for batch processing
 *
 * Uses Standard mode with multi-query for best price/performance.
 *
 * @param prospect - Prospect information
 * @returns Research results with sources
 */
export async function linkupBatchSearch(
  prospect: { name: string; address?: string; employer?: string; title?: string },
): Promise<{
  research: string
  structuredData: ProspectStructuredData | null
  sources: Array<{ name: string; url: string; snippet?: string }>
  durationMs: number
  queryCount: number
  error?: string
}> {
  const startTime = Date.now()
  const context = [prospect.employer, prospect.title].filter(Boolean).join(", ")

  // Check availability
  const status = getLinkUpStatus()
  if (!status.available) {
    return {
      research: `Web research unavailable: ${getLinkUpAvailabilityMessage()}`,
      structuredData: null,
      sources: [],
      durationMs: Date.now() - startTime,
      queryCount: 0,
      error: getLinkUpAvailabilityMessage(),
    }
  }

  try {
    // Build targeted queries (always use standard for batch)
    const queries = buildTargetedQueries(
      prospect.name,
      prospect.address,
      context || undefined
    )

    console.log(`[LinkUp Batch] Executing ${queries.length} queries for ${prospect.name}`)

    const { results, aggregatedSources, successCount, errorCount } =
      await linkupParallelSearch(queries)

    const durationMs = Date.now() - startTime
    console.log(`[LinkUp Batch] Completed in ${durationMs}ms (${successCount}/${queries.length} success)`)

    // Track calls
    for (let i = 0; i < successCount; i++) {
      trackSearchCall(startTime, "standard", results[i]?.sources?.length || 0, null)
    }

    // If all queries failed
    if (successCount === 0) {
      return {
        research: `Research failed for "${prospect.name}". All ${queries.length} queries returned errors.`,
        structuredData: null,
        sources: [],
        durationMs,
        queryCount: queries.length,
        error: `All ${queries.length} queries failed`,
      }
    }

    // Aggregate results
    const { research, structuredData } = aggregateResults(prospect.name, results, aggregatedSources)

    return {
      research,
      structuredData,
      sources: aggregatedSources,
      durationMs,
      queryCount: queries.length,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[LinkUp Batch] Research failed for ${prospect.name}:`, errorMessage)

    return {
      research: `Research failed for "${prospect.name}": ${errorMessage}`,
      structuredData: null,
      sources: [],
      durationMs: Date.now() - startTime,
      queryCount: 0,
      error: errorMessage,
    }
  }
}
