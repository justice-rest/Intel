/**
 * Property Valuation Tool (Redfin API + County Assessor + Supabase Caching)
 *
 * Enterprise-grade AVM tool that fetches property data from authoritative sources:
 * 1. Redfin Internal API - Direct property data, estimates, tax records, comparables
 * 2. County Assessor Socrata APIs - Official government property records
 *
 * Key Features:
 * - Redfin API integration (FREE, no API key) for accurate property data
 * - County tax assessment data from official Socrata APIs
 * - Supabase cache (24h TTL) ensures consistent results across all instances
 * - Statistical aggregation (median, outlier filtering) for robust estimates
 * - Cross-validation between sources
 *
 * Workflow:
 * 1. Check Supabase cache for existing valuation (returns if found)
 * 2. Call Redfin API for direct property data + estimate + tax records
 * 3. Call County Assessor tool for official government records
 * 4. Merge data from all sources, prefer Redfin for structured data
 * 5. Calculate ensemble valuation with confidence score
 * 6. Cache result in Supabase and return
 */

import { tool } from "ai"
import { z } from "zod"
import { createServerClient } from "@supabase/ssr"
import { calculateEnsembleValue } from "@/lib/avm/ensemble"
import type {
  AVMResult,
  PropertyCharacteristics,
  ComparableSale,
  OnlineEstimate,
  EstimateSource,
} from "@/lib/avm/types"
import { AVM_TIMEOUT_MS } from "@/lib/avm/config"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { getRedfinClient } from "@/lib/redfin/client"
import { countyAssessorTool, shouldEnableCountyAssessorTool } from "./county-assessor"

// ============================================================================
// Constants
// ============================================================================

const SEARCH_TIMEOUT_MS = 45000 // 45 seconds per search
const TOTAL_TIMEOUT_MS = 90000 // 90 seconds total for all operations
const CACHE_TTL_HOURS = 24 // 24 hours cache TTL
const CACHE_TTL_MS = CACHE_TTL_HOURS * 60 * 60 * 1000
const MAX_MEMORY_CACHE_ENTRIES = 100 // Smaller in-memory fallback

// ============================================================================
// Supabase Client (Service Role for cache operations)
// ============================================================================

function getSupabaseServiceClient() {
  if (!isSupabaseEnabled || !process.env.SUPABASE_SERVICE_ROLE) {
    return null
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  )
}

// ============================================================================
// In-Memory Fallback Cache (when Supabase unavailable)
// ============================================================================

interface MemoryCacheEntry {
  result: AVMResult
  timestamp: number
  address: string
}

const memoryCache = new Map<string, MemoryCacheEntry>()

// ============================================================================
// Address Normalization
// ============================================================================

/**
 * Normalize address for cache key
 * Removes extra spaces, lowercases, removes punctuation except essential chars
 */
function normalizeAddressForCache(address: string): string {
  return address
    .toLowerCase()
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

// ============================================================================
// Supabase Cache Operations
// ============================================================================

/**
 * Get cached valuation from Supabase
 */
async function getSupabaseCachedValuation(address: string): Promise<AVMResult | null> {
  const supabase = getSupabaseServiceClient()
  if (!supabase) return null

  const key = normalizeAddressForCache(address)

  try {
    const { data, error } = await supabase
      .from("property_valuation_cache")
      .select("result, hit_count")
      .eq("address_key", key)
      .gt("expires_at", new Date().toISOString())
      .single()

    if (error || !data) {
      return null
    }

    // Increment hit count asynchronously (don't wait)
    void (async () => {
      try {
        await supabase
          .from("property_valuation_cache")
          .update({
            hit_count: (data.hit_count || 0) + 1,
            last_accessed_at: new Date().toISOString(),
          })
          .eq("address_key", key)
      } catch {
        // Ignore hit count update errors
      }
    })()

    console.log(`[Property Valuation] Supabase cache HIT for: ${address}`)
    return data.result as AVMResult
  } catch (error) {
    console.error("[Property Valuation] Supabase cache read error:", error)
    return null
  }
}

/**
 * Store valuation in Supabase cache
 */
async function setSupabaseCachedValuation(
  address: string,
  result: AVMResult,
  metadata: { searchesRun: number; searchesFailed: number }
): Promise<boolean> {
  const supabase = getSupabaseServiceClient()
  if (!supabase) return false

  const key = normalizeAddressForCache(address)
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString()

  try {
    const { error } = await supabase
      .from("property_valuation_cache")
      .upsert(
        {
          address_key: key,
          original_address: address,
          result: result,
          estimated_value: result.estimatedValue,
          value_low: result.valueLow,
          value_high: result.valueHigh,
          confidence_score: result.confidenceScore,
          confidence_level: result.confidenceLevel,
          hedonic_weight: result.hedonicWeight,
          comp_weight: result.compWeight,
          online_weight: result.onlineWeight,
          comparables_used: result.comparablesUsed,
          estimate_sources: result.estimateSources,
          expires_at: expiresAt,
          searches_run: metadata.searchesRun,
          searches_failed: metadata.searchesFailed,
          hit_count: 0,
          last_accessed_at: new Date().toISOString(),
        },
        {
          onConflict: "address_key",
        }
      )

    if (error) {
      console.error("[Property Valuation] Supabase cache write error:", error)
      return false
    }

    console.log(`[Property Valuation] Supabase cached result for: ${address}`)
    return true
  } catch (error) {
    console.error("[Property Valuation] Supabase cache write error:", error)
    return false
  }
}

// ============================================================================
// In-Memory Fallback Operations
// ============================================================================

/**
 * Get cached valuation from memory (fallback)
 */
function getMemoryCachedValuation(address: string): AVMResult | null {
  const key = normalizeAddressForCache(address)
  const entry = memoryCache.get(key)

  if (!entry) return null

  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    memoryCache.delete(key)
    return null
  }

  console.log(`[Property Valuation] Memory cache HIT for: ${address}`)
  return entry.result
}

