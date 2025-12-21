/**
 * State Open Data APIs
 *
 * Free APIs provided by state governments for business entity data.
 * These are official sources with no rate limits or API keys required.
 *
 * Supported states:
 * - Colorado: data.colorado.gov (Socrata API)
 * - New York: data.ny.gov (Socrata API) - see states/new-york.ts
 *
 * More states can be added as they publish open data.
 */

import type { ScrapedBusinessEntity, ScraperResult } from "../config"

/**
 * Colorado Business Entity from Socrata API
 */
interface ColoradoBusinessEntity {
  entityid: string
  entityname: string
  principaladdress1?: string
  principaladdress2?: string
  principalcity?: string
  principalstate?: string
  principalzipcode?: string
  principalcountry?: string
  mailingaddress1?: string
  mailingaddress2?: string
  mailingcity?: string
  mailingstate?: string
  mailingzipcode?: string
  mailingcountry?: string
  entitystatus?: string
  jurisdictonofformation?: string  // Note: typo in their API
  entitytype?: string
  agentfirstname?: string
  agentmiddlename?: string
  agentlastname?: string
  agentorganizationname?: string
  agentprincipaladdress1?: string
  agentprincipaladdress2?: string
  agentprincipalcity?: string
  agentprincipalstate?: string
  agentprincipalzipcode?: string
  agentprincipalcountry?: string
  entityformdate?: string
}

/**
 * Colorado entity types mapping
 */
const COLORADO_ENTITY_TYPES: Record<string, string> = {
  DPC: "Domestic Profit Corporation",
  DLLC: "Domestic Limited Liability Company",
  FPC: "Foreign Profit Corporation",
  FLLC: "Foreign Limited Liability Company",
  DNPC: "Domestic Nonprofit Corporation",
  FNPC: "Foreign Nonprofit Corporation",
  DLP: "Domestic Limited Partnership",
  FLP: "Foreign Limited Partnership",
  DLLLP: "Domestic Limited Liability Limited Partnership",
  FLLLP: "Foreign Limited Liability Limited Partnership",
}

/**
 * Build address string from components
 */
function buildAddress(parts: (string | undefined)[]): string | null {
  const filtered = parts.filter((p) => p && p.trim())
  return filtered.length > 0 ? filtered.join(", ") : null
}

/**
 * Build agent name from components
 */
function buildAgentName(entity: ColoradoBusinessEntity): string | null {
  if (entity.agentorganizationname) {
    return entity.agentorganizationname
  }
  const nameParts = [
    entity.agentfirstname,
    entity.agentmiddlename,
    entity.agentlastname,
  ].filter(Boolean)
  return nameParts.length > 0 ? nameParts.join(" ") : null
}

/**
 * Map Colorado entity to our format
 */
function mapColoradoEntity(entity: ColoradoBusinessEntity): ScrapedBusinessEntity {
  // Parse formation date
  let incorporationDate: string | null = null
  if (entity.entityformdate) {
    const datePart = entity.entityformdate.split("T")[0]
    if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      incorporationDate = datePart
    }
  }

  // Build addresses
  const principalAddress = buildAddress([
    entity.principaladdress1,
    entity.principaladdress2,
    entity.principalcity,
    entity.principalstate,
    entity.principalzipcode,
  ])

  // Map entity type
  const entityTypeCode = entity.entitytype || ""
  const entityType = COLORADO_ENTITY_TYPES[entityTypeCode] || entityTypeCode

  return {
    name: entity.entityname,
    entityNumber: entity.entityid,
    jurisdiction: "us_co",
    status: entity.entitystatus || null,
    incorporationDate,
    entityType,
    registeredAddress: principalAddress,
    registeredAgent: buildAgentName(entity),
    sourceUrl: `https://www.sos.state.co.us/biz/BusinessEntityDetail.do?masterFileId=${entity.entityid}`,
    source: "colorado",
    scrapedAt: new Date().toISOString(),
  }
}

/**
 * Search Colorado business entities via Socrata API
 *
 * Free API, no authentication required.
 * Dataset: https://data.colorado.gov/Business/Business-Entities-in-Colorado/4ykn-tg5h
 */
