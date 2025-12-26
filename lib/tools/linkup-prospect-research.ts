/**
 * LinkUp Prospect Research Tool
 * Web search for donor research using LinkUp's grounded search API
 *
 * Uses linkup-sdk to access LinkUp's web search with sourced answers
 * Provides grounded, cited results for prospect research
 */

import { tool } from "ai"
import { z } from "zod"
import { LinkupClient } from "linkup-sdk"

// ============================================================================
// TYPES
// ============================================================================

export interface LinkupProspectResult {
  prospectName: string
  research: string
  sources: Array<{
    name: string
    url: string
    snippet?: string
  }>
  query: string
  depth: "standard" | "deep"
  error?: string
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const LINKUP_STANDARD_TIMEOUT_MS = 25000 // 25s for standard searches
const LINKUP_DEEP_TIMEOUT_MS = 60000 // 60s for deep research mode

/**
 * Check if LinkUp tools should be enabled
 * Requires LINKUP_API_KEY
 */
export function shouldEnableLinkupTools(): boolean {
  return !!process.env.LINKUP_API_KEY
}

// ============================================================================
// RETRY HELPERS
// ============================================================================

/**
 * Retry logic with exponential backoff for transient errors
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 2000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const errorMessage = lastError.message.toLowerCase()

      // Check if this is a retryable error
      // NOTE: 401 is NOT retryable (auth failure won't fix with retry)
      const isRetryable =
        errorMessage.includes("429") || // Rate limit
        errorMessage.includes("502") ||
        errorMessage.includes("503") ||
        errorMessage.includes("504") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("econnreset") ||
        errorMessage.includes("econnrefused") ||
        errorMessage.includes("enotfound") ||
        errorMessage.includes("socket hang up")

      if (!isRetryable || attempt >= maxRetries - 1) {
        throw lastError
      }

      // Exponential backoff with jitter
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000
      console.log(
        `[LinkUp] Retryable error on attempt ${attempt + 1}. Retrying in ${Math.round(delay)}ms...`
      )
      console.log(`[LinkUp] Error was: ${lastError.message.substring(0, 200)}`)

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

// ============================================================================
// QUERY BUILDER
// ============================================================================

/**
 * Build an optimized prospect research query for LinkUp
 *
 * Uses QUERY-FOCUSED approach - natural language questions that prompt search
 * Not checklists that prompt verification
 */
function buildProspectResearchQuery(
  name: string,
  address?: string,
  context?: string,
  focusAreas?: string[]
): string {
  const firstName = name.split(' ')[0]
  const lastName = name.split(' ').slice(-1)[0]

  const query = `Research ${name} for nonprofit fundraising prospect research. Find comprehensive information about their wealth, philanthropy, and background.

${address ? `Address: ${address}` : ''}
${context ? `Context: ${context}` : ''}

FIND AND REPORT:

**REAL ESTATE:**
${address ? `- What is the property value at ${address}? Search county property appraiser records.` : `- What properties does ${name} own?`}
- Search Zillow and Redfin for property values
- Any additional properties or vacation homes?

**BIOGRAPHICAL:**
- How old is ${name}? (Search "${name} age" and "${name} born")
- Who is ${name} married to? (spouse name)
- Education background?
- Career history and current role?

**BUSINESS:**
- What companies does ${name} own or lead?
- What is their company's estimated revenue?
- Any board positions?

**POLITICAL GIVING:**
- Search FEC.gov for ${name}'s political contributions
- Total amount donated and to whom?

**PHILANTHROPY:**
- Search for "${name} Foundation"
- Search for "${lastName} Family Foundation"
- Search for "${firstName} 1:16 Foundation" and other religious/biblical foundation names
- What nonprofit boards does ${name} serve on?
- Any major charitable gifts?

**SECURITIES:**
- Any SEC filings for ${name}? (Form 4 insider transactions)
- Public company roles?

OUTPUT FORMAT:
- Cite all sources with URLs
- Use ranges for estimates ($X-Y million)
- Mark [Verified] for official records, [Estimated] for calculations
- If you can't find something, explain what you searched

Provide a comprehensive research report with all findings.`

  return query
}

/**
 * Extract and normalize sources from LinkUp response
 */
function normalizeSources(
  sources: Array<{ name?: string; url?: string; snippet?: string; content?: string }>
): Array<{ name: string; url: string; snippet?: string }> {
  const normalized: Array<{ name: string; url: string; snippet?: string }> = []
  const seenUrls = new Set<string>()

  for (const source of sources) {
    if (!source.url) continue

    const url = source.url.replace(/[.,;:!?]$/, "") // Remove trailing punctuation
    if (seenUrls.has(url)) continue
    seenUrls.add(url)

    // Extract domain for name if not provided
    let name = source.name
    if (!name) {
      try {
        name = new URL(url).hostname.replace("www.", "")
      } catch {
        name = "Source"
      }
    }

    normalized.push({
      name,
      url,
      snippet: source.snippet || source.content,
    })
  }

  return normalized.slice(0, 20) // Limit to 20 sources
}

// ============================================================================
// LINKUP CLIENT
// ============================================================================

/**
 * Execute LinkUp search with timeout and retry
 *
 * LinkUp API Parameters:
 * - depth: "standard" | "deep" - search thoroughness
 * - outputType: "sourcedAnswer" - returns answer with source URLs
 * - includeInlineCitations: true - embeds citations in answer text
 * - maxResults: 20 - maximum number of sources (new parameter)
 */
async function executeLinkupSearch(
  query: string,
  depth: "standard" | "deep" = "deep",
  apiKey?: string
): Promise<{ answer: string; sources: Array<{ name: string; url: string; snippet?: string }> }> {
  const key = apiKey || process.env.LINKUP_API_KEY
  if (!key) {
    throw new Error("LINKUP_API_KEY not configured")
  }

  const client = new LinkupClient({ apiKey: key })
  const timeout = depth === "deep" ? LINKUP_DEEP_TIMEOUT_MS : LINKUP_STANDARD_TIMEOUT_MS

  const result = await withRetry(async () => {
    const searchPromise = client.search({
      query,
      depth,
      outputType: "sourcedAnswer",
      includeInlineCitations: true,
      // maxResults: maximum sources to gather for comprehensive research
      maxResults: depth === "deep" ? 25 : 15,
    })

    // Add timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`LinkUp search timed out after ${timeout / 1000} seconds`)),
        timeout
      )
    )

    return Promise.race([searchPromise, timeoutPromise])
  }, 3, 2000)

  // Handle the response - it's a SourcedAnswer type
  const answer = typeof result === "object" && "answer" in result ? result.answer : ""
  const rawSources =
    typeof result === "object" && "sources" in result
      ? (result.sources as Array<{ name?: string; url?: string; snippet?: string; content?: string }>)
      : []

  return {
    answer: answer || "",
    sources: normalizeSources(rawSources),
  }
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
      z.enum(["real_estate", "business_ownership", "philanthropy", "securities", "biography"])
    )
    .optional()
    .describe("Specific areas to focus research on. Default: all areas"),
})

