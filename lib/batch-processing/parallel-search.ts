/**
 * Parallel AI Batch Search Module
 *
 * Production-grade batch prospect research with two execution modes:
 *
 * 1. SEARCH API (Default) - $0.005/call
 *    - Best for: High-volume batch processing, cost-sensitive operations
 *    - Returns: Raw excerpts requiring downstream parsing
 *
 * 2. TASK API (Premium) - $0.01/call (base) or $0.10/call (pro)
 *    - Best for: High-value prospects, accuracy-critical research
 *    - Returns: Structured JSON with field-level citations
 *
 * @see https://docs.parallel.ai/search/search-quickstart
 * @see https://docs.parallel.ai/task-api/task-quickstart
 */

import {
  parallelSearch,
  getParallelStatus,
  type ParallelSearchOptions,
  type ParallelError,
} from "@/lib/parallel/client"
import {
  executeProspectResearchTask,
  getTaskApiStatus,
  type ProspectResearchOutput,
} from "@/lib/parallel/task-api"
import { trackSearchCall } from "@/lib/parallel/monitoring"
import { isParallelAvailable } from "@/lib/feature-flags/parallel-migration"

// ============================================================================
// TYPES
// ============================================================================

export interface ParallelBatchResult {
  research: string
  /** Structured data from Task API (if useTaskApi=true) */
  structuredData?: ProspectResearchOutput | null
  sources: Array<{
    name: string
    url: string
    snippet?: string
    /** Field this source supports (Task API only) */
    fieldName?: string
  }>
  query: string
  searchId?: string
  runId?: string
  tokensUsed: number // Estimated
  durationMs: number
  /** Which API was used: 'search' or 'task' */
  apiUsed: "search" | "task"
  error?: string
}

export interface BatchResearchOptions {
  /** Use Task API for structured output (costs more but better quality) */
  useTaskApi?: boolean
  /** Task API processor: 'base' ($0.01) or 'pro' ($0.10) - default: 'base' */
  processor?: "base" | "pro"
  /** Focus areas to research (default: all) */
  focusAreas?: Array<"real_estate" | "business" | "philanthropy" | "securities" | "biography">
}

export interface ProspectInput {
  name: string
  address?: string
  employer?: string
  title?: string
  city?: string
  state?: string
}

export interface ExtractedParallelData {
  properties: Array<{
    address?: string
    value?: number
    source?: string
  }>
  businesses: Array<{
    name?: string
    role?: string
    value?: number
  }>
  secFilings: {
    hasFilings: boolean
    tickers: string[]
  }
  politicalGiving: {
    total?: number
    partyLean?: string
  }
  foundations: string[]
  majorGifts: Array<{
    organization?: string
    amount?: number
  }>
  age?: number
  education: string[]
  netWorthMentioned?: { low?: number; high?: number }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Domains to exclude from search results (low-quality or irrelevant)
 */
const BLOCKED_DOMAINS = [
  "pinterest.com",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "reddit.com",
  "quora.com",
  "yelp.com",
  "yellowpages.com",
  "whitepages.com",
]

/**
 * Check if Parallel is available for batch processing
 */
export function isParallelBatchAvailable(): boolean {
  const status = getParallelStatus()
  return status.available && !status.searchCircuitOpen
}

// ============================================================================
// OPTIMIZED QUERY BUILDER
// ============================================================================

/**
 * Build a highly optimized objective for Parallel batch search
 *
 * Key optimizations:
 * 1. Natural language objective that leverages Parallel's AI
 * 2. Specific data point requests
 * 3. Multiple search angles (property, business, philanthropy)
 * 4. Disambiguation hints from all available context
 */
export function buildOptimizedBatchObjective(prospect: ProspectInput): string {
  const { name, address, employer, title, city, state } = prospect

  // Build comprehensive location context
  const locationParts = [city, state].filter(Boolean)
  const location = locationParts.join(", ")

  // Build professional context for disambiguation
  const professionalContext = [title, employer].filter(Boolean).join(" at ")

  // Extract first and last name for search variations
  const nameParts = name.trim().split(/\s+/)
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]

