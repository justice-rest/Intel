/**
 * State Campaign Finance Tool
 *
 * Searches state-level campaign contribution databases via Socrata Open Data APIs.
 * Fills the gap left by FEC (federal-only) data.
 *
 * Coverage: 15 states = ~65% US population
 *
 * Data Sources (all FREE, no API key required):
 * - California: Cal-Access via data.ca.gov
 * - New York: data.ny.gov
 * - Texas: data.texas.gov
 * - Florida: open.florida.gov
 * - Illinois: data.illinois.gov
 * - Ohio: data.ohio.gov
 * - Colorado: data.colorado.gov
 * - Washington: data.wa.gov
 * - Massachusetts: data.mass.gov
 * - New Jersey: data.nj.gov
 * - Pennsylvania: data.pa.gov
 * - Michigan: data.michigan.gov
 * - Georgia: data.georgia.gov
 * - Minnesota: data.mn.gov
 * - Virginia: data.virginia.gov
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// TYPES
// ============================================================================

export interface StateContribution {
  date: string
  amount: number
  recipientName: string
  recipientType: "candidate" | "committee" | "party" | "pac" | "other"
  office?: string
  party?: string
  electionYear?: number
  contributorName: string
  contributorAddress?: string
  contributorEmployer?: string
  contributorOccupation?: string
}

export interface StateCampaignFinanceResult {
  personName: string
  state: string
  contributions: StateContribution[]
  summary: {
    totalAmount: number
    contributionCount: number
    dateRange: { earliest: string; latest: string } | null
    partyBreakdown: {
      democratic: number
      republican: number
      other: number
    }
    topRecipients: Array<{ name: string; amount: number }>
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// SOCRATA STATE ENDPOINTS
// ============================================================================

interface StateConfig {
  name: string
  baseUrl: string
  datasetId: string
  nameField: string
  amountField: string
  dateField: string
  recipientField: string
  partyField?: string
  officeField?: string
  employerField?: string
  occupationField?: string
  addressFields?: string[]
}

const STATE_CONFIGS: Record<string, StateConfig> = {
  CA: {
    name: "California",
    baseUrl: "https://data.ca.gov/api/3/action/datastore_search",
    datasetId: "campaign-contributions", // Cal-Access
    nameField: "contributor_name",
    amountField: "amount",
    dateField: "contribution_date",
    recipientField: "recipient_name",
    partyField: "party",
    officeField: "office",
    employerField: "contributor_employer",
    occupationField: "contributor_occupation",
  },
  NY: {
    name: "New York",
    baseUrl: "https://data.ny.gov/resource",
    datasetId: "kwxv-fwze", // Campaign contributions
    nameField: "contributor_name",
    amountField: "amount",
    dateField: "contribution_date",
    recipientField: "filer_name",
    employerField: "employer",
    occupationField: "occupation",
  },
  TX: {
    name: "Texas",
    baseUrl: "https://data.texas.gov/resource",
    datasetId: "qbg8-ypjc", // TEC contributions
    nameField: "contributor_name",
    amountField: "contribution_amount",
    dateField: "contribution_date",
    recipientField: "filer_name",
    employerField: "contributor_employer",
    occupationField: "contributor_occupation",
  },
  FL: {
    name: "Florida",
    baseUrl: "https://open.florida.gov/api/3/action/datastore_search",
    datasetId: "campaign-contributions",
    nameField: "contributor",
    amountField: "amount",
    dateField: "date",
    recipientField: "candidate_committee",
  },
  IL: {
    name: "Illinois",
    baseUrl: "https://data.illinois.gov/resource",
    datasetId: "bv4s-hqm3", // Campaign contributions
    nameField: "contributor_name",
    amountField: "amount",
    dateField: "received_date",
    recipientField: "committee_name",
    employerField: "employer",
    occupationField: "occupation",
  },
  OH: {
    name: "Ohio",
    baseUrl: "https://data.ohio.gov/resource",
    datasetId: "campaign-finance",
    nameField: "contributor",
    amountField: "amount",
    dateField: "date",
    recipientField: "committee",
  },
  CO: {
    name: "Colorado",
    baseUrl: "https://data.colorado.gov/resource",
    datasetId: "4ykn-tg5h", // TRACER contributions
    nameField: "contributor_name",
    amountField: "contribution_amount",
    dateField: "contribution_date",
    recipientField: "committee_name",
    employerField: "employer",
    occupationField: "occupation",
  },
  WA: {
    name: "Washington",
    baseUrl: "https://data.wa.gov/resource",
    datasetId: "kv7h-kjye", // PDC contributions
    nameField: "contributor_name",
    amountField: "amount",
    dateField: "receipt_date",
    recipientField: "filer_name",
    employerField: "contributor_employer",
    occupationField: "contributor_occupation",
  },
  MA: {
    name: "Massachusetts",
    baseUrl: "https://data.mass.gov/resource",
    datasetId: "campaign-finance-receipts",
    nameField: "contributor_name",
    amountField: "amount",
    dateField: "date",
    recipientField: "recipient",
  },
  NJ: {
    name: "New Jersey",
    baseUrl: "https://data.nj.gov/resource",
    datasetId: "election-contributions",
    nameField: "contributor_name",
    amountField: "amount",
    dateField: "contribution_date",
    recipientField: "committee_name",
  },
  PA: {
    name: "Pennsylvania",
    baseUrl: "https://data.pa.gov/resource",
    datasetId: "campaign-finance-contributions",
    nameField: "contributor_name",
    amountField: "contribution_amount",
    dateField: "contribution_date",
    recipientField: "filer_name",
    employerField: "employer",
    occupationField: "occupation",
  },
  MI: {
    name: "Michigan",
    baseUrl: "https://data.michigan.gov/resource",
    datasetId: "campaign-contributions",
    nameField: "contributor_name",
    amountField: "amount",
    dateField: "receipt_date",
    recipientField: "committee_name",
  },
  GA: {
    name: "Georgia",
    baseUrl: "https://data.georgia.gov/resource",
    datasetId: "campaign-contributions",
    nameField: "contributor_name",
    amountField: "contribution_amount",
    dateField: "contribution_date",
    recipientField: "filer_name",
  },
  MN: {
    name: "Minnesota",
    baseUrl: "https://data.mn.gov/resource",
    datasetId: "campaign-finance",
    nameField: "contributor_name",
    amountField: "amount",
    dateField: "date",
    recipientField: "committee_name",
    employerField: "employer",
    occupationField: "occupation",
  },
  VA: {
    name: "Virginia",
    baseUrl: "https://data.virginia.gov/resource",
    datasetId: "campaign-contributions",
    nameField: "contributor_name",
    amountField: "amount",
    dateField: "transaction_date",
    recipientField: "committee_name",
  },
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse name into search-friendly format
 */
