/**
 * Location Data Integration for AVM
 *
 * Provides location-based factors that significantly impact property values:
 * - School ratings (GreatSchools API)
 * - Walk Score / Transit Score / Bike Score
 * - Geocoding (address to coordinates)
 *
 * These factors can add 5-20% to property values in premium locations.
 */

import { withCircuitBreakerAndFallback } from "./circuit-breaker"
import { createLogger } from "./logger"

const logger = createLogger("location-data")

// ============================================================================
// Types
// ============================================================================

export interface GeoCoordinates {
  latitude: number
  longitude: number
  accuracy?: "rooftop" | "street" | "city" | "approximate"
}

export interface SchoolRating {
  name: string
  rating: number // 1-10 scale
  type: "elementary" | "middle" | "high" | "private"
  distance: number // miles
  gradeRange: string
  enrollment?: number
}

export interface SchoolData {
  schools: SchoolRating[]
  averageRating: number // Weighted average
  elementaryRating: number | null
  middleRating: number | null
  highRating: number | null
  schoolCount: number
  source: string
}

export interface WalkabilityScores {
  walkScore: number // 0-100
  transitScore: number | null // 0-100
  bikeScore: number | null // 0-100
  walkScoreDescription: string
  transitScoreDescription?: string
  bikeScoreDescription?: string
  source: string
}

export interface LocationFactors {
  coordinates?: GeoCoordinates
  schools?: SchoolData
  walkability?: WalkabilityScores
  fetchedAt: string
  confidence: "high" | "medium" | "low"
}

// ============================================================================
// Configuration
// ============================================================================

const REQUEST_TIMEOUT_MS = 10000
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days (location data changes slowly)

// In-memory cache
interface LocationCache {
  data: LocationFactors
  timestamp: number
}
const locationCache = new Map<string, LocationCache>()

// Walk Score descriptions
const WALK_SCORE_DESCRIPTIONS: Record<string, string> = {
  "90-100": "Walker's Paradise - Daily errands do not require a car",
  "70-89": "Very Walkable - Most errands can be accomplished on foot",
  "50-69": "Somewhat Walkable - Some errands can be accomplished on foot",
  "25-49": "Car-Dependent - Most errands require a car",
  "0-24": "Almost All Errands Require a Car",
}

function getWalkScoreDescription(score: number): string {
  if (score >= 90) return WALK_SCORE_DESCRIPTIONS["90-100"]
  if (score >= 70) return WALK_SCORE_DESCRIPTIONS["70-89"]
  if (score >= 50) return WALK_SCORE_DESCRIPTIONS["50-69"]
  if (score >= 25) return WALK_SCORE_DESCRIPTIONS["25-49"]
  return WALK_SCORE_DESCRIPTIONS["0-24"]
}

// ============================================================================
// Geocoding
// ============================================================================

/**
 * Geocode an address using Nominatim (OpenStreetMap)
 * FREE, no API key required
 */
async function geocodeAddress(address: string): Promise<GeoCoordinates | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.append("q", address)
  url.searchParams.append("format", "json")
  url.searchParams.append("limit", "1")
  url.searchParams.append("addressdetails", "1")

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "PropertyValuationApp/1.0",
        Accept: "application/json",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      logger.warn("Geocoding failed", { status: response.status })
      return null
    }

    const data = await response.json()

    if (!data || data.length === 0) {
      logger.debug("No geocoding results found", { address })
      return null
    }

    const result = data[0]
    const accuracy: GeoCoordinates["accuracy"] =
      result.class === "building"
        ? "rooftop"
        : result.class === "highway"
          ? "street"
          : result.type === "city"
            ? "city"
            : "approximate"

    logger.debug("Geocoded address", {
      address,
      lat: result.lat,
      lon: result.lon,
      accuracy,
    })

    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      accuracy,
    }
  } catch (error) {
    logger.error("Geocoding error", { address }, error as Error)
    return null
  }
}

// ============================================================================
// School Ratings (GreatSchools)
// ============================================================================

