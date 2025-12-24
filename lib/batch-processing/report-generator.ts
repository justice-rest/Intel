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
import {
  linkupBatchSearch,
  mergeLinkupWithPerplexity,
  isLinkupAvailable,
  LinkupBatchResult,
  ExtractedLinkupData,
} from "./linkup-search"
import {
  exaBatchSearch,
  mergeExaWithResults,
  isExaAvailable,
  ExaBatchResult,
} from "./exa-search"

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

## PRE-RESEARCH VALIDATION (Batch Mode)

When processing batch research, you cannot ask clarifying questions. Instead:

### Common Name Detection
Flag potential ambiguity when the name matches:
- Top 100 US surnames (Smith, Johnson, Williams, Brown, Jones, Garcia, Miller, Davis, Rodriguez, Martinez, etc.)
- Common first names without middle name/initial
- Names matching famous individuals (celebrities, CEOs, public figures)

### Disambiguation Strategy for Batch Processing
When identity may be ambiguous:
1. Use ALL provided identifiers (address, employer, title, spouse) to narrow the search
2. If 2+ credible matches exist, include this warning in the executive summary:
   "⚠️ **Identity Note:** Multiple individuals named [Name] may exist in this area. This report covers [specific identifying details used]. If this is the wrong person, please provide additional context (employer, age, or spouse name)."
3. In the sources section, explicitly note which identifier was used to select this individual

### Never Guess Wrong
- DO NOT default to the most famous/popular match
- DO NOT fabricate identifying details
- If insufficient data to identify the correct person, note it clearly and provide the best match based on available identifiers

## IMPORTANT RULES