  return `Comprehensive nonprofit major donor prospect research for "${name}".

IDENTITY CONTEXT (for disambiguation):
- Full name: ${name}
${address ? `- Address: ${address}` : ""}
${location ? `- Location: ${location}` : ""}
${professionalContext ? `- Professional: ${professionalContext}` : ""}

RESEARCH AREAS:

1. REAL ESTATE (HIGH PRIORITY)
   Find: Property ownership, values, addresses
   Sources: Zillow, Redfin, county assessor records
   Extract: Property addresses, estimated values, purchase prices
   Note: Check for multiple properties (vacation homes, investment properties)

2. BUSINESS OWNERSHIP
   Find: Companies owned/led, executive positions, board seats
   Sources: LinkedIn, Crunchbase, Bloomberg, state business registries
   Extract: Company names, roles, revenue estimates, exits/acquisitions

3. SEC & PUBLIC COMPANY
   Find: Insider status, Form 4 filings, stock holdings
   Sources: SEC EDGAR, Yahoo Finance
   Extract: Company tickers, officer/director status, transaction history

4. POLITICAL GIVING
   Find: FEC contributions, political donations
   Sources: FEC.gov, OpenSecrets
   Extract: Total amount, recipients, party affiliation

5. PHILANTHROPY & FOUNDATIONS
   Find: "${firstName} ${lastName} Foundation", "${lastName} Family Foundation"
   Sources: ProPublica Nonprofit Explorer, GuideStar, Candid
   Extract: Foundation names, board roles, disclosed gifts, causes

6. BIOGRAPHY
   Find: Age, education, career history, family
   Sources: News articles, LinkedIn, Wikipedia
   Extract: Age, degrees/schools, career highlights, spouse name

OUTPUT REQUIREMENTS:
- Cite ALL sources with URLs
- Use dollar RANGES for estimates ($X-$Y million)
- Mark [Verified] for official records, [Estimated] for calculations
- If not found, say "Not found in public records"

Provide a comprehensive research report with specific findings.`
}

/**
 * Build keyword search queries for Parallel
 */
export function buildSearchQueries(prospect: ProspectInput): string[] {
  const { name, address, city, state } = prospect
  const lastName = name.split(" ").slice(-1)[0]
  const location = [city, state].filter(Boolean).join(", ")

  const queries: string[] = [
    `"${name}"`,
    `"${name}" property owner`,
    `"${name}" CEO founder owner`,
    `"${lastName} Family Foundation"`,
  ]

  if (address) {
    queries.push(`"${name}" "${address}"`)
  }

  if (location) {
    queries.push(`"${name}" ${location}`)
  }

  return queries.slice(0, 5)
}

// ============================================================================
// SOURCE NORMALIZATION
// ============================================================================

/**
 * Normalize URL for deduplication
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.replace(/[.,;:!?]$/, ""))
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "")
    let path = parsed.pathname.replace(/\/+$/, "").toLowerCase()
    if (path === "") path = "/"

    const sortedParams = [...parsed.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&")

    return `${hostname}${path}${sortedParams ? `?${sortedParams}` : ""}`
  } catch {
    return url.replace(/[.,;:!?]$/, "").toLowerCase()
  }
}

function normalizeSources(
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
    if (!result.url) continue

    const originalUrl = result.url.replace(/[.,;:!?]$/, "")
    const normalizedKey = normalizeUrl(originalUrl)

    if (seenUrls.has(normalizedKey)) continue
    seenUrls.add(normalizedKey)

    let name = result.title || ""
    if (!name) {
      try {
        name = new URL(originalUrl).hostname.replace("www.", "")
      } catch {
        name = "Source"
      }
    }

    sources.push({
      name,
      url: originalUrl,
      snippet: result.excerpts?.join(" ").substring(0, 300),
    })
  }

  return sources.slice(0, 20)
}

// ============================================================================
// RESEARCH FORMATTING
// ============================================================================

/**
 * Format search results into a structured research report
 */
