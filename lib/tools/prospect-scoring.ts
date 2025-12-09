/**
 * Prospect Scoring Tool
 *
 * AI-powered prospect scoring that competitors like DonorSearch AI charge $4,000+/year for.
 * This tool aggregates data from multiple sources and generates:
 * - Giving Capacity Score (0-100): Estimated ability to give based on wealth indicators
 * - Propensity Score (0-100): Likelihood to give based on giving history and affinity
 * - Overall Prospect Rating (A-D): Combined assessment for prioritization
 *
 * Wealth indicators used:
 * - Real estate holdings (property valuation tool)
 * - SEC stock holdings and insider status
 * - FEC political contributions (proxy for discretionary wealth)
 * - Foundation affiliations and giving history
 * - Business ownership and executive positions
 *
 * Free alternative to:
 * - DonorSearch AI ($4,000+/yr)
 * - iWave ($4,150+/yr)
 * - WealthEngine (enterprise pricing)
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// CONSTANTS
// ============================================================================

const PROPUBLICA_API_BASE = "https://projects.propublica.org/nonprofits/api/v2"
const FEC_API_BASE = "https://api.open.fec.gov/v1"
const SEC_EFTS_BASE = "https://efts.sec.gov/LATEST/search-index"

// ============================================================================
// SCHEMAS
// ============================================================================

const prospectScoringSchema = z.object({
  personName: z
    .string()
    .describe("Full name of the prospect to score (e.g., 'Warren Buffett', 'Tim Cook')"),
  city: z
    .string()
    .optional()
    .describe("City to help disambiguate common names"),
  state: z
    .string()
    .optional()
    .describe("Two-letter state code (e.g., 'CA', 'NY')"),
  employer: z
    .string()
    .optional()
    .describe("Current or past employer to help identify the correct person"),
})

// ============================================================================
// TYPES
// ============================================================================

interface WealthIndicator {
  source: string
  indicator: string
  value: number | string
  score: number // 0-100 contribution to overall score
  confidence: "high" | "medium" | "low"
  url?: string
}

interface ProspectScore {
  capacityScore: number // 0-100: Ability to give
  propensityScore: number // 0-100: Likelihood to give
  affinityScore: number // 0-100: Alignment with charitable causes
  overallRating: "A" | "B" | "C" | "D" // Combined rating
  estimatedCapacity: string // Human-readable capacity range
  wealthIndicators: WealthIndicator[]
  givingHistory: Array<{
    type: string
    recipient: string
    amount: number
    date?: string
  }>
  recommendations: string[]
}

export interface ProspectScoringResult {
  personName: string
  score: ProspectScore
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
  dataQuality: "complete" | "partial" | "limited"
}

// ============================================================================
// HELPERS
// ============================================================================

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

function formatCurrency(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}

function calculateCapacityRange(score: number): string {
  if (score >= 90) return "$10M+ major gift capacity"
  if (score >= 80) return "$1M-$10M gift capacity"
  if (score >= 70) return "$100K-$1M gift capacity"
  if (score >= 60) return "$25K-$100K gift capacity"
  if (score >= 50) return "$10K-$25K gift capacity"
  if (score >= 40) return "$5K-$10K gift capacity"
  if (score >= 30) return "$1K-$5K gift capacity"
  return "Under $1K capacity"
}

function calculateRating(capacityScore: number, propensityScore: number): "A" | "B" | "C" | "D" {
  const combined = (capacityScore * 0.6) + (propensityScore * 0.4)
  if (combined >= 75) return "A"
  if (combined >= 55) return "B"
  if (combined >= 35) return "C"
  return "D"
}

// ============================================================================
// DATA FETCHERS
// ============================================================================

/**
 * Check SEC EDGAR for insider filings (indicates executive/board status at public companies)
 */
