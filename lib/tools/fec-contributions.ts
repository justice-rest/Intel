/**
 * FEC (Federal Election Commission) Contributions Tool
 * Provides access to political contribution data for prospect research
 *
 * Uses OpenFEC API - https://api.open.fec.gov/developers/
 * Requires FEC_API_KEY from https://api.data.gov/signup/
 */

import { tool } from "ai"
import { z } from "zod"
import {
  isFecEnabled,
  getFecApiKey,
  FEC_API_BASE_URL,
  FEC_DEFAULTS,
} from "@/lib/fec/config"

// ============================================================================
// TYPES
// ============================================================================

interface FecContribution {
  contribution_receipt_amount: number
  contribution_receipt_date: string
  contributor_name: string
  contributor_city: string
  contributor_state: string
  contributor_zip: string
  contributor_employer: string
  contributor_occupation: string
  committee_name: string
  committee_id: string
  candidate_name: string | null
  candidate_id: string | null
  receipt_type_full: string
  memo_text: string | null
  pdf_url: string | null
}

interface FecApiResponse {
  results: FecContribution[]
  pagination: {
    count: number
    page: number
    pages: number
    per_page: number
    last_indexes: Record<string, string | number> | null
  }
}

export interface FecContributionResult {
  contributorName: string
  totalContributions: number
  totalAmount: number
  contributions: Array<{
    amount: number
    date: string
    recipientCommittee: string
    recipientCandidate: string | null
    contributorEmployer: string
    contributorOccupation: string
    contributorLocation: string
    receiptType: string
    sourceUrl: string | null
  }>
  // Raw content for AI analysis (formatted text)
  rawContent: string
  // Sources for UI display
  sources: Array<{
    name: string
    url: string
  }>
  error?: string
}

// ============================================================================
// SCHEMAS
// ============================================================================

const fecContributionsSchema = z.object({
  contributorName: z
    .string()
    .describe("Name of the contributor to search for (e.g., 'John Smith', 'Jane Doe')"),
  contributorState: z
    .string()
    .optional()
    .describe("Two-letter state code to filter by (e.g., 'CA', 'NY', 'TX')"),
  contributorCity: z
    .string()
    .optional()
    .describe("City to filter by"),
  contributorEmployer: z
    .string()
    .optional()
    .describe("Employer name to filter by"),
  minAmount: z
    .number()
    .optional()
    .describe("Minimum contribution amount in dollars"),
  maxAmount: z
    .number()
    .optional()
    .describe("Maximum contribution amount in dollars"),
  limit: z
    .number()
    .optional()
    .default(20)
    .describe("Maximum number of contributions to return (default: 20, max: 100)"),
})

// ============================================================================
// TIMEOUT HELPER
// ============================================================================

const FEC_TIMEOUT_MS = 30000 // 30 seconds

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return dateStr
  }
}

/**
 * Format contributions for AI analysis
 */
function formatContributionsForAI(
  contributions: FecContribution[],
  contributorName: string,
  totalAmount: number
): string {
  const lines: string[] = [
    `# FEC Political Contributions: ${contributorName}`,
    "",
    `**Total Contributions Found:** ${contributions.length}`,
    `**Total Amount:** ${formatCurrency(totalAmount)}`,
    "",
    "---",
    "",
  ]

  // Group by year for better analysis
  const byYear: Record<string, FecContribution[]> = {}
  contributions.forEach((c) => {
    const year = c.contribution_receipt_date?.substring(0, 4) || "Unknown"
    if (!byYear[year]) byYear[year] = []
    byYear[year].push(c)
  })

  // Sort years descending
  const sortedYears = Object.keys(byYear).sort((a, b) => b.localeCompare(a))

  sortedYears.forEach((year) => {
    const yearContributions = byYear[year]
    const yearTotal = yearContributions.reduce(
      (sum, c) => sum + (c.contribution_receipt_amount || 0),
      0
    )

    lines.push(`## ${year} (${yearContributions.length} contributions, ${formatCurrency(yearTotal)})`)
    lines.push("")

    yearContributions.forEach((c) => {
      lines.push(`### ${formatCurrency(c.contribution_receipt_amount)} - ${formatDate(c.contribution_receipt_date)}`)
      lines.push(`- **To:** ${c.committee_name}${c.candidate_name ? ` (${c.candidate_name})` : ""}`)
      lines.push(`- **From:** ${c.contributor_name}`)
      lines.push(`- **Location:** ${c.contributor_city}, ${c.contributor_state} ${c.contributor_zip}`)
      if (c.contributor_employer) {
        lines.push(`- **Employer:** ${c.contributor_employer}`)
      }
      if (c.contributor_occupation) {
        lines.push(`- **Occupation:** ${c.contributor_occupation}`)
      }
      lines.push(`- **Type:** ${c.receipt_type_full}`)
      if (c.memo_text) {
        lines.push(`- **Memo:** ${c.memo_text}`)
      }
      lines.push("")
    })

    lines.push("---")
    lines.push("")
  })

  // Add summary for prospect research
  lines.push("## Summary for Prospect Research")
  lines.push("")

  // Calculate giving patterns
  const avgContribution = contributions.length > 0 ? totalAmount / contributions.length : 0
  const maxContribution = Math.max(...contributions.map((c) => c.contribution_receipt_amount || 0))

  // Get unique committees/candidates
  const uniqueCommittees = new Set(contributions.map((c) => c.committee_name))
  const uniqueCandidates = new Set(
    contributions.filter((c) => c.candidate_name).map((c) => c.candidate_name)
  )

  lines.push(`- **Average Contribution:** ${formatCurrency(avgContribution)}`)
  lines.push(`- **Largest Contribution:** ${formatCurrency(maxContribution)}`)
  lines.push(`- **Unique Recipients:** ${uniqueCommittees.size} committees, ${uniqueCandidates.size} candidates`)
  lines.push(`- **Years Active:** ${sortedYears.join(", ")}`)
  lines.push("")

  // Wealth indicator
  if (totalAmount >= 50000) {
    lines.push("**Wealth Indicator:** HIGH - Significant political giving suggests substantial disposable income")
  } else if (totalAmount >= 10000) {
    lines.push("**Wealth Indicator:** MODERATE - Regular political contributor with discretionary giving capacity")
  } else if (totalAmount >= 1000) {
    lines.push("**Wealth Indicator:** EMERGING - Active political participant with some giving capacity")
  }

  return lines.join("\n")
}

