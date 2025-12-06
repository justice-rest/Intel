/**
 * Property Valuation Tool (Enhanced with Native Search)
 *
 * Self-contained AVM tool that automatically fetches property data via Linkup,
 * parses results, and calculates home valuation. No AI intervention required
 * for data gathering - the tool handles the complete workflow.
 *
 * Workflow:
 * 1. User/AI calls with just an address
 * 2. Tool runs 4 parallel Linkup searches (Zillow/Redfin, tax records, comps, property details)
 * 3. Tool extracts property characteristics, online estimates, comparable sales
 * 4. Tool runs AVM ensemble calculation (hedonic + comps + online estimates)
 * 5. Returns complete valuation with confidence score
 *
 * Fallback: If search fails or returns insufficient data, AI can still pass
 * pre-gathered data via optional parameters.
 */

import { tool } from "ai"
import { z } from "zod"
import { LinkupClient } from "linkup-sdk"
import { calculateEnsembleValue } from "@/lib/avm/ensemble"
import type {
  AVMResult,
  PropertyCharacteristics,
  ComparableSale,
  OnlineEstimate,
  EstimateSource,
} from "@/lib/avm/types"
import { AVM_TIMEOUT_MS } from "@/lib/avm/config"
import {
  getLinkupApiKeyOptional,
  isLinkupEnabled,
  PROSPECT_RESEARCH_DOMAINS,
} from "@/lib/linkup/config"

// ============================================================================
// Constants
// ============================================================================

const SEARCH_TIMEOUT_MS = 45000 // 45 seconds per search
const TOTAL_TIMEOUT_MS = 90000 // 90 seconds total for all operations

// ============================================================================
// Schemas
// ============================================================================

/**
 * Schema for online estimate input (manual override)
 */
const onlineEstimateSchema = z.object({
  source: z
    .enum(["zillow", "redfin", "realtor", "county", "other"])
    .describe("Source of the estimate"),
  value: z
    .number()
    .positive()
    .describe("Estimated value in dollars"),
  sourceUrl: z
    .string()
    .optional()
    .default("")
    .describe("URL to the source"),
})

/**
 * Schema for comparable sale input (manual override)
 */
const comparableSaleSchema = z.object({
  address: z.string().describe("Address of the comparable property"),
  salePrice: z
    .number()
    .positive()
    .describe("Sale price in dollars"),
  saleDate: z
    .string()
    .describe("Sale date in YYYY-MM-DD format"),
  squareFeet: z.number().positive().optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  yearBuilt: z.number().optional(),
  distanceMiles: z.number().optional(),
  source: z.string().optional().default("web search"),
  sourceUrl: z.string().optional().default(""),
})

/**
 * Schema for property valuation tool parameters
 */
const propertyValuationSchema = z.object({
  address: z
    .string()
    .describe(
      "Full property address including city, state, and ZIP (e.g., '123 Main St, Austin, TX 78701'). " +
      "The tool will automatically search for property data, Zillow/Redfin estimates, and comparable sales."
    ),

  // Optional: Skip auto-search if set to true
  skipAutoSearch: z
    .boolean()
    .optional()
    .default(false)
    .describe("Set to true to skip automatic web search and use only provided data"),

  // Optional property characteristics (manual override or supplement)
  squareFeet: z.number().positive().optional().describe("Living area in square feet"),
  lotSizeSqFt: z.number().positive().optional().describe("Lot size in square feet"),
  bedrooms: z.number().optional().describe("Number of bedrooms"),
  bathrooms: z.number().optional().describe("Number of bathrooms"),
  yearBuilt: z.number().optional().describe("Year built"),
  garageSpaces: z.number().optional(),
  hasPool: z.boolean().optional(),
  hasBasement: z.boolean().optional(),
  hasFireplace: z.boolean().optional(),

  // Optional manual data (supplements or overrides auto-search)
  onlineEstimates: z
    .array(onlineEstimateSchema)
    .optional()
    .default([])
    .describe("Manual online estimates (supplements auto-search results)"),
  comparableSales: z
    .array(comparableSaleSchema)
    .optional()
    .default([])
    .describe("Manual comparable sales (supplements auto-search results)"),
})

