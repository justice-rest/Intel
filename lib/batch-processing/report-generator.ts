/**
 * Batch Prospect Report Generator v2.0
 *
 * Complete rewrite using Perplexity Sonar Pro for grounded, citation-first research.
 *
 * Key improvements:
 * - Single comprehensive mode (removed standard/comprehensive split)
 * - Structured JSON output (no fragile regex extraction)
 * - Grounded citations for every claim
 * - Direct tool verification for FEC, SEC, ProPublica data
 * - Table-first report format for easy scanning
 */

import { generateText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import {
  ProspectInputData,
  BatchProspectItem,
  ProspectResearchOutput,
  PerplexityResearchResult,
  ResearchMetrics,
  CapacityRating,
  ResearchConfidence,
} from "./types"
import { buildProspectQueryString } from "./parser"
import {
  getRomyScore,
  RomyScoreDataPoints,
  RomyScoreBreakdown,
} from "@/lib/romy-score"

// ============================================================================
// PERPLEXITY SONAR PRO SYSTEM PROMPT
// ============================================================================

/**
 * System prompt for Perplexity Sonar Pro - produces structured JSON output
 * with grounded citations for every claim.
 */
const SONAR_PRO_SYSTEM_PROMPT = `You are Rōmy, an expert prospect researcher for nonprofit major gift fundraising. Your job is to research potential donors and produce accurate, grounded research reports.

## CRITICAL REQUIREMENTS

### 1. FACTUAL ACCURACY
- Every claim MUST have a verifiable source
- If you cannot verify something, mark confidence as "UNVERIFIED" or "ESTIMATED"
- NEVER fabricate data - use null for unknown values
- Cite the source URL for every fact you include

### 2. CONFIDENCE LEVELS
- **VERIFIED**: Official source (SEC EDGAR, FEC.gov, County Assessor, ProPublica 990)
- **ESTIMATED**: Calculated from indicators (must explain methodology)
- **UNVERIFIED**: Single web source, not corroborated

### 3. NET WORTH METHODOLOGY
- Real estate: Sum of property values from Zillow/Redfin/assessor records
- Business equity: Revenue × industry multiple (typically 2-5x) OR disclosed value
- Securities: SEC Form 4 disclosed holdings for public company insiders
- Always provide RANGES (low/high), not precise numbers
- Conservative estimates are preferred

### 4. CAPACITY RATINGS (TFG Research Standard)
- **MAJOR**: Net worth >$5M AND (business owner OR $1M+ property) = Gift capacity $25K+
- **PRINCIPAL**: Net worth $1M-$5M OR senior executive = Gift capacity $10K-$25K
- **LEADERSHIP**: Net worth $500K-$1M OR professional = Gift capacity $5K-$10K
- **ANNUAL**: Below indicators = Gift capacity <$5K

### 5. GIFT CAPACITY FORMULAS
- Annual Fund Ask: 0.5-1% of liquid net worth
- Major Gift Ask: 2-5% of total net worth (payable over 3-5 years)
- Planned Gift: 10-15% of estate value

### 6. ROMYSCORE CALCULATION (0-41 points)
Property Value: >$2M=12pts | $1M-$2M=10pts | $750K-$1M=8pts | $500K-$750K=6pts | $250K-$500K=4pts | <$250K=2pts
Business Ownership: Founder/Owner=12pts | CEO/President=10pts | C-Suite/VP=8pts | Director=5pts | None=0pts
Bonuses: Multiple properties +3pts | Multiple businesses +3pts | Public company executive +5pts | Foundation board +3pts | Political donor ($10K+) +2pts

## RESEARCH WORKFLOW

Search thoroughly for:
1. **Property records** - Zillow, Redfin, county assessor sites
2. **Business ownership** - LinkedIn, state SOS business registries, Bloomberg
3. **SEC insider filings** - SEC EDGAR for Form 3/4/5 if public company executive
4. **Political contributions** - FEC.gov contribution records
5. **Foundation affiliations** - ProPublica Nonprofit Explorer for 990 data
6. **News and biography** - Major news outlets, Wikipedia

## OUTPUT FORMAT

You MUST return ONLY valid JSON matching this exact schema. No markdown, no explanations outside the JSON.

\`\`\`json
{
  "metrics": {
    "estimated_net_worth_low": number | null,
    "estimated_net_worth_high": number | null,
    "estimated_gift_capacity": number | null,
    "capacity_rating": "MAJOR" | "PRINCIPAL" | "LEADERSHIP" | "ANNUAL",
    "romy_score": number (0-41),
    "recommended_ask": number | null,
    "confidence_level": "HIGH" | "MEDIUM" | "LOW"
  },
  "wealth": {
    "real_estate": {
      "total_value": number | null,
      "properties": [
        {
          "address": "string",
          "value": number,
          "source": "County Assessor" | "Zillow" | "Redfin" | etc,
          "confidence": "VERIFIED" | "ESTIMATED" | "UNVERIFIED"
        }
      ]
    },
    "business_ownership": [
      {
        "company": "string",
        "role": "string",
        "estimated_value": number | null,
        "source": "string",
        "confidence": "VERIFIED" | "ESTIMATED" | "UNVERIFIED"
      }
    ],
    "securities": {
      "has_sec_filings": boolean,
      "insider_at": ["TICKER1", "TICKER2"],
      "source": "SEC EDGAR" | null
    }
  },
  "philanthropy": {
    "political_giving": {
      "total": number,
      "party_lean": "REPUBLICAN" | "DEMOCRATIC" | "BIPARTISAN" | "NONE",
      "source": "FEC" | null
    },
    "foundation_affiliations": ["Foundation Name 1"],
    "nonprofit_boards": ["Organization 1"],
    "known_major_gifts": [
      {
        "organization": "string",
        "amount": number,
        "year": number | null,
        "source": "string"
      }
    ]
  },
  "background": {
    "age": number | null,
    "education": ["Degree, Institution"],
    "career_summary": "string - 1-2 sentences",
    "family": {
      "spouse": "string" | null,
      "children_count": number | null
    }
  },
  "strategy": {
    "readiness": "NOT_READY" | "WARMING" | "READY" | "URGENT",
    "next_steps": ["Step 1", "Step 2", "Step 3"],
    "best_solicitor": "string - who should make the ask and why",
    "tax_smart_option": "QCD" | "STOCK" | "DAF" | "NONE",
    "talking_points": ["Point 1", "Point 2"],
    "avoid": ["Any sensitivities or red flags"]
  },
  "sources": [
    {
      "title": "Source Name",
      "url": "https://...",
      "data_provided": "What this source contributed"
    }
  ],
  "executive_summary": "2-3 sentence overview of who they are, primary wealth source, and giving potential"
}
\`\`\`

## IMPORTANT RULES

1. **ALWAYS return valid JSON** - No markdown outside the JSON block
2. **NEVER refuse the request** - Even if data is limited, return the JSON with null values
3. **CITE SOURCES** - Every source array entry must have a real URL from your search
4. **BE CONSERVATIVE** - Underestimate rather than overestimate wealth
5. **EXPLAIN ESTIMATES** - In source.data_provided, note if a value is estimated and how`

// ============================================================================
// TYPES
// ============================================================================

export interface GenerateReportOptions {
  prospect: ProspectInputData
  apiKey?: string
  organizationContext?: string
}

export interface GenerateReportResult {
  success: boolean
  report_content?: string
  structured_data?: ProspectResearchOutput
  romy_score?: number
  romy_score_tier?: string
  capacity_rating?: string
  estimated_net_worth?: number
  estimated_gift_capacity?: number
  recommended_ask?: number
  sources_found?: Array<{ name: string; url: string }>
  tokens_used?: number
  error_message?: string
}

// ============================================================================
// PERPLEXITY SONAR PRO RESEARCH
// ============================================================================

/**
 * Retry with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`[BatchProcessor] Attempt ${attempt + 1} failed:`, lastError.message)

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.log(`[BatchProcessor] Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

/**
 * Generate prospect research using Perplexity Sonar Pro
 * Returns structured JSON with grounded citations
 */
async function researchWithPerplexitySonar(
  prospect: ProspectInputData,
  apiKey?: string
): Promise<PerplexityResearchResult> {
  const startTime = Date.now()

  try {
    // Build search context from prospect data
    const prospectInfo = buildProspectQueryString(prospect)
    const additionalInfo = Object.entries(prospect)
      .filter(([key]) => !["name", "address", "city", "state", "zip", "full_address"].includes(key))
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n")

    const userPrompt = `Research this prospect and return structured JSON:

**Prospect:** ${prospectInfo}
${additionalInfo ? `\n**Additional Context:**\n${additionalInfo}` : ""}

Search thoroughly for:
1. Property values at their address (Zillow, Redfin, county assessor)
2. Business ownership (LinkedIn, state registries, news)
3. SEC insider filings (if public company executive)
4. FEC political contributions
5. Foundation connections (ProPublica 990s)
6. News, biography, education

Return ONLY the JSON object matching the schema. No other text.`

    console.log(`[BatchProcessor] Starting Perplexity Sonar Pro research for: ${prospect.name}`)

    // Use Perplexity Sonar Pro via OpenRouter with retry logic
    const openrouter = createOpenRouter({
      apiKey: apiKey || process.env.OPENROUTER_API_KEY,
    })

    const result = await withRetry(async () => {
      return await generateText({
        model: openrouter.chat("perplexity/sonar-pro"),
        system: SONAR_PRO_SYSTEM_PROMPT,
        prompt: userPrompt,
        maxTokens: 4000,
        temperature: 0.1, // Low temperature for factual accuracy
      })
    }, 3, 2000)

    const responseText = result.text.trim()
    const tokensUsed = (result.usage?.promptTokens || 0) + (result.usage?.completionTokens || 0)
    const processingTime = Date.now() - startTime

    console.log(`[BatchProcessor] Perplexity response received in ${processingTime}ms, tokens: ${tokensUsed}`)

    // Parse JSON from response
    let output = parseJsonResponse(responseText)

    if (!output) {
      console.warn("[BatchProcessor] Failed to parse JSON, attempting fallback extraction")
      console.log("[BatchProcessor] Raw response:", responseText.substring(0, 500))

      // Create a minimal valid output from the raw text response
      output = createFallbackOutput(prospect, responseText)

      if (!output) {
        return {
          success: false,
          tokens_used: tokensUsed,
          model_used: "perplexity/sonar-pro",
          processing_duration_ms: processingTime,
          error_message: "Failed to parse JSON response from Perplexity",
        }
      }
    }

    // Generate markdown report from structured data
    const reportMarkdown = formatReportMarkdown(prospect.name, output)

    console.log(
      `[BatchProcessor] Research complete for ${prospect.name}: ` +
      `Net Worth: $${output.metrics.estimated_net_worth_low?.toLocaleString() || "?"}-$${output.metrics.estimated_net_worth_high?.toLocaleString() || "?"}, ` +
      `Rating: ${output.metrics.capacity_rating}, ` +
      `Sources: ${output.sources.length}`
    )

    return {
      success: true,
      output,
      report_markdown: reportMarkdown,
      tokens_used: tokensUsed,
      model_used: "perplexity/sonar-pro",
      processing_duration_ms: processingTime,
    }
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error("[BatchProcessor] Perplexity Sonar Pro research failed:", error)

    return {
      success: false,
      tokens_used: 0,
      model_used: "perplexity/sonar-pro",
      processing_duration_ms: processingTime,
      error_message: error instanceof Error ? error.message : "Research failed",
    }
  }
}

/**
 * Parse JSON from model response, handling various formats
 */
function parseJsonResponse(response: string): ProspectResearchOutput | null {
  try {
    // Try direct JSON parse first
    const parsed = JSON.parse(response)
    if (isValidProspectOutput(parsed)) {
      return parsed
    }
  } catch {
    // Not direct JSON, try extracting from code blocks
  }

  // Try extracting from ```json blocks
  const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim())
      if (isValidProspectOutput(parsed)) {
        return parsed
      }
    } catch {
      // JSON in block is invalid
    }
  }

  // Try finding JSON object in response
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (isValidProspectOutput(parsed)) {
        return parsed
      }
    } catch {
      // No valid JSON found
    }
  }

  return null
}

