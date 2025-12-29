/**
 * Parallel AI Prospect Research Tool
 *
 * Comprehensive web search for donor research using Parallel AI's Search API.
 * Replaces LinkUp and Perplexity for prospect research with 95% cost savings.
 *
 * Cost: $0.005 per search (vs $0.095 for LinkUp + Perplexity)
 *
 * @see https://parallel.ai/docs/search
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
import { trackSearchCall, trackExtractCall } from "@/lib/parallel/monitoring"
import {
  shouldUseParallel,
  isParallelAvailable,
} from "@/lib/feature-flags/parallel-migration"

// ============================================================================
// TYPES
// ============================================================================

export interface ParallelProspectResult {
  prospectName: string
  research: string
  sources: Array<{
    name: string
    url: string
    snippet?: string
  }>
  query: string
  mode: "standard" | "deep"
  searchId?: string
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
 * Format search results into a research report
 */
function formatResearchReport(
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
 * Creates a tool configured for either standard or deep research mode
 *
 * @param isDeepResearch - If true, uses comprehensive mode with more results (~30-45s)
 *                        If false, uses agentic mode for faster responses (~10-20s)
 */
export function createParallelProspectResearchTool(isDeepResearch: boolean = false) {
  const mode = isDeepResearch ? "one-shot" : "agentic"
  const modeLabel = isDeepResearch ? "Deep Research" : "Standard"
  const maxResults = isDeepResearch ? 20 : 10

  return tool({
    description: isDeepResearch
      ? // CONSTRAINT-FIRST PROMPTING: Deep Research variant
        "HARD CONSTRAINTS: " +
        "(1) Execute ONLY after memory + CRM checks, " +
        "(2) MUST include ALL sources in output, " +
        "(3) MUST search county assessor records, " +
        "(4) MUST search religious foundation naming patterns. " +
        "CAPABILITY: Comprehensive web search via Parallel AI (~30-45s). " +
        "SEARCHES: County tax assessors, real estate, business, philanthropy (ALL naming patterns), securities, biography. " +
        "REQUIRED OUTPUT: Age, spouse, county-assessed property value, foundation affiliations. " +
        "COST: $0.005/search (95% cheaper than alternatives)."
      : // CONSTRAINT-FIRST PROMPTING: Standard variant
        "HARD CONSTRAINTS: " +
        "(1) Execute ONLY after memory + CRM checks, " +
        "(2) MUST include ALL sources in output, " +
        "(3) MUST find age and spouse name. " +
        "CAPABILITY: Fast web search via Parallel AI (~10-20s). " +
        "SEARCHES: Real estate, business, philanthropy, securities, biography—with inline citations. " +
        "COST: $0.005/search (95% cheaper than alternatives).",
    parameters: parallelProspectResearchSchema,
    execute: async (params): Promise<ParallelProspectResult> => {
      const { name, address, context, focus_areas } = params
      console.log(`[Parallel ${modeLabel}] Starting research for:`, name)
      const startTime = Date.now()

      // Check if Parallel is available
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
          maxResults,
          mode,
          maxCharsPerResult: isDeepResearch ? 1500 : 800,
          blockedDomains: BLOCKED_DOMAINS,
        }

        // Execute the search
        const result = await parallelSearch(searchOptions)

        // Track the call
        trackSearchCall(startTime, result, null, {})

        const duration = Date.now() - startTime
        console.log(`[Parallel ${modeLabel}] Research completed in`, duration, "ms")
        console.log(`[Parallel ${modeLabel}] Found ${result.results.length} results`)

        // Format the results
        const research = formatResearchReport(name, result.results, objective)
        const sources = normalizeParallelSources(result.results)

        return {
          prospectName: name,
          research,
          sources,
          query: objective,
          mode: isDeepResearch ? "deep" : "standard",
          searchId: result.search_id,
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
          error: `Failed to research: ${errorMessage}`,
        }
      }
    },
  })
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

  const research = formatResearchReport(prospect.name, result.results, objective)
  const sources = normalizeParallelSources(result.results)

  return { research, sources, searchId: result.search_id }
}

/**
 * Build optimized query for batch processing
 */
export { buildProspectResearchObjective as buildParallelQuery }