function formatResearchReport(
  name: string,
  results: Array<{
    url: string
    title?: string | null
    excerpts?: Array<string> | null
    publish_date?: string | null
  }>
): string {
  if (results.length === 0) {
    return `No results found for "${name}". The prospect may have limited online presence.`
  }

  const sections: string[] = []
  sections.push(`## Prospect Research: ${name}\n`)
  sections.push(`Found ${results.length} relevant sources.\n`)

  // Group results by type/domain
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

  // Add uncategorized results
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
// MAIN BATCH SEARCH FUNCTION
// ============================================================================

/**
 * Execute Parallel research optimized for batch processing
 *
 * COST OPTIONS:
 * - Search API (default): $0.005/call - best for high-volume processing
 * - Task API (premium):   $0.025-0.10/call - best for accuracy-critical research
 *
 * @param prospect - Prospect information
 * @param options - Research options (useTaskApi, processor, focusAreas)
 */
export async function parallelBatchSearch(
  prospect: ProspectInput,
  options?: BatchResearchOptions
): Promise<ParallelBatchResult> {
  const startTime = Date.now()
  const { useTaskApi = false, processor = "base", focusAreas } = options ?? {}

  // =========================================================================
  // TASK API PATH (Premium - $0.025-0.10/call)
  // =========================================================================
  if (useTaskApi) {
    const taskApiStatus = getTaskApiStatus()

    if (taskApiStatus.available) {
      console.log(`[Parallel Batch] Using Task API (${processor}) for: ${prospect.name}`)

      try {
        const result = await executeProspectResearchTask(
          prospect,
          { focusAreas, processor }
        )

        const durationMs = Date.now() - startTime

        // Format structured output to markdown
        let research = ""
        let structuredData: ProspectResearchOutput | null = null

        if (result.outputType === "json" && result.output) {
          structuredData = result.output
          research = formatStructuredDataToMarkdown(result.output)
        } else {
          research = result.textOutput || `Research completed for "${prospect.name}"`
        }

        // Convert Task API sources to batch format
        const sources = result.sources.map((s) => ({
          name: s.title || extractDomainName(s.url),
          url: s.url,
          snippet: s.excerpts?.join(" ").substring(0, 300),
          fieldName: s.fieldName,
        }))

        // Estimate tokens
        const tokensUsed = Math.ceil(research.length / 4)

        console.log(`[Parallel Batch] Task API completed in ${durationMs}ms, ${sources.length} sources`)

        return {
          research,
          structuredData,
          sources,
          query: `Task API research for ${prospect.name}`,
          runId: result.runId,
          tokensUsed,
          durationMs,
          apiUsed: "task",
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        console.warn(`[Parallel Batch] Task API failed, falling back to Search API:`, errorMessage)
        // Fall through to Search API
      }
    }
  }

  // =========================================================================
  // SEARCH API PATH (Default - $0.005/call)
  // =========================================================================
  if (!isParallelAvailable()) {
    const status = getParallelStatus()
    return {
      research: "",
      sources: [],
      query: "",
      tokensUsed: 0,
      durationMs: 0,
      apiUsed: "search",
      error: status.reasons.join("; ") || "Parallel AI not available",
    }
  }

  const objective = buildOptimizedBatchObjective(prospect)
  const searchQueries = buildSearchQueries(prospect)

  console.log(`[Parallel Batch] Using Search API for: ${prospect.name}`)

  try {
    const searchOptions: ParallelSearchOptions = {
      objective,
      searchQueries,
      maxResults: 15, // Balanced for batch efficiency
      mode: "agentic", // Token-efficient for batch
      maxCharsPerResult: 800,
      blockedDomains: BLOCKED_DOMAINS,
    }

    const result = await parallelSearch(searchOptions)

    // Track the call
    trackSearchCall(startTime, result, null, {})

    const durationMs = Date.now() - startTime
    const research = formatResearchReport(prospect.name, result.results)
    const sources = normalizeSources(result.results)

    // Estimate tokens (rough approximation)
    const tokensUsed = Math.ceil((objective.length + research.length) / 4)

    console.log(`[Parallel Batch] Search API completed in ${durationMs}ms, ${sources.length} sources`)

    return {
      research,
      sources,
      query: objective,
      searchId: result.search_id,
      tokensUsed,
      durationMs,
      apiUsed: "search",
    }
  } catch (error) {
    const parallelError = error as ParallelError
    const durationMs = Date.now() - startTime
    const errorMessage = parallelError.message || "Unknown error"

    // Track the failure
    trackSearchCall(startTime, null, { code: parallelError.code || "UNKNOWN_ERROR" }, {})

    console.error(`[Parallel Batch] Search API failed for ${prospect.name}:`, errorMessage)

    return {
      research: "",
      sources: [],
      query: objective,
      tokensUsed: Math.ceil(objective.length / 4),
      durationMs,
      apiUsed: "search",
      error: errorMessage,
    }
  }
}

/**
 * Premium batch search using Task API for high-value prospects
 *
 * Cost: $0.01/call (base) or $0.10/call (pro)
 * Best for: High-value prospects where accuracy matters more than cost
 */
export async function parallelBatchSearchPremium(
  prospect: ProspectInput,
  processor: "base" | "pro" = "base"
): Promise<ParallelBatchResult> {
  return parallelBatchSearch(prospect, { useTaskApi: true, processor })
}

/**
 * Format structured output to markdown for backward compatibility
 */
function formatStructuredDataToMarkdown(data: ProspectResearchOutput): string {
  const sections: string[] = []

  sections.push(`## Prospect Research: ${data.name}\n`)
  sections.push(`${data.summary}\n`)

  // Basic Info
  const basicInfo: string[] = []
  if (data.age) basicInfo.push(`**Age:** ${data.age}`)
  if (data.spouse) basicInfo.push(`**Spouse:** ${data.spouse}`)
  if (basicInfo.length > 0) {
    sections.push("### Basic Information\n" + basicInfo.join(" | ") + "\n")
  }

  // Education
  if (data.education?.length) {
    sections.push("### Education\n")
    for (const edu of data.education) {
      const parts = [edu.degree, edu.institution, edu.year ? `(${edu.year})` : null].filter(Boolean)
      sections.push(`- ${parts.join(", ")}`)
    }
    sections.push("")
  }

  // Real Estate
  if (data.realEstate?.length) {
    sections.push("### Real Estate\n")
    for (const prop of data.realEstate) {
      let value = "Value unknown"
      if (prop.estimatedValue) {
        value = `$${formatValue(prop.estimatedValue)}`
      } else if (prop.valueLow && prop.valueHigh) {
        value = `$${formatValue(prop.valueLow)} - $${formatValue(prop.valueHigh)}`
      }
      const marker = prop.isVerified ? "[Verified]" : "[Estimated]"
      sections.push(`- **${prop.address}**: ${value} ${marker}`)
    }
    if (data.totalRealEstateValue) {
      sections.push(`\n**Total:** $${formatValue(data.totalRealEstateValue)}`)
    }
    sections.push("")
  }

  // Businesses
  if (data.businesses?.length) {
    sections.push("### Business & Professional\n")
    for (const biz of data.businesses) {
      const revenue = biz.estimatedRevenue ? ` (~$${formatValue(biz.estimatedRevenue)} revenue)` : ""
      const owner = biz.isOwner ? " (Owner)" : ""
      sections.push(`- **${biz.role}**, ${biz.name}${owner}${revenue}`)
    }
    sections.push("")
  }

  // Securities
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
        sections.push(`- ${f.name}${f.role ? ` (${f.role})` : ""}`)
      }
    }
    if (data.philanthropy!.boardMemberships?.length) {
      sections.push("\n**Board Memberships:**")
      for (const b of data.philanthropy!.boardMemberships) {
        sections.push(`- ${b.organization}${b.role ? ` (${b.role})` : ""}`)
      }
    }
    if (data.philanthropy!.majorGifts?.length) {
      sections.push("\n**Major Gifts:**")
      for (const g of data.philanthropy!.majorGifts) {
        const amount = g.amount ? `$${formatValue(g.amount)}` : "Amount unknown"
        sections.push(`- ${g.recipient}: ${amount}${g.year ? ` (${g.year})` : ""}`)
      }
    }
    sections.push("")
  }

  // Political
  if (data.politicalGiving?.totalAmount) {
    sections.push("### Political Giving\n")
    const party = data.politicalGiving.partyLean ? ` (${data.politicalGiving.partyLean})` : ""
    sections.push(`**Total:** $${data.politicalGiving.totalAmount.toLocaleString()}${party} [Verified - FEC]`)
    sections.push("")
  }

  // Giving Capacity
  if (data.givingCapacityRating || data.netWorthEstimate) {
    sections.push("### Giving Capacity\n")
    if (data.givingCapacityRating) {
      const ratings: Record<string, string> = {
        A: "$1M+ capacity", B: "$100K-$1M capacity", C: "$25K-$100K capacity", D: "Under $25K"
      }
      sections.push(`**Rating:** ${data.givingCapacityRating} - ${ratings[data.givingCapacityRating] || ""}`)
    }
    if (data.netWorthEstimate) {
      const low = data.netWorthEstimate.low ? `$${formatValue(data.netWorthEstimate.low)}` : "?"
      const high = data.netWorthEstimate.high ? `$${formatValue(data.netWorthEstimate.high)}` : "?"
      sections.push(`**Net Worth:** ${low} - ${high}`)
    }
  }

  return sections.join("\n")
}