/**
 * Store valuation in memory cache (fallback)
 */
function setMemoryCachedValuation(address: string, result: AVMResult): void {
  const key = normalizeAddressForCache(address)

  // Evict oldest entries if cache is full
  if (memoryCache.size >= MAX_MEMORY_CACHE_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value
    if (oldestKey) memoryCache.delete(oldestKey)
  }

  memoryCache.set(key, {
    result,
    timestamp: Date.now(),
    address,
  })
  console.log(`[Property Valuation] Memory cached result for: ${address}`)
}

// ============================================================================
// Unified Cache Operations
// ============================================================================

/**
 * Get cached valuation - tries Supabase first, falls back to memory
 */
async function getCachedValuation(address: string): Promise<AVMResult | null> {
  // Try Supabase first
  const supabaseResult = await getSupabaseCachedValuation(address)
  if (supabaseResult) return supabaseResult

  // Fall back to memory cache
  return getMemoryCachedValuation(address)
}

/**
 * Store valuation in cache - writes to both Supabase and memory
 */
async function setCachedValuation(
  address: string,
  result: AVMResult,
  metadata: { searchesRun: number; searchesFailed: number }
): Promise<void> {
  // Always store in memory as immediate fallback
  setMemoryCachedValuation(address, result)

  // Try to store in Supabase (async, don't block)
  await setSupabaseCachedValuation(address, result, metadata)
}

// ============================================================================
// Schemas
// ============================================================================

const onlineEstimateSchema = z.object({
  source: z
    .enum(["zillow", "redfin", "realtor", "county", "other"])
    .describe("Source of the estimate"),
  value: z.number().positive().describe("Estimated value in dollars"),
  sourceUrl: z.string().optional().default("").describe("URL to the source"),
})

const comparableSaleSchema = z.object({
  address: z.string().describe("Address of the comparable property"),
  salePrice: z.number().positive().describe("Sale price in dollars"),
  saleDate: z.string().describe("Sale date in YYYY-MM-DD format"),
  squareFeet: z.number().positive().optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  yearBuilt: z.number().optional(),
  distanceMiles: z.number().optional(),
  source: z.string().optional().default("web search"),
  sourceUrl: z.string().optional().default(""),
})

