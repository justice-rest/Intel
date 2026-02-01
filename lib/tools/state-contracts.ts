/**
 * State Contracts Search Tool
 *
 * Searches state/local government contract databases via Socrata Open Data APIs.
 * Reveals business relationships with government entities - often hidden wealth indicator.
 *
 * Coverage:
 * - California: data.ca.gov (state contracts)
 * - New York: data.ny.gov (state contracts)
 * - Texas: data.texas.gov (TPASS contracts)
 * - Florida: open.florida.gov (MyFloridaMarketPlace)
 * - Illinois: data.illinois.gov (state contracts)
 * - Ohio: data.ohio.gov (state contracts)
 * - Colorado: data.colorado.gov (state purchasing)
 * - Massachusetts: data.mass.gov (state contracts)
 *
 * Use Cases:
 * - Wealth indicator: Large government contracts suggest business success
 * - Business ownership verification: Links businesses to owners
 * - Due diligence: Reveals government relationships
 *
 * Data Sources: All FREE, no API key required
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// TYPES
// ============================================================================

export interface StateContract {
  contractId: string
  vendorName: string
  description: string
  amount: number
  awardDate?: string
  startDate?: string
  endDate?: string
  agency: string
  state: string
  contractType?: string
  status?: string
}

export interface StateContractsResult {
  query: {
    vendorName?: string
    companyName?: string
    state: string
  }
  contracts: StateContract[]
  summary: {
    totalContracts: number
    totalValue: number
    averageContractValue: number
    agencies: string[]
    dateRange: { earliest: string; latest: string } | null
    wealthIndicator: "high" | "medium" | "low" | "unknown"
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// STATE CONTRACT ENDPOINTS
// ============================================================================

interface ContractEndpoint {
  name: string
  state: string
  portal: string
  datasetId: string
  fields: {
    contractId: string
    vendorName: string
    description: string
    amount: string
    awardDate?: string
    startDate?: string
    endDate?: string
    agency: string
    contractType?: string
    status?: string
  }
}

const CONTRACT_ENDPOINTS: ContractEndpoint[] = [
  // California
  {
    name: "California State Contracts",
    state: "CA",
    portal: "https://data.ca.gov/resource",
    datasetId: "state-contracts",
    fields: {
      contractId: "contract_number",
      vendorName: "supplier_name",
      description: "contract_description",
      amount: "contract_amount",
      awardDate: "award_date",
      startDate: "start_date",
      endDate: "end_date",
      agency: "department",
    },
  },
  // New York
  {
    name: "New York State Contracts",
    state: "NY",
    portal: "https://data.ny.gov/resource",
    datasetId: "erm2-nwe9", // State contracts
    fields: {
      contractId: "contract_number",
      vendorName: "contractor",
      description: "description",
      amount: "contract_amount",
      startDate: "start_date",
      endDate: "end_date",
      agency: "agency_name",
      status: "status",
    },
  },
  // Texas
  {
    name: "Texas State Contracts (TPASS)",
    state: "TX",
    portal: "https://data.texas.gov/resource",
    datasetId: "state-contracts",
    fields: {
      contractId: "contract_id",
      vendorName: "vendor_name",
      description: "contract_description",
      amount: "total_contract_value",
      awardDate: "award_date",
      startDate: "effective_date",
      endDate: "expiration_date",
      agency: "agency_name",
      contractType: "contract_type",
    },
  },
  // Florida
  {
    name: "Florida MyFloridaMarketPlace",
    state: "FL",
    portal: "https://open.florida.gov/resource",
    datasetId: "mfmp-contracts",
    fields: {
      contractId: "contract_number",
      vendorName: "vendor_name",
      description: "description",
      amount: "contract_value",
      startDate: "begin_date",
      endDate: "end_date",
      agency: "agency",
      status: "status",
    },
  },
  // Illinois
  {
    name: "Illinois State Contracts",
    state: "IL",
    portal: "https://data.illinois.gov/resource",
    datasetId: "state-contracts",
    fields: {
      contractId: "contract_number",
      vendorName: "vendor",
      description: "description",
      amount: "amount",
      awardDate: "award_date",
      agency: "agency",
      contractType: "contract_type",
    },
  },
  // Ohio
  {
    name: "Ohio State Contracts",
    state: "OH",
    portal: "https://data.ohio.gov/resource",
    datasetId: "state-purchasing",
    fields: {
      contractId: "contract_id",
      vendorName: "vendor",
      description: "description",
      amount: "amount",
      startDate: "start_date",
      endDate: "end_date",
      agency: "agency",
    },
  },
  // Colorado
  {
    name: "Colorado State Purchasing",
    state: "CO",
    portal: "https://data.colorado.gov/resource",
    datasetId: "jmxb-qfca", // State purchasing
    fields: {
      contractId: "contract_number",
      vendorName: "vendor_name",
      description: "contract_description",
      amount: "contract_amount",
      awardDate: "award_date",
      startDate: "start_date",
      endDate: "end_date",
      agency: "department",
    },
  },
  // Massachusetts
  {
    name: "Massachusetts State Contracts",
    state: "MA",
    portal: "https://data.mass.gov/resource",
    datasetId: "state-contracts",
    fields: {
      contractId: "contract_id",
      vendorName: "vendor_name",
      description: "description",
      amount: "contract_value",
      startDate: "effective_date",
      endDate: "expiration_date",
      agency: "department",
    },
  },
]

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
 * Determine wealth indicator based on contract value
 */