/**
 * Format large numbers (e.g., 1500000 → "1.5M")
 */
function formatValue(value: number): string {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
  return value.toLocaleString()
}

/**
 * Extract domain name from URL
 */
function extractDomainName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "Source"
  }
}

// ============================================================================
// STRUCTURED DATA EXTRACTION
// ============================================================================

/**
 * Extract structured data from research content
 * Uses pattern matching to find specific wealth indicators
 */
export function extractStructuredDataFromResearch(content: string): ExtractedParallelData {
  const data: ExtractedParallelData = {
    properties: [],
    businesses: [],
    secFilings: { hasFilings: false, tickers: [] },
    politicalGiving: {},
    foundations: [],
    majorGifts: [],
    education: [],
  }

  if (!content) return data

  // ========== PROPERTY EXTRACTION ==========
  const propertyPatterns = [
    /property[^:]*:\s*([^-]+)-[^$]*\$([0-9,.]+[kmb]?)/gi,
    /home[^$]*\$([0-9,.]+[kmb]?)/gi,
    /property[^$]*\$([0-9,.]+[kmb]?)/gi,
    /zestimate[^$]*\$([0-9,.]+[kmb]?)/gi,
    /purchased[^$]*\$([0-9,.]+[kmb]?)/gi,
  ]

  for (const pattern of propertyPatterns) {
    const matches = content.matchAll(pattern)
    for (const match of matches) {
      const valueStr = match[match.length - 1]
      const value = parseValueString(valueStr)
      if (value && value > 50000) {
        data.properties.push({ value })
      }
    }
  }

  // ========== BUSINESS EXTRACTION ==========
  const businessPatterns = [
    /(ceo|founder|owner|president|chairman)\s+(?:of|at)\s+([A-Z][A-Za-z0-9\s&]+(?:Inc|LLC|Corp|Co|Ltd)?)/gi,
    /business[^:]*:\s*([^-]+)-[^:]*:\s*([A-Za-z]+)/gi,
  ]

  for (const pattern of businessPatterns) {
    const matches = content.matchAll(pattern)
    for (const match of matches) {
      if (match[1] && match[2]) {
        data.businesses.push({
          role: match[1].trim(),
          name: match[2].trim(),
        })
      }
    }
  }

  // ========== SEC FILINGS ==========
  const secPatterns = [
    /sec[^a-z]*insider[^a-z]*(?:at|for)\s+([A-Z]{1,5})/gi,
    /form\s*[34][^a-z]*([A-Z]{1,5})/gi,
    /insider\s+(?:at|for)\s+([A-Z]{1,5})/gi,
  ]

  for (const pattern of secPatterns) {
    const matches = content.matchAll(pattern)
    for (const match of matches) {
      const ticker = match[1]?.toUpperCase()
      if (ticker && ticker.length >= 1 && ticker.length <= 5 && !data.secFilings.tickers.includes(ticker)) {
        data.secFilings.tickers.push(ticker)
        data.secFilings.hasFilings = true
      }
    }
  }

  // ========== POLITICAL GIVING ==========
  const politicalPatterns = [
    /political[^$]*\$([0-9,.]+[kmb]?)/gi,
    /fec[^$]*\$([0-9,.]+[kmb]?)/gi,
    /contributions?[^$]*\$([0-9,.]+[kmb]?)/gi,
  ]

  for (const pattern of politicalPatterns) {
    const matches = content.matchAll(pattern)
    for (const match of matches) {
      const value = parseValueString(match[1])
      if (value && (!data.politicalGiving.total || value > data.politicalGiving.total)) {
        data.politicalGiving.total = value
      }
    }
  }

  // ========== FOUNDATIONS ==========
  const foundationPattern = /(?:board|trustee|director)[^a-z]*(?:of|at)\s+([A-Z][A-Za-z\s]+(?:Foundation|Fund|Trust))/gi
  const foundationMatches = content.matchAll(foundationPattern)
  for (const match of foundationMatches) {
    if (match[1] && !data.foundations.includes(match[1].trim())) {
      data.foundations.push(match[1].trim())
    }
  }

  // ========== MAJOR GIFTS ==========
  const giftPatterns = [
    /gift[^$]*\$([0-9,.]+[kmb]?)[^a-z]*(?:to\s+)?([A-Z][A-Za-z\s]+)/gi,
    /donated?\s+\$([0-9,.]+[kmb]?)[^a-z]*(?:to\s+)?([A-Z][A-Za-z\s]+)/gi,
  ]

  for (const pattern of giftPatterns) {
    const matches = content.matchAll(pattern)
    for (const match of matches) {
      const amount = parseValueString(match[1])
      if (amount && amount >= 10000) {
        data.majorGifts.push({
          amount,
          organization: match[2]?.trim(),
        })
      }
    }
  }

  // ========== NET WORTH ==========
  const netWorthPatterns = [
    /net\s*worth[^$]*\$([0-9,.]+[kmb]?)\s*-\s*\$([0-9,.]+[kmb]?)/gi,
    /net\s*worth[^$]*\$([0-9,.]+[kmb]?)/gi,
  ]

  for (const pattern of netWorthPatterns) {
    const matches = content.matchAll(pattern)
    for (const match of matches) {
      const low = parseValueString(match[1])
      const high = match[2] ? parseValueString(match[2]) : low
      if (low && low > 100000) {
        data.netWorthMentioned = { low, high }
        break
      }
    }
  }

  // ========== AGE ==========
  const agePatterns = [/age[:\s]+(\d{2})/gi, /(\d{2})\s*years?\s*old/gi, /born\s+(?:in\s+)?(\d{4})/gi]

  for (const pattern of agePatterns) {
    const match = pattern.exec(content)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > 1900 && num < 2010) {
        data.age = new Date().getFullYear() - num
      } else if (num >= 25 && num <= 100) {
        data.age = num
      }
      break
    }
  }

  // ========== EDUCATION ==========
  const educationPatterns = [
    /(?:graduated|alumni|degree)[^a-z]*(?:from|of)\s+([A-Z][A-Za-z\s]+(?:University|College|School|Institute))/gi,
    /(MBA|PhD|JD|MD|BS|BA|MS|MA)[^a-z]*(?:from|,)\s+([A-Z][A-Za-z\s]+)/gi,
  ]

  for (const pattern of educationPatterns) {
    const matches = content.matchAll(pattern)
    for (const match of matches) {
      const edu = match[match.length - 1]?.trim()
      if (edu && !data.education.includes(edu)) {
        data.education.push(edu)
      }
    }
  }

  return data
}

