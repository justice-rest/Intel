/**
 * USCG Vessel Documentation Search Tool
 *
 * Searches the U.S. Coast Guard vessel documentation database via CGMIX API.
 * Documented vessels (boats 5+ net tons) require federal registration.
 * Boat ownership is a wealth indicator.
 *
 * Data Source: USCG CGMIX PSIX Web Service
 * API: https://cgmix.uscg.mil/xml/PSIXData.asmx
 *
 * IMPORTANT LIMITATION (2018+):
 * Owner/registrant information (name, address) is NO LONGER publicly available.
 * The USCG removed all Personal Identifiable Information (PII) from public databases
 * for privacy reasons. You can only search by VESSEL NAME, not by owner name.
 *
 * Use Cases:
 * - Verify specific vessel ownership (if you know the vessel name)
 * - Get vessel specifications (length, tonnage, year built)
 * - Assess wealth from known vessel ownership
 *
 * FREE - No API key required
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// TYPES
// ============================================================================

export interface Vessel {
  vesselId: string
  vesselName: string
  officialNumber: string
  hullIdNumber: string
  callSign: string
  status: string
  serviceType: string
  flag: string
  yearBuilt: string
  length?: number
  breadth?: number
  depth?: number
  grossTonnage?: number
  netTonnage?: number
  hullMaterial?: string
  estimatedValue?: string
}

export interface USCGVesselResult {
  searchTerm: string
  searchType: "vessel_name" | "vessel_id" | "hull_id"
  vessels: Vessel[]
  summary: {
    totalFound: number
    totalGrossTonnage: number
    estimatedTotalValue: string
    wealthIndicator: "ultra_high" | "very_high" | "high" | "moderate" | "unknown"
    vesselTypes: string[]
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
  ownershipNote: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CGMIX_TIMEOUT_MS = 30000
const CGMIX_API_URL = "https://cgmix.uscg.mil/xml/PSIXData.asmx"

// ============================================================================
// VESSEL VALUE ESTIMATES
// ============================================================================

function estimateVesselValue(
  length: number,
  serviceType: string,
  yearBuilt: string
): { min: number; max: number } {
  const currentYear = new Date().getFullYear()
  const age = currentYear - parseInt(yearBuilt || "2000", 10)
  const depreciationFactor = Math.max(0.2, 1 - age * 0.04) // 4% per year, min 20%

  const type = serviceType.toUpperCase()
  let baseValue = { min: 50000, max: 200000 }

  // Recreational/Yacht vessels
  if (type.includes("RECREATIONAL") || type.includes("PLEASURE")) {
    if (length >= 150) {
      baseValue = { min: 20000000, max: 100000000 } // Superyacht
    } else if (length >= 100) {
      baseValue = { min: 5000000, max: 30000000 } // Mega yacht
    } else if (length >= 80) {
      baseValue = { min: 2000000, max: 15000000 } // Large yacht
    } else if (length >= 60) {
      baseValue = { min: 1000000, max: 5000000 } // Medium-large yacht
    } else if (length >= 40) {
      baseValue = { min: 300000, max: 2000000 } // Medium yacht
    } else if (length >= 30) {
      baseValue = { min: 100000, max: 500000 } // Small yacht
    } else {
      baseValue = { min: 30000, max: 200000 } // Basic boat
    }
  }
  // Commercial fishing vessels
  else if (type.includes("FISHING") || type.includes("FISH")) {
    if (length >= 100) {
      baseValue = { min: 1000000, max: 5000000 }
    } else if (length >= 60) {
      baseValue = { min: 300000, max: 1500000 }
    } else {
      baseValue = { min: 50000, max: 500000 }
    }
  }
  // Passenger vessels
  else if (type.includes("PASSENGER")) {
    if (length >= 100) {
      baseValue = { min: 5000000, max: 50000000 }
    } else if (length >= 60) {
      baseValue = { min: 1000000, max: 10000000 }
    } else {
      baseValue = { min: 200000, max: 2000000 }
    }
  }
  // Towing/workboats
  else if (type.includes("TOWING") || type.includes("TUG")) {
    baseValue = { min: 500000, max: 5000000 }
  }
  // Offshore supply
  else if (type.includes("OFFSHORE") || type.includes("SUPPLY")) {
    baseValue = { min: 2000000, max: 20000000 }
  }
  // Tank vessels
  else if (type.includes("TANK")) {
    if (length >= 200) {
      baseValue = { min: 20000000, max: 100000000 }
    } else {
      baseValue = { min: 5000000, max: 30000000 }
    }
  }
  // Research vessels
  else if (type.includes("RESEARCH")) {
    baseValue = { min: 1000000, max: 20000000 }
  }
  // Barges
  else if (type.includes("BARGE")) {
    baseValue = { min: 500000, max: 10000000 }
  }

  return {
    min: Math.round(baseValue.min * depreciationFactor),
    max: Math.round(baseValue.max * depreciationFactor),
  }
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`
  }
  return `$${amount.toLocaleString()}`
}

function getWealthIndicator(
  totalValue: number
): "ultra_high" | "very_high" | "high" | "moderate" | "unknown" {
  if (totalValue >= 10000000) return "ultra_high" // $10M+ = mega yacht owner
  if (totalValue >= 2000000) return "very_high" // $2M+ = large yacht
  if (totalValue >= 500000) return "high" // $500K+ = medium yacht
  if (totalValue >= 100000) return "moderate" // $100K+ = boat owner
  return "unknown"
}

// ============================================================================
// CGMIX SOAP API CLIENT
// ============================================================================

function buildSoapRequest(
  method: string,
  params: Record<string, string>
): string {
  const paramXml = Object.entries(params)
    .filter(([, value]) => value)
    .map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`)
    .join("\n      ")

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${method} xmlns="CGMIX.PSIXData">
      ${paramXml}
    </${method}>
  </soap:Body>
</soap:Envelope>`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function extractXmlValue(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i")
  const match = xml.match(regex)
  return match ? match[1].trim() : ""
}

function extractXmlNumber(xml: string, tag: string): number {
  const value = extractXmlValue(xml, tag)
  return value ? parseFloat(value) : 0
}

async function callCgmixApi(
  method: string,
  params: Record<string, string>
): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CGMIX_TIMEOUT_MS)

  try {
    const soapRequest = buildSoapRequest(method, params)

    const response = await fetch(CGMIX_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `CGMIX.PSIXData/${method}`,
      },
      body: soapRequest,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`CGMIX API returned ${response.status}: ${response.statusText}`)
    }

    return await response.text()
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// ============================================================================
// VESSEL SEARCH FUNCTIONS
// ============================================================================

function parseVesselSummaryResponse(xml: string): Vessel[] {
  const vessels: Vessel[] = []

  // Find all vessel entries in the response
  const vesselMatches = xml.matchAll(/<Table[^>]*>([\s\S]*?)<\/Table>/gi)

  for (const match of vesselMatches) {
    const vesselXml = match[1]

    const vesselId = extractXmlValue(vesselXml, "VesselID")
    const vesselName = extractXmlValue(vesselXml, "VesselName")

    if (!vesselId || !vesselName) continue

    const vessel: Vessel = {
      vesselId,
      vesselName,
      officialNumber: extractXmlValue(vesselXml, "Identification"),
      hullIdNumber: extractXmlValue(vesselXml, "HIN"),
      callSign: extractXmlValue(vesselXml, "VesselCallSign"),
      status: extractXmlValue(vesselXml, "StatusLookupName"),
      serviceType: extractXmlValue(vesselXml, "ServiceType") || "Unknown",
      flag: extractXmlValue(vesselXml, "CountryLookupName"),
      yearBuilt: extractXmlValue(vesselXml, "ConstructionCompletedYear"),
    }

    vessels.push(vessel)
  }

  return vessels
}

async function getVesselDimensions(vesselId: string): Promise<{
  length: number
  breadth: number
  depth: number
}> {
  try {
    const response = await callCgmixApi("getVesselDimensionsXMLString", {
      VesselID: vesselId,
    })

    return {
      length: extractXmlNumber(response, "LengthInFeet"),
      breadth: extractXmlNumber(response, "BreadthInFeet"),
      depth: extractXmlNumber(response, "DepthInFeet"),
    }
  } catch {
    return { length: 0, breadth: 0, depth: 0 }
  }
}

async function getVesselTonnage(vesselId: string): Promise<{
  grossTonnage: number
  netTonnage: number
}> {
  try {
    const response = await callCgmixApi("getVesselTonnageXMLString", {
      VesselID: vesselId,
    })

    return {
      grossTonnage: extractXmlNumber(response, "GrossTons"),
      netTonnage: extractXmlNumber(response, "NetTons"),
    }
  } catch {
    return { grossTonnage: 0, netTonnage: 0 }
  }
}

async function searchVessels(
  searchTerm: string,
  searchType: "vessel_name" | "vessel_id" | "hull_id"
): Promise<Vessel[]> {
  console.log(`[USCGVessels] Searching CGMIX for "${searchTerm}" (${searchType})`)

  const params: Record<string, string> = {
    VesselID: "",
    VesselName: "",
    CallSign: "",
    VIN: "",
    HIN: "",
    Flag: "",
    Service: "",
    BuildYear: "",
  }

  switch (searchType) {
    case "vessel_name":
      params.VesselName = searchTerm
      break
    case "vessel_id":
      params.VIN = searchTerm
      break
    case "hull_id":
      params.HIN = searchTerm
      break
  }

  const response = await callCgmixApi("getVesselSummaryXMLString", params)
  const vessels = parseVesselSummaryResponse(response)

  // Get additional details for each vessel (in parallel, up to 5)
  const detailedVessels = await Promise.all(
    vessels.slice(0, 10).map(async (vessel) => {
      const [dimensions, tonnage] = await Promise.all([
        getVesselDimensions(vessel.vesselId),
        getVesselTonnage(vessel.vesselId),
      ])

      vessel.length = dimensions.length
      vessel.breadth = dimensions.breadth
      vessel.depth = dimensions.depth
      vessel.grossTonnage = tonnage.grossTonnage
      vessel.netTonnage = tonnage.netTonnage

      // Calculate estimated value
      const valueEstimate = estimateVesselValue(
        vessel.length || 30,
        vessel.serviceType,
        vessel.yearBuilt
      )
      vessel.estimatedValue = `${formatCurrency(valueEstimate.min)} - ${formatCurrency(valueEstimate.max)}`

      return vessel
    })
  )

  return detailedVessels
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

async function searchUSCGVessels(
  searchTerm: string,
  searchType: "vessel_name" | "vessel_id" | "hull_id" = "vessel_name"
): Promise<USCGVesselResult> {
  console.log(`[USCGVessels] Starting search for "${searchTerm}" (${searchType})`)
  const startTime = Date.now()

  const sources: Array<{ name: string; url: string }> = [
    {
      name: "USCG Maritime Information Exchange (CGMIX)",
      url: "https://cgmix.uscg.mil/psix/",
    },
  ]

  const ownershipNote =
    "**IMPORTANT:** Owner/registrant information is NOT publicly available. " +
    "Since 2018, the USCG has removed all Personal Identifiable Information (PII) " +
    "from public databases. You can only search by vessel name, not by owner name. " +
    "To find vessel ownership, use news searches, court records, or state registration databases."

  let vessels: Vessel[] = []
  let errorMessage: string | undefined

  try {
    vessels = await searchVessels(searchTerm, searchType)
    const duration = Date.now() - startTime
    console.log(`[USCGVessels] Found ${vessels.length} vessels in ${duration}ms`)
  } catch (error) {
    const duration = Date.now() - startTime
    errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`[USCGVessels] Error after ${duration}ms:`, errorMessage)
  }

  // Calculate summary statistics
  let totalMinValue = 0
  let totalMaxValue = 0
  let totalGrossTonnage = 0
  const vesselTypes: string[] = []

  for (const vessel of vessels) {
    const value = estimateVesselValue(
      vessel.length || 30,
      vessel.serviceType,
      vessel.yearBuilt
    )
    totalMinValue += value.min
    totalMaxValue += value.max
    totalGrossTonnage += vessel.grossTonnage || 0

    if (vessel.serviceType && !vesselTypes.includes(vessel.serviceType)) {
      vesselTypes.push(vessel.serviceType)
    }
  }

  const avgValue = (totalMinValue + totalMaxValue) / 2

  // Build formatted raw content
  const rawLines: string[] = []
  rawLines.push(`# USCG Vessel Documentation Search`)
  rawLines.push("")
  rawLines.push(`**Search Term:** ${searchTerm}`)
  rawLines.push(`**Search Type:** ${searchType.replace(/_/g, " ").toUpperCase()}`)
  rawLines.push("")
  rawLines.push(`> ${ownershipNote}`)
  rawLines.push("")

  if (errorMessage) {
    rawLines.push(`## ⚠️ Search Error`)
    rawLines.push("")
    rawLines.push(`The CGMIX API encountered an error: ${errorMessage}`)
    rawLines.push("")
    rawLines.push(`**Fallback:** Search the USCG PSIX directly at https://cgmix.uscg.mil/psix/`)
  } else if (vessels.length > 0) {
    rawLines.push(`## Summary`)
    rawLines.push("")
    rawLines.push(`| Metric | Value |`)
    rawLines.push(`|--------|-------|`)
    rawLines.push(`| Vessels Found | ${vessels.length} |`)
    rawLines.push(`| Total Gross Tonnage | ${totalGrossTonnage.toLocaleString()} GT |`)
    rawLines.push(`| Estimated Total Value | ${formatCurrency(totalMinValue)} - ${formatCurrency(totalMaxValue)} |`)
    rawLines.push(`| Wealth Indicator | **${getWealthIndicator(avgValue).toUpperCase().replace(/_/g, " ")}** |`)
    rawLines.push("")
    rawLines.push(`## Vessel Details`)
    rawLines.push("")

    for (const vessel of vessels) {
      rawLines.push(`### ${vessel.vesselName}`)
      rawLines.push("")
      rawLines.push(`| Field | Value |`)
      rawLines.push(`|-------|-------|`)
      rawLines.push(`| Official Number | ${vessel.officialNumber || "N/A"} |`)
      rawLines.push(`| Hull ID | ${vessel.hullIdNumber || "N/A"} |`)
      rawLines.push(`| Call Sign | ${vessel.callSign || "N/A"} |`)
      rawLines.push(`| Status | ${vessel.status || "Active"} |`)
      rawLines.push(`| Service Type | ${vessel.serviceType} |`)
      rawLines.push(`| Flag | ${vessel.flag || "United States"} |`)
      if (vessel.yearBuilt) {
        rawLines.push(`| Year Built | ${vessel.yearBuilt} |`)
      }
      if (vessel.length) {
        rawLines.push(`| Length | ${vessel.length} ft |`)
      }
      if (vessel.breadth) {
        rawLines.push(`| Beam | ${vessel.breadth} ft |`)
      }
      if (vessel.grossTonnage) {
        rawLines.push(`| Gross Tonnage | ${vessel.grossTonnage} GT |`)
      }
      if (vessel.estimatedValue) {
        rawLines.push(`| Estimated Value | ${vessel.estimatedValue} |`)
      }
      rawLines.push("")
    }
  } else {
    rawLines.push(`## No Results`)
    rawLines.push("")
    rawLines.push(`No documented vessels found matching "${searchTerm}".`)
    rawLines.push("")
    rawLines.push(`### Wealth Indicator Context`)
    rawLines.push("")
    rawLines.push(`Vessel ownership correlates strongly with wealth:`)
    rawLines.push("")
    rawLines.push(`| Vessel Type | Typical Value Range | Net Worth Implication |`)
    rawLines.push(`|-------------|--------------------|-----------------------|`)
    rawLines.push(`| Small boat (< 30 ft) | $30K - $200K | Upper middle class |`)
    rawLines.push(`| Medium yacht (30-50 ft) | $100K - $500K | Millionaire |`)
    rawLines.push(`| Large yacht (50-80 ft) | $500K - $5M | Multi-millionaire |`)
    rawLines.push(`| Mega yacht (80-150 ft) | $2M - $30M | $10M+ net worth |`)
    rawLines.push(`| Superyacht (150+ ft) | $20M - $100M+ | $50M+ net worth |`)
    rawLines.push("")
    rawLines.push(`**Note:** Search the USCG PSIX directly at https://cgmix.uscg.mil/psix/`)
  }

  return {
    searchTerm,
    searchType,
    vessels,
    summary: {
      totalFound: vessels.length,
      totalGrossTonnage,
      estimatedTotalValue:
        vessels.length > 0
          ? `${formatCurrency(totalMinValue)} - ${formatCurrency(totalMaxValue)}`
          : "$0",
      wealthIndicator: getWealthIndicator(avgValue),
      vesselTypes,
    },
    rawContent: rawLines.join("\n"),
    sources,
    error: errorMessage,
    ownershipNote,
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const uscgVesselSchema = z.object({
  searchTerm: z.string().describe("Vessel name, official number, or hull ID to search for"),
  searchType: z
    .enum(["vessel_name", "vessel_id", "hull_id"])
    .optional()
    .default("vessel_name")
    .describe(
      "Search type: 'vessel_name' for name search, 'vessel_id' for official/documentation number, 'hull_id' for HIN"
    ),
})

export const uscgVesselTool = tool({
  description:
    "Search USCG vessel documentation by VESSEL NAME (NOT owner name - owner data removed since 2018). " +
    "Returns vessel specs, dimensions, tonnage, year built, and estimated value. " +
    "WEALTH INDICATOR: Small boats ($30K-$200K), Yachts ($100K-$5M), Mega yachts ($2M-$30M), Superyachts ($20M-$100M+). " +
    "Use alongside FAA aircraft search for complete luxury asset discovery. " +
    "NOTE: To find vessel ownership, use web search for news articles or court records mentioning the vessel.",

  parameters: uscgVesselSchema,

  execute: async ({ searchTerm, searchType }): Promise<USCGVesselResult> => {
    return searchUSCGVessels(searchTerm, searchType)
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableUSCGVesselTool(): boolean {
  return true
}

export { searchUSCGVessels }