export type PropertyValuationParams = z.infer<typeof propertyValuationSchema>

// ============================================================================
// Search Result Types
// ============================================================================

interface LinkupSource {
  name?: string
  url: string
  snippet?: string
}

interface SearchResult {
  answer: string
  sources: LinkupSource[]
  query: string
}

interface ExtractedData {
  property: Partial<PropertyCharacteristics>
  onlineEstimates: OnlineEstimate[]
  comparables: ComparableSale[]
  sources: Array<{ name: string; url: string }>
  searchesRun: number
  searchesFailed: number
}

// ============================================================================
// Linkup Search Helper
// ============================================================================

async function runLinkupSearch(
  client: LinkupClient,
  query: string,
  timeoutMs: number = SEARCH_TIMEOUT_MS
): Promise<SearchResult | null> {
  try {
    const result = await Promise.race([
      client.search({
        query,
        depth: "deep",
        outputType: "sourcedAnswer",
        includeDomains: [...PROSPECT_RESEARCH_DOMAINS],
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ])

    if (!result) {
      console.log(`[Property Valuation] Search timed out: ${query}`)
      return null
    }

    return {
      answer: result.answer || "",
      sources: (result.sources || []).map((s: LinkupSource) => ({
        name: s.name || "Untitled",
        url: s.url,
        snippet: s.snippet || "",
      })),
      query,
    }
  } catch (error) {
    console.error(`[Property Valuation] Search failed for "${query}":`, error)
    return null
  }
}

// ============================================================================
// Data Extraction from Search Results
// ============================================================================

/**
 * Extract dollar amounts from text
 */
function extractDollarAmounts(text: string): number[] {
  const amounts: number[] = []

  // Match patterns like $485,000 or $485000 or 485,000 or 485000
  const patterns = [
    /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:million|M)/gi,
    /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:thousand|K)/gi,
    /\$\s*([\d,]+(?:\.\d{2})?)/g,
    /(?:valued at|worth|estimate[ds]? (?:at|to be)?|priced at|asking|listed (?:at|for))\s*\$?\s*([\d,]+(?:\.\d{2})?)/gi,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      let value = parseFloat(match[1].replace(/,/g, ""))

      // Handle million/thousand suffixes
      if (/million|M/i.test(match[0])) {
        value *= 1_000_000
      } else if (/thousand|K/i.test(match[0])) {
        value *= 1_000
      }

      // Filter to reasonable home values ($50k - $50M)
      if (value >= 50_000 && value <= 50_000_000) {
        amounts.push(value)
      }
    }
  }

  return [...new Set(amounts)] // Deduplicate
}

/**
 * Extract property characteristics from text
 */
function extractPropertyDetails(text: string): Partial<PropertyCharacteristics> {
  const details: Partial<PropertyCharacteristics> = {}

  // Square footage patterns
  const sqftPatterns = [
    /(\d{1,2},?\d{3})\s*(?:sq\.?\s*ft\.?|square feet|sqft)/i,
    /(?:living (?:area|space)|home size)[:\s]+(\d{1,2},?\d{3})/i,
  ]
  for (const pattern of sqftPatterns) {
    const match = text.match(pattern)
    if (match) {
      details.squareFeet = parseInt(match[1].replace(/,/g, ""), 10)
      break
    }
  }

  // Bedrooms
  const bedsMatch = text.match(/(\d+)\s*(?:bed(?:room)?s?|BR|bd)/i)
  if (bedsMatch) {
    details.bedrooms = parseInt(bedsMatch[1], 10)
  }

  // Bathrooms (including half baths)
  const bathsMatch = text.match(/(\d+(?:\.\d)?)\s*(?:bath(?:room)?s?|BA|ba)/i)
  if (bathsMatch) {
    details.bathrooms = parseFloat(bathsMatch[1])
  }

  // Year built
  const yearMatch = text.match(/(?:built (?:in )?|year built[:\s]+|constructed (?:in )?)(19\d{2}|20[012]\d)/i)
  if (yearMatch) {
    details.yearBuilt = parseInt(yearMatch[1], 10)
  }

  // Lot size
  const lotMatch = text.match(/(?:lot size|lot)[:\s]+(\d{1,2},?\d{3})\s*(?:sq\.?\s*ft\.?|sqft)/i)
  if (lotMatch) {
    details.lotSizeSqFt = parseInt(lotMatch[1].replace(/,/g, ""), 10)
  }

  // Features
  if (/\bpool\b/i.test(text) && !/no pool/i.test(text)) {
    details.hasPool = true
  }
  if (/\bbasement\b/i.test(text) && !/no basement/i.test(text)) {
    details.hasBasement = true
  }
  if (/\bfireplace\b/i.test(text) && !/no fireplace/i.test(text)) {
    details.hasFireplace = true
  }
  if (/(\d+)\s*(?:car )?garage/i.test(text)) {
    const garageMatch = text.match(/(\d+)\s*(?:car )?garage/i)
    if (garageMatch) {
      details.garageSpaces = parseInt(garageMatch[1], 10)
    }
  }

  return details
}

