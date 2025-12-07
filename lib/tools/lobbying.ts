/**
 * Lobbying Disclosure Tool
 * Provides access to federal lobbying disclosures (LDA filings)
 *
 * Uses Senate LDA API - https://lda.senate.gov/api/
 * COMPLETELY FREE - no API key required
 *
 * Data includes:
 * - Lobbying registrations and activity reports
 * - Lobbyist names and their clients
 * - Issues being lobbied on
 * - Agencies/Congress lobbied
 * - Lobbying income/expenses
 */

import { tool } from "ai"
import { z } from "zod"
import {
  isLobbyingEnabled,
  SENATE_LDA_BASE_URL,
  CONGRESS_DEFAULTS,
} from "@/lib/congress/config"

// ============================================================================
// TYPES
// ============================================================================

interface LobbyistData {
  id: number
  prefix: string | null
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  lobbyist_registrant: number
  covered_position: string | null
}

interface ClientData {
  id: number
  name: string
  general_description: string | null
  client_government_entity: boolean
  client_self_filer: boolean
  state: string | null
  country: string | null
}

interface RegistrantData {
  id: number
  name: string
  description: string | null
  address_1: string | null
  address_2: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string | null
}

interface FilingData {
  filing_uuid: string
  filing_type: string
  filing_type_display: string
  filing_year: number
  filing_period: string
  filing_period_display: string
  filing_document_url: string
  filing_document_content_type: string
  income: string | null
  expenses: string | null
  registrant: RegistrantData
  client: ClientData
  lobbyists: LobbyistData[]
  lobbying_activities: Array<{
    general_issue_code: string
    general_issue_code_display: string
    description: string | null
    government_entities: Array<{
      id: number
      name: string
    }>
  }>
  conviction_disclosures: unknown[]
  foreign_entities: unknown[]
  affiliated_organizations: unknown[]
  dt_posted: string
}

interface LobbyingSearchResponse {
  count: number
  next: string | null
  previous: string | null
  results: FilingData[]
}

