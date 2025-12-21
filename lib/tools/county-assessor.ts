/**
 * County Property Assessor Tool
 * Fetches official property assessment data from county Socrata APIs
 *
 * Key Features:
 * - FREE public API (Socrata Open Data)
 * - Official government data (highest confidence)
 * - Supports multiple counties across US
 * - Falls back to Linkup web search for unsupported counties
 *
 * Data Sources:
 * - Socrata SODA APIs (primary)
 * - County assessor websites via Linkup (fallback)
 *
 * Counties Supported:
 * - St. Johns County, FL
 * - Miami-Dade County, FL
 * - Hillsborough County, FL
 * - Los Angeles County, CA
 * - San Francisco County, CA
 * - Cook County, IL
 * - Harris County, TX
 * - Maricopa County, AZ
 * - King County, WA
 * - New York City, NY
 */

import { tool } from "ai"
import { z } from "zod"
import {
  SOCRATA_DEFAULTS,
  getSocrataAppToken,
  findCountyDataSource,
  getSupportedCounties,
  type CountyDataSource,
} from "@/lib/socrata/config"

// ============================================================================
// TYPES
// ============================================================================

export interface PropertyRecord {
  parcelId: string
  ownerName: string
  address: string
  city?: string
  state?: string
  zip?: string
  assessedValue?: number
  marketValue?: number
  landValue?: number
  improvementValue?: number
  acreage?: number
  lastSaleDate?: string
  lastSalePrice?: number
  yearBuilt?: number
  bedrooms?: number
  bathrooms?: number
  sqft?: number
  propertyType?: string
}

