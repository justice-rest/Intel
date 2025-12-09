/**
 * Giving History Aggregator Tool
 *
 * Aggregates all known giving data for a prospect from multiple sources:
 * - FEC political contributions
 * - Foundation grants (from 990-PF filings)
 * - Major gifts disclosed publicly
 * - PAC contributions
 *
 * This is a core feature of DonorSearch - they emphasize that past giving
 * is the best predictor of future giving. This tool provides that same
 * insight for FREE.
 *
 * Competitors charge premium for giving history:
 * - DonorSearch: Included in $1,200+/year subscription
 * - iWave: Part of $4,150+/year subscription
 * - WealthEngine: Enterprise pricing required
 */

import { tool } from "ai"
import { z } from "zod"
import { LinkupClient } from "linkup-sdk"
import { getLinkupApiKey, isLinkupEnabled } from "@/lib/linkup/config"

// ============================================================================
// CONSTANTS
// ============================================================================

const FEC_API_BASE = "https://api.open.fec.gov/v1"
const PROPUBLICA_API_BASE = "https://projects.propublica.org/nonprofits/api/v2"
const TIMEOUT_MS = 30000

// ============================================================================
// SCHEMAS
// ============================================================================

const givingHistorySchema = z.object({
  personName: z
    .string()
    .describe("Full name of the donor to research (e.g., 'Michael Bloomberg', 'MacKenzie Scott')"),
  state: z
    .string()
    .optional()
    .describe("Two-letter state code to help disambiguate (e.g., 'NY', 'CA')"),
  includeFoundationGiving: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include foundation/990-PF giving data"),
  includePoliticalGiving: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include FEC political contribution data"),
})

// ============================================================================
// TYPES
// ============================================================================

interface GivingRecord {
  type: "political" | "foundation" | "major_gift" | "pac" | "other"
  amount: number
  recipient: string
  recipientType: string
  date?: string
  year?: number
  source: string
  sourceUrl?: string
  notes?: string
}

interface GivingSummary {
  totalGiving: number
  totalPolitical: number
  totalPhilanthropic: number
  giftCount: number
  averageGift: number
  largestGift: number
  yearsActive: string
  primaryCauses: string[]
  givingTrend: "increasing" | "stable" | "decreasing" | "unknown"
}

export interface GivingHistoryResult {
  personName: string
  summary: GivingSummary
  givingRecords: GivingRecord[]
  givingByYear: Record<string, { total: number; count: number }>
  givingByType: Record<string, { total: number; count: number }>
  wealthIndicator: string
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
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
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}

// formatEin available for future use with EIN data
// function formatEin(ein: string | number): string {
//   const einStr = String(ein).replace(/-/g, "").padStart(9, "0")
//   return `${einStr.slice(0, 2)}-${einStr.slice(2)}`
// }

// ============================================================================
// DATA FETCHERS
// ============================================================================

/**
 * Fetch FEC political contributions
 */
async function fetchFecGiving(personName: string, state?: string): Promise<GivingRecord[]> {
  const records: GivingRecord[] = []
  const apiKey = process.env.FEC_API_KEY

  if (!apiKey) {
    console.log("[GivingHistory] FEC_API_KEY not configured")
    return records
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      contributor_name: personName,
      per_page: "100",
      sort: "-contribution_receipt_date",
    })

    if (state) {
      params.append("contributor_state", state.toUpperCase())
    }

    const url = `${FEC_API_BASE}/schedules/schedule_a/?${params.toString()}`

    const response = await withTimeout(
      fetch(url, { headers: { Accept: "application/json" } }),
      15000,
      "FEC API timeout"
    )

    if (!response.ok) return records

    const data = await response.json()
    const contributions = data.results || []

    for (const c of contributions) {
      records.push({
        type: "political",
        amount: c.contribution_receipt_amount || 0,
        recipient: c.committee_name || "Unknown Committee",
        recipientType: c.candidate_name ? "Candidate Committee" : "PAC/Political Committee",
        date: c.contribution_receipt_date,
        year: c.contribution_receipt_date
          ? parseInt(c.contribution_receipt_date.substring(0, 4))
          : undefined,
        source: "FEC",
        sourceUrl: c.pdf_url || undefined,
        notes: c.candidate_name ? `Supporting ${c.candidate_name}` : undefined,
      })
    }

    return records
  } catch (error) {
    console.error("[GivingHistory] FEC fetch failed:", error)
    return records
  }
}

