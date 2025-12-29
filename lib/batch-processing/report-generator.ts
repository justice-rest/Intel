/**
 * Batch Prospect Report Generator v4.0
 *
 * LINKUP SEARCH - Complete rewrite using LinkUp for all web research.
 * Uses LinkUp Standard mode with multi-query architecture for best price/performance.
 *
 * Key improvements:
 * - Single search provider (LinkUp) - no more complex merging
 * - Cost: ~$0.025 per prospect (5 queries × $0.005)
 * - Multi-query architecture for comprehensive coverage
 * - Grok search for X/Twitter data (optional)
 * - RōmyScore calculation unchanged
 */

import {
  ProspectInputData,
  BatchProspectItem,
  ProspectResearchOutput,
  PerplexityResearchResult,
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
  type ProspectStructuredData,
} from "@/lib/tools/linkup-prospect-research"
import {
  grokBatchSearch,
  isGrokSearchAvailable,
  GrokSearchResult,
} from "./grok-search"

// Re-export for backward compatibility
export interface ExtractedLinkupData {
  properties: Array<{ address?: string; value?: number; source?: string }>
  businesses: Array<{ name?: string; role?: string; value?: number }>
  secFilings: { hasFilings: boolean; tickers: string[] }
  politicalGiving: { total?: number; partyLean?: string }
  foundations: string[]
  majorGifts: Array<{ organization?: string; amount?: number }>
  age?: number
  education: string[]
  netWorthMentioned?: { low?: number; high?: number }
}

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
// HELPER FUNCTIONS
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
 * Check if research output has meaningful data worth keeping
 */
function hasMinimalData(output: ProspectResearchOutput): boolean {
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
export function mergeResearchOutputs(
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
          .filter((p, i, arr) => arr.findIndex(x => x.address === p.address) === i),
      },
      business_ownership: [...primary.wealth.business_ownership, ...secondary.wealth.business_ownership]
        .filter((b, i, arr) => arr.findIndex(x => x.company === b.company) === i),
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
      .filter((s, i, arr) => arr.findIndex(x => x.url === s.url) === i),
    executive_summary: (primary.executive_summary && !primary.executive_summary.includes("structured data extraction failed"))
      ? primary.executive_summary
      : secondary.executive_summary,
  }
}

// ============================================================================
// LINKUP RESEARCH (PRIMARY)
// ============================================================================

/**
 * Execute research using LinkUp as the primary (and only) search provider
 *
 * v4.0 - Complete rewrite using LinkUp with multi-query architecture.
 * Cost: ~$0.025 per prospect (5 queries × $0.005)
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────┐
 * │  LINKUP (PRIMARY)                                       │
 * │  - Multi-query parallel search                          │
 * │  - ~$0.025 per search (5 queries)                       │
 * │  - Structured data extraction                           │
 * └─────────────────────────────────────────────────────────┘
 *                          ↓
 *         ┌────────────────┴────────────────┐
 *         │  GROK (OPTIONAL - X/Twitter)    │
 *         │  - Native X/Twitter search      │
 *         │  - Adds social media sources    │
 *         └─────────────────────────────────┘
 *                          ↓
 *               Build Structured Output
 *                          ↓
 *              Calculate RōmyScore
 */