1. **ALWAYS return valid JSON** - No markdown outside the JSON block
2. **NEVER refuse the request** - Even if data is limited, return the JSON with null values
3. **CITE SOURCES** - Every source array entry must have a real URL from your search
4. **BE CONSERVATIVE** - Underestimate rather than overestimate wealth
5. **EXPLAIN ESTIMATES** - In source.data_provided, note if a value is estimated and how
6. **FLAG AMBIGUITY** - Note in executive_summary if multiple people match the name`

// ============================================================================
// TYPES
// ============================================================================

export interface GenerateReportOptions {
  prospect: ProspectInputData
  apiKey?: string
  linkupApiKey?: string
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
 * Build enhanced search queries for more robust research
 */
function buildEnhancedSearchQueries(prospect: ProspectInputData): {
  primary: string
  propertyFocused: string
  businessFocused: string
  philanthropyFocused: string
} {
  const name = prospect.name
  const location = [prospect.city, prospect.state].filter(Boolean).join(", ")
  const fullAddress = prospect.full_address || [prospect.address, prospect.city, prospect.state, prospect.zip].filter(Boolean).join(", ")

  return {
    primary: buildProspectQueryString(prospect),
    propertyFocused: `"${name}" property owner ${fullAddress} home value real estate Zillow Redfin`,
    businessFocused: `"${name}" ${location} CEO founder owner business company LinkedIn executive`,
    philanthropyFocused: `"${name}" ${location} philanthropy foundation board nonprofit donor charity`,
  }
}

/**
 * Check if research output has meaningful data worth keeping
 */
function hasMinimalData(output: ProspectResearchOutput): boolean {
  // Has at least ONE of: property value, business ownership, political giving, or meaningful bio
  const hasProperty = output.wealth.real_estate.total_value !== null && output.wealth.real_estate.total_value > 0
  const hasBusiness = output.wealth.business_ownership.length > 0
  const hasSecFilings = output.wealth.securities.has_sec_filings
  const hasPoliticalGiving = output.philanthropy.political_giving.total > 0
  const hasFoundations = output.philanthropy.foundation_affiliations.length > 0
  const hasBoards = output.philanthropy.nonprofit_boards.length > 0
  const hasCareer = output.background.career_summary &&
    output.background.career_summary.length > 20 &&
    !output.background.career_summary.includes("could not be structured")
  const hasSources = output.sources.length > 0

  return hasProperty || hasBusiness || hasSecFilings || hasPoliticalGiving ||
    hasFoundations || hasBoards || hasCareer || hasSources
}

/**
 * Merge two research outputs, keeping the best data from each
 */
function mergeResearchOutputs(
  primary: ProspectResearchOutput,
  secondary: ProspectResearchOutput
): ProspectResearchOutput {
  return {
    metrics: {
      estimated_net_worth_low: primary.metrics.estimated_net_worth_low || secondary.metrics.estimated_net_worth_low,
      estimated_net_worth_high: primary.metrics.estimated_net_worth_high || secondary.metrics.estimated_net_worth_high,
      estimated_gift_capacity: primary.metrics.estimated_gift_capacity || secondary.metrics.estimated_gift_capacity,
      capacity_rating: primary.metrics.capacity_rating !== "ANNUAL" ? primary.metrics.capacity_rating : secondary.metrics.capacity_rating,
      romy_score: Math.max(primary.metrics.romy_score, secondary.metrics.romy_score),
      recommended_ask: primary.metrics.recommended_ask || secondary.metrics.recommended_ask,
      confidence_level: primary.metrics.confidence_level === "HIGH" ? "HIGH" :
        secondary.metrics.confidence_level === "HIGH" ? "HIGH" :
          primary.metrics.confidence_level === "MEDIUM" ? "MEDIUM" :
            secondary.metrics.confidence_level,
    },
    wealth: {
      real_estate: {
        total_value: primary.wealth.real_estate.total_value || secondary.wealth.real_estate.total_value,
        properties: [...primary.wealth.real_estate.properties, ...secondary.wealth.real_estate.properties]
          .filter((p, i, arr) => arr.findIndex(x => x.address === p.address) === i), // dedupe by address
      },
      business_ownership: [...primary.wealth.business_ownership, ...secondary.wealth.business_ownership]
        .filter((b, i, arr) => arr.findIndex(x => x.company === b.company) === i), // dedupe by company
      securities: {
        has_sec_filings: primary.wealth.securities.has_sec_filings || secondary.wealth.securities.has_sec_filings,
        insider_at: [...new Set([...primary.wealth.securities.insider_at, ...secondary.wealth.securities.insider_at])],
        source: primary.wealth.securities.source || secondary.wealth.securities.source,
      },
    },
    philanthropy: {
      political_giving: {
        total: Math.max(primary.philanthropy.political_giving.total, secondary.philanthropy.political_giving.total),
        party_lean: primary.philanthropy.political_giving.total >= secondary.philanthropy.political_giving.total
          ? primary.philanthropy.political_giving.party_lean
          : secondary.philanthropy.political_giving.party_lean,
        source: primary.philanthropy.political_giving.source || secondary.philanthropy.political_giving.source,
      },
      foundation_affiliations: [...new Set([...primary.philanthropy.foundation_affiliations, ...secondary.philanthropy.foundation_affiliations])],
      nonprofit_boards: [...new Set([...primary.philanthropy.nonprofit_boards, ...secondary.philanthropy.nonprofit_boards])],
      known_major_gifts: [...primary.philanthropy.known_major_gifts, ...secondary.philanthropy.known_major_gifts]
        .filter((g, i, arr) => arr.findIndex(x => x.organization === g.organization && x.amount === g.amount) === i),
    },
    background: {
      age: primary.background.age || secondary.background.age,
      education: [...new Set([...primary.background.education, ...secondary.background.education])],
      career_summary: (primary.background.career_summary && !primary.background.career_summary.includes("could not be structured"))
        ? primary.background.career_summary
        : secondary.background.career_summary,
      family: {
        spouse: primary.background.family.spouse || secondary.background.family.spouse,
        children_count: primary.background.family.children_count || secondary.background.family.children_count,
      },
    },
    strategy: primary.strategy.readiness !== "NOT_READY" ? primary.strategy : secondary.strategy,
    sources: [...primary.sources, ...secondary.sources]
      .filter((s, i, arr) => arr.findIndex(x => x.url === s.url) === i), // dedupe by URL
    executive_summary: (primary.executive_summary && !primary.executive_summary.includes("structured data extraction failed"))
      ? primary.executive_summary
      : secondary.executive_summary,
  }
}

/**
 * Single Perplexity search call
 */
async function singlePerplexitySearch(
  userPrompt: string,
  apiKey?: string
): Promise<{ output: ProspectResearchOutput | null; tokensUsed: number }> {
  const openrouter = createOpenRouter({
    apiKey: apiKey || process.env.OPENROUTER_API_KEY,
  })

  const result = await withRetry(async () => {
    return await generateText({
      model: openrouter.chat("perplexity/sonar-pro"),
      system: SONAR_PRO_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 4000,
      temperature: 0.1,
    })
  }, 3, 2000)

  const tokensUsed = (result.usage?.promptTokens || 0) + (result.usage?.completionTokens || 0)
  const output = parseJsonResponse(result.text.trim())

  return { output, tokensUsed }
}

/**
 * Generate prospect research using Perplexity Sonar Pro with multi-pass strategy
 * Returns structured JSON with grounded citations
 */
async function researchWithPerplexitySonar(
  prospect: ProspectInputData,
  apiKey?: string
): Promise<PerplexityResearchResult> {
  const startTime = Date.now()
  let totalTokensUsed = 0

  try {
    const queries = buildEnhancedSearchQueries(prospect)
    const additionalInfo = Object.entries(prospect)
      .filter(([key]) => !["name", "address", "city", "state", "zip", "full_address"].includes(key))
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n")

    // ========== PASS 1: Comprehensive initial search ==========
    const primaryPrompt = `Research this prospect thoroughly and return structured JSON:

