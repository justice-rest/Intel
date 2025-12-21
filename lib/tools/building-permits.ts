/**
 * Building Permit Search Tool
 *
 * Searches city/county building permit databases via Socrata Open Data APIs.
 * Building permits are a strong wealth indicator - expensive renovations suggest wealth.
 *
 * Coverage:
 * - New York City
 * - Los Angeles
 * - Chicago
 * - San Francisco
 * - Seattle
 * - Boston
 * - Denver
 * - Austin
 * - Philadelphia
 * - Portland
 *
 * Use Cases:
 * - Wealth indicator: $500K renovation permit = high wealth
 * - Property investment: Multiple permits = real estate investor
 * - Recent activity: Shows ongoing property improvements
 *
 * Data Sources: All FREE, no API key required
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// TYPES
// ============================================================================

export interface BuildingPermit {
  permitNumber: string
  type: string
  description: string
  estimatedCost?: number
  address: string
  city: string
  state: string
  issueDate?: string
  status: string
  contractor?: string
  ownerName?: string
}

export interface BuildingPermitResult {
  query: {
    address?: string
    ownerName?: string
    city: string
    state: string
  }
  permits: BuildingPermit[]
  summary: {
    totalPermits: number
    totalEstimatedValue: number
    recentActivity: boolean
    wealthIndicator: "high" | "medium" | "low" | "unknown"
    permitTypes: string[]
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// CITY PERMIT ENDPOINTS
// ============================================================================

interface PermitEndpoint {
  name: string
  city: string
  state: string
  portal: string
  datasetId: string
  fields: {
    permitNumber: string
    type: string
    description: string
    estimatedCost?: string
    address: string
    issueDate?: string
    status: string
    contractor?: string
    ownerName?: string
  }
}

const PERMIT_ENDPOINTS: PermitEndpoint[] = [
  // New York City
  {
    name: "NYC DOB Permits",
    city: "New York",
    state: "NY",
    portal: "https://data.cityofnewyork.us/resource",
    datasetId: "ipu4-2vj7", // DOB Permit Issuance
    fields: {
      permitNumber: "job__",
      type: "job_type",
      description: "job_description",
      estimatedCost: "initial_cost",
      address: "house__",
      issueDate: "issuance_date",
      status: "job_status",
      ownerName: "owner_s_first_name",
    },
  },
  // Los Angeles
  {
    name: "LA Building Permits",
    city: "Los Angeles",
    state: "CA",
    portal: "https://data.lacity.org/resource",
    datasetId: "yv23-pmwf", // Building permits
    fields: {
      permitNumber: "pcis_permit",
      type: "permit_type",
      description: "work_description",
      estimatedCost: "valuation",
      address: "address",
      issueDate: "issue_date",
      status: "status",
      contractor: "contractor",
    },
  },
  // Chicago
  {
    name: "Chicago Building Permits",
    city: "Chicago",
    state: "IL",
    portal: "https://data.cityofchicago.org/resource",
    datasetId: "ydr8-5enu", // Building permits
    fields: {
      permitNumber: "permit_",
      type: "permit_type",
      description: "work_description",
      estimatedCost: "reported_cost",
      address: "street_number",
      issueDate: "issue_date",
      status: "permit_status",
      contractor: "contractor_1_name",
    },
  },
  // San Francisco
  {
    name: "SF Building Permits",
    city: "San Francisco",
    state: "CA",
    portal: "https://data.sfgov.org/resource",
    datasetId: "i98e-djp9", // Building permits
    fields: {
      permitNumber: "permit_number",
      type: "permit_type_definition",
      description: "description",
      estimatedCost: "estimated_cost",
      address: "street_number",
      issueDate: "issued_date",
      status: "status",
      contractor: "contractor_company",
    },
  },
  // Seattle
  {
    name: "Seattle Building Permits",
    city: "Seattle",
    state: "WA",
    portal: "https://data.seattle.gov/resource",
    datasetId: "76t5-zqzr", // Building permits
    fields: {
      permitNumber: "permit_number",
      type: "permit_type",
      description: "description",
      estimatedCost: "value",
      address: "address",
      issueDate: "issue_date",
      status: "status",
      contractor: "contractor",
    },
  },
  // Boston
  {
    name: "Boston Building Permits",
    city: "Boston",
    state: "MA",
    portal: "https://data.boston.gov/resource",
    datasetId: "hfgw-p5wb", // Approved permits
    fields: {
      permitNumber: "permitnumber",
      type: "worktype",
      description: "description",
      estimatedCost: "total_fees",
      address: "address",
      issueDate: "issued_date",
      status: "status",
      ownerName: "owner",
    },
  },
  // Denver
  {
    name: "Denver Building Permits",
    city: "Denver",
    state: "CO",
    portal: "https://data.denvergov.org/resource",
    datasetId: "ew69-9f4g", // Building permits
    fields: {
      permitNumber: "permit_no",
      type: "permit_type",
      description: "description",
      estimatedCost: "construction_cost",
      address: "full_address",
      issueDate: "permit_issued_date",
      status: "status_current",
      contractor: "contractor_name",
    },
  },
  // Austin
  {
    name: "Austin Building Permits",
    city: "Austin",
    state: "TX",
    portal: "https://data.austintexas.gov/resource",
    datasetId: "3syk-w9eu", // Issued permits
    fields: {
      permitNumber: "permit_number",
      type: "permit_type",
      description: "work_description",
      estimatedCost: "project_valuation",
      address: "original_address1",
      issueDate: "issued_date",
      status: "status_current",
      contractor: "contractor_company_name",
    },
  },
  // Philadelphia
  {
    name: "Philadelphia Permits & Licenses",
    city: "Philadelphia",
    state: "PA",
    portal: "https://phl.carto.com/api/v2/sql",
    datasetId: "permits", // L&I permits
    fields: {
      permitNumber: "permitnumber",
      type: "permittype",
      description: "permitdescription",
      estimatedCost: "approx_cost",
      address: "address",
      issueDate: "permitissuedate",
      status: "status",
      contractor: "contractorname",
    },
  },
  // Portland
  {
    name: "Portland Building Permits",
    city: "Portland",
    state: "OR",
    portal: "https://data.portlandoregon.gov/resource",
    datasetId: "t5jw-ykg3", // Building permits
    fields: {
      permitNumber: "permit_number",
      type: "permit_type",
      description: "work_description",
      estimatedCost: "valuation",
      address: "address",
      issueDate: "issue_date",
      status: "status",
      contractor: "contractor",
    },
  },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine wealth indicator from permit values
 */
