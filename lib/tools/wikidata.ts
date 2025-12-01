/**
 * Wikidata Tool
 * Provides access to Wikidata's knowledge graph for biographical research
 * on individuals and organizations.
 *
 * API Reference: https://www.mediawiki.org/wiki/Wikibase/API
 *
 * Features:
 * - Search for people and organizations by name
 * - Get detailed biographical data (education, employers, positions, net worth)
 * - No API key required (free public API)
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// CONSTANTS
// ============================================================================

const WIKIDATA_API_BASE = "https://www.wikidata.org/w/api.php"
const WIKIDATA_TIMEOUT_MS = 15000

/**
 * Key Wikidata property IDs for prospect research
 */
const PROPERTY_IDS = {
  // Core
  instanceOf: "P31",
  // Personal info
  dateOfBirth: "P569",
  dateOfDeath: "P570",
  placeOfBirth: "P19",
  placeOfDeath: "P20",
  countryOfCitizenship: "P27",
  sexOrGender: "P21",
  // Professional
  occupation: "P106",
  employer: "P108",
  positionHeld: "P39",
  memberOf: "P463",
  educatedAt: "P69",
  // Wealth indicators
  netWorth: "P2218",
  // Relationships
  spouse: "P26",
  child: "P40",
  // Recognition
  awardReceived: "P166",
  notableWork: "P800",
  // Links
  officialWebsite: "P856",
  // Organization-specific
  foundedBy: "P112",
  headquartersLocation: "P159",
  industry: "P452",
  numberOfEmployees: "P1128",
} as const

/**
 * Entity type QIDs
 */
const ENTITY_TYPES = {
  human: "Q5",
  business: "Q4830453",
  organization: "Q43229",
  nonprofit: "Q163740",
  company: "Q783794",
} as const

// ============================================================================
// SCHEMAS
// ============================================================================

const wikidataSearchSchema = z.object({
  query: z
    .string()
    .describe("Name of person or organization to search for"),
  type: z
    .enum(["person", "organization", "any"])
    .optional()
    .default("any")
    .describe("Filter by entity type: 'person' for humans, 'organization' for companies/nonprofits, 'any' for all"),
  limit: z
    .number()
    .optional()
    .default(5)
    .describe("Maximum number of results (default: 5, max: 20)"),
})

const wikidataEntitySchema = z.object({
  entityId: z
    .string()
    .describe("Wikidata entity ID (e.g., 'Q76' for Barack Obama, 'Q312' for Apple Inc.)"),
})

// ============================================================================
// TYPES
// ============================================================================

interface WikidataSearchResult {
  id: string
  label: string
  description?: string
  url: string
}

interface WikidataClaimValue {
  id?: string
  label?: string
  time?: string
  amount?: string
  unit?: string
  text?: string
}

interface WikidataEntityData {
  id: string
  label: string
  description?: string
  aliases: string[]
  instanceOf: string[]
  // Person fields
  dateOfBirth?: string
  dateOfDeath?: string
  placeOfBirth?: string
  placeOfDeath?: string
  citizenship: string[]
  gender?: string
  occupations: string[]
  employers: string[]
  positions: string[]
  memberships: string[]
  education: string[]
  netWorth?: string
  spouse?: string
  awards: string[]
  notableWorks: string[]
  website?: string
  // Organization fields
  foundedBy?: string
  headquarters?: string
  industry?: string
  employees?: string
}

export interface WikidataSearchResponse {
  query: string
  results: WikidataSearchResult[]
  totalResults: number
  error?: string
}