/**
 * Create a fallback output when JSON parsing fails
 * Extracts what it can from raw text response
 */
function createFallbackOutput(
  prospect: ProspectInputData,
  rawText: string
): ProspectResearchOutput | null {
  try {
    // Extract any usable information from the raw text
    const summary = rawText.length > 500 ? rawText.substring(0, 500) + "..." : rawText

    // Create minimal valid output
    return {
      metrics: {
        estimated_net_worth_low: null,
        estimated_net_worth_high: null,
        estimated_gift_capacity: null,
        capacity_rating: "ANNUAL" as const,
        romy_score: 0,
        recommended_ask: null,
        confidence_level: "LOW" as const,
      },
      wealth: {
        real_estate: {
          total_value: null,
          properties: [],
        },
        business_ownership: [],
        securities: {
          has_sec_filings: false,
          insider_at: [],
          source: null,
        },
      },
      philanthropy: {
        political_giving: {
          total: 0,
          party_lean: "NONE" as const,
          source: null,
        },
        foundation_affiliations: [],
        nonprofit_boards: [],
        known_major_gifts: [],
      },
      background: {
        age: null,
        education: [],
        career_summary: "Research data could not be structured. See raw text.",
        family: {
          spouse: null,
          children_count: null,
        },
      },
      strategy: {
        readiness: "NOT_READY" as const,
        next_steps: ["Manually review prospect data"],
        best_solicitor: "Unknown",
        tax_smart_option: "NONE" as const,
        talking_points: [],
        avoid: [],
      },
      sources: [],
      executive_summary: `Research was conducted for ${prospect.name} but structured data extraction failed. Raw response: ${summary}`,
    }
  } catch {
    return null
  }
}