/**
 * Extract online estimates from search results
 */
function extractOnlineEstimates(results: SearchResult[]): OnlineEstimate[] {
  const estimates: OnlineEstimate[] = []
  const seenSources = new Set<string>()

  for (const result of results) {
    const text = result.answer.toLowerCase()
    const amounts = extractDollarAmounts(result.answer)

    // Check for Zillow mentions
    if (text.includes("zillow") || text.includes("zestimate")) {
      const zillowAmounts = amounts.filter((a) => a >= 100_000)
      if (zillowAmounts.length > 0 && !seenSources.has("zillow")) {
        const source = result.sources.find((s) => s.url.includes("zillow.com"))
        estimates.push({
          source: "zillow",
          value: zillowAmounts[0],
          sourceUrl: source?.url || "",
        })
        seenSources.add("zillow")
      }
    }

    // Check for Redfin mentions
    if (text.includes("redfin")) {
      const redfinAmounts = amounts.filter((a) => a >= 100_000)
      if (redfinAmounts.length > 0 && !seenSources.has("redfin")) {
        const source = result.sources.find((s) => s.url.includes("redfin.com"))
        estimates.push({
          source: "redfin",
          value: redfinAmounts[0],
          sourceUrl: source?.url || "",
        })
        seenSources.add("redfin")
      }
    }

    // Check for Realtor.com mentions
    if (text.includes("realtor.com") || text.includes("realtor estimate")) {
      const realtorAmounts = amounts.filter((a) => a >= 100_000)
      if (realtorAmounts.length > 0 && !seenSources.has("realtor")) {
        const source = result.sources.find((s) => s.url.includes("realtor.com"))
        estimates.push({
          source: "realtor",
          value: realtorAmounts[0],
          sourceUrl: source?.url || "",
        })
        seenSources.add("realtor")
      }
    }

    // Check for county/tax assessment
    if (
      text.includes("assessed") ||
      text.includes("tax value") ||
      text.includes("county") ||
      text.includes("appraisal district")
    ) {
      const countyAmounts = amounts.filter((a) => a >= 50_000)
      if (countyAmounts.length > 0 && !seenSources.has("county")) {
        estimates.push({
          source: "county",
          value: countyAmounts[0],
          sourceUrl: "",
        })
        seenSources.add("county")
      }
    }
  }

  return estimates
}

/**
 * Extract comparable sales from search results
 */