async function researchWithLinkUpSources(
  prospect: ProspectInputData,
  openrouterKey?: string
): Promise<PerplexityResearchResult> {
  const startTime = Date.now()
  const hasGrok = isGrokSearchAvailable(openrouterKey)

  console.log(`[BatchProcessor] Starting LinkUp research for ${prospect.name}`)
  console.log(`[BatchProcessor] LinkUp: enabled | Grok: ${hasGrok ? "enabled" : "disabled"}`)

  // Execute LinkUp multi-query search (primary) - Standard mode
  const searchPromises: Promise<any>[] = [
    linkupBatchSearch({
      name: prospect.name,
      address: prospect.address || prospect.full_address,
      employer: prospect.employer,
      title: prospect.title,
    }),
  ]

  // Add Grok search if available (for X/Twitter data)
  if (hasGrok) {
    searchPromises.push(
      grokBatchSearch(
        {
          name: prospect.name,
          address: prospect.address || prospect.full_address,
          employer: prospect.employer,
          title: prospect.title,
          city: prospect.city,
          state: prospect.state,
        },
        openrouterKey
      )
    )
  }

  const results = await Promise.allSettled(searchPromises)

  // Extract results
  const linkupResult = results[0].status === "fulfilled" ? results[0].value : null
  const grokResult = hasGrok && results[1]?.status === "fulfilled" ? results[1].value as GrokSearchResult : null

  // If LinkUp failed, return error
  if (!linkupResult || linkupResult.error) {
    console.error("[BatchProcessor] LinkUp search failed:", linkupResult?.error || "No results")
    return {
      success: false,
      tokens_used: 0,
      model_used: "linkup/search",
      processing_duration_ms: Date.now() - startTime,
      error_message: linkupResult?.error || "LinkUp search failed",
    }
  }

  console.log(`[BatchProcessor] LinkUp returned ${linkupResult.sources.length} sources in ${linkupResult.durationMs}ms (${linkupResult.queryCount} queries)`)

  // Build structured output from LinkUp results
  const output = buildStructuredOutputFromLinkUp(prospect, linkupResult)

  // Merge Grok results if available (for X/Twitter sources)
  if (grokResult && !grokResult.error && grokResult.sources.length > 0) {
    console.log(`[BatchProcessor] Grok returned ${grokResult.sources.length} sources in ${grokResult.durationMs}ms`)

    // Get existing URLs for deduplication
    const existingUrls = new Set(
      output.sources.map((s) =>
        s.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")
      )
    )

    // Find unique sources from Grok (prioritize X/Twitter sources)
    const grokOnlySources = grokResult.sources.filter((source) => {
      const normalizedUrl = source.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")
      return !existingUrls.has(normalizedUrl)
    })

    if (grokOnlySources.length > 0) {
      output.sources.push(
        ...grokOnlySources.map((s) => ({
          title: s.name,
          url: s.url,
          data_provided: s.snippet || "Data from Grok native search (X/Twitter)",
        }))
      )
      console.log(`[BatchProcessor] Added ${grokOnlySources.length} unique sources from Grok`)
    }
  } else if (grokResult?.error) {
    console.warn(`[BatchProcessor] Grok search failed: ${grokResult.error}`)
  }

  const totalDuration = Date.now() - startTime
  console.log(`[BatchProcessor] LinkUp research completed in ${totalDuration}ms`)

  // Generate markdown report
  const reportMarkdown = formatReportMarkdown(prospect.name, output)

  return {
    success: true,
    output,
    report_markdown: reportMarkdown,
    tokens_used: 0, // LinkUp doesn't report tokens
    model_used: "linkup/search",
    processing_duration_ms: totalDuration,
  }
}

/**
 * Build structured ProspectResearchOutput from LinkUp results
 */
