/**
 * FAA Aircraft Registry Search Tool
 *
 * Searches the FAA N-Number (aircraft registration) database.
 * Private aircraft ownership is a STRONG wealth indicator.
 *
 * Data Source: FAA Releasable Aircraft Database
 * - N-Number lookups: Direct FAA registry query
 * - Name searches: Linkup-assisted search with FAA registry context
 *
 * Use Cases:
 * - Wealth verification (aircraft owners are typically wealthy)
 * - Asset discovery for major gift prospects
 * - Due diligence on business owners
 *
 * FREE - No API key required for direct FAA lookups
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// TYPES
// ============================================================================

export interface Aircraft {
  nNumber: string
  serialNumber: string
  manufacturer: string
  model: string
  year: string
  registrantName: string
  registrantAddress: string
  registrantCity: string
  registrantState: string
  registrantZip: string
  registrantType: string
  aircraftType: string
  engineType: string
  status: string
  certificateIssueDate?: string
  expirationDate?: string
  estimatedValue?: string
}

export interface FAARegistryResult {
  searchTerm: string
  searchType: "name" | "n_number"
  aircraft: Aircraft[]
  summary: {
    totalFound: number
    estimatedTotalValue: string
    wealthIndicator: "ultra_high" | "very_high" | "high" | "moderate" | "unknown"
    aircraftTypes: string[]
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FAA_TIMEOUT_MS = 30000

const AIRCRAFT_VALUES: Record<string, { min: number; max: number }> = {
  // Large Business Jets
  "GULFSTREAM G650": { min: 40000000, max: 70000000 },
  "GULFSTREAM G550": { min: 15000000, max: 35000000 },
  "GULFSTREAM G500": { min: 20000000, max: 45000000 },
  "GULFSTREAM": { min: 5000000, max: 70000000 },
  "BOMBARDIER GLOBAL": { min: 25000000, max: 75000000 },
  "BOMBARDIER CHALLENGER": { min: 8000000, max: 35000000 },
  "BOMBARDIER": { min: 3000000, max: 60000000 },
  "DASSAULT FALCON 8X": { min: 35000000, max: 60000000 },
  "DASSAULT FALCON 7X": { min: 25000000, max: 45000000 },
  "DASSAULT FALCON 900": { min: 10000000, max: 25000000 },
  "DASSAULT": { min: 5000000, max: 50000000 },
  "EMBRAER PRAETOR": { min: 12000000, max: 25000000 },
  "EMBRAER LEGACY": { min: 8000000, max: 20000000 },
  "EMBRAER PHENOM": { min: 3000000, max: 12000000 },
  "EMBRAER": { min: 3000000, max: 30000000 },

  // Light/Medium Jets
  "CESSNA CITATION X": { min: 8000000, max: 18000000 },
  "CESSNA CITATION LATITUDE": { min: 12000000, max: 20000000 },
  "CESSNA CITATION LONGITUDE": { min: 20000000, max: 30000000 },
  "CESSNA CITATION": { min: 2000000, max: 25000000 },
  "LEARJET 75": { min: 8000000, max: 15000000 },
  "LEARJET 45": { min: 3000000, max: 8000000 },
  "LEARJET": { min: 1500000, max: 15000000 },
  "HAWKER": { min: 2000000, max: 15000000 },
  "BEECHCRAFT PREMIER": { min: 2000000, max: 5000000 },
  "HONDA JET": { min: 4000000, max: 7000000 },
  "ECLIPSE": { min: 1500000, max: 3500000 },

  // Turboprops
  "PILATUS PC-12": { min: 3000000, max: 6000000 },
  "PILATUS PC-24": { min: 8000000, max: 12000000 },
  "PILATUS": { min: 2000000, max: 12000000 },
  "BEECHCRAFT KING AIR 350": { min: 4000000, max: 8000000 },
  "BEECHCRAFT KING AIR 250": { min: 3000000, max: 6000000 },
  "KING AIR": { min: 1000000, max: 8000000 },
  "DAHER TBM": { min: 2000000, max: 5000000 },
  "SOCATA TBM": { min: 1500000, max: 4000000 },
  "PIPER M600": { min: 2000000, max: 3500000 },

  // High-Performance Single Engine
  "CIRRUS SF50": { min: 2000000, max: 3500000 },
  "CIRRUS SR22": { min: 500000, max: 1000000 },
  "CIRRUS SR20": { min: 350000, max: 600000 },
  "CIRRUS": { min: 300000, max: 3500000 },
  "BEECHCRAFT BONANZA": { min: 150000, max: 800000 },
  "BEECHCRAFT": { min: 100000, max: 8000000 },
  "PIPER MALIBU": { min: 400000, max: 1500000 },
  "PIPER MERIDIAN": { min: 800000, max: 2000000 },
  "PIPER": { min: 50000, max: 2000000 },
  "CESSNA 400": { min: 400000, max: 700000 },
  "CESSNA 350": { min: 300000, max: 500000 },
  "CESSNA 206": { min: 150000, max: 400000 },
  "CESSNA 182": { min: 80000, max: 300000 },
  "CESSNA 172": { min: 50000, max: 200000 },
  "CESSNA": { min: 30000, max: 2000000 },
  "MOONEY": { min: 80000, max: 500000 },
  "DIAMOND DA62": { min: 800000, max: 1200000 },
  "DIAMOND": { min: 200000, max: 1200000 },

  // Helicopters
  "SIKORSKY S-76": { min: 8000000, max: 20000000 },
  "SIKORSKY S-92": { min: 15000000, max: 30000000 },
  "SIKORSKY": { min: 5000000, max: 30000000 },
  "AIRBUS H175": { min: 12000000, max: 20000000 },
  "AIRBUS H160": { min: 14000000, max: 22000000 },
  "AIRBUS H145": { min: 8000000, max: 14000000 },
  "AIRBUS H130": { min: 2500000, max: 4000000 },
  "AIRBUS HELICOPTERS": { min: 2000000, max: 22000000 },
  "EUROCOPTER": { min: 2000000, max: 15000000 },
  "AGUSTA AW139": { min: 10000000, max: 18000000 },
  "AGUSTA AW109": { min: 3000000, max: 8000000 },
  "AGUSTA": { min: 3000000, max: 18000000 },
  "LEONARDO": { min: 3000000, max: 18000000 },
  "BELL 429": { min: 5000000, max: 9000000 },
  "BELL 412": { min: 4000000, max: 12000000 },
  "BELL 407": { min: 2000000, max: 5000000 },
  "BELL 206": { min: 500000, max: 2000000 },
  "BELL": { min: 500000, max: 15000000 },
  "ROBINSON R66": { min: 800000, max: 1300000 },
  "ROBINSON R44": { min: 300000, max: 600000 },
  "ROBINSON R22": { min: 150000, max: 350000 },
  "ROBINSON": { min: 150000, max: 1300000 },
  "MD HELICOPTERS": { min: 1000000, max: 5000000 },
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function estimateAircraftValue(manufacturer: string, model: string): { min: number; max: number } {
  const fullName = `${manufacturer} ${model}`.toUpperCase()

  // Try most specific match first (longer keys)
  const sortedKeys = Object.keys(AIRCRAFT_VALUES).sort((a, b) => b.length - a.length)
  for (const key of sortedKeys) {
    if (fullName.includes(key)) {
      return AIRCRAFT_VALUES[key]
    }
  }

  // Default for unknown aircraft
  return { min: 50000, max: 500000 }
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

function getWealthIndicator(totalValue: number): "ultra_high" | "very_high" | "high" | "moderate" | "unknown" {
  if (totalValue >= 25000000) return "ultra_high"  // $25M+ = ultra high (large jet owner)
  if (totalValue >= 10000000) return "very_high"   // $10M+ = very high (mid-size jet)
  if (totalValue >= 2000000) return "high"          // $2M+ = high (turboprop/light jet)
  if (totalValue >= 500000) return "moderate"       // $500K+ = moderate (high-performance single)
  return "unknown"
}

function extractText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

// ============================================================================
// FAA REGISTRY PARSERS
// ============================================================================

/**
 * Parse N-Number detail page (single aircraft)
 */