function extractComparableSales(
  results: SearchResult[],
  subjectAddress: string
): ComparableSale[] {
  const comps: ComparableSale[] = []
  const seenAddresses = new Set<string>()

  // Normalize subject address for comparison
  const normalizedSubject = subjectAddress.toLowerCase().replace(/[^a-z0-9]/g, "")

  for (const result of results) {
    // Look for sale patterns in the text
    const salePatterns = [
      /(\d+\s+[\w\s]+(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|blvd|way|pl|place)[^,]*,\s*[\w\s]+,\s*[A-Z]{2}(?:\s+\d{5})?)\s*(?:sold|closed|purchased|bought)\s*(?:for|at)?\s*\$?([\d,]+)/gi,
      /(?:sold|closed|purchased)\s*(?:for|at)?\s*\$?([\d,]+)[^.]*?(\d+\s+[\w\s]+(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|blvd|way|pl|place)[^,]*)/gi,
    ]

    for (const pattern of salePatterns) {
      let match
      while ((match = pattern.exec(result.answer)) !== null) {
        let address: string
        let price: number

        if (match[1].match(/^\d+\s/)) {
          // First pattern: address first
          address = match[1].trim()
          price = parseInt(match[2].replace(/,/g, ""), 10)
        } else {
          // Second pattern: price first
          price = parseInt(match[1].replace(/,/g, ""), 10)
          address = match[2].trim()
        }

        // Skip if this is the subject property
        const normalizedComp = address.toLowerCase().replace(/[^a-z0-9]/g, "")
        if (normalizedComp === normalizedSubject) continue

        // Skip if we've already seen this address
        if (seenAddresses.has(normalizedComp)) continue

        // Validate price range
        if (price < 50_000 || price > 50_000_000) continue

        seenAddresses.add(normalizedComp)

        // Extract property details from nearby text
        const details = extractPropertyDetails(result.answer)

        // Try to extract sale date
        const dateMatch = result.answer.match(
          /(?:sold|closed|purchased)\s*(?:on|in)?\s*(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i
        )
        let saleDate = new Date().toISOString().split("T")[0] // Default to today
        if (dateMatch) {
          try {
            const parsed = new Date(dateMatch[1])
            if (!isNaN(parsed.getTime())) {
              saleDate = parsed.toISOString().split("T")[0]
            }
          } catch {
            // Keep default
          }
        }

        comps.push({
          address,
          salePrice: price,
          saleDate,
          squareFeet: details.squareFeet,
          bedrooms: details.bedrooms,
          bathrooms: details.bathrooms,
          yearBuilt: details.yearBuilt,
          source: "web search",
          sourceUrl: result.sources[0]?.url || "",
        })

        // Limit to 10 comps
        if (comps.length >= 10) break
      }
      if (comps.length >= 10) break
    }
    if (comps.length >= 10) break
  }

  return comps
}

/**
 * Collect all unique sources from search results
 */
function collectSources(results: SearchResult[]): Array<{ name: string; url: string }> {
  const sources: Array<{ name: string; url: string }> = []
  const seenUrls = new Set<string>()

  for (const result of results) {
    for (const source of result.sources) {
      if (!seenUrls.has(source.url)) {
        seenUrls.add(source.url)
        sources.push({
          name: source.name || new URL(source.url).hostname,
          url: source.url,
        })
      }
    }
  }

  return sources.slice(0, 20) // Limit to 20 sources
}

// ============================================================================
// Main Search and Extract Function
// ============================================================================

async function searchAndExtractPropertyData(
  address: string
): Promise<ExtractedData> {
  const apiKey = getLinkupApiKeyOptional()

  if (!apiKey || !isLinkupEnabled()) {
    console.log("[Property Valuation] Linkup not configured, skipping auto-search")
    return {
      property: { address },
      onlineEstimates: [],
      comparables: [],
      sources: [],
      searchesRun: 0,
      searchesFailed: 0,
    }
  }

  const client = new LinkupClient({ apiKey })

  // Define search queries
  const queries = [
    `${address} home value Zillow Zestimate Redfin estimate`,
    `${address} property tax assessment county records square feet bedrooms`,
    `homes sold near ${address} 2024 2023 recent sales`,
    `${address} property details bedrooms bathrooms year built lot size`,
  ]

  console.log(`[Property Valuation] Running ${queries.length} searches for: ${address}`)
  const startTime = Date.now()

  // Run searches in parallel with overall timeout
  const searchPromises = queries.map((query) => runLinkupSearch(client, query))

  const results = await Promise.race([
    Promise.all(searchPromises),
    new Promise<(SearchResult | null)[]>((resolve) =>
      setTimeout(() => resolve(queries.map(() => null)), TOTAL_TIMEOUT_MS)
    ),
  ])

  const validResults: SearchResult[] = results.filter(
    (r): r is SearchResult => r !== null
  )
  const duration = Date.now() - startTime

  console.log(`[Property Valuation] Searches completed in ${duration}ms:`, {
    total: queries.length,
    successful: validResults.length,
    failed: queries.length - validResults.length,
  })

  // Extract data from all results
  const combinedText = validResults.map((r) => r.answer).join("\n\n")
  const property = extractPropertyDetails(combinedText)
  property.address = address

  const onlineEstimates = extractOnlineEstimates(validResults)
  const comparables = extractComparableSales(validResults, address)
  const sources = collectSources(validResults)

  console.log("[Property Valuation] Extracted data:", {
    hasSquareFeet: !!property.squareFeet,
    onlineEstimatesCount: onlineEstimates.length,
    comparablesCount: comparables.length,
    sourcesCount: sources.length,
  })

  return {
    property,
    onlineEstimates,
    comparables,
    sources,
    searchesRun: queries.length,
    searchesFailed: queries.length - validResults.length,
  }
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Property Valuation Tool
 *
 * Self-contained tool that automatically fetches property data and calculates
 * home value using AVM (Automated Valuation Model).
 */
export const propertyValuationTool = tool({
  description:
    "Estimate property value using Automated Valuation Model (AVM). " +
    "AUTOMATICALLY searches Zillow, Redfin, county records, and recent sales - just provide the address. " +
    "Combines hedonic pricing, comparable sales, and online estimates to produce value with confidence score. " +
    "Returns: estimated value, value range, confidence level (high/medium/low), and model breakdown. " +
    "Optional: Pass additional data (sqft, beds, baths, manual estimates) to supplement auto-search results.",

  parameters: propertyValuationSchema,

  execute: async (params: PropertyValuationParams): Promise<AVMResult> => {
    console.log("[Property Valuation] Starting valuation for:", params.address)
    const startTime = Date.now()

    try {
      // Step 1: Auto-search for property data (unless skipped)
      let extractedData: ExtractedData = {
        property: { address: params.address },
        onlineEstimates: [],
        comparables: [],
        sources: [],
        searchesRun: 0,
        searchesFailed: 0,
      }

      if (!params.skipAutoSearch) {
        extractedData = await searchAndExtractPropertyData(params.address)
      }

      // Step 2: Merge with manually provided data (manual overrides auto)
      const property: Partial<PropertyCharacteristics> = {
        ...extractedData.property,
        address: params.address,
        squareFeet: params.squareFeet ?? extractedData.property.squareFeet,
        lotSizeSqFt: params.lotSizeSqFt ?? extractedData.property.lotSizeSqFt,
        bedrooms: params.bedrooms ?? extractedData.property.bedrooms,
        bathrooms: params.bathrooms ?? extractedData.property.bathrooms,
        yearBuilt: params.yearBuilt ?? extractedData.property.yearBuilt,
        garageSpaces: params.garageSpaces ?? extractedData.property.garageSpaces,
        hasPool: params.hasPool ?? extractedData.property.hasPool,
        hasBasement: params.hasBasement ?? extractedData.property.hasBasement,
        hasFireplace: params.hasFireplace ?? extractedData.property.hasFireplace,
      }

      // Merge online estimates (manual + auto, deduplicated by source)
      const manualEstimates: OnlineEstimate[] = (params.onlineEstimates || []).map((e) => ({
        source: e.source as EstimateSource,
        value: e.value,
        sourceUrl: e.sourceUrl || "",
      }))
      const manualSources = new Set(manualEstimates.map((e) => e.source))
      const onlineEstimates = [
        ...manualEstimates,
        ...extractedData.onlineEstimates.filter((e) => !manualSources.has(e.source)),
      ]

      // Merge comparable sales (manual + auto)
      const manualComps: ComparableSale[] = (params.comparableSales || []).map((c) => ({
        address: c.address,
        salePrice: c.salePrice,
        saleDate: c.saleDate,
        squareFeet: c.squareFeet,
        bedrooms: c.bedrooms,
        bathrooms: c.bathrooms,
        yearBuilt: c.yearBuilt,
        distanceMiles: c.distanceMiles,
        source: c.source || "manual",
        sourceUrl: c.sourceUrl || "",
      }))
      const comparables = [...manualComps, ...extractedData.comparables].slice(0, 15)

      // Merge sources
      const allSources = [...extractedData.sources]

      // Step 3: Validate we have enough data
      const hasPropertyData = property.squareFeet && property.squareFeet > 0
      const hasOnlineEstimates = onlineEstimates.length > 0
      const hasComparables = comparables.length > 0

      if (!hasPropertyData && !hasOnlineEstimates && !hasComparables) {
        console.log("[Property Valuation] Insufficient data after search")
        return {
          address: params.address,
          estimatedValue: 0,
          valueLow: 0,
          valueHigh: 0,
          confidenceScore: 0,
          confidenceLevel: "low",
          fsd: 1,
          hedonicWeight: 0,
          compWeight: 0,
          onlineWeight: 0,
          comparablesUsed: 0,
          estimateSources: [],
          rawContent: createInsufficientDataMessage(params.address, extractedData),
          sources: allSources,
          error: "Insufficient data found. Try providing square footage, online estimates, or comparable sales manually.",
        }
      }

      // Step 4: Calculate ensemble value
      const result = await Promise.race([
        calculateEnsembleValue({
          property,
          comparables,
          onlineEstimates,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`AVM calculation timed out after ${AVM_TIMEOUT_MS / 1000}s`)),
            AVM_TIMEOUT_MS
          )
        ),
      ])

      // Add sources from search to result
      const combinedSources = [...(result.sources || []), ...allSources]
      const uniqueSources = combinedSources.filter(
        (s, i, arr) => arr.findIndex((x) => x.url === s.url) === i
      )

      const duration = Date.now() - startTime
      console.log("[Property Valuation] Completed in", duration, "ms:", {
        address: params.address,
        value: result.estimatedValue,
        confidence: result.confidenceScore,
        level: result.confidenceLevel,
        searchesRun: extractedData.searchesRun,
        onlineEstimates: onlineEstimates.length,
        comparables: comparables.length,
      })

      return {
        ...result,
        sources: uniqueSources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      const duration = Date.now() - startTime

      console.error("[Property Valuation] Failed:", {
        address: params.address,
        error: errorMessage,
        durationMs: duration,
      })

      return {
        address: params.address,
        estimatedValue: 0,
        valueLow: 0,
        valueHigh: 0,
        confidenceScore: 0,
        confidenceLevel: "low",
        fsd: 1,
        hedonicWeight: 0,
        compWeight: 0,
        onlineWeight: 0,
        comparablesUsed: 0,
        estimateSources: [],
        rawContent: `# Property Valuation Error\n\n**Address:** ${params.address}\n\n**Error:** ${errorMessage}\n\nPlease try again or provide property data manually.`,
        sources: [],
        error: errorMessage,
      }
    }
  },
})

/**
 * Create message for insufficient data
 */
function createInsufficientDataMessage(
  address: string,
  extractedData: ExtractedData
): string {
  const searchInfo = extractedData.searchesRun > 0
    ? `\n\n**Search Status:** Ran ${extractedData.searchesRun} searches (${extractedData.searchesFailed} failed), but couldn't extract sufficient property data.`
    : "\n\n**Search Status:** Auto-search was skipped or Linkup is not configured."

  return `# Property Valuation: ${address}

**Error:** Insufficient data for valuation.${searchInfo}

## To Fix This

Provide at least one of the following manually:

1. **Square footage** - e.g., \`squareFeet: 2000\`
2. **Online estimates** - e.g., \`onlineEstimates: [{ source: "zillow", value: 485000 }]\`
3. **Comparable sales** - e.g., \`comparableSales: [{ address: "...", salePrice: 475000, saleDate: "2024-06-15" }]\`

## Example with Manual Data

\`\`\`json
{
  "address": "${address}",
  "squareFeet": 2000,
  "bedrooms": 4,
  "bathrooms": 2.5,
  "yearBuilt": 2005,
  "onlineEstimates": [
    { "source": "zillow", "value": 485000 },
    { "source": "redfin", "value": 492000 }
  ]
}
\`\`\`
`
}

// ============================================================================
// Enable Check
// ============================================================================

/**
 * Check if property valuation tool should be enabled
 * Always enabled - works with or without Linkup (manual data fallback)
 */
export function shouldEnablePropertyValuationTool(): boolean {
  return true
}