/**
 * Search for foundation giving by looking at 990-PF filings of foundations
 * that may belong to or be controlled by the person
 */
async function fetchFoundationGiving(personName: string): Promise<GivingRecord[]> {
  const records: GivingRecord[] = []

  try {
    const lastName = personName.split(" ").pop() || personName
    const firstName = personName.split(" ")[0] || ""

    // Search for foundations with person's name
    const searchTerms = [
      `${lastName} Foundation`,
      `${lastName} Family Foundation`,
      `${firstName} ${lastName} Foundation`,
    ]

    for (const term of searchTerms) {
      const url = `${PROPUBLICA_API_BASE}/search.json?q=${encodeURIComponent(term)}`

      const response = await withTimeout(
        fetch(url, { headers: { Accept: "application/json" } }),
        10000,
        "ProPublica search timeout"
      )

      if (!response.ok) continue

      const data = await response.json()
      const orgs = data.organizations || []

      for (const org of orgs.slice(0, 3)) {
        // Check if foundation matches person's name
        if (!org.name.toLowerCase().includes(lastName.toLowerCase())) continue
        if (org.subseccd !== 3) continue // Only 501(c)(3) private foundations

        // Get filing details
        try {
          const detailsUrl = `${PROPUBLICA_API_BASE}/organizations/${org.ein}.json`
          const detailsRes = await fetch(detailsUrl)

          if (detailsRes.ok) {
            const details = await detailsRes.json()

            // Each year's 990 shows grants paid
            for (const filing of (details.filings_with_data || []).slice(0, 5)) {
              // totfuncexpns is total functional expenses which includes grants
              // For private foundations, most expenses are grants
              const year = filing.tax_prd_yr
              const expenses = filing.totfuncexpns || 0

              if (expenses > 0) {
                records.push({
                  type: "foundation",
                  amount: expenses,
                  recipient: "Various Grantees",
                  recipientType: "Foundation Grants",
                  year,
                  source: "ProPublica 990-PF",
                  sourceUrl: filing.pdf_url || `https://projects.propublica.org/nonprofits/organizations/${org.ein}`,
                  notes: `Annual grants from ${org.name}`,
                })
              }
            }
          }
        } catch {
          // Continue
        }
      }
    }

    return records
  } catch (error) {
    console.error("[GivingHistory] Foundation fetch failed:", error)
    return records
  }
}

/**
 * Search web for major gift announcements
 */