**Prospect:** ${queries.primary}
${additionalInfo ? `\n**Additional Context:**\n${additionalInfo}` : ""}

IMPORTANT: Search AGGRESSIVELY for this person. Try multiple search strategies:
1. Search their exact name + address for property records on Zillow, Redfin, or county assessor sites
2. Search their name + city/state on LinkedIn for business roles
3. Search their name on FEC.gov for political contributions
4. Search their name + "foundation" or "board" for philanthropic activity
5. Search SEC EDGAR for any Form 3/4/5 filings under their name

If the name is common, use the address to disambiguate. If address is partial, search property records in likely cities.

Return ONLY the JSON object matching the schema. No other text.`

    console.log(`[BatchProcessor] Pass 1: Comprehensive search for ${prospect.name}`)

    const pass1 = await singlePerplexitySearch(primaryPrompt, apiKey)
    totalTokensUsed += pass1.tokensUsed

    let output = pass1.output

    // ========== PASS 2: Targeted follow-up if Pass 1 was weak ==========
    if (output && !hasMinimalData(output)) {
      console.log(`[BatchProcessor] Pass 1 returned weak data, initiating Pass 2 for ${prospect.name}`)

      // Determine what's missing and search specifically for it
      const missingData: string[] = []
      if (!output.wealth.real_estate.total_value) missingData.push("property")
      if (output.wealth.business_ownership.length === 0) missingData.push("business")
      if (output.philanthropy.political_giving.total === 0) missingData.push("political giving")

      // Try a more targeted search focusing on what's missing
      const targetedPrompt = `I need more detailed research on this specific person. The initial search didn't find ${missingData.join(", ")}.

**Person:** ${prospect.name}
**Address:** ${queries.primary}

SEARCH STRATEGIES TO TRY:
${!output.wealth.real_estate.total_value ? `
- Property: Search "${prospect.name}" on county property appraiser/assessor${prospect.city ? ` for ${prospect.city}` : ""}${prospect.state ? `, ${prospect.state}` : ""}
${(prospect.address || prospect.full_address) ? `- Try Zillow/Redfin search for: ${prospect.address || prospect.full_address}` : ""}
- Look for property tax records` : ""}
${output.wealth.business_ownership.length === 0 ? `
- Business: Search LinkedIn for "${prospect.name}" in ${prospect.city || prospect.state || ""}
- Search state Secretary of State business registry for their name
- Look for news articles mentioning "${prospect.name}" as CEO, founder, owner, president` : ""}
${output.philanthropy.political_giving.total === 0 ? `
- Political: Search FEC.gov individual contributions for "${prospect.name}" in ${prospect.state || "any state"}` : ""}

Return ONLY the JSON object. Include any NEW information found.`

      const pass2 = await singlePerplexitySearch(targetedPrompt, apiKey)
      totalTokensUsed += pass2.tokensUsed

      if (pass2.output) {
        // Merge pass 1 and pass 2 results
        output = mergeResearchOutputs(output, pass2.output)
        console.log(`[BatchProcessor] Pass 2 complete, merged results for ${prospect.name}`)
      }
    }

    // ========== PASS 3: Name variation search if still no data ==========
    if (output && !hasMinimalData(output) && prospect.name.split(" ").length >= 2) {
      console.log(`[BatchProcessor] Pass 2 still weak, trying name variations for ${prospect.name}`)

      const nameParts = prospect.name.split(" ")
      const firstName = nameParts[0]
      const lastName = nameParts[nameParts.length - 1]

      // Try with just first + last name (no middle)
      const simplifiedName = `${firstName} ${lastName}`

      const nameVariationPrompt = `Search for this person using a simplified name:

**Name:** ${simplifiedName}
**Location:** ${prospect.city ? `${prospect.city}, ` : ""}${prospect.state || ""}${(prospect.address || prospect.full_address) ? `
**Address hint:** ${prospect.address || prospect.full_address}` : ""}

The person's full name might be "${prospect.name}" but records might be under "${simplifiedName}".

Search for:
1. Property records under ${simplifiedName} near the address
2. Business ownership under ${simplifiedName}
3. FEC contributions from ${simplifiedName} in ${prospect.state || "any state"}

