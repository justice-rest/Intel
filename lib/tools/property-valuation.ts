/**
 * Property Valuation Tool
 *
 * AI-callable tool for estimating residential property values using
 * an Automated Valuation Model (AVM). Combines hedonic pricing,
 * comparable sales analysis, and online estimates.
 *
 * Usage Workflow:
 * 1. AI runs searchWeb queries to gather property data
 * 2. AI extracts property characteristics and estimates from results
 * 3. AI calls this tool with gathered data
 * 4. Tool returns valuation with confidence score
 *
 * Example:
 * property_valuation({
 *   address: "123 Main St, Austin, TX 78701",
 *   squareFeet: 2000,
 *   bedrooms: 4,
 *   bathrooms: 2.5,
 *   yearBuilt: 2005,
 *   onlineEstimates: [
 *     { source: "zillow", value: 485000 },
 *     { source: "redfin", value: 492000 }
 *   ],
 *   comparableSales: [
 *     { address: "125 Main St", salePrice: 475000, saleDate: "2024-06-15", ... }
 *   ]
 * })
 */

import { tool } from "ai"
import { z } from "zod"
import { calculateEnsembleValue } from "@/lib/avm/ensemble"
import type {
  AVMResult,
  PropertyCharacteristics,
  ComparableSale,
  OnlineEstimate,
  EstimateSource,
} from "@/lib/avm/types"
import { AVM_TIMEOUT_MS } from "@/lib/avm/config"

// ============================================================================
// Schemas
// ============================================================================

/**
 * Schema for online estimate input
 */
const onlineEstimateSchema = z.object({
  source: z
    .enum(["zillow", "redfin", "realtor", "county", "other"])
    .describe("Source of the estimate (zillow, redfin, realtor, county, other)"),
  value: z
    .number()
    .positive()
    .describe("Estimated value in dollars (e.g., 485000)"),
  sourceUrl: z
    .string()
    .optional()
    .default("")
    .describe("URL to the source of this estimate"),
})

/**
 * Schema for comparable sale input
 */
const comparableSaleSchema = z.object({
  address: z.string().describe("Address of the comparable property"),
  salePrice: z
    .number()
    .positive()
    .describe("Sale price in dollars (e.g., 475000)"),
  saleDate: z
    .string()
    .describe("Sale date in YYYY-MM-DD format (e.g., 2024-06-15)"),
  squareFeet: z
    .number()
    .positive()
    .optional()
    .describe("Living area square footage"),
  bedrooms: z.number().optional().describe("Number of bedrooms"),
  bathrooms: z
    .number()
    .optional()
    .describe("Number of bathrooms (use 0.5 for half baths, e.g., 2.5)"),
  yearBuilt: z.number().optional().describe("Year the property was built"),
  distanceMiles: z
    .number()
    .optional()
    .describe("Distance from subject property in miles"),
  source: z
    .string()
    .optional()
    .default("web search")
    .describe("Data source (e.g., 'Zillow', 'MLS', 'county records')"),
  sourceUrl: z
    .string()
    .optional()
    .default("")
    .describe("URL to the source of this comparable"),
})

/**
 * Schema for property valuation tool parameters
 */
const propertyValuationSchema = z.object({
  address: z
    .string()
    .describe(
      "Full property address including city, state, and ZIP code (e.g., '123 Main St, Austin, TX 78701')"
    ),

  // Property characteristics (optional - can be gathered from search)
  city: z.string().optional().describe("City name"),
  state: z
    .string()
    .optional()
    .describe("Two-letter state code (e.g., 'TX', 'CA')"),
  zipCode: z.string().optional().describe("5-digit ZIP code"),

  squareFeet: z
    .number()
    .positive()
    .optional()
    .describe("Living area in square feet (e.g., 2000)"),
  lotSizeSqFt: z
    .number()
    .positive()
    .optional()
    .describe("Lot size in square feet (e.g., 8500)"),
  bedrooms: z.number().optional().describe("Number of bedrooms"),
  bathrooms: z
    .number()
    .optional()
    .describe("Number of bathrooms (use 0.5 for half baths, e.g., 2.5)"),
  yearBuilt: z.number().optional().describe("Year the property was built"),
  garageSpaces: z.number().optional().describe("Number of garage spaces"),
  hasPool: z.boolean().optional().describe("Whether the property has a pool"),
  hasBasement: z
    .boolean()
    .optional()
    .describe("Whether the property has a basement"),
  hasFireplace: z
    .boolean()
    .optional()
    .describe("Whether the property has a fireplace"),

  // Online estimates (from search results)
  onlineEstimates: z
    .array(onlineEstimateSchema)
    .optional()
    .default([])
    .describe(
      "Online value estimates from Zillow, Redfin, county assessor, etc."
    ),

  // Comparable sales (from search results)
  comparableSales: z
    .array(comparableSaleSchema)
    .optional()
    .default([])
    .describe("Recent comparable sales in the area (ideally 3-10 comps)"),
})

export type PropertyValuationParams = z.infer<typeof propertyValuationSchema>

// ============================================================================
// Helpers
// ============================================================================

/**
 * Timeout wrapper for async operations
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

/**
 * Convert tool input to internal types
 */
