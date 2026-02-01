/**
 * GLEIF LEI Tool
 *
 * Search and lookup Legal Entity Identifiers (LEI) from the Global LEI Foundation
 * FREE API, no authentication required, generous rate limits
 *
 * Features:
 * - Search by entity name
 * - Get direct/ultimate parent relationships ("who owns whom")
 * - Find child entities
 * - Links to OpenCorporates entity IDs
 * - 2.5M+ legal entities with LEIs globally
 * - Updated 3x daily
 *
 * API Documentation: https://www.gleif.org/en/lei-data/gleif-api
 *
 * Key Use Cases:
 * - Verify legal entity existence and status
 * - Find corporate ownership chains
 * - Cross-reference with other registries via OpenCorporates link
 * - Research global corporate structures
 */

import { tool } from "ai"
import { z } from "zod"

// GLEIF API Base URL
const GLEIF_API_BASE = "https://api.gleif.org/api/v1"

// Timeout for API requests
const GLEIF_TIMEOUT_MS = 30000

// LEI Record interface
interface LEIRecord {
  type: string
  id: string
  attributes: {
    lei: string
    entity: {
      legalName: {
        name: string
        language?: string
      }
      otherNames?: Array<{
        name: string
        type?: string
      }>
      transliteratedOtherNames?: Array<{
        name: string
        type?: string
      }>
      legalAddress: {
        language?: string
        addressLines?: string[]
        city?: string
        region?: string
        country?: string
        postalCode?: string
      }
      headquartersAddress?: {
        language?: string
        addressLines?: string[]
        city?: string
        region?: string
        country?: string
        postalCode?: string
      }
      registeredAt?: {
        id?: string
        other?: string
      }
      registeredAs?: string
      jurisdiction?: string
      category?: string
      legalForm?: {
        id?: string
        other?: string
      }
      status?: string
      creationDate?: string
      subCategory?: string
      successorEntity?: {
        lei?: string
        name?: string
      }
    }
    registration: {
      initialRegistrationDate?: string
      lastUpdateDate?: string
      status?: string
      nextRenewalDate?: string
      managingLou?: string
      corroborationLevel?: string
      validatedAt?: {
        id?: string
        other?: string
      }
      validatedAs?: string
    }
  }
  links?: {
    self?: string
    "lei-records"?: string
    "direct-parent"?: string
    "ultimate-parent"?: string
    "direct-children"?: string
  }
}

// Relationship Record interface
interface RelationshipRecord {
  type: string
  id: string
  attributes: {
    relationship: {
      startNode: {
        id: string
        relationshipType?: string
      }
      endNode: {
        id: string
        relationshipType?: string
      }
      type?: string
      status?: string
      relationshipPeriods?: Array<{
        startDate?: string
        endDate?: string
        periodType?: string
      }>
      relationshipQuantifiers?: Array<{
        measurementMethod?: string
        quantifierAmount?: number
        quantifierUnits?: string
      }>
    }
    registration?: {
      initialRegistrationDate?: string
      lastUpdateDate?: string
      status?: string
      managingLou?: string
    }
  }
}

// GLEIF API Response interfaces
interface GLEIFSearchResponse {
  meta?: {
    pagination?: {
      total?: number
      currentPage?: number
      perPage?: number
      lastPage?: number
    }
  }
  data: LEIRecord[]
}

interface GLEIFRelationshipResponse {
  data?: RelationshipRecord
  included?: LEIRecord[]
}

/**
 * Helper to add timeout to a promise
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

/**
 * Format LEI record to readable output
 */
function formatLEIRecord(record: LEIRecord): {
  lei: string
  name: string
  status: string | null
  jurisdiction: string | null
  legalForm: string | null
  registeredAs: string | null
  address: string | null
  creationDate: string | null
  lastUpdate: string | null
  sourceUrl: string
} {
  const entity = record.attributes.entity
  const registration = record.attributes.registration

  // Build address string
  const addr = entity.legalAddress
  const addressParts = [
    ...(addr?.addressLines || []),
    addr?.city,
    addr?.region,
    addr?.country,
    addr?.postalCode,
  ].filter(Boolean)

  return {
    lei: record.attributes.lei,
    name: entity.legalName?.name || "Unknown",
    status: entity.status || null,
    jurisdiction: entity.jurisdiction || null,
    legalForm: entity.legalForm?.other || entity.legalForm?.id || null,
    registeredAs: entity.registeredAs || null,
    address: addressParts.length > 0 ? addressParts.join(", ") : null,
    creationDate: entity.creationDate || null,
    lastUpdate: registration?.lastUpdateDate || null,
    sourceUrl: `https://search.gleif.org/#/record/${record.attributes.lei}`,
  }
}