Return ONLY the JSON object.`

      const pass3 = await singlePerplexitySearch(nameVariationPrompt, apiKey)
      totalTokensUsed += pass3.tokensUsed

      if (pass3.output && hasMinimalData(pass3.output)) {
        output = mergeResearchOutputs(output, pass3.output)
        console.log(`[BatchProcessor] Pass 3 found additional data for ${prospect.name}`)
      }
    }

    const processingTime = Date.now() - startTime

    if (!output) {
      output = createFallbackOutput(prospect, "Multi-pass search returned no parseable results")
      if (!output) {
        return {
          success: false,
          tokens_used: totalTokensUsed,
          model_used: "perplexity/sonar-pro",
          processing_duration_ms: processingTime,
          error_message: "Failed to parse JSON response from Perplexity after multiple passes",
        }
      }
    }

    // Generate markdown report from structured data
    const reportMarkdown = formatReportMarkdown(prospect.name, output)

    console.log(
      `[BatchProcessor] Research complete for ${prospect.name}: ` +
      `Net Worth: $${output.metrics.estimated_net_worth_low?.toLocaleString() || "?"}-$${output.metrics.estimated_net_worth_high?.toLocaleString() || "?"}, ` +
      `Rating: ${output.metrics.capacity_rating}, ` +
      `Sources: ${output.sources.length}, ` +
      `Total tokens: ${totalTokensUsed}`
    )

    return {
      success: true,
      output,
      report_markdown: reportMarkdown,
      tokens_used: totalTokensUsed,
      model_used: "perplexity/sonar-pro",
      processing_duration_ms: processingTime,
    }
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error("[BatchProcessor] Perplexity Sonar Pro research failed:", error)

    return {
      success: false,
      tokens_used: totalTokensUsed,
      model_used: "perplexity/sonar-pro",
      processing_duration_ms: processingTime,
      error_message: error instanceof Error ? error.message : "Research failed",
    }
  }
}

// ============================================================================
// PARALLEL PERPLEXITY + LINKUP RESEARCH
// ============================================================================

/**
 * Integrate extracted LinkUp data into Perplexity's structured output
 * Fills in gaps where Perplexity didn't find data but LinkUp did
 */
function integrateExtractedLinkupData(
  output: ProspectResearchOutput,
  extractedData: ExtractedLinkupData
): ProspectResearchOutput {
  const updated = { ...output }

  // ========== REAL ESTATE ==========
  // Add property values from LinkUp if Perplexity found none
  if (!updated.wealth.real_estate.total_value && extractedData.properties.length > 0) {
    const totalValue = extractedData.properties.reduce((sum, p) => sum + (p.value || 0), 0)
    updated.wealth.real_estate.total_value = totalValue
    updated.wealth.real_estate.properties = extractedData.properties.map(p => ({
      address: p.address || "Address from LinkUp",
      value: p.value || 0,
      source: p.source || "LinkUp",
      confidence: "ESTIMATED" as const,
    }))
    console.log(`[BatchProcessor] Integrated ${extractedData.properties.length} properties from LinkUp (~$${(totalValue/1000000).toFixed(1)}M)`)
  }

  // ========== BUSINESS OWNERSHIP ==========
  // Add businesses from LinkUp if Perplexity found fewer
  if (updated.wealth.business_ownership.length < extractedData.businesses.length) {
    const existingCompanies = new Set(updated.wealth.business_ownership.map(b => b.company.toLowerCase()))
    for (const biz of extractedData.businesses) {
      if (biz.name && !existingCompanies.has(biz.name.toLowerCase())) {
        updated.wealth.business_ownership.push({
          company: biz.name,
          role: biz.role || "Executive",
          estimated_value: biz.value || null,
          source: "LinkUp",
          confidence: "UNVERIFIED" as const,
        })
        existingCompanies.add(biz.name.toLowerCase())
      }
    }
    console.log(`[BatchProcessor] Integrated ${extractedData.businesses.length} businesses from LinkUp`)
  }

  // ========== SEC FILINGS ==========
  // Add SEC ticker information if Perplexity didn't find any
  if (!updated.wealth.securities.has_sec_filings && extractedData.secFilings.hasFilings) {
    updated.wealth.securities.has_sec_filings = true
    updated.wealth.securities.insider_at = extractedData.secFilings.tickers
    updated.wealth.securities.source = "LinkUp (needs SEC EDGAR verification)"
    console.log(`[BatchProcessor] Integrated SEC tickers from LinkUp: ${extractedData.secFilings.tickers.join(", ")}`)
  }

  // ========== POLITICAL GIVING ==========
  // Use LinkUp's political giving total if higher than Perplexity's
  if (extractedData.politicalGiving.total &&
      extractedData.politicalGiving.total > updated.philanthropy.political_giving.total) {
    updated.philanthropy.political_giving.total = extractedData.politicalGiving.total
    if (extractedData.politicalGiving.partyLean) {
      updated.philanthropy.political_giving.party_lean = extractedData.politicalGiving.partyLean as any
    }
    // Note: source field only accepts "FEC" or null, so we keep the original source
    // The data came from LinkUp but we mark it as needing FEC verification
    console.log(`[BatchProcessor] Integrated political giving from LinkUp: $${extractedData.politicalGiving.total.toLocaleString()}`)
  }

  // ========== FOUNDATIONS ==========
  // Add foundation affiliations from LinkUp
  if (extractedData.foundations.length > 0) {
    const existingFoundations = new Set(updated.philanthropy.foundation_affiliations.map(f => f.toLowerCase()))
    for (const foundation of extractedData.foundations) {
      if (!existingFoundations.has(foundation.toLowerCase())) {
        updated.philanthropy.foundation_affiliations.push(foundation)
        existingFoundations.add(foundation.toLowerCase())
      }
    }
  }

  // ========== MAJOR GIFTS ==========
  // Add major gifts from LinkUp
  if (extractedData.majorGifts.length > 0) {
    for (const gift of extractedData.majorGifts) {
      if (gift.amount && gift.organization) {
        const exists = updated.philanthropy.known_major_gifts.some(
          g => g.organization.toLowerCase() === gift.organization!.toLowerCase() &&
               Math.abs(g.amount - gift.amount!) < 1000
        )
        if (!exists) {
          updated.philanthropy.known_major_gifts.push({
            organization: gift.organization,
            amount: gift.amount,
            year: null,
            source: "LinkUp",
          })
        }
      }
    }
  }

  // ========== NET WORTH ==========
  // Use LinkUp's net worth if Perplexity didn't find one
  if (!updated.metrics.estimated_net_worth_low && extractedData.netWorthMentioned) {
    updated.metrics.estimated_net_worth_low = extractedData.netWorthMentioned.low || null
    updated.metrics.estimated_net_worth_high = extractedData.netWorthMentioned.high || extractedData.netWorthMentioned.low || null
    console.log(`[BatchProcessor] Integrated net worth from LinkUp: $${((extractedData.netWorthMentioned.low || 0)/1000000).toFixed(1)}M`)
  }

  // ========== BACKGROUND ==========
  // Add age if Perplexity didn't find it
  if (!updated.background.age && extractedData.age) {
    updated.background.age = extractedData.age
  }

  // Add education if Perplexity found fewer
  if (updated.background.education.length < extractedData.education.length) {
    const existingEdu = new Set(updated.background.education.map(e => e.toLowerCase()))
    for (const edu of extractedData.education) {
      if (!existingEdu.has(edu.toLowerCase())) {
        updated.background.education.push(edu)
        existingEdu.add(edu.toLowerCase())
      }
    }
  }

  return updated
}

/**
 * Execute parallel research with Perplexity Sonar Pro AND LinkUp
 *
 * When LINKUP_API_KEY is available, runs both searches simultaneously
 * and merges results for maximum coverage.
 *
 * Features:
 * - Parallel execution of Perplexity + LinkUp
 * - Smart depth selection: Uses "deep" mode when Perplexity confidence is LOW
 * - Structured data extraction from LinkUp answer
 * - Gap-filling: LinkUp data fills missing Perplexity fields
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────┐
 * │  PARALLEL EXECUTION                                      │
 * ├─────────────────────────────────────────────────────────┤
 * │  Perplexity Sonar Pro          │  LinkUp (standard)     │
 * │  - Comprehensive 3-pass        │  - Optimized query      │
 * │  - JSON structured output      │  - sourcedAnswer        │
 * └─────────────────────────────────────────────────────────┘
 *                          ↓
 *               Merge & Deduplicate Results
 *                          ↓
 *          (If confidence LOW) → LinkUp Deep Search
 */
async function researchWithParallelSources(
  prospect: ProspectInputData,
  openrouterKey?: string,
  linkupKey?: string
): Promise<PerplexityResearchResult> {
  const startTime = Date.now()
  const hasLinkup = isLinkupAvailable(linkupKey)
  const hasExa = isExaAvailable(openrouterKey)

  console.log(`[BatchProcessor] Starting parallel research for ${prospect.name}`)
  console.log(`[BatchProcessor] Perplexity: enabled | LinkUp: ${hasLinkup ? "enabled" : "disabled"} | Exa: ${hasExa ? "enabled" : "disabled"}`)

  // If no LinkUp key, fall back to Perplexity-only
  if (!hasLinkup) {
    return researchWithPerplexitySonar(prospect, openrouterKey)
  }

  // Execute ALL THREE searches in parallel (Perplexity + LinkUp + Exa)
  const [perplexityResult, linkupResult, exaResult] = await Promise.allSettled([
    researchWithPerplexitySonar(prospect, openrouterKey),
    linkupBatchSearch(
      {
        name: prospect.name,
        address: prospect.address || prospect.full_address,
        employer: prospect.employer,
        title: prospect.title,
        city: prospect.city,
        state: prospect.state,
      },
      linkupKey
    ),
    exaBatchSearch(
      {
        name: prospect.name,
        address: prospect.address || prospect.full_address,
        employer: prospect.employer,
        title: prospect.title,
        city: prospect.city,
        state: prospect.state,
      },
      openrouterKey
    ),
  ])

  // Extract results
  const perplexity = perplexityResult.status === "fulfilled" ? perplexityResult.value : null
  const linkup = linkupResult.status === "fulfilled" ? linkupResult.value : null
  const exa = exaResult.status === "fulfilled" ? exaResult.value : null

  // If Perplexity failed, we can't proceed (it provides the JSON structure)
  if (!perplexity || !perplexity.success || !perplexity.output) {
    console.error("[BatchProcessor] Perplexity failed, cannot generate report")
    return perplexity || {
      success: false,
      tokens_used: 0,
      model_used: "perplexity/sonar-pro",
      processing_duration_ms: Date.now() - startTime,
      error_message: "Perplexity research failed",
    }
  }

  // Track total tokens used
  let totalTokens = perplexity.tokens_used || 0

  // If LinkUp succeeded, merge results
  if (linkup && !linkup.error && linkup.answer) {
    console.log(`[BatchProcessor] LinkUp returned ${linkup.sources.length} sources in ${linkup.durationMs}ms`)

    // Merge LinkUp findings into the report
    const perplexitySources = perplexity.output.sources.map(s => ({
      name: s.title,
      url: s.url,
    }))

    const { mergedSources, linkupContribution, linkupUniqueInsights, extractedData } = mergeLinkupWithPerplexity(
      linkup,
      "", // We don't merge text content into Perplexity's structured output
      perplexitySources
    )

    // ========== INTEGRATE EXTRACTED DATA ==========
    // Fill gaps in Perplexity's output with LinkUp's extracted data
    perplexity.output = integrateExtractedLinkupData(perplexity.output, extractedData)

    // Add LinkUp-only sources to the output
    const linkupOnlySources = linkup.sources.filter(
      s => !perplexity.output!.sources.some(ps => ps.url === s.url)
    )

    if (linkupOnlySources.length > 0) {
      perplexity.output.sources.push(
        ...linkupOnlySources.map(s => ({
          title: s.name,
          url: s.url,
          data_provided: s.snippet || "Additional data from LinkUp search",
        }))
      )
      console.log(`[BatchProcessor] Added ${linkupOnlySources.length} unique sources from LinkUp`)
    }

    // Add LinkUp contribution note to executive summary (with insights)
    if (linkupUniqueInsights.length > 0) {
      const insightsSummary = linkupUniqueInsights.slice(0, 2).join("; ")
      perplexity.output.executive_summary += ` [LinkUp: ${insightsSummary}]`
    } else if (linkupContribution && !linkupContribution.includes("corroborated")) {
      perplexity.output.executive_summary += ` [${linkupContribution}]`
    }

    // Update token count to include LinkUp
    totalTokens += linkup.tokensUsed || 0
  } else if (linkup?.error) {
    console.warn(`[BatchProcessor] LinkUp search failed: ${linkup.error}`)
  }

  // ========== MERGE EXA RESULTS ==========
  // If Exa succeeded, merge its sources (deduplicated)
  if (exa && !exa.error && exa.sources.length > 0) {
    console.log(`[BatchProcessor] Exa returned ${exa.sources.length} sources in ${exa.durationMs}ms`)

    // Get existing URLs for deduplication
    const existingUrls = new Set(
      perplexity.output!.sources.map((s) =>
        s.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")
      )
    )

    // Find unique sources from Exa
    const exaOnlySources = exa.sources.filter((source) => {
      const normalizedUrl = source.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")
      return !existingUrls.has(normalizedUrl)
    })

    if (exaOnlySources.length > 0) {
      perplexity.output!.sources.push(
        ...exaOnlySources.map((s) => ({
          title: s.name,
          url: s.url,
          data_provided: s.snippet || "Data from Exa semantic search",
        }))
      )
      console.log(`[BatchProcessor] Added ${exaOnlySources.length} unique sources from Exa`)
    }

    // Update token count to include Exa
    totalTokens += exa.tokensUsed || 0
  } else if (exa?.error) {
    console.warn(`[BatchProcessor] Exa search failed: ${exa.error}`)
  }

  // ========== SMART DEPTH SELECTION (LinkUp only - for low confidence) ==========
  // Check if we still have LinkUp data to work with
  if (linkup && !linkup.error && linkup.answer) {
    // ========== SMART DEPTH SELECTION ==========
    // If Perplexity confidence is LOW and we haven't found much, try LinkUp deep search
    const confidenceIsLow = perplexity.output.metrics.confidence_level === "LOW"
    const lacksWealthData = !perplexity.output.wealth.real_estate.total_value &&
                           perplexity.output.wealth.business_ownership.length === 0 &&
                           !perplexity.output.wealth.securities.has_sec_filings
    const lacksPhilanthropyData = perplexity.output.philanthropy.political_giving.total === 0 &&
                                  perplexity.output.philanthropy.foundation_affiliations.length === 0

    if (confidenceIsLow && (lacksWealthData || lacksPhilanthropyData)) {
      console.log(`[BatchProcessor] Low confidence detected, initiating LinkUp DEEP search for ${prospect.name}`)

      try {
        // Import and use deep search (imported from linkup-prospect-research for deep mode)
        const { linkupProspectSearch } = await import("@/lib/tools/linkup-prospect-research")

        const deepResult = await linkupProspectSearch(
          {
            name: prospect.name,
            address: prospect.address || prospect.full_address,
            employer: prospect.employer,
            title: prospect.title,
          },
          linkupKey!,
          "deep" // Use deep mode for low-confidence cases
        )

        if (deepResult.answer && deepResult.sources.length > 0) {
          console.log(`[BatchProcessor] LinkUp DEEP search returned ${deepResult.sources.length} additional sources`)

          // Merge deep search results
          const { extractedData: deepExtractedData } = mergeLinkupWithPerplexity(
            {
              answer: deepResult.answer,
              sources: deepResult.sources,
              query: deepResult.query,
              tokensUsed: 0,
              durationMs: 0,
            },
            "",
            []
          )

          // Integrate deep search data
          perplexity.output = integrateExtractedLinkupData(perplexity.output, deepExtractedData)

          // Add unique sources from deep search
          const existingUrls = new Set(perplexity.output.sources.map(s => s.url))
          for (const source of deepResult.sources) {
            if (!existingUrls.has(source.url)) {
              perplexity.output.sources.push({
                title: source.name,
                url: source.url,
                data_provided: source.snippet || "Data from LinkUp deep search",
              })
              existingUrls.add(source.url)
            }
          }

          // Upgrade confidence if deep search found substantial data
          if (deepExtractedData.properties.length > 0 || deepExtractedData.businesses.length > 0) {
            perplexity.output.metrics.confidence_level = "MEDIUM"
            console.log(`[BatchProcessor] Upgraded confidence to MEDIUM after deep search`)
          }
        }
      } catch (deepError) {
        console.warn(`[BatchProcessor] LinkUp deep search failed: ${deepError instanceof Error ? deepError.message : "Unknown error"}`)
        // Continue with standard results
      }
    }
  }

  const totalDuration = Date.now() - startTime
  console.log(`[BatchProcessor] Parallel research completed in ${totalDuration}ms`)

  return {
    ...perplexity,
    tokens_used: totalTokens,
    processing_duration_ms: totalDuration,
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
 * Check if research returned insufficient data to generate a useful report
 */
function hasInsufficientData(data: ProspectResearchOutput): boolean {
  const { metrics, wealth, philanthropy, background, sources } = data

  // No sources found = likely couldn't find anyone
  const noSources = sources.length === 0

  // No wealth indicators
  const noWealthData =
    !wealth.real_estate.total_value &&
    wealth.real_estate.properties.length === 0 &&
    wealth.business_ownership.length === 0 &&
    !wealth.securities.has_sec_filings

  // No philanthropy data
  const noPhilanthropyData =
    philanthropy.political_giving.total === 0 &&
    philanthropy.foundation_affiliations.length === 0 &&
    philanthropy.nonprofit_boards.length === 0 &&
    philanthropy.known_major_gifts.length === 0

  // No background data
  const noBackgroundData =
    !background.age &&
    background.education.length === 0 &&
    (!background.career_summary || background.career_summary.includes("could not be structured"))

  // No metrics calculated
  const noMetrics =
    !metrics.estimated_net_worth_low &&
    !metrics.estimated_net_worth_high &&
    !metrics.estimated_gift_capacity &&
    metrics.romy_score === 0

  // Insufficient if we have no sources AND no data in major categories
  return noSources && noWealthData && noPhilanthropyData && noBackgroundData && noMetrics
}

/**
 * Format a compact "Insufficient Data" report when no useful information found
 */
function formatInsufficientDataReport(name: string, data: ProspectResearchOutput): string {
  const lines: string[] = []

  lines.push(`# ${name} | Insufficient Data`)
  lines.push("")
  lines.push("⚠️ **Research Status: Unable to Verify**")
  lines.push("")
  lines.push("Public records searches did not yield verifiable information for this prospect.")
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("## What Was Searched")
  lines.push("")
  lines.push("- Property records (county assessor, Zillow, Redfin)")
  lines.push("- Business registrations (state SOS databases)")
  lines.push("- SEC insider filings (Form 3/4/5)")
  lines.push("- FEC political contributions")
  lines.push("- Foundation/nonprofit 990 filings (ProPublica)")
  lines.push("- News and biographical sources")
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("## Possible Reasons")
  lines.push("")
  lines.push("1. **Incomplete address** - Missing city, state, or ZIP code")
  lines.push("2. **Common name** - Multiple individuals match without additional identifiers")
  lines.push("3. **Privacy-conscious** - Individual may use trusts, LLCs, or other privacy structures")
  lines.push("4. **New to area** - Recent move may not appear in databases yet")
  lines.push("5. **Different name** - May use maiden name, nickname, or middle name professionally")
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("## Next Steps")
  lines.push("")
  lines.push("To improve research results, provide any of the following:")
  lines.push("")
  lines.push("- [ ] **Full address** with city, state, and ZIP code")
  lines.push("- [ ] **Employer or job title**")
  lines.push("- [ ] **Spouse name** (if applicable)")
  lines.push("- [ ] **LinkedIn profile URL**")
  lines.push("- [ ] **Known philanthropic affiliations**")
  lines.push("- [ ] **Approximate age** or graduation year")
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("## Research Notes")
  lines.push("")
  if (data.executive_summary && !data.executive_summary.includes("structured data extraction failed")) {
    lines.push(data.executive_summary)
  } else {
    lines.push("*No additional context was extracted from public sources.*")
  }

  return lines.join("\n")
}