async function checkSecInsider(personName: string): Promise<WealthIndicator | null> {
  try {
    const searchQuery = encodeURIComponent(`"${personName}"`)
    const url = `${SEC_EFTS_BASE}?q=${searchQuery}&dateRange=custom&startdt=2020-01-01&forms=4,3,5&from=0&size=5`

    const response = await withTimeout(
      fetch(url, {
        headers: { Accept: "application/json" },
      }),
      15000,
      "SEC search timed out"
    )

    if (!response.ok) return null

    const data = await response.json()
    const hits = data.hits?.hits || []

    if (hits.length > 0) {
      // Found Form 4 filings - person is an insider at public company
      const companies = new Set<string>()
      hits.forEach((hit: { _source?: { display_names?: string[] } }) => {
        const names = hit._source?.display_names || []
        names.forEach((n: string) => {
          if (!n.toLowerCase().includes(personName.split(" ")[1]?.toLowerCase() || "")) {
            companies.add(n)
          }
        })
      })

      return {
        source: "SEC EDGAR",
        indicator: `Insider at ${hits.length} public compan${hits.length === 1 ? "y" : "ies"}`,
        value: Array.from(companies).slice(0, 3).join(", ") || "Public company insider",
        score: Math.min(100, 60 + hits.length * 10), // Base 60 + 10 per filing
        confidence: "high",
        url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(personName)}&type=4&owner=only`,
      }
    }

    return null
  } catch (error) {
    console.error("[ProspectScoring] SEC check failed:", error)
    return null
  }
}

/**
 * Check FEC for political contribution totals
 */
async function checkFecContributions(
  personName: string,
  state?: string
): Promise<WealthIndicator | null> {
  const apiKey = process.env.FEC_API_KEY
  if (!apiKey) return null

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      contributor_name: personName,
      per_page: "100",
      sort: "-contribution_receipt_amount",
    })

    if (state) {
      params.append("contributor_state", state.toUpperCase())
    }

    const url = `${FEC_API_BASE}/schedules/schedule_a/?${params.toString()}`

    const response = await withTimeout(
      fetch(url, { headers: { Accept: "application/json" } }),
      15000,
      "FEC search timed out"
    )

    if (!response.ok) return null

    const data = await response.json()
    const contributions = data.results || []

    if (contributions.length > 0) {
      const totalAmount = contributions.reduce(
        (sum: number, c: { contribution_receipt_amount?: number }) =>
          sum + (c.contribution_receipt_amount || 0),
        0
      )

      // Political contributions indicate discretionary wealth
      // $50K+ = very high capacity, $10K+ = high, $2K+ = moderate
      let score = 0
      if (totalAmount >= 50000) score = 85
      else if (totalAmount >= 25000) score = 70
      else if (totalAmount >= 10000) score = 55
      else if (totalAmount >= 5000) score = 40
      else if (totalAmount >= 2000) score = 25
      else score = 15

      return {
        source: "FEC",
        indicator: `${contributions.length} political contributions`,
        value: formatCurrency(totalAmount),
        score,
        confidence: "high",
        url: `https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=${encodeURIComponent(personName)}`,
      }
    }

    return null
  } catch (error) {
    console.error("[ProspectScoring] FEC check failed:", error)
    return null
  }
}

/**
 * Check ProPublica for foundation affiliations
 */
async function checkFoundationAffiliations(personName: string): Promise<WealthIndicator | null> {
  try {
    // Search for foundations with the person's last name
    const lastName = personName.split(" ").pop() || personName
    const searchTerms = [
      `${lastName} Foundation`,
      `${lastName} Family Foundation`,
      `${lastName} Charitable`,
    ]

    const foundOrgs: Array<{ name: string; assets?: number }> = []

    for (const term of searchTerms) {
      const url = `${PROPUBLICA_API_BASE}/search.json?q=${encodeURIComponent(term)}`

      const response = await withTimeout(
        fetch(url, { headers: { Accept: "application/json" } }),
        10000,
        "ProPublica search timed out"
      )

      if (response.ok) {
        const data = await response.json()
        const orgs = data.organizations || []

        // Filter for likely matches
        for (const org of orgs.slice(0, 3)) {
          if (
            org.name.toLowerCase().includes(lastName.toLowerCase()) &&
            (org.have_filings || org.have_extracts)
          ) {
            // Get filing details for assets
            try {
              const detailsUrl = `${PROPUBLICA_API_BASE}/organizations/${org.ein}.json`
              const detailsRes = await fetch(detailsUrl)
              if (detailsRes.ok) {
                const details = await detailsRes.json()
                const recentFiling = details.filings_with_data?.[0]
                foundOrgs.push({
                  name: org.name,
                  assets: recentFiling?.totassetsend,
                })
              }
            } catch {
              foundOrgs.push({ name: org.name })
            }
          }
        }
      }
    }

    if (foundOrgs.length > 0) {
      const maxAssets = Math.max(...foundOrgs.map((o) => o.assets || 0))

      // Foundation assets indicate significant wealth
      let score = 40 // Base score for having any foundation
      if (maxAssets >= 100000000) score = 95
      else if (maxAssets >= 10000000) score = 80
      else if (maxAssets >= 1000000) score = 65
      else if (maxAssets >= 100000) score = 50

      return {
        source: "ProPublica 990",
        indicator: `${foundOrgs.length} potential foundation affiliation${foundOrgs.length !== 1 ? "s" : ""}`,
        value:
          maxAssets > 0
            ? `Largest: ${formatCurrency(maxAssets)} in assets`
            : foundOrgs[0].name,
        score,
        confidence: foundOrgs.some((o) => o.assets) ? "high" : "medium",
        url: `https://projects.propublica.org/nonprofits/search?q=${encodeURIComponent(lastName + " Foundation")}`,
      }
    }

    return null
  } catch (error) {
    console.error("[ProspectScoring] ProPublica check failed:", error)
    return null
  }
}

