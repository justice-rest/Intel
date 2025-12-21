/**
 * Lobbyist Search Tool
 *
 * Searches state/local lobbyist registries via Socrata APIs.
 * Lobbyists are typically well-connected and well-compensated.
 *
 * Coverage:
 * - New York State: data.ny.gov - Registered Lobbyists
 * - Chicago: data.cityofchicago.org - Lobbyist Registry
 * - LA City: data.lacity.org - Registered Lobbyists
 * - Washington State: data.wa.gov - Lobbyist Compensation
 * - Colorado: data.colorado.gov - Professional Lobbyist Directory
 *
 * Use Cases:
 * - Verify lobbyist registration
 * - Discover political connections
 * - Wealth indicator (lobbyists are well-compensated)
 *
 * Data Sources: All FREE, no API key required
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// TYPES
// ============================================================================

export interface Lobbyist {
  name: string
  firmName?: string
  clients?: string[]
  compensation?: number
  registrationDate?: string
  expirationDate?: string
  status: "active" | "inactive" | "unknown"
  address?: string
  city?: string
  state: string
  source: string
}

export interface LobbyistSearchResult {
  searchTerm: string
  lobbyists: Lobbyist[]
  summary: {
    totalFound: number
    activeCount: number
    totalCompensation: number
    clients: string[]
    firms: string[]
    wealthIndicator: "high" | "medium" | "unknown"
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// LOBBYIST ENDPOINTS
// ============================================================================

interface LobbyistEndpoint {
  name: string
  state: string
  portal: string
  datasetId: string
  fields: {
    name?: string
    firstName?: string
    lastName?: string
    firmName?: string
    clients?: string
    compensation?: string
    registrationDate?: string
    expirationDate?: string
    status?: string
    address?: string
    city?: string
  }
}

const LOBBYIST_ENDPOINTS: LobbyistEndpoint[] = [
  // New York State
  {
    name: "NY State Registered Lobbyists",
    state: "NY",
    portal: "https://data.ny.gov/resource",
    datasetId: "djsm-9cw7",
    fields: {
      name: "lobbyist_name",
      firmName: "lobbyist_name",
      clients: "principal_client_name",
      registrationDate: "registration_date",
    },
  },
  // Chicago
  {
    name: "Chicago Lobbyist Registry",
    state: "IL",
    portal: "https://data.cityofchicago.org/resource",
    datasetId: "tq3e-t5yq",
    fields: {
      firstName: "first_name",
      lastName: "last_name",
      firmName: "employer",
      registrationDate: "registration_start_date",
      expirationDate: "registration_end_date",
      address: "address",
      city: "city",
    },
  },
  // LA City
  {
    name: "LA City Registered Lobbyists",
    state: "CA",
    portal: "https://data.lacity.org/resource",
    datasetId: "j4zm-9kqu",
    fields: {
      name: "lobbyist_name",
      firmName: "lobbying_firm",
      registrationDate: "registration_date",
      status: "status",
    },
  },
  // Washington State
  {
    name: "Washington Lobbyist Compensation",
    state: "WA",
    portal: "https://data.wa.gov/resource",
    datasetId: "9nnw-c693",
    fields: {
      name: "lobbyist_name",
      firmName: "employer_name",
      compensation: "compensation",
    },
  },
  // Colorado
  {
    name: "Colorado Professional Lobbyists",
    state: "CO",
    portal: "https://data.colorado.gov/resource",
    datasetId: "yk7f-aegj",
    fields: {
      firstName: "first_name",
      lastName: "last_name",
      firmName: "lobbying_firm",
      clients: "client_name",
      registrationDate: "registration_date",
      status: "status",
    },
  },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  }
  return `$${(amount / 1000).toFixed(0)}K`
}

async function queryLobbyistEndpoint(
  endpoint: LobbyistEndpoint,
  searchTerm: string
): Promise<Lobbyist[]> {
  const lobbyists: Lobbyist[] = []

  try {
    // Parse name
    const nameParts = searchTerm.trim().split(/\s+/)
    const lastName = nameParts[nameParts.length - 1]

    // Build SoQL query
    let whereClause: string
    if (endpoint.fields.firstName && endpoint.fields.lastName) {
      whereClause = `upper(${endpoint.fields.lastName}) like '%${lastName.toUpperCase()}%'`
    } else if (endpoint.fields.name) {
      whereClause = `upper(${endpoint.fields.name}) like '%${searchTerm.toUpperCase()}%'`
    } else {
      return []
    }

    const url = `${endpoint.portal}/${endpoint.datasetId}.json?$where=${encodeURIComponent(whereClause)}&$limit=50`

    console.log(`[LobbyistSearch] Querying ${endpoint.name}: ${url}`)

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Romy-Prospect-Research/1.0",
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`[LobbyistSearch] ${endpoint.name} API error: ${response.status}`)
      return []
    }

    const data = await response.json()

    if (!Array.isArray(data)) {
      return []
    }

    for (const record of data) {
      // Build name
      let name: string
      if (endpoint.fields.firstName && endpoint.fields.lastName) {
        name = `${record[endpoint.fields.firstName] || ""} ${record[endpoint.fields.lastName] || ""}`.trim()
      } else if (endpoint.fields.name) {
        name = String(record[endpoint.fields.name] || "")
      } else {
        continue // Skip if no name field available
      }

      if (!name) continue

      // Filter by first name
      const firstName = nameParts[0]?.toUpperCase() || ""
      if (firstName && !name.toUpperCase().includes(firstName)) {
        continue
      }

      const lobbyist: Lobbyist = {
        name,
        state: endpoint.state,
        source: endpoint.name,
        status: "active",
      }

      if (endpoint.fields.firmName && record[endpoint.fields.firmName]) {
        lobbyist.firmName = String(record[endpoint.fields.firmName])
      }
      if (endpoint.fields.clients && record[endpoint.fields.clients]) {
        const clientStr = String(record[endpoint.fields.clients])
        lobbyist.clients = clientStr.includes(",") ? clientStr.split(",").map((c) => c.trim()) : [clientStr]
      }
      if (endpoint.fields.compensation && record[endpoint.fields.compensation]) {
        lobbyist.compensation = parseFloat(String(record[endpoint.fields.compensation]).replace(/[^0-9.-]/g, "")) || 0
      }
      if (endpoint.fields.registrationDate && record[endpoint.fields.registrationDate]) {
        lobbyist.registrationDate = String(record[endpoint.fields.registrationDate])
      }
      if (endpoint.fields.status && record[endpoint.fields.status]) {
        const status = String(record[endpoint.fields.status]).toLowerCase()
        lobbyist.status = status.includes("active") ? "active" : status.includes("inactive") ? "inactive" : "unknown"
      }
      if (endpoint.fields.city && record[endpoint.fields.city]) {
        lobbyist.city = String(record[endpoint.fields.city])
      }

      lobbyists.push(lobbyist)
    }

    console.log(`[LobbyistSearch] Found ${lobbyists.length} lobbyists in ${endpoint.name}`)
  } catch (error) {
    console.error(`[LobbyistSearch] Error querying ${endpoint.name}:`, error)
  }

  return lobbyists
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

async function searchLobbyists(
  searchTerm: string,
  states: string[] = ["NY", "IL", "CA", "WA", "CO"]
): Promise<LobbyistSearchResult> {
  console.log(`[LobbyistSearch] Searching for "${searchTerm}" in states: ${states.join(", ")}`)

  const allLobbyists: Lobbyist[] = []
  const sources: Array<{ name: string; url: string }> = []

  // Find matching endpoints
  const endpoints = LOBBYIST_ENDPOINTS.filter((e) =>
    states.map((s) => s.toUpperCase()).includes(e.state)
  )

  // Query each endpoint in parallel
  const endpointPromises = endpoints.map(async (endpoint) => {
    sources.push({
      name: endpoint.name,
      url: endpoint.portal.replace("/resource", ""),
    })
    return queryLobbyistEndpoint(endpoint, searchTerm)
  })

  const results = await Promise.all(endpointPromises)
  for (const lobbyists of results) {
    allLobbyists.push(...lobbyists)
  }

  // Calculate summary
  const activeCount = allLobbyists.filter((l) => l.status === "active").length
  const totalCompensation = allLobbyists.reduce((sum, l) => sum + (l.compensation || 0), 0)
  const clients = [...new Set(allLobbyists.flatMap((l) => l.clients || []))]
  const firms = [...new Set(allLobbyists.map((l) => l.firmName).filter(Boolean) as string[])]

  // Build raw content
  const rawLines: string[] = []
  rawLines.push(`# Lobbyist Search: ${searchTerm}`)
  rawLines.push("")
  rawLines.push(`## Summary`)
  rawLines.push(`- **Total Lobbyists Found:** ${allLobbyists.length}`)
  rawLines.push(`- **Active Registrations:** ${activeCount}`)
  if (totalCompensation > 0) {
    rawLines.push(`- **Total Compensation:** ${formatCurrency(totalCompensation)}`)
  }
  rawLines.push(`- **Wealth Indicator:** HIGH (lobbyists are well-compensated)`)

  if (clients.length > 0) {
    rawLines.push(`- **Clients:** ${clients.slice(0, 10).join(", ")}`)
  }
  if (firms.length > 0) {
    rawLines.push(`- **Firms:** ${firms.slice(0, 5).join(", ")}`)
  }
  rawLines.push("")

  if (allLobbyists.length > 0) {
    rawLines.push(`## Lobbyist Registrations`)
    rawLines.push("")

    for (const lobbyist of allLobbyists.slice(0, 20)) {
      rawLines.push(`### ${lobbyist.name}`)
      rawLines.push(`- **State:** ${lobbyist.state}`)
      rawLines.push(`- **Status:** ${lobbyist.status.toUpperCase()}`)
      if (lobbyist.firmName) {
        rawLines.push(`- **Firm:** ${lobbyist.firmName}`)
      }
      if (lobbyist.clients && lobbyist.clients.length > 0) {
        rawLines.push(`- **Clients:** ${lobbyist.clients.slice(0, 5).join(", ")}`)
      }
      if (lobbyist.compensation) {
        rawLines.push(`- **Compensation:** ${formatCurrency(lobbyist.compensation)}`)
      }
      if (lobbyist.registrationDate) {
        rawLines.push(`- **Registered:** ${lobbyist.registrationDate}`)
      }
      rawLines.push("")
    }

    if (allLobbyists.length > 20) {
      rawLines.push(`*... and ${allLobbyists.length - 20} more lobbyists*`)
    }
  } else {
    rawLines.push(`## Results`)
    rawLines.push(`No lobbyist registrations found for "${searchTerm}".`)
    rawLines.push("")
    rawLines.push(`**Note:** This searches state/local lobbyist registries. Federal lobbyists are covered by the lobbying_search tool.`)
    rawLines.push("")
    rawLines.push(`**Wealth Indicator:** Lobbyists are typically well-compensated professionals with strong political connections.`)
  }

  return {
    searchTerm,
    lobbyists: allLobbyists,
    summary: {
      totalFound: allLobbyists.length,
      activeCount,
      totalCompensation,
      clients,
      firms,
      wealthIndicator: allLobbyists.length > 0 ? "high" : "unknown",
    },
    rawContent: rawLines.join("\n"),
    sources,
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const lobbyistSearchSchema = z.object({
  searchTerm: z.string().describe("Name of the person to search for"),
  states: z
    .array(z.string())
    .optional()
    .default(["NY", "IL", "CA", "WA", "CO"])
    .describe("State codes to search: NY, IL (Chicago), CA (LA), WA, CO"),
})

export const lobbyistSearchTool = tool({
  description:
    "Search state/local lobbyist registries. " +
    "Lobbyists are well-connected and well-compensated professionals. " +
    "Covers: NY State, Chicago, LA City, Washington State, Colorado. " +
    "Returns: firm, clients, compensation, registration status. " +
    "WEALTH INDICATOR: Lobbyists typically earn $150K-$500K+. " +
    "COMPLEMENTS lobbying_search tool (which covers FEDERAL lobbyists).",

  parameters: lobbyistSearchSchema,

  execute: async ({ searchTerm, states }): Promise<LobbyistSearchResult> => {
    return searchLobbyists(searchTerm, states)
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableLobbyistSearchTool(): boolean {
  return true
}

export { searchLobbyists }