function convertInputToInternal(params: PropertyValuationParams): {
  property: Partial<PropertyCharacteristics>
  comparables: ComparableSale[]
  onlineEstimates: OnlineEstimate[]
} {
  // Build property characteristics
  const property: Partial<PropertyCharacteristics> = {
    address: params.address,
    city: params.city,
    state: params.state,
    zipCode: params.zipCode,
    squareFeet: params.squareFeet,
    lotSizeSqFt: params.lotSizeSqFt,
    bedrooms: params.bedrooms,
    bathrooms: params.bathrooms,
    yearBuilt: params.yearBuilt,
    garageSpaces: params.garageSpaces,
    hasPool: params.hasPool,
    hasBasement: params.hasBasement,
    hasFireplace: params.hasFireplace,
  }

  // Convert online estimates
  const onlineEstimates: OnlineEstimate[] = (params.onlineEstimates || []).map(
    (e) => ({
      source: e.source as EstimateSource,
      value: e.value,
      sourceUrl: e.sourceUrl || "",
    })
  )

  // Convert comparable sales
  const comparables: ComparableSale[] = (params.comparableSales || []).map(
    (c) => ({
      address: c.address,
      salePrice: c.salePrice,
      saleDate: c.saleDate,
      squareFeet: c.squareFeet,
      bedrooms: c.bedrooms,
      bathrooms: c.bathrooms,
      yearBuilt: c.yearBuilt,
      distanceMiles: c.distanceMiles,
      source: c.source || "web search",
      sourceUrl: c.sourceUrl || "",
    })
  )

  return { property, comparables, onlineEstimates }
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Property Valuation Tool
 *
 * Calculate property value using Automated Valuation Model (AVM).
 * Combines hedonic pricing, comparable sales adjustments, and online estimates.
 */
export const propertyValuationTool = tool({
  description:
    "Calculate property value using Automated Valuation Model (AVM). " +
    "Combines hedonic pricing model, comparable sales adjustments, and online estimates (Zillow, Redfin) " +
    "to produce a value estimate with confidence score. " +
    "IMPORTANT: Gather data first using searchWeb queries for the property address, " +
    "then pass the extracted data to this tool. " +
    "Minimum required: square footage OR online estimates OR comparable sales. " +
    "For best results, provide multiple data sources. " +
    "Returns estimated value, confidence level (high/medium/low), value range, and model breakdown.",

  parameters: propertyValuationSchema,

  execute: async (params: PropertyValuationParams): Promise<AVMResult> => {
    console.log("[Property Valuation] Starting valuation for:", params.address)
    const startTime = Date.now()

    try {
      // Convert input to internal types
      const { property, comparables, onlineEstimates } =
        convertInputToInternal(params)

      // Validate we have enough data
      const hasPropertyData = property.squareFeet && property.squareFeet > 0
      const hasOnlineEstimates = onlineEstimates.length > 0
      const hasComparables = comparables.length > 0

      if (!hasPropertyData && !hasOnlineEstimates && !hasComparables) {
        console.log("[Property Valuation] Insufficient data")
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
          rawContent: createInsufficientDataMessage(params.address),
          sources: [],
          error:
            "Insufficient data. Provide property square footage, online estimates, or comparable sales.",
        }
      }

      // Calculate ensemble value with timeout
      const result = await withTimeout(
        calculateEnsembleValue({
          property,
          comparables,
          onlineEstimates,
        }),
        AVM_TIMEOUT_MS,
        `Property valuation timed out after ${AVM_TIMEOUT_MS / 1000} seconds`
      )

      const duration = Date.now() - startTime
      console.log("[Property Valuation] Completed in", duration, "ms:", {
        address: params.address,
        value: result.estimatedValue,
        confidence: result.confidenceScore,
        level: result.confidenceLevel,
        hedonicValue: result.hedonicValue,
        compValue: result.compAdjustedValue,
        onlineAvg: result.onlineEstimateAvg,
        compsUsed: result.comparablesUsed,
      })

      return result
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      const duration = Date.now() - startTime
      const isTimeout = errorMessage.includes("timed out")

      console.error("[Property Valuation] Failed:", {
        address: params.address,
        error: errorMessage,
        durationMs: duration,
        isTimeout,
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
        rawContent: `# Property Valuation Error\n\n**Address:** ${params.address}\n\n**Error:** ${errorMessage}\n\nPlease try again with different data or verify the property information.`,
        sources: [],
        error: errorMessage,
      }
    }
  },
})

/**
 * Create message for insufficient data
 */
function createInsufficientDataMessage(address: string): string {
  return `# Property Valuation: ${address}

**Error:** Insufficient data for valuation.

## Required Data (at least one)
- **Property square footage** - Required for hedonic pricing model
- **Online estimates** - From Zillow, Redfin, or county assessor
- **Comparable sales** - Recent sales near the subject property

## How to Gather Data
Run the following searchWeb queries before calling this tool:

1. \`"${address} home value Zillow Redfin"\`
   - Extract: Zillow Zestimate, Redfin Estimate

2. \`"${address} property tax assessment county"\`
   - Extract: County assessed value, square footage, year built

3. \`"homes sold near ${address} 2024"\`
   - Extract: Recent comparable sales (address, price, date, sqft)

4. \`"${address} bedrooms bathrooms square feet"\`
   - Extract: Property characteristics

## Example Usage
\`\`\`
property_valuation({
  address: "${address}",
  squareFeet: 2000,
  bedrooms: 4,
  bathrooms: 2.5,
  yearBuilt: 2005,
  onlineEstimates: [
    { source: "zillow", value: 485000 },
    { source: "redfin", value: 492000 }
  ],
  comparableSales: [
    {
      address: "nearby address",
      salePrice: 475000,
      saleDate: "2024-06-15",
      squareFeet: 1900,
      bedrooms: 4,
      bathrooms: 2
    }
  ]
})
\`\`\`
`
}

// ============================================================================
// Enable Check
// ============================================================================

/**
 * Check if property valuation tool should be enabled
 * Uses existing search infrastructure, so always enabled
 */
export function shouldEnablePropertyValuationTool(): boolean {
  return true // Uses existing search tools and mathematical calculations
}