/**
 * Parse value strings like "$1.5M", "$2,500,000", "850K" into numbers
 */
function parseValueString(str: string): number | undefined {
  if (!str) return undefined

  let cleaned = str.replace(/[$,]/g, "").trim().toLowerCase()

  let multiplier = 1
  if (cleaned.endsWith("k")) {
    multiplier = 1000
    cleaned = cleaned.slice(0, -1)
  } else if (cleaned.endsWith("m")) {
    multiplier = 1000000
    cleaned = cleaned.slice(0, -1)
  } else if (cleaned.endsWith("b")) {
    multiplier = 1000000000
    cleaned = cleaned.slice(0, -1)
  }

  const num = parseFloat(cleaned)
  if (isNaN(num)) return undefined

  return num * multiplier
}

// ============================================================================
// COMPATIBILITY LAYER
// ============================================================================

/**
 * Convert Parallel result to LinkUp-compatible format
 * For backwards compatibility with existing pipeline code
 */
export function toLinkupCompatibleResult(result: ParallelBatchResult): {
  answer: string
  sources: Array<{ name: string; url: string; snippet?: string }>
  query: string
  tokensUsed: number
  durationMs: number
  error?: string
} {
  return {
    answer: result.research,
    sources: result.sources,
    query: result.query,
    tokensUsed: result.tokensUsed,
    durationMs: result.durationMs,
    error: result.error,
  }
}