// ============================================================================
// TOOLS
// ============================================================================

/**
 * Search FEC for individual political contributions
 */
export const fecContributionsTool = tool({
  description:
    "Search FEC (Federal Election Commission) records for political contributions by an individual. " +
    "Returns detailed contribution history including amounts, dates, recipients (candidates/committees), " +
    "employer, and occupation. Essential for prospect research - political giving patterns indicate " +
    "wealth, civic engagement, and philanthropic capacity. Contributions over $200 are publicly reported.",
  parameters: fecContributionsSchema,
  execute: async ({
    contributorName,
    contributorState,
    contributorCity,
    contributorEmployer,
    minAmount,
    maxAmount,
    limit = 20,
  }): Promise<FecContributionResult> => {
    console.log("[FEC] Searching contributions for:", contributorName)
    const startTime = Date.now()

    // Check if FEC is enabled
    if (!isFecEnabled()) {
      return {
        contributorName,
        totalContributions: 0,
        totalAmount: 0,
        contributions: [],
        rawContent: "FEC API is not configured. Please add FEC_API_KEY to your environment variables.",
        sources: [],
        error: "FEC_API_KEY not configured",
      }
    }

    try {
      const apiKey = getFecApiKey()

      // Build query parameters
      const params = new URLSearchParams({
        api_key: apiKey,
        contributor_name: contributorName,
        per_page: Math.min(limit, 100).toString(),
        sort: "-contribution_receipt_date",
        sort_nulls_last: "true",
      })

      if (contributorState) {
        params.append("contributor_state", contributorState.toUpperCase())
      }
      if (contributorCity) {
        params.append("contributor_city", contributorCity)
      }
      if (contributorEmployer) {
        params.append("contributor_employer", contributorEmployer)
      }
      if (minAmount !== undefined) {
        params.append("min_amount", minAmount.toString())
      }
      if (maxAmount !== undefined) {
        params.append("max_amount", maxAmount.toString())
      }

      const url = `${FEC_API_BASE_URL}/schedules/schedule_a/?${params.toString()}`

      const response = await withTimeout(
        fetch(url, {
          headers: {
            Accept: "application/json",
          },
        }),
        FEC_TIMEOUT_MS,
        `FEC API request timed out after ${FEC_TIMEOUT_MS / 1000} seconds`
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`FEC API error: ${response.status} - ${errorText}`)
      }

      const data: FecApiResponse = await response.json()

      const duration = Date.now() - startTime
      console.log("[FEC] Retrieved", data.results?.length || 0, "contributions in", duration, "ms")

      const contributions = data.results || []
      const totalAmount = contributions.reduce(
        (sum, c) => sum + (c.contribution_receipt_amount || 0),
        0
      )

      // Format contributions for structured output
      const formattedContributions = contributions.map((c) => ({
        amount: c.contribution_receipt_amount,
        date: c.contribution_receipt_date,
        recipientCommittee: c.committee_name,
        recipientCandidate: c.candidate_name,
        contributorEmployer: c.contributor_employer,
        contributorOccupation: c.contributor_occupation,
        contributorLocation: `${c.contributor_city}, ${c.contributor_state} ${c.contributor_zip}`,
        receiptType: c.receipt_type_full,
        sourceUrl: c.pdf_url,
      }))

      // Generate sources for UI display
      const sources: Array<{ name: string; url: string }> = [
        {
          name: `FEC.gov - ${contributorName} Contributions`,
          url: `https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=${encodeURIComponent(contributorName)}`,
        },
      ]

      // Add unique PDF sources
      const pdfUrls = new Set(contributions.map((c) => c.pdf_url).filter(Boolean))
      pdfUrls.forEach((pdfUrl) => {
        if (pdfUrl) {
          sources.push({
            name: "FEC Filing PDF",
            url: pdfUrl,
          })
        }
      })

      // Generate raw content for AI analysis
      const rawContent =
        contributions.length > 0
          ? formatContributionsForAI(contributions, contributorName, totalAmount)
          : `No FEC contribution records found for "${contributorName}". This could mean:\n` +
            "- The person has not made reportable political contributions (over $200)\n" +
            "- The name spelling may be different in FEC records\n" +
            "- Try adding state or employer to narrow the search"

      return {
        contributorName,
        totalContributions: contributions.length,
        totalAmount,
        contributions: formattedContributions,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[FEC] Search failed:", errorMessage)
      return {
        contributorName,
        totalContributions: 0,
        totalAmount: 0,
        contributions: [],
        rawContent: `Failed to search FEC contributions for "${contributorName}": ${errorMessage}`,
        sources: [],
        error: `Failed to search FEC: ${errorMessage}`,
      }
    }
  },
})

/**
 * Check if FEC tools should be enabled
 */
export function shouldEnableFecTools(): boolean {
  return isFecEnabled()
}