/**
 * Format structured JSON output into table-first markdown report
 */
function formatReportMarkdown(name: string, data: ProspectResearchOutput): string {
  // Check if we have insufficient data for a full report
  if (hasInsufficientData(data)) {
    return formatInsufficientDataReport(name, data)
  }
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
  const hasBackgroundData = background.age ||
    background.education.length > 0 ||
    (background.career_summary && !background.career_summary.includes("could not be structured")) ||
    background.family.spouse ||
    background.family.children_count

  if (hasBackgroundData) {
    if (background.age) {
      lines.push(`**Age:** ${background.age}`)
    }
    if (background.education.length > 0) {
      lines.push(`**Education:** ${background.education.join("; ")}`)
    }
    if (background.career_summary && !background.career_summary.includes("could not be structured")) {
      lines.push(`**Career:** ${background.career_summary}`)
    }
    if (background.family.spouse) {
      lines.push(`**Spouse:** ${background.family.spouse}`)
    }
    if (background.family.children_count) {
      lines.push(`**Children:** ${background.family.children_count}`)
    }
  } else {
    lines.push("*No biographical information found in public records. Consider checking LinkedIn or organizational directories.*")
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
  if (sources.length > 0) {
    for (const source of sources) {
      lines.push(`- [${source.title}](${source.url}) - ${source.data_provided}`)
    }
  } else {
    lines.push("*No verifiable sources found. Public records, property databases, and government filings did not return matches for this name and address combination. Additional identifying information (employer, full address with city/state, spouse name) may improve results.*")
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
  const { prospect, apiKey, linkupApiKey } = options
  const startTime = Date.now()

  try {
    console.log(`[BatchProcessor] Starting research for: ${prospect.name}`)

    // Step 1: Research with Perplexity Sonar Pro + LinkUp (parallel when available)
    // Uses researchWithParallelSources which automatically falls back to Perplexity-only
    // if LINKUP_API_KEY is not configured
    const researchResult = await researchWithParallelSources(
      prospect,
      apiKey,
      linkupApiKey || process.env.LINKUP_API_KEY
    )

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