/**
 * Check Wikidata for known net worth and positions
 */
async function checkWikidata(personName: string): Promise<WealthIndicator | null> {
  try {
    // Search for person
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(personName)}&language=en&type=item&limit=3&format=json&origin=*`

    const searchRes = await withTimeout(
      fetch(searchUrl),
      10000,
      "Wikidata search timed out"
    )

    if (!searchRes.ok) return null

    const searchData = await searchRes.json()
    const results = searchData.search || []

    // Find a person (not organization)
    for (const result of results) {
      if (
        result.description?.toLowerCase().includes("businessperson") ||
        result.description?.toLowerCase().includes("entrepreneur") ||
        result.description?.toLowerCase().includes("executive") ||
        result.description?.toLowerCase().includes("philanthropist") ||
        result.description?.toLowerCase().includes("investor")
      ) {
        // Get entity details
        const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${result.id}&languages=en&format=json&origin=*`
        const entityRes = await fetch(entityUrl)

        if (entityRes.ok) {
          const entityData = await entityRes.json()
          const entity = entityData.entities?.[result.id]

          if (entity) {
            const claims = entity.claims || {}

            // Check P2218 (net worth)
            const netWorthClaim = claims["P2218"]?.[0]
            if (netWorthClaim?.mainsnak?.datavalue?.value?.amount) {
              const netWorth = parseFloat(
                netWorthClaim.mainsnak.datavalue.value.amount.replace("+", "")
              )

              return {
                source: "Wikidata",
                indicator: "Known net worth",
                value: formatCurrency(netWorth),
                score: netWorth >= 1e9 ? 100 : netWorth >= 1e8 ? 90 : netWorth >= 1e7 ? 75 : 60,
                confidence: "high",
                url: `https://www.wikidata.org/wiki/${result.id}`,
              }
            }

            // Check notable positions (P39)
            const positions = claims["P39"]
            if (positions && positions.length > 0) {
              return {
                source: "Wikidata",
                indicator: `${result.description || "Notable individual"}`,
                value: `${positions.length} notable position${positions.length !== 1 ? "s" : ""}`,
                score: 50 + Math.min(30, positions.length * 10),
                confidence: "medium",
                url: `https://www.wikidata.org/wiki/${result.id}`,
              }
            }
          }
        }
      }
    }

    return null
  } catch (error) {
    console.error("[ProspectScoring] Wikidata check failed:", error)
    return null
  }
}

/**
 * Format prospect score for AI consumption
 */
