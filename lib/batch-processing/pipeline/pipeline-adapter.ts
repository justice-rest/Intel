/**
 * Pipeline Adapter - Maps ResearchPipelineResult to batch_prospect_items DB format
 */

import type {
  Affiliations,
  BusinessDetails,
  GivingHistory,
  ProspectResearchOutput,
  WealthIndicators,
} from "../types"
import type { ResearchPipelineResult } from "./research-pipeline"

export interface BatchItemUpdateData {
  status: "completed" | "failed"
  report_content?: string
  report_format?: "markdown" | "html"
  romy_score?: number
  romy_score_tier?: string
  capacity_rating?: string
  estimated_net_worth?: number
  estimated_gift_capacity?: number
  recommended_ask?: number
  wealth_indicators?: WealthIndicators | null
  business_details?: BusinessDetails | null
  giving_history?: GivingHistory | null
  affiliations?: Affiliations | null
  search_queries_used?: string[]
  sources_found?: Array<{ name: string; url: string }>
  tokens_used?: number
  model_used?: string
  processing_completed_at?: string
  processing_duration_ms?: number
  error_message?: string | null
  enrichment_data?: Record<string, unknown> | null
  enriched_at?: string
  enrichment_mode?: string
}

export interface AdaptedPipelineResult {
  success: boolean
  updateData: BatchItemUpdateData
  verification: {
    status: "verified" | "partial" | "unverified"
    confidence: number
    hallucinationsCount: number
    verifiedClaimsCount: number
    recommendations: string[]
  }
}

export function adaptPipelineResultToDbFormat(
  pipelineResult: ResearchPipelineResult,
  startTime: number
): AdaptedPipelineResult {
  const {
    finalData,
    success,
    totalTokensUsed,
    totalDurationMs,
    verificationStatus,
    overallConfidence,
    hallucinationsCount,
    verifiedClaimsCount,
    verificationRecommendations,
  } = pipelineResult

  if (!success || !finalData) {
    return {
      success: false,
      updateData: {
        status: "failed",
        error_message: pipelineResult.error || "Pipeline execution failed",
        processing_completed_at: new Date().toISOString(),
        processing_duration_ms: totalDurationMs || Date.now() - startTime,
      },
      verification: {
        status: "unverified",
        confidence: 0,
        hallucinationsCount: 0,
        verifiedClaimsCount: 0,
        recommendations: [],
      },
    }
  }

  const output = finalData as ProspectResearchOutput

  const wealthIndicators: WealthIndicators = {
    real_estate_total: output.wealth?.real_estate?.total_value || undefined,
    property_count: output.wealth?.real_estate?.properties?.length || undefined,
    business_equity: calculateBusinessEquity(output),
    public_holdings: output.wealth?.securities?.has_sec_filings ? 1 : undefined,
    inheritance_likely: false,
  }

  const businessDetails: BusinessDetails = {
    companies: output.wealth?.business_ownership?.map((b) => b.company) || [],
    roles: output.wealth?.business_ownership?.map((b) => b.role) || [],
    industries: [],
  }

  const givingHistory: GivingHistory = {
    total_political: output.philanthropy?.political_giving?.total || undefined,
    political_party:
      output.philanthropy?.political_giving?.party_lean || undefined,
    foundation_affiliations: output.philanthropy?.foundation_affiliations || [],
    nonprofit_boards: output.philanthropy?.nonprofit_boards || [],
    known_major_gifts:
      output.philanthropy?.known_major_gifts?.map((g) => ({
        org: g.organization,
        amount: g.amount,
        year: g.year || undefined,
      })) || [],
  }

  const affiliations: Affiliations = {
    education: output.background?.education || [],
    clubs: [],
    public_company_boards: output.wealth?.securities?.insider_at || [],
  }

  const avgNetWorth =
    output.metrics?.estimated_net_worth_low &&
    output.metrics?.estimated_net_worth_high
      ? (output.metrics.estimated_net_worth_low +
          output.metrics.estimated_net_worth_high) /
        2
      : output.metrics?.estimated_net_worth_high ||
        output.metrics?.estimated_net_worth_low ||
        undefined

  const sources =
    output.sources?.map((s) => ({
      name: s.title,
      url: s.url,
    })) || []

  const reportContent = output.executive_summary
    ? generateReportFromOutput(output)
    : undefined

  const updateData: BatchItemUpdateData = {
    status: "completed",
    report_content: reportContent,
    report_format: "markdown",
    romy_score: output.metrics?.romy_score || undefined,
    romy_score_tier: getRomyTierFromScore(output.metrics?.romy_score),
    capacity_rating: output.metrics?.capacity_rating || undefined,
    estimated_net_worth: avgNetWorth,
    estimated_gift_capacity:
      output.metrics?.estimated_gift_capacity || undefined,
    recommended_ask: output.metrics?.recommended_ask || undefined,
    wealth_indicators: wealthIndicators,
    business_details: businessDetails,
    giving_history: givingHistory,
    affiliations: affiliations,
    search_queries_used: ["ResearchPipeline v4.0"],
    sources_found: sources,
    tokens_used: totalTokensUsed,
    model_used: "linkup/search + verification",
    processing_completed_at: new Date().toISOString(),
    processing_duration_ms: totalDurationMs || Date.now() - startTime,
    error_message: null,
    enrichment_data: {
      verificationStatus,
      overallConfidence,
      hallucinationsCount,
      verifiedClaimsCount,
      completedSteps: pipelineResult.completedSteps,
      failedSteps: pipelineResult.failedSteps,
      skippedSteps: pipelineResult.skippedSteps,
      dataQualityScore: pipelineResult.dataQualityScore,
    },
    enriched_at: new Date().toISOString(),
    enrichment_mode: "STANDARD",
  }

  return {
    success: true,
    updateData,
    verification: {
      status: verificationStatus,
      confidence: overallConfidence,
      hallucinationsCount,
      verifiedClaimsCount,
      recommendations: verificationRecommendations,
    },
  }
}

