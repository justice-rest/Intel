/**
 * USAspending Awards Tool
 * Search for federal contracts, grants, and loans received by companies/organizations
 *
 * API is free and doesn't require API keys.
 * Docs: https://api.usaspending.gov/
 */

import { tool } from "ai"
import { z } from "zod"
import { US_GOV_API_URLS, US_GOV_DEFAULTS } from "@/lib/data-gov/config"

// ============================================================================
// TYPES
// ============================================================================

interface UsaspendingAward {
  Award_ID: string
  Recipient_Name: string
  Award_Amount: number
  Total_Outlays: number
  Description: string
  Award_Type: string
  Awarding_Agency: string
  Awarding_Sub_Agency: string
  Start_Date: string
  End_Date: string
  recipient_id: string
  prime_award_recipient_id: string
}

export interface UsaspendingResult {
  query: string
  results: UsaspendingAward[]
  totalCount: number
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// SCHEMA
// ============================================================================

const usaspendingSchema = z.object({
  query: z
    .string()
    .describe(
      "Company or organization name to search (e.g., 'Microsoft', 'Gates Foundation'). " +
        "NOT for individual/person names - use other tools for individuals."
    ),

  awardType: z
    .enum(["contracts", "idvs", "grants", "loans", "other_financial_assistance", "direct_payments", "all"])
    .optional()
    .default("all")
    .describe(
      "Type of federal award to search. " +
        "contracts: Purchase orders, delivery orders, definitive contracts. " +
        "idvs: Indefinite Delivery Vehicles (GWACs, IDCs, BPAs, etc). " +
        "grants: Block, formula, project grants and cooperative agreements. " +
        "loans: Direct and guaranteed/insured loans. " +
        "other_financial_assistance: Direct payments for specified/unrestricted use. " +
        "direct_payments: Insurance and other financial assistance. " +
        "all: Search all types (default)."
    ),

  agency: z
    .string()
    .optional()
    .describe("Filter by awarding agency name (optional)"),

  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum results (default: 10, max: 50)"),

  startDate: z
    .string()
    .optional()
    .describe("Start date filter (YYYY-MM-DD format)"),

  endDate: z
    .string()
    .optional()
    .describe("End date filter (YYYY-MM-DD format)"),
})

type UsaspendingParams = z.infer<typeof usaspendingSchema>

// ============================================================================
// HELPERS
// ============================================================================

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "N/A"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "N/A"