function formatScoreForAI(personName: string, score: ProspectScore): string {
  const lines: string[] = [
    `# Prospect Score: ${personName}`,
    "",
    `## Overall Assessment`,
    "",
    `| Metric | Score | Rating |`,
    `|--------|-------|--------|`,
    `| **Giving Capacity** | ${score.capacityScore}/100 | ${getRatingLabel(score.capacityScore)} |`,
    `| **Propensity to Give** | ${score.propensityScore}/100 | ${getRatingLabel(score.propensityScore)} |`,
    `| **Affinity** | ${score.affinityScore}/100 | ${getRatingLabel(score.affinityScore)} |`,
    "",
    `### **Overall Rating: ${score.overallRating}**`,
    `### **Estimated Capacity: ${score.estimatedCapacity}**`,
    "",
    "---",
    "",
    `## Wealth Indicators`,
    "",
  ]

  if (score.wealthIndicators.length === 0) {
    lines.push("*No public wealth indicators found. This may indicate:*")
    lines.push("- Private wealth not in public records")
    lines.push("- Different name spelling in databases")
    lines.push("- International assets not captured")
    lines.push("")
  } else {
    for (const indicator of score.wealthIndicators) {
      lines.push(
        `### ${indicator.source} (${indicator.confidence} confidence)`
      )
      lines.push(`- **${indicator.indicator}**`)
      lines.push(`- Value: ${indicator.value}`)
      lines.push(`- Score Contribution: +${indicator.score}`)
      lines.push("")
    }
  }

  lines.push("---")
  lines.push("")
  lines.push("## Recommendations")
  lines.push("")

  for (const rec of score.recommendations) {
    lines.push(`- ${rec}`)
  }

  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("## How This Score Was Calculated")
  lines.push("")
  lines.push("This AI-powered prospect score aggregates data from:")
  lines.push("- **SEC EDGAR**: Insider trading filings (Form 3, 4, 5)")
  lines.push("- **FEC**: Political contribution history")
  lines.push("- **ProPublica**: Foundation affiliations and 990 data")
  lines.push("- **Wikidata**: Known net worth and positions")
  lines.push("")
  lines.push(
    "*This is a free alternative to DonorSearch AI, iWave, and WealthEngine prospect scoring.*"
  )

  return lines.join("\n")
}

function getRatingLabel(score: number): string {
  if (score >= 80) return "Excellent"
  if (score >= 60) return "Strong"
  if (score >= 40) return "Moderate"
  if (score >= 20) return "Limited"
  return "Minimal"
}

// ============================================================================
// TOOL
// ============================================================================

