/**
 * Google Prospect Research Tool
 *
 * Multi-query architecture using Google Search grounding via Gemini 3.
 * Mirrors LinkUp's 5-query parallel search pattern for comprehensive coverage.
 *
 * Executes 5 parallel targeted searches:
 * 1. Real estate holdings & property values
 * 2. Business ownership & executive positions
 * 3. Philanthropic activity & foundation boards
 * 4. Securities holdings & public company roles
 * 5. Biographical information
 *
 * Cost: ~$0.07 per call (5 × $0.014 per Google Search grounding query)
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"
import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// TYPES
// ============================================================================

export interface GoogleProspectResult {
  prospectName: string
  /** Pre-formatted research report */
  research: string
  /** Sources with citations from Google Search */
  sources: Array<{
    name: string
    url: string
    snippet?: string
    category?: string
  }>
  /** Number of queries executed */
  queryCount: number
  /** Duration in milliseconds */
  durationMs: number
  /** Error message if any */
  error?: string
}

interface GoogleGroundingChunk {
  web?: {
    uri?: string
    title?: string
    content?: string
  }
}

interface GoogleGroundingMetadata {
  groundingChunks?: GoogleGroundingChunk[]
  searchEntryPoint?: {
    renderedContent?: string
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_SEARCH_TIMEOUT_MS = 30000 // 30s per query
const QUERY_CATEGORIES = [
  "Real Estate",
  "Business",
  "Philanthropy",
  "Securities",
  "Biography",
] as const

/**
 * Check if Google Prospect Research should be enabled
 */
export function shouldEnableGoogleProspectResearch(): boolean {
  return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
}

// ============================================================================
// QUERY BUILDERS
// ============================================================================

/**
 * Build targeted queries for multi-query Google Search architecture
 *
 * Each query focuses on a specific aspect of prospect research:
 * - Real estate: Property values, holdings
 * - Business: Ownership, executive positions
 * - Philanthropy: Foundations, boards, giving
 * - Securities: SEC filings, insider status
 * - Biography: Age, education, career
 */
function buildTargetedQueries(
  name: string,
  address?: string,
  context?: string
): string[] {
  const nameParts = name.trim().split(/\s+/)
  const firstName = nameParts[0] || ""
  const lastName = nameParts[nameParts.length - 1] || ""

  // Parse location from address
  let city = ""
  let state = ""
  if (address) {
    const parts = address.split(",").map((p) => p.trim())
    if (parts.length >= 2) city = parts[parts.length - 2] || ""
    if (parts.length >= 1) {
      const lastPart = parts[parts.length - 1] || ""
      const stateMatch = lastPart.match(/([A-Z]{2})/)
      state = stateMatch?.[1] || ""
    }
  }
  const location = [city, state].filter(Boolean).join(", ")
  const locationContext = location ? ` in ${location}` : ""
  const extraContext = context ? ` ${context}` : ""

  return [
    // Query 1: Real Estate
    `"${name}"${locationContext} real estate property home value Zillow Redfin address residence purchase price`,

    // Query 2: Business Ownership
    `"${name}"${extraContext} CEO founder owner business company executive LLC Inc Corp president chairman`,

    // Query 3: Philanthropy
    `"${name}" philanthropy foundation board trustee nonprofit donation charity "${lastName} Family Foundation" donor giving`,

    // Query 4: Securities/SEC
    `"${name}" SEC EDGAR Form 4 insider filing board director public company stock holdings officer`,

    // Query 5: Biography
    `"${name}"${extraContext} biography education career background profile age university degree LinkedIn`,
  ]
}

// ============================================================================
// GOOGLE SEARCH EXECUTION
// ============================================================================

/**
 * Execute a single Google Search query with grounding
 */
async function executeGoogleSearch(
  query: string,
  category: string,
  apiKey?: string
): Promise<{
  category: string
  content: string
  sources: Array<{ name: string; url: string; snippet?: string }>
  error?: string
}> {
  const key = apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY

  if (!key) {
    return {
      category,
      content: "Google API key not configured",
      sources: [],
      error: "GOOGLE_GENERATIVE_AI_API_KEY not configured",
    }
  }

  try {
    const google = createGoogleGenerativeAI({ apiKey: key })

    const result = await Promise.race([
      generateText({
        model: google("gemini-3-flash-preview", {
          useSearchGrounding: true,
        }),
        prompt: `Search for and provide factual information about: ${query}

Provide specific findings with sources. Include dollar amounts, dates, and verified data where available.
If no information is found, state "No results found" rather than guessing.`,
        maxTokens: 2000,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Google Search timeout")),
          GOOGLE_SEARCH_TIMEOUT_MS
        )
      ),
    ])

    // Extract sources from grounding metadata
    const providerMetadata = result.experimental_providerMetadata as
      | { google?: { groundingMetadata?: GoogleGroundingMetadata } }
      | undefined
    const groundingChunks =
      providerMetadata?.google?.groundingMetadata?.groundingChunks || []

    const sources = groundingChunks
      .filter((chunk): chunk is GoogleGroundingChunk & { web: NonNullable<GoogleGroundingChunk["web"]> } =>
        !!(chunk.web?.uri)
      )
      .map((chunk) => ({
        name: chunk.web.title || new URL(chunk.web.uri!).hostname,
        url: chunk.web.uri!,
        snippet: chunk.web.content,
      }))

    return {
      category,
      content: result.text || "No results found",
      sources,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`[Google Search] ${category} query failed:`, errorMessage)

    return {
      category,
      content: `Search failed: ${errorMessage}`,
      sources: [],
      error: errorMessage,
    }
  }
}

// ============================================================================
// RESULT AGGREGATION
// ============================================================================

/**
 * Aggregate results from multiple queries into a comprehensive report
 */
function aggregateResults(
  name: string,
  results: Array<{
    category: string
    content: string
    sources: Array<{ name: string; url: string; snippet?: string }>
  }>
): { research: string; sources: GoogleProspectResult["sources"] } {
  const sections: string[] = []
  const allSources: GoogleProspectResult["sources"] = []
  const seenUrls = new Set<string>()

  sections.push(`## Prospect Research: ${name}\n`)
  sections.push("*Research powered by Google Search*\n")

  for (const result of results) {
    // Skip empty or error results
    if (!result.content || result.content.includes("Search failed:")) {
      continue
    }

    sections.push(`### ${result.category}`)
    sections.push(result.content)
    sections.push("")

    // Collect unique sources with category
    for (const source of result.sources) {
      const normalizedUrl = source.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl)
        allSources.push({
          ...source,
          category: result.category.toLowerCase().replace(" ", "_"),
        })
      }
    }
  }