const propertyValuationSchema = z.object({
  address: z
    .string()
    .describe(
      "Full property address including city, state, and ZIP (e.g., '123 Main St, Austin, TX 78701'). " +
        "The tool will automatically search for property data, Zillow/Redfin estimates, and comparable sales."
    ),
  skipAutoSearch: z
    .boolean()
    .optional()
    .default(false)
    .describe("Set to true to skip automatic web search and use only provided data"),
  skipCache: z
    .boolean()
    .optional()
    .default(false)
    .describe("Set to true to bypass cache and force fresh search"),
  squareFeet: z.number().positive().optional().describe("Living area in square feet"),
  lotSizeSqFt: z.number().positive().optional().describe("Lot size in square feet"),
  bedrooms: z.number().optional().describe("Number of bedrooms"),
  bathrooms: z.number().optional().describe("Number of bathrooms"),
  yearBuilt: z.number().optional().describe("Year built"),
  garageSpaces: z.number().optional(),
  hasPool: z.boolean().optional(),
  hasBasement: z.boolean().optional(),
  hasFireplace: z.boolean().optional(),
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
// Data Types
// ============================================================================

interface ExtractedData {
  property: Partial<PropertyCharacteristics>
  onlineEstimates: OnlineEstimate[]
  comparables: ComparableSale[]
  sources: Array<{ name: string; url: string }>
  ownerName?: string // Property owner from county assessor
  searchesRun: number
  searchesFailed: number
  extractionConfidence: number // 0-1 scale
}

// ============================================================================
// Statistical Utilities
// ============================================================================

/**
 * Calculate median of an array of numbers
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/**
 * Filter outliers using IQR method
 * Removes values outside 1.5 * IQR from Q1/Q3
 */
function filterOutliers(values: number[]): number[] {
  if (values.length < 4) return values

  const sorted = [...values].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)]
  const q3 = sorted[Math.floor(sorted.length * 0.75)]
  const iqr = q3 - q1
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr

  return values.filter((v) => v >= lowerBound && v <= upperBound)
}

/**
 * Calculate coefficient of variation (standard deviation / mean)
 * Lower = more consistent, Higher = more variable
 */
function calculateCV(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  return mean > 0 ? stdDev / mean : 0
}

// ============================================================================
// Context-Aware Data Extraction
// ============================================================================

/**
 * Extract dollar amounts with context (what's mentioned nearby)
 * Returns amounts found within ~100 chars of a keyword
 */
function extractAmountsNearKeyword(
  text: string,
  keywords: string[],
  windowSize: number = 150
): number[] {
  const amounts: number[] = []
  const lowerText = text.toLowerCase()

  for (const keyword of keywords) {
    let searchStart = 0
    let keywordIndex: number

    while ((keywordIndex = lowerText.indexOf(keyword, searchStart)) !== -1) {
      // Extract text window around keyword
      const windowStart = Math.max(0, keywordIndex - windowSize)
      const windowEnd = Math.min(text.length, keywordIndex + keyword.length + windowSize)
      const window = text.substring(windowStart, windowEnd)

      // Find dollar amounts in this window
      const patterns = [
        /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:million|M)/gi,
        /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:thousand|K)/gi,
        /\$\s*([\d,]+(?:\.\d{2})?)/g,
      ]

      for (const pattern of patterns) {
        let match
        while ((match = pattern.exec(window)) !== null) {
          let value = parseFloat(match[1].replace(/,/g, ""))

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

      searchStart = keywordIndex + 1
    }
  }

  return [...new Set(amounts)] // Deduplicate
}

/**
 * Extract property characteristics from text
 */
