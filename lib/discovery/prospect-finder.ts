/**
 * Prospect Discovery Engine
 *
 * Core logic for discovering prospects based on natural language criteria.
 * Uses LinkUp's multi-query search architecture for comprehensive results.
 *
 * @module lib/discovery/prospect-finder
 */

import {
  linkupParallelSearch,
  getLinkUpStatus,
  type LinkUpSearchOptions,
  type LinkUpSearchResult,
} from "@/lib/linkup/client"
import { BLOCKED_DOMAINS } from "@/lib/linkup/config"
import { trackSearchCall } from "@/lib/linkup/monitoring"
import {
  type DiscoveryRequest,
  type DiscoveryResult,
  type DiscoveredProspect,
  DEFAULT_DISCOVERY_CONFIG,
} from "./types"
import { isValidPersonName, normalizeName } from "./validation"

// ============================================================================
// STATE ABBREVIATION MAPPING
// ============================================================================

const STATE_NAME_TO_ABBREV: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
}

const VALID_STATE_ABBREVS = new Set(Object.values(STATE_NAME_TO_ABBREV))

/**
 * Normalize a state value to its 2-letter abbreviation
 * @param state - Full state name or abbreviation
 * @returns 2-letter state abbreviation or null if invalid
 */
function normalizeStateAbbrev(state: string | null | undefined): string | null {
  if (!state) return null

  const trimmed = state.trim()
  const upper = trimmed.toUpperCase()

  // Already a valid 2-letter abbreviation
  if (trimmed.length === 2 && VALID_STATE_ABBREVS.has(upper)) {
    return upper
  }

  // Convert full name to abbreviation
  const lower = trimmed.toLowerCase()
  if (STATE_NAME_TO_ABBREV[lower]) {
    return STATE_NAME_TO_ABBREV[lower]
  }

  // Handle partial matches - some results might have truncated state names
  // e.g., "Te" should NOT match "Texas" - require full match
  return null
}

// ============================================================================
// QUERY BUILDING
// ============================================================================

/**
 * Build targeted discovery queries for LinkUp
 *
 * Uses 3 parallel queries with different angles to maximize coverage:
 * 1. Direct person search - Find individuals matching criteria
 * 2. Organization-based search - Find executives at relevant organizations
 * 3. Wealth/philanthropy signals - Find people with wealth indicators
 *
 * @param request - Discovery request with prompt and parameters
 * @returns Array of LinkUp search options
 */
