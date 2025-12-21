/**
 * Business License Search Tool
 *
 * Searches city/county business license databases via Socrata APIs.
 * Business licenses reveal business ownership and locations.
 *
 * Coverage:
 * - Chicago: data.cityofchicago.org - Business Licenses (400K+ records)
 * - Seattle: cos-data.seattle.gov - Business License Tax Certificates
 * - Kansas City: data.kcmo.org - Business License Holders
 * - Cincinnati: data.cincinnati-oh.gov - Business Licenses
 * - Berkeley: data.cityofberkeley.info - Business Licenses
 * - Delaware State: data.delaware.gov - Business Licenses
 *
 * Use Cases:
 * - Find business ownership
 * - Verify business claims
 * - Discover business locations
 *
 * Data Sources: All FREE, no API key required
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// TYPES
// ============================================================================

export interface BusinessLicense {
  businessName: string
  ownerName?: string
  licenseNumber: string
  licenseType: string
  status: "active" | "inactive" | "expired" | "unknown"
  issueDate?: string
  expirationDate?: string
  address?: string
  city: string
  state: string
  businessType?: string
  source: string
}

export interface BusinessLicenseResult {
  searchTerm: string
  searchType: "business" | "owner" | "any"
  licenses: BusinessLicense[]
  summary: {
    totalFound: number
    activeCount: number
    businessTypes: string[]
    cities: string[]
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// LICENSE ENDPOINTS
// ============================================================================

interface LicenseEndpoint {
  name: string
  city: string
  state: string
  portal: string
  datasetId: string
  fields: {
    businessName: string
    ownerName?: string
    licenseNumber: string
    licenseType?: string
    status?: string
    issueDate?: string
    expirationDate?: string
    address?: string
    businessType?: string
  }
}

const LICENSE_ENDPOINTS: LicenseEndpoint[] = [
  // Chicago (400K+ records)
  {
    name: "Chicago Business Licenses",
    city: "Chicago",
    state: "IL",
    portal: "https://data.cityofchicago.org/resource",
    datasetId: "r5kz-chrr",
    fields: {
      businessName: "doing_business_as_name",
      ownerName: "legal_name",
      licenseNumber: "license_number",
      licenseType: "license_description",
      status: "license_status",
      issueDate: "license_start_date",
      expirationDate: "expiration_date",
      address: "address",
      businessType: "business_activity",
    },
  },
  // Seattle
  {
    name: "Seattle Business Licenses",
    city: "Seattle",
    state: "WA",
    portal: "https://cos-data.seattle.gov/resource",
    datasetId: "wnbq-64tb",
    fields: {
      businessName: "trade_name",
      ownerName: "ownership_type",
      licenseNumber: "business_legal_name",
      licenseType: "license_type",
      status: "license_status",
      issueDate: "license_start_date",
      expirationDate: "license_expiration_date",
      address: "street_address",
      businessType: "naics_description",
    },
  },
  // Kansas City
  {
    name: "Kansas City Business Licenses",
    city: "Kansas City",
    state: "MO",
    portal: "https://data.kcmo.org/resource",
    datasetId: "pnm4-68wg",
    fields: {
      businessName: "business_name",
      licenseNumber: "license_no",
      licenseType: "license_type",
      issueDate: "lic_issue_date",
      expirationDate: "lic_expiration_date",
      address: "business_location",
    },
  },
  // Cincinnati
  {
    name: "Cincinnati Business Licenses",
    city: "Cincinnati",
    state: "OH",
    portal: "https://data.cincinnati-oh.gov/resource",
    datasetId: "7dk3-gngs",
    fields: {
      businessName: "business_name",
      ownerName: "owner_name",
      licenseNumber: "license_number",
      licenseType: "license_type",
      status: "status",
      issueDate: "issue_date",
      expirationDate: "expiration_date",
      address: "address",
    },
  },
  // Berkeley
  {
    name: "Berkeley Business Licenses",
    city: "Berkeley",
    state: "CA",
    portal: "https://data.cityofberkeley.info/resource",
    datasetId: "rwnf-bu3w",
    fields: {
      businessName: "doing_business_as_name",
      ownerName: "owner_name",
      licenseNumber: "license_number",
      licenseType: "license_type",
      status: "license_status",
      issueDate: "license_issue_date",
      expirationDate: "license_expiration_date",
      address: "location",
      businessType: "business_type",
    },
  },
  // Delaware State
  {
    name: "Delaware Business Licenses",
    city: "Statewide",
    state: "DE",
    portal: "https://data.delaware.gov/resource",
    datasetId: "5zy2-grhr",
    fields: {
      businessName: "business_name",
      ownerName: "owner_name",
      licenseNumber: "license_number",
      licenseType: "license_type",
      status: "status",
      issueDate: "issue_date",
      expirationDate: "expiration_date",
      address: "address",
    },
  },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalizeStatus(status: string | undefined): BusinessLicense["status"] {
  if (!status) return "unknown"
  const s = status.toUpperCase()
  if (s.includes("ACTIVE") || s.includes("AAI") || s.includes("ISSUED")) return "active"
  if (s.includes("INACTIVE") || s.includes("REVOKED") || s.includes("CANCELLED")) return "inactive"
  if (s.includes("EXPIRED")) return "expired"
  return "unknown"
}

async function queryLicenseEndpoint(
  endpoint: LicenseEndpoint,
  searchTerm: string,
  searchType: "business" | "owner" | "any"
): Promise<BusinessLicense[]> {
  const licenses: BusinessLicense[] = []

  try {
    // Build SoQL query
    let whereClause: string

    if (searchType === "owner" && endpoint.fields.ownerName) {
      whereClause = `upper(${endpoint.fields.ownerName}) like '%${searchTerm.toUpperCase()}%'`
    } else if (searchType === "business") {
      whereClause = `upper(${endpoint.fields.businessName}) like '%${searchTerm.toUpperCase()}%'`
    } else {
      // Search both
      if (endpoint.fields.ownerName) {
        whereClause = `upper(${endpoint.fields.businessName}) like '%${searchTerm.toUpperCase()}%' OR upper(${endpoint.fields.ownerName}) like '%${searchTerm.toUpperCase()}%'`
      } else {
        whereClause = `upper(${endpoint.fields.businessName}) like '%${searchTerm.toUpperCase()}%'`
      }
    }

    const url = `${endpoint.portal}/${endpoint.datasetId}.json?$where=${encodeURIComponent(whereClause)}&$limit=50`

    console.log(`[BusinessLicenses] Querying ${endpoint.name}: ${url}`)

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Romy-Prospect-Research/1.0",
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`[BusinessLicenses] ${endpoint.name} API error: ${response.status}`)
      return []
    }

    const data = await response.json()

    if (!Array.isArray(data)) {
      return []
    }

    for (const record of data) {
      const license: BusinessLicense = {
        businessName: String(record[endpoint.fields.businessName] || "Unknown"),
        licenseNumber: String(record[endpoint.fields.licenseNumber] || ""),
        licenseType: endpoint.fields.licenseType ? String(record[endpoint.fields.licenseType] || "Business") : "Business",
        status: normalizeStatus(endpoint.fields.status ? record[endpoint.fields.status] : undefined),
        city: endpoint.city,
        state: endpoint.state,
        source: endpoint.name,
      }

      if (endpoint.fields.ownerName && record[endpoint.fields.ownerName]) {
        license.ownerName = String(record[endpoint.fields.ownerName])
      }
      if (endpoint.fields.issueDate && record[endpoint.fields.issueDate]) {
        license.issueDate = String(record[endpoint.fields.issueDate])
      }
      if (endpoint.fields.expirationDate && record[endpoint.fields.expirationDate]) {
        license.expirationDate = String(record[endpoint.fields.expirationDate])
      }
      if (endpoint.fields.address && record[endpoint.fields.address]) {
        license.address = String(record[endpoint.fields.address])
      }
      if (endpoint.fields.businessType && record[endpoint.fields.businessType]) {
        license.businessType = String(record[endpoint.fields.businessType])
      }

      licenses.push(license)
    }

    console.log(`[BusinessLicenses] Found ${licenses.length} licenses in ${endpoint.name}`)
  } catch (error) {
    console.error(`[BusinessLicenses] Error querying ${endpoint.name}:`, error)
  }

  return licenses
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

async function searchBusinessLicenses(
  searchTerm: string,
  searchType: "business" | "owner" | "any" = "any",
  cities: string[] = ["Chicago", "Seattle", "Kansas City", "Cincinnati", "Berkeley", "Delaware"]
): Promise<BusinessLicenseResult> {
  console.log(`[BusinessLicenses] Searching for "${searchTerm}" (${searchType}) in: ${cities.join(", ")}`)

  const allLicenses: BusinessLicense[] = []
  const sources: Array<{ name: string; url: string }> = []

  // Find matching endpoints
  const endpoints = LICENSE_ENDPOINTS.filter((e) =>
    cities.some((c) => e.city.toLowerCase().includes(c.toLowerCase()) || e.state.toLowerCase() === c.toLowerCase())
  )

  // Query each endpoint in parallel
  const endpointPromises = endpoints.map(async (endpoint) => {
    sources.push({
      name: endpoint.name,
      url: endpoint.portal.replace("/resource", ""),
    })
    return queryLicenseEndpoint(endpoint, searchTerm, searchType)
  })

  const results = await Promise.all(endpointPromises)
  for (const licenses of results) {
    allLicenses.push(...licenses)
  }

  // Calculate summary
  const activeCount = allLicenses.filter((l) => l.status === "active").length
  const businessTypes = [...new Set(allLicenses.map((l) => l.businessType).filter(Boolean) as string[])]
  const citiesFound = [...new Set(allLicenses.map((l) => l.city))]

  // Build raw content
  const rawLines: string[] = []
  rawLines.push(`# Business License Search: ${searchTerm}`)
  rawLines.push("")
  rawLines.push(`## Summary`)
  rawLines.push(`- **Total Licenses Found:** ${allLicenses.length}`)
  rawLines.push(`- **Active Licenses:** ${activeCount}`)
  rawLines.push(`- **Cities:** ${citiesFound.join(", ")}`)

  if (businessTypes.length > 0) {
    rawLines.push(`- **Business Types:** ${businessTypes.slice(0, 5).join(", ")}`)
  }
  rawLines.push("")

  if (allLicenses.length > 0) {
    rawLines.push(`## Business Licenses`)
    rawLines.push("")

    for (const license of allLicenses.slice(0, 25)) {
      rawLines.push(`### ${license.businessName}`)
      rawLines.push(`- **License #:** ${license.licenseNumber}`)
      rawLines.push(`- **Type:** ${license.licenseType}`)
      rawLines.push(`- **Status:** ${license.status.toUpperCase()}`)
      rawLines.push(`- **Location:** ${license.city}, ${license.state}`)
      if (license.ownerName) {
        rawLines.push(`- **Owner:** ${license.ownerName}`)
      }
      if (license.address) {
        rawLines.push(`- **Address:** ${license.address}`)
      }
      if (license.businessType) {
        rawLines.push(`- **Business Type:** ${license.businessType}`)
      }
      if (license.issueDate) {
        rawLines.push(`- **Issued:** ${license.issueDate}`)
      }
      rawLines.push("")
    }

    if (allLicenses.length > 25) {
      rawLines.push(`*... and ${allLicenses.length - 25} more licenses*`)
    }
  } else {
    rawLines.push(`## Results`)
    rawLines.push(`No business licenses found for "${searchTerm}".`)
  }

  return {
    searchTerm,
    searchType,
    licenses: allLicenses,
    summary: {
      totalFound: allLicenses.length,
      activeCount,
      businessTypes,
      cities: citiesFound,
    },
    rawContent: rawLines.join("\n"),
    sources,
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const businessLicenseSchema = z.object({
  searchTerm: z
    .string()
    .describe("Business name or owner name to search for"),
  searchType: z
    .enum(["business", "owner", "any"])
    .optional()
    .default("any")
    .describe("Search by business name, owner name, or both"),
  cities: z
    .array(z.string())
    .optional()
    .default(["Chicago", "Seattle", "Kansas City", "Cincinnati", "Berkeley", "Delaware"])
    .describe("Cities/states to search: Chicago, Seattle, Kansas City, Cincinnati, Berkeley, Delaware"),
})

export const businessLicenseTool = tool({
  description:
    "Search city business license databases. " +
    "Find businesses by NAME or by OWNER name. " +
    "Covers: Chicago (400K licenses), Seattle, Kansas City, Cincinnati, Berkeley, Delaware. " +
    "Returns: business name, owner, license type, status, address. " +
    "Use searchType='owner' to find what businesses a PERSON owns. " +
    "COMPLEMENTS business_entities tool (which searches state registries).",

  parameters: businessLicenseSchema,

  execute: async ({ searchTerm, searchType, cities }): Promise<BusinessLicenseResult> => {
    return searchBusinessLicenses(searchTerm, searchType, cities)
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableBusinessLicenseTool(): boolean {
  return true
}

export { searchBusinessLicenses }