function extractPropertyDetails(text: string): Partial<PropertyCharacteristics> {
  const details: Partial<PropertyCharacteristics> = {}

  // Square footage - collect all and use median for consistency
  const sqftMatches: number[] = []
  const sqftPatterns = [
    /(\d{1,2},?\d{3})\s*(?:sq\.?\s*ft\.?|square feet|sqft)/gi,
    /(?:living (?:area|space)|home size)[:\s]+(\d{1,2},?\d{3})/gi,
  ]
  for (const pattern of sqftPatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const value = parseInt(match[1].replace(/,/g, ""), 10)
      if (value >= 200 && value <= 50000) {
        sqftMatches.push(value)
      }
    }
  }
  if (sqftMatches.length > 0) {
    details.squareFeet = Math.round(calculateMedian(sqftMatches))
  }

  // Bedrooms - collect all and use mode (most common)
  const bedsMatches: number[] = []
  const bedsPattern = /(\d+)\s*(?:bed(?:room)?s?|BR|bd)/gi
  let bedsMatch
  while ((bedsMatch = bedsPattern.exec(text)) !== null) {
    const value = parseInt(bedsMatch[1], 10)
    if (value >= 1 && value <= 20) {
      bedsMatches.push(value)
    }
  }
  if (bedsMatches.length > 0) {
    // Use mode (most frequent) for bedrooms
    const counts = new Map<number, number>()
    bedsMatches.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1))
    let maxCount = 0
    let mode = bedsMatches[0]
    counts.forEach((count, value) => {
      if (count > maxCount) {
        maxCount = count
        mode = value
      }
    })
    details.bedrooms = mode
  }

  // Bathrooms - collect all and use mode
  const bathsMatches: number[] = []
  const bathsPattern = /(\d+(?:\.\d)?)\s*(?:bath(?:room)?s?|BA|ba)/gi
  let bathsMatch
  while ((bathsMatch = bathsPattern.exec(text)) !== null) {
    const value = parseFloat(bathsMatch[1])
    if (value >= 1 && value <= 20) {
      bathsMatches.push(value)
    }
  }
  if (bathsMatches.length > 0) {
    const counts = new Map<number, number>()
    bathsMatches.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1))
    let maxCount = 0
    let mode = bathsMatches[0]
    counts.forEach((count, value) => {
      if (count > maxCount) {
        maxCount = count
        mode = value
      }
    })
    details.bathrooms = mode
  }

  // Year built - collect all and use median
  const yearMatches: number[] = []
  const yearPattern =
    /(?:built (?:in )?|year built[:\s]+|constructed (?:in )?)(19\d{2}|20[012]\d)/gi
  let yearMatch
  while ((yearMatch = yearPattern.exec(text)) !== null) {
    yearMatches.push(parseInt(yearMatch[1], 10))
  }
  if (yearMatches.length > 0) {
    details.yearBuilt = Math.round(calculateMedian(yearMatches))
  }

  // Lot size - collect all and use median
  const lotMatches: number[] = []
  const lotPattern =
    /(?:lot size|lot)[:\s]+(\d{1,2},?\d{3})\s*(?:sq\.?\s*ft\.?|sqft)/gi
  let lotMatch
  while ((lotMatch = lotPattern.exec(text)) !== null) {
    const value = parseInt(lotMatch[1].replace(/,/g, ""), 10)
    if (value >= 500 && value <= 500000) {
      lotMatches.push(value)
    }
  }
  if (lotMatches.length > 0) {
    details.lotSizeSqFt = Math.round(calculateMedian(lotMatches))
  }

  // Features - require multiple mentions for confidence
  const poolMentions = (text.match(/\bpool\b/gi) || []).length
  const noPoolMentions = (text.match(/no pool/gi) || []).length
  if (poolMentions > noPoolMentions && poolMentions >= 1) {
    details.hasPool = true
  }

  const basementMentions = (text.match(/\bbasement\b/gi) || []).length
  const noBasementMentions = (text.match(/no basement/gi) || []).length
  if (basementMentions > noBasementMentions && basementMentions >= 1) {
    details.hasBasement = true
  }

  const fireplaceMentions = (text.match(/\bfireplace\b/gi) || []).length
  const noFireplaceMentions = (text.match(/no fireplace/gi) || []).length
  if (fireplaceMentions > noFireplaceMentions && fireplaceMentions >= 1) {
    details.hasFireplace = true
  }

  const garageMatch = text.match(/(\d+)\s*(?:car )?garage/i)
  if (garageMatch) {
    details.garageSpaces = parseInt(garageMatch[1], 10)
  }

  return details
}

// NOTE: extractOnlineEstimates, extractComparableSales, and collectSources functions
// were removed as they were used for parsing Linkup search results (no longer available).
// Property valuation now relies on Redfin API + County Assessor tool.

// ============================================================================
// Main Search and Extract Function
// ============================================================================

/**
 * Parse address into components for targeted searches
 */
function parseAddressComponents(address: string): {
  street: string
  city: string
  state: string
  zip: string
  county: string
} {
  // Extract ZIP code
  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/)
  const zip = zipMatch ? zipMatch[1] : ""

  // Extract state (2-letter code)
  const stateMatch = address.match(/\b([A-Z]{2})\b(?:\s+\d{5})?/i)
  const state = stateMatch ? stateMatch[1].toUpperCase() : ""

  // Extract city (typically before state)
  const cityMatch = address.match(/,\s*([^,]+),\s*[A-Z]{2}/i)
  const city = cityMatch ? cityMatch[1].trim() : ""

  // Street is everything before the first comma
  const streetMatch = address.match(/^([^,]+)/)
  const street = streetMatch ? streetMatch[1].trim() : address

  // County will be extracted from search results
  return { street, city, state, zip, county: "" }
}

/**
 * Fetch property data from County Assessor via Socrata APIs
 * Returns OFFICIAL government data - highest confidence level
 */
