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

const LINKUP_TIMEOUT_MS = 30000 // 30s max for chat mode
const LINKUP_STANDARD_TIMEOUT_MS = 25000 // 25s for standard searches (used in chat)

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
 * Highly structured to maximize data extraction even at standard depth
 */
function buildProspectResearchQuery(
  name: string,
  address?: string,
  context?: string,
  focusAreas?: string[]
): string {
  const areas = focusAreas || [
    "real_estate",
    "business_ownership",
    "philanthropy",
    "securities",
    "biography",
  ]

  const focusInstructions = areas
    .map((area) => {
      switch (area) {
        case "real_estate":
          return "- Real estate: Property addresses, estimated values, purchase dates, multiple properties"
        case "business_ownership":
          return "- Business: Companies founded/owned, executive positions, board seats, revenue estimates"
        case "philanthropy":
          return "- Philanthropy: Foundation board memberships, major donations ($10K+), nonprofit leadership"
        case "securities":
          return "- Securities: Public company roles, SEC Form 4 filings, insider transactions, stock holdings"
        case "biography":
          return "- Background: Education, career history, family, notable achievements, net worth estimates"
        default:
          return ""
      }
    })
    .filter(Boolean)
    .join("\n")

  let query = `Comprehensive wealth and philanthropic research for: ${name}

REQUIRED DATA POINTS (cite all sources with URLs):
${focusInstructions}

${address ? `Known address: ${address}` : ""}
${context ? `Additional context: ${context}` : ""}

IMPORTANT:
- Every factual claim MUST include a source URL
- Use value ranges for estimates (e.g., "$2-5M" not "$3.5M")
- Mark estimates clearly with [Estimated]
- If information is not found, state "Not found in public records"
- Cross-reference multiple sources when possible
- Focus on verifiable, public information only`

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
  const timeout = depth === "deep" ? LINKUP_TIMEOUT_MS : LINKUP_STANDARD_TIMEOUT_MS

  const result = await withRetry(async () => {
    const searchPromise = client.search({
      query,
      depth,
      outputType: "sourcedAnswer",
      includeInlineCitations: true,
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

type LinkupProspectResearchParams = z.infer<typeof linkupProspectResearchSchema>

/**
 * LinkUp Prospect Research Tool for chat mode
 * Uses standard search for fast responses (10-20s typical)
 */
export const linkupProspectResearchTool = tool({
  description:
    "Fast web search for prospect research using LinkUp's grounded search API. " +
    "Searches real estate, business ownership, securities, philanthropy, and biographical data with citations. " +
    "Returns factual results from authoritative web sources in ~10-20 seconds. " +
    "Use alongside perplexity_prospect_research for comprehensive dual-source research.",
  parameters: linkupProspectResearchSchema,
  execute: async (params): Promise<LinkupProspectResult> => {
    const { name, address, context, focus_areas } = params
    console.log(`[LinkUp] Starting research for:`, name)
    const startTime = Date.now()

    // Check if LinkUp is enabled
    if (!process.env.LINKUP_API_KEY) {
      return {
        prospectName: name,
        research:
          "LinkUp research is not configured. Please add LINKUP_API_KEY to your environment variables.",
        sources: [],
        query: "",
        depth: "standard",
        error: "LINKUP_API_KEY not configured",
      }
    }

    try {
      const query = buildProspectResearchQuery(name, address, context, focus_areas)
      const { answer, sources } = await executeLinkupSearch(query, "standard")

      const duration = Date.now() - startTime
      console.log(`[LinkUp] Research completed in`, duration, "ms")
      console.log(`[LinkUp] Found ${sources.length} sources`)

      return {
        prospectName: name,
        research: answer,
        sources,
        query,
        depth: "standard",
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error(`[LinkUp] Research failed:`, errorMessage)
      return {
        prospectName: name,
        research: `Failed to research "${name}": ${errorMessage}`,
        sources: [],
        query: "",
        depth: "standard",
        error: `Failed to research: ${errorMessage}`,
      }
    }
  },
})

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