function getWealthIndicator(totalValue: number): "high" | "medium" | "low" | "unknown" {
  if (totalValue >= 500000) return "high"
  if (totalValue >= 100000) return "medium"
  if (totalValue > 0) return "low"
  return "unknown"
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

/**
 * Check if date is within last 2 years
 */
function isRecent(dateStr: string): boolean {
  try {
    const date = new Date(dateStr)
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    return date >= twoYearsAgo
  } catch {
    return false
  }
}

/**
 * Query a permit endpoint
 */
async function queryPermitEndpoint(
  endpoint: PermitEndpoint,
  address?: string,
  ownerName?: string
): Promise<BuildingPermit[]> {
  const permits: BuildingPermit[] = []

  try {
    // Build SoQL query
    const whereParts: string[] = []

    if (address) {
      const normalizedAddress = address.toUpperCase().replace(/[^\w\s]/g, "").trim()
      whereParts.push(`upper(${endpoint.fields.address}) like '%${normalizedAddress}%'`)
    }

    if (ownerName && endpoint.fields.ownerName) {
      const lastName = ownerName.split(/\s+/).pop()?.toUpperCase() || ""
      whereParts.push(`upper(${endpoint.fields.ownerName}) like '%${lastName}%'`)
    }

    if (whereParts.length === 0) {
      return []
    }

    const whereClause = encodeURIComponent(whereParts.join(" OR "))
    const url = `${endpoint.portal}/${endpoint.datasetId}.json?$where=${whereClause}&$limit=50&$order=${endpoint.fields.issueDate || endpoint.fields.permitNumber} DESC`

    console.log(`[BuildingPermits] Querying ${endpoint.name}: ${url}`)

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Romy-Prospect-Research/1.0",
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`[BuildingPermits] ${endpoint.name} API error: ${response.status}`)
      return []
    }

    const data = await response.json()

    if (!Array.isArray(data)) {
      return []
    }

    for (const record of data) {
      const permit: BuildingPermit = {
        permitNumber: String(record[endpoint.fields.permitNumber] || ""),
        type: String(record[endpoint.fields.type] || "Unknown"),
        description: String(record[endpoint.fields.description] || ""),
        address: String(record[endpoint.fields.address] || ""),
        city: endpoint.city,
        state: endpoint.state,
        status: String(record[endpoint.fields.status] || "Unknown"),
      }

      if (endpoint.fields.estimatedCost && record[endpoint.fields.estimatedCost]) {
        const cost = parseFloat(String(record[endpoint.fields.estimatedCost]).replace(/[^0-9.]/g, ""))
        if (!isNaN(cost)) {
          permit.estimatedCost = cost
        }
      }

      if (endpoint.fields.issueDate && record[endpoint.fields.issueDate]) {
        permit.issueDate = String(record[endpoint.fields.issueDate])
      }

      if (endpoint.fields.contractor && record[endpoint.fields.contractor]) {
        permit.contractor = String(record[endpoint.fields.contractor])
      }

      if (endpoint.fields.ownerName && record[endpoint.fields.ownerName]) {
        permit.ownerName = String(record[endpoint.fields.ownerName])
      }

      permits.push(permit)
    }

    console.log(`[BuildingPermits] Found ${permits.length} permits in ${endpoint.name}`)
  } catch (error) {
    console.error(`[BuildingPermits] Error querying ${endpoint.name}:`, error)
  }

  return permits
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