// Zod schema for search parameters
const gleifSearchParametersSchema = z.object({
  query: z.string().describe("Entity name to search for"),
  country: z.string().optional().describe("ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB', 'DE')"),
  limit: z.number().min(1).max(100).optional().default(10).describe("Maximum results to return"),
})

// Zod schema for LEI lookup parameters
const gleifLookupParametersSchema = z.object({
  lei: z.string().length(20).describe("20-character Legal Entity Identifier"),
  includeParents: z.boolean().optional().default(true).describe("Include direct and ultimate parent entities"),
})

export type GLEIFSearchParams = z.infer<typeof gleifSearchParametersSchema>
export type GLEIFLookupParams = z.infer<typeof gleifLookupParametersSchema>

/**
 * GLEIF Entity Search Tool
 * Search for legal entities by name
 */
export const gleifSearchTool = (tool as any)({
  description:
    "Search the Global LEI Foundation database for legal entities by name. " +
    "Returns LEI (Legal Entity Identifier), entity status, jurisdiction, and registration details. " +
    "FREE API, no authentication required. Covers 2.5M+ global legal entities. " +
    "Use this to verify business existence and find corporate ownership data.",
  parameters: gleifSearchParametersSchema,
  execute: async ({ query, country, limit = 10 }: GLEIFSearchParams): Promise<{
    success: boolean
    entities: Array<ReturnType<typeof formatLEIRecord>>
    totalFound: number
    rawContent: string
    sources: Array<{ name: string; url: string }>
    error?: string
  }> => {
    console.log("[GLEIF Tool] Searching for:", query)
    const startTime = Date.now()

    try {
      // Build search URL
      const params = new URLSearchParams({
        "filter[entity.legalName]": query,
        "page[size]": limit.toString(),
      })

      if (country) {
        params.append("filter[entity.legalAddress.country]", country.toUpperCase())
      }

      const searchUrl = `${GLEIF_API_BASE}/lei-records?${params.toString()}`

      const response = await withTimeout(
        fetch(searchUrl, {
          headers: {
            Accept: "application/vnd.api+json",
            "User-Agent": "Romy/1.0 (Nonprofit Research Tool)",
          },
        }),
        GLEIF_TIMEOUT_MS,
        `GLEIF search timed out after ${GLEIF_TIMEOUT_MS / 1000} seconds`
      )

      if (!response.ok) {
        throw new Error(`GLEIF API error: ${response.status} ${response.statusText}`)
      }

      const data: GLEIFSearchResponse = await response.json()
      const entities = (data.data || []).map(formatLEIRecord)
      const totalFound = data.meta?.pagination?.total || entities.length

      const duration = Date.now() - startTime
      console.log(`[GLEIF Tool] Found ${entities.length} entities in ${duration}ms`)

      // Build human-readable content
      let rawContent = `# GLEIF Entity Search Results\n\n`
      rawContent += `**Query:** ${query}${country ? ` (Country: ${country})` : ""}\n`
      rawContent += `**Total Found:** ${totalFound}\n\n`

      if (entities.length === 0) {
        rawContent += `No entities found matching "${query}".\n`
      } else {
        entities.forEach((entity, i) => {
          rawContent += `## ${i + 1}. ${entity.name}\n\n`
          rawContent += `- **LEI:** ${entity.lei}\n`
          if (entity.status) rawContent += `- **Status:** ${entity.status}\n`
          if (entity.jurisdiction) rawContent += `- **Jurisdiction:** ${entity.jurisdiction}\n`
          if (entity.legalForm) rawContent += `- **Legal Form:** ${entity.legalForm}\n`
          if (entity.registeredAs) rawContent += `- **Registered As:** ${entity.registeredAs}\n`
          if (entity.address) rawContent += `- **Address:** ${entity.address}\n`
          if (entity.creationDate) rawContent += `- **Created:** ${entity.creationDate}\n`
          rawContent += `- **Source:** [GLEIF Record](${entity.sourceUrl})\n\n`
        })
      }

      return {
        success: true,
        entities,
        totalFound,
        rawContent,
        sources: [
          {
            name: "GLEIF - Global Legal Entity Identifier Foundation",
            url: "https://search.gleif.org/",
          },
          ...entities.slice(0, 5).map(e => ({
            name: `${e.name} (LEI: ${e.lei})`,
            url: e.sourceUrl,
          })),
        ],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[GLEIF Tool] Search error:", errorMessage)

      return {
        success: false,
        entities: [],
        totalFound: 0,
        rawContent: `# GLEIF Search Error\n\n**Query:** ${query}\n**Error:** ${errorMessage}\n\nPlease try again or search directly at: https://search.gleif.org/`,
        sources: [{ name: "GLEIF Search", url: "https://search.gleif.org/" }],
        error: errorMessage,
      }
    }
  },
})

/**
 * GLEIF LEI Lookup Tool
 * Get detailed entity info and ownership relationships by LEI
 */
export const gleifLookupTool = (tool as any)({
  description:
    "Look up a specific Legal Entity Identifier (LEI) and get ownership relationships. " +
    "Returns entity details PLUS direct parent and ultimate parent (who owns this company). " +
    "Essential for tracing corporate ownership chains globally. " +
    "FREE API, no authentication required.",
  parameters: gleifLookupParametersSchema,
  execute: async ({ lei, includeParents = true }: GLEIFLookupParams): Promise<{
    success: boolean
    entity: ReturnType<typeof formatLEIRecord> | null
    directParent: ReturnType<typeof formatLEIRecord> | null
    ultimateParent: ReturnType<typeof formatLEIRecord> | null
    rawContent: string
    sources: Array<{ name: string; url: string }>
    error?: string
  }> => {
    console.log("[GLEIF Tool] Looking up LEI:", lei)
    const startTime = Date.now()

    try {
      // Fetch main entity
      const entityUrl = `${GLEIF_API_BASE}/lei-records/${lei}`
      const entityResponse = await withTimeout(
        fetch(entityUrl, {
          headers: {
            Accept: "application/vnd.api+json",
            "User-Agent": "Romy/1.0 (Nonprofit Research Tool)",
          },
        }),
        GLEIF_TIMEOUT_MS,
        `GLEIF lookup timed out after ${GLEIF_TIMEOUT_MS / 1000} seconds`
      )

      if (!entityResponse.ok) {
        if (entityResponse.status === 404) {
          throw new Error(`LEI ${lei} not found in GLEIF database`)
        }
        throw new Error(`GLEIF API error: ${entityResponse.status}`)
      }

      const entityData: { data: LEIRecord } = await entityResponse.json()
      const entity = formatLEIRecord(entityData.data)

      let directParent: ReturnType<typeof formatLEIRecord> | null = null
      let ultimateParent: ReturnType<typeof formatLEIRecord> | null = null

      // Fetch parent relationships if requested
      if (includeParents) {
        // Direct parent
        try {
          const directParentUrl = `${GLEIF_API_BASE}/lei-records/${lei}/direct-parent`
          const directParentResponse = await fetch(directParentUrl, {
            headers: {
              Accept: "application/vnd.api+json",
              "User-Agent": "Romy/1.0 (Nonprofit Research Tool)",
            },
          })

          if (directParentResponse.ok) {
            const directParentData: GLEIFRelationshipResponse = await directParentResponse.json()
            if (directParentData.included && directParentData.included.length > 0) {
              directParent = formatLEIRecord(directParentData.included[0])
            }
          }
        } catch {
          // No direct parent or error - continue
        }

        // Ultimate parent
        try {
          const ultimateParentUrl = `${GLEIF_API_BASE}/lei-records/${lei}/ultimate-parent`
          const ultimateParentResponse = await fetch(ultimateParentUrl, {
            headers: {
              Accept: "application/vnd.api+json",
              "User-Agent": "Romy/1.0 (Nonprofit Research Tool)",
            },
          })

          if (ultimateParentResponse.ok) {
            const ultimateParentData: GLEIFRelationshipResponse = await ultimateParentResponse.json()
            if (ultimateParentData.included && ultimateParentData.included.length > 0) {
              ultimateParent = formatLEIRecord(ultimateParentData.included[0])
            }
          }
        } catch {
          // No ultimate parent or error - continue
        }
      }

      const duration = Date.now() - startTime
      console.log(`[GLEIF Tool] Lookup completed in ${duration}ms`)

      // Build human-readable content
      let rawContent = `# GLEIF LEI Lookup: ${lei}\n\n`
      rawContent += `## Entity Details\n\n`
      rawContent += `- **Name:** ${entity.name}\n`
      rawContent += `- **LEI:** ${entity.lei}\n`
      if (entity.status) rawContent += `- **Status:** ${entity.status}\n`
      if (entity.jurisdiction) rawContent += `- **Jurisdiction:** ${entity.jurisdiction}\n`
      if (entity.legalForm) rawContent += `- **Legal Form:** ${entity.legalForm}\n`
      if (entity.registeredAs) rawContent += `- **Registry ID:** ${entity.registeredAs}\n`
      if (entity.address) rawContent += `- **Address:** ${entity.address}\n`
      if (entity.creationDate) rawContent += `- **Created:** ${entity.creationDate}\n`
      if (entity.lastUpdate) rawContent += `- **Last Update:** ${entity.lastUpdate}\n`
      rawContent += `\n[View on GLEIF](${entity.sourceUrl})\n\n`

      if (includeParents) {
        rawContent += `## Ownership Structure\n\n`

        if (directParent) {
          rawContent += `### Direct Parent\n\n`
          rawContent += `- **Name:** ${directParent.name}\n`
          rawContent += `- **LEI:** ${directParent.lei}\n`
          if (directParent.jurisdiction) rawContent += `- **Jurisdiction:** ${directParent.jurisdiction}\n`
          rawContent += `\n[View Parent](${directParent.sourceUrl})\n\n`
        } else {
          rawContent += `### Direct Parent\n\nNo direct parent reported.\n\n`
        }

        if (ultimateParent && ultimateParent.lei !== directParent?.lei) {
          rawContent += `### Ultimate Parent\n\n`
          rawContent += `- **Name:** ${ultimateParent.name}\n`
          rawContent += `- **LEI:** ${ultimateParent.lei}\n`
          if (ultimateParent.jurisdiction) rawContent += `- **Jurisdiction:** ${ultimateParent.jurisdiction}\n`
          rawContent += `\n[View Ultimate Parent](${ultimateParent.sourceUrl})\n\n`
        } else if (!directParent) {
          rawContent += `### Ultimate Parent\n\nNo ultimate parent reported (entity may be the ultimate parent).\n\n`
        }
      }

      const sources: Array<{ name: string; url: string }> = [
        { name: `${entity.name} - GLEIF Record`, url: entity.sourceUrl },
      ]
      if (directParent) {
        sources.push({ name: `${directParent.name} (Direct Parent)`, url: directParent.sourceUrl })
      }
      if (ultimateParent && ultimateParent.lei !== directParent?.lei) {
        sources.push({ name: `${ultimateParent.name} (Ultimate Parent)`, url: ultimateParent.sourceUrl })
      }

      return {
        success: true,
        entity,
        directParent,
        ultimateParent,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[GLEIF Tool] Lookup error:", errorMessage)

      return {
        success: false,
        entity: null,
        directParent: null,
        ultimateParent: null,
        rawContent: `# GLEIF Lookup Error\n\n**LEI:** ${lei}\n**Error:** ${errorMessage}\n\nPlease verify the LEI is correct or search at: https://search.gleif.org/`,
        sources: [{ name: "GLEIF Search", url: "https://search.gleif.org/" }],
        error: errorMessage,
      }
    }
  },
})

/**
 * Check if GLEIF tools should be enabled
 * Always enabled since no API key required
 */
export function shouldEnableGleifTools(): boolean {
  return true
}