function parseSearchName(name: string): { firstName: string; lastName: string; fullName: string } {
  const parts = name.trim().split(/\s+/)
  return {
    firstName: parts[0] || "",
    lastName: parts[parts.length - 1] || "",
    fullName: name.trim(),
  }
}

/**
 * Infer party from recipient name or explicit field
 */
function inferParty(recipientName: string, explicitParty?: string): string | undefined {
  if (explicitParty) {
    const p = explicitParty.toUpperCase()
    if (p.includes("DEM") || p === "D") return "Democratic"
    if (p.includes("REP") || p === "R") return "Republican"
    if (p.includes("IND") || p === "I") return "Independent"
    return explicitParty
  }

  // Try to infer from common patterns
  const upper = recipientName.toUpperCase()
  if (upper.includes("DEMOCRATIC") || upper.includes("DEM PARTY")) return "Democratic"
  if (upper.includes("REPUBLICAN") || upper.includes("GOP") || upper.includes("REP PARTY")) return "Republican"

  return undefined
}

/**
 * Query a state's Socrata endpoint
 */
async function queryStateContributions(
  state: string,
  personName: string,
  limit: number = 100
): Promise<StateContribution[]> {
  const config = STATE_CONFIGS[state.toUpperCase()]
  if (!config) {
    console.log(`[StateCampaignFinance] No config for state: ${state}`)
    return []
  }

  const { firstName, lastName } = parseSearchName(personName)
  const contributions: StateContribution[] = []

  try {
    // Build Socrata SoQL query
    // Search for last name (more reliable) then filter by first name
    let url: string

    if (config.baseUrl.includes("api/3/action")) {
      // CKAN-style API (California, Florida)
      const searchTerm = encodeURIComponent(lastName)
      url = `${config.baseUrl}?resource_id=${config.datasetId}&q=${searchTerm}&limit=${limit}`
    } else {
      // Standard Socrata SoDA API
      const whereClause = encodeURIComponent(
        `upper(${config.nameField}) like '%${lastName.toUpperCase()}%'`
      )
      url = `${config.baseUrl}/${config.datasetId}.json?$where=${whereClause}&$limit=${limit}&$order=${config.dateField} DESC`
    }

    console.log(`[StateCampaignFinance] Querying ${config.name}: ${url}`)

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Romy-Prospect-Research/1.0",
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`[StateCampaignFinance] ${config.name} API error: ${response.status}`)
      return []
    }

    const data = await response.json()

    // Handle different response formats
    const records = data.result?.records || data.records || data || []

    for (const record of records) {
      // Filter to ensure first name matches (if provided)
      const contributorName = String(record[config.nameField] || "")
      if (firstName && !contributorName.toUpperCase().includes(firstName.toUpperCase())) {
        continue
      }

      const amount = parseFloat(record[config.amountField]) || 0
      if (amount <= 0) continue

      const contribution: StateContribution = {
        date: record[config.dateField] || "",
        amount,
        recipientName: record[config.recipientField] || "Unknown",
        recipientType: "committee", // Default, could be refined
        party: inferParty(record[config.recipientField] || "", config.partyField ? record[config.partyField] : undefined),
        office: config.officeField ? record[config.officeField] : undefined,
        contributorName,
        contributorEmployer: config.employerField ? record[config.employerField] : undefined,
        contributorOccupation: config.occupationField ? record[config.occupationField] : undefined,
      }

      contributions.push(contribution)
    }

    console.log(`[StateCampaignFinance] Found ${contributions.length} contributions in ${config.name}`)
  } catch (error) {
    console.error(`[StateCampaignFinance] Error querying ${config.name}:`, error)
  }

  return contributions
}