async function fetchCountyAssessorData(address: string): Promise<{
  property: Partial<PropertyCharacteristics>
  onlineEstimates: OnlineEstimate[]
  sources: Array<{ name: string; url: string }>
  ownerName?: string
  success: boolean
}> {
  const emptyResult = {
    property: { address },
    onlineEstimates: [],
    sources: [],
    ownerName: undefined,
    success: false,
  }

  if (!shouldEnableCountyAssessorTool()) {
    return emptyResult
  }

  try {
    console.log("[Property Valuation] Fetching from County Assessor API (Socrata)...")

    // Parse address to get state and city for county assessor lookup
    const stateMatch = address.match(/\b([A-Z]{2})\b(?:\s+\d{5})?/i)
    const state = stateMatch ? stateMatch[1].toUpperCase() : undefined

    // Extract city from address
    const cityMatch = address.match(/,\s*([^,]+),\s*[A-Z]{2}/i)
    const city = cityMatch ? cityMatch[1].trim() : undefined

    // Call the county assessor tool directly
    // The AI SDK tool.execute requires options with toolCallId and messages
    const assessorResult = await countyAssessorTool.execute(
      {
        address,
        state,
        city,
        limit: 5,
      },
      {
        toolCallId: `property-valuation-${Date.now()}`,
        messages: [],
        abortSignal: AbortSignal.timeout(30000),
      }
    )

    if (!assessorResult || assessorResult.properties.length === 0) {
      console.log("[Property Valuation] County Assessor returned no data")
      return emptyResult
    }

    // Use the first property (best match)
    const propertyData = assessorResult.properties[0]

    // Build property characteristics from county data
    const property: Partial<PropertyCharacteristics> = {
      address: propertyData.address || address,
      city: propertyData.city,
      state: propertyData.state,
      zipCode: propertyData.zip,
      yearBuilt: propertyData.yearBuilt,
      bedrooms: propertyData.bedrooms,
      bathrooms: propertyData.bathrooms,
      squareFeet: propertyData.sqft,
    }

    // Build online estimates from county assessor data (VERIFIED - HIGH confidence)
    const onlineEstimates: OnlineEstimate[] = []

    // Get source URL from sources array
    const sourceUrl = assessorResult.sources?.[0]?.url || ""
    const sourceName = assessorResult.sources?.[0]?.name || assessorResult.county

    // Market value is preferred over assessed value for actual market comparisons
    if (propertyData.marketValue && propertyData.marketValue > 0) {
      onlineEstimates.push({
        source: "county" as EstimateSource,
        value: propertyData.marketValue,
        sourceUrl,
      })
      console.log(
        `[Property Valuation] County Market Value: $${propertyData.marketValue.toLocaleString()} [VERIFIED - ${sourceName}]`
      )
    } else if (propertyData.assessedValue && propertyData.assessedValue > 0) {
      // Fall back to assessed value
      onlineEstimates.push({
        source: "county" as EstimateSource,
        value: propertyData.assessedValue,
        sourceUrl,
      })
      console.log(
        `[Property Valuation] County Assessed Value: $${propertyData.assessedValue.toLocaleString()} [VERIFIED - ${sourceName}]`
      )
    }

    // Build sources from the assessor result
    const sources: Array<{ name: string; url: string }> = (assessorResult.sources || []).map(s => ({
      name: `${s.name} (Official)`,
      url: s.url,
    }))

    // Extract owner name from county assessor data
    const ownerName = propertyData.ownerName || undefined

    return {
      property,
      onlineEstimates,
      sources,
      ownerName,
      success: onlineEstimates.length > 0,
    }
  } catch (error) {
    console.error("[Property Valuation] County Assessor API error:", error)
    return emptyResult
  }
}

/**
 * Fetch property data from Redfin's internal API
 * Returns structured data including estimate, tax records, and comparables
 */
