/**
 * Prospect Data Cache
 *
 * Caches all tool results for prospect research consistency.
 * Ensures same prospect searched twice produces identical core data.
 *
 * Uses Supabase for persistent storage with in-memory fallback.
 */

import { createClient } from "@supabase/supabase-js"
import { createHash } from "crypto"

// ============================================================================
// TYPES
// ============================================================================

export interface SourceReference {
  name: string
  url: string
  confidence: "high" | "medium" | "low"
  retrievedAt?: string
}

export interface CachedDataSource<T = unknown> {
  result: T
  cachedAt: string
  expiresAt: string
  sources?: SourceReference[]
}

export interface ProspectIdentifier {
  name: string
  address?: string
  city?: string
  state?: string
}

export interface ProspectDataCache {
  id?: string
  cacheKey: string
  prospect: ProspectIdentifier

  // Cached tool results
  secInsider?: CachedDataSource
  fecContributions?: CachedDataSource
  propublica990?: CachedDataSource
  propertyValuation?: CachedDataSource
  countyAssessor?: CachedDataSource
  businessRegistry?: CachedDataSource
  voterRegistration?: CachedDataSource
  familyDiscovery?: CachedDataSource
  wikidata?: CachedDataSource
  linkupSearches?: CachedDataSource<unknown[]>
  revenueEstimate?: CachedDataSource

  // Computed data
  romyScore?: number
  romyScoreBreakdown?: unknown
  netWorthLow?: number
  netWorthHigh?: number
  netWorthMethodology?: string
  givingCapacityLow?: number
  givingCapacityHigh?: number
  dataQuality: "complete" | "partial" | "limited"

  // All sources used
  sourcesUsed: SourceReference[]

  // Metadata
  createdAt: string
  updatedAt: string
  createdBy?: string
  expiresAt: string
}

// Cache TTLs in milliseconds
export const CACHE_TTL = {
  // Official records - 30 days
  secInsider: 30 * 24 * 60 * 60 * 1000,
  fecContributions: 30 * 24 * 60 * 60 * 1000,
  propublica990: 30 * 24 * 60 * 60 * 1000,
  countyAssessor: 30 * 24 * 60 * 60 * 1000,

  // Business registrations - 14 days
  businessRegistry: 14 * 24 * 60 * 60 * 1000,

  // Property valuations - 7 days
  propertyValuation: 7 * 24 * 60 * 60 * 1000,

  // Voter data - 14 days
  voterRegistration: 14 * 24 * 60 * 60 * 1000,

  // Biographical data - 14 days
  wikidata: 14 * 24 * 60 * 60 * 1000,
  familyDiscovery: 14 * 24 * 60 * 60 * 1000,

  // Web search - 24 hours
  linkupSearches: 24 * 60 * 60 * 1000,

  // Revenue estimates - 7 days
  revenueEstimate: 7 * 24 * 60 * 60 * 1000,

  // Full cache - 30 days
  fullCache: 30 * 24 * 60 * 60 * 1000,
} as const

type CacheSourceKey = keyof typeof CACHE_TTL

// In-memory cache as fallback
const memoryCache = new Map<string, ProspectDataCache>()

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a consistent cache key from prospect identifier
 */
export function createProspectCacheKey(prospect: ProspectIdentifier): string {
  const normalized = [
    prospect.name.toLowerCase().trim(),
    prospect.address?.toLowerCase().trim() || "",
    prospect.city?.toLowerCase().trim() || "",
    prospect.state?.toUpperCase().trim() || "",
  ].join("|")

  return createHash("sha256").update(normalized).digest("hex").slice(0, 32)
}

/**
 * Check if a specific data source is expired
 */
export function isSourceExpired(
  cachedAt: string | undefined,
  sourceType: CacheSourceKey
): boolean {
  if (!cachedAt) return true

  const ttl = CACHE_TTL[sourceType] || CACHE_TTL.fullCache
  const expiresAt = new Date(cachedAt).getTime() + ttl

  return Date.now() > expiresAt
}

/**
 * Get Supabase client
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE

  if (!supabaseUrl || !supabaseServiceKey) {
    return null
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

/**
 * Determine data quality based on verified sources
 */