  // Add sources section
  if (allSources.length > 0) {
    sections.push("---\n")
    sections.push("### Sources\n")
    for (const source of allSources.slice(0, 15)) {
      sections.push(`- [${source.name}](${source.url})`)
    }
  }

  return {
    research: sections.join("\n"),
    sources: allSources,
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const googleProspectResearchSchema = z.object({
  prospectName: z.string().describe("Full name of the prospect to research"),
  address: z.string().optional().describe("Known address (city, state, or full address)"),
  additionalContext: z
    .string()
    .optional()
    .describe("Any known details: employer, spouse, profession"),
})

/**
 * Google Prospect Research Tool
 *
 * Uses Google Search grounding with multi-query architecture.
 * Executes 5 parallel searches covering real estate, business,
 * philanthropy, securities, and biography.
 */
export const googleProspectResearchTool = tool({
  description: `Research a prospect using Google Search with multi-query architecture.
Executes 5 parallel targeted searches covering:
- Real estate holdings and property values
- Business ownership and executive positions
- Philanthropic activity and foundation board memberships
- Securities holdings and public company affiliations
- Biographical information and career history

Use this for comprehensive prospect research with real-time web grounding.
Returns structured results with citations from Google Search.

IMPORTANT: Use alongside linkup_prospect_research for dual-source validation.`,
  parameters: googleProspectResearchSchema,
  execute: async ({ prospectName, address, additionalContext }): Promise<GoogleProspectResult> => {
    console.log(`[Google Prospect Research] Starting research for: ${prospectName}`)
    const startTime = Date.now()

    // Check availability
    if (!shouldEnableGoogleProspectResearch()) {
      return {
        prospectName,
        research: "Google Prospect Research is not configured. Set GOOGLE_GENERATIVE_AI_API_KEY.",
        sources: [],
        queryCount: 0,
        durationMs: 0,
        error: "GOOGLE_GENERATIVE_AI_API_KEY not configured",
      }
    }

    try {
      // Build 5 targeted queries
      const queries = buildTargetedQueries(prospectName, address, additionalContext)

      console.log(`[Google Prospect Research] Executing ${queries.length} parallel queries`)

      // Execute all queries in parallel
      const results = await Promise.all(
        queries.map((query, index) =>
          executeGoogleSearch(query, QUERY_CATEGORIES[index], undefined)
        )
      )

      const durationMs = Date.now() - startTime
      const successCount = results.filter((r) => !r.error).length

      console.log(
        `[Google Prospect Research] Completed in ${durationMs}ms (${successCount}/${queries.length} successful)`
      )

      // Aggregate results
      const { research, sources } = aggregateResults(prospectName, results)

      return {
        prospectName,
        research,
        sources,
        queryCount: queries.length,
        durationMs,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error(`[Google Prospect Research] Failed for ${prospectName}:`, errorMessage)

      return {
        prospectName,
        research: `Research failed for "${prospectName}": ${errorMessage}`,
        sources: [],
        queryCount: 0,
        durationMs: Date.now() - startTime,
        error: errorMessage,
      }
    }
  },
})

// ============================================================================
// BATCH PROCESSING EXPORT
// ============================================================================

/**
 * Execute Google Search research for batch processing
 *
 * Uses multi-query architecture for comprehensive coverage.
 *
 * @param prospect - Prospect information
 * @param apiKey - Optional API key override
 * @returns Research results with sources
 */
export async function googleBatchSearch(
  prospect: { name: string; address?: string; employer?: string; title?: string },
  apiKey?: string
): Promise<{
  research: string
  sources: Array<{ name: string; url: string; snippet?: string }>
  durationMs: number
  queryCount: number
  error?: string
}> {
  const startTime = Date.now()
  const context = [prospect.employer, prospect.title].filter(Boolean).join(", ")

  // Check availability
  const key = apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!key) {
    return {
      research: "Google Search unavailable: GOOGLE_GENERATIVE_AI_API_KEY not configured",
      sources: [],
      durationMs: Date.now() - startTime,
      queryCount: 0,
      error: "GOOGLE_GENERATIVE_AI_API_KEY not configured",
    }
  }

  try {
    // Build targeted queries
    const queries = buildTargetedQueries(prospect.name, prospect.address, context || undefined)

    console.log(`[Google Batch] Executing ${queries.length} queries for ${prospect.name}`)

    // Execute all queries in parallel
    const results = await Promise.all(
      queries.map((query, index) =>
        executeGoogleSearch(query, QUERY_CATEGORIES[index], key)
      )
    )

    const durationMs = Date.now() - startTime
    const successCount = results.filter((r) => !r.error).length

    console.log(
      `[Google Batch] Completed in ${durationMs}ms (${successCount}/${queries.length} success)`
    )

    // If all queries failed
    if (successCount === 0) {
      return {
        research: `Research failed for "${prospect.name}". All ${queries.length} queries returned errors.`,
        sources: [],
        durationMs,
        queryCount: queries.length,
        error: `All ${queries.length} queries failed`,
      }
    }

    // Aggregate results
    const { research, sources } = aggregateResults(prospect.name, results)

    return {
      research,
      sources,
      durationMs,
      queryCount: queries.length,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[Google Batch] Research failed for ${prospect.name}:`, errorMessage)

    return {
      research: `Research failed for "${prospect.name}": ${errorMessage}`,
      sources: [],
      durationMs: Date.now() - startTime,
      queryCount: 0,
      error: errorMessage,
    }
  }
}

/**
 * Check if Google batch search is available
 */
export function isGoogleSearchAvailable(apiKey?: string): boolean {
  return !!(apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY)
}