async function fetchRedfinData(address: string): Promise<{
  property: Partial<PropertyCharacteristics>
  onlineEstimates: OnlineEstimate[]
  comparables: ComparableSale[]
  sources: Array<{ name: string; url: string }>
  success: boolean
}> {
  const emptyResult = {
    property: { address },
    onlineEstimates: [],
    comparables: [],
    sources: [],
    success: false,
  }

  try {
    console.log("[Property Valuation] Fetching from Redfin API...")
    const redfin = getRedfinClient()
    const redfinData = await redfin.getPropertyData(address)

    if (!redfinData) {
      console.log("[Property Valuation] Redfin returned no data")
      return emptyResult
    }

    // Build property characteristics from Redfin data
    const property: Partial<PropertyCharacteristics> = {
      address: redfinData.address,
      city: redfinData.city,
      state: redfinData.state,
      zipCode: redfinData.zip,
      squareFeet: redfinData.sqft,
      lotSizeSqFt: redfinData.lotSize,
      bedrooms: redfinData.beds,
      bathrooms: redfinData.baths,
      yearBuilt: redfinData.yearBuilt,
    }

    // Build online estimates from Redfin
    const onlineEstimates: OnlineEstimate[] = []

    // Redfin estimate (their AVM)
    if (redfinData.redfinEstimate && redfinData.redfinEstimate > 0) {
      onlineEstimates.push({
        source: "redfin" as EstimateSource,
        value: redfinData.redfinEstimate,
        sourceUrl: redfinData.sourceUrl || "",
      })
      console.log(
        `[Property Valuation] Redfin Estimate: $${redfinData.redfinEstimate.toLocaleString()}`
      )
    }

    // County tax assessment (GOVERNMENT DATA!)
    if (redfinData.assessedValue && redfinData.assessedValue > 0) {
      onlineEstimates.push({
        source: "county" as EstimateSource,
        value: redfinData.assessedValue,
        sourceUrl: "",
      })
      console.log(
        `[Property Valuation] County Assessed Value: $${redfinData.assessedValue.toLocaleString()} (${redfinData.countyName || "Unknown County"}, Tax Year: ${redfinData.taxYear || "N/A"})`
      )
    }

    // Market value from county (if different from assessed)
    if (
      redfinData.marketValue &&
      redfinData.marketValue > 0 &&
      redfinData.marketValue !== redfinData.assessedValue
    ) {
      console.log(
        `[Property Valuation] County Market Value: $${redfinData.marketValue.toLocaleString()}`
      )
      // Use market value instead if available (usually more accurate)
      const countyIdx = onlineEstimates.findIndex((e) => e.source === "county")
      if (countyIdx >= 0) {
        onlineEstimates[countyIdx].value = redfinData.marketValue
      }
    }

    // Build comparables from Redfin
    const comparables: ComparableSale[] = (redfinData.comparables || [])
      .filter((comp) => comp.price && comp.price > 0)
      .map((comp) => ({
        address: comp.address || "Unknown",
        salePrice: comp.price!,
        saleDate: comp.soldDate?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
        squareFeet: comp.sqft,
        bedrooms: comp.beds,
        bathrooms: comp.baths,
        yearBuilt: comp.yearBuilt,
        distanceMiles: comp.distance,
        source: "redfin",
        sourceUrl: "",
      }))

    console.log(`[Property Valuation] Redfin comparables: ${comparables.length}`)

    // Build sources
    const sources: Array<{ name: string; url: string }> = []
    if (redfinData.sourceUrl) {
      sources.push({
        name: `Redfin: ${redfinData.address}`,
        url: redfinData.sourceUrl,
      })
    }

    return {
      property,
      onlineEstimates,
      comparables,
      sources,
      success: true,
    }
  } catch (error) {
    console.error("[Property Valuation] Redfin API error:", error)
    return emptyResult
  }
}