async function searchMajorGiftAnnouncements(personName: string): Promise<GivingRecord[]> {
  const records: GivingRecord[] = []

  if (!isLinkupEnabled()) return records

  try {
    const client = new LinkupClient({ apiKey: getLinkupApiKey() })

    const query = `"${personName}" donated OR pledged OR gave million OR billion philanthropy announcement`

    const result = await withTimeout(
      client.search({
        query,
        depth: "standard",
        outputType: "sourcedAnswer",
      }),
      TIMEOUT_MS,
      "Web search timeout"
    )

    const answer = result.answer || ""

    // Extract donation amounts and recipients from the answer
    // Look for patterns like "$X million to [org]", "donated $X to", "pledged $X million"
    const patterns = [
      /(?:donated|gave|pledged|contributed)\s+\$?([\d,.]+)\s*(million|billion|M|B)?\s+(?:to|for)\s+(?:the\s+)?([A-Z][a-zA-Z\s&'-]+?)(?:\.|,|\s+in|\s+for|\s+to)/gi,
      /\$?([\d,.]+)\s*(million|billion|M|B)\s+(?:gift|donation|pledge)\s+(?:to|for)\s+(?:the\s+)?([A-Z][a-zA-Z\s&'-]+?)(?:\.|,)/gi,
    ]

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(answer)) !== null) {
        const amountStr = match[1].replace(/,/g, "")
        const multiplier = match[2]
        const recipient = match[3].trim()

        let amount = parseFloat(amountStr)

        // Apply multiplier
        if (multiplier) {
          const m = multiplier.toLowerCase()
          if (m === "billion" || m === "b") amount *= 1e9
          else if (m === "million" || m === "m") amount *= 1e6
        }

        // Only include substantial gifts
        if (amount >= 100000 && recipient.length > 3) {
          records.push({
            type: "major_gift",
            amount,
            recipient,
            recipientType: "Charitable Organization",
            source: "News/Web",
            notes: "Publicly announced gift",
          })
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>()
    return records.filter((r) => {
      const key = `${r.recipient.toLowerCase()}-${r.amount}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  } catch (error) {
    console.error("[GivingHistory] Web search failed:", error)
    return records
  }
}

/**
 * Calculate giving summary and trends
 */
function calculateGivingSummary(records: GivingRecord[]): GivingSummary {
  if (records.length === 0) {
    return {
      totalGiving: 0,
      totalPolitical: 0,
      totalPhilanthropic: 0,
      giftCount: 0,
      averageGift: 0,
      largestGift: 0,
      yearsActive: "None",
      primaryCauses: [],
      givingTrend: "unknown",
    }
  }

  const totalGiving = records.reduce((sum, r) => sum + r.amount, 0)
  const totalPolitical = records
    .filter((r) => r.type === "political")
    .reduce((sum, r) => sum + r.amount, 0)
  const totalPhilanthropic = totalGiving - totalPolitical

  const amounts = records.map((r) => r.amount)
  const largestGift = Math.max(...amounts)
  const averageGift = totalGiving / records.length

  // Get years
  const years = records.map((r) => r.year).filter((y): y is number => !!y)
  const minYear = years.length > 0 ? Math.min(...years) : 0
  const maxYear = years.length > 0 ? Math.max(...years) : 0
  const yearsActive = minYear && maxYear ? `${minYear}-${maxYear}` : "Unknown"

  // Determine primary causes from recipients
  const recipientTypes = new Map<string, number>()
  for (const r of records) {
    const type = r.recipientType
    recipientTypes.set(type, (recipientTypes.get(type) || 0) + r.amount)
  }

  const primaryCauses = Array.from(recipientTypes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type)

  // Calculate giving trend
  let givingTrend: GivingSummary["givingTrend"] = "unknown"
  if (years.length >= 3) {
    const recentYears = years.filter((y) => y >= maxYear - 2)
    const olderYears = years.filter((y) => y < maxYear - 2)

    const recentTotal = records
      .filter((r) => r.year && r.year >= maxYear - 2)
      .reduce((sum, r) => sum + r.amount, 0)
    const olderTotal = records
      .filter((r) => r.year && r.year < maxYear - 2)
      .reduce((sum, r) => sum + r.amount, 0)

    const recentAvg = recentYears.length > 0 ? recentTotal / recentYears.length : 0
    const olderAvg = olderYears.length > 0 ? olderTotal / olderYears.length : 0

    if (olderAvg > 0) {
      const change = (recentAvg - olderAvg) / olderAvg
      if (change > 0.2) givingTrend = "increasing"
      else if (change < -0.2) givingTrend = "decreasing"
      else givingTrend = "stable"
    }
  }

  return {
    totalGiving,
    totalPolitical,
    totalPhilanthropic,
    giftCount: records.length,
    averageGift,
    largestGift,
    yearsActive,
    primaryCauses,
    givingTrend,
  }
}

/**
 * Calculate wealth indicator from giving patterns
 */
function calculateWealthIndicator(summary: GivingSummary): string {
  if (summary.largestGift >= 10000000) {
    return "ULTRA HIGH NET WORTH - Major gift capacity in 8+ figures"
  }
  if (summary.largestGift >= 1000000) {
    return "VERY HIGH NET WORTH - Major gift capacity in 7 figures"
  }
  if (summary.totalGiving >= 500000) {
    return "HIGH NET WORTH - Significant cumulative giving suggests substantial wealth"
  }
  if (summary.totalGiving >= 100000) {
    return "AFFLUENT - Regular significant giving indicates strong financial position"
  }
  if (summary.totalGiving >= 25000) {
    return "UPPER MIDDLE CLASS - Consistent giving indicates discretionary income"
  }
  if (summary.totalGiving > 0) {
    return "ENGAGED DONOR - Active giving history, capacity under review"
  }
  return "UNKNOWN - No public giving records found"
}

/**
 * Format giving history for AI consumption
 */
function formatGivingHistoryForAI(
  personName: string,
  summary: GivingSummary,
  records: GivingRecord[],
  givingByYear: Record<string, { total: number; count: number }>,
  wealthIndicator: string
): string {
  const lines: string[] = [
    `# Giving History: ${personName}`,
    "",
    `## Summary`,
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| **Total Known Giving** | ${formatCurrency(summary.totalGiving)} |`,
    `| **Philanthropic Giving** | ${formatCurrency(summary.totalPhilanthropic)} |`,
    `| **Political Giving** | ${formatCurrency(summary.totalPolitical)} |`,
    `| **Gift Count** | ${summary.giftCount} |`,
    `| **Average Gift** | ${formatCurrency(summary.averageGift)} |`,
    `| **Largest Gift** | ${formatCurrency(summary.largestGift)} |`,
    `| **Years Active** | ${summary.yearsActive} |`,
    `| **Giving Trend** | ${summary.givingTrend.charAt(0).toUpperCase() + summary.givingTrend.slice(1)} |`,
    "",
    `### Wealth Indicator`,
    `**${wealthIndicator}**`,
    "",
    "---",
    "",
  ]

  // Giving by year
  const sortedYears = Object.keys(givingByYear).sort((a, b) => parseInt(b) - parseInt(a))

  if (sortedYears.length > 0) {
    lines.push(`## Giving by Year`)
    lines.push("")
    lines.push(`| Year | Total | Gifts |`)
    lines.push(`|------|-------|-------|`)

    for (const year of sortedYears.slice(0, 10)) {
      const data = givingByYear[year]
      lines.push(`| ${year} | ${formatCurrency(data.total)} | ${data.count} |`)
    }

    lines.push("")
    lines.push("---")
    lines.push("")
  }

  // Top gifts
  const sortedRecords = [...records].sort((a, b) => b.amount - a.amount)

  if (sortedRecords.length > 0) {
    lines.push(`## Top Gifts`)
    lines.push("")

    for (const record of sortedRecords.slice(0, 10)) {
      lines.push(`### ${formatCurrency(record.amount)} - ${record.recipient}`)
      lines.push(`- **Type:** ${record.type.charAt(0).toUpperCase() + record.type.slice(1)}`)
      lines.push(`- **Recipient Type:** ${record.recipientType}`)
      if (record.year) lines.push(`- **Year:** ${record.year}`)
      if (record.notes) lines.push(`- **Notes:** ${record.notes}`)
      lines.push(`- **Source:** ${record.source}`)
      lines.push("")
    }
  }

  // Primary causes
  if (summary.primaryCauses.length > 0) {
    lines.push("---")
    lines.push("")
    lines.push(`## Primary Giving Areas`)
    lines.push("")
    for (const cause of summary.primaryCauses) {
      lines.push(`- ${cause}`)
    }
    lines.push("")
  }

  // DonorSearch competitor callout
  lines.push("---")
  lines.push("")
  lines.push("## About This Report")
  lines.push("")
  lines.push("This giving history aggregates data from:")
  lines.push("- FEC (Federal Election Commission) - Political contributions over $200")
  lines.push("- ProPublica 990-PF - Private foundation grants")
  lines.push("- Public announcements - Major gift disclosures")
  lines.push("")
  lines.push("**DonorSearch emphasizes:** Past giving is the best predictor of future giving.")
  lines.push("This report provides the same insight for FREE.")
  lines.push("")
  lines.push("*This is a free alternative to DonorSearch, iWave, and WealthEngine giving history reports.*")

  return lines.join("\n")
}

// ============================================================================
// TOOL
// ============================================================================

export const givingHistoryTool = tool({
  description:
    "COMPREHENSIVE GIVING HISTORY - Aggregates all known philanthropic and political giving for a prospect. " +
    "DonorSearch emphasizes 'past giving is the best predictor of future giving' - this tool provides " +
    "the same insight for FREE. Combines: FEC political contributions, foundation 990-PF grants, " +
    "and major gift announcements. Returns total giving, giving trends, primary causes, and wealth indicators. " +
    "Essential for major gift cultivation and identifying high-capacity donors.",
  parameters: givingHistorySchema,
  execute: async ({
    personName,
    state,
    includeFoundationGiving = true,
    includePoliticalGiving = true,
  }): Promise<GivingHistoryResult> => {
    console.log("[GivingHistory] Researching:", personName)
    const startTime = Date.now()

    const sources: Array<{ name: string; url: string }> = []
    const allRecords: GivingRecord[] = []

    try {
      // Parallel data fetching
      const promises: Promise<GivingRecord[]>[] = []

      if (includePoliticalGiving) {
        promises.push(fetchFecGiving(personName, state))
      }

      if (includeFoundationGiving) {
        promises.push(fetchFoundationGiving(personName))
      }

      // Always search for major gift announcements
      promises.push(searchMajorGiftAnnouncements(personName))

      const results = await Promise.all(promises)

      for (const records of results) {
        allRecords.push(...records)
      }

      // Calculate giving by year
      const givingByYear: Record<string, { total: number; count: number }> = {}
      for (const record of allRecords) {
        if (record.year) {
          const yearStr = String(record.year)
          if (!givingByYear[yearStr]) {
            givingByYear[yearStr] = { total: 0, count: 0 }
          }
          givingByYear[yearStr].total += record.amount
          givingByYear[yearStr].count += 1
        }
      }

      // Calculate giving by type
      const givingByType: Record<string, { total: number; count: number }> = {}
      for (const record of allRecords) {
        if (!givingByType[record.type]) {
          givingByType[record.type] = { total: 0, count: 0 }
        }
        givingByType[record.type].total += record.amount
        givingByType[record.type].count += 1
      }

      // Calculate summary
      const summary = calculateGivingSummary(allRecords)

      // Calculate wealth indicator
      const wealthIndicator = calculateWealthIndicator(summary)

      // Collect sources
      if (includePoliticalGiving && process.env.FEC_API_KEY) {
        sources.push({
          name: "FEC.gov",
          url: `https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=${encodeURIComponent(personName)}`,
        })
      }

      if (includeFoundationGiving) {
        const lastName = personName.split(" ").pop() || personName
        sources.push({
          name: "ProPublica Nonprofit Explorer",
          url: `https://projects.propublica.org/nonprofits/search?q=${encodeURIComponent(lastName + " Foundation")}`,
        })
      }

      // Add unique source URLs from records
      for (const record of allRecords) {
        if (record.sourceUrl && !sources.some((s) => s.url === record.sourceUrl)) {
          sources.push({
            name: record.source,
            url: record.sourceUrl,
          })
        }
      }

      const rawContent = formatGivingHistoryForAI(
        personName,
        summary,
        allRecords,
        givingByYear,
        wealthIndicator
      )

      const duration = Date.now() - startTime
      console.log(
        "[GivingHistory] Found",
        allRecords.length,
        "giving records in",
        duration,
        "ms"
      )

      return {
        personName,
        summary,
        givingRecords: allRecords,
        givingByYear,
        givingByType,
        wealthIndicator,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[GivingHistory] Search failed:", errorMessage)

      return {
        personName,
        summary: {
          totalGiving: 0,
          totalPolitical: 0,
          totalPhilanthropic: 0,
          giftCount: 0,
          averageGift: 0,
          largestGift: 0,
          yearsActive: "Unknown",
          primaryCauses: [],
          givingTrend: "unknown",
        },
        givingRecords: [],
        givingByYear: {},
        givingByType: {},
        wealthIndicator: "Unable to determine",
        rawContent: `# Giving History: ${personName}\n\n**Error:** ${errorMessage}`,
        sources: [],
        error: errorMessage,
      }
    }
  },
})

/**
 * Check if giving history tool should be enabled
 */
export function shouldEnableGivingHistoryTool(): boolean {
  return true // Always available, degrades gracefully without FEC key
}
