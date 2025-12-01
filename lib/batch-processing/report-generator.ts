/**
 * Batch Prospect Report Generator
 * Generates comprehensive prospect research reports using AI + web search
 *
 * Two modes:
 * - Standard: Fast 2-search approach for quick prioritization
 * - Comprehensive: Full agentic research using all available tools (search, ProPublica, SEC, FEC, Wikidata, etc.)
 */

import { streamText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { LinkupClient } from "linkup-sdk"
import { isLinkupEnabled, getLinkupApiKey, PROSPECT_RESEARCH_DOMAINS } from "@/lib/linkup/config"
import { ProspectInputData, BatchProspectItem, BatchSearchMode } from "./types"
import { buildProspectQueryString } from "./parser"
import { buildBatchTools, getToolDescriptions, extractSourcesFromToolResults } from "./batch-tools"

// ============================================================================
// STANDARD MODE PROMPT
// ============================================================================

/**
 * System prompt for Standard mode - produces brief 5-line prioritization summaries
 * Focused on business ownership and property valuation for quick prospect ranking
 */
const STANDARD_MODE_SYSTEM_PROMPT = `You are Rōmy, a prospect research assistant. Generate a BRIEF prioritization summary for major gift prospect screening.

## OUTPUT FORMAT (exactly these 5 sections):

**Business Ownership:** [List company name(s) and role(s) found, or "No business ownership found"]

**Property:** [Address] - Est. Value: $[amount] | [Owner/Renter status if known]

**Capacity Rating:** [MAJOR/PRINCIPAL/LEADERSHIP/ANNUAL] - Est. Gift Capacity: $[amount] | Est. Net Worth: $[amount]

**RōmyScore™:** [X]/41 — [Tier Name]

**Quick Take:** [One sentence recommendation for cultivation priority]

## SCORING GUIDE (RōmyScore simplified):

Property Value Points:
- >$2M: 12 pts | $1M-$2M: 10 pts | $750K-$1M: 8 pts | $500K-$750K: 6 pts | $250K-$500K: 4 pts | <$250K: 2 pts

Business Ownership Points:
- Founder/Owner: 12 pts | CEO/President: 10 pts | C-Suite/VP: 8 pts | Director/Manager: 5 pts | None found: 0 pts

Additional Indicators (if found in search):
- Multiple properties: +3 pts | Multiple businesses: +3 pts | Executive at public company: +5 pts

Score Tiers:
- 31-41: Transformational Prospect (MAJOR capacity)
- 21-30: High-Capacity Major Donor Target (PRINCIPAL capacity)
- 11-20: Mid-Capacity Growth Potential (LEADERSHIP capacity)
- 0-10: Emerging/Annual Fund (ANNUAL capacity)

## CAPACITY RATINGS:
- **MAJOR:** Property >$750K AND business owner/executive role = Est. Gift Capacity $25K+
- **PRINCIPAL:** Property >$500K OR significant business role = Est. Gift Capacity $10K-$25K
- **LEADERSHIP:** Property >$300K OR professional role = Est. Gift Capacity $5K-$10K
- **ANNUAL:** Lower indicators = Est. Gift Capacity <$5K

## IMPORTANT:
- Output ONLY the 5 sections above, no additional headers or explanations
- Always include dollar amounts for Capacity Rating section (Est. Gift Capacity and Est. Net Worth)
- Base estimates on property values and business ownership found
- If property value unknown, estimate based on location and comparable properties
- Gift capacity is typically 1-5% of estimated net worth`

// ============================================================================
// COMPREHENSIVE MODE PROMPT (with tools)
// ============================================================================

/**
 * System prompt for Comprehensive mode - uses all available research tools
 * to produce data-rich, grounded prospect research reports
 */
const COMPREHENSIVE_MODE_SYSTEM_PROMPT = `You are Rōmy, an expert prospect research assistant for nonprofit fundraising. Generate a COMPREHENSIVE prospect research report using all available research tools.

## YOUR RESEARCH APPROACH - USE SEARCHWEB AGGRESSIVELY

You have access to powerful research tools. **searchWeb (Linkup) is your primary research tool.** Each search costs ~$0.005 - essentially free. Use it REPEATEDLY with different query variations.

### MANDATORY SEARCH STRATEGY (Run 8-12 searchWeb queries minimum):

**HOME VALUATION (run 3-4 searches):**
1. searchWeb("[full address] home value Zillow Redfin")
2. searchWeb("[full address] property records tax assessment")
3. searchWeb("[full address] sold price transaction history")
4. searchWeb("[county] assessor [address]")
5. searchWeb("[owner name] real estate properties [city state]") - finds additional properties

**BUSINESS OWNERSHIP (run 3-4 searches):**
1. searchWeb("[name] owner founder business company [city]")
2. searchWeb("[name] CEO president executive [city]")
3. searchWeb("[name] LLC [state]")
4. searchWeb("[state] secretary of state [name]")
5. If you find a company name: searchWeb("[company name] revenue employees")

**PHILANTHROPIC CONNECTIONS (run 2-3 searches):**
1. searchWeb("[name] foundation board nonprofit philanthropy")
2. searchWeb("[name] donor charitable giving")
3. searchWeb("[name] FEC political contributions")

### THEN USE SPECIALIZED DATA TOOLS:
- ProPublica for nonprofit/foundation 990 data (search by ORGANIZATION name found in web search)
- SEC EDGAR for public company financials if they're an executive
- FEC for political contribution history
- Wikidata for biographical data (education, employers, net worth)
- Yahoo Finance for stock holdings and company profiles

## PERSON-TO-NONPROFIT WORKFLOW
IMPORTANT: ProPublica searches by organization name, NOT person name.
- First, use searchWeb to find foundations/nonprofits the person is affiliated with
- Then use propublica_nonprofit_search with the ORGANIZATION name
- Example: For "John Smith", searchWeb("John Smith foundation board"), find "Smith Family Foundation", then propublica_nonprofit_search("Smith Family Foundation")

## CRITICAL: DO NOT STOP AT ONE SEARCH
If initial results are limited, REFORMULATE and search again with:
- Different name variations (with/without middle name)
- Spouse name if available
- Different address formats
- Specific county name + "assessor"

## OUTPUT FORMAT

After researching, produce a report with these sections:

### Executive Summary
Brief 2-3 sentence overview of the prospect's wealth indicators and giving potential.

### Wealth Indicators
- **Real Estate:** Property values, addresses, ownership details
- **Business Interests:** Company ownership, executive positions, equity stakes
- **Stock Holdings:** Public company shares, insider transactions
- **Other Assets:** Disclosed net worth, inheritance, other indicators

### Philanthropic Profile
- **Foundation Affiliations:** Foundations they run or serve on (with 990 data if available)
- **Nonprofit Board Service:** Current and past board memberships
- **Political Giving:** FEC contribution history and patterns
- **Known Donations:** Major gifts to organizations

### Capacity Assessment
| Metric | Value |
|--------|-------|
| **Estimated Net Worth** | $[amount] |
| **Estimated Gift Capacity** | $[amount] |
| **Capacity Rating** | [MAJOR/PRINCIPAL/LEADERSHIP/ANNUAL] |
| **RōmyScore™** | [X]/41 |

### Cultivation Strategy
1-2 specific recommendations for engagement approach.

### Sources
List the key sources used in this research.

## SCORING GUIDE (RōmyScore):
- 31-41: Transformational Prospect (MAJOR capacity, $25K+)
- 21-30: High-Capacity Major Donor Target (PRINCIPAL capacity, $10K-$25K)
- 11-20: Mid-Capacity Growth Potential (LEADERSHIP capacity, $5K-$10K)
- 0-10: Emerging/Annual Fund (ANNUAL capacity, <$5K)

## IMPORTANT:
- USE YOUR TOOLS - don't just summarize, actively research
- Include specific dollar amounts with sources
- If data is unavailable, note it and estimate based on available indicators
- Always cite your sources`

// ============================================================================
// TYPES
// ============================================================================

interface GenerateReportOptions {
  prospect: ProspectInputData
  enableWebSearch: boolean
  generateRomyScore: boolean
  searchMode?: BatchSearchMode
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

    // Use "standard" mode with curated domains for fast, targeted research
    // includeDomains focuses search on authoritative prospect research sources
    // 60s timeout to allow thorough results
    const result = await Promise.race([
      client.search({
        query,
        depth: "standard",
        outputType: "sourcedAnswer",
        includeDomains: [...PROSPECT_RESEARCH_DOMAINS],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Search timeout")), 60000)
      ),
    ])

    // Type assertion: we know result is SourcedAnswer because outputType is "sourcedAnswer"
    const sourcedResult = result as { answer?: string; sources?: Array<{ name?: string; url: string; snippet?: string }> }

    return {
      answer: sourcedResult.answer || "",
      sources: (sourcedResult.sources || []).map((s) => ({
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

/**
 * Generate search queries for Standard mode (quick prioritization)
 * Run 5-6 targeted searches to build a complete picture
 * Each search costs ~$0.005 - thoroughness is expected
 */
function generateStandardSearchQueries(prospect: ProspectInputData): string[] {
  const name = prospect.name
  const location = [prospect.city, prospect.state].filter(Boolean).join(", ")
  const fullAddress = buildProspectQueryString(prospect)
  const state = prospect.state || ""

  const queries: string[] = []

  // Business ownership searches (multiple angles)
  queries.push(`"${name}" ${location} business owner company founder CEO`)
  queries.push(`"${name}" ${location} president executive LLC`)
  if (state) {
    queries.push(`"${name}" ${state} secretary of state corporation registered agent`)
  }

  // Property/real estate searches (multiple sources for triangulation)
  if (prospect.address || prospect.full_address) {
    queries.push(`"${fullAddress}" home value Zillow Redfin estimate`)
    queries.push(`"${fullAddress}" property records tax assessment sold price`)
    // County assessor search if we can infer county
    queries.push(`"${fullAddress}" county assessor property tax`)
  } else {
    queries.push(`"${name}" ${location} property home owner real estate`)
    queries.push(`"${name}" ${location} property records tax assessment`)
  }

  // Additional wealth indicators
  queries.push(`"${name}" ${location} philanthropy foundation board nonprofit donor`)

  return queries
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

  // Handle "<$1K" or "<$1,000" or "<1K$" or "<38K" (no dollar sign) patterns
  const lessThanMatch = cleaned.match(/<\s*\$?\s*([\d,]+(?:\.\d+)?)\s*([MKBmkb])?\s*\$?/i)
  if (lessThanMatch) {
    let value = parseFloat(lessThanMatch[1].replace(/,/g, ""))
    const suffix = lessThanMatch[2]?.toUpperCase()
    if (suffix === "M") value *= 1000000
    else if (suffix === "K") value *= 1000
    else if (suffix === "B") value *= 1000000000
    return isNaN(value) ? null : value
  }

  // Handle ">$1K" or ">$1,000" or ">38K" (no dollar sign) patterns - use the lower bound
  const greaterThanMatch = cleaned.match(/>\s*\$?\s*([\d,]+(?:\.\d+)?)\s*([MKBmkb])?\s*\$?/i)
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

/**
 * Generate a comprehensive prospect report using agentic AI with all available tools.
 * This mode gives the AI access to search, ProPublica, SEC, FEC, Wikidata, etc.
 * and lets it autonomously research the prospect using maxSteps.
 */
async function generateComprehensiveReportWithTools(
  options: GenerateReportOptions
): Promise<GenerateReportResult> {
  const { prospect, apiKey } = options
  const startTime = Date.now()

  try {
    // Build the tools object - same tools as chat API
    const tools = buildBatchTools()
    const hasTools = Object.keys(tools).length > 0

    // Build prospect info for the prompt
    const prospectInfo = buildProspectQueryString(prospect)
    const additionalInfo = Object.entries(prospect)
      .filter(([key]) => !["name", "address", "city", "state", "zip", "full_address"].includes(key))
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n")

    // Build system prompt with tool descriptions
    let systemPrompt = COMPREHENSIVE_MODE_SYSTEM_PROMPT
    if (hasTools) {
      systemPrompt += "\n\n" + getToolDescriptions()
    }

    // User message for comprehensive research
    const userMessage = `Research this prospect and generate a comprehensive prospect research report:

**Prospect:** ${prospectInfo}
${additionalInfo ? `\n**Additional Information:**\n${additionalInfo}` : ""}

Use your research tools to gather data about this person:
1. Start with web search to find their professional background and affiliations
2. If you discover they're affiliated with foundations/nonprofits, search ProPublica for 990 data
3. If they're a public company executive, check SEC EDGAR for financial data
4. Check FEC for political contribution history
5. Use Wikidata for biographical details

After researching, produce the comprehensive report with all sections filled in based on your findings.`

    console.log(`[BatchProcessor] Starting comprehensive agentic research for: ${prospect.name}`)
    console.log(`[BatchProcessor] Available tools: ${Object.keys(tools).join(", ")}`)

    // Generate report using AI with tools
    const openrouter = createOpenRouter({
      apiKey: apiKey || process.env.OPENROUTER_API_KEY,
    })
    const model = openrouter.chat("x-ai/grok-4.1-fast")

    const result = await streamText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: hasTools ? tools : undefined,
      maxSteps: hasTools ? 25 : 1, // Allow 25 steps for thorough agentic research (8-12 searchWeb + data tools)
      maxTokens: 16000,
      temperature: 0.3,
    })

    // Collect the full response and track tool results
    let reportContent = ""
    const toolResults: Array<{ toolName: string; result: unknown }> = []

    for await (const chunk of result.textStream) {
      reportContent += chunk
    }

    // Get the full response to extract tool results for sources
    // Tool results are in steps from the AI SDK
    const steps = await result.steps
    for (const step of steps) {
      // Type-safe access to tool results - use type assertion since ToolSet is generic
      const stepToolResults = step.toolResults as Array<{
        toolName: string
        result: unknown
      }> | undefined
      if (stepToolResults && Array.isArray(stepToolResults)) {
        for (const toolResult of stepToolResults) {
          toolResults.push({
            toolName: toolResult.toolName,
            result: toolResult.result,
          })
        }
      }
    }

    // Extract sources from tool results
    const allSources = extractSourcesFromToolResults(toolResults)

    // Get usage stats
    const usage = await result.usage
    const tokensUsed = (usage?.promptTokens || 0) + (usage?.completionTokens || 0)

    // Extract metrics from the generated report
    const metrics = extractMetricsFromReport(reportContent)

    const processingTime = Date.now() - startTime
    console.log(
      `[BatchProcessor] Comprehensive report generated for ${prospect.name} in ${processingTime}ms, ` +
        `tokens: ${tokensUsed}, tool calls: ${toolResults.length}, RōmyScore: ${metrics.romy_score || "N/A"}`
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
      search_queries_used: toolResults.map((t) => `Tool: ${t.toolName}`),
      sources_found: allSources,
      tokens_used: tokensUsed,
    }
  } catch (error) {
    console.error("[BatchProcessor] Comprehensive report generation failed:", error)

    return {
      success: false,
      error_message: error instanceof Error ? error.message : "Report generation failed",
    }
  }
}

/**
 * Generate a standard report using the fast 2-search approach.
 * This is the original implementation - fast and cost-effective.
 */
async function generateStandardReport(
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
      const queries = generateStandardSearchQueries(prospect)
      searchQueriesUsed.push(...queries)

      console.log(`[BatchProcessor] Running ${queries.length} web searches (standard mode) for: ${prospect.name}`)

      // Run all searches in parallel - LinkUp supports 10 QPS
      const searchResults = await Promise.all(queries.map((query) => performWebSearch(query)))

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

    const userMessage = `Generate a brief prioritization summary for:

**Prospect:** ${prospectInfo}
${additionalInfo ? `\n**Additional Information:**\n${additionalInfo}` : ""}

${searchContext ? `## WEB SEARCH RESULTS\n\n${searchContext}` : "**Note:** No web search results available. Estimate based on location and typical property values for the area."}

Generate the 5-section prioritization summary now.`

    // Generate report using AI via OpenRouter
    const openrouter = createOpenRouter({
      apiKey: apiKey || process.env.OPENROUTER_API_KEY,
    })
    const model = openrouter.chat("x-ai/grok-4.1-fast")

    const result = await streamText({
      model,
      system: STANDARD_MODE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 2000,
      temperature: 0.3,
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
      `[BatchProcessor] Standard report generated for ${prospect.name} in ${processingTime}ms, ` +
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
    console.error("[BatchProcessor] Standard report generation failed:", error)

    return {
      success: false,
      error_message: error instanceof Error ? error.message : "Report generation failed",
    }
  }
}

/**
 * Main entry point for prospect report generation.
 * Routes to either standard (fast 2-search) or comprehensive (agentic with tools) mode.
 */
export async function generateProspectReport(
  options: GenerateReportOptions
): Promise<GenerateReportResult> {
  const { searchMode = "standard" } = options

  // Route to appropriate generation mode
  if (searchMode === "comprehensive") {
    // Comprehensive mode: Full agentic research with all tools
    return generateComprehensiveReportWithTools(options)
  } else {
    // Standard mode: Fast 2-search approach (original implementation)
    return generateStandardReport(options)
  }
}

// ============================================================================
// PROCESS SINGLE BATCH ITEM
// ============================================================================

export async function processBatchItem(
  item: BatchProspectItem,
  settings: { enableWebSearch: boolean; generateRomyScore: boolean; searchMode?: BatchSearchMode },
  apiKey?: string
): Promise<GenerateReportResult> {
  const result = await generateProspectReport({
    prospect: item.input_data,
    enableWebSearch: settings.enableWebSearch,
    generateRomyScore: settings.generateRomyScore,
    searchMode: settings.searchMode || "standard",
    apiKey,
  })

  return result
}