async function searchAndExtractPropertyData(address: string): Promise<ExtractedData> {
  const startTime = Date.now()

  // === STEP 0: Try County Assessor Socrata API first (OFFICIAL GOVERNMENT DATA) ===
  // This is the highest confidence source - direct from county APIs
  const countyAssessorResult = await fetchCountyAssessorData(address)

  // === STEP 1: Fetch from Redfin API (FREE, structured data) ===
  const redfinResult = await fetchRedfinData(address)

  // === STEP 2: Merge data from both sources ===
  // Priority: County Assessor (official) > Redfin

  const property: Partial<PropertyCharacteristics> = {
    address,
    // Prefer County Assessor > Redfin for property data
    squareFeet: countyAssessorResult.property.squareFeet || redfinResult.property.squareFeet,
    lotSizeSqFt: redfinResult.property.lotSizeSqFt,
    bedrooms: countyAssessorResult.property.bedrooms ?? redfinResult.property.bedrooms,
    bathrooms: countyAssessorResult.property.bathrooms ?? redfinResult.property.bathrooms,
    yearBuilt: countyAssessorResult.property.yearBuilt || redfinResult.property.yearBuilt,
    city: countyAssessorResult.property.city || redfinResult.property.city,
    state: countyAssessorResult.property.state || redfinResult.property.state,
    zipCode: countyAssessorResult.property.zipCode || redfinResult.property.zipCode,
  }

  // Merge online estimates (deduplicate by source)
  // Priority: County Assessor (HIGHEST - official government data) > Redfin
  const seenSources = new Set<string>()
  const onlineEstimates: OnlineEstimate[] = []

  // Add County Assessor estimates FIRST (HIGHEST priority - official government data)
  for (const est of countyAssessorResult.onlineEstimates) {
    if (!seenSources.has(est.source)) {
      seenSources.add(est.source)
      onlineEstimates.push(est)
      console.log(`[Property Valuation] Using County Assessor value: $${est.value.toLocaleString()} [VERIFIED - OFFICIAL]`)
    }
  }

  // Add Redfin estimates (second priority)
  for (const est of redfinResult.onlineEstimates) {
    if (!seenSources.has(est.source)) {
      seenSources.add(est.source)
      onlineEstimates.push(est)
    }
  }

  // Get comparables from Redfin (max 15)
  const comparables = redfinResult.comparables.slice(0, 15)

  // Merge sources (County Assessor first for visibility)
  const sources = [
    ...countyAssessorResult.sources,
    ...redfinResult.sources,
  ]

  const duration = Date.now() - startTime

  // Calculate extraction confidence
  // County Assessor data is HIGHEST confidence (official government)
  let extractionConfidence = 0.3 // Base
  if (countyAssessorResult.success) extractionConfidence += 0.35 // County Assessor is official government data
  if (redfinResult.success) extractionConfidence += 0.2 // Redfin data is structured
  if (onlineEstimates.length >= 2) extractionConfidence += 0.1
  if (property.squareFeet) extractionConfidence += 0.05

  // Reduce confidence if estimates vary wildly
  if (onlineEstimates.length >= 2) {
    const values = onlineEstimates.map((e) => e.value)
    const cv = calculateCV(values)
    if (cv > 0.3) extractionConfidence -= 0.1
  }

  extractionConfidence = Math.max(0.1, Math.min(1.0, extractionConfidence))

  console.log(`[Property Valuation] Data extraction completed in ${duration}ms:`, {
    countyAssessorSuccess: countyAssessorResult.success,
    redfinSuccess: redfinResult.success,
    sqft: property.squareFeet,
    estimates: onlineEstimates.map((e) => `${e.source}: $${e.value.toLocaleString()}`),
    comparables: comparables.length,
    confidence: extractionConfidence.toFixed(2),
  })

  return {
    property,
    onlineEstimates,
    comparables,
    sources,
    ownerName: countyAssessorResult.ownerName,
    searchesRun: (redfinResult.success ? 1 : 0) + (countyAssessorResult.success ? 1 : 0),
    searchesFailed: (redfinResult.success ? 0 : 1) + (countyAssessorResult.success ? 0 : 1),
    extractionConfidence,
  }
}

// ============================================================================
// Tool Definition
// ============================================================================