function getWealthIndicator(totalValue: number): "high" | "medium" | "low" | "unknown" {
  if (totalValue >= 1000000) return "high" // $1M+ in contracts
  if (totalValue >= 100000) return "medium" // $100K-$1M
  if (totalValue > 0) return "low"
  return "unknown"
}

/**
 * Get date range from contracts
 */
function getDateRange(contracts: StateContract[]): { earliest: string; latest: string } | null {
  const dates = contracts
    .flatMap((c) => [c.awardDate, c.startDate, c.endDate])
    .filter((d): d is string => !!d)
    .sort()

  if (dates.length === 0) return null
  return { earliest: dates[0], latest: dates[dates.length - 1] }
}

/**
 * Query a state contract endpoint
 */
async function queryContractEndpoint(
  endpoint: ContractEndpoint,
  searchTerm: string
): Promise<StateContract[]> {
  const contracts: StateContract[] = []

  try {
    // Build SoQL query - search vendor name
    const whereClause = `upper(${endpoint.fields.vendorName}) like '%${searchTerm.toUpperCase()}%'`
    const url = `${endpoint.portal}/${endpoint.datasetId}.json?$where=${encodeURIComponent(whereClause)}&$limit=50&$order=${endpoint.fields.amount} DESC`

    console.log(`[StateContracts] Querying ${endpoint.name}: ${url}`)

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Romy-Prospect-Research/1.0",
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`[StateContracts] ${endpoint.name} API error: ${response.status}`)
      return []
    }

    const data = await response.json()

    if (!Array.isArray(data)) {
      return []
    }

    for (const record of data) {
      const amount = parseFloat(String(record[endpoint.fields.amount] || "0").replace(/[^0-9.-]/g, "")) || 0
      if (amount <= 0) continue

      const contract: StateContract = {
        contractId: String(record[endpoint.fields.contractId] || ""),
        vendorName: String(record[endpoint.fields.vendorName] || ""),
        description: String(record[endpoint.fields.description] || "").substring(0, 500),
        amount,
        agency: String(record[endpoint.fields.agency] || ""),
        state: endpoint.state,
      }

      if (endpoint.fields.awardDate && record[endpoint.fields.awardDate]) {
        contract.awardDate = String(record[endpoint.fields.awardDate])
      }
      if (endpoint.fields.startDate && record[endpoint.fields.startDate]) {
        contract.startDate = String(record[endpoint.fields.startDate])
      }
      if (endpoint.fields.endDate && record[endpoint.fields.endDate]) {
        contract.endDate = String(record[endpoint.fields.endDate])
      }
      if (endpoint.fields.contractType && record[endpoint.fields.contractType]) {
        contract.contractType = String(record[endpoint.fields.contractType])
      }
      if (endpoint.fields.status && record[endpoint.fields.status]) {
        contract.status = String(record[endpoint.fields.status])
      }

      contracts.push(contract)
    }

    console.log(`[StateContracts] Found ${contracts.length} contracts in ${endpoint.name}`)
  } catch (error) {
    console.error(`[StateContracts] Error querying ${endpoint.name}:`, error)
  }

  return contracts
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