async function searchBuildingPermits(
  city: string,
  state: string,
  address?: string,
  ownerName?: string
): Promise<BuildingPermitResult> {
  console.log(`[BuildingPermits] Searching in ${city}, ${state}`)

  const baseResult: Omit<BuildingPermitResult, "rawContent"> = {
    query: { address, ownerName, city, state },
    permits: [],
    summary: {
      totalPermits: 0,
      totalEstimatedValue: 0,
      recentActivity: false,
      wealthIndicator: "unknown",
      permitTypes: [],
    },
    sources: [],
  }

  if (!address && !ownerName) {
    return {
      ...baseResult,
      error: "Must provide either address or ownerName to search",
      rawContent: "Error: Must provide either address or ownerName to search",
    }
  }

  // Find matching endpoint
  const normalizedCity = city.toLowerCase().replace(/[^a-z]/g, "")
  const normalizedState = state.toUpperCase()

  const endpoint = PERMIT_ENDPOINTS.find(
    (e) =>
      e.city.toLowerCase().replace(/[^a-z]/g, "") === normalizedCity &&
      e.state === normalizedState
  )

  if (!endpoint) {
    const supportedCities = PERMIT_ENDPOINTS.map((e) => `${e.city}, ${e.state}`).join(", ")
    return {
      ...baseResult,
      error: `City "${city}, ${state}" is not supported. Supported cities: ${supportedCities}`,
      rawContent: `Error: City not supported. Supported cities: ${supportedCities}`,
    }
  }

  // Query permits
  const permits = await queryPermitEndpoint(endpoint, address, ownerName)

  // Calculate summary
  const totalEstimatedValue = permits.reduce((sum, p) => sum + (p.estimatedCost || 0), 0)
  const recentActivity = permits.some((p) => p.issueDate && isRecent(p.issueDate))
  const permitTypes = [...new Set(permits.map((p) => p.type))]

  const result: Omit<BuildingPermitResult, "rawContent"> = {
    query: { address, ownerName, city, state },
    permits,
    summary: {
      totalPermits: permits.length,
      totalEstimatedValue,
      recentActivity,
      wealthIndicator: getWealthIndicator(totalEstimatedValue),
      permitTypes,
    },
    sources: [
      {
        name: endpoint.name,
        url: endpoint.portal.replace("/resource", ""),
      },
    ],
  }

  // Build raw content
  const rawLines: string[] = []
  rawLines.push(`# Building Permit Search: ${city}, ${state}`)
  rawLines.push("")
  rawLines.push(`## Query`)
  if (address) rawLines.push(`- **Address:** ${address}`)
  if (ownerName) rawLines.push(`- **Owner:** ${ownerName}`)
  rawLines.push("")

  rawLines.push(`## Summary`)
  rawLines.push(`- **Total Permits:** ${permits.length}`)
  rawLines.push(`- **Total Estimated Value:** ${formatCurrency(totalEstimatedValue)}`)
  rawLines.push(`- **Recent Activity (2 years):** ${recentActivity ? "Yes" : "No"}`)
  rawLines.push(`- **Wealth Indicator:** ${result.summary.wealthIndicator.toUpperCase()}`)
  if (permitTypes.length > 0) {
    rawLines.push(`- **Permit Types:** ${permitTypes.join(", ")}`)
  }
  rawLines.push("")

  if (permits.length > 0) {
    rawLines.push(`## Permits Found`)
    rawLines.push("")

    for (const permit of permits.slice(0, 20)) {
      rawLines.push(`### ${permit.type} - ${permit.permitNumber}`)
      rawLines.push(`- **Address:** ${permit.address}`)
      if (permit.description) {
        rawLines.push(`- **Description:** ${permit.description.substring(0, 200)}`)
      }
      if (permit.estimatedCost) {
        rawLines.push(`- **Estimated Cost:** ${formatCurrency(permit.estimatedCost)}`)
      }
      if (permit.issueDate) {
        rawLines.push(`- **Issue Date:** ${permit.issueDate}`)
      }
      rawLines.push(`- **Status:** ${permit.status}`)
      if (permit.contractor) {
        rawLines.push(`- **Contractor:** ${permit.contractor}`)
      }
      rawLines.push("")
    }

    if (permits.length > 20) {
      rawLines.push(`*... and ${permits.length - 20} more permits*`)
    }
  } else {
    rawLines.push(`## Results`)
    rawLines.push(`No building permits found matching the search criteria.`)
  }

  return {
    ...result,
    rawContent: rawLines.join("\n"),
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const buildingPermitSchema = z.object({
  city: z.string().describe("City name (e.g., 'New York', 'Los Angeles', 'Chicago')"),
  state: z.string().describe("Two-letter state code (e.g., 'NY', 'CA', 'IL')"),
  address: z.string().optional().describe("Property address to search for"),
  ownerName: z.string().optional().describe("Property owner name to search for"),
})

export const buildingPermitTool = tool({
  description:
    "Search city building permit databases for renovation/construction activity. " +
    "WEALTH INDICATOR: $500K+ permit value suggests high wealth. " +
    "Cities covered: NYC, LA, Chicago, San Francisco, Seattle, Boston, Denver, Austin, Philadelphia, Portland. " +
    "Returns: permit type, estimated cost, issue date, contractor. " +
    "Use to verify property improvements and assess wealth from construction activity.",

  parameters: buildingPermitSchema,

  execute: async ({ city, state, address, ownerName }): Promise<BuildingPermitResult> => {
    return searchBuildingPermits(city, state, address, ownerName)
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableBuildingPermitTool(): boolean {
  // Always enabled - uses free public APIs
  return true
}

export { searchBuildingPermits }