export function buildDiscoveryQueries(
  request: DiscoveryRequest
): LinkUpSearchOptions[] {
  const { prompt, maxResults, location, deepResearch } = request

  // Use "deep" mode for Deep Research, "standard" for regular searches
  const searchDepth = deepResearch ? "deep" : "standard"

  // Build location string
  const locationStr = [location?.city, location?.state, location?.region]
    .filter(Boolean)
    .join(", ")

  const queries: LinkUpSearchOptions[] = []

  // Query 1: Direct person search
  queries.push({
    query: `${prompt}

SEARCH OBJECTIVE: Find specific INDIVIDUALS (real people with full names) who match these criteria.
${locationStr ? `LOCATION FOCUS: ${locationStr}` : ""}

CRITICAL REQUIREMENTS:
- Return REAL PEOPLE with verifiable identities
- Include full legal names (first and last name minimum)
- Each person must be findable via LinkedIn, news articles, SEC filings, or public records
- Do NOT include fictional examples or placeholder names
- Do NOT include company names without associated individuals

For EACH person found, structure the information as:
NAME: [Full Legal Name]
TITLE: [Current or Most Recent Title]
COMPANY: [Current or Most Recent Organization]
LOCATION: [City, State]
MATCH REASON: [Why they match the search criteria]

Find up to ${Math.ceil(maxResults * 0.5)} individuals.`,
    depth: searchDepth,
    outputType: "sourcedAnswer",
    includeInlineCitations: true,
    includeSources: true,
    maxResults: deepResearch ? 30 : 20, // More results in deep mode
    excludeDomains: BLOCKED_DOMAINS,
  })

  // Query 2: Organization-based discovery
  queries.push({
    query: `Find executives, board members, and leaders at organizations related to: ${prompt}
${locationStr ? `Located in or connected to: ${locationStr}` : ""}

SEARCH FOCUS:
- C-suite executives (CEO, CFO, President, Chairman)
- Board of Directors members
- Managing Partners or Senior Partners
- Division Presidents or VPs at major organizations
- Foundation trustees and directors

For EACH person found, provide:
NAME: [Full Legal Name]
TITLE: [Role/Position]
ORGANIZATION: [Company or Organization Name]
LOCATION: [City, State if available]

Search corporate websites, LinkedIn, SEC filings, and news sources.
Return specific individuals, not just organization names.
Find up to ${Math.ceil(maxResults * 0.3)} individuals.`,
    depth: searchDepth,
    outputType: "sourcedAnswer",
    includeInlineCitations: true,
    includeSources: true,
    maxResults: deepResearch ? 25 : 15, // More results in deep mode
    excludeDomains: BLOCKED_DOMAINS,
  })

  // Query 3: Philanthropic/wealth signals
  queries.push({
    query: `Find philanthropists, major donors, and high-net-worth individuals matching: ${prompt}
${locationStr ? `In or connected to: ${locationStr}` : ""}

SEARCH FOR WEALTH AND PHILANTHROPY SIGNALS:
- Private foundation trustees (Form 990-PF filings)
- Major gift donors (named buildings, endowments, scholarships)
- Nonprofit board members at major institutions
- SEC Form 4 filers (public company insiders)
- Individuals featured in wealth or philanthropy publications

For EACH person found, provide:
NAME: [Full Legal Name]
ROLE: [Foundation trustee, Board member, Major donor, etc.]
AFFILIATION: [Foundation name, Nonprofit, or Company]
LOCATION: [City, State if available]
EVIDENCE: [Source of wealth/philanthropy signal]

Search ProPublica Nonprofit Explorer, SEC EDGAR, university donor lists, hospital boards.
Find up to ${Math.ceil(maxResults * 0.4)} individuals.`,
    depth: searchDepth,
    outputType: "sourcedAnswer",
    includeInlineCitations: true,
    includeSources: true,
    maxResults: deepResearch ? 25 : 15, // More results in deep mode
    excludeDomains: BLOCKED_DOMAINS,
  })

  return queries
}

// ============================================================================
// RESULT PARSING
// ============================================================================

/**
 * Extract structured prospect data from LinkUp search results
 */