  if (Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(2)}T`
  if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
  if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
  if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A"
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

// ============================================================================
// AWARD TYPE GROUPS
// ============================================================================

/**
 * Award type code groups - USAspending API requires codes from only ONE group per request
 */
const AWARD_TYPE_GROUPS: Record<string, { codes: string[]; label: string }> = {
  contracts: {
    codes: ["A", "B", "C", "D"],
    label: "Contracts",
  },
  idvs: {
    codes: ["IDV_A", "IDV_B", "IDV_B_A", "IDV_B_B", "IDV_B_C", "IDV_C", "IDV_D", "IDV_E"],
    label: "Indefinite Delivery Vehicles",
  },
  grants: {
    codes: ["02", "03", "04", "05"],
    label: "Grants",
  },
  loans: {
    codes: ["07", "08"],
    label: "Loans",
  },
  other_financial_assistance: {
    codes: ["06", "10"],
    label: "Other Financial Assistance",
  },
  direct_payments: {
    codes: ["09", "11", "-1"],
    label: "Direct Payments",
  },
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Make a single USAspending API request for a specific award type group
 */
async function fetchUsaspendingByGroup(
  query: string,
  awardTypeCodes: string[],
  groupLabel: string,
  options: {
    agency?: string
    startDate?: string
    endDate?: string
    limit: number
  }
): Promise<{ awards: UsaspendingAward[]; total: number; error?: string }> {
  const { agency, startDate, endDate, limit } = options

  try {
    const requestBody: Record<string, unknown> = {
      filters: {
        recipient_search_text: [query],
        award_type_codes: awardTypeCodes,
        ...(agency && { agencies: [{ type: "awarding", tier: "toptier", name: agency }] }),
        ...(startDate && endDate && {
          time_period: [{ start_date: startDate, end_date: endDate }],
        }),
      },
      fields: [
        "Award ID",
        "Recipient Name",
        "Award Amount",
        "Total Outlays",
        "Description",
        "Award Type",
        "Awarding Agency",
        "Awarding Sub Agency",
        "Start Date",
        "End Date",
      ],
      page: 1,
      limit,
      sort: "Award Amount",
      order: "desc",
    }

    const response = await withTimeout(
      fetch(`${US_GOV_API_URLS.USASPENDING}/search/spending_by_award/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
      }),
      US_GOV_DEFAULTS.timeoutMs,
      `USAspending ${groupLabel} request timed out`
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[USAspending] ${groupLabel} API error:`, response.status, errorText)
      return { awards: [], total: 0, error: `${groupLabel}: ${response.status}` }
    }

    const data = await response.json()
    const awards: UsaspendingAward[] = data.results || []
    const total = data.page_metadata?.total || awards.length

    console.log(`[USAspending] ${groupLabel}: ${awards.length} awards (${total} total)`)
    return { awards, total }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`[USAspending] ${groupLabel} fetch failed:`, errorMessage)
    return { awards: [], total: 0, error: `${groupLabel}: ${errorMessage}` }
  }
}

async function searchUsaspending(params: UsaspendingParams): Promise<UsaspendingResult> {
  const { query, awardType, agency, limit, startDate, endDate } = params
  console.log("[USAspending] Searching for:", query, "type:", awardType)
  const startTime = Date.now()

  try {
    const requestLimit = Math.min(limit || US_GOV_DEFAULTS.limit, 50)
    const options = { agency, startDate, endDate, limit: requestLimit }

    let allAwards: UsaspendingAward[] = []
    let totalCount = 0
    const errors: string[] = []

    if (awardType === "all") {
      // Make parallel API calls to all groups
      console.log("[USAspending] Fetching all award types in parallel...")

      const groupPromises = Object.entries(AWARD_TYPE_GROUPS).map(([key, group]) =>
        fetchUsaspendingByGroup(query, group.codes, group.label, options)
      )

      const results = await Promise.all(groupPromises)

      // Merge results
      for (const result of results) {
        if (result.error) {
          errors.push(result.error)
        }
        allAwards.push(...result.awards)
        totalCount += result.total
      }

      // Sort merged results by Award Amount (descending) and take top N
      allAwards.sort((a, b) => (b.Award_Amount || 0) - (a.Award_Amount || 0))
      allAwards = allAwards.slice(0, requestLimit)
    } else {
      // Single group request
      const group = AWARD_TYPE_GROUPS[awardType]
      if (!group) {
        return {
          query,
          results: [],
          totalCount: 0,
          rawContent: `Unknown award type: ${awardType}. Valid types: ${Object.keys(AWARD_TYPE_GROUPS).join(", ")}, all`,
          sources: [],
          error: `Unknown award type: ${awardType}`,
        }
      }

      const result = await fetchUsaspendingByGroup(query, group.codes, group.label, options)
      allAwards = result.awards
      totalCount = result.total
      if (result.error) {
        errors.push(result.error)
      }
    }

    const duration = Date.now() - startTime
    console.log("[USAspending] Total:", allAwards.length, "awards retrieved in", duration, "ms")

    // If all requests failed, return error
    if (allAwards.length === 0 && errors.length > 0) {
      return {
        query,
        results: [],
        totalCount: 0,
        rawContent: `Failed to search USAspending for "${query}": ${errors.join("; ")}`,
        sources: [],
        error: errors.join("; "),
      }
    }

    // Calculate totals
    const totalAmount = allAwards.reduce((sum, a) => sum + (a.Award_Amount || 0), 0)

    // Group by award type for display
    const byType: Record<string, UsaspendingAward[]> = {}
    allAwards.forEach((a) => {
      const type = a.Award_Type || "Unknown"
      if (!byType[type]) byType[type] = []
      byType[type].push(a)
    })

    // Generate raw content for AI
    const lines: string[] = [
      `# USAspending: Federal Awards for "${query}"`,
      "",
      `**Total Awards Found:** ${totalCount.toLocaleString()}`,
      `**Total Award Amount:** ${formatCurrency(totalAmount)}`,
      `**Showing:** ${allAwards.length} results`,
    ]

    if (awardType === "all") {
      lines.push(`**Search Type:** All award types (parallel search across ${Object.keys(AWARD_TYPE_GROUPS).length} categories)`)
    }

    if (errors.length > 0) {
      lines.push(`**Partial Results:** Some categories had errors: ${errors.join("; ")}`)
    }

    lines.push("")
    lines.push("---")
    lines.push("")

    // Group by award type
    Object.entries(byType).forEach(([type, typeAwards]) => {
      const typeTotal = typeAwards.reduce((sum, a) => sum + (a.Award_Amount || 0), 0)
      lines.push(`## ${type} (${typeAwards.length} awards, ${formatCurrency(typeTotal)})`)
      lines.push("")

      typeAwards.forEach((award) => {
        lines.push(`### ${formatCurrency(award.Award_Amount)} - ${award.Awarding_Agency || "Unknown Agency"}`)
        lines.push(`- **Award ID:** ${award.Award_ID}`)
        lines.push(`- **Recipient:** ${award.Recipient_Name}`)
        lines.push(`- **Agency:** ${award.Awarding_Agency}${award.Awarding_Sub_Agency ? ` / ${award.Awarding_Sub_Agency}` : ""}`)
        if (award.Description) {
          lines.push(`- **Description:** ${award.Description.substring(0, 200)}${award.Description.length > 200 ? "..." : ""}`)
        }
        lines.push(`- **Period:** ${formatDate(award.Start_Date)} - ${formatDate(award.End_Date)}`)
        if (award.Total_Outlays) {
          lines.push(`- **Total Outlays:** ${formatCurrency(award.Total_Outlays)}`)
        }
        lines.push("")
      })
    })

    // Add prospect research summary
    lines.push("## Summary for Prospect Research")
    lines.push("")
    if (totalAmount >= 10000000) {
      lines.push("**Federal Funding Level:** HIGH - Major government contractor/grantee")
    } else if (totalAmount >= 1000000) {
      lines.push("**Federal Funding Level:** MODERATE - Significant federal funding recipient")
    } else if (totalAmount >= 100000) {
      lines.push("**Federal Funding Level:** EMERGING - Growing federal funding relationship")
    } else {
      lines.push("**Federal Funding Level:** LOW - Limited federal funding")
    }

    // Generate sources
    const sources: Array<{ name: string; url: string }> = [
      {
        name: `USAspending.gov - ${query}`,
        url: `https://www.usaspending.gov/search/?hash=${encodeURIComponent(query)}`,
      },
    ]

    return {
      query,
      results: allAwards,
      totalCount,
      rawContent: lines.join("\n"),
      sources,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[USAspending] Search failed:", errorMessage)
    return {
      query,
      results: [],
      totalCount: 0,
      rawContent: `Failed to search USAspending for "${query}": ${errorMessage}`,
      sources: [],
      error: errorMessage,
    }
  }
}

// ============================================================================
// MAIN TOOL
// ============================================================================

/**
 * USAspending Awards Tool
 * Search for federal contracts, grants, and loans by company/organization name
 */
export const usaspendingAwardsTool = tool({
  description:
    "Search USAspending.gov for federal contracts, grants, and loans received by companies and organizations. " +
    "Search by COMPANY or ORGANIZATION name (e.g., 'Microsoft', 'Gates Foundation', 'Lockheed Martin') to find government funding. " +
    "NOT for individual donor wealth research - for individuals use perplexity_prospect_research, FEC contributions, SEC Edgar, or ProPublica nonprofits instead.",
  inputSchema: usaspendingSchema,
  execute: async (params: UsaspendingParams): Promise<UsaspendingResult> => {
    console.log("[USAspending] Request:", params.query)
    return await searchUsaspending(params)
  },
})

// Keep old export name for backwards compatibility during migration
export const usGovDataTool = usaspendingAwardsTool

/**
 * Check if USAspending tool should be enabled
 * Always returns true since the API doesn't require API keys
 */
export function shouldEnableUsGovDataTools(): boolean {
  return true
}