/**
 * Fetch school ratings from GreatSchools
 *
 * Note: GreatSchools API requires an API key. If not available,
 * we'll use Linkup web search as a fallback.
 */
async function fetchSchoolRatings(
  latitude: number,
  longitude: number,
  radiusMiles: number = 3
): Promise<SchoolData | null> {
  const apiKey = process.env.GREATSCHOOLS_API_KEY

  if (!apiKey) {
    logger.debug(
      "GreatSchools API key not configured, using estimate from location"
    )
    return estimateSchoolRatings(latitude, longitude)
  }

  // Convert miles to meters for API
  const radiusMeters = Math.round(radiusMiles * 1609.34)

  const url = `https://gs-api.greatschools.org/schools?lat=${latitude}&lon=${longitude}&radius=${radiusMeters}&limit=10`

  try {
    const response = await withCircuitBreakerAndFallback(
      "greatschools",
      async () => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

        const res = await fetch(url, {
          method: "GET",
          headers: {
            "X-API-Key": apiKey,
            Accept: "application/json",
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!res.ok) {
          throw new Error(`GreatSchools API returned ${res.status}`)
        }

        return res.json()
      },
      async () => estimateSchoolRatings(latitude, longitude)
    )

    if (!response?.schools?.length) {
      return estimateSchoolRatings(latitude, longitude)
    }

    const schools: SchoolRating[] = response.schools.map((s: {
      name: string
      rating: number
      schoolLevel: string
      distance: number
      gradeRange: string
      enrollment?: number
    }) => ({
      name: s.name,
      rating: s.rating || 5, // Default to 5 if no rating
      type: s.schoolLevel?.toLowerCase() || "elementary",
      distance: s.distance || 0,
      gradeRange: s.gradeRange || "",
      enrollment: s.enrollment,
    }))

    return processSchoolData(schools, "GreatSchools API")
  } catch (error) {
    logger.warn("GreatSchools API error, using estimate", {}, error as Error)
    return estimateSchoolRatings(latitude, longitude)
  }
}

/**
 * Estimate school ratings based on location (fallback)
 * Uses a simple model based on typical patterns
 */
async function estimateSchoolRatings(
  _latitude: number,
  _longitude: number
): Promise<SchoolData> {
  // This is a fallback estimation when API is not available
  // In a production system, this could use ML models trained on school data
  // or cached historical data

  logger.debug("Using estimated school ratings")

  return {
    schools: [],
    averageRating: 6, // National average
    elementaryRating: null,
    middleRating: null,
    highRating: null,
    schoolCount: 0,
    source: "Estimated (National Average)",
  }
}

/**
 * Process raw school data into ratings
 */
function processSchoolData(
  schools: SchoolRating[],
  source: string
): SchoolData {
  if (schools.length === 0) {
    return {
      schools: [],
      averageRating: 6,
      elementaryRating: null,
      middleRating: null,
      highRating: null,
      schoolCount: 0,
      source,
    }
  }

  // Calculate weighted average (closer schools weighted higher)
  let totalWeight = 0
  let weightedSum = 0

  for (const school of schools) {
    const weight = 1 / (1 + school.distance) // Inverse distance weighting
    weightedSum += school.rating * weight
    totalWeight += weight
  }

  const averageRating = totalWeight > 0 ? weightedSum / totalWeight : 6

  // Calculate by type
  const getTypeAverage = (type: string): number | null => {
    const typeSchools = schools.filter((s) => s.type === type)
    if (typeSchools.length === 0) return null
    return (
      typeSchools.reduce((sum, s) => sum + s.rating, 0) / typeSchools.length
    )
  }

  return {
    schools: schools.slice(0, 10),
    averageRating: Math.round(averageRating * 10) / 10,
    elementaryRating: getTypeAverage("elementary"),
    middleRating: getTypeAverage("middle"),
    highRating: getTypeAverage("high"),
    schoolCount: schools.length,
    source,
  }
}

// ============================================================================
// Walk Score
// ============================================================================

/**
 * Fetch Walk Score data
 *
 * Walk Score API requires an API key.
 * If not available, estimates based on location characteristics.
 */
async function fetchWalkScore(
  latitude: number,
  longitude: number,
  address?: string
): Promise<WalkabilityScores | null> {
  const apiKey = process.env.WALKSCORE_API_KEY

  if (!apiKey) {
    logger.debug("Walk Score API key not configured, using estimate")
    return estimateWalkScore(latitude, longitude)
  }

  const params = new URLSearchParams({
    format: "json",
    lat: latitude.toString(),
    lon: longitude.toString(),
    transit: "1",
    bike: "1",
    wsapikey: apiKey,
  })

  if (address) {
    params.append("address", address)
  }

  const url = `https://api.walkscore.com/score?${params.toString()}`

  try {
    const response = await withCircuitBreakerAndFallback(
      "walkscore",
      async () => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

        const res = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!res.ok) {
          throw new Error(`Walk Score API returned ${res.status}`)
        }

        return res.json()
      },
      async () => estimateWalkScore(latitude, longitude)
    )

    if (!response?.walkscore) {
      return estimateWalkScore(latitude, longitude)
    }

    return {
      walkScore: response.walkscore,
      transitScore: response.transit?.score || null,
      bikeScore: response.bike?.score || null,
      walkScoreDescription:
        response.description || getWalkScoreDescription(response.walkscore),
      transitScoreDescription: response.transit?.description,
      bikeScoreDescription: response.bike?.description,
      source: "Walk Score API",
    }
  } catch (error) {
    logger.warn("Walk Score API error, using estimate", {}, error as Error)
    return estimateWalkScore(latitude, longitude)
  }
}

