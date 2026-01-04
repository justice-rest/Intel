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
 * SUPERCHARGED PROMPTING STRATEGY:
 * ================================
 * Each query is EXTENSIVELY crafted with:
 * - Multiple search angle variations
 * - Specific authoritative source targeting
 * - Domain-specific terminology and keywords
 * - Fallback search patterns for disambiguation
 * - Value extraction triggers for dollar amounts
 * - Cross-reference hints for data triangulation
 *
 * The goal: Extract MAXIMUM intelligence from each query
 */
function buildTargetedQueries(
  name: string,
  address?: string,
  context?: string,
  focusAreas?: string[]
): LinkUpSearchOptions[] {
  const nameParts = name.trim().split(/\s+/)
  const firstName = nameParts[0] || ""
  const lastName = nameParts[nameParts.length - 1] || ""
  const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : ""
  const initials = nameParts.map(p => p[0]).join("")

  // Parse location from address with maximum detail extraction
  let streetAddress = ""
  let city = ""
  let state = ""
  let zip = ""
  if (address) {
    const parts = address.split(",").map((p) => p.trim())
    if (parts.length >= 1) streetAddress = parts[0] || ""
    if (parts.length >= 2) city = parts[parts.length - 2] || ""
    if (parts.length >= 1) {
      const lastPart = parts[parts.length - 1] || ""
      const stateMatch = lastPart.match(/([A-Z]{2})/)
      state = stateMatch?.[1] || ""
      const zipMatch = lastPart.match(/(\d{5}(-\d{4})?)/)
      zip = zipMatch?.[1] || ""
    }
  }
  const location = [city, state].filter(Boolean).join(", ")
  const fullLocation = [city, state, zip].filter(Boolean).join(" ")

  // Default focus areas if not specified
  const areas = focusAreas?.length
    ? focusAreas
    : ["real_estate", "business", "philanthropy", "securities", "biography"]

  const queries: LinkUpSearchOptions[] = []

  // =========================================================================
  // 1. REAL ESTATE INTELLIGENCE - EXTENSIVE PROPERTY RESEARCH
  // =========================================================================
  if (areas.includes("real_estate")) {
    const reQuery = `COMPREHENSIVE REAL ESTATE RESEARCH for "${name}"${address ? ` at "${address}"` : ""}${location ? ` in ${location}` : ""}

CRITICAL SEARCH OBJECTIVES - Find ALL of the following:

**PRIMARY RESIDENCE:**
${address ? `- Search Zillow, Redfin, Realtor.com, Trulia for "${streetAddress}" - get EXACT current estimated value, Zestimate, last sale price and date
- Search county assessor/property appraiser records for "${city}" "${state}" - get assessed value, tax records, lot size, square footage
- Search "${lastName}" property records in "${city}" county recorder's office` : `- Search "${name}" property ownership records in any available county databases`}

**ADDITIONAL PROPERTIES (CRITICAL FOR WEALTH ASSESSMENT):**
- Search "${firstName} ${lastName}" OR "${initials} ${lastName}" property records across:
  * Florida (vacation homes): Palm Beach, Miami-Dade, Collier County
  * California (investment): Los Angeles, San Francisco, San Diego County
  * New York (urban): Manhattan, Hamptons, Westchester
  * Colorado (ski): Aspen, Vail, Telluride
  * Any state where "${lastName}" family properties might exist

**VALUE INDICATORS TO EXTRACT:**
- Current market value (Zillow Zestimate, Redfin Estimate)
- Last sale price and date
- Property tax amount (indicates assessed value)
- Lot size and square footage
- Property type (single family, condo, land, commercial)
- Mortgage information if available

**SEARCH PATTERNS:**
- "${name}" property owner
- "${lastName}, ${firstName}" deed records
- "${firstName} ${lastName}" real estate holdings
- "${lastName} family" properties "${state}"

REPORT FORMAT: List each property with address, estimated value (with source), and property type. Calculate total real estate portfolio value.`

    queries.push({
      query: reQuery,
      depth: "standard",
      outputType: "sourcedAnswer",
      includeInlineCitations: true,
      includeSources: true,
      maxResults: 15,
      excludeDomains: BLOCKED_DOMAINS,
    })
  }

  // =========================================================================
  // 2. BUSINESS INTELLIGENCE - CORPORATE OWNERSHIP & EXECUTIVE POSITIONS
  // =========================================================================
  if (areas.includes("business")) {
    const bizQuery = `COMPREHENSIVE BUSINESS INTELLIGENCE for "${name}"${context ? ` (Known: ${context})` : ""}${location ? ` based in ${location}` : ""}

CRITICAL SEARCH OBJECTIVES - Find ALL of the following:

**BUSINESS OWNERSHIP (MOST IMPORTANT FOR WEALTH):**
- Search OpenCorporates, state business registries for companies where "${name}" is:
  * Owner, Member, Manager (LLC)
  * President, CEO, Chairman
  * Registered Agent
  * Director, Officer
- Search "${lastName}" + "LLC" OR "Inc" OR "Corp" OR "LP" OR "Partners"
- Search "${firstName} ${lastName} Enterprises" OR "${lastName} Holdings" OR "${lastName} Investments"
${location ? `- Search ${state} Secretary of State business database for "${lastName}"` : ""}

**EXECUTIVE POSITIONS:**
- Search LinkedIn for "${name}" current and past positions
- Search Bloomberg, Forbes, Business Insider executive profiles
- Search press releases mentioning "${name}" + "CEO" OR "President" OR "Founder"
- Search Crunchbase, PitchBook for startup/investor profiles

**REVENUE & VALUATION INDICATORS:**
- Company revenue estimates from ZoomInfo, Dun & Bradstreet, Hoovers
- Funding rounds if startup (Crunchbase, TechCrunch)
- Acquisition news or IPO filings
- Employee count (LinkedIn company pages)
- Industry benchmarks for valuation multiples

**BOARD POSITIONS (INDICATES NETWORK & COMPENSATION):**
- Search corporate board memberships
- Search advisory board positions
- Search investment committee roles

**KEY SEARCH PATTERNS:**
- "${name}" CEO OR founder OR owner OR president
- "${lastName}" business owner "${city}"
- "${firstName} ${lastName}" company
- "${name}" entrepreneur OR investor

REPORT FORMAT: List each business with company name, role/title, estimated revenue or valuation, industry, and years involved. Flag if they are majority owner vs employee.`

    queries.push({
      query: bizQuery,
      depth: "standard",
      outputType: "sourcedAnswer",
      includeInlineCitations: true,
      includeSources: true,
      maxResults: 15,
      excludeDomains: BLOCKED_DOMAINS,
    })
  }

  // =========================================================================
  // 3. PHILANTHROPIC INTELLIGENCE - FOUNDATIONS, BOARDS, MAJOR GIFTS
  // =========================================================================
  if (areas.includes("philanthropy")) {
    const philQuery = `COMPREHENSIVE PHILANTHROPIC RESEARCH for "${name}"${location ? ` from ${location}` : ""}

CRITICAL SEARCH OBJECTIVES - Find ALL of the following:

**PRIVATE FOUNDATIONS (STRONGEST WEALTH INDICATOR):**
- Search IRS Form 990-PF filings on ProPublica Nonprofit Explorer for:
  * "${lastName} Family Foundation"
  * "${firstName} ${lastName} Foundation"
  * "${firstName} and [Spouse] ${lastName} Foundation"
  * "${lastName} Charitable Trust"
  * "${lastName} Family Fund"
- Extract: Total assets, annual grants, trustees, grant recipients
- Search Foundation Directory Online, Candid/GuideStar for "${lastName}" foundations

**NONPROFIT BOARD MEMBERSHIPS (INDICATES CAPACITY & INTERESTS):**
- Search Form 990 Part VII (officers/directors) for "${name}"
- Search charity websites for board/trustee listings mentioning "${name}"
- Search university boards: "${name}" trustee OR regent OR overseer
- Search hospital/medical center boards
- Search museum, symphony, opera, ballet boards
- Search private school boards

**MAJOR GIFTS & DONATIONS:**
- Search news: "${name}" donation OR gift OR pledge OR endowment
- Search university press releases: "${lastName}" gift OR scholarship
- Search named buildings, wings, centers: "${lastName}" building OR hall OR center
- Search donor walls, annual reports mentioning "${name}"
- Search capital campaign announcements

**DONOR-ADVISED FUNDS:**
- Search for "${lastName}" DAF at Fidelity Charitable, Schwab Charitable, Vanguard Charitable
- Look for grants FROM DAFs to nonprofits mentioning "${lastName}"

**POLITICAL GIVING (FEC DATA):**
- Search FEC.gov individual contributions for "${name}" "${city}" "${state}"
- Extract: Total contributions, party lean, candidate/PAC recipients
- Note: 6-figure political giving indicates 7-figure capacity

**CAUSE AFFINITIES (FOR CULTIVATION):**
- What causes do they support? (education, healthcare, arts, environment, religion)
- What organizations have they supported historically?

REPORT FORMAT: List all foundation affiliations with assets, all board positions with org type, all known gifts with amounts and recipients, total political giving with party lean.`

    queries.push({
      query: philQuery,
      depth: "standard",
      outputType: "sourcedAnswer",
      includeInlineCitations: true,
      includeSources: true,
      maxResults: 15,
      excludeDomains: BLOCKED_DOMAINS,
    })
  }

  // =========================================================================
  // 4. SECURITIES INTELLIGENCE - SEC FILINGS & PUBLIC COMPANY AFFILIATIONS
  // =========================================================================
  if (areas.includes("securities")) {
    const secQuery = `COMPREHENSIVE SEC & SECURITIES RESEARCH for "${name}"

CRITICAL SEARCH OBJECTIVES - Find ALL of the following:

**SEC EDGAR FILINGS (VERIFIED WEALTH INDICATORS):**

Form 4 (Insider Trading) - MOST IMPORTANT:
- Search SEC EDGAR for "${name}" Form 4 filings
- Search "${lastName}, ${firstName}" insider transactions
- Extract: Company ticker, shares owned, transaction values, current holdings
- Calculate total value of insider holdings

Form 3 (Initial Beneficial Ownership):
- Search for new officer/director appointments
- Identifies public company affiliations

DEF 14A (Proxy Statements) - EXECUTIVE COMPENSATION:
- Search proxy statements for "${name}" executive compensation
- Extract: Base salary, bonus, stock awards, total compensation
- Look for "Named Executive Officers" (NEO) tables

Schedule 13D/13G (Beneficial Ownership >5%):
- Search for "${name}" OR "${lastName}" as beneficial owner
- Indicates significant stock positions

**PUBLIC COMPANY BOARD POSITIONS:**
- Search "${name}" director OR board member + NYSE OR NASDAQ
- Look for board committee memberships (audit, compensation, nominating)
- Board fees typically $200K-$500K+ per year

**STOCK HOLDINGS CALCULATION:**
- Sum all Form 4 holdings by ticker
- Apply current stock prices for total portfolio value
- Note any large sales (liquidity event = ask opportunity)

**10-K/10-Q MENTIONS:**
- Search annual/quarterly reports for "${name}" as officer
- Extract business segment information

**KEY SEARCH PATTERNS:**
- SEC EDGAR "${name}"
- "${lastName}" Form 4 insider
- "${name}" executive compensation proxy
- "${lastName}" beneficial owner 13D

REPORT FORMAT: List each public company affiliation with ticker symbol, role, shares owned, estimated value of holdings, and any recent transactions. Calculate total public securities portfolio value.`

    queries.push({
      query: secQuery,
      depth: "standard",
      outputType: "sourcedAnswer",
      includeInlineCitations: true,
      includeSources: true,
      maxResults: 12,
      excludeDomains: BLOCKED_DOMAINS,
    })
  }

  // =========================================================================
  // 5. BIOGRAPHICAL INTELLIGENCE - PERSONAL & PROFESSIONAL BACKGROUND
  // =========================================================================
  if (areas.includes("biography")) {
    const bioQuery = `COMPREHENSIVE BIOGRAPHICAL RESEARCH for "${name}"${location ? ` from ${location}` : ""}

CRITICAL SEARCH OBJECTIVES - Find ALL of the following:

**PERSONAL DETAILS:**
- Age or birth year (look for birthday announcements, class years)
- Search: "${name}" age OR born OR birthday
- Calculate from graduation year if available (typically 22 at college graduation)

**SPOUSE/PARTNER (CRITICAL FOR JOINT CAPACITY):**
- Search: "${name}" wife OR husband OR spouse OR married OR partner
- Search wedding announcements: "${lastName}" wedding "${city}"
- Search: "${firstName} and [spouse first name] ${lastName}"
- Note: Spouse's career may significantly impact household wealth

**EDUCATION (INDICATES NETWORK & CAPACITY):**
- Search: "${name}" alumni OR graduated OR degree OR class of
- Universities to check: Ivy League, Stanford, MIT, top 50 schools
- MBA programs: Harvard, Stanford, Wharton, Chicago, Kellogg
- Professional degrees: JD, MD, PhD
- Extract: Institution, degree, graduation year, honors

**CAREER HISTORY:**
- Search LinkedIn profile for "${name}"
- Search Bloomberg executive profile
- Search company bios/about pages
- Extract: Full career trajectory, key positions, notable achievements

**MEMBERSHIPS & AFFILIATIONS (INDICATES LIFESTYLE):**
- Country clubs: Search "${name}" member + golf OR country club
- Private clubs: University clubs, city clubs, yacht clubs
- Professional associations
- Social/charitable clubs

**AWARDS & RECOGNITION:**
- Search: "${name}" award OR honored OR recognition
- Industry awards, civic honors, university distinctions

**MEDIA MENTIONS:**
- Search news articles featuring "${name}"
- Look for wealth indicators in profiles (homes, art, philanthropy)
- Speaking engagements, conference appearances

**KEY SEARCH PATTERNS:**
- "${name}" LinkedIn profile
- "${firstName} ${lastName}" biography
- "${name}" "${city}" background
- "${lastName}" family "${state}"

REPORT FORMAT: Provide age, spouse name, education credentials (all degrees), career summary with key positions, and notable affiliations. Calculate estimated years of high earning for wealth accumulation estimate.`

    queries.push({
      query: bioQuery,
      depth: "standard",
      outputType: "sourcedAnswer",
      includeInlineCitations: true,
      includeSources: true,
      maxResults: 12,
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