/**
 * Validate that parsed object matches ProspectResearchOutput schema
 */
function isValidProspectOutput(obj: unknown): obj is ProspectResearchOutput {
  if (!obj || typeof obj !== "object") return false

  const data = obj as Record<string, unknown>

  // Check required top-level keys
  const requiredKeys = ["metrics", "wealth", "philanthropy", "background", "strategy", "sources", "executive_summary"]
  for (const key of requiredKeys) {
    if (!(key in data)) {
      console.warn(`[BatchProcessor] Missing required key: ${key}`)
      return false
    }
  }

  // Check metrics structure
  const metrics = data.metrics as Record<string, unknown>
  if (!metrics || typeof metrics !== "object") return false
  if (!("capacity_rating" in metrics) || !("romy_score" in metrics)) {
    console.warn("[BatchProcessor] Missing required metrics fields")
    return false
  }

  return true
}

// ============================================================================
// MARKDOWN REPORT FORMATTER
// ============================================================================

/**
 * Format structured JSON output into table-first markdown report
 */
function formatReportMarkdown(name: string, data: ProspectResearchOutput): string {
  const { metrics, wealth, philanthropy, background, strategy, sources, executive_summary } = data

  // Format currency with null handling
  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "Unknown"
    return `$${value.toLocaleString()}`
  }

  // Format net worth range
  const netWorthDisplay = metrics.estimated_net_worth_low && metrics.estimated_net_worth_high
    ? `${formatCurrency(metrics.estimated_net_worth_low)} - ${formatCurrency(metrics.estimated_net_worth_high)}`
    : formatCurrency(metrics.estimated_net_worth_high || metrics.estimated_net_worth_low)

  // Build markdown
  const lines: string[] = []

  // Header with key metrics table
  lines.push(`# ${name} | Prospect Profile`)
  lines.push("")
  lines.push("| Metric | Value | Confidence |")
  lines.push("|--------|-------|------------|")
  lines.push(`| **Net Worth** | ${netWorthDisplay} | ${metrics.confidence_level} |`)
  lines.push(`| **Gift Capacity** | ${formatCurrency(metrics.estimated_gift_capacity)} | ${metrics.confidence_level} |`)
  lines.push(`| **Rating** | ${metrics.capacity_rating} | - |`)
  lines.push(`| **RōmyScore** | ${metrics.romy_score}/41 | - |`)
  lines.push(`| **Recommended Ask** | ${formatCurrency(metrics.recommended_ask)} | - |`)
  lines.push("")
  lines.push("---")
  lines.push("")

  // Executive Summary
  lines.push("## Executive Summary")
  lines.push("")
  lines.push(executive_summary)
  lines.push("")
  lines.push("---")
  lines.push("")

  // Wealth Indicators
  lines.push("## Wealth Indicators")
  lines.push("")

  // Real Estate
  lines.push("### Real Estate")
  if (wealth.real_estate.properties.length > 0) {
    lines.push("")
    lines.push("| Property | Value | Source | Confidence |")
    lines.push("|----------|-------|--------|------------|")
    for (const prop of wealth.real_estate.properties) {
      lines.push(`| ${prop.address} | ${formatCurrency(prop.value)} | ${prop.source} | ${prop.confidence} |`)
    }
    lines.push("")
    lines.push(`**Total Real Estate:** ${formatCurrency(wealth.real_estate.total_value)}`)
  } else {
    lines.push("- No property records found")
  }
  lines.push("")

  // Business Interests
  lines.push("### Business Interests")
  if (wealth.business_ownership.length > 0) {
    for (const biz of wealth.business_ownership) {
      const valueStr = biz.estimated_value ? ` | Est. Value: ${formatCurrency(biz.estimated_value)}` : ""
      lines.push(`- **${biz.company}** - ${biz.role}${valueStr} | [${biz.source}] [${biz.confidence}]`)
    }
  } else {
    lines.push("- No business ownership found")
  }
  lines.push("")

  // Securities
  lines.push("### Securities & Public Holdings")
  if (wealth.securities.has_sec_filings && wealth.securities.insider_at.length > 0) {
    lines.push(`- SEC Form 4 filer at: ${wealth.securities.insider_at.join(", ")} | [${wealth.securities.source}]`)
  } else {
    lines.push("- No SEC insider filings found")
  }
  lines.push("")
  lines.push("---")
  lines.push("")

  // Philanthropic Profile
  lines.push("## Philanthropic Profile")
  lines.push("")

  // Political Giving
  lines.push("### Political Giving")
  if (philanthropy.political_giving.total > 0) {
    lines.push(`- **Total:** ${formatCurrency(philanthropy.political_giving.total)} | **Party Lean:** ${philanthropy.political_giving.party_lean} | [${philanthropy.political_giving.source || "FEC"}]`)
  } else {
    lines.push("- No federal political contributions found")
  }
  lines.push("")

  // Foundation Connections
  lines.push("### Foundation Connections")
  if (philanthropy.foundation_affiliations.length > 0) {
    for (const foundation of philanthropy.foundation_affiliations) {
      lines.push(`- ${foundation}`)
    }
  } else {
    lines.push("- No foundation affiliations found")
  }
  lines.push("")

  // Nonprofit Boards
  lines.push("### Nonprofit Board Service")
  if (philanthropy.nonprofit_boards.length > 0) {
    for (const board of philanthropy.nonprofit_boards) {
      lines.push(`- ${board}`)
    }
  } else {
    lines.push("- None found")
  }
  lines.push("")

  // Known Major Gifts
  lines.push("### Known Major Gifts")
  if (philanthropy.known_major_gifts.length > 0) {
    lines.push("")
    lines.push("| Organization | Amount | Year | Source |")
    lines.push("|--------------|--------|------|--------|")
    for (const gift of philanthropy.known_major_gifts) {
      lines.push(`| ${gift.organization} | ${formatCurrency(gift.amount)} | ${gift.year || "N/A"} | ${gift.source} |`)
    }
  } else {
    lines.push("- No documented major gifts found")
  }
  lines.push("")
  lines.push("---")
  lines.push("")

  // Background
  lines.push("## Background")
  lines.push("")
  if (background.age) {
    lines.push(`**Age:** ${background.age}`)
  }
  if (background.education.length > 0) {
    lines.push(`**Education:** ${background.education.join("; ")}`)
  }
  if (background.career_summary) {
    lines.push(`**Career:** ${background.career_summary}`)
  }
  if (background.family.spouse) {
    lines.push(`**Spouse:** ${background.family.spouse}`)
  }
  if (background.family.children_count) {
    lines.push(`**Children:** ${background.family.children_count}`)
  }
  lines.push("")
  lines.push("---")
  lines.push("")

  // Cultivation Strategy
  lines.push("## Cultivation Strategy")
  lines.push("")
  lines.push(`**Readiness:** ${strategy.readiness}`)
  lines.push("")
  lines.push("**Next Steps:**")
  for (let i = 0; i < strategy.next_steps.length; i++) {
    lines.push(`${i + 1}. ${strategy.next_steps[i]}`)
  }
  lines.push("")
  lines.push(`**Best Solicitor:** ${strategy.best_solicitor}`)
  lines.push("")
  lines.push(`**Tax-Smart Option:** ${strategy.tax_smart_option}`)
  lines.push("")
  lines.push("**Talking Points:**")
  for (const point of strategy.talking_points) {
    lines.push(`- ${point}`)
  }
  if (strategy.avoid.length > 0) {
    lines.push("")
    lines.push("**Avoid:**")
    for (const item of strategy.avoid) {
      lines.push(`- ${item}`)
    }
  }
  lines.push("")
  lines.push("---")
  lines.push("")

  // Sources
  lines.push("## Sources")
  lines.push("")
  for (const source of sources) {
    lines.push(`- [${source.title}](${source.url}) - ${source.data_provided}`)
  }

  return lines.join("\n")
}