function parseNNumberDetailPage(html: string, nNumber: string): Aircraft | null {
  // Look for the registrant information section
  const registrantMatch = html.match(/Registrant\s*<\/h\d>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i)
  const aircraftMatch = html.match(/Aircraft\s*Description[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i)

  if (!registrantMatch && !aircraftMatch) {
    return null
  }

  // Extract registrant info
  let registrantName = ""
  let registrantAddress = ""
  let registrantCity = ""
  let registrantState = ""
  let registrantZip = ""
  let registrantType = "Individual"

  if (registrantMatch) {
    const registrantHtml = registrantMatch[1]
    const lines = registrantHtml.split(/<br\s*\/?>/i).map(extractText).filter(Boolean)
    if (lines.length > 0) registrantName = lines[0]
    if (lines.length > 1) registrantAddress = lines[1]
    if (lines.length > 2) {
      const cityStateZip = lines[2]
      const cszMatch = cityStateZip.match(/^(.+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/i)
      if (cszMatch) {
        registrantCity = cszMatch[1]
        registrantState = cszMatch[2]
        registrantZip = cszMatch[3]
      }
    }
  }

  // Extract aircraft description
  let manufacturer = ""
  let model = ""
  let serialNumber = ""
  let year = ""
  let aircraftType = ""
  let engineType = ""
  let status = "Active"

  if (aircraftMatch) {
    const tableHtml = aircraftMatch[1]

    const manufacturerMatch = tableHtml.match(/Manufacturer\s*Name[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i)
    if (manufacturerMatch) manufacturer = extractText(manufacturerMatch[1])

    const modelMatch = tableHtml.match(/Model[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i)
    if (modelMatch) model = extractText(modelMatch[1])

    const serialMatch = tableHtml.match(/Serial\s*Number[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i)
    if (serialMatch) serialNumber = extractText(serialMatch[1])

    const yearMatch = tableHtml.match(/Year\s*Mfr[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i)
    if (yearMatch) year = extractText(yearMatch[1])

    const typeMatch = tableHtml.match(/Type\s*Aircraft[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i)
    if (typeMatch) aircraftType = extractText(typeMatch[1])

    const engineMatch = tableHtml.match(/Type\s*Engine[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i)
    if (engineMatch) engineType = extractText(engineMatch[1])
  }

  const valueEstimate = estimateAircraftValue(manufacturer, model)

  return {
    nNumber: nNumber.toUpperCase().startsWith("N") ? nNumber.toUpperCase() : `N${nNumber.toUpperCase()}`,
    serialNumber,
    manufacturer,
    model,
    year,
    registrantName,
    registrantAddress,
    registrantCity,
    registrantState,
    registrantZip,
    registrantType,
    aircraftType,
    engineType,
    status,
    estimatedValue: `${formatCurrency(valueEstimate.min)} - ${formatCurrency(valueEstimate.max)}`,
  }
}

/**
 * Parse name search results page (multiple aircraft)
 */
function parseNameSearchResults(html: string): Aircraft[] {
  const aircraft: Aircraft[] = []

  // Look for result table
  const tableMatch = html.match(/<table[^>]*id="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/table>/i) ||
    html.match(/<table[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/table>/i) ||
    html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi)

  if (!tableMatch) {
    console.log("[FAARegistry] No result table found in HTML")
    return aircraft
  }

  const tableHtml = Array.isArray(tableMatch) ? tableMatch.join("") : tableMatch[1]
  const rowMatches = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]

  // Skip header row
  for (let i = 1; i < rowMatches.length; i++) {
    const rowHtml = rowMatches[i][1]
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]

    if (cells.length >= 4) {
      const nNumber = extractText(cells[0][1])
      const registrantName = extractText(cells[1][1])
      const manufacturer = cells[2] ? extractText(cells[2][1]) : ""
      const model = cells[3] ? extractText(cells[3][1]) : ""
      const city = cells[4] ? extractText(cells[4][1]) : ""
      const state = cells[5] ? extractText(cells[5][1]) : ""

      if (nNumber && registrantName) {
        const valueEstimate = estimateAircraftValue(manufacturer, model)

        aircraft.push({
          nNumber: nNumber.toUpperCase().startsWith("N") ? nNumber.toUpperCase() : `N${nNumber.toUpperCase()}`,
          serialNumber: "",
          manufacturer,
          model,
          year: "",
          registrantName,
          registrantAddress: "",
          registrantCity: city,
          registrantState: state,
          registrantZip: "",
          registrantType: "Individual",
          aircraftType: "",
          engineType: "",
          status: "Active",
          estimatedValue: `${formatCurrency(valueEstimate.min)} - ${formatCurrency(valueEstimate.max)}`,
        })
      }
    }
  }

  return aircraft
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FAA_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        ...options.headers,
      },
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Search FAA Registry by N-Number (tail number)
 */
async function searchByNNumber(nNumber: string): Promise<Aircraft | null> {
  // Normalize N-number (remove N prefix if present for the query)
  const cleanNNumber = nNumber.toUpperCase().replace(/^N/, "")

  const url = `https://registry.faa.gov/AircraftInquiry/Search/NNumberResult?nNumberTxt=${encodeURIComponent(cleanNNumber)}`
  console.log(`[FAARegistry] N-Number lookup: ${url}`)

  const response = await fetchWithTimeout(url)

  if (!response.ok) {
    throw new Error(`FAA Registry returned ${response.status}: ${response.statusText}`)
  }

  const html = await response.text()

  // Check for "no results" indicators
  if (html.includes("No aircraft found") || html.includes("not on file")) {
    return null
  }

  return parseNNumberDetailPage(html, cleanNNumber)
}

/**
 * Search FAA Registry by registrant name
 */
async function searchByName(name: string): Promise<Aircraft[]> {
  const url = `https://registry.faa.gov/AircraftInquiry/Search/NameResult?NameTxt=${encodeURIComponent(name)}`
  console.log(`[FAARegistry] Name search: ${url}`)

  const response = await fetchWithTimeout(url)

  if (!response.ok) {
    throw new Error(`FAA Registry returned ${response.status}: ${response.statusText}`)
  }

  const html = await response.text()

  // Check for "no results" indicators
  if (html.includes("No records match") || html.includes("No aircraft found")) {
    return []
  }

  return parseNameSearchResults(html)
}

/**
 * Main search function with strategy selection
 */
async function searchFAARegistry(
  searchTerm: string,
  searchType: "name" | "n_number" = "name"
): Promise<FAARegistryResult> {
  console.log(`[FAARegistry] Searching for "${searchTerm}" (${searchType})`)
  const startTime = Date.now()

  const sources: Array<{ name: string; url: string }> = [
    {
      name: "FAA Aircraft Registry",
      url: "https://registry.faa.gov/aircraftinquiry/",
    },
  ]

  let aircraft: Aircraft[] = []
  let errorMessage: string | undefined

  try {
    if (searchType === "n_number") {
      const result = await searchByNNumber(searchTerm)
      if (result) {
        aircraft = [result]
      }
    } else {
      aircraft = await searchByName(searchTerm)
    }

    const duration = Date.now() - startTime
    console.log(`[FAARegistry] Found ${aircraft.length} aircraft in ${duration}ms`)
  } catch (error) {
    const duration = Date.now() - startTime
    errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`[FAARegistry] Error after ${duration}ms:`, errorMessage)
  }

  // Calculate summary statistics
  let totalMinValue = 0
  let totalMaxValue = 0
  const aircraftTypes: string[] = []

  for (const ac of aircraft) {
    const value = estimateAircraftValue(ac.manufacturer, ac.model)
    totalMinValue += value.min
    totalMaxValue += value.max
    const type = `${ac.manufacturer} ${ac.model}`.trim()
    if (type && !aircraftTypes.includes(type)) {
      aircraftTypes.push(type)
    }
  }

  const avgValue = (totalMinValue + totalMaxValue) / 2

  // Build formatted raw content
  const rawLines: string[] = []
  rawLines.push(`# FAA Aircraft Registry Search`)
  rawLines.push("")
  rawLines.push(`**Search Term:** ${searchTerm}`)
  rawLines.push(`**Search Type:** ${searchType === "n_number" ? "N-Number (Tail Number)" : "Registrant Name"}`)
  rawLines.push("")

  if (errorMessage) {
    rawLines.push(`## ⚠️ Search Error`)
    rawLines.push("")
    rawLines.push(`The FAA registry search encountered an error: ${errorMessage}`)
    rawLines.push("")
    rawLines.push(`**Fallback:** Try searching the FAA registry directly at https://registry.faa.gov/aircraftinquiry/`)
  } else if (aircraft.length > 0) {
    rawLines.push(`## Summary`)
    rawLines.push("")
    rawLines.push(`| Metric | Value |`)
    rawLines.push(`|--------|-------|`)
    rawLines.push(`| Aircraft Found | ${aircraft.length} |`)
    rawLines.push(`| Estimated Total Value | ${formatCurrency(totalMinValue)} - ${formatCurrency(totalMaxValue)} |`)
    rawLines.push(`| Wealth Indicator | **${getWealthIndicator(avgValue).toUpperCase().replace(/_/g, " ")}** |`)
    rawLines.push("")
    rawLines.push(`## Aircraft Details`)
    rawLines.push("")

    for (const ac of aircraft) {
      rawLines.push(`### ${ac.nNumber} - ${ac.manufacturer} ${ac.model}`)
      rawLines.push("")
      rawLines.push(`| Field | Value |`)
      rawLines.push(`|-------|-------|`)
      rawLines.push(`| Registrant | ${ac.registrantName} |`)
      if (ac.registrantCity && ac.registrantState) {
        rawLines.push(`| Location | ${ac.registrantCity}, ${ac.registrantState} |`)
      }
      if (ac.year) {
        rawLines.push(`| Year | ${ac.year} |`)
      }
      if (ac.serialNumber) {
        rawLines.push(`| Serial Number | ${ac.serialNumber} |`)
      }
      if (ac.aircraftType) {
        rawLines.push(`| Type | ${ac.aircraftType} |`)
      }
      if (ac.engineType) {
        rawLines.push(`| Engine | ${ac.engineType} |`)
      }
      if (ac.estimatedValue) {
        rawLines.push(`| Estimated Value | ${ac.estimatedValue} |`)
      }
      rawLines.push("")
    }
  } else {
    rawLines.push(`## No Results`)
    rawLines.push("")
    rawLines.push(`No aircraft found registered to "${searchTerm}".`)
    rawLines.push("")
    rawLines.push(`### Wealth Indicator Context`)
    rawLines.push("")
    rawLines.push(`Aircraft ownership is a **STRONG indicator** of high net worth:`)
    rawLines.push("")
    rawLines.push(`| Aircraft Type | Typical Value Range | Net Worth Implication |`)
    rawLines.push(`|---------------|--------------------|-----------------------|`)
    rawLines.push(`| Single-engine piston | $50K - $500K | Upper middle class |`)
    rawLines.push(`| High-performance single | $300K - $1.5M | Millionaire |`)
    rawLines.push(`| Turboprop | $1M - $8M | Multi-millionaire |`)
    rawLines.push(`| Light jet | $2M - $15M | $10M+ net worth |`)
    rawLines.push(`| Large cabin jet | $15M - $75M | $50M+ net worth |`)
    rawLines.push(`| Helicopter | $300K - $20M | Varies widely |`)
    rawLines.push("")
    rawLines.push(`**Note:** Search the FAA registry directly at https://registry.faa.gov/aircraftinquiry/`)
  }

  return {
    searchTerm,
    searchType,
    aircraft,
    summary: {
      totalFound: aircraft.length,
      estimatedTotalValue:
        aircraft.length > 0
          ? `${formatCurrency(totalMinValue)} - ${formatCurrency(totalMaxValue)}`
          : "$0",
      wealthIndicator: getWealthIndicator(avgValue),
      aircraftTypes,
    },
    rawContent: rawLines.join("\n"),
    sources,
    error: errorMessage,
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const faaAircraftSchema = z.object({
  searchTerm: z.string().describe("Name of person/company or N-number to search for"),
  searchType: z
    .enum(["name", "n_number"])
    .optional()
    .default("name")
    .describe("Search by registrant name or N-number (tail number). Use 'n_number' for specific aircraft lookups."),
})

export const faaAircraftTool = tool({
  description:
    "Search the FAA Aircraft Registry for private aircraft ownership. " +
    "Aircraft ownership is a STRONG WEALTH INDICATOR. " +
    "Returns: N-number, aircraft type, registrant name, location, estimated value. " +
    "VALUE RANGES: Single-engine ($50K-$500K), Turboprop ($1M-$8M), Light jet ($2M-$15M), Large jet ($15M-$75M). " +
    "ULTRA-HIGH NET WORTH: Multiple aircraft or large jets (Gulfstream, Bombardier Global) suggest $50M+ net worth.",

  parameters: faaAircraftSchema,

  execute: async ({ searchTerm, searchType }): Promise<FAARegistryResult> => {
    return searchFAARegistry(searchTerm, searchType)
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableFAAAircraftTool(): boolean {
  return true
}

export { searchFAARegistry }