function calculateDataQuality(cache: Partial<ProspectDataCache>): "complete" | "partial" | "limited" {
  const verifiedSources = [
    cache.secInsider,
    cache.fecContributions,
    cache.propublica990,
    cache.countyAssessor,
    cache.businessRegistry,
    cache.voterRegistration,
  ].filter(Boolean).length

  if (verifiedSources >= 3) return "complete"
  if (verifiedSources >= 1) return "partial"
  return "limited"
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Get cached prospect data
 */
export async function getCachedProspectData(
  prospect: ProspectIdentifier
): Promise<ProspectDataCache | null> {
  const cacheKey = createProspectCacheKey(prospect)

  // Try Supabase first
  const supabase = getSupabaseClient()
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("prospect_data_cache")
        .select("*")
        .eq("cache_key", cacheKey)
        .single()

      if (data && !error) {
        // Check if full cache is expired
        const expiresAt = new Date(data.expires_at)
        if (expiresAt > new Date()) {
          return mapDatabaseToCache(data)
        }
      }
    } catch (error) {
      console.error("[ProspectDataCache] Supabase fetch error:", error)
    }
  }

  // Fall back to memory cache
  const memCached = memoryCache.get(cacheKey)
  if (memCached) {
    const expiresAt = new Date(memCached.expiresAt)
    if (expiresAt > new Date()) {
      return memCached
    } else {
      memoryCache.delete(cacheKey)
    }
  }

  return null
}

/**
 * Save prospect data to cache
 */
export async function setCachedProspectData(
  prospect: ProspectIdentifier,
  data: Partial<ProspectDataCache>
): Promise<void> {
  const cacheKey = createProspectCacheKey(prospect)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + CACHE_TTL.fullCache)

  const cached: ProspectDataCache = {
    cacheKey,
    prospect,
    ...data,
    dataQuality: calculateDataQuality(data),
    sourcesUsed: data.sourcesUsed || [],
    createdAt: data.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }

  // Save to memory cache
  memoryCache.set(cacheKey, cached)

  // Try to save to Supabase
  const supabase = getSupabaseClient()
  if (supabase) {
    try {
      await supabase
        .from("prospect_data_cache")
        .upsert(mapCacheToDatabase(cached), {
          onConflict: "cache_key",
        })
    } catch (error) {
      console.error("[ProspectDataCache] Supabase save error:", error)
    }
  }
}

/**
 * Update a specific data source in the cache
 */
export async function updateCachedSource<K extends keyof ProspectDataCache>(
  prospect: ProspectIdentifier,
  sourceKey: K,
  data: ProspectDataCache[K],
  sources?: SourceReference[]
): Promise<void> {
  const existing = await getCachedProspectData(prospect)
  const now = new Date()

  const updatedCache: Partial<ProspectDataCache> = {
    ...existing,
    [sourceKey]: {
      result: data,
      cachedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + CACHE_TTL[sourceKey as CacheSourceKey] || CACHE_TTL.fullCache).toISOString(),
      sources,
    },
  }

  // Merge sources
  if (sources) {
    const existingSources = existing?.sourcesUsed || []
    const newSources = sources.filter(
      (s) => !existingSources.some((es) => es.url === s.url)
    )
    updatedCache.sourcesUsed = [...existingSources, ...newSources]
  }

  await setCachedProspectData(prospect, updatedCache)
}

/**
 * Get specific source data if not expired
 */
export async function getCachedSource<K extends keyof ProspectDataCache>(
  prospect: ProspectIdentifier,
  sourceKey: K
): Promise<ProspectDataCache[K] | null> {
  const cached = await getCachedProspectData(prospect)
  if (!cached) return null

  const sourceData = cached[sourceKey] as CachedDataSource | undefined
  if (!sourceData?.cachedAt) return null

  // Check if this specific source is expired
  if (isSourceExpired(sourceData.cachedAt, sourceKey as CacheSourceKey)) {
    return null
  }

  return sourceData.result as ProspectDataCache[K]
}

/**
 * Clear cache for a specific prospect
 */