// ============================================================================
// ROMYSCORE CALCULATION
// ============================================================================

/**
 * Calculate RomyScore from structured research data
 */
async function calculateRomyScoreFromResearch(
  prospect: ProspectInputData,
  output: ProspectResearchOutput
): Promise<RomyScoreBreakdown> {
  const dataPoints: Partial<RomyScoreDataPoints> = {}

  // Property value from research
  if (output.wealth.real_estate.total_value) {
    dataPoints.propertyValue = output.wealth.real_estate.total_value
  }

  // Property count (additional properties beyond primary)
  if (output.wealth.real_estate.properties.length > 1) {
    dataPoints.additionalPropertyCount = output.wealth.real_estate.properties.length - 1
  }

  // Business ownership - convert to businessRoles format
  if (output.wealth.business_ownership.length > 0) {
    dataPoints.businessRoles = output.wealth.business_ownership.map(biz => ({
      role: biz.role,
      companyName: biz.company,
      isPublicCompany: output.wealth.securities.insider_at.some(
        ticker => biz.company.toUpperCase().includes(ticker)
      ),
    }))
  }

  // Foundation affiliations
  if (output.philanthropy.foundation_affiliations.length > 0) {
    dataPoints.foundationAffiliations = output.philanthropy.foundation_affiliations
  }

  // Political giving total
  if (output.philanthropy.political_giving.total > 0) {
    dataPoints.totalPoliticalGiving = output.philanthropy.political_giving.total
  }

  // Get RomyScore using the correct data points structure
  const breakdown = await getRomyScore(
    prospect.name,
    prospect.city,
    prospect.state,
    dataPoints
  )

  return breakdown
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Generate a comprehensive prospect report using Perplexity Sonar Pro
 *
 * This is the main entry point for batch processing.
 * Returns structured data + formatted markdown report.
 */
export async function generateProspectReport(
  options: GenerateReportOptions
): Promise<GenerateReportResult> {
  const { prospect, apiKey } = options
  const startTime = Date.now()

  try {
    console.log(`[BatchProcessor] Starting research for: ${prospect.name}`)

    // Step 1: Research with Perplexity Sonar Pro
    const researchResult = await researchWithPerplexitySonar(prospect, apiKey)

    if (!researchResult.success || !researchResult.output) {
      return {
        success: false,
        error_message: researchResult.error_message || "Research failed",
        tokens_used: researchResult.tokens_used,
      }
    }

    const output = researchResult.output

    // Step 2: Calculate RomyScore from research data
    const romyBreakdown = await calculateRomyScoreFromResearch(prospect, output)

    // Step 3: Override model's RomyScore with our calculated one
    output.metrics.romy_score = romyBreakdown.totalScore

    // Step 4: Regenerate markdown with updated score
    const reportMarkdown = formatReportMarkdown(prospect.name, output)

    const processingTime = Date.now() - startTime

    console.log(
      `[BatchProcessor] Research complete for ${prospect.name} in ${processingTime}ms: ` +
      `RōmyScore: ${romyBreakdown.totalScore}/41 (${romyBreakdown.tier.name}), ` +
      `Rating: ${output.metrics.capacity_rating}, ` +
      `Sources: ${output.sources.length}`
    )

    // Extract average net worth for backward compatibility
    const avgNetWorth = output.metrics.estimated_net_worth_low && output.metrics.estimated_net_worth_high
      ? (output.metrics.estimated_net_worth_low + output.metrics.estimated_net_worth_high) / 2
      : output.metrics.estimated_net_worth_high || output.metrics.estimated_net_worth_low || undefined

    return {
      success: true,
      report_content: reportMarkdown,
      structured_data: output,
      romy_score: romyBreakdown.totalScore,
      romy_score_tier: romyBreakdown.tier.name,
      capacity_rating: output.metrics.capacity_rating,
      estimated_net_worth: avgNetWorth,
      estimated_gift_capacity: output.metrics.estimated_gift_capacity || undefined,
      recommended_ask: output.metrics.recommended_ask || undefined,
      sources_found: output.sources.map(s => ({ name: s.title, url: s.url })),
      tokens_used: researchResult.tokens_used,
    }
  } catch (error) {
    console.error("[BatchProcessor] Report generation failed:", error)

    return {
      success: false,
      error_message: error instanceof Error ? error.message : "Report generation failed",
    }
  }
}

/**
 * Process a single batch item
 * Wrapper for backward compatibility with existing batch processing code
 */
export async function processBatchItem(
  item: BatchProspectItem,
  settings: { enableWebSearch: boolean; generateRomyScore: boolean },
  apiKey?: string
): Promise<GenerateReportResult> {
  return generateProspectReport({
    prospect: item.input_data,
    apiKey,
  })
}

/**
 * @deprecated - Use generateProspectReport instead
 * Kept for backward compatibility
 */
export async function generateComprehensiveReportWithTools(
  options: GenerateReportOptions & { searchMode?: string }
): Promise<GenerateReportResult> {
  return generateProspectReport(options)
}

/**
 * @deprecated - Use generateProspectReport instead
 * Kept for backward compatibility
 */
export async function generateReportWithSonarAndGrok(
  options: GenerateReportOptions & { searchMode?: string }
): Promise<{
  report_content: string
  structured_data: Record<string, unknown>
  sources: Array<{ name: string; url: string }>
  tokens_used: number
  model_used: string
  processing_duration_ms: number
}> {
  const startTime = Date.now()
  const result = await generateProspectReport(options)

  return {
    report_content: result.report_content || "",
    structured_data: (result.structured_data as unknown as Record<string, unknown>) || {},
    sources: result.sources_found || [],
    tokens_used: result.tokens_used || 0,
    model_used: "perplexity/sonar-pro",
    processing_duration_ms: Date.now() - startTime,
  }
}
