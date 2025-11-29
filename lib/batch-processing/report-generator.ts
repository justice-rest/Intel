/**
 * Batch Prospect Report Generator
 * Generates comprehensive prospect research reports using AI + web search
 */

import { streamText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { LinkupClient } from "linkup-sdk"
import { isLinkupEnabled, getLinkupApiKey } from "@/lib/linkup/config"
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

async function performWebSearch(query: string): Promise<WebSearchResult | null> {
  if (!isLinkupEnabled()) {
    console.log("[BatchProcessor] Linkup not enabled, skipping web search")
    return null
  }

  try {
    const client = new LinkupClient({ apiKey: getLinkupApiKey() })

    const result = await Promise.race([
      client.search({
        query,
        depth: "standard",
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
// PROSPECT REPORT SYSTEM PROMPT
// ============================================================================

const PROSPECT_REPORT_PROMPT = `You are generating a COMPREHENSIVE PROSPECT RESEARCH REPORT for fundraising purposes.

Based on the provided prospect information and web search results, create a detailed prospect research report following this EXACT structure:

# PROSPECT RESEARCH REPORT
**Subject:** [Full Name]
**Address:** [Full Address]
**Report Date:** [Current Date]

---

## EXECUTIVE SUMMARY
A 2-3 paragraph overview with key findings: estimated capacity, primary wealth sources, philanthropic patterns, and bottom-line recommendation.

---

## 1. BIOGRAPHICAL PROFILE

### Personal Information
- Full Name, Age (if found), Current Residence
- Family Members (if found)
- Education

### Professional Background
- Current Position
- Career History
- Board Memberships
- Notable Achievements

---

## 2. REAL ESTATE HOLDINGS
List properties found with estimated values. Include Total Real Estate Value.

---

## 3. BUSINESS INTERESTS & CORPORATE AFFILIATIONS
Company ownership, executive positions, board roles.

---

## 4. SEC FILINGS & STOCK HOLDINGS
Any securities holdings or insider transactions found.

---

## 5. POLITICAL GIVING
FEC and state political contributions.

---

## 6. CHARITABLE GIVING & PHILANTHROPIC HISTORY
Foundation connections, known major gifts, nonprofit board service.

---

## 7. WEALTH INDICATORS & CAPACITY RATING

### Wealth Indicator Summary Table
| Indicator | Value | Confidence |
|-----------|-------|------------|
| Real Estate | $X | High/Medium/Low |
| Business Interests | $X | High/Medium/Low |
| Securities | $X | High/Medium/Low |
| **TOTAL ESTIMATED NET WORTH** | **$X** | |

### Capacity Rating
**[MAJOR/PRINCIPAL/LEADERSHIP/ANNUAL]** Gift Prospect

### RōmyScore™ (0-41 points)
Calculate using the four dimensions:
- Foundation Attributes (0-28)
- Liquidity & Tax-Planning (0-7)
- Opportunity & Commitment (0-6)
- Constraints & Headwinds (0 to -2)

**RōmyScore™:** X/41 — [TIER NAME]

| Part | Score | Key Factors |
|------|-------|-------------|
| Foundation Attributes | X/28 | [Summary] |
| Liquidity & Tax-Planning | X/7 | [Summary] |
| Opportunity & Commitment | X/6 | [Summary] |
| Constraints & Headwinds | -X | [Summary] |

---

## 8. CONNECTION POINTS & AFFINITY ANALYSIS
Mission alignment, existing relationships, engagement opportunities.

---

## 9. CULTIVATION STRATEGY & RECOMMENDATIONS

### Recommended Ask
- **Ask Amount:** $X
- **Ask Type:** [Type]
- **Timing:** [When]

---

## 10. SOURCES & METHODOLOGY
List all sources used.
**Research Confidence Level:** [High/Medium/Low]

---

IMPORTANT RULES:
1. Be SPECIFIC with dollar amounts - use actual figures, not ranges
2. If information is not found, state "No public records found"
3. Cross-reference data points for coherent conclusions
4. The RōmyScore must be calculated based on available indicators
5. Include concrete next-step recommendations`

// ============================================================================
// EXTRACT METRICS FROM REPORT
// ============================================================================

/**
 * Parse a dollar amount from various formats
 * Handles: $1,000,000 | $1M | $1.5M | $500K | **$1,000,000** etc.
 */
function parseDollarAmount(str: string): number | null {
  if (!str) return null

  // Remove markdown formatting and trim
  const cleaned = str.replace(/\*\*/g, "").replace(/\*/g, "").trim()

  // Match patterns like $1.5M, $500K, or $1,000,000
  const match = cleaned.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*([MmKkBb])?/i)
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

  // Extract net worth - multiple formats
  const netWorthPatterns = [
    /TOTAL\s*(?:ESTIMATED)?\s*NET\s*WORTH[^$\n]*\$\s*\**\s*([\d,]+(?:\.\d+)?)\s*([MKB])?/i,
    /Estimated\s*Net\s*Worth[:\s]*\$?\s*\**\s*([\d,]+(?:\.\d+)?)\s*([MKB])?/i,
    /Net\s*Worth[:\s|]*\$?\s*\**\s*([\d,]+(?:\.\d+)?)\s*([MKB])?/i,
  ]

  for (const pattern of netWorthPatterns) {
    const match = content.match(pattern)
    if (match) {
      let value = parseFloat(match[1].replace(/,/g, ""))
      const suffix = match[2]?.toUpperCase()
      if (suffix === "M") value *= 1000000
      else if (suffix === "K") value *= 1000
      else if (suffix === "B") value *= 1000000000
      if (!isNaN(value) && value > 0) {
        metrics.estimated_net_worth = value
        break
      }
    }
  }

  // Extract gift capacity
  const giftCapacityPatterns = [
    /(?:Est\.?\s*)?Gift\s*Capacity[:\s|]*\$?\s*\**\s*([\d,]+(?:\.\d+)?)\s*([MKB])?/i,
    /Giving\s*Capacity[:\s|]*\$?\s*\**\s*([\d,]+(?:\.\d+)?)\s*([MKB])?/i,
  ]

  for (const pattern of giftCapacityPatterns) {
    const match = content.match(pattern)
    if (match) {
      let value = parseFloat(match[1].replace(/,/g, ""))
      const suffix = match[2]?.toUpperCase()
      if (suffix === "M") value *= 1000000
      else if (suffix === "K") value *= 1000
      else if (suffix === "B") value *= 1000000000
      if (!isNaN(value) && value > 0) {
        metrics.estimated_gift_capacity = value
        break
      }
    }
  }

  // Extract recommended ask - multiple formats
  const askPatterns = [
    /Ask\s*Amount[:\s]*\$\s*\**\s*([\d,]+(?:\.\d+)?)\s*([MKB])?/i,
    /Recommended\s*Ask[:\s]*\$\s*\**\s*([\d,]+(?:\.\d+)?)\s*([MKB])?/i,
    /\*\*Ask\s*Amount:?\*\*\s*\$?\s*([\d,]+(?:\.\d+)?)\s*([MKB])?/i,
    /Ask[:\s]+\$\s*([\d,]+(?:\.\d+)?)\s*([MKB])?/i,
  ]

  for (const pattern of askPatterns) {
    const match = content.match(pattern)
    if (match) {
      let value = parseFloat(match[1].replace(/,/g, ""))
      const suffix = match[2]?.toUpperCase()
      if (suffix === "M") value *= 1000000
      else if (suffix === "K") value *= 1000
      else if (suffix === "B") value *= 1000000000
      if (!isNaN(value) && value > 0) {
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

      console.log(`[BatchProcessor] Running ${queries.length} web searches for: ${prospect.name}`)

      // Run searches sequentially to respect rate limits
      const searchResults: (WebSearchResult | null)[] = []
      for (const query of queries) {
        const result = await performWebSearch(query)
        searchResults.push(result)

        // Small delay between searches
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

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
      system: PROSPECT_REPORT_PROMPT,
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