function calculateBusinessEquity(
  output: ProspectResearchOutput
): number | undefined {
  const businesses = output.wealth?.business_ownership || []
  if (businesses.length === 0) return undefined

  const totalValue = businesses.reduce((sum, b) => {
    return sum + (b.estimated_value || 0)
  }, 0)

  return totalValue > 0 ? totalValue : undefined
}

function getRomyTierFromScore(score?: number): string | undefined {
  if (score === undefined || score === null) return undefined
  if (score >= 31) return "Platinum"
  if (score >= 21) return "Gold"
  if (score >= 11) return "Silver"
  return "Bronze"
}

function generateReportFromOutput(output: ProspectResearchOutput): string {
  const lines: string[] = []

  lines.push(`# Prospect Research Report`)
  lines.push("")
  lines.push("| Metric | Value | Confidence |")
  lines.push("|--------|-------|------------|")

  if (
    output.metrics?.estimated_net_worth_low ||
    output.metrics?.estimated_net_worth_high
  ) {
    const netWorth =
      output.metrics.estimated_net_worth_low &&
      output.metrics.estimated_net_worth_high
        ? `$${(output.metrics.estimated_net_worth_low / 1000000).toFixed(1)}M - $${(output.metrics.estimated_net_worth_high / 1000000).toFixed(1)}M`
        : `$${((output.metrics.estimated_net_worth_high || output.metrics.estimated_net_worth_low || 0) / 1000000).toFixed(1)}M`
    lines.push(
      `| **Net Worth** | ${netWorth} | ${output.metrics.confidence_level} |`
    )
  }

  if (output.metrics?.capacity_rating) {
    lines.push(
      `| **Capacity Rating** | ${output.metrics.capacity_rating} | - |`
    )
  }

  if (output.metrics?.romy_score !== undefined) {
    lines.push(`| **RomyScore** | ${output.metrics.romy_score}/41 | - |`)
  }

  lines.push("")
  lines.push("---")
  lines.push("")

  if (output.executive_summary) {
    lines.push("## Executive Summary")
    lines.push("")
    lines.push(output.executive_summary)
    lines.push("")
    lines.push("---")
    lines.push("")
  }

  lines.push("## Wealth Indicators")
  lines.push("")

  if (output.wealth?.real_estate?.properties?.length) {
    lines.push("### Real Estate")
    lines.push("")
    lines.push("| Property | Value | Source |")
    lines.push("|----------|-------|--------|")
    for (const prop of output.wealth.real_estate.properties) {
      lines.push(
        `| ${prop.address} | $${(prop.value || 0).toLocaleString()} | ${prop.source} |`
      )
    }
    if (output.wealth.real_estate.total_value) {
      lines.push("")
      lines.push(
        `**Total Real Estate:** $${output.wealth.real_estate.total_value.toLocaleString()}`
      )
    }
    lines.push("")
  }

  if (output.wealth?.business_ownership?.length) {
    lines.push("### Business Ownership")
    lines.push("")
    for (const biz of output.wealth.business_ownership) {
      lines.push(`- **${biz.company}** - ${biz.role}`)
    }
    lines.push("")
  }

  if (output.wealth?.securities?.has_sec_filings) {
    lines.push("### Securities (SEC Verified)")
    lines.push("")
    lines.push(`Insider at: ${output.wealth.securities.insider_at.join(", ")}`)
    lines.push("")
  }

  lines.push("---")
  lines.push("")

  lines.push("## Philanthropic Profile")
  lines.push("")

  if (output.philanthropy?.political_giving?.total > 0) {
    lines.push(
      `**Political Giving:** $${output.philanthropy.political_giving.total.toLocaleString()} (${output.philanthropy.political_giving.party_lean})`
    )
    lines.push("")
  }

  if (output.philanthropy?.foundation_affiliations?.length) {
    lines.push("**Foundation Affiliations:**")
    for (const f of output.philanthropy.foundation_affiliations) {
      lines.push(`- ${f}`)
    }
    lines.push("")
  }

  if (output.philanthropy?.nonprofit_boards?.length) {
    lines.push("**Nonprofit Boards:**")
    for (const b of output.philanthropy.nonprofit_boards) {
      lines.push(`- ${b}`)
    }
    lines.push("")
  }

  lines.push("---")
  lines.push("")

  if (output.sources?.length) {
    lines.push("## Sources")
    lines.push("")
    for (const source of output.sources) {
      lines.push(`- [${source.title}](${source.url})`)
    }
  }

  return lines.join("\n")
}