export function parseDiscoveryResults(
  results: LinkUpSearchResult[],
  aggregatedSources: Array<{ name: string; url: string; snippet?: string }>,
  maxResults: number
): DiscoveredProspect[] {
  const prospects: DiscoveredProspect[] = []
  const seenNames = new Set<string>()

  // Combine all answers
  const combinedText = results
    .map((r) => r.answer || "")
    .filter((a) => a.length > 0)
    .join("\n\n---\n\n")

  if (!combinedText) {
    return []
  }

  // Pattern 1: Structured NAME: format
  const structuredPattern =
    /NAME:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})\s*(?:\n|$)/gi
  let match: RegExpExecArray | null

  // Reset lastIndex
  structuredPattern.lastIndex = 0
  while ((match = structuredPattern.exec(combinedText)) !== null) {
    const name = match[1].trim()
    const normalizedName = normalizeName(name)

    if (!seenNames.has(normalizedName) && isValidPersonName(name)) {
      seenNames.add(normalizedName)

      // Extract surrounding context
      const contextStart = Math.max(0, match.index - 50)
      const contextEnd = Math.min(combinedText.length, match.index + 500)
      const context = combinedText.substring(contextStart, contextEnd)

      const prospect = extractProspectDetails(name, context, aggregatedSources)
      if (prospect) {
        prospects.push(prospect)
      }
    }

    if (prospects.length >= maxResults) break
  }

  // Pattern 2: Name followed by role/title patterns
  if (prospects.length < maxResults) {
    const nameRolePatterns = [
      // "John Smith, CEO of Company"
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*,\s*(?:the\s+)?(?:CEO|CFO|COO|CTO|President|Chairman|Founder|Director|Partner|Trustee|Executive)[^\n]*/gi,
      // "John Smith is the CEO"
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s+(?:is|was|serves? as|works? as)\s+(?:the\s+)?(?:CEO|CFO|President|Chairman|Founder|Director|Partner|Trustee)[^\n]*/gi,
      // "CEO John Smith"
      /(?:CEO|CFO|President|Chairman|Founder|Director)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/gi,
    ]

    for (const pattern of nameRolePatterns) {
      pattern.lastIndex = 0
      while ((match = pattern.exec(combinedText)) !== null) {
        const name = match[1].trim()
        const normalizedName = normalizeName(name)

        if (!seenNames.has(normalizedName) && isValidPersonName(name)) {
          seenNames.add(normalizedName)

          const contextStart = Math.max(0, match.index - 50)
          const contextEnd = Math.min(combinedText.length, match.index + 500)
          const context = combinedText.substring(contextStart, contextEnd)

          const prospect = extractProspectDetails(name, context, aggregatedSources)
          if (prospect) {
            prospects.push(prospect)
          }
        }

        if (prospects.length >= maxResults) break
      }
      if (prospects.length >= maxResults) break
    }
  }

  // Pattern 3: Bold/emphasized names (markdown **Name** or quoted "Name")
  if (prospects.length < maxResults) {
    const emphasisPatterns = [
      /\*\*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\*\*/g,
      /"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})"/g,
    ]

    for (const pattern of emphasisPatterns) {
      pattern.lastIndex = 0
      while ((match = pattern.exec(combinedText)) !== null) {
        const name = match[1].trim()
        const normalizedName = normalizeName(name)

        if (!seenNames.has(normalizedName) && isValidPersonName(name)) {
          seenNames.add(normalizedName)

          const contextStart = Math.max(0, match.index - 50)
          const contextEnd = Math.min(combinedText.length, match.index + 500)
          const context = combinedText.substring(contextStart, contextEnd)

          const prospect = extractProspectDetails(name, context, aggregatedSources)
          if (prospect) {
            prospects.push(prospect)
          }
        }

        if (prospects.length >= maxResults) break
      }
      if (prospects.length >= maxResults) break
    }
  }

  return prospects
}

/**
 * Extract detailed prospect information from surrounding context
 */
function extractProspectDetails(
  name: string,
  context: string,
  allSources: Array<{ name: string; url: string; snippet?: string }>
): DiscoveredProspect | null {
  // Generate unique ID
  const id = `prospect-${normalizeName(name).replace(/\s+/g, "-")}-${Date.now()}`

  // Extract title
  const title = extractTitle(context)

  // Extract company
  const company = extractCompany(context)

  // Extract location
  const { city, state } = extractLocation(context)

  // Extract match reasons
  const matchReasons = extractMatchReasons(context, name)

  // Find relevant sources
  const lastName = name.split(" ").pop() || name
  const relevantSources = allSources
    .filter(
      (s) =>
        s.snippet?.toLowerCase().includes(lastName.toLowerCase()) ||
        s.name?.toLowerCase().includes(lastName.toLowerCase())
    )
    .slice(0, 3)
    .map((s) => ({
      name: s.name,
      url: s.url,
      snippet: s.snippet,
    }))

  // Determine confidence based on source quality
  let confidence: DiscoveredProspect["confidence"] = "low"
  if (relevantSources.length >= 2) {
    confidence = "high"
  } else if (relevantSources.length === 1) {
    confidence = "medium"
  }

  // Boost confidence if we have title AND company
  if (title && company && confidence === "low") {
    confidence = "medium"
  }

  return {
    id,
    name,
    title: title || undefined,
    company: company || undefined,
    city: city || undefined,
    state: state || undefined,
    confidence,
    matchReasons: matchReasons.length > 0 ? matchReasons : ["Matches search criteria"],
    sources: relevantSources,
  }
}

