/**
 * Prospect Profile Tool (Merged from Prospect Scoring + Report)
 *
 * AI-powered prospect profiling that competitors charge $4,000+/year for.
 * This unified tool provides BOTH:
 * - Numeric scores for quick prioritization (capacity, propensity, affinity, A-D rating)
 * - Evidence sections with source links for verification
 *
 * Data sources (all FREE):
 * - SEC EDGAR: Insider filings (Form 3, 4, 5) - HIGHEST confidence
 * - FEC: Political contributions - HIGHEST confidence
 * - ProPublica 990s: Foundation affiliations - HIGH confidence
 * - Wikidata: Biographical data - MEDIUM confidence
 *
 * Free alternative to:
 * - DonorSearch AI ($4,000+/yr)
 * - iWave ($4,150+/yr)
 * - WealthEngine (enterprise pricing)
 * - DonorSearch Research on Demand ($125-$300/profile)
 */

import { tool } from "ai"
import { z } from "zod"
import {
  countyAssessorTool,
  shouldEnableCountyAssessorTool,
  type CountyAssessorResult,
} from "./county-assessor"
import {
  voterRegistrationTool,
  shouldEnableVoterRegistrationTool,
  type VoterRegistrationResult,
} from "./voter-registration"
// Note: Family discovery and business revenue estimator tools were removed
// Use Perplexity's built-in web search for family member discovery and revenue estimates

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

/**
 * Evidence section with source verification
 */