export async function clearProspectCache(
  prospect: ProspectIdentifier
): Promise<void> {
  const cacheKey = createProspectCacheKey(prospect)

  // Clear from memory
  memoryCache.delete(cacheKey)

  // Clear from Supabase
  const supabase = getSupabaseClient()
  if (supabase) {
    try {
      await supabase
        .from("prospect_data_cache")
        .delete()
        .eq("cache_key", cacheKey)
    } catch (error) {
      console.error("[ProspectDataCache] Supabase delete error:", error)
    }
  }
}

/**
 * Get or create cache entry for a prospect
 */
export async function getOrCreateProspectCache(
  prospect: ProspectIdentifier
): Promise<ProspectDataCache> {
  const existing = await getCachedProspectData(prospect)
  if (existing) return existing

  const cacheKey = createProspectCacheKey(prospect)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + CACHE_TTL.fullCache)

  const newCache: ProspectDataCache = {
    cacheKey,
    prospect,
    dataQuality: "limited",
    sourcesUsed: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }

  await setCachedProspectData(prospect, newCache)
  return newCache
}

// ============================================================================
// DATABASE MAPPERS
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapDatabaseToCache(data: any): ProspectDataCache {
  return {
    id: data.id,
    cacheKey: data.cache_key,
    prospect: {
      name: data.prospect_name,
      address: data.prospect_address,
      city: data.prospect_city,
      state: data.prospect_state,
    },
    secInsider: data.sec_insider_data ? {
      result: data.sec_insider_data,
      cachedAt: data.sec_cached_at,
      expiresAt: new Date(new Date(data.sec_cached_at).getTime() + CACHE_TTL.secInsider).toISOString(),
    } : undefined,
    fecContributions: data.fec_data ? {
      result: data.fec_data,
      cachedAt: data.fec_cached_at,
      expiresAt: new Date(new Date(data.fec_cached_at).getTime() + CACHE_TTL.fecContributions).toISOString(),
    } : undefined,
    propublica990: data.propublica_data ? {
      result: data.propublica_data,
      cachedAt: data.propublica_cached_at,
      expiresAt: new Date(new Date(data.propublica_cached_at).getTime() + CACHE_TTL.propublica990).toISOString(),
    } : undefined,
    propertyValuation: data.property_data ? {
      result: data.property_data,
      cachedAt: data.property_cached_at,
      expiresAt: new Date(new Date(data.property_cached_at).getTime() + CACHE_TTL.propertyValuation).toISOString(),
    } : undefined,
    countyAssessor: data.county_assessor_data ? {
      result: data.county_assessor_data,
      cachedAt: data.county_assessor_cached_at,
      expiresAt: new Date(new Date(data.county_assessor_cached_at).getTime() + CACHE_TTL.countyAssessor).toISOString(),
    } : undefined,
    businessRegistry: data.business_registry_data ? {
      result: data.business_registry_data,
      cachedAt: data.business_registry_cached_at,
      expiresAt: new Date(new Date(data.business_registry_cached_at).getTime() + CACHE_TTL.businessRegistry).toISOString(),
    } : undefined,
    voterRegistration: data.voter_data ? {
      result: data.voter_data,
      cachedAt: data.voter_cached_at,
      expiresAt: new Date(new Date(data.voter_cached_at).getTime() + CACHE_TTL.voterRegistration).toISOString(),
    } : undefined,
    familyDiscovery: data.family_data ? {
      result: data.family_data,
      cachedAt: data.family_cached_at,
      expiresAt: new Date(new Date(data.family_cached_at).getTime() + CACHE_TTL.familyDiscovery).toISOString(),
    } : undefined,
    wikidata: data.wikidata_data ? {
      result: data.wikidata_data,
      cachedAt: data.wikidata_cached_at,
      expiresAt: new Date(new Date(data.wikidata_cached_at).getTime() + CACHE_TTL.wikidata).toISOString(),
    } : undefined,
    linkupSearches: data.linkup_data ? {
      result: data.linkup_data,
      cachedAt: data.linkup_cached_at,
      expiresAt: new Date(new Date(data.linkup_cached_at).getTime() + CACHE_TTL.linkupSearches).toISOString(),
    } : undefined,
    revenueEstimate: data.revenue_estimate_data ? {
      result: data.revenue_estimate_data,
      cachedAt: data.revenue_estimate_cached_at,
      expiresAt: new Date(new Date(data.revenue_estimate_cached_at).getTime() + CACHE_TTL.revenueEstimate).toISOString(),
    } : undefined,
    romyScore: data.romy_score,
    romyScoreBreakdown: data.romy_score_breakdown,
    netWorthLow: data.net_worth_low,
    netWorthHigh: data.net_worth_high,
    netWorthMethodology: data.net_worth_methodology,
    givingCapacityLow: data.giving_capacity_low,
    givingCapacityHigh: data.giving_capacity_high,
    dataQuality: data.data_quality || "limited",
    sourcesUsed: data.sources_used || [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    createdBy: data.created_by,
    expiresAt: data.expires_at,
  }
}

function mapCacheToDatabase(cache: ProspectDataCache): any {
  const now = new Date().toISOString()

  return {
    cache_key: cache.cacheKey,
    prospect_name: cache.prospect.name,
    prospect_address: cache.prospect.address,
    prospect_city: cache.prospect.city,
    prospect_state: cache.prospect.state,

    sec_insider_data: (cache.secInsider as CachedDataSource)?.result,
    sec_cached_at: (cache.secInsider as CachedDataSource)?.cachedAt,

    fec_data: (cache.fecContributions as CachedDataSource)?.result,
    fec_cached_at: (cache.fecContributions as CachedDataSource)?.cachedAt,

    propublica_data: (cache.propublica990 as CachedDataSource)?.result,
    propublica_cached_at: (cache.propublica990 as CachedDataSource)?.cachedAt,

    property_data: (cache.propertyValuation as CachedDataSource)?.result,
    property_cached_at: (cache.propertyValuation as CachedDataSource)?.cachedAt,

    county_assessor_data: (cache.countyAssessor as CachedDataSource)?.result,
    county_assessor_cached_at: (cache.countyAssessor as CachedDataSource)?.cachedAt,

    business_registry_data: (cache.businessRegistry as CachedDataSource)?.result,
    business_registry_cached_at: (cache.businessRegistry as CachedDataSource)?.cachedAt,

    voter_data: (cache.voterRegistration as CachedDataSource)?.result,
    voter_cached_at: (cache.voterRegistration as CachedDataSource)?.cachedAt,

    family_data: (cache.familyDiscovery as CachedDataSource)?.result,
    family_cached_at: (cache.familyDiscovery as CachedDataSource)?.cachedAt,

    wikidata_data: (cache.wikidata as CachedDataSource)?.result,
    wikidata_cached_at: (cache.wikidata as CachedDataSource)?.cachedAt,

    linkup_data: (cache.linkupSearches as CachedDataSource)?.result,
    linkup_cached_at: (cache.linkupSearches as CachedDataSource)?.cachedAt,

    revenue_estimate_data: (cache.revenueEstimate as CachedDataSource)?.result,
    revenue_estimate_cached_at: (cache.revenueEstimate as CachedDataSource)?.cachedAt,

    romy_score: cache.romyScore,
    romy_score_breakdown: cache.romyScoreBreakdown,
    net_worth_low: cache.netWorthLow,
    net_worth_high: cache.netWorthHigh,
    net_worth_methodology: cache.netWorthMethodology,
    giving_capacity_low: cache.givingCapacityLow,
    giving_capacity_high: cache.givingCapacityHigh,
    data_quality: cache.dataQuality,
    sources_used: cache.sourcesUsed,

    created_at: cache.createdAt || now,
    updated_at: now,
    created_by: cache.createdBy,
    expires_at: cache.expiresAt,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if Supabase cache is available
 */
export function isSupabaseCacheAvailable(): boolean {
  return !!getSupabaseClient()
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  memoryEntries: number
  supabaseAvailable: boolean
} {
  return {
    memoryEntries: memoryCache.size,
    supabaseAvailable: isSupabaseCacheAvailable(),
  }
}
