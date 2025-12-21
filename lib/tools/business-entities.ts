/**
 * Business Entities Search Tool
 *
 * Searches state business registries via Socrata Open Data APIs.
 * Finds corporations, LLCs, and other business entities by name or agent/officer.
 *
 * Coverage:
 * - Connecticut: data.ct.gov - Business Registry (BEST-IN-CLASS, updated nightly)
 * - New York: data.ny.gov - Active Corporations (1.8M+ entities)
 * - Colorado: data.colorado.gov - Business Entities (2M+ entities)
 * - Oregon: data.oregon.gov - Active Businesses (500K+ entities)
 * - Iowa: mydata.iowa.gov - Active Business Entities
 * - Washington: data.wa.gov - Corporations Search
 *
 * Use Cases:
 * - Find what businesses a person owns/controls (search by agent name)
 * - Verify business ownership claims
 * - Discover corporate affiliations
 *
 * Data Sources: All FREE, no API key required
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// TYPES
// ============================================================================

export interface BusinessEntity {
  entityName: string
  entityId: string
  entityType: string
  status: string
  formationDate?: string
  jurisdiction?: string
  agentName?: string
  agentAddress?: string
  principalAddress?: string
  state: string
  source: string
}

export interface BusinessEntitiesResult {
  query: {
    searchTerm: string
    searchType: "entity" | "agent" | "any"
    states: string[]
  }
  entities: BusinessEntity[]
  summary: {
    totalFound: number
    byState: Record<string, number>
    byType: Record<string, number>
    activeCount: number
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// STATE ENDPOINTS
// ============================================================================

interface BusinessEndpoint {
  name: string
  state: string
  portal: string
  datasetId: string
  fields: {
    entityName: string
    entityId: string
    entityType: string
    status?: string
    formationDate?: string
    jurisdiction?: string
    agentName?: string
    agentFirstName?: string
    agentLastName?: string
    agentAddress?: string
    principalAddress?: string
    principalCity?: string
    principalState?: string
  }
  searchableAgentField?: string
}

const BUSINESS_ENDPOINTS: BusinessEndpoint[] = [
  // Connecticut - Best-in-class, FREE, updated nightly
  {
    name: "Connecticut Secretary of State",
    state: "CT",
    portal: "https://data.ct.gov/resource",
    datasetId: "n7gp-d28j",
    fields: {
      entityName: "business_name",
      entityId: "business_id",
      entityType: "business_type",
      status: "status",
      formationDate: "formation_date",
      jurisdiction: "state_country_of_origin",
      principalAddress: "principal_office_address",
    },
    // CT has a separate agents dataset (egd5-wb6r) - we'll search main registry only
  },
  // New York - Active Corporations (1.8M+ entities)
  {
    name: "New York Department of State",
    state: "NY",
    portal: "https://data.ny.gov/resource",
    datasetId: "n9v6-gdp6",
    fields: {
      entityName: "current_entity_name",
      entityId: "dos_id",
      entityType: "entity_type",
      formationDate: "initial_dos_filing_date",
      jurisdiction: "jurisdiction",
      agentName: "dos_process_name",
      agentAddress: "dos_process_address_1",
      principalCity: "dos_process_city",
      principalState: "dos_process_state",
    },
    searchableAgentField: "dos_process_name",
  },
  // Colorado - Business Entities (2M+ entities)
  {
    name: "Colorado Secretary of State",
    state: "CO",
    portal: "https://data.colorado.gov/resource",
    datasetId: "4ykn-tg5h",
    fields: {
      entityName: "entityname",
      entityId: "entityid",
      entityType: "entitytype",
      status: "entitystatus",
      formationDate: "entityformdate",
      jurisdiction: "jurisdictonofformation",
      agentFirstName: "agentfirstname",
      agentLastName: "agentlastname",
      agentAddress: "agentprincipaladdress1",
      principalAddress: "principaladdress1",
      principalCity: "principalcity",
      principalState: "principalstate",
    },
  },
  // Oregon - Active Businesses (500K+ entities)
  {
    name: "Oregon Secretary of State",
    state: "OR",
    portal: "https://data.oregon.gov/resource",
    datasetId: "tckn-sxa6",
    fields: {
      entityName: "business_name",
      entityId: "registry_number",
      entityType: "entity_type",
      formationDate: "registry_date",
      jurisdiction: "jurisdiction",
      agentName: "associated_name_type",
      principalAddress: "address",
      principalCity: "city",
      principalState: "state",
    },
  },
  // Iowa - Active Business Entities
  {
    name: "Iowa Secretary of State",
    state: "IA",
    portal: "https://mydata.iowa.gov/resource",
    datasetId: "ez5t-3qay",
    fields: {
      entityName: "legal_name",
      entityId: "corp_number",
      entityType: "corporation_type",
      formationDate: "effective_date",
    },
  },
  // Washington - Corporations
  {
    name: "Washington Secretary of State",
    state: "WA",
    portal: "https://data.wa.gov/resource",
    datasetId: "f9jk-mm39",
    fields: {
      entityName: "ubi_name",
      entityId: "ubi",
      entityType: "business_type",
      status: "ubi_status",
      formationDate: "ubi_create_date",
      principalCity: "ubi_city",
      principalState: "ubi_state",
    },
  },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalizeStatus(status: string | undefined): string {
  if (!status) return "Unknown"
  const s = status.toUpperCase()
  if (s.includes("ACTIVE") || s.includes("GOOD")) return "Active"
  if (s.includes("INACTIVE") || s.includes("DISSOLVED")) return "Inactive"
  if (s.includes("DELINQUENT")) return "Delinquent"
  return status
}

async function queryBusinessEndpoint(
  endpoint: BusinessEndpoint,
  searchTerm: string,
  searchType: "entity" | "agent" | "any"
): Promise<BusinessEntity[]> {
  const entities: BusinessEntity[] = []

  try {
    // Build SoQL query based on search type
    let whereClause: string

    if (searchType === "agent") {
      // Search by agent/registered agent name
      if (endpoint.fields.agentFirstName && endpoint.fields.agentLastName) {
        // Colorado has separate first/last name fields
        const nameParts = searchTerm.trim().split(/\s+/)
        const lastName = nameParts[nameParts.length - 1]
        whereClause = `upper(${endpoint.fields.agentLastName}) like '%${lastName.toUpperCase()}%'`
      } else if (endpoint.searchableAgentField) {
        whereClause = `upper(${endpoint.searchableAgentField}) like '%${searchTerm.toUpperCase()}%'`
      } else if (endpoint.fields.agentName) {
        whereClause = `upper(${endpoint.fields.agentName}) like '%${searchTerm.toUpperCase()}%'`
      } else {
        // Endpoint doesn't support agent search
        return []
      }
    } else if (searchType === "entity") {
      whereClause = `upper(${endpoint.fields.entityName}) like '%${searchTerm.toUpperCase()}%'`
    } else {
      // Search both entity name and agent if possible
      if (endpoint.fields.agentName || endpoint.searchableAgentField) {
        const agentField = endpoint.searchableAgentField || endpoint.fields.agentName
        whereClause = `upper(${endpoint.fields.entityName}) like '%${searchTerm.toUpperCase()}%' OR upper(${agentField}) like '%${searchTerm.toUpperCase()}%'`
      } else {
        whereClause = `upper(${endpoint.fields.entityName}) like '%${searchTerm.toUpperCase()}%'`
      }
    }

    const url = `${endpoint.portal}/${endpoint.datasetId}.json?$where=${encodeURIComponent(whereClause)}&$limit=50`

    console.log(`[BusinessEntities] Querying ${endpoint.name}: ${url}`)

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Romy-Prospect-Research/1.0",
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`[BusinessEntities] ${endpoint.name} API error: ${response.status}`)
      return []
    }

    const data = await response.json()

    if (!Array.isArray(data)) {
      return []
    }

    for (const record of data) {
      // Build agent name from parts if needed
      let agentName = endpoint.fields.agentName ? (record[endpoint.fields.agentName] || "") : ""
      if (endpoint.fields.agentFirstName && endpoint.fields.agentLastName) {
        const first = record[endpoint.fields.agentFirstName] || ""
        const last = record[endpoint.fields.agentLastName] || ""
        agentName = `${first} ${last}`.trim()
      }

      // Build principal address
      let principalAddress = endpoint.fields.principalAddress ? (record[endpoint.fields.principalAddress] || "") : ""
      if (endpoint.fields.principalCity && endpoint.fields.principalState) {
        const city = record[endpoint.fields.principalCity] || ""
        const state = record[endpoint.fields.principalState] || ""
        if (city || state) {
          principalAddress = principalAddress ? `${principalAddress}, ${city}, ${state}` : `${city}, ${state}`
        }
      }

      const entity: BusinessEntity = {
        entityName: String(record[endpoint.fields.entityName] || ""),
        entityId: String(record[endpoint.fields.entityId] || ""),
        entityType: String(record[endpoint.fields.entityType] || "Unknown"),
        status: normalizeStatus(endpoint.fields.status ? record[endpoint.fields.status] : undefined),
        state: endpoint.state,
        source: endpoint.name,
      }

      if (endpoint.fields.formationDate && record[endpoint.fields.formationDate]) {
        entity.formationDate = String(record[endpoint.fields.formationDate])
      }
      if (endpoint.fields.jurisdiction && record[endpoint.fields.jurisdiction]) {
        entity.jurisdiction = String(record[endpoint.fields.jurisdiction])
      }
      if (agentName) {
        entity.agentName = agentName
      }
      if (endpoint.fields.agentAddress && record[endpoint.fields.agentAddress]) {
        entity.agentAddress = String(record[endpoint.fields.agentAddress])
      }
      if (principalAddress) {
        entity.principalAddress = principalAddress
      }

      entities.push(entity)
    }

    console.log(`[BusinessEntities] Found ${entities.length} entities in ${endpoint.name}`)
  } catch (error) {
    console.error(`[BusinessEntities] Error querying ${endpoint.name}:`, error)
  }

  return entities
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

async function searchBusinessEntities(
  searchTerm: string,
  searchType: "entity" | "agent" | "any" = "any",
  states: string[] = ["CT", "NY", "CO", "OR", "IA", "WA"]
): Promise<BusinessEntitiesResult> {
  console.log(`[BusinessEntities] Searching for "${searchTerm}" (${searchType}) in states: ${states.join(", ")}`)

  const allEntities: BusinessEntity[] = []
  const sources: Array<{ name: string; url: string }> = []

  // Find matching endpoints
  const endpoints = BUSINESS_ENDPOINTS.filter((e) =>
    states.map((s) => s.toUpperCase()).includes(e.state)
  )

  // Query each endpoint in parallel
  const endpointPromises = endpoints.map(async (endpoint) => {
    sources.push({
      name: endpoint.name,
      url: endpoint.portal.replace("/resource", ""),
    })
    return queryBusinessEndpoint(endpoint, searchTerm, searchType)
  })

  const results = await Promise.all(endpointPromises)
  for (const entities of results) {
    allEntities.push(...entities)
  }

  // Calculate summary
  const byState: Record<string, number> = {}
  const byType: Record<string, number> = {}
  let activeCount = 0

  for (const entity of allEntities) {
    byState[entity.state] = (byState[entity.state] || 0) + 1
    byType[entity.entityType] = (byType[entity.entityType] || 0) + 1
    if (entity.status === "Active") activeCount++
  }

  // Build raw content
  const rawLines: string[] = []
  rawLines.push(`# Business Entity Search: ${searchTerm}`)
  rawLines.push("")
  rawLines.push(`## Summary`)
  rawLines.push(`- **Total Entities Found:** ${allEntities.length}`)
  rawLines.push(`- **Active Entities:** ${activeCount}`)
  rawLines.push(`- **Search Type:** ${searchType}`)
  rawLines.push(`- **States Searched:** ${states.join(", ")}`)
  rawLines.push("")

  if (Object.keys(byState).length > 0) {
    rawLines.push(`## By State`)
    for (const [state, count] of Object.entries(byState)) {
      rawLines.push(`- **${state}:** ${count}`)
    }
    rawLines.push("")
  }

  if (Object.keys(byType).length > 0) {
    rawLines.push(`## By Entity Type`)
    for (const [type, count] of Object.entries(byType)) {
      rawLines.push(`- **${type}:** ${count}`)
    }
    rawLines.push("")
  }

  if (allEntities.length > 0) {
    rawLines.push(`## Entities Found`)
    rawLines.push("")

    for (const entity of allEntities.slice(0, 30)) {
      rawLines.push(`### ${entity.entityName}`)
      rawLines.push(`- **ID:** ${entity.entityId}`)
      rawLines.push(`- **Type:** ${entity.entityType}`)
      rawLines.push(`- **Status:** ${entity.status}`)
      rawLines.push(`- **State:** ${entity.state}`)
      if (entity.formationDate) {
        rawLines.push(`- **Formed:** ${entity.formationDate}`)
      }
      if (entity.agentName) {
        rawLines.push(`- **Agent/Officer:** ${entity.agentName}`)
      }
      if (entity.principalAddress) {
        rawLines.push(`- **Address:** ${entity.principalAddress}`)
      }
      rawLines.push("")
    }

    if (allEntities.length > 30) {
      rawLines.push(`*... and ${allEntities.length - 30} more entities*`)
    }
  } else {
    rawLines.push(`## Results`)
    rawLines.push(`No business entities found for "${searchTerm}" in the searched states.`)
  }

  return {
    query: { searchTerm, searchType, states },
    entities: allEntities,
    summary: {
      totalFound: allEntities.length,
      byState,
      byType,
      activeCount,
    },
    rawContent: rawLines.join("\n"),
    sources,
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const businessEntitiesSchema = z.object({
  searchTerm: z
    .string()
    .describe("Name to search for - can be a business name or person name (for agent search)"),
  searchType: z
    .enum(["entity", "agent", "any"])
    .optional()
    .default("any")
    .describe("Search type: 'entity' for business names, 'agent' for registered agent/officer names, 'any' for both"),
  states: z
    .array(z.string())
    .optional()
    .default(["CT", "NY", "CO", "OR", "IA", "WA"])
    .describe("Two-letter state codes to search (default: CT, NY, CO, OR, IA, WA)"),
})

export const businessEntitiesTool = tool({
  description:
    "Search state business registries via FREE Socrata APIs. " +
    "Find corporations, LLCs, and business entities by NAME or by AGENT/OFFICER name. " +
    "Covers: CT (best-in-class, updated nightly), NY (1.8M entities), CO (2M entities), OR (500K), IA, WA. " +
    "Use searchType='agent' to find what businesses a PERSON owns/controls. " +
    "Returns: entity name, type, status, formation date, agent name, address. " +
    "COMPLEMENTS find_business_ownership (which uses FL, CA web scrapers).",

  parameters: businessEntitiesSchema,

  execute: async ({ searchTerm, searchType, states }): Promise<BusinessEntitiesResult> => {
    return searchBusinessEntities(searchTerm, searchType, states)
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableBusinessEntitiesTool(): boolean {
  // Always enabled - uses free public APIs
  return true
}

export { searchBusinessEntities }