interface EvidenceSection {
  title: string
  status: "verified" | "unverified" | "not_found"
  confidence: "high" | "medium" | "low"
  items: Array<{
    claim: string
    value: string
    source?: { name: string; url: string }
  }>
  sourceUrl?: string
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

export interface ProspectProfileResult {
  personName: string
  score: ProspectScore
  evidence: EvidenceSection[] // NEW: Evidence sections with sources
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
  dataQuality: "complete" | "partial" | "limited"
}

// Keep old type alias for backwards compatibility
export type ProspectScoringResult = ProspectProfileResult

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
 * Check county assessor for property data (if address provided)
 */
async function checkCountyAssessor(
  personName: string,
  address?: string,
  city?: string,
  state?: string
): Promise<{ indicator: WealthIndicator | null; result: CountyAssessorResult | null }> {
  if (!shouldEnableCountyAssessorTool()) {
    return { indicator: null, result: null }
  }

  try {
    // Try to search by owner name if no address
    const result = await countyAssessorTool.execute(
      {
        ownerName: personName,
        address,
        city,
        state,
        limit: 5,
      },
      {
        toolCallId: `prospect-profile-county-${Date.now()}`,
        messages: [],
        abortSignal: AbortSignal.timeout(30000),
      }
    )

    if (!result || result.properties.length === 0) {
      return { indicator: null, result: null }
    }

    // Sum up property values
    let totalValue = 0
    let propertyCount = 0
    for (const prop of result.properties) {
      const value = prop.marketValue || prop.assessedValue || 0
      if (value > 0) {
        totalValue += value
        propertyCount++
      }
    }

    if (propertyCount > 0) {
      // Property value is a strong wealth indicator
      let score = 0
      if (totalValue >= 5000000) score = 95
      else if (totalValue >= 2000000) score = 85
      else if (totalValue >= 1000000) score = 75
      else if (totalValue >= 500000) score = 60
      else if (totalValue >= 250000) score = 45
      else score = 30

      return {
        indicator: {
          source: `County Assessor (${result.county})`,
          indicator: `${propertyCount} propert${propertyCount === 1 ? "y" : "ies"} owned`,
          value: formatCurrency(totalValue),
          score,
          confidence: "high", // Official government data
          url: result.sources?.[0]?.url,
        },
        result,
      }
    }

    return { indicator: null, result: null }
  } catch (error) {
    console.error("[ProspectProfile] County assessor check failed:", error)
    return { indicator: null, result: null }
  }
}

/**
 * Check voter registration for party affiliation
 */
async function checkVoterRegistration(
  personName: string,
  state?: string
): Promise<{ indicator: WealthIndicator | null; result: VoterRegistrationResult | null }> {
  if (!shouldEnableVoterRegistrationTool() || !state) {
    return { indicator: null, result: null }
  }

  try {
    const result = await voterRegistrationTool.execute(
      {
        personName,
        state,
      },
      {
        toolCallId: `prospect-profile-voter-${Date.now()}`,
        messages: [],
        abortSignal: AbortSignal.timeout(30000),
      }
    )

    if (!result || !result.voterRecord) {
      return { indicator: null, result: null }
    }

    const { voterRecord } = result

    // Voter registration doesn't directly indicate wealth, but provides useful context
    // for engagement strategy (party affiliation, voting history)
    // Map "inferred" confidence to "low" for compatibility with EvidenceSection type
    const mappedConfidence: "high" | "medium" | "low" =
      result.confidence === "inferred" ? "low" : result.confidence

    return {
      indicator: {
        source: "Voter Registration",
        indicator: `${voterRecord.partyAffiliation || "Unknown"} voter`,
        value: voterRecord.status === "active" ? "Active voter" : voterRecord.status,
        score: 10, // Low score - doesn't indicate wealth directly
        confidence: mappedConfidence,
        url: result.sources?.[0]?.url,
      },
      result,
    }
  } catch (error) {
    console.error("[ProspectProfile] Voter registration check failed:", error)
    return { indicator: null, result: null }
  }
}

/**
 * Check family discovery for spouse and household
 */
// Note: Family discovery tool was removed - use Perplexity's built-in web search instead
async function checkFamilyDiscovery(
  _personName: string,
  _address?: string,
  _city?: string,
  _state?: string
): Promise<{ result: null }> {
  // Family discovery tool was removed - return null
  // Use Perplexity's built-in web search for family member discovery
  return { result: null }
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

export const prospectProfileTool = tool({
  description:
    "COMPREHENSIVE PROSPECT PROFILE - Generates donor capacity scores WITH verified evidence. " +
    "This is a FREE alternative to DonorSearch ($4,000+/yr), iWave ($4,150+/yr), and WealthEngine. " +
    "Returns: (1) A-D Rating with capacity/propensity/affinity scores, " +
    "(2) Evidence sections with SOURCE LINKS for verification (SEC, FEC, ProPublica, Wikidata). " +
    "Each claim marked as ✓ Verified (official source) or ⚠ Unverified. " +
    "Use this for major gift prospects - replaces both prospect_score and prospect_report.",
  parameters: prospectScoringSchema,
  execute: async ({
    personName,
    city,
    state,
    employer,
  }): Promise<ProspectProfileResult> => {
    console.log("[ProspectProfile] Generating profile for:", personName)
    const startTime = Date.now()

    const sources: Array<{ name: string; url: string }> = []
    const wealthIndicators: WealthIndicator[] = []
    const givingHistory: ProspectScore["givingHistory"] = []
    const evidence: EvidenceSection[] = []

    try {
      // Run all data checks in parallel - original sources
      const [secResult, fecResult, foundationResult, wikidataResult] = await Promise.all([
        checkSecInsider(personName),
        checkFecContributions(personName, state),
        checkFoundationAffiliations(personName),
        checkWikidata(personName),
      ])

      // Run new enhanced data checks in parallel
      const [countyResult, voterResult, familyResult] = await Promise.all([
        checkCountyAssessor(personName, undefined, city, state),
        checkVoterRegistration(personName, state),
        checkFamilyDiscovery(personName, undefined, city, state),
      ])

      // If we found a business from SEC or Wikidata, we could estimate revenue
      // For now, this is placeholder - would need to extract company names first
      void employer // Acknowledge employer param for future use

      // Collect results AND build evidence sections

      // SEC Evidence Section
      if (secResult) {
        wealthIndicators.push(secResult)
        if (secResult.url) {
          sources.push({ name: "SEC EDGAR Filings", url: secResult.url })
        }
        evidence.push({
          title: "SEC Insider Filings",
          status: "verified",
          confidence: "high",
          items: [{
            claim: "SEC Insider Status",
            value: secResult.indicator,
            source: secResult.url ? { name: "SEC EDGAR", url: secResult.url } : undefined,
          }, {
            claim: "Companies",
            value: String(secResult.value),
            source: secResult.url ? { name: "SEC EDGAR", url: secResult.url } : undefined,
          }],
          sourceUrl: secResult.url,
        })
      } else {
        evidence.push({
          title: "SEC Insider Filings",
          status: "not_found",
          confidence: "high",
          items: [{
            claim: "SEC Insider Status",
            value: "No Form 3/4/5 filings found - not an insider at public companies",
          }],
        })
      }

      // FEC Evidence Section
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
        evidence.push({
          title: "Political Contributions (FEC)",
          status: "verified",
          confidence: "high",
          items: [{
            claim: "Total Political Giving",
            value: String(fecResult.value),
            source: fecResult.url ? { name: "FEC.gov", url: fecResult.url } : undefined,
          }, {
            claim: "Number of Contributions",
            value: fecResult.indicator,
            source: fecResult.url ? { name: "FEC.gov", url: fecResult.url } : undefined,
          }],
          sourceUrl: fecResult.url,
        })
      } else {
        evidence.push({
          title: "Political Contributions (FEC)",
          status: "not_found",
          confidence: "high",
          items: [{
            claim: "Political Giving",
            value: "No FEC records found (contributions under $200 are not reported)",
          }],
        })
      }

      // Foundation Evidence Section
      if (foundationResult) {
        wealthIndicators.push(foundationResult)
        if (foundationResult.url) {
          sources.push({ name: "ProPublica Nonprofit Explorer", url: foundationResult.url })
        }
        evidence.push({
          title: "Foundation Affiliations (990 Data)",
          status: "verified",
          confidence: "high",
          items: [{
            claim: "Foundation Affiliation",
            value: foundationResult.indicator,
            source: foundationResult.url ? { name: "ProPublica 990", url: foundationResult.url } : undefined,
          }, {
            claim: "Foundation Assets",
            value: String(foundationResult.value),
            source: foundationResult.url ? { name: "ProPublica 990", url: foundationResult.url } : undefined,
          }],
          sourceUrl: foundationResult.url,
        })
      } else {
        evidence.push({
          title: "Foundation Affiliations (990 Data)",
          status: "not_found",
          confidence: "high",
          items: [{
            claim: "Foundation Affiliations",
            value: "No matching foundations found in ProPublica 990 database",
          }],
        })
      }

      // Wikidata Evidence Section
      if (wikidataResult) {
        wealthIndicators.push(wikidataResult)
        if (wikidataResult.url) {
          sources.push({ name: "Wikidata", url: wikidataResult.url })
        }
        evidence.push({
          title: "Biographical Data (Wikidata)",
          status: "verified",
          confidence: "medium", // Wikidata is community-edited
          items: [{
            claim: wikidataResult.indicator,
            value: String(wikidataResult.value),
            source: wikidataResult.url ? { name: "Wikidata", url: wikidataResult.url } : undefined,
          }],
          sourceUrl: wikidataResult.url,
        })
      } else {
        evidence.push({
          title: "Biographical Data (Wikidata)",
          status: "not_found",
          confidence: "medium",
          items: [{
            claim: "Wikidata Profile",
            value: "No matching profile found - may not be a notable public figure",
          }],
        })
      }

      // County Assessor Evidence Section (NEW)
      if (countyResult.indicator) {
        wealthIndicators.push(countyResult.indicator)
        if (countyResult.indicator.url) {
          sources.push({ name: `County Assessor (${countyResult.result?.county})`, url: countyResult.indicator.url })
        }
        evidence.push({
          title: "Real Estate Holdings (County Assessor)",
          status: "verified",
          confidence: "high", // Official government data
          items: [{
            claim: "Properties Owned",
            value: countyResult.indicator.indicator,
            source: countyResult.indicator.url ? { name: "County Assessor", url: countyResult.indicator.url } : undefined,
          }, {
            claim: "Total Property Value",
            value: String(countyResult.indicator.value),
            source: countyResult.indicator.url ? { name: "County Assessor", url: countyResult.indicator.url } : undefined,
          }],
          sourceUrl: countyResult.indicator.url,
        })
      } else {
        evidence.push({
          title: "Real Estate Holdings (County Assessor)",
          status: "not_found",
          confidence: "high",
          items: [{
            claim: "Property Records",
            value: "No properties found under this name in supported counties",
          }],
        })
      }

      // Voter Registration Evidence Section (NEW)
      if (voterResult.indicator && voterResult.result?.voterRecord) {
        // Don't add to wealthIndicators - voter data doesn't indicate wealth
        if (voterResult.indicator.url) {
          sources.push({ name: "Voter Registration", url: voterResult.indicator.url })
        }
        const voterRecord = voterResult.result.voterRecord
        // Map confidence level and determine status
        const voterConfidence: "high" | "medium" | "low" =
          voterResult.result.confidence === "inferred" ? "low" : voterResult.result.confidence
        const voterStatus: "verified" | "unverified" =
          voterResult.result.confidence === "high" ? "verified" : "unverified"

        evidence.push({
          title: "Voter Registration",
          status: voterStatus,
          confidence: voterConfidence,
          items: [{
            claim: "Party Affiliation",
            value: voterRecord.partyAffiliation || "Unknown",
            source: voterResult.indicator.url ? { name: "Voter Registration", url: voterResult.indicator.url } : undefined,
          }, {
            claim: "Registration Status",
            value: voterRecord.status === "active" ? "Active" : voterRecord.status === "inactive" ? "Inactive" : "Unknown",
            source: voterResult.indicator.url ? { name: "Voter Registration", url: voterResult.indicator.url } : undefined,
          }],
          sourceUrl: voterResult.indicator.url,
        })
      } else {
        evidence.push({
          title: "Voter Registration",
          status: "not_found",
          confidence: "medium",
          items: [{
            claim: "Voter Record",
            value: state ? `No voter record found in ${state}` : "State not provided - cannot search voter records",
          }],
        })
      }

      // Family/Household Evidence Section
      // Note: Family discovery tool was removed - always show "not found"
      // Use Perplexity's built-in web search for family member discovery
      evidence.push({
        title: "Family & Household",
        status: "not_found",
        confidence: "medium",
        items: [{
          claim: "Household Information",
          value: "Use built-in web search for family/household data",
        }],
      })
      // Mark familyResult as used to avoid unused variable warning
      void familyResult

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
      console.log("[ProspectProfile] Completed in", duration, "ms")

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
        evidence,
        rawContent,
        sources,
        dataQuality,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[ProspectProfile] Scoring failed:", errorMessage)

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
        evidence: [],
        rawContent: `# Prospect Profile: ${personName}\n\n**Error:** ${errorMessage}`,
        sources: [],
        error: errorMessage,
        dataQuality: "limited",
      }
    }
  },
})

/**
 * Check if prospect profile should be enabled
 * Works without FEC key (just won't include political contributions)
 */
export function shouldEnableProspectProfileTool(): boolean {
  return true // Always available, degrades gracefully
}

// Backwards compatibility aliases
export const prospectScoringTool = prospectProfileTool
export const shouldEnableProspectScoringTool = shouldEnableProspectProfileTool
