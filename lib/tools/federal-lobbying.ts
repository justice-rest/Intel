/**
 * Federal Lobbying (LDA) Tool
 *
 * Search federal lobbying disclosures from the Senate LDA database.
 * All lobbying activity in Congress must be disclosed under the Lobbying Disclosure Act.
 *
 * Data Source: Senate LDA REST API
 * API Docs: https://lda.senate.gov/api/redoc/v1/
 *
 * Coverage: Lobbying filings since 1999
 * Updates: Quarterly (20 days after quarter end)
 *
 * Use Cases:
 * - Find lobbying firms (registrants) by name
 * - Find who is lobbying for specific clients
 * - Find registered lobbyists by name
 * - Track lobbying spending and issues
 *
 * REQUIRES: LDA_API_KEY environment variable
 * Get a free API key at: https://lda.senate.gov/api/
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// CONFIGURATION
// ============================================================================

const LDA_API_BASE = "https://lda.senate.gov/api/v1"
const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_LIMIT = 25 // API max is 25 per page

export function getLDAApiKey(): string | undefined {
  return process.env.LDA_API_KEY
}

export function isLDAEnabled(): boolean {
  return !!getLDAApiKey()
}

// ============================================================================
// TYPES
// ============================================================================

interface LDAFilingRecord {
  filing_uuid: string
  filing_type: string
  filing_type_display: string
  filing_year: number
  filing_period: string
  filing_period_display: string
  filing_document_url?: string
  filing_dt_posted: string
  registrant: {
    id: number
    name: string
    address_1?: string
    address_2?: string
    city?: string
    state?: string
    zip?: string
    country?: string
  }
  client: {
    id: number
    name: string
    state?: string
    country?: string
    general_description?: string
  }
  lobbyists: Array<{
    id: number
    prefix?: string
    first_name: string
    middle_name?: string
    last_name: string
    suffix?: string
    covered_position?: string
  }>
  lobbying_activities: Array<{
    general_issue_code?: string
    general_issue_code_display?: string
    description?: string
  }>
  income?: string
  expenses?: string
}

interface LDARegistrantRecord {
  id: number
  name: string
  address_1?: string
  address_2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  general_description?: string
}

interface LDAClientRecord {
  id: number
  name: string
  state?: string
  country?: string
  general_description?: string
}

interface LobbyingResult {
  searchType: "registrant" | "client" | "lobbyist" | "filings"
  query: string
  filings: Array<{
    filingId: string
    filingType: string
    year: number
    period: string
    registrantName: string
    clientName: string
    lobbyists: string[]
    issues: string[]
    income?: number
    expenses?: number
    documentUrl?: string
    datePosted: string
  }>
  summary: {
    totalFilings: number
    totalIncome: number
    totalExpenses: number
    uniqueClients: number
    uniqueRegistrants: number
    yearRange: { min: number; max: number }
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseAmount(value: string | undefined): number {
  if (!value) return 0
  const num = parseFloat(value.replace(/[^0-9.-]/g, ""))
  return isNaN(num) ? 0 : num
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string | undefined): string {
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

function buildLobbyistName(lobbyist: LDAFilingRecord["lobbyists"][0]): string {
  const parts = [
    lobbyist.prefix,
    lobbyist.first_name,
    lobbyist.middle_name,
    lobbyist.last_name,
    lobbyist.suffix,
  ].filter(Boolean)
  return parts.join(" ")
}

// ============================================================================
// API CLIENT
// ============================================================================

async function callLDAApi(
  endpoint: string,
  params: Record<string, string | number>
): Promise<LDAFilingRecord[] | LDARegistrantRecord[] | LDAClientRecord[]> {
  const apiKey = getLDAApiKey()

  if (!apiKey) {
    throw new Error(
      "LDA API key not configured. " +
        "Set LDA_API_KEY environment variable. " +
        "Get a free API key at https://lda.senate.gov/api/"
    )
  }

  const url = new URL(`${LDA_API_BASE}${endpoint}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value))
    }
  }

  console.log(`[FederalLobbying] API call: ${url.toString()}`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Token ${apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`LDA API error ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    // API returns paginated results with 'results' array
    return data.results || data || []
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("LDA API request timed out")
    }
    throw error
  }
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

async function searchByRegistrant(
  registrantName: string,
  year?: number
): Promise<LobbyingResult> {
  console.log(`[FederalLobbying] Searching registrant: "${registrantName}"`)

  const params: Record<string, string | number> = {
    registrant_name: registrantName,
    page_size: DEFAULT_LIMIT,
    ordering: "-filing_dt_posted",
  }

  if (year) {
    params.filing_year = year
  }

  try {
    const filings = (await callLDAApi(
      "/filings/",
      params
    )) as LDAFilingRecord[]
    return buildSuccessResult("registrant", registrantName, filings)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return buildErrorResult("registrant", registrantName, errorMessage)
  }
}

async function searchByClient(
  clientName: string,
  year?: number
): Promise<LobbyingResult> {
  console.log(`[FederalLobbying] Searching client: "${clientName}"`)

  const params: Record<string, string | number> = {
    client_name: clientName,
    page_size: DEFAULT_LIMIT,
    ordering: "-filing_dt_posted",
  }

  if (year) {
    params.filing_year = year
  }

  try {
    const filings = (await callLDAApi(
      "/filings/",
      params
    )) as LDAFilingRecord[]
    return buildSuccessResult("client", clientName, filings)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return buildErrorResult("client", clientName, errorMessage)
  }
}

async function searchByLobbyist(
  lobbyistName: string,
  year?: number
): Promise<LobbyingResult> {
  console.log(`[FederalLobbying] Searching lobbyist: "${lobbyistName}"`)

  const params: Record<string, string | number> = {
    lobbyist_name: lobbyistName,
    page_size: DEFAULT_LIMIT,
    ordering: "-filing_dt_posted",
  }

  if (year) {
    params.filing_year = year
  }

  try {
    const filings = (await callLDAApi(
      "/filings/",
      params
    )) as LDAFilingRecord[]
    return buildSuccessResult("lobbyist", lobbyistName, filings)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return buildErrorResult("lobbyist", lobbyistName, errorMessage)
  }
}

// ============================================================================
// RESULT BUILDERS
// ============================================================================

function buildErrorResult(
  searchType: "registrant" | "client" | "lobbyist" | "filings",
  query: string,
  error: string
): LobbyingResult {
  return {
    searchType,
    query,
    filings: [],
    summary: {
      totalFilings: 0,
      totalIncome: 0,
      totalExpenses: 0,
      uniqueClients: 0,
      uniqueRegistrants: 0,
      yearRange: { min: 0, max: 0 },
    },
    rawContent: `## Error\n\nFailed to search federal lobbying data: ${error}`,
    sources: [
      {
        name: "Senate LDA Database",
        url: "https://lda.senate.gov/",
      },
    ],
    error,
  }
}

function buildSuccessResult(
  searchType: "registrant" | "client" | "lobbyist" | "filings",
  query: string,
  records: LDAFilingRecord[]
): LobbyingResult {
  // Transform records
  const filings = records.map((record) => ({
    filingId: record.filing_uuid,
    filingType: record.filing_type_display || record.filing_type,
    year: record.filing_year,
    period: record.filing_period_display || record.filing_period,
    registrantName: record.registrant.name,
    clientName: record.client.name,
    lobbyists: record.lobbyists?.map(buildLobbyistName) || [],
    issues:
      record.lobbying_activities?.map(
        (a) => a.general_issue_code_display || a.general_issue_code || ""
      ) || [],
    income: parseAmount(record.income),
    expenses: parseAmount(record.expenses),
    documentUrl: record.filing_document_url,
    datePosted: record.filing_dt_posted,
  }))

  // Calculate summary
  let totalIncome = 0
  let totalExpenses = 0
  const clients = new Set<string>()
  const registrants = new Set<string>()
  let minYear = Infinity
  let maxYear = 0

  for (const filing of filings) {
    totalIncome += filing.income || 0
    totalExpenses += filing.expenses || 0
    clients.add(filing.clientName)
    registrants.add(filing.registrantName)
    if (filing.year < minYear) minYear = filing.year
    if (filing.year > maxYear) maxYear = filing.year
  }

  // Build formatted output
  const lines: string[] = []
  lines.push(`# Federal Lobbying Search (LDA)`)
  lines.push("")
  lines.push(`**Search Type:** ${searchType.toUpperCase()}`)
  lines.push(`**Query:** ${query}`)
  lines.push(`**Source:** Senate Lobbying Disclosure Act Database`)
  lines.push("")

  if (filings.length > 0) {
    lines.push(`## Summary`)
    lines.push("")
    lines.push(`| Metric | Value |`)
    lines.push(`|--------|-------|`)
    lines.push(`| Total Filings | ${filings.length} |`)
    lines.push(`| Total Income Reported | ${formatCurrency(totalIncome)} |`)
    lines.push(`| Total Expenses Reported | ${formatCurrency(totalExpenses)} |`)
    lines.push(`| Unique Clients | ${clients.size} |`)
    lines.push(`| Unique Registrants | ${registrants.size} |`)
    lines.push(
      `| Year Range | ${minYear === Infinity ? "N/A" : `${minYear} - ${maxYear}`} |`
    )
    lines.push("")

    lines.push(`## Recent Filings`)
    lines.push("")

    for (const filing of filings.slice(0, 10)) {
      lines.push(
        `### ${filing.registrantName} → ${filing.clientName} (${filing.year} ${filing.period})`
      )
      lines.push("")
      lines.push(`| Field | Value |`)
      lines.push(`|-------|-------|`)
      lines.push(`| Filing Type | ${filing.filingType} |`)
      if (filing.income) {
        lines.push(`| Income | ${formatCurrency(filing.income)} |`)
      }
      if (filing.expenses) {
        lines.push(`| Expenses | ${formatCurrency(filing.expenses)} |`)
      }
      if (filing.lobbyists.length > 0) {
        lines.push(`| Lobbyists | ${filing.lobbyists.slice(0, 5).join(", ")} |`)
      }
      if (filing.issues.length > 0) {
        lines.push(`| Issues | ${filing.issues.slice(0, 3).join(", ")} |`)
      }
      lines.push(`| Posted | ${formatDate(filing.datePosted)} |`)
      if (filing.documentUrl) {
        lines.push(`| Document | [View Filing](${filing.documentUrl}) |`)
      }
      lines.push("")
    }

    if (filings.length > 10) {
      lines.push(`*...and ${filings.length - 10} more filings*`)
    }
  } else {
    lines.push(`## No Results`)
    lines.push("")
    lines.push(`No lobbying filings found for "${query}".`)
    lines.push("")
    lines.push(`**Note:** This searches federal lobbying disclosures only.`)
    lines.push(`State lobbying may be available through state-specific portals.`)
  }

  return {
    searchType,
    query,
    filings,
    summary: {
      totalFilings: filings.length,
      totalIncome,
      totalExpenses,
      uniqueClients: clients.size,
      uniqueRegistrants: registrants.size,
      yearRange: {
        min: minYear === Infinity ? 0 : minYear,
        max: maxYear,
      },
    },
    rawContent: lines.join("\n"),
    sources: [
      {
        name: "Senate LDA Database",
        url: "https://lda.senate.gov/",
      },
    ],
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const federalLobbyingSchema = z.object({
  query: z.string().describe("Name to search for (person, company, or organization)"),
  searchType: z
    .enum(["registrant", "client", "lobbyist"])
    .describe(
      "'registrant' = lobbying firm, 'client' = who is being lobbied for, 'lobbyist' = individual lobbyist"
    ),
  year: z
    .number()
    .optional()
    .describe("Filter by specific year (e.g., 2024)"),
})

export const federalLobbyingTool = (tool as any)({
  description:
    "Search federal lobbying disclosures (Lobbying Disclosure Act). " +
    "Find who is lobbying Congress, for whom, on what issues, and how much they're paid. " +
    "WEALTH INDICATOR: Lobbyists and lobbying firm principals are typically high-income. " +
    "INFLUENCE INDICATOR: Companies spending on lobbying have significant policy interests.",

  parameters: federalLobbyingSchema,

  execute: async ({ query, searchType, year }: { query: string; searchType: "registrant" | "client" | "lobbyist"; year?: number }): Promise<LobbyingResult> => {
    if (!isLDAEnabled()) {
      return buildErrorResult(
        searchType,
        query,
        "LDA API key not configured. Set LDA_API_KEY environment variable."
      )
    }

    switch (searchType) {
      case "registrant":
        return searchByRegistrant(query, year)
      case "client":
        return searchByClient(query, year)
      case "lobbyist":
        return searchByLobbyist(query, year)
      default:
        return buildErrorResult(searchType, query, `Invalid search type: ${searchType}`)
    }
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableFederalLobbyingTool(): boolean {
  return isLDAEnabled()
}

export { searchByRegistrant, searchByClient, searchByLobbyist }