function buildStructuredOutputFromLinkUp(
  prospect: ProspectInputData,
  linkupResult: {
    research: string
    structuredData: ProspectStructuredData | null
    sources: Array<{ name: string; url: string; snippet?: string }>
    durationMs: number
    queryCount: number
    error?: string
  }
): ProspectResearchOutput {
  const structuredData = linkupResult.structuredData

  // Calculate estimated net worth from extracted data
  const totalPropertyValue = structuredData?.totalRealEstateValue || 0
  const totalBusinessValue = (structuredData?.businesses?.length || 0) * 500000 // Estimate $500K per business
  const estimatedNetWorthLow = structuredData?.netWorthEstimate?.low || (totalPropertyValue + totalBusinessValue) * 0.8
  const estimatedNetWorthHigh = structuredData?.netWorthEstimate?.high || (totalPropertyValue + totalBusinessValue) * 1.5

  // Determine capacity rating based on net worth (TFG Research Standard)
  let capacityRating: CapacityRating = "ANNUAL"
  const avgNetWorth = (estimatedNetWorthLow + estimatedNetWorthHigh) / 2
  if (avgNetWorth >= 5000000) capacityRating = "MAJOR"
  else if (avgNetWorth >= 1000000) capacityRating = "PRINCIPAL"
  else if (avgNetWorth >= 500000) capacityRating = "LEADERSHIP"

  // Map LinkUp rating to capacity rating if available
  if (structuredData?.givingCapacityRating) {
    const ratingMap: Record<string, CapacityRating> = {
      "A": "MAJOR",
      "B": "PRINCIPAL",
      "C": "LEADERSHIP",
      "D": "ANNUAL"
    }
    capacityRating = ratingMap[structuredData.givingCapacityRating] || capacityRating
  }

  // Determine confidence level
  let confidenceLevel: ResearchConfidence = "LOW"
  const hasPropertyData = (structuredData?.realEstate?.length || 0) > 0
  const hasBusinessData = (structuredData?.businesses?.length || 0) > 0
  const hasPhilanthropyData = (structuredData?.philanthropy?.foundations?.length || 0) > 0 ||
    (structuredData?.politicalGiving?.totalAmount || 0) > 0
  const hasSECData = structuredData?.securities?.hasSecFilings

  if ((hasPropertyData && hasBusinessData) || hasSECData) {
    confidenceLevel = "HIGH"
  } else if (hasPropertyData || hasBusinessData || hasPhilanthropyData) {
    confidenceLevel = "MEDIUM"
  }

  // Build executive summary
  const summaryParts: string[] = []
  if (hasPropertyData) {
    summaryParts.push(`Real estate holdings valued at ~$${((structuredData?.totalRealEstateValue || 0) / 1000000).toFixed(1)}M`)
  }
  if (hasBusinessData) {
    const businessNames = (structuredData?.businesses || []).map(b => b.name).filter(Boolean).slice(0, 2)
    if (businessNames.length > 0) {
      summaryParts.push(`Business interests: ${businessNames.join(", ")}`)
    }
  }
  if (hasSECData) {
    const tickers = structuredData?.securities?.companies?.map(c => c.ticker) || []
    summaryParts.push(`SEC filings indicate public company involvement (${tickers.join(", ")})`)
  }
  if (hasPhilanthropyData) {
    if (structuredData?.politicalGiving?.totalAmount) {
      summaryParts.push(`Political contributions totaling $${structuredData.politicalGiving.totalAmount.toLocaleString()}`)
    }
    const foundations = structuredData?.philanthropy?.foundations?.map(f => f.name).slice(0, 2) || []
    if (foundations.length > 0) {
      summaryParts.push(`Foundation affiliations: ${foundations.join(", ")}`)
    }
  }

  const executiveSummary = summaryParts.length > 0
    ? summaryParts.join(". ") + "."
    : structuredData?.summary || `Research completed for ${prospect.name}. Limited public data available.`

  // Build career summary from prospect data
  const careerSummary = prospect.employer && prospect.title
    ? `${prospect.title} at ${prospect.employer}`
    : prospect.employer
      ? `Works at ${prospect.employer}`
      : structuredData?.businesses?.length
        ? structuredData.businesses.map(b => `${b.role} at ${b.name}`).join("; ")
        : "Career details not available"

  // Map party lean to valid PoliticalParty type
  const partyLean = structuredData?.politicalGiving?.partyLean
  const validPartyLean: "REPUBLICAN" | "DEMOCRATIC" | "BIPARTISAN" | "NONE" =
    partyLean?.toUpperCase() === "REPUBLICAN" || partyLean?.toUpperCase() === "DEMOCRATIC" || partyLean?.toUpperCase() === "BIPARTISAN"
      ? partyLean.toUpperCase() as "REPUBLICAN" | "DEMOCRATIC" | "BIPARTISAN"
      : "NONE"

  return {
    executive_summary: executiveSummary,
    metrics: {
      confidence_level: confidenceLevel,
      estimated_net_worth_low: estimatedNetWorthLow || null,
      estimated_net_worth_high: estimatedNetWorthHigh || null,
      capacity_rating: capacityRating,
      romy_score: 0, // Will be calculated later
      estimated_gift_capacity: null,
      recommended_ask: null,
    },
    wealth: {
      real_estate: {
        total_value: structuredData?.totalRealEstateValue || null,
        properties: (structuredData?.realEstate || []).map((p) => ({
          address: p.address,
          value: p.estimatedValue || 0,
          source: p.source || "LinkUp",
          confidence: "ESTIMATED" as const,
        })),
      },
      business_ownership: (structuredData?.businesses || []).map((b) => ({
        company: b.name,
        role: b.role,
        estimated_value: b.estimatedRevenue || null,
        source: "LinkUp",
        confidence: "ESTIMATED" as const,
      })),
      securities: {
        has_sec_filings: structuredData?.securities?.hasSecFilings || false,
        insider_at: (structuredData?.securities?.companies || []).map(c => c.ticker),
        source: structuredData?.securities?.hasSecFilings ? "SEC EDGAR via LinkUp" : null,
      },
    },
    philanthropy: {
      political_giving: {
        total: structuredData?.politicalGiving?.totalAmount || 0,
        party_lean: validPartyLean,
        source: structuredData?.politicalGiving?.totalAmount ? "FEC" : null,
      },
      foundation_affiliations: (structuredData?.philanthropy?.foundations || []).map(f => f.name),
      nonprofit_boards: (structuredData?.philanthropy?.boardMemberships || []).map(b => b.organization),
      known_major_gifts: (structuredData?.philanthropy?.majorGifts || []).map((g) => ({
        organization: g.recipient,
        amount: g.amount || 0,
        year: g.year || null,
        source: "LinkUp",
      })),
    },
    background: {
      age: structuredData?.age || null,
      education: (structuredData?.education || []).map(e =>
        [e.degree, e.institution, e.year ? `(${e.year})` : null].filter(Boolean).join(" - ")
      ),
      career_summary: careerSummary,
      family: {
        spouse: structuredData?.spouse || null,
        children_count: null,
      },
    },
    strategy: {
      readiness: capacityRating === "MAJOR" || capacityRating === "PRINCIPAL" ? "WARMING" : "NOT_READY",
      next_steps: capacityRating === "MAJOR" || capacityRating === "PRINCIPAL"
        ? ["Schedule introduction meeting", "Research personal interests", "Identify giving history"]
        : ["Add to cultivation pipeline", "Include in annual fund appeals"],
      best_solicitor: "Gift officer with relevant sector expertise",
      tax_smart_option: capacityRating === "MAJOR" ? "STOCK" : "NONE",
      talking_points: [],
      avoid: [],
    },
    sources: linkupResult.sources.map((s) => ({
      title: s.name,
      url: s.url,
      data_provided: s.snippet || "Research data from LinkUp",
    })),
  }
}