export async function searchColoradoBusinesses(
  query: string,
  options: {
    limit?: number
    status?: "Good Standing" | "Delinquent" | "all"
  } = {}
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const { limit = 25, status = "all" } = options

  console.log("[Colorado API] Searching:", query)

  try {
    // Build Socrata Query Language (SoQL) query
    // Escape single quotes in query
    const escapedQuery = query.toUpperCase().replace(/'/g, "''")

    const params = new URLSearchParams({
      $limit: limit.toString(),
      $order: "entityformdate DESC",
      $where: `upper(entityname) like '%${escapedQuery}%'`,
    })

    // Add status filter if not "all"
    if (status !== "all") {
      params.set("$where", `${params.get("$where")} AND entitystatus = '${status}'`)
    }

    const url = `https://data.colorado.gov/resource/4ykn-tg5h.json?${params.toString()}`

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Romy/1.0 (Nonprofit Research Tool)",
      },
    })

    if (!response.ok) {
      throw new Error(`Colorado API error: ${response.status}`)
    }

    const data: ColoradoBusinessEntity[] = await response.json()
    const businesses = data.map(mapColoradoEntity)

    console.log(`[Colorado API] Found ${businesses.length} results`)

    return {
      success: true,
      data: businesses,
      totalFound: businesses.length, // Socrata doesn't return total count
      source: "colorado",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[Colorado API] Error:", errorMessage)

    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "colorado",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: errorMessage,
    }
  }
}

/**
 * Search Colorado by registered agent name
 */
export async function searchColoradoByAgent(
  agentName: string,
  options: { limit?: number } = {}
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const { limit = 25 } = options

  console.log("[Colorado API] Searching by agent:", agentName)

  try {
    // Search by agent last name (most reliable)
    const escapedName = agentName.toUpperCase().replace(/'/g, "''")

    // Try to match on last name or organization name
    const whereClause = `upper(agentlastname) like '%${escapedName}%' OR upper(agentorganizationname) like '%${escapedName}%'`

    const params = new URLSearchParams({
      $limit: limit.toString(),
      $order: "entityformdate DESC",
      $where: whereClause,
    })

    const url = `https://data.colorado.gov/resource/4ykn-tg5h.json?${params.toString()}`

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Romy/1.0 (Nonprofit Research Tool)",
      },
    })

    if (!response.ok) {
      throw new Error(`Colorado API error: ${response.status}`)
    }

    const data: ColoradoBusinessEntity[] = await response.json()
    const businesses = data.map(mapColoradoEntity)

    return {
      success: true,
      data: businesses,
      totalFound: businesses.length,
      source: "colorado",
      query: agentName,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "colorado",
      query: agentName,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: errorMessage,
    }
  }
}

/**
 * Get Colorado entity by ID
 */
export async function getColoradoEntity(
  entityId: string
): Promise<ScrapedBusinessEntity | null> {
  try {
    const url = `https://data.colorado.gov/resource/4ykn-tg5h.json?entityid=${entityId}`

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Romy/1.0 (Nonprofit Research Tool)",
      },
    })

    if (!response.ok) {
      return null
    }

    const data: ColoradoBusinessEntity[] = await response.json()
    if (data.length === 0) {
      return null
    }

    return mapColoradoEntity(data[0])
  } catch {
    return null
  }
}

/**
 * Map of available state open data APIs
 * Add more states as they become available
 */
export const STATE_OPEN_DATA_APIS: Record<
  string,
  {
    search: (query: string, options?: { limit?: number }) => Promise<ScraperResult<ScrapedBusinessEntity>>
    searchByAgent?: (agent: string, options?: { limit?: number }) => Promise<ScraperResult<ScrapedBusinessEntity>>
    getById?: (id: string) => Promise<ScrapedBusinessEntity | null>
    description: string
  }
> = {
  CO: {
    search: searchColoradoBusinesses,
    searchByAgent: searchColoradoByAgent,
    getById: getColoradoEntity,
    description: "Colorado Information Marketplace (data.colorado.gov)",
  },
  // NY is in a separate file: states/new-york.ts
  // Add more states here as they publish open data APIs
}

/**
 * Check if a state has an open data API
 */
export function hasStateOpenDataAPI(stateCode: string): boolean {
  return stateCode.toUpperCase() in STATE_OPEN_DATA_APIS
}

/**
 * Get list of states with open data APIs
 */
export function getStatesWithOpenDataAPI(): string[] {
  return Object.keys(STATE_OPEN_DATA_APIS)
}