async function searchStateContracts(
  searchTerm: string,
  states: string[] = ["CA", "NY", "TX", "FL", "IL"]
): Promise<StateContractsResult> {
  console.log(`[StateContracts] Searching for "${searchTerm}" in states: ${states.join(", ")}`)

  const allContracts: StateContract[] = []
  const sources: Array<{ name: string; url: string }> = []

  // Find matching endpoints
  const endpoints = CONTRACT_ENDPOINTS.filter((e) =>
    states.map((s) => s.toUpperCase()).includes(e.state)
  )

  // Query each endpoint in parallel
  const endpointPromises = endpoints.map(async (endpoint) => {
    sources.push({
      name: endpoint.name,
      url: endpoint.portal.replace("/resource", ""),
    })
    return queryContractEndpoint(endpoint, searchTerm)
  })

  const results = await Promise.all(endpointPromises)
  for (const contracts of results) {
    allContracts.push(...contracts)
  }

  // Sort by amount descending
  allContracts.sort((a, b) => b.amount - a.amount)

  // Calculate summary
  const totalValue = allContracts.reduce((sum, c) => sum + c.amount, 0)
  const averageContractValue = allContracts.length > 0 ? totalValue / allContracts.length : 0
  const agencies = [...new Set(allContracts.map((c) => c.agency).filter(Boolean))]
  const dateRange = getDateRange(allContracts)

  const summary = {
    totalContracts: allContracts.length,
    totalValue,
    averageContractValue,
    agencies,
    dateRange,
    wealthIndicator: getWealthIndicator(totalValue),
  }

  // Build raw content
  const rawLines: string[] = []
  rawLines.push(`# State Government Contracts: ${searchTerm}`)
  rawLines.push("")
  rawLines.push(`## Summary`)
  rawLines.push(`- **Total Contracts:** ${allContracts.length}`)
  rawLines.push(`- **Total Value:** ${formatCurrency(totalValue)}`)
  rawLines.push(`- **Average Contract:** ${formatCurrency(averageContractValue)}`)
  rawLines.push(`- **Wealth Indicator:** ${summary.wealthIndicator.toUpperCase()}`)
  rawLines.push(`- **States Searched:** ${states.join(", ")}`)
  if (dateRange) {
    rawLines.push(`- **Date Range:** ${dateRange.earliest} to ${dateRange.latest}`)
  }
  rawLines.push("")

  if (agencies.length > 0) {
    rawLines.push(`## Government Agencies`)
    for (const agency of agencies.slice(0, 10)) {
      rawLines.push(`- ${agency}`)
    }
    rawLines.push("")
  }

  if (allContracts.length > 0) {
    rawLines.push(`## Contracts`)
    rawLines.push("")

    for (const contract of allContracts.slice(0, 20)) {
      rawLines.push(`### ${contract.vendorName} - ${formatCurrency(contract.amount)}`)
      rawLines.push(`- **Contract ID:** ${contract.contractId}`)
      rawLines.push(`- **State:** ${contract.state}`)
      rawLines.push(`- **Agency:** ${contract.agency}`)
      if (contract.description) {
        rawLines.push(`- **Description:** ${contract.description.substring(0, 200)}`)
      }
      if (contract.awardDate) {
        rawLines.push(`- **Award Date:** ${contract.awardDate}`)
      }
      if (contract.startDate || contract.endDate) {
        rawLines.push(`- **Period:** ${contract.startDate || "?"} to ${contract.endDate || "?"}`)
      }
      if (contract.contractType) {
        rawLines.push(`- **Type:** ${contract.contractType}`)
      }
      if (contract.status) {
        rawLines.push(`- **Status:** ${contract.status}`)
      }
      rawLines.push("")
    }

    if (allContracts.length > 20) {
      rawLines.push(`*... and ${allContracts.length - 20} more contracts*`)
    }
  } else {
    rawLines.push(`## Results`)
    rawLines.push(`No state government contracts found for "${searchTerm}" in the searched states.`)
    rawLines.push("")
    rawLines.push(`**Note:** For federal contracts, use the usaspending_awards tool.`)
  }

  return {
    query: { vendorName: searchTerm, state: states.join(", ") },
    contracts: allContracts,
    summary,
    rawContent: rawLines.join("\n"),
    sources,
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const stateContractsSchema = z.object({
  searchTerm: z
    .string()
    .describe("Company name or vendor name to search for (e.g., 'Microsoft', 'Smith Consulting')"),
  states: z
    .array(z.string())
    .optional()
    .default(["CA", "NY", "TX", "FL", "IL"])
    .describe("Two-letter state codes to search (default: CA, NY, TX, FL, IL). Available: CA, NY, TX, FL, IL, OH, CO, MA"),
})

export const stateContractsTool = (tool as any)({
  description:
    "Search STATE-level government contracts and purchasing records. " +
    "Reveals business relationships with state/local government. " +
    "Covers: CA, NY, TX, FL, IL, OH, CO, MA (8 states = ~50% US population). " +
    "Returns: contract values, agencies, dates, descriptions. " +
    "WEALTH INDICATOR: $1M+ in state contracts suggests successful business. " +
    "Use IN ADDITION to usaspending_awards for complete government contracting picture.",

  parameters: stateContractsSchema,

  execute: async ({ searchTerm, states }: { searchTerm: string; states?: string[] }): Promise<StateContractsResult> => {
    return searchStateContracts(searchTerm, states)
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableStateContractsTool(): boolean {
  // Always enabled - uses free public APIs
  return true
}

export { searchStateContracts }