export interface LobbyingSearchResult {
  query: string
  totalFilings: number
  filings: Array<{
    filingId: string
    filingType: string
    filingYear: number
    filingPeriod: string
    registrantName: string
    registrantAddress: string | null
    clientName: string
    clientDescription: string | null
    clientLocation: string | null
    income: number | null
    expenses: number | null
    lobbyists: Array<{
      name: string
      coveredPosition: string | null
    }>
    issues: Array<{
      code: string
      description: string | null
      governmentEntities: string[]
    }>
    documentUrl: string
    datePosted: string
  }>
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// SCHEMAS
// ============================================================================

const lobbyingSearchSchema = z.object({
  searchTerm: z
    .string()
    .describe("Name of lobbyist, lobbying firm, or client to search for"),
  searchType: z
    .enum(["registrant", "client", "lobbyist"])
    .optional()
    .default("registrant")
    .describe("Type of entity to search: 'registrant' (lobbying firm), 'client' (who hired them), or 'lobbyist' (individual)"),
  filingYear: z
    .number()
    .optional()
    .describe("Filter by filing year (e.g., 2024, 2023)"),
  limit: z
    .number()
    .optional()
    .default(20)
    .describe("Maximum number of filings to return (default: 20, max: 50)"),
})

// ============================================================================
// TIMEOUT HELPER
// ============================================================================

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

function formatCurrency(amount: number | null): string {
  if (amount === null) return "Not Reported"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatLobbyingForAI(
  filings: LobbyingSearchResult["filings"],
  query: string,
  searchType: string
): string {
  if (filings.length === 0) {
    return `No lobbying disclosures found for "${query}" (searched as ${searchType}).\n\nThis search covers federal lobbying registrations and activity reports filed with the Senate Office of Public Records under the Lobbying Disclosure Act (LDA).`
  }

  const lines: string[] = [
    `# Federal Lobbying Disclosures: "${query}"`,
    "",
    `**Total Filings Found:** ${filings.length}`,
    `**Search Type:** ${searchType}`,
    "",
    "---",
    "",
  ]

  // Calculate totals
  const totalIncome = filings.reduce((sum, f) => sum + (f.income || 0), 0)
  const totalExpenses = filings.reduce((sum, f) => sum + (f.expenses || 0), 0)

  if (totalIncome > 0 || totalExpenses > 0) {
    lines.push("## Financial Summary")
    lines.push("")
    if (totalIncome > 0) {
      lines.push(`- **Total Lobbying Income:** ${formatCurrency(totalIncome)}`)
    }
    if (totalExpenses > 0) {
      lines.push(`- **Total Lobbying Expenses:** ${formatCurrency(totalExpenses)}`)
    }
    lines.push("")
    lines.push("---")
    lines.push("")
  }

  // Group by year
  const byYear: Record<number, typeof filings> = {}
  filings.forEach((filing) => {
    if (!byYear[filing.filingYear]) byYear[filing.filingYear] = []
    byYear[filing.filingYear].push(filing)
  })

  const sortedYears = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a)

  sortedYears.forEach((year) => {
    const yearFilings = byYear[year]
    const yearIncome = yearFilings.reduce((sum, f) => sum + (f.income || 0), 0)

    lines.push(`## ${year} (${yearFilings.length} filings${yearIncome > 0 ? `, ${formatCurrency(yearIncome)}` : ""})`)
    lines.push("")

    yearFilings.slice(0, 5).forEach((filing) => {
      lines.push(`### ${filing.registrantName}`)
      lines.push(`**Client:** ${filing.clientName}`)
      if (filing.clientDescription) {
        lines.push(`**Client Description:** ${filing.clientDescription}`)
      }
      lines.push(`**Filing:** ${filing.filingType} - ${filing.filingPeriod}`)
      if (filing.income !== null) {
        lines.push(`**Income:** ${formatCurrency(filing.income)}`)
      }
      if (filing.expenses !== null) {
        lines.push(`**Expenses:** ${formatCurrency(filing.expenses)}`)
      }

      if (filing.lobbyists.length > 0) {
        lines.push("")
        lines.push("**Lobbyists:**")
        filing.lobbyists.slice(0, 5).forEach((lobbyist) => {
          const position = lobbyist.coveredPosition ? ` (${lobbyist.coveredPosition})` : ""
          lines.push(`- ${lobbyist.name}${position}`)
        })
        if (filing.lobbyists.length > 5) {
          lines.push(`- ... and ${filing.lobbyists.length - 5} more`)
        }
      }

      if (filing.issues.length > 0) {
        lines.push("")
        lines.push("**Issues Lobbied:**")
        filing.issues.forEach((issue) => {
          lines.push(`- ${issue.code}: ${issue.description || "General lobbying"}`)
          if (issue.governmentEntities.length > 0) {
            lines.push(`  - Agencies: ${issue.governmentEntities.join(", ")}`)
          }
        })
      }

      lines.push("")
      lines.push("---")
      lines.push("")
    })

    if (yearFilings.length > 5) {
      lines.push(`... and ${yearFilings.length - 5} more filings in ${year}`)
      lines.push("")
    }
  })

  // Prospect research insights
  lines.push("## Prospect Research Insights")
  lines.push("")

  // Unique lobbyists across all filings
  const uniqueLobbyists = new Set<string>()
  const uniqueClients = new Set<string>()
  const uniqueIssues = new Set<string>()

  filings.forEach((filing) => {
    uniqueClients.add(filing.clientName)
    filing.lobbyists.forEach((l) => uniqueLobbyists.add(l.name))
    filing.issues.forEach((i) => uniqueIssues.add(i.code))
  })

  lines.push(`- **Unique Clients:** ${uniqueClients.size}`)
  lines.push(`- **Unique Lobbyists:** ${uniqueLobbyists.size}`)
  lines.push(`- **Issue Areas:** ${uniqueIssues.size}`)
  lines.push("")

  if (totalIncome >= 1000000) {
    lines.push("**Wealth Indicator:** HIGH - Significant lobbying expenditure indicates substantial resources and political influence")
  } else if (totalIncome >= 100000) {
    lines.push("**Wealth Indicator:** MODERATE - Active lobbying presence suggests business/political engagement")
  }

  // Former government positions
  const coveredPositions = filings.flatMap((f) =>
    f.lobbyists.filter((l) => l.coveredPosition).map((l) => ({ name: l.name, position: l.coveredPosition }))
  )

  if (coveredPositions.length > 0) {
    lines.push("")
    lines.push("**Revolving Door:** Former government officials identified:")
    coveredPositions.slice(0, 5).forEach(({ name, position }) => {
      lines.push(`- ${name}: ${position}`)
    })
  }

  return lines.join("\n")
}

// ============================================================================
// TOOLS
// ============================================================================

/**
 * Search federal lobbying disclosures
 */
export const lobbyingSearchTool = tool({
  description:
    "Search federal lobbying disclosures (LDA filings) for lobbyists, lobbying firms, or clients. " +
    "Returns lobbying registrations, activity reports, income/expenses, issues lobbied, and " +
    "government entities contacted. Essential for understanding political influence and connections. " +
    "Identifies former government officials ('revolving door') and lobbying expenditures. " +
    "FREE API - no key required.",
  parameters: lobbyingSearchSchema,
  execute: async ({
    searchTerm,
    searchType = "registrant",
    filingYear,
    limit = 20,
  }): Promise<LobbyingSearchResult> => {
    console.log("[Lobbying] Searching:", searchTerm, "as", searchType)
    const startTime = Date.now()

    if (!isLobbyingEnabled()) {
      return {
        query: searchTerm,
        totalFilings: 0,
        filings: [],
        rawContent: "Lobbying API is not available.",
        sources: [],
        error: "Lobbying not enabled",
      }
    }

    try {
      // Build query parameters
      const params = new URLSearchParams({
        [`${searchType}_name`]: searchTerm,
        page_size: Math.min(limit, 50).toString(),
      })

      if (filingYear) {
        params.append("filing_year", filingYear.toString())
      }

      const url = `${SENATE_LDA_BASE_URL}/filings/?${params.toString()}`

      const response = await withTimeout(
        fetch(url, {
          headers: { Accept: "application/json" },
        }),
        CONGRESS_DEFAULTS.timeout,
        `Lobbying API request timed out after ${CONGRESS_DEFAULTS.timeout / 1000} seconds`
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Lobbying API error: ${response.status} - ${errorText}`)
      }

      const data: LobbyingSearchResponse = await response.json()

      const duration = Date.now() - startTime
      console.log("[Lobbying] Found", data.results?.length || 0, "filings in", duration, "ms")

      // Format filings
      const filings: LobbyingSearchResult["filings"] = (data.results || []).map((filing) => ({
        filingId: filing.filing_uuid,
        filingType: filing.filing_type_display,
        filingYear: filing.filing_year,
        filingPeriod: filing.filing_period_display,
        registrantName: filing.registrant.name,
        registrantAddress: filing.registrant.address_1
          ? [
              filing.registrant.address_1,
              filing.registrant.address_2,
              filing.registrant.city,
              filing.registrant.state,
              filing.registrant.zip,
            ]
              .filter(Boolean)
              .join(", ")
          : null,
        clientName: filing.client.name,
        clientDescription: filing.client.general_description,
        clientLocation: [filing.client.state, filing.client.country].filter(Boolean).join(", ") || null,
        income: filing.income ? parseFloat(filing.income) : null,
        expenses: filing.expenses ? parseFloat(filing.expenses) : null,
        lobbyists: filing.lobbyists.map((l) => ({
          name: [l.prefix, l.first_name, l.middle_name, l.last_name, l.suffix]
            .filter(Boolean)
            .join(" "),
          coveredPosition: l.covered_position,
        })),
        issues: filing.lobbying_activities.map((activity) => ({
          code: activity.general_issue_code_display,
          description: activity.description,
          governmentEntities: activity.government_entities.map((e) => e.name),
        })),
        documentUrl: filing.filing_document_url,
        datePosted: filing.dt_posted,
      }))

      // Generate sources
      const sources: Array<{ name: string; url: string }> = [
        {
          name: `Senate LDA - "${searchTerm}" Search`,
          url: `https://lda.senate.gov/filings/public/filing/search/?${searchType}_name=${encodeURIComponent(searchTerm)}`,
        },
      ]

      filings.slice(0, 5).forEach((filing) => {
        if (filing.documentUrl) {
          sources.push({
            name: `${filing.registrantName} - ${filing.filingYear} ${filing.filingPeriod}`,
            url: filing.documentUrl,
          })
        }
      })

      const rawContent = formatLobbyingForAI(filings, searchTerm, searchType)

      return {
        query: searchTerm,
        totalFilings: data.count || 0,
        filings,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[Lobbying] Search failed:", errorMessage)
      return {
        query: searchTerm,
        totalFilings: 0,
        filings: [],
        rawContent: `Failed to search lobbying disclosures for "${searchTerm}": ${errorMessage}`,
        sources: [],
        error: errorMessage,
      }
    }
  },
})

/**
 * Check if lobbying tools should be enabled
 */
export function shouldEnableLobbyingTools(): boolean {
  return isLobbyingEnabled()
}
