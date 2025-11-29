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

function extractMetricsFromReport(content: string): {
  romy_score?: number
  romy_score_tier?: string
  capacity_rating?: string
  estimated_net_worth?: number
  estimated_gift_capacity?: number
  recommended_ask?: number
} {
  const metrics: ReturnType<typeof extractMetricsFromReport> = {}

  // Extract RōmyScore - look for pattern like "X/41" or "RōmyScore™: X/41"
  const romyScoreMatch = content.match(/RōmyScore[™]?[:\s]*(\d+)\/41/i)
  if (romyScoreMatch) {
    metrics.romy_score = parseInt(romyScoreMatch[1], 10)
  }

  // Extract tier
  const tierMatch = content.match(/(\d+)\/41\s*[—–-]\s*([\w\s-]+)/i)
  if (tierMatch) {
    metrics.romy_score_tier = tierMatch[2].trim()
  }

  // Extract capacity rating
  const capacityMatch = content.match(
    /\*\*\[(MAJOR|PRINCIPAL|LEADERSHIP|ANNUAL)\]\*\*/i
  )
  if (capacityMatch) {
    metrics.capacity_rating = capacityMatch[1].toUpperCase()
  }

  // Extract net worth - look for "TOTAL ESTIMATED NET WORTH" row
  const netWorthMatch = content.match(
    /TOTAL ESTIMATED NET WORTH[^$]*\$\*?\*?([\d,]+(?:\.\d+)?)/i
  )
  if (netWorthMatch) {
    metrics.estimated_net_worth = parseFloat(
      netWorthMatch[1].replace(/,/g, "")
    )
  }

  // Extract recommended ask
  const askMatch = content.match(/Ask Amount[:\s]*\$\*?\*?([\d,]+(?:\.\d+)?)/i)
  if (askMatch) {
    metrics.recommended_ask = parseFloat(askMatch[1].replace(/,/g, ""))
  }

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