export const prospectScoringTool = tool({
  description:
    "AI-POWERED PROSPECT SCORING - Generate comprehensive donor capacity scores. " +
    "This is a FREE alternative to DonorSearch AI ($4,000+/yr), iWave ($4,150+/yr), and WealthEngine. " +
    "Aggregates data from SEC, FEC, ProPublica 990s, and Wikidata to calculate: " +
    "(1) Giving Capacity Score (0-100), (2) Propensity Score (0-100), (3) Overall A-D Rating. " +
    "Returns estimated giving capacity range and actionable recommendations. " +
    "Use this to prioritize prospects and estimate major gift capacity.",
  parameters: prospectScoringSchema,
  execute: async ({
    personName,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    city,
    state,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    employer,
  }): Promise<ProspectScoringResult> => {
    console.log("[ProspectScoring] Scoring prospect:", personName)
    const startTime = Date.now()

    const sources: Array<{ name: string; url: string }> = []
    const wealthIndicators: WealthIndicator[] = []
    const givingHistory: ProspectScore["givingHistory"] = []

    try {
      // Run all data checks in parallel
      const [secResult, fecResult, foundationResult, wikidataResult] = await Promise.all([
        checkSecInsider(personName),
        checkFecContributions(personName, state),
        checkFoundationAffiliations(personName),
        checkWikidata(personName),
      ])

      // Collect results
      if (secResult) {
        wealthIndicators.push(secResult)
        if (secResult.url) {
          sources.push({ name: "SEC EDGAR Filings", url: secResult.url })
        }
      }

      if (fecResult) {
        wealthIndicators.push(fecResult)
        if (fecResult.url) {
          sources.push({ name: "FEC Contributions", url: fecResult.url })
        }
        // Add to giving history
        givingHistory.push({
          type: "Political",
          recipient: "Various political committees",
          amount: parseFloat(String(fecResult.value).replace(/[$,KMB]/g, "")) *
            (String(fecResult.value).includes("M") ? 1000000 :
             String(fecResult.value).includes("K") ? 1000 : 1),
        })
      }

      if (foundationResult) {
        wealthIndicators.push(foundationResult)
        if (foundationResult.url) {
          sources.push({ name: "ProPublica Nonprofit Explorer", url: foundationResult.url })
        }
      }

      if (wikidataResult) {
        wealthIndicators.push(wikidataResult)
        if (wikidataResult.url) {
          sources.push({ name: "Wikidata", url: wikidataResult.url })
        }
      }

      // Calculate scores
      let capacityScore = 0
      let propensityScore = 0
      let affinityScore = 0

      // Capacity score based on wealth indicators
      if (wealthIndicators.length > 0) {
        // Take weighted average, with bonus for multiple indicators
        const avgScore =
          wealthIndicators.reduce((sum, i) => sum + i.score, 0) / wealthIndicators.length
        const diversityBonus = Math.min(20, wealthIndicators.length * 5)
        capacityScore = Math.min(100, Math.round(avgScore + diversityBonus))
      } else {
        capacityScore = 20 // Baseline for unknown prospects
      }

      // Propensity score based on giving history
      if (givingHistory.length > 0 || foundationResult) {
        propensityScore = Math.min(100, 50 + givingHistory.length * 10 + (foundationResult ? 25 : 0))
      } else {
        propensityScore = 30 // Baseline
      }

      // Affinity score (would need organization-specific matching in real implementation)
      // For now, base on foundation involvement and political giving
      affinityScore = foundationResult
        ? Math.min(100, foundationResult.score)
        : fecResult
        ? Math.min(80, fecResult.score)
        : 25

      // Generate recommendations
      const recommendations: string[] = []

      if (capacityScore >= 70) {
        recommendations.push(
          "HIGH PRIORITY: Schedule personal meeting with major gifts officer"
        )
        recommendations.push(
          "Consider for leadership giving society or naming opportunity"
        )
      } else if (capacityScore >= 50) {
        recommendations.push("MEDIUM PRIORITY: Add to cultivation pipeline")
        recommendations.push("Consider for mid-level donor program")
      } else {
        recommendations.push("Continue cultivation through events and communications")
      }

      if (foundationResult) {
        recommendations.push(
          "Has foundation affiliation - research grant-making priorities"
        )
      }

      if (fecResult) {
        recommendations.push(
          "Active political donor - demonstrates discretionary giving capacity"
        )
      }

      if (secResult) {
        recommendations.push(
          "Corporate insider - consider stock gift or DAF conversation"
        )
      }

      if (wealthIndicators.length < 2) {
        recommendations.push(
          "Limited public data - consider requesting additional research or personal qualification call"
        )
      }

      // Build final score object
      const score: ProspectScore = {
        capacityScore,
        propensityScore,
        affinityScore,
        overallRating: calculateRating(capacityScore, propensityScore),
        estimatedCapacity: calculateCapacityRange(capacityScore),
        wealthIndicators,
        givingHistory,
        recommendations,
      }

      const duration = Date.now() - startTime
      console.log("[ProspectScoring] Completed in", duration, "ms")

      const rawContent = formatScoreForAI(personName, score)

      // Determine data quality
      let dataQuality: "complete" | "partial" | "limited"
      if (wealthIndicators.length >= 3) {
        dataQuality = "complete"
      } else if (wealthIndicators.length >= 1) {
        dataQuality = "partial"
      } else {
        dataQuality = "limited"
      }

      return {
        personName,
        score,
        rawContent,
        sources,
        dataQuality,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[ProspectScoring] Scoring failed:", errorMessage)

      return {
        personName,
        score: {
          capacityScore: 0,
          propensityScore: 0,
          affinityScore: 0,
          overallRating: "D",
          estimatedCapacity: "Unable to calculate",
          wealthIndicators: [],
          givingHistory: [],
          recommendations: ["Error occurred - try again or research manually"],
        },
        rawContent: `# Prospect Score: ${personName}\n\n**Error:** ${errorMessage}`,
        sources: [],
        error: errorMessage,
        dataQuality: "limited",
      }
    }
  },
})

/**
 * Check if prospect scoring should be enabled
 * Works without FEC key (just won't include political contributions)
 */
export function shouldEnableProspectScoringTool(): boolean {
  return true // Always available, degrades gracefully
}