/**
 * LinkUp Prospect Research Tool Factory
 * Creates a tool configured for either standard or deep research mode
 *
 * LinkUp API Features Used:
 * - depth: "standard" (fast) or "deep" (comprehensive)
 * - outputType: "sourcedAnswer" (answer with inline citations)
 * - includeInlineCitations: true (for source attribution)
 * - maxResults: 20 (maximum sources to gather)
 *
 * @param isDeepResearch - If true, uses deep search with longer timeout (~45-60s)
 *                        If false, uses standard search for fast responses (~10-20s)
 */
export function createLinkupProspectResearchTool(isDeepResearch: boolean = false) {
  const searchDepth: "standard" | "deep" = isDeepResearch ? "deep" : "standard"
  const modeLabel = isDeepResearch ? "Deep Research" : "Standard"

  return tool({
    description: isDeepResearch
      // CONSTRAINT-FIRST PROMPTING: Deep Research variant
      ? "HARD CONSTRAINTS: " +
        "(1) Execute ONLY after memory + CRM checks, " +
        "(2) MUST include ALL sources in output, " +
        "(3) MUST search county assessor records, " +
        "(4) MUST search religious foundation naming patterns. " +
        "CAPABILITY: Deep web search via LinkUp API (~45-60s, comprehensive). " +
        "SEARCHES: County tax assessors, real estate, business, philanthropy (ALL naming patterns), securities, biography. " +
        "REQUIRED OUTPUT: Age, spouse, county-assessed property value, foundation affiliations. " +
        "USE WITH: perplexity_prospect_research IN PARALLEL for maximum coverage."
      // CONSTRAINT-FIRST PROMPTING: Standard variant
      : "HARD CONSTRAINTS: " +
        "(1) Execute ONLY after memory + CRM checks, " +
        "(2) MUST include ALL sources in output, " +
        "(3) MUST find age and spouse name. " +
        "CAPABILITY: Fast web search via LinkUp API (~10-20s, sourcedAnswer mode). " +
        "SEARCHES: Real estate, business, philanthropy, securities, biography—with inline citations. " +
        "USE WITH: perplexity_prospect_research IN PARALLEL for comprehensive dual-source research.",
    parameters: linkupProspectResearchSchema,
    execute: async (params): Promise<LinkupProspectResult> => {
      const { name, address, context, focus_areas } = params
      console.log(`[LinkUp ${modeLabel}] Starting research for:`, name)
      const startTime = Date.now()

      // Check if LinkUp is enabled
      if (!process.env.LINKUP_API_KEY) {
        return {
          prospectName: name,
          research:
            "LinkUp research is not configured. Please add LINKUP_API_KEY to your environment variables.",
          sources: [],
          query: "",
          depth: searchDepth,
          error: "LINKUP_API_KEY not configured",
        }
      }

      try {
        const query = buildProspectResearchQuery(name, address, context, focus_areas)
        const { answer, sources } = await executeLinkupSearch(query, searchDepth)

        const duration = Date.now() - startTime
        console.log(`[LinkUp ${modeLabel}] Research completed in`, duration, "ms")
        console.log(`[LinkUp ${modeLabel}] Found ${sources.length} sources`)

        return {
          prospectName: name,
          research: answer,
          sources,
          query,
          depth: searchDepth,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        console.error(`[LinkUp ${modeLabel}] Research failed:`, errorMessage)
        return {
          prospectName: name,
          research: `Failed to research "${name}": ${errorMessage}`,
          sources: [],
          query: "",
          depth: searchDepth,
          error: `Failed to research: ${errorMessage}`,
        }
      }
    },
  })
}

/**
 * Default LinkUp Prospect Research Tool (standard mode)
 * @deprecated Use createLinkupProspectResearchTool() for mode-aware tool creation
 */
export const linkupProspectResearchTool = createLinkupProspectResearchTool(false)

// ============================================================================
// EXPORTS FOR BATCH PROCESSING
// ============================================================================

/**
 * Execute LinkUp search with configurable depth
 * Used by batch processing module
 */
export async function linkupProspectSearch(
  prospect: { name: string; address?: string; employer?: string; title?: string },
  apiKey: string,
  depth: "standard" | "deep" = "standard"
): Promise<{
  answer: string
  sources: Array<{ name: string; url: string; snippet?: string }>
  query: string
}> {
  const context = [prospect.employer, prospect.title].filter(Boolean).join(", ")
  const query = buildProspectResearchQuery(prospect.name, prospect.address, context || undefined)

  const { answer, sources } = await executeLinkupSearch(query, depth, apiKey)

  return { answer, sources, query }
}

/**
 * Build optimized query for batch processing
 * Exported for use in batch-processing module
 */
export { buildProspectResearchQuery as buildLinkupQuery }