/**
 * Aggregate contributions by recipient
 */
function getTopRecipients(contributions: StateContribution[], limit: number = 5): Array<{ name: string; amount: number }> {
  const byRecipient: Record<string, number> = {}

  for (const c of contributions) {
    const key = c.recipientName
    byRecipient[key] = (byRecipient[key] || 0) + c.amount
  }

  return Object.entries(byRecipient)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

/**
 * Calculate party breakdown
 */
function getPartyBreakdown(contributions: StateContribution[]): { democratic: number; republican: number; other: number } {
  const breakdown = { democratic: 0, republican: 0, other: 0 }

  for (const c of contributions) {
    const party = (c.party || "").toLowerCase()
    if (party.includes("democrat")) {
      breakdown.democratic += c.amount
    } else if (party.includes("republican")) {
      breakdown.republican += c.amount
    } else {
      breakdown.other += c.amount
    }
  }

  return breakdown
}

/**
 * Get date range from contributions
 */
function getDateRange(contributions: StateContribution[]): { earliest: string; latest: string } | null {
  if (contributions.length === 0) return null

  const dates = contributions
    .map((c) => c.date)
    .filter((d) => d)
    .sort()

  if (dates.length === 0) return null

  return {
    earliest: dates[0],
    latest: dates[dates.length - 1],
  }
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

async function searchStateCampaignFinance(
  personName: string,
  states: string[] = ["CA", "NY", "TX", "FL", "IL"],
  limit: number = 50
): Promise<StateCampaignFinanceResult> {
  console.log(`[StateCampaignFinance] Searching for "${personName}" in states: ${states.join(", ")}`)

  const allContributions: StateContribution[] = []
  const sources: Array<{ name: string; url: string }> = []

  // Query each state in parallel
  const statePromises = states.map(async (state) => {
    const config = STATE_CONFIGS[state.toUpperCase()]
    if (!config) return []

    sources.push({
      name: `${config.name} Campaign Finance`,
      url: config.baseUrl.replace("/resource", "").replace("/api/3/action/datastore_search", ""),
    })

    return queryStateContributions(state, personName, limit)
  })

  const results = await Promise.all(statePromises)
  for (const stateContributions of results) {
    allContributions.push(...stateContributions)
  }

  // Sort by date descending
  allContributions.sort((a, b) => (b.date || "").localeCompare(a.date || ""))

  // Calculate summary
  const totalAmount = allContributions.reduce((sum, c) => sum + c.amount, 0)
  const partyBreakdown = getPartyBreakdown(allContributions)
  const topRecipients = getTopRecipients(allContributions)
  const dateRange = getDateRange(allContributions)

  // Build raw content for AI
  const rawLines: string[] = []
  rawLines.push(`# State Campaign Finance: ${personName}`)
  rawLines.push("")
  rawLines.push(`## Summary`)
  rawLines.push(`- **Total Contributions:** ${formatCurrency(totalAmount)}`)
  rawLines.push(`- **Number of Contributions:** ${allContributions.length}`)
  if (dateRange) {
    rawLines.push(`- **Date Range:** ${dateRange.earliest} to ${dateRange.latest}`)
  }
  rawLines.push(`- **States Searched:** ${states.join(", ")}`)
  rawLines.push("")

  rawLines.push(`## Party Breakdown`)
  rawLines.push(`- **Democratic:** ${formatCurrency(partyBreakdown.democratic)}`)
  rawLines.push(`- **Republican:** ${formatCurrency(partyBreakdown.republican)}`)
  rawLines.push(`- **Other/Unknown:** ${formatCurrency(partyBreakdown.other)}`)

  const totalParty = partyBreakdown.democratic + partyBreakdown.republican + partyBreakdown.other
  if (totalParty > 0) {
    const demPct = ((partyBreakdown.democratic / totalParty) * 100).toFixed(0)
    const repPct = ((partyBreakdown.republican / totalParty) * 100).toFixed(0)
    rawLines.push(`- **Lean:** ${parseInt(demPct) > parseInt(repPct) ? "Democratic" : parseInt(repPct) > parseInt(demPct) ? "Republican" : "Bipartisan"} (${demPct}% D / ${repPct}% R)`)
  }
  rawLines.push("")

  if (topRecipients.length > 0) {
    rawLines.push(`## Top Recipients`)
    for (const r of topRecipients) {
      rawLines.push(`- **${r.name}:** ${formatCurrency(r.amount)}`)
    }
    rawLines.push("")
  }

  if (allContributions.length > 0) {
    rawLines.push(`## Recent Contributions`)
    for (const c of allContributions.slice(0, 20)) {
      rawLines.push(`- ${c.date || "Unknown date"}: ${formatCurrency(c.amount)} to ${c.recipientName}${c.party ? ` (${c.party})` : ""}`)
    }
    if (allContributions.length > 20) {
      rawLines.push(`- ... and ${allContributions.length - 20} more contributions`)
    }
  } else {
    rawLines.push(`## Results`)
    rawLines.push(`No state-level campaign contributions found for "${personName}" in the searched states.`)
    rawLines.push("")
    rawLines.push(`**Note:** This searches state campaign finance databases. For federal contributions (President, Congress), use the fec_contributions tool.`)
  }

  return {
    personName,
    state: states.join(", "),
    contributions: allContributions,
    summary: {
      totalAmount,
      contributionCount: allContributions.length,
      dateRange,
      partyBreakdown,
      topRecipients,
    },
    rawContent: rawLines.join("\n"),
    sources,
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const stateCampaignFinanceSchema = z.object({
  personName: z.string().describe("Full name of the person to search for"),
  states: z
    .array(z.string())
    .optional()
    .default(["CA", "NY", "TX", "FL", "IL", "PA", "MI"])
    .describe("Two-letter state codes to search. Available: CA, NY, TX, FL, IL, OH, CO, WA, MA, NJ, PA, MI, GA, MN, VA"),
  limit: z
    .number()
    .optional()
    .default(50)
    .describe("Maximum contributions per state (default: 50)"),
})

export const stateCampaignFinanceTool = tool({
  description:
    "Search STATE-level campaign finance contributions (NOT federal). " +
    "Fills the gap left by FEC which only has federal races. " +
    "Covers: CA, NY, TX, FL, IL, OH, CO, WA, MA, NJ, PA, MI, GA, MN, VA (15 states = ~65% US population). " +
    "Returns: contribution history, party breakdown, top recipients. " +
    "Use this IN ADDITION to fec_contributions for complete political giving picture.",

  parameters: stateCampaignFinanceSchema,

  execute: async ({ personName, states, limit }): Promise<StateCampaignFinanceResult> => {
    return searchStateCampaignFinance(personName, states, limit)
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableStateCampaignFinanceTool(): boolean {
  // Always enabled - uses free public APIs
  return true
}

export { searchStateCampaignFinance }