/**
 * Extract title from context
 */
function extractTitle(context: string): string | null {
  const patterns = [
    /TITLE:\s*([^\n]+)/i,
    /ROLE:\s*([^\n]+)/i,
    /(?:as\s+(?:the\s+)?|is\s+(?:the\s+)?|,\s*)(CEO|CFO|COO|CTO|President|Chairman|Vice President|VP|Director|Partner|Managing Director|Founder|Co-Founder|Executive Director|Trustee)[^\n,.]*/i,
  ]

  for (const pattern of patterns) {
    const match = context.match(pattern)
    if (match) {
      return match[1].trim().substring(0, 100)
    }
  }

  return null
}

/**
 * Extract company from context
 */
function extractCompany(context: string): string | null {
  const patterns = [
    /COMPANY:\s*([^\n]+)/i,
    /ORGANIZATION:\s*([^\n]+)/i,
    /AFFILIATION:\s*([^\n]+)/i,
    /(?:at|of|with)\s+([A-Z][A-Za-z0-9\s&.,'-]+(?:Inc|LLC|Corp|Company|Foundation|Group|Partners|Capital|Ventures|Holdings)?)/i,
  ]

  for (const pattern of patterns) {
    const match = context.match(pattern)
    if (match) {
      let company = match[1].trim()
      // Remove trailing punctuation
      company = company.replace(/[.,;]+$/, "")
      // Limit length
      if (company.length > 3 && company.length < 100) {
        return company
      }
    }
  }

  return null
}

/**
 * Extract location from context
 * @returns city and state (state is always 2-letter abbreviation if found)
 */
function extractLocation(context: string): { city: string | null; state: string | null } {
  // LOCATION: City, State format
  const locationPattern = /LOCATION:\s*([^,\n]+)(?:,\s*([A-Z]{2}|[A-Za-z\s]+))?/i
  const match = context.match(locationPattern)
  if (match) {
    const city = match[1]?.trim() || null
    const rawState = match[2]?.trim() || null
    // Normalize state to 2-letter abbreviation
    const state = normalizeStateAbbrev(rawState)
    return { city, state }
  }

  // Try "City, State" pattern in general text
  // Match patterns like "Dallas, Texas" or "Dallas, TX"
  const cityStatePattern = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*,\s*(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i
  const cityStateMatch = context.match(cityStatePattern)
  if (cityStateMatch) {
    return {
      city: cityStateMatch[1]?.trim() || null,
      state: normalizeStateAbbrev(cityStateMatch[2]),
    }
  }

  // State-only pattern as fallback
  const statePattern =
    /\b(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i
  const stateMatch = context.match(statePattern)

  return {
    city: null,
    state: stateMatch ? normalizeStateAbbrev(stateMatch[1]) : null,
  }
}

/**
 * Extract match reasons from context
 */
function extractMatchReasons(context: string, _name: string): string[] {
  const reasons: string[] = []

  // MATCH REASON: or EVIDENCE: format
  const reasonPattern = /(?:MATCH REASON|EVIDENCE|WHY|REASON):\s*([^\n]+)/gi
  let match: RegExpExecArray | null
  while ((match = reasonPattern.exec(context)) !== null) {
    const reason = match[1].trim()
    if (reason.length > 10 && reason.length < 200) {
      reasons.push(reason)
    }
  }

  // If no explicit reasons, extract from context
  if (reasons.length === 0) {
    const contextPatterns = [
      /(?:serves? (?:on|as)|member of|trustee of|board of)\s+([^,.]+)/i,
      /(?:founder|founded|co-founded)\s+([^,.]+)/i,
      /(?:donated|gift of|contributed)\s+\$?[\d,]+/i,
    ]

    for (const pattern of contextPatterns) {
      const m = context.match(pattern)
      if (m) {
        reasons.push(m[0].substring(0, 150))
      }
    }
  }

  return reasons.slice(0, 3)
}

// ============================================================================
// MAIN DISCOVERY FUNCTION
// ============================================================================

/**
 * Execute prospect discovery search
 *
 * @param request - Discovery request with prompt and parameters
 * @returns Discovery result with prospects and metadata
 */
export async function discoverProspects(
  request: DiscoveryRequest
): Promise<DiscoveryResult> {
  const startTime = Date.now()
  const { prompt, maxResults } = request

  // Check LinkUp availability
  const status = getLinkUpStatus()
  if (!status.available) {
    return {
      success: false,
      prospects: [],
      totalFound: 0,
      queryExecuted: prompt,
      durationMs: Date.now() - startTime,
      estimatedCostCents: 0,
      queryCount: 0,
      error: status.reasons.join(". ") || "Web search is unavailable",
      errorCode: "LINKUP_UNAVAILABLE",
    }
  }

  try {
    // Build queries
    const queries = buildDiscoveryQueries(request)
    console.log(`[Discovery] Executing ${queries.length} parallel queries`)

    // Execute parallel search
    const { results, aggregatedSources, successCount, errorCount } =
      await linkupParallelSearch(queries)

    const durationMs = Date.now() - startTime
    console.log(
      `[Discovery] Completed in ${durationMs}ms (${successCount} success, ${errorCount} errors)`
    )

    // Track search calls for monitoring
    for (let i = 0; i < successCount; i++) {
      trackSearchCall(startTime, "standard", results[i]?.sources?.length || 0, null)
    }

    // Handle complete failure
    if (successCount === 0) {
      return {
        success: false,
        prospects: [],
        totalFound: 0,
        queryExecuted: prompt,
        durationMs,
        estimatedCostCents: queries.length * DEFAULT_DISCOVERY_CONFIG.costPerSearchCents,
        queryCount: queries.length,
        error: "All search queries failed. Please try again.",
        errorCode: "SERVER_ERROR",
      }
    }

    // Parse results
    const prospects = parseDiscoveryResults(results, aggregatedSources, maxResults)

    // Handle no results
    if (prospects.length === 0) {
      return {
        success: true,
        prospects: [],
        totalFound: 0,
        queryExecuted: prompt,
        durationMs,
        estimatedCostCents: queries.length * DEFAULT_DISCOVERY_CONFIG.costPerSearchCents,
        queryCount: queries.length,
        warnings: ["No prospects found matching your criteria. Try broadening your search."],
      }
    }

    // Build warnings if applicable
    const warnings: string[] = []
    if (errorCount > 0) {
      warnings.push(`${errorCount} of ${queries.length} search queries had errors`)
    }
    if (prospects.length < maxResults) {
      warnings.push(
        `Found ${prospects.length} prospects (requested ${maxResults}). Try different criteria for more results.`
      )
    }

    return {
      success: true,
      prospects,
      totalFound: prospects.length,
      queryExecuted: prompt,
      durationMs,
      estimatedCostCents: successCount * DEFAULT_DISCOVERY_CONFIG.costPerSearchCents,
      queryCount: queries.length,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Discovery] Error:", errorMessage)

    // Track failure
    trackSearchCall(startTime, "standard", 0, { code: "UNKNOWN_ERROR" })

    return {
      success: false,
      prospects: [],
      totalFound: 0,
      queryExecuted: prompt,
      durationMs: Date.now() - startTime,
      estimatedCostCents: 0,
      queryCount: 0,
      error: `Discovery search failed: ${errorMessage}`,
      errorCode: "SERVER_ERROR",
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { getLinkUpStatus }
