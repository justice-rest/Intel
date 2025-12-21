/**
 * Prospect Data Collector
 *
 * Orchestrates parallel data collection from all prospect research tools.
 * Ensures consistent data through caching and source tracking.
 *
 * Key Features:
 * - Parallel tool execution for speed
 * - Automatic caching for consistency
 * - Source tracking for every data point
 * - Graceful failure handling
 */

import {
  getCachedProspectData,
  setCachedProspectData,
  createProspectCacheKey,
  type ProspectDataCache,
  type ProspectIdentifier,
  type CachedDataSource,
} from "@/lib/prospect-data-cache"
import { createSourceTracker, type SourceTracker } from "./source-tracker"

// ============================================================================
// TYPES
// ============================================================================

export interface ProspectInput extends ProspectIdentifier {
  spouseName?: string
  organizationName?: string
  userId?: string
}

export interface CollectionResult {
  data: ProspectDataCache
  sourceTracker: SourceTracker
  fromCache: boolean
  collectionDurationMs: number
  toolsRun: number
  toolsSucceeded: number
  toolsFailed: number
}

interface ToolResult {
  name: string
  success: boolean
  data: unknown
  error?: string
  durationMs: number
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Run a tool with timeout and error handling
 */
async function runToolWithTimeout<T>(
  toolName: string,
  toolFn: () => Promise<T>,
  timeoutMs: number = 60000
): Promise<ToolResult> {
  const startTime = Date.now()

  try {
    const result = await Promise.race([
      toolFn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${toolName} timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ])

    return {
      name: toolName,
      success: true,
      data: result,
      durationMs: Date.now() - startTime,
    }
  } catch (error) {
    return {
      name: toolName,
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    }
  }
}

/**
 * Generate Linkup search queries for a prospect
 */
function generateLinkupQueries(prospect: ProspectInput): string[] {
  const queries: string[] = []
  const name = prospect.name

  // Core biographical info
  queries.push(`"${name}" biography career education net worth`)

  // Business and professional
  queries.push(`"${name}" CEO founder company business owner`)

  // Philanthropy
  queries.push(`"${name}" foundation philanthropy charitable giving donations`)

  // Board positions
  queries.push(`"${name}" board director nonprofit trustee`)

  // Real estate if address provided
  if (prospect.address) {
    queries.push(`"${name}" property real estate "${prospect.address}"`)
  }

  // Family if spouse known
  if (prospect.spouseName) {
    queries.push(`"${name}" "${prospect.spouseName}" married family`)
  }

  return queries
}

/**
 * Create cached data source wrapper
 */
function createCachedSource<T>(data: T, ttlMs: number): CachedDataSource<T> {
  const now = new Date()
  return {
    result: data,
    cachedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  }
}

// ============================================================================
// MAIN COLLECTOR FUNCTION
// ============================================================================

/**
 * Collect all prospect data from tools
 *
 * This is a simplified version that prepares the data structure.
 * The actual tool calls are made by the AI during conversation.
 *
 * @param prospect - Prospect identification info
 * @param forceRefresh - If true, skip cache and collect fresh data
 * @returns Collection result with data and source tracking
 */
export async function collectProspectData(
  prospect: ProspectInput,
  forceRefresh: boolean = false
): Promise<CollectionResult> {
  const startTime = Date.now()
  const sourceTracker = createSourceTracker()

  // Generate cache key
  const cacheKey = createProspectCacheKey(prospect)

  // Check cache first (unless forcing refresh)
  if (!forceRefresh) {
    const cached = await getCachedProspectData(prospect)
    if (cached) {
      console.log(`[Data Collector] Cache hit for ${prospect.name}`)
      return {
        data: cached,
        sourceTracker,
        fromCache: true,
        collectionDurationMs: Date.now() - startTime,
        toolsRun: 0,
        toolsSucceeded: 0,
        toolsFailed: 0,
      }
    }
  }

  console.log(`[Data Collector] Initializing data structure for ${prospect.name}`)

  // Initialize result data structure
  // Note: Actual tool calls are made by the AI during conversation
  // This just prepares the cache structure
  const resultData: ProspectDataCache = {
    cacheKey,
    prospect: {
      name: prospect.name,
      address: prospect.address,
      city: prospect.city,
      state: prospect.state,
    },
    dataQuality: "limited",
    sourcesUsed: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: prospect.userId,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }

  // Cache the initialized structure
  await setCachedProspectData(prospect, resultData)

  return {
    data: resultData,
    sourceTracker,
    fromCache: false,
    collectionDurationMs: Date.now() - startTime,
    toolsRun: 0,
    toolsSucceeded: 0,
    toolsFailed: 0,
  }
}

/**
 * Update cached prospect data with new tool result
 */
export async function updateProspectToolResult(
  prospect: ProspectIdentifier,
  toolName: string,
  result: unknown,
  ttlMs: number
): Promise<boolean> {
  const cached = await getCachedProspectData(prospect)
  if (!cached) {
    console.warn(`[Data Collector] No cache found for prospect`)
    return false
  }

  // Map tool name to cache field
  const fieldMap: Record<string, keyof ProspectDataCache> = {
    secInsider: "secInsider",
    sec_insider_search: "secInsider",
    fec: "fecContributions",
    fec_contributions: "fecContributions",
    propublica: "propublica990",
    propublica_nonprofit_search: "propublica990",
    property: "propertyValuation",
    property_valuation: "propertyValuation",
    countyAssessor: "countyAssessor",
    county_assessor: "countyAssessor",
    businessRegistry: "businessRegistry",
    business_registry_scraper: "businessRegistry",
    voter: "voterRegistration",
    voter_registration: "voterRegistration",
    family: "familyDiscovery",
    family_discovery: "familyDiscovery",
    wikidata: "wikidata",
    wikidata_search: "wikidata",
    wikidata_entity: "wikidata",
    linkup: "linkupSearches",
    searchWeb: "linkupSearches",
    revenueEstimate: "revenueEstimate",
    business_revenue_estimate: "revenueEstimate",
  }

  const field = fieldMap[toolName]
  if (!field) {
    console.warn(`[Data Collector] Unknown tool: ${toolName}`)
    return false
  }

  // Update the cached data
  const updatedData = {
    ...cached,
    [field]: createCachedSource(result, ttlMs),
    updatedAt: new Date().toISOString(),
  }

  // Recalculate data quality
  const verifiedSources = [
    updatedData.secInsider,
    updatedData.fecContributions,
    updatedData.countyAssessor,
    updatedData.propublica990,
  ].filter(Boolean).length

  if (verifiedSources >= 3) {
    updatedData.dataQuality = "complete"
  } else if (verifiedSources >= 1) {
    updatedData.dataQuality = "partial"
  } else {
    updatedData.dataQuality = "limited"
  }

  await setCachedProspectData(prospect, updatedData)
  return true
}

/**
 * Check if cached data is stale
 */
export function isCacheStale(data: ProspectDataCache): boolean {
  const now = Date.now()
  const updatedAt = new Date(data.updatedAt).getTime()
  const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days

  return now - updatedAt > maxAge
}

/**
 * Get a summary of what data is available for a prospect
 */
export function getDataSummary(data: ProspectDataCache): {
  hasSecData: boolean
  hasFecData: boolean
  hasPropertyData: boolean
  hasBusinessData: boolean
  hasWikidataData: boolean
  hasFamilyData: boolean
  totalSources: number
  dataQuality: string
} {
  return {
    hasSecData: data.secInsider !== undefined,
    hasFecData: data.fecContributions !== undefined,
    hasPropertyData: data.propertyValuation !== undefined || data.countyAssessor !== undefined,
    hasBusinessData: data.businessRegistry !== undefined,
    hasWikidataData: data.wikidata !== undefined,
    hasFamilyData: data.familyDiscovery !== undefined,
    totalSources: data.sourcesUsed?.length || 0,
    dataQuality: data.dataQuality,
  }
}

/**
 * Get list of Linkup queries to run for a prospect
 */
export function getProspectLinkupQueries(prospect: ProspectInput): string[] {
  return generateLinkupQueries(prospect)
}