export interface WikidataEntityResponse {
  entityId: string
  data: WikidataEntityData | null
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// HELPERS
// ============================================================================

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

/**
 * Extract value from a Wikidata claim
 */
function extractClaimValue(claim: unknown): WikidataClaimValue | null {
  if (!claim || typeof claim !== "object") return null

  const mainsnak = (claim as Record<string, unknown>).mainsnak as Record<string, unknown> | undefined
  if (!mainsnak) return null

  const datavalue = mainsnak.datavalue as Record<string, unknown> | undefined
  if (!datavalue) return null

  const type = datavalue.type as string
  const value = datavalue.value as Record<string, unknown>

  if (!value) return null

  switch (type) {
    case "wikibase-entityid":
      return { id: value.id as string }
    case "time":
      // Parse Wikidata time format: +1971-06-28T00:00:00Z
      const timeStr = value.time as string
      if (timeStr) {
        const match = timeStr.match(/([+-]?\d{4})-(\d{2})-(\d{2})/)
        if (match) {
          const [, year, month, day] = match
          return { time: `${year}-${month}-${day}` }
        }
      }
      return { time: timeStr }
    case "quantity":
      return {
        amount: value.amount as string,
        unit: value.unit as string,
      }
    case "string":
      return { text: value as unknown as string }
    case "monolingualtext":
      return { text: value.text as string }
    default:
      return null
  }
}

/**
 * Get all values for a property from claims
 */
function getPropertyValues(claims: Record<string, unknown[]>, propertyId: string): WikidataClaimValue[] {
  const propertyClaims = claims[propertyId]
  if (!propertyClaims || !Array.isArray(propertyClaims)) return []

  return propertyClaims
    .map(extractClaimValue)
    .filter((v): v is WikidataClaimValue => v !== null)
}

/**
 * Resolve entity IDs to labels via wbgetentities
 */
async function resolveEntityLabels(entityIds: string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>()
  if (entityIds.length === 0) return labels

  // Batch up to 50 IDs per request
  const batches: string[][] = []
  for (let i = 0; i < entityIds.length; i += 50) {
    batches.push(entityIds.slice(i, i + 50))
  }

  for (const batch of batches) {
    try {
      const url = new URL(WIKIDATA_API_BASE)
      url.searchParams.set("action", "wbgetentities")
      url.searchParams.set("format", "json")
      url.searchParams.set("ids", batch.join("|"))
      url.searchParams.set("props", "labels")
      url.searchParams.set("languages", "en")

      const response = await fetch(url.toString(), {
        headers: {
          "User-Agent": "Romy/1.0 (https://github.com/justice-rest/Intel)",
          Accept: "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        const entities = data.entities as Record<string, { labels?: { en?: { value: string } } }>

        for (const [id, entity] of Object.entries(entities)) {
          const label = entity.labels?.en?.value
          if (label) {
            labels.set(id, label)
          }
        }
      }
    } catch {
      // Continue with unresolved IDs
    }
  }

  return labels
}

/**
 * Format currency amount from Wikidata
 */
function formatNetWorth(amount?: string, unit?: string): string | undefined {
  if (!amount) return undefined

  const num = parseFloat(amount.replace(/[+]/g, ""))
  if (isNaN(num)) return amount

  // Format as currency
  let formatted: string
  if (Math.abs(num) >= 1e12) {
    formatted = `$${(num / 1e12).toFixed(1)} trillion`
  } else if (Math.abs(num) >= 1e9) {
    formatted = `$${(num / 1e9).toFixed(1)} billion`
  } else if (Math.abs(num) >= 1e6) {
    formatted = `$${(num / 1e6).toFixed(1)} million`
  } else {
    formatted = `$${num.toLocaleString()}`
  }

  // Add currency if not USD
  if (unit && !unit.includes("Q4917")) {
    // Q4917 = US dollar
    formatted += ` (${unit.split("/").pop()})`
  }

  return formatted
}

/**
 * Format entity data as readable text for AI
 */
function formatEntityForAI(data: WikidataEntityData): string {
  const lines: string[] = [
    `# Wikidata: ${data.label} (${data.id})`,
    "",
  ]

  if (data.description) {
    lines.push(`**Description:** ${data.description}`)
    lines.push("")
  }

  if (data.aliases.length > 0) {
    lines.push(`**Also known as:** ${data.aliases.join(", ")}`)
    lines.push("")
  }

  // Basic info section
  const basicInfo: string[] = []

  if (data.dateOfBirth) {
    let birthInfo = `**Born:** ${data.dateOfBirth}`
    if (data.placeOfBirth) birthInfo += ` in ${data.placeOfBirth}`
    basicInfo.push(birthInfo)
  }

  if (data.dateOfDeath) {
    let deathInfo = `**Died:** ${data.dateOfDeath}`
    if (data.placeOfDeath) deathInfo += ` in ${data.placeOfDeath}`
    basicInfo.push(deathInfo)
  }

  if (data.citizenship.length > 0) {
    basicInfo.push(`**Citizenship:** ${data.citizenship.join(", ")}`)
  }

  if (data.gender) {
    basicInfo.push(`**Gender:** ${data.gender}`)
  }

  if (basicInfo.length > 0) {
    lines.push("## Basic Info")
    lines.push(...basicInfo.map((l) => `- ${l.replace("**", "").replace(":**", ":")}`))
    lines.push("")
  }

  // Occupations
  if (data.occupations.length > 0) {
    lines.push("## Occupation")
    lines.push(...data.occupations.map((o) => `- ${o}`))
    lines.push("")
  }

  // Education
  if (data.education.length > 0) {
    lines.push("## Education")
    lines.push(...data.education.map((e) => `- ${e}`))
    lines.push("")
  }

  // Employers and positions
  if (data.employers.length > 0 || data.positions.length > 0) {
    lines.push("## Career")
    if (data.employers.length > 0) {
      lines.push("**Employers:**")
      lines.push(...data.employers.map((e) => `- ${e}`))
    }
    if (data.positions.length > 0) {
      lines.push("**Positions Held:**")
      lines.push(...data.positions.map((p) => `- ${p}`))
    }
    lines.push("")
  }

  // Memberships
  if (data.memberships.length > 0) {
    lines.push("## Memberships")
    lines.push(...data.memberships.map((m) => `- ${m}`))
    lines.push("")
  }

  // Net worth (key for prospect research)
  if (data.netWorth) {
    lines.push("## Net Worth")
    lines.push(`- ${data.netWorth}`)
    lines.push("")
  }

  // Awards
  if (data.awards.length > 0) {
    lines.push("## Awards & Recognition")
    lines.push(...data.awards.slice(0, 10).map((a) => `- ${a}`))
    if (data.awards.length > 10) {
      lines.push(`- ... and ${data.awards.length - 10} more`)
    }
    lines.push("")
  }

  // Notable works
  if (data.notableWorks.length > 0) {
    lines.push("## Notable Works")
    lines.push(...data.notableWorks.slice(0, 5).map((w) => `- ${w}`))
    lines.push("")
  }

  // Spouse
  if (data.spouse) {
    lines.push("## Personal")
    lines.push(`- **Spouse:** ${data.spouse}`)
    lines.push("")
  }

  // Organization-specific
  if (data.foundedBy || data.headquarters || data.industry || data.employees) {
    lines.push("## Organization Details")
    if (data.foundedBy) lines.push(`- **Founded by:** ${data.foundedBy}`)
    if (data.headquarters) lines.push(`- **Headquarters:** ${data.headquarters}`)
    if (data.industry) lines.push(`- **Industry:** ${data.industry}`)
    if (data.employees) lines.push(`- **Employees:** ${data.employees}`)
    lines.push("")
  }

  // Website
  if (data.website) {
    lines.push("## Links")
    lines.push(`- **Official Website:** ${data.website}`)
    lines.push("")
  }

  // Source
  lines.push("---")
  lines.push(`**Source:** https://www.wikidata.org/wiki/${data.id}`)

  return lines.join("\n")
}

// ============================================================================
// TOOLS
// ============================================================================

/**
 * Search Wikidata for entities by name
 */
export const wikidataSearchTool = tool({
  description:
    "Search Wikidata for people or organizations by name. Returns a list of matching entities " +
    "with their Wikidata IDs (QIDs) and descriptions. Use this to find the correct entity ID " +
    "before fetching detailed biographical data. Useful for prospect research to find " +
    "information about potential donors, executives, and organizations.",
  parameters: wikidataSearchSchema,
  execute: async ({ query, type, limit }): Promise<WikidataSearchResponse> => {
    console.log("[Wikidata] Searching for:", query, "type:", type)
    const startTime = Date.now()

    try {
      const url = new URL(WIKIDATA_API_BASE)
      url.searchParams.set("action", "wbsearchentities")
      url.searchParams.set("format", "json")
      url.searchParams.set("language", "en")
      url.searchParams.set("type", "item")
      url.searchParams.set("search", query)
      url.searchParams.set("limit", Math.min(limit, 20).toString())

      const response = await withTimeout(
        fetch(url.toString(), {
          headers: {
            "User-Agent": "Romy/1.0 (https://github.com/justice-rest/Intel)",
            Accept: "application/json",
          },
        }),
        WIKIDATA_TIMEOUT_MS,
        `Wikidata search timed out after ${WIKIDATA_TIMEOUT_MS / 1000} seconds`
      )

      if (!response.ok) {
        throw new Error(`Wikidata API error: ${response.status}`)
      }

      const data = await response.json()
      const searchResults = data.search || []

      // If type filtering is requested, we need to check instanceOf for each result
      let filteredResults = searchResults

      if (type !== "any" && searchResults.length > 0) {
        // Get entity data to check types
        const ids = searchResults.map((r: { id: string }) => r.id).join("|")
        const entityUrl = new URL(WIKIDATA_API_BASE)
        entityUrl.searchParams.set("action", "wbgetentities")
        entityUrl.searchParams.set("format", "json")
        entityUrl.searchParams.set("ids", ids)
        entityUrl.searchParams.set("props", "claims")

        const entityResponse = await fetch(entityUrl.toString(), {
          headers: {
            "User-Agent": "Romy/1.0 (https://github.com/justice-rest/Intel)",
            Accept: "application/json",
          },
        })

        if (entityResponse.ok) {
          const entityData = await entityResponse.json()
          const entities = entityData.entities || {}

          filteredResults = searchResults.filter((result: { id: string }) => {
            const entity = entities[result.id]
            if (!entity?.claims?.[PROPERTY_IDS.instanceOf]) return false

            const instanceOfValues = getPropertyValues(entity.claims, PROPERTY_IDS.instanceOf)
            const typeIds = instanceOfValues.map((v) => v.id).filter(Boolean)

            if (type === "person") {
              return typeIds.includes(ENTITY_TYPES.human)
            } else if (type === "organization") {
              return (
                typeIds.includes(ENTITY_TYPES.business) ||
                typeIds.includes(ENTITY_TYPES.organization) ||
                typeIds.includes(ENTITY_TYPES.nonprofit) ||
                typeIds.includes(ENTITY_TYPES.company)
              )
            }
            return true
          })
        }
      }

      const results: WikidataSearchResult[] = filteredResults.map(
        (r: { id: string; label: string; description?: string }) => ({
          id: r.id,
          label: r.label,
          description: r.description,
          url: `https://www.wikidata.org/wiki/${r.id}`,
        })
      )

      const duration = Date.now() - startTime
      console.log("[Wikidata] Search completed in", duration, "ms, found", results.length, "results")

      return {
        query,
        results,
        totalResults: results.length,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[Wikidata] Search failed:", errorMessage)
      return {
        query,
        results: [],
        totalResults: 0,
        error: `Failed to search Wikidata: ${errorMessage}`,
      }
    }
  },
})

/**
 * Get detailed entity data from Wikidata
 */
export const wikidataEntityTool = tool({
  description:
    "Get detailed biographical data for a person or organization from Wikidata by entity ID. " +
    "Returns occupation, education, employers, positions held, net worth, awards, and more. " +
    "Essential for prospect research - provides comprehensive background on potential donors. " +
    "Use wikidataSearch first to find the entity ID (QID) if you don't know it.",
  parameters: wikidataEntitySchema,
  execute: async ({ entityId }): Promise<WikidataEntityResponse> => {
    // Normalize entity ID
    const normalizedId = entityId.toUpperCase().startsWith("Q")
      ? entityId.toUpperCase()
      : `Q${entityId}`

    console.log("[Wikidata] Getting entity:", normalizedId)
    const startTime = Date.now()

    try {
      const url = new URL(WIKIDATA_API_BASE)
      url.searchParams.set("action", "wbgetentities")
      url.searchParams.set("format", "json")
      url.searchParams.set("ids", normalizedId)
      url.searchParams.set("props", "labels|descriptions|aliases|claims")
      url.searchParams.set("languages", "en")

      const response = await withTimeout(
        fetch(url.toString(), {
          headers: {
            "User-Agent": "Romy/1.0 (https://github.com/justice-rest/Intel)",
            Accept: "application/json",
          },
        }),
        WIKIDATA_TIMEOUT_MS,
        `Wikidata entity request timed out after ${WIKIDATA_TIMEOUT_MS / 1000} seconds`
      )

      if (!response.ok) {
        throw new Error(`Wikidata API error: ${response.status}`)
      }

      const data = await response.json()
      const entity = data.entities?.[normalizedId]

      if (!entity || entity.missing !== undefined) {
        return {
          entityId: normalizedId,
          data: null,
          rawContent: `No Wikidata entity found with ID ${normalizedId}`,
          sources: [],
          error: `Entity ${normalizedId} not found`,
        }
      }

      const claims = entity.claims || {}

      // Collect all entity IDs that need label resolution
      const entityIdsToResolve = new Set<string>()

      const collectEntityIds = (propertyId: string) => {
        const values = getPropertyValues(claims, propertyId)
        values.forEach((v) => {
          if (v.id) entityIdsToResolve.add(v.id)
        })
      }

      // Collect IDs from relevant properties
      ;[
        PROPERTY_IDS.instanceOf,
        PROPERTY_IDS.occupation,
        PROPERTY_IDS.employer,
        PROPERTY_IDS.positionHeld,
        PROPERTY_IDS.memberOf,
        PROPERTY_IDS.educatedAt,
        PROPERTY_IDS.placeOfBirth,
        PROPERTY_IDS.placeOfDeath,
        PROPERTY_IDS.countryOfCitizenship,
        PROPERTY_IDS.sexOrGender,
        PROPERTY_IDS.spouse,
        PROPERTY_IDS.awardReceived,
        PROPERTY_IDS.notableWork,
        PROPERTY_IDS.foundedBy,
        PROPERTY_IDS.headquartersLocation,
        PROPERTY_IDS.industry,
      ].forEach(collectEntityIds)

      // Resolve all entity labels in one batch
      const labelMap = await resolveEntityLabels(Array.from(entityIdsToResolve))

      // Helper to get resolved labels
      const getLabels = (propertyId: string): string[] => {
        return getPropertyValues(claims, propertyId)
          .map((v) => (v.id ? labelMap.get(v.id) : null))
          .filter((l): l is string => l !== null)
      }

      // Extract net worth
      const netWorthValues = getPropertyValues(claims, PROPERTY_IDS.netWorth)
      const netWorth = netWorthValues.length > 0
        ? formatNetWorth(netWorthValues[0].amount, netWorthValues[0].unit)
        : undefined

      // Extract dates
      const birthDateValues = getPropertyValues(claims, PROPERTY_IDS.dateOfBirth)
      const deathDateValues = getPropertyValues(claims, PROPERTY_IDS.dateOfDeath)

      // Extract website
      const websiteValues = getPropertyValues(claims, PROPERTY_IDS.officialWebsite)
      const website = websiteValues.length > 0 ? websiteValues[0].text : undefined

      // Extract employee count
      const employeeValues = getPropertyValues(claims, PROPERTY_IDS.numberOfEmployees)
      const employees = employeeValues.length > 0
        ? employeeValues[0].amount?.replace("+", "")
        : undefined

      // Build entity data
      const entityData: WikidataEntityData = {
        id: normalizedId,
        label: entity.labels?.en?.value || normalizedId,
        description: entity.descriptions?.en?.value,
        aliases: (entity.aliases?.en || []).map((a: { value: string }) => a.value),
        instanceOf: getLabels(PROPERTY_IDS.instanceOf),
        dateOfBirth: birthDateValues[0]?.time,
        dateOfDeath: deathDateValues[0]?.time,
        placeOfBirth: getLabels(PROPERTY_IDS.placeOfBirth)[0],
        placeOfDeath: getLabels(PROPERTY_IDS.placeOfDeath)[0],
        citizenship: getLabels(PROPERTY_IDS.countryOfCitizenship),
        gender: getLabels(PROPERTY_IDS.sexOrGender)[0],
        occupations: getLabels(PROPERTY_IDS.occupation),
        employers: getLabels(PROPERTY_IDS.employer),
        positions: getLabels(PROPERTY_IDS.positionHeld),
        memberships: getLabels(PROPERTY_IDS.memberOf),
        education: getLabels(PROPERTY_IDS.educatedAt),
        netWorth,
        spouse: getLabels(PROPERTY_IDS.spouse)[0],
        awards: getLabels(PROPERTY_IDS.awardReceived),
        notableWorks: getLabels(PROPERTY_IDS.notableWork),
        website,
        foundedBy: getLabels(PROPERTY_IDS.foundedBy)[0],
        headquarters: getLabels(PROPERTY_IDS.headquartersLocation)[0],
        industry: getLabels(PROPERTY_IDS.industry)[0],
        employees,
      }

      const rawContent = formatEntityForAI(entityData)

      const duration = Date.now() - startTime
      console.log("[Wikidata] Entity retrieved in", duration, "ms")

      return {
        entityId: normalizedId,
        data: entityData,
        rawContent,
        sources: [
          {
            name: `Wikidata - ${entityData.label}`,
            url: `https://www.wikidata.org/wiki/${normalizedId}`,
          },
        ],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[Wikidata] Entity fetch failed:", errorMessage)
      return {
        entityId: normalizedId,
        data: null,
        rawContent: `Failed to get Wikidata entity ${normalizedId}: ${errorMessage}`,
        sources: [],
        error: `Failed to get entity: ${errorMessage}`,
      }
    }
  },
})

/**
 * Wikidata tools are always available (no API key required)
 */
export function shouldEnableWikidataTools(): boolean {
  return true
}
