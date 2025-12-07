/**
 * RomyScore Cache
 * Stores calculated scores for consistency across searches
 *
 * Uses Supabase for persistent storage with in-memory fallback
 */

import { createClient } from "@supabase/supabase-js"
import {
  RomyScoreDataPoints,
  RomyScoreBreakdown,
  calculateRomyScore,
  mergeDataPoints,
  createScoreCacheKey,
} from "./calculator"
import { ROMY_SCORE_CACHE_TTL } from "./config"

// ============================================================================
// TYPES
// ============================================================================

interface CachedScore {
  cacheKey: string
  personName: string
  dataPoints: RomyScoreDataPoints
  score: number
  tier: string
  capacity: string
  breakdown: RomyScoreBreakdown
  createdAt: string
  updatedAt: string
  expiresAt: string
}

// In-memory cache as fallback
const memoryCache = new Map<string, CachedScore>()

// ============================================================================
// SUPABASE HELPER
// ============================================================================

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE

  if (!supabaseUrl || !supabaseServiceKey) {
    return null
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Get cached score for a person
 */
export async function getCachedScore(
  name: string,
  city?: string,
  state?: string
): Promise<CachedScore | null> {
  const cacheKey = createScoreCacheKey(name, city, state)

  // Try Supabase first
  const supabase = getSupabaseClient()
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("romy_score_cache")
        .select("*")
        .eq("cache_key", cacheKey)
        .single()

      if (data && !error) {
        // Check if expired
        const expiresAt = new Date(data.expires_at)
        if (expiresAt > new Date()) {
          return {
            cacheKey: data.cache_key,
            personName: data.person_name,
            dataPoints: data.data_points as RomyScoreDataPoints,
            score: data.score,
            tier: data.tier,
            capacity: data.capacity,
            breakdown: data.breakdown as RomyScoreBreakdown,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            expiresAt: data.expires_at,
          }
        }
      }
    } catch (error) {
      console.error("[RomyScore Cache] Supabase fetch error:", error)
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
 * Save score to cache
 */
export async function setCachedScore(
  name: string,
  city: string | undefined,
  state: string | undefined,
  dataPoints: RomyScoreDataPoints,
  breakdown: RomyScoreBreakdown
): Promise<void> {
  const cacheKey = createScoreCacheKey(name, city, state)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ROMY_SCORE_CACHE_TTL)

  const cached: CachedScore = {
    cacheKey,
    personName: name,
    dataPoints,
    score: breakdown.totalScore,
    tier: breakdown.tier.name,
    capacity: breakdown.tier.capacity,
    breakdown,
    createdAt: now.toISOString(),
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
        .from("romy_score_cache")
        .upsert({
          cache_key: cacheKey,
          person_name: name,
          data_points: dataPoints,
          score: breakdown.totalScore,
          tier: breakdown.tier.name,
          capacity: breakdown.tier.capacity,
          breakdown: breakdown,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        }, {
          onConflict: "cache_key",
        })
    } catch (error) {
      console.error("[RomyScore Cache] Supabase save error:", error)
    }
  }
}

/**
 * Update existing cached score with new data
 * Merges data points and recalculates score
 */
export async function updateCachedScore(
  name: string,
  city: string | undefined,
  state: string | undefined,
  newDataPoints: Partial<RomyScoreDataPoints>
): Promise<RomyScoreBreakdown> {
  // Get existing cached data
  const existing = await getCachedScore(name, city, state)

  // Merge data points
  const mergedDataPoints = existing
    ? mergeDataPoints(existing.dataPoints, newDataPoints)
    : (newDataPoints as RomyScoreDataPoints)

  // Recalculate score
  const breakdown = calculateRomyScore(mergedDataPoints)

  // Save to cache
  await setCachedScore(name, city, state, mergedDataPoints, breakdown)

  return breakdown
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Get or calculate RomyScore for a person
 *
 * If cached score exists and is not expired, returns cached score.
 * If new data is provided, merges with existing data and recalculates.
 *
 * @param name - Person's name
 * @param city - City (optional, for disambiguation)
 * @param state - State (optional, for disambiguation)
 * @param newData - New data points to add (optional)
 * @returns RomyScoreBreakdown with detailed scoring info
 */
export async function getRomyScore(
  name: string,
  city?: string,
  state?: string,
  newData?: Partial<RomyScoreDataPoints>
): Promise<RomyScoreBreakdown> {
  // If new data provided, update/merge
  if (newData && Object.keys(newData).length > 0) {
    return updateCachedScore(name, city, state, newData)
  }

  // Try to get cached score
  const cached = await getCachedScore(name, city, state)
  if (cached) {
    console.log(`[RomyScore] Cache hit for "${name}" - Score: ${cached.score}/41`)
    return cached.breakdown
  }

  // No cache and no new data - return empty score
  console.log(`[RomyScore] No cached data for "${name}" - returning empty score`)
  const emptyBreakdown = calculateRomyScore({})
  return emptyBreakdown
}

/**
 * Clear cache for a specific person
 */
export async function clearCachedScore(
  name: string,
  city?: string,
  state?: string
): Promise<void> {
  const cacheKey = createScoreCacheKey(name, city, state)

  // Clear from memory
  memoryCache.delete(cacheKey)

  // Clear from Supabase
  const supabase = getSupabaseClient()
  if (supabase) {
    try {
      await supabase
        .from("romy_score_cache")
        .delete()
        .eq("cache_key", cacheKey)
    } catch (error) {
      console.error("[RomyScore Cache] Supabase delete error:", error)
    }
  }
}

/**
 * Check if Supabase cache is available
 */
export function isSupabaseCacheAvailable(): boolean {
  return !!getSupabaseClient()
}