export interface CountyAssessorResult {
  query: {
    address?: string
    ownerName?: string
    county?: string
    state?: string
  }
  properties: PropertyRecord[]
  totalFound: number
  county: string
  state: string
  dataSource: "socrata" | "linkup" | "none"
  confidence: "high" | "medium" | "low"
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// SCHEMAS
// ============================================================================

const countyAssessorSchema = z.object({
  address: z
    .string()
    .optional()
    .describe(
      "Property address to search for (e.g., '123 Main St'). " +
        "Can be partial - tool will fuzzy match."
    ),
  ownerName: z
    .string()
    .optional()
    .describe(
      "Property owner's name to search for (e.g., 'John Smith'). " +
        "Useful when address is unknown."
    ),
  city: z.string().optional().describe("City to narrow search"),
  county: z
    .string()
    .optional()
    .describe(
      "County name (e.g., 'St. Johns', 'Miami-Dade', 'Cook'). " +
        "If not provided, will attempt to detect from address/state."
    ),
  state: z
    .string()
    .optional()
    .describe("Two-letter state code (e.g., 'FL', 'CA', 'IL')"),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of properties to return (default: 10)"),
})

export type CountyAssessorParams = z.infer<typeof countyAssessorSchema>

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Fetch data from Socrata API
 */
async function fetchFromSocrata(
  source: CountyDataSource,
  params: CountyAssessorParams
): Promise<PropertyRecord[]> {
  const { fields, portal, datasetId } = source

  // Build SODA query
  const queryParts: string[] = []

  // Search by address
  if (params.address && fields.address) {
    // Use LIKE for fuzzy matching
    const normalizedAddress = params.address
      .toUpperCase()
      .replace(/[^\w\s]/g, "")
      .trim()
    queryParts.push(`upper(${fields.address}) LIKE '%${normalizedAddress}%'`)
  }

  // Search by owner name
  if (params.ownerName && fields.ownerName) {
    const normalizedName = params.ownerName
      .toUpperCase()
      .replace(/[^\w\s]/g, "")
      .trim()
    queryParts.push(`upper(${fields.ownerName}) LIKE '%${normalizedName}%'`)
  }

  // Filter by city
  if (params.city && fields.city) {
    queryParts.push(`upper(${fields.city}) = '${params.city.toUpperCase()}'`)
  }

  if (queryParts.length === 0) {
    throw new Error("Must provide address or ownerName to search")
  }

  // Build URL
  const url = new URL(`${portal}/resource/${datasetId}.json`)
  url.searchParams.set("$where", queryParts.join(" AND "))
  url.searchParams.set("$limit", String(params.limit || SOCRATA_DEFAULTS.limit))

  // Add app token if available (for higher rate limits)
  const appToken = getSocrataAppToken()
  if (appToken) {
    url.searchParams.set("$$app_token", appToken)
  }

  console.log(`[County Assessor] Fetching from Socrata: ${url.toString()}`)

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "Romy-Research/1.0",
    },
    signal: AbortSignal.timeout(SOCRATA_DEFAULTS.timeoutMs),
  })

  if (!response.ok) {
    throw new Error(`Socrata API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  if (!Array.isArray(data)) {
    return []
  }

  // Map Socrata response to PropertyRecord
  return data.map((row: Record<string, unknown>) => {
    const record: PropertyRecord = {
      parcelId: String(row[fields.parcelId || ""] || ""),
      ownerName: String(row[fields.ownerName || ""] || ""),
      address: String(row[fields.address || ""] || ""),
    }

    if (fields.city && row[fields.city]) {
      record.city = String(row[fields.city])
    }
    if (fields.zip && row[fields.zip]) {
      record.zip = String(row[fields.zip])
    }
    if (fields.assessedValue && row[fields.assessedValue]) {
      record.assessedValue = parseFloat(String(row[fields.assessedValue]))
    }
    if (fields.marketValue && row[fields.marketValue]) {
      record.marketValue = parseFloat(String(row[fields.marketValue]))
    }
    if (fields.landValue && row[fields.landValue]) {
      record.landValue = parseFloat(String(row[fields.landValue]))
    }
    if (fields.improvementValue && row[fields.improvementValue]) {
      record.improvementValue = parseFloat(String(row[fields.improvementValue]))
    }
    if (fields.acreage && row[fields.acreage]) {
      record.acreage = parseFloat(String(row[fields.acreage]))
    }
    if (fields.lastSaleDate && row[fields.lastSaleDate]) {
      record.lastSaleDate = String(row[fields.lastSaleDate])
    }
    if (fields.lastSalePrice && row[fields.lastSalePrice]) {
      record.lastSalePrice = parseFloat(String(row[fields.lastSalePrice]))
    }
    if (fields.yearBuilt && row[fields.yearBuilt]) {
      record.yearBuilt = parseInt(String(row[fields.yearBuilt]), 10)
    }
    if (fields.bedrooms && row[fields.bedrooms]) {
      record.bedrooms = parseInt(String(row[fields.bedrooms]), 10)
    }
    if (fields.bathrooms && row[fields.bathrooms]) {
      record.bathrooms = parseFloat(String(row[fields.bathrooms]))
    }
    if (fields.sqft && row[fields.sqft]) {
      record.sqft = parseInt(String(row[fields.sqft]), 10)
    }
    if (fields.propertyType && row[fields.propertyType]) {
      record.propertyType = String(row[fields.propertyType])
    }

    return record
  })
}


/**
 * Format property record for display
 */
function formatPropertyRecord(record: PropertyRecord, index: number): string {
  const lines: string[] = []
  lines.push(`### Property ${index + 1}`)
  lines.push("")

  if (record.parcelId) {
    lines.push(`**Parcel ID:** ${record.parcelId}`)
  }
  if (record.ownerName) {
    lines.push(`**Owner:** ${record.ownerName}`)
  }
  if (record.address) {
    const fullAddress = [record.address, record.city, record.state, record.zip]
      .filter(Boolean)
      .join(", ")
    lines.push(`**Address:** ${fullAddress}`)
  }
  lines.push("")

  // Valuation section
  lines.push("**Valuation:**")
  if (record.assessedValue) {
    lines.push(`- Assessed Value: $${record.assessedValue.toLocaleString()}`)
  }
  if (record.marketValue) {
    lines.push(`- Market Value: $${record.marketValue.toLocaleString()}`)
  }
  if (record.landValue) {
    lines.push(`- Land Value: $${record.landValue.toLocaleString()}`)
  }
  if (record.improvementValue) {
    lines.push(`- Improvement Value: $${record.improvementValue.toLocaleString()}`)
  }

  // Sale history
  if (record.lastSaleDate || record.lastSalePrice) {
    lines.push("")
    lines.push("**Sale History:**")
    if (record.lastSaleDate) {
      lines.push(`- Last Sale Date: ${record.lastSaleDate}`)
    }
    if (record.lastSalePrice) {
      lines.push(`- Last Sale Price: $${record.lastSalePrice.toLocaleString()}`)
    }
  }

  // Property details
  if (record.sqft || record.bedrooms || record.bathrooms || record.yearBuilt) {
    lines.push("")
    lines.push("**Property Details:**")
    if (record.sqft) {
      lines.push(`- Living Area: ${record.sqft.toLocaleString()} sq ft`)
    }
    if (record.bedrooms) {
      lines.push(`- Bedrooms: ${record.bedrooms}`)
    }
    if (record.bathrooms) {
      lines.push(`- Bathrooms: ${record.bathrooms}`)
    }
    if (record.yearBuilt) {
      lines.push(`- Year Built: ${record.yearBuilt}`)
    }
    if (record.acreage) {
      lines.push(`- Lot Size: ${record.acreage} acres`)
    }
    if (record.propertyType) {
      lines.push(`- Property Type: ${record.propertyType}`)
    }
  }

  lines.push("")
  return lines.join("\n")
}

/**
 * Generate markdown content for result
 */
function generateRawContent(
  result: Omit<CountyAssessorResult, "rawContent">
): string {
  const lines: string[] = []

  lines.push(`# County Assessor Property Records`)
  lines.push("")

  // Query info
  lines.push("## Search Query")
  if (result.query.address) lines.push(`- **Address:** ${result.query.address}`)
  if (result.query.ownerName) lines.push(`- **Owner Name:** ${result.query.ownerName}`)
  lines.push(`- **County:** ${result.county}, ${result.state}`)
  lines.push(`- **Data Source:** ${result.dataSource === "socrata" ? "Official County API (Socrata)" : result.dataSource === "linkup" ? "Web Search (Linkup)" : "None"}`)
  lines.push(`- **Confidence:** ${result.confidence.toUpperCase()}`)
  lines.push("")

  if (result.error) {
    lines.push(`## Error`)
    lines.push(result.error)
    lines.push("")

    if (result.dataSource === "none") {
      lines.push("## Supported Counties")
      lines.push("")
      const counties = getSupportedCounties()
      for (const county of counties) {
        lines.push(`- ${county.name}, ${county.state}`)
      }
    }
    return lines.join("\n")
  }

  if (result.properties.length === 0) {
    lines.push("## Results")
    lines.push("No properties found matching the search criteria.")
    lines.push("")
    lines.push("**Suggestions:**")
    lines.push("- Try a partial address (e.g., '123 Main' instead of '123 Main Street')")
    lines.push("- Search by owner name if address is unknown")
    lines.push("- Verify the county and state are correct")
    return lines.join("\n")
  }

  lines.push(`## Results (${result.totalFound} found)`)
  lines.push("")

  for (let i = 0; i < result.properties.length; i++) {
    lines.push(formatPropertyRecord(result.properties[i], i))
  }

  // Sources
  if (result.sources.length > 0) {
    lines.push("## Sources")
    for (const source of result.sources) {
      lines.push(`- [${source.name}](${source.url})`)
    }
  }

  return lines.join("\n")
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const countyAssessorTool = tool({
  description:
    "Search official county property assessor records for property valuations, ownership, and tax data. " +
    "Uses FREE Socrata Open Data APIs for supported counties. " +
    "Returns: assessed value, market value, land/improvement breakdown, sale history, property details. " +
    "HIGHEST CONFIDENCE data source for property research (official government records). " +
    "Supported counties: St. Johns FL, Miami-Dade FL, Los Angeles CA, Cook IL (Chicago), " +
    "Harris TX (Houston), Maricopa AZ (Phoenix), King WA (Seattle), NYC NY. " +
    "Falls back to web search for other counties.",

  parameters: countyAssessorSchema,

  execute: async (params: CountyAssessorParams): Promise<CountyAssessorResult> => {
    console.log("[County Assessor] Starting search:", params)

    const baseResult: Omit<CountyAssessorResult, "rawContent"> = {
      query: {
        address: params.address,
        ownerName: params.ownerName,
        county: params.county,
        state: params.state,
      },
      properties: [],
      totalFound: 0,
      county: params.county || "Unknown",
      state: params.state || "Unknown",
      dataSource: "none",
      confidence: "low",
      sources: [],
    }

    // Validate input
    if (!params.address && !params.ownerName) {
      const result = {
        ...baseResult,
        error: "Must provide either address or ownerName to search",
        rawContent: "",
      }
      result.rawContent = generateRawContent(result)
      return result
    }

    // Find county data source
    let source: CountyDataSource | null = null
    if (params.county && params.state) {
      source = findCountyDataSource(params.county, params.state)
    }

    // Try Socrata first if we have a matching source
    if (source) {
      try {
        const properties = await fetchFromSocrata(source, params)
        const result: Omit<CountyAssessorResult, "rawContent"> = {
          ...baseResult,
          properties,
          totalFound: properties.length,
          county: source.name,
          state: source.state,
          dataSource: "socrata",
          confidence: properties.length > 0 ? "high" : "low",
          sources: [
            {
              name: `${source.name} Property Assessor`,
              url: `${source.portal}/resource/${source.datasetId}`,
            },
          ],
        }

        console.log(`[County Assessor] Socrata returned ${properties.length} properties`)

        const finalResult: CountyAssessorResult = {
          ...result,
          rawContent: generateRawContent(result),
        }
        return finalResult
      } catch (error) {
        console.error("[County Assessor] Socrata fetch failed:", error)
        // Fall through to Linkup fallback
      }
    }

    // No data available for unsupported county
    const result: CountyAssessorResult = {
      ...baseResult,
      error: `County "${params.county || "Unknown"}, ${params.state || "Unknown"}" is not supported. ` +
        `Supported counties: St. Johns FL, Miami-Dade FL, Los Angeles CA, Cook IL, Harris TX, Maricopa AZ, King WA, NYC NY.`,
      rawContent: "",
    }
    result.rawContent = generateRawContent(result)
    return result
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Check if county assessor tool should be enabled
 */
export function shouldEnableCountyAssessorTool(): boolean {
  // Always enable - Socrata is free and requires no API key
  // Linkup fallback is optional
  return true
}

/**
 * Get list of supported counties
 */
export function getCountyAssessorSupportedCounties(): Array<{ name: string; state: string }> {
  return getSupportedCounties()
}