// ============================================================================
// MARKDOWN REPORT FORMATTER
// ============================================================================

/**
 * Check if research returned insufficient data to generate a useful report
 */
function hasInsufficientData(data: ProspectResearchOutput): boolean {
  const { metrics, wealth, philanthropy, background, sources } = data

  const noSources = sources.length === 0
  const noWealthData =
    !wealth.real_estate.total_value &&
    wealth.real_estate.properties.length === 0 &&
    wealth.business_ownership.length === 0 &&
    !wealth.securities.has_sec_filings
  const noPhilanthropyData =
    philanthropy.political_giving.total === 0 &&
    philanthropy.foundation_affiliations.length === 0 &&
    philanthropy.nonprofit_boards.length === 0 &&
    philanthropy.known_major_gifts.length === 0
  const noBackgroundData =
    !background.age &&
    background.education.length === 0 &&
    (!background.career_summary || background.career_summary.includes("could not be structured"))
  const noMetrics =
    !metrics.estimated_net_worth_low &&
    !metrics.estimated_net_worth_high &&
    !metrics.estimated_gift_capacity &&
    metrics.romy_score === 0

  return noSources && noWealthData && noPhilanthropyData && noBackgroundData && noMetrics
}

/**
 * Format a compact "Insufficient Data" report when no useful information found
 */
function formatInsufficientDataReport(name: string, data: ProspectResearchOutput): string {
  const lines: string[] = []

  lines.push(`# ${name} | Insufficient Data`)
  lines.push("")
  lines.push("**Research Status: Unable to Verify**")
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

  return lines.join("\n")
}

/**
 * Format structured JSON output into table-first markdown report
 */
function formatReportMarkdown(name: string, data: ProspectResearchOutput): string {
  if (hasInsufficientData(data)) {
    return formatInsufficientDataReport(name, data)
  }

  const { metrics, wealth, philanthropy, background, strategy, sources, executive_summary } = data

  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "Unknown"
    return `$${value.toLocaleString()}`
  }

  const netWorthDisplay = metrics.estimated_net_worth_low && metrics.estimated_net_worth_high
    ? `${formatCurrency(metrics.estimated_net_worth_low)} - ${formatCurrency(metrics.estimated_net_worth_high)}`
    : formatCurrency(metrics.estimated_net_worth_high || metrics.estimated_net_worth_low)

  const lines: string[] = []

  // Header with key metrics table
  lines.push(`# ${name} | Prospect Profile`)
  lines.push("")
  lines.push("| Metric | Value | Confidence |")
  lines.push("|--------|-------|------------|")
  lines.push(`| **Net Worth** | ${netWorthDisplay} | ${metrics.confidence_level} |`)
  lines.push(`| **Gift Capacity** | ${formatCurrency(metrics.estimated_gift_capacity)} | ${metrics.confidence_level} |`)
  lines.push(`| **Rating** | ${metrics.capacity_rating} | - |`)
  lines.push(`| **RomyScore** | ${metrics.romy_score}/41 | - |`)
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
    lines.push("*No biographical information found in public records.*")
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
    lines.push("*No verifiable sources found.*")
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
 * Generate a comprehensive prospect report using LinkUp
 *
 * This is the main entry point for batch processing.
 * Returns structured data + formatted markdown report.
 *
 * Cost: ~$0.025 per prospect (5 queries × $0.005)
 */
export async function generateProspectReport(
  options: GenerateReportOptions
): Promise<GenerateReportResult> {
  const { prospect, apiKey } = options
  const startTime = Date.now()

  try {
    console.log(`[BatchProcessor] Starting research for: ${prospect.name}`)

    // Step 1: Research with LinkUp (primary) + optional Grok (for X/Twitter)
    const researchResult = await researchWithLinkUpSources(prospect, apiKey)

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
      `RomyScore: ${romyBreakdown.totalScore}/41 (${romyBreakdown.tier.name}), ` +
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
    model_used: "linkup/search",
    processing_duration_ms: Date.now() - startTime,
  }
}