/**
 * Estimate walkability based on location (fallback)
 */
async function estimateWalkScore(
  _latitude: number,
  _longitude: number
): Promise<WalkabilityScores> {
  // Fallback estimation
  // In production, could use population density, POI proximity, etc.

  logger.debug("Using estimated Walk Score")

  return {
    walkScore: 50, // National average
    transitScore: null,
    bikeScore: null,
    walkScoreDescription: getWalkScoreDescription(50),
    source: "Estimated (National Average)",
  }
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Normalize address for cache key
 */
function normalizeAddressForLocationCache(address: string): string {
  return address.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * Get all location factors for an address
 *
 * @param address - Full address string
 * @param options - Optional configuration
 * @returns Location factors including schools and walkability
 */
export async function getLocationFactors(
  address: string,
  options: {
    skipCache?: boolean
    includeSchools?: boolean
    includeWalkability?: boolean
  } = {}
): Promise<LocationFactors> {
  const cacheKey = normalizeAddressForLocationCache(address)
  const {
    skipCache = false,
    includeSchools = true,
    includeWalkability = true,
  } = options

  // Check cache first
  if (!skipCache) {
    const cached = locationCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      logger.debug("Location cache hit", { address })
      return cached.data
    }
  }

  logger.info("Fetching location factors", { address })

  // Step 1: Geocode the address
  const coordinates = await geocodeAddress(address)

  if (!coordinates) {
    logger.warn("Could not geocode address", { address })
    return {
      fetchedAt: new Date().toISOString(),
      confidence: "low",
    }
  }

  // Step 2: Fetch school ratings and walkability in parallel
  const promises: Promise<unknown>[] = []

  if (includeSchools) {
    promises.push(
      fetchSchoolRatings(coordinates.latitude, coordinates.longitude)
    )
  }

  if (includeWalkability) {
    promises.push(
      fetchWalkScore(coordinates.latitude, coordinates.longitude, address)
    )
  }

  const results = await Promise.all(promises)

  let schools: SchoolData | undefined
  let walkability: WalkabilityScores | undefined

  let resultIndex = 0
  if (includeSchools) {
    schools = (results[resultIndex] as SchoolData) || undefined
    resultIndex++
  }
  if (includeWalkability) {
    walkability = (results[resultIndex] as WalkabilityScores) || undefined
  }

  // Determine confidence
  let confidence: "high" | "medium" | "low" = "medium"
  if (
    coordinates.accuracy === "rooftop" &&
    schools?.source !== "Estimated (National Average)" &&
    walkability?.source !== "Estimated (National Average)"
  ) {
    confidence = "high"
  } else if (
    coordinates.accuracy === "city" ||
    (schools?.source === "Estimated (National Average)" &&
      walkability?.source === "Estimated (National Average)")
  ) {
    confidence = "low"
  }

  const locationFactors: LocationFactors = {
    coordinates,
    schools,
    walkability,
    fetchedAt: new Date().toISOString(),
    confidence,
  }

  // Cache the result
  locationCache.set(cacheKey, {
    data: locationFactors,
    timestamp: Date.now(),
  })

  logger.info("Location factors fetched", {
    address,
    hasCoordinates: !!coordinates,
    schoolRating: schools?.averageRating,
    walkScore: walkability?.walkScore,
    confidence,
  })

  return locationFactors
}

/**
 * Calculate location premium/discount for hedonic model
 *
 * Returns a multiplier to apply to property value:
 * - Premium: > 1.0 (e.g., 1.15 = 15% premium)
 * - Discount: < 1.0 (e.g., 0.95 = 5% discount)
 * - Neutral: 1.0
 */
export function calculateLocationMultiplier(
  locationFactors: LocationFactors
): {
  multiplier: number
  breakdown: {
    schoolFactor: number
    walkFactor: number
  }
  explanation: string
} {
  let schoolFactor = 1.0
  let walkFactor = 1.0
  const explanations: string[] = []

  // School factor (can add up to +15% or -10%)
  if (locationFactors.schools?.averageRating) {
    const rating = locationFactors.schools.averageRating
    // Scale: rating 1-10 maps to factor 0.90 - 1.15
    // Rating 6 (average) = 1.0
    schoolFactor = 1.0 + (rating - 6) * 0.025
    schoolFactor = Math.max(0.9, Math.min(1.15, schoolFactor))

    if (rating >= 8) {
      explanations.push(`Excellent schools (${rating}/10): +${((schoolFactor - 1) * 100).toFixed(0)}%`)
    } else if (rating >= 6) {
      explanations.push(`Good schools (${rating}/10): +${((schoolFactor - 1) * 100).toFixed(0)}%`)
    } else {
      explanations.push(`Below-average schools (${rating}/10): ${((schoolFactor - 1) * 100).toFixed(0)}%`)
    }
  }

  // Walk Score factor (can add up to +10% or -5%)
  if (locationFactors.walkability?.walkScore !== undefined) {
    const walkScore = locationFactors.walkability.walkScore
    // Scale: walkScore 0-100 maps to factor 0.95 - 1.10
    // WalkScore 50 (average) = 1.0
    walkFactor = 1.0 + (walkScore - 50) * 0.003
    walkFactor = Math.max(0.95, Math.min(1.1, walkFactor))

    if (walkScore >= 70) {
      explanations.push(`Very Walkable (${walkScore}): +${((walkFactor - 1) * 100).toFixed(0)}%`)
    } else if (walkScore >= 50) {
      explanations.push(`Somewhat Walkable (${walkScore}): +${((walkFactor - 1) * 100).toFixed(0)}%`)
    } else {
      explanations.push(`Car-Dependent (${walkScore}): ${((walkFactor - 1) * 100).toFixed(0)}%`)
    }
  }

  const multiplier = schoolFactor * walkFactor
  const explanation =
    explanations.length > 0
      ? explanations.join("; ")
      : "Location factors not available"

  return {
    multiplier,
    breakdown: {
      schoolFactor,
      walkFactor,
    },
    explanation,
  }
}

/**
 * Clear location cache
 */
export function clearLocationCache(): void {
  locationCache.clear()
  logger.info("Location cache cleared")
}

/**
 * Check if location APIs are available
 */
export function getLocationAPIStatus(): {
  geocoding: boolean
  greatSchools: boolean
  walkScore: boolean
} {
  return {
    geocoding: true, // Always available (Nominatim is free)
    greatSchools: !!process.env.GREATSCHOOLS_API_KEY,
    walkScore: !!process.env.WALKSCORE_API_KEY,
  }
}