export const propertyValuationTool = tool({
  description:
    "Estimate property value using Automated Valuation Model (AVM). " +
    "AUTOMATICALLY searches Zillow, Redfin, county records, and recent sales - just provide the address. " +
    "Results are CACHED for 24 hours for consistency. " +
    "Combines hedonic pricing, comparable sales, and online estimates to produce value with confidence score. " +
    "Returns: estimated value, value range, confidence level (high/medium/low), and model breakdown. " +
    "Optional: Pass additional data (sqft, beds, baths, manual estimates) to supplement auto-search results.",

  parameters: propertyValuationSchema,

  execute: async (params: PropertyValuationParams): Promise<AVMResult> => {
    console.log("[Property Valuation] Starting valuation for:", params.address)
    const startTime = Date.now()

    // Check cache first (unless skipCache is true)
    if (!params.skipCache) {
      const cached = await getCachedValuation(params.address)
      if (cached) {
        return cached
      }
    }

    try {
      // Step 1: Auto-search for property data (unless skipped)
      let extractedData: ExtractedData = {
        property: { address: params.address },
        onlineEstimates: [],
        comparables: [],
        sources: [],
        searchesRun: 0,
        searchesFailed: 0,
        extractionConfidence: 0,
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
      const manualEstimates: OnlineEstimate[] = (params.onlineEstimates || []).map(
        (e) => ({
          source: e.source as EstimateSource,
          value: e.value,
          sourceUrl: e.sourceUrl || "",
        })
      )
      const manualSources = new Set(manualEstimates.map((e) => e.source))
      const onlineEstimates = [
        ...manualEstimates,
        ...extractedData.onlineEstimates.filter((e) => !manualSources.has(e.source)),
      ]

      // Merge comparable sales (manual + auto)
      const manualComps: ComparableSale[] = (params.comparableSales || []).map(
        (c) => ({
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
        })
      )
      const comparables = [...manualComps, ...extractedData.comparables].slice(0, 15)

      const allSources = [...extractedData.sources]

      // Step 3: Validate we have enough data
      const hasPropertyData = property.squareFeet && property.squareFeet > 0
      const hasOnlineEstimates = onlineEstimates.length > 0
      const hasComparables = comparables.length > 0

      if (!hasPropertyData && !hasOnlineEstimates && !hasComparables) {
        console.log("[Property Valuation] Insufficient data after search")
        const errorResult: AVMResult = {
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
          error:
            "Insufficient data found. Try providing square footage, online estimates, or comparable sales manually.",
        }
        return errorResult
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
            () =>
              reject(
                new Error(`AVM calculation timed out after ${AVM_TIMEOUT_MS / 1000}s`)
              ),
            AVM_TIMEOUT_MS
          )
        ),
      ])

      // Add sources from search to result
      const combinedSources = [...(result.sources || []), ...allSources]
      const uniqueSources = combinedSources.filter(
        (s, i, arr) => arr.findIndex((x) => x.url === s.url) === i
      )

      const finalResult: AVMResult = {
        ...result,
        ownerName: extractedData.ownerName,
        sources: uniqueSources,
      }

      const duration = Date.now() - startTime
      console.log("[Property Valuation] Completed in", duration, "ms:", {
        address: params.address,
        value: finalResult.estimatedValue,
        confidence: finalResult.confidenceScore,
        level: finalResult.confidenceLevel,
        searchesRun: extractedData.searchesRun,
        onlineEstimates: onlineEstimates.length,
        comparables: comparables.length,
      })

      // Cache the result for consistency
      if (!params.skipCache && finalResult.estimatedValue > 0) {
        await setCachedValuation(params.address, finalResult, {
          searchesRun: extractedData.searchesRun,
          searchesFailed: extractedData.searchesFailed,
        })
      }

      return finalResult
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
  const searchInfo =
    extractedData.searchesRun > 0
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
// Enable Check & Cache Management
// ============================================================================

/**
 * Check if property valuation tool should be enabled
 */
export function shouldEnablePropertyValuationTool(): boolean {
  return true
}

/**
 * Clear the valuation cache (memory only - Supabase has auto-expiry)
 */
export function clearMemoryCache(): void {
  memoryCache.clear()
  console.log("[Property Valuation] Memory cache cleared")
}

/**
 * Clear specific address from Supabase cache
 */
export async function clearCachedValuation(address: string): Promise<boolean> {
  const supabase = getSupabaseServiceClient()
  if (!supabase) {
    // Clear from memory only
    const key = normalizeAddressForCache(address)
    memoryCache.delete(key)
    return true
  }

  const key = normalizeAddressForCache(address)

  try {
    const { error } = await supabase
      .from("property_valuation_cache")
      .delete()
      .eq("address_key", key)

    if (error) {
      console.error("[Property Valuation] Failed to clear cache:", error)
      return false
    }

    // Also clear from memory
    memoryCache.delete(key)
    console.log(`[Property Valuation] Cleared cache for: ${address}`)
    return true
  } catch (error) {
    console.error("[Property Valuation] Failed to clear cache:", error)
    return false
  }
}

/**
 * Get cache statistics
 */
export async function getValuationCacheStats(): Promise<{
  memorySize: number
  memoryMaxSize: number
  supabaseSize: number | null
  ttlHours: number
  supabaseEnabled: boolean
}> {
  const supabase = getSupabaseServiceClient()
  let supabaseSize: number | null = null

  if (supabase) {
    try {
      const { count, error } = await supabase
        .from("property_valuation_cache")
        .select("*", { count: "exact", head: true })
        .gt("expires_at", new Date().toISOString())

      if (!error && count !== null) {
        supabaseSize = count
      }
    } catch {
      // Ignore errors
    }
  }

  return {
    memorySize: memoryCache.size,
    memoryMaxSize: MAX_MEMORY_CACHE_ENTRIES,
    supabaseSize,
    ttlHours: CACHE_TTL_HOURS,
    supabaseEnabled: !!supabase,
  }
}
