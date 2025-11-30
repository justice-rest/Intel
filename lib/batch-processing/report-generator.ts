/**
 * Batch Prospect Report Generator
 * Generates comprehensive prospect research reports using AI + web search
 */

import { streamText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { LinkupClient } from "linkup-sdk"
import { isLinkupEnabled, getLinkupApiKey } from "@/lib/linkup/config"
import { SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { ProspectInputData, BatchProspectItem } from "./types"
import { buildProspectQueryString } from "./parser"
import { PROSPECT_PROCESSING_TIMEOUT_MS } from "./config"

// ============================================================================
// TYPES
// ============================================================================

interface GenerateReportOptions {
  prospect: ProspectInputData
  enableWebSearch: boolean
  generateRomyScore: boolean
  apiKey?: string
  organizationContext?: string
}

interface GenerateReportResult {
  success: boolean
  report_content?: string
  romy_score?: number
  romy_score_tier?: string
  capacity_rating?: string
  estimated_net_worth?: number
  estimated_gift_capacity?: number
  recommended_ask?: number
  search_queries_used?: string[]
  sources_found?: Array<{ name: string; url: string }>
  tokens_used?: number
  error_message?: string
}

interface WebSearchResult {
  answer: string
  sources: Array<{ name: string; url: string; snippet?: string }>
  query: string
}

// ============================================================================
// WEB SEARCH
// ============================================================================

// Shared LinkUp client for connection reuse
let linkupClient: LinkupClient | null = null

function getLinkupClient(): LinkupClient {
  if (!linkupClient) {
    linkupClient = new LinkupClient({ apiKey: getLinkupApiKey() })
  }
  return linkupClient
}

async function performWebSearch(query: string): Promise<WebSearchResult | null> {
  if (!isLinkupEnabled()) {
    console.log("[BatchProcessor] Linkup not enabled, skipping web search")
    return null
  }

  try {
    const client = getLinkupClient()

    // Use "deep" mode for thorough research (agentic workflow)
    // 30s timeout for deep mode
    const result = await Promise.race([
      client.search({
        query,
        depth: "deep",
        outputType: "sourcedAnswer",
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Search timeout")), 30000)
      ),
    ])

    return {
      answer: result.answer || "",
      sources: (result.sources || []).map((s: { name?: string; url: string; snippet?: string }) => ({
        name: s.name || "Source",
        url: s.url,
        snippet: s.snippet,
      })),
      query,
    }
  } catch (error) {
    console.error("[BatchProcessor] Web search failed:", error)
    return null
  }
}

// ============================================================================
// SEARCH QUERIES FOR PROSPECT RESEARCH
// ============================================================================

function generateSearchQueries(prospect: ProspectInputData): string[] {
  const name = prospect.name
  const location = [prospect.city, prospect.state].filter(Boolean).join(", ")
  const fullAddress = buildProspectQueryString(prospect)

  const queries: string[] = []

  // Core identity searches
  queries.push(`"${name}" ${location} professional background career`)

  // Real estate (using address for more accuracy)
  if (prospect.address || prospect.full_address) {
    queries.push(`"${fullAddress}" property records real estate`)
  }

  // Business ownership
  queries.push(`"${name}" ${location} business owner company founder CEO`)

  // Philanthropy and giving
  queries.push(`"${name}" ${location} philanthropic giving donation foundation charity`)

  // Political contributions (FEC)
  queries.push(`"${name}" ${location} political contributions FEC donations`)

  // Limit to 5 searches to stay within rate limits
  return queries.slice(0, 5)
}

// ============================================================================
// COMPILE SEARCH RESULTS INTO CONTEXT
// ============================================================================

function compileSearchContext(
  searchResults: (WebSearchResult | null)[]
): { context: string; allSources: Array<{ name: string; url: string }> } {
  const validResults = searchResults.filter((r): r is WebSearchResult => r !== null)

  if (validResults.length === 0) {
    return { context: "", allSources: [] }
  }

  const contextParts: string[] = []
  const allSources: Array<{ name: string; url: string }> = []

  validResults.forEach((result, index) => {
    contextParts.push(`### Search ${index + 1}: ${result.query}`)
    contextParts.push(result.answer)
    contextParts.push("")

    result.sources.forEach((source) => {
      if (!allSources.some((s) => s.url === source.url)) {
        allSources.push({ name: source.name, url: source.url })
      }
    })
  })

  return {
    context: contextParts.join("\n"),
    allSources,
  }
}

// ============================================================================
// EXTRACT METRICS FROM REPORT
// ============================================================================

/**
 * Parse a dollar amount from various formats
 * Handles: $1,000,000 | $1M | $1.5M | $500K | **$1,000,000** | <$1K | <1K$ | $500-$1,000 | Under $500 etc.
 */
function parseDollarAmount(str: string): number | null {
  if (!str) return null

  // Remove markdown formatting and trim
  const cleaned = str.replace(/\*\*/g, "").replace(/\*/g, "").trim()

  // Skip N/A, None, TBD, etc.
  if (/^(n\/a|none|tbd|unknown|not\s+available)/i.test(cleaned)) {
    return null
  }

  // Handle "Under $X" or "Less than $X" - use the value as upper bound
  const underMatch = cleaned.match(/(?:under|less\s+than|below)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*([MKBmkb])?/i)
  if (underMatch) {
    let value = parseFloat(underMatch[1].replace(/,/g, ""))
    const suffix = underMatch[2]?.toUpperCase()
    if (suffix === "M") value *= 1000000
    else if (suffix === "K") value *= 1000
    else if (suffix === "B") value *= 1000000000
    return isNaN(value) ? null : value
  }

  // Handle "<$1K" or "<$1,000" or "<1K$" patterns
  const lessThanMatch = cleaned.match(/<\s*\$?\s*([\d,]+(?:\.\d+)?)\s*([MKBmkb])?\s*\$?/i)
  if (lessThanMatch) {
    let value = parseFloat(lessThanMatch[1].replace(/,/g, ""))
    const suffix = lessThanMatch[2]?.toUpperCase()
    if (suffix === "M") value *= 1000000
    else if (suffix === "K") value *= 1000
    else if (suffix === "B") value *= 1000000000
    return isNaN(value) ? null : value
  }

  // Handle ">$1K" or ">$1,000" patterns - use the lower bound
  const greaterThanMatch = cleaned.match(/>\s*\$?\s*([\d,]+(?:\.\d+)?)\s*([MKBmkb])?/i)
  if (greaterThanMatch) {
    let value = parseFloat(greaterThanMatch[1].replace(/,/g, ""))
    const suffix = greaterThanMatch[2]?.toUpperCase()
    if (suffix === "M") value *= 1000000
    else if (suffix === "K") value *= 1000
    else if (suffix === "B") value *= 1000000000
    return isNaN(value) ? null : value
  }

  // Handle ranges like "$500-$1,000" or "$500 - $1K" - use the higher value
  const rangeMatch = cleaned.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*([MKBmkb])?\s*[-–—to]+\s*\$?\s*([\d,]+(?:\.\d+)?)\s*([MKBmkb])?/i)
  if (rangeMatch) {
    let value2 = parseFloat(rangeMatch[3].replace(/,/g, ""))
    const suffix2 = rangeMatch[4]?.toUpperCase()
    if (suffix2 === "M") value2 *= 1000000
    else if (suffix2 === "K") value2 *= 1000
    else if (suffix2 === "B") value2 *= 1000000000
    return isNaN(value2) ? null : value2
  }

  // Handle "1K$" pattern (suffix before or after dollar sign)
  const reversedMatch = cleaned.match(/([\d,]+(?:\.\d+)?)\s*([MKBmkb])\s*\$?/i)
  if (reversedMatch) {
    let value = parseFloat(reversedMatch[1].replace(/,/g, ""))
    const suffix = reversedMatch[2]?.toUpperCase()
    if (suffix === "M") value *= 1000000
    else if (suffix === "K") value *= 1000
    else if (suffix === "B") value *= 1000000000
    return isNaN(value) ? null : value
  }

  // Standard patterns: $1.5M, $500K, $1,000,000
  const match = cleaned.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*([MKBmkb])?/i)
  if (!match) return null

  let value = parseFloat(match[1].replace(/,/g, ""))
  const suffix = match[2]?.toUpperCase()

  if (suffix === "M") value *= 1000000
  else if (suffix === "K") value *= 1000
  else if (suffix === "B") value *= 1000000000

  return isNaN(value) ? null : value
}

function extractMetricsFromReport(content: string): {
  romy_score?: number
  romy_score_tier?: string
  capacity_rating?: string
  estimated_net_worth?: number
  estimated_gift_capacity?: number
  recommended_ask?: number
} {
  const metrics: ReturnType<typeof extractMetricsFromReport> = {}

  // Extract RōmyScore - multiple patterns for flexibility
  // Pattern 1: "RōmyScore™: X/41" or "RōmyScore: X/41"
  // Pattern 2: "**RōmyScore™:** X/41"
  // Pattern 3: Just "X/41" near RōmyScore mention
  const romyScorePatterns = [
    /R[oō]myScore[™]?\s*[:=]\s*\**(\d+)\s*\/\s*41/i,
    /\*\*R[oō]myScore[™]?\*\*\s*[:=]?\s*\**(\d+)\s*\/\s*41/i,
    /R[oō]myScore[™]?[:\s]*\**(\d+)\**\s*\/\s*41/i,
    /(\d+)\s*\/\s*41\s*(?:points?)?/i,
  ]

  for (const pattern of romyScorePatterns) {
    const match = content.match(pattern)
    if (match) {
      const score = parseInt(match[1], 10)
      if (score >= 0 && score <= 41) {
        metrics.romy_score = score
        break
      }
    }
  }

  // Extract tier - look for tier names after score or in dedicated section
  const tierPatterns = [
    /(\d+)\s*\/\s*41\s*[—–-]+\s*\**([A-Za-z\s-]+?)(?:\**|\n|$)/i,
    /Score\s*Tier[:\s]*\**([A-Za-z\s-]+?)(?:\**|\n|\||$)/i,
    /\*\*(Transformational|High-Capacity|Mid-Capacity|Emerging|Low)[^*]*\*\*/i,
    /(Transformational|High-Capacity Major|Mid-Capacity Growth|Emerging|Low)[\s-]*(?:Donor)?[\s-]*(?:Target)?/i,
  ]

  for (const pattern of tierPatterns) {
    const match = content.match(pattern)
    if (match) {
      const tier = (match[2] || match[1]).trim().replace(/\*+/g, "")
      if (tier && tier.length > 2) {
        metrics.romy_score_tier = tier
        break
      }
    }
  }

  // Extract capacity rating - multiple formats
  const capacityPatterns = [
    /\*\*\[?\s*(MAJOR|PRINCIPAL|LEADERSHIP|ANNUAL)\s*\]?\*\*/i,
    /Capacity\s*Rating[:\s]*\**\[?\s*(MAJOR|PRINCIPAL|LEADERSHIP|ANNUAL)\s*\]?\**/i,
    /(MAJOR|PRINCIPAL|LEADERSHIP|ANNUAL)\s*(?:Gift)?\s*Prospect/i,
    /\|\s*Capacity[^|]*\|\s*\**\s*(Major|Principal|Leadership|Annual)\s*\**/i,
  ]

  for (const pattern of capacityPatterns) {
    const match = content.match(pattern)
    if (match) {
      metrics.capacity_rating = match[1].toUpperCase()
      break
    }
  }

  // Extract net worth - multiple formats including ranges, <$X, etc.
  const netWorthSectionPatterns = [
    /TOTAL\s*(?:ESTIMATED)?\s*NET\s*WORTH[^|\n]*\|?\s*\**\s*([^\n|]+)/i,
    /Estimated\s*Net\s*Worth[:\s]*([^\n|]+)/i,
    /\*\*(?:TOTAL\s*)?(?:ESTIMATED\s*)?NET\s*WORTH\*\*[:\s]*([^\n|]+)/i,
    /Net\s*Worth[:\s|]*([^\n|]+)/i,
  ]

  for (const pattern of netWorthSectionPatterns) {
    const match = content.match(pattern)
    if (match && match[1]) {
      const value = parseDollarAmount(match[1])
      if (value !== null && value > 0) {
        metrics.estimated_net_worth = value
        break
      }
    }
  }

  // Extract gift capacity - multiple formats including ranges, <$X, etc.
  const giftCapacitySectionPatterns = [
    /(?:Est\.?\s*)?Gift\s*Capacity[:\s|]*([^\n|]+)/i,
    /Giving\s*Capacity[:\s|]*([^\n|]+)/i,
    /\*\*Gift\s*Capacity:?\*\*\s*([^\n|]+)/i,
    /Charitable\s*Capacity[:\s|]*([^\n|]+)/i,
  ]

  for (const pattern of giftCapacitySectionPatterns) {
    const match = content.match(pattern)
    if (match && match[1]) {
      const value = parseDollarAmount(match[1])
      if (value !== null && value > 0) {
        metrics.estimated_gift_capacity = value
        break
      }
    }
  }

  // Extract recommended ask - multiple formats including <$1K, ranges, etc.
  // First, try to find the ask section and extract the value using parseDollarAmount
  const askSectionPatterns = [
    /Ask\s*Amount[:\s]*([^\n|]+)/i,
    /Recommended\s*Ask[:\s]*([^\n|]+)/i,
    /\*\*Ask\s*Amount:?\*\*\s*([^\n|]+)/i,
    /\*\*Recommended\s*Ask:?\*\*\s*([^\n|]+)/i,
    /Ask[:\s]+([^\n|]+)/i,
    /Suggested\s*Ask[:\s]*([^\n|]+)/i,
    /Initial\s*Ask[:\s]*([^\n|]+)/i,
  ]

  for (const pattern of askSectionPatterns) {
    const match = content.match(pattern)
    if (match && match[1]) {
      const value = parseDollarAmount(match[1])
      if (value !== null && value > 0) {
        metrics.recommended_ask = value
        break
      }
    }
  }

  // Debug logging for troubleshooting
  console.log("[BatchProcessor] Extracted metrics:", {
    romy_score: metrics.romy_score ?? "NOT FOUND",
    romy_score_tier: metrics.romy_score_tier ?? "NOT FOUND",
    capacity_rating: metrics.capacity_rating ?? "NOT FOUND",
    estimated_net_worth: metrics.estimated_net_worth ?? "NOT FOUND",
    estimated_gift_capacity: metrics.estimated_gift_capacity ?? "NOT FOUND",
    recommended_ask: metrics.recommended_ask ?? "NOT FOUND",
  })

  return metrics
}

// ============================================================================
// MAIN REPORT GENERATION
// ============================================================================

export async function generateProspectReport(
  options: GenerateReportOptions
): Promise<GenerateReportResult> {
  const { prospect, enableWebSearch, apiKey } = options
  const startTime = Date.now()

  try {
    // Build search queries
    let searchContext = ""
    let allSources: Array<{ name: string; url: string }> = []
    const searchQueriesUsed: string[] = []

    // Perform web searches if enabled
    if (enableWebSearch) {
      const queries = generateSearchQueries(prospect)
      searchQueriesUsed.push(...queries)

      console.log(`[BatchProcessor] Running ${queries.length} web searches in parallel for: ${prospect.name}`)

      // Run all searches in parallel - LinkUp supports 10 QPS, we only have 5 queries
      const searchResults = await Promise.all(
        queries.map(query => performWebSearch(query))
      )

      const compiled = compileSearchContext(searchResults)
      searchContext = compiled.context
      allSources = compiled.allSources
    }

    // Build the full prompt
    const prospectInfo = buildProspectQueryString(prospect)
    const additionalInfo = Object.entries(prospect)
      .filter(([key]) => !["name", "address", "city", "state", "zip", "full_address"].includes(key))
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n")

    const userMessage = `Generate a comprehensive prospect research report for:

**Prospect:** ${prospectInfo}
${additionalInfo ? `\n**Additional Information:**\n${additionalInfo}` : ""}

${searchContext ? `## WEB SEARCH RESULTS\n\n${searchContext}` : "**Note:** No web search results available. Generate report based on the information provided and note where additional research is recommended."}

Generate the full report now.`

    // Generate report using AI via OpenRouter
    const openrouter = createOpenRouter({
      apiKey: apiKey || process.env.OPENROUTER_API_KEY,
    })
    const model = openrouter.chat("x-ai/grok-4.1-fast")

    const result = await streamText({
      model,
      system: SYSTEM_PROMPT_DEFAULT,
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 16000,
      temperature: 0.3, // Lower temperature for more consistent reports
    })

    // Collect the full response
    let reportContent = ""
    for await (const chunk of result.textStream) {
      reportContent += chunk
    }

    // Get usage stats
    const usage = await result.usage
    const tokensUsed = (usage?.promptTokens || 0) + (usage?.completionTokens || 0)

    // Extract metrics from the generated report
    const metrics = extractMetricsFromReport(reportContent)

    const processingTime = Date.now() - startTime
    console.log(
      `[BatchProcessor] Report generated for ${prospect.name} in ${processingTime}ms, ` +
      `tokens: ${tokensUsed}, RōmyScore: ${metrics.romy_score || "N/A"}`
    )

    return {
      success: true,
      report_content: reportContent,
      romy_score: metrics.romy_score,
      romy_score_tier: metrics.romy_score_tier,
      capacity_rating: metrics.capacity_rating,
      estimated_net_worth: metrics.estimated_net_worth,
      estimated_gift_capacity: metrics.estimated_gift_capacity,
      recommended_ask: metrics.recommended_ask,
      search_queries_used: searchQueriesUsed,
      sources_found: allSources,
      tokens_used: tokensUsed,
    }
  } catch (error) {
    console.error("[BatchProcessor] Report generation failed:", error)

    return {
      success: false,
      error_message: error instanceof Error ? error.message : "Report generation failed",
    }
  }
}

// ============================================================================
// PROCESS SINGLE BATCH ITEM
// ============================================================================

export async function processBatchItem(
  item: BatchProspectItem,
  settings: { enableWebSearch: boolean; generateRomyScore: boolean },
  apiKey?: string
): Promise<GenerateReportResult> {
  const result = await generateProspectReport({
    prospect: item.input_data,
    enableWebSearch: settings.enableWebSearch,
    generateRomyScore: settings.generateRomyScore,
    apiKey,
  })

  return result
}
