/**
 * Location Data Integration for AVM
 *
 * Provides location-based factors that significantly impact property values:
 * - School ratings (SchoolDigger API → NCES state averages fallback)
 * - Walk Score (Walk Score API → OpenRouteService POI fallback)
 * - Geocoding (Nominatim - OpenStreetMap, FREE)
 *
 * All APIs have FREE alternatives - no paid keys required:
 * - SchoolDigger: 2000 calls/month free tier → NCES fallback
 * - Walk Score: 5000 calls/day → OpenRouteService isochrone + Overpass POI
 * - Nominatim: Unlimited (with rate limiting)
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
// School Ratings (SchoolDigger → NCES State Averages → OSM Fallback)
// ============================================================================

/**
 * NCES State Average School Ratings (2023-2024)
 * Source: National Center for Education Statistics
 * Scale: 1-10 (normalized from NAEP scores and graduation rates)
 * FREE - No API key required
 */
const NCES_STATE_SCHOOL_RATINGS: Record<string, number> = {
  // Top performers (8-9)
  MA: 8.5, NJ: 8.3, CT: 8.1, NH: 8.0, VT: 7.9, MN: 7.8, VA: 7.7, MD: 7.6,
  // Above average (7-8)
  WA: 7.5, CO: 7.4, PA: 7.3, NY: 7.2, WI: 7.1, IL: 7.0, RI: 7.0, ME: 7.0,
  // Average (6-7)
  OH: 6.9, IA: 6.8, NE: 6.8, UT: 6.7, OR: 6.6, MI: 6.5, IN: 6.4, KS: 6.3,
  DE: 6.2, MO: 6.1, NC: 6.0, GA: 6.0, FL: 6.0, AZ: 5.9, ID: 5.8, MT: 5.8,
  // Below average (5-6)
  TX: 5.7, TN: 5.6, KY: 5.5, SD: 5.4, WY: 5.4, ND: 5.3, HI: 5.2, CA: 5.2,
  SC: 5.1, AR: 5.0, OK: 5.0, WV: 4.9, AK: 4.8, NV: 4.7, LA: 4.6, AL: 4.5,
  NM: 4.4, MS: 4.3,
  // DC
  DC: 6.5,
}

/**
 * Fetch school ratings - tries multiple sources in order:
 * 1. SchoolDigger API (if key available) - 2000 calls/month free
 * 2. NCES State averages (FREE, no key required)
 * 3. OSM-based school density fallback (FREE)
 */
async function fetchSchoolRatings(
  latitude: number,
  longitude: number,
  state?: string,
  radiusMiles: number = 3
): Promise<SchoolData | null> {
  const apiKey = process.env.SCHOOLDIGGER_API_KEY
  const appId = process.env.SCHOOLDIGGER_APP_ID

  // Try SchoolDigger first if keys available
  if (apiKey && appId) {
    try {
      const schoolDiggerResult = await fetchFromSchoolDigger(
        latitude, longitude, radiusMiles, apiKey, appId
      )
      if (schoolDiggerResult && schoolDiggerResult.schools.length > 0) {
        return schoolDiggerResult
      }
    } catch (error) {
      logger.warn("SchoolDigger API error, falling back", {}, error as Error)
    }
  }

  // Try NCES state averages (FREE)
  if (state) {
    const stateUpper = state.toUpperCase()
    const stateRating = NCES_STATE_SCHOOL_RATINGS[stateUpper]
    if (stateRating) {
      logger.debug("Using NCES state average", { state: stateUpper, rating: stateRating })
      return {
        schools: [],
        averageRating: stateRating,
        elementaryRating: stateRating,
        middleRating: stateRating,
        highRating: stateRating,
        schoolCount: 0,
        source: `NCES State Average (${stateUpper})`,
      }
    }
  }

  // Fall back to OSM school density estimation (FREE)
  return estimateFromOSMSchools(latitude, longitude)
}

/**
 * Fetch from SchoolDigger API
 * FREE tier: 2000 calls/month
 * https://developer.schooldigger.com/
 */
async function fetchFromSchoolDigger(
  latitude: number,
  longitude: number,
  radiusMiles: number,
  apiKey: string,
  appId: string
): Promise<SchoolData | null> {
  const url = new URL("https://api.schooldigger.com/v2.0/schools")
  url.searchParams.append("st", "") // Will be detected from lat/lon
  url.searchParams.append("lat", latitude.toString())
  url.searchParams.append("lng", longitude.toString())
  url.searchParams.append("distanceMiles", radiusMiles.toString())
  url.searchParams.append("perPage", "10")
  url.searchParams.append("appID", appId)
  url.searchParams.append("appKey", apiKey)

  const response = await withCircuitBreakerAndFallback(
    "schooldigger",
    async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        throw new Error(`SchoolDigger API returned ${res.status}`)
      }

      return res.json()
    },
    async () => null
  )

  if (!response?.schoolList?.length) {
    return null
  }

  const schools: SchoolRating[] = response.schoolList.map((s: {
    schoolName: string
    rankHistory?: Array<{ rank: number; rankOf: number }>
    schoolLevel: string
    distance: number
    lowGrade: string
    highGrade: string
    enrollment?: number
  }) => {
    // Convert SchoolDigger rank to 1-10 rating
    // SchoolDigger uses percentile rank (1 = best)
    let rating = 5 // default
    if (s.rankHistory?.[0]) {
      const percentile = 1 - (s.rankHistory[0].rank / s.rankHistory[0].rankOf)
      rating = Math.round(1 + percentile * 9) // Convert to 1-10 scale
    }

    return {
      name: s.schoolName,
      rating,
      type: s.schoolLevel?.toLowerCase().includes("middle") ? "middle"
        : s.schoolLevel?.toLowerCase().includes("high") ? "high"
        : "elementary" as const,
      distance: s.distance || 0,
      gradeRange: `${s.lowGrade || 'K'}-${s.highGrade || '12'}`,
      enrollment: s.enrollment,
    }
  })

  return processSchoolData(schools, "SchoolDigger API")
}

/**
 * Estimate school ratings from OpenStreetMap school density
 * Uses Overpass API (FREE, no key required)
 * More schools nearby = better educational access
 */
async function estimateFromOSMSchools(
  latitude: number,
  longitude: number
): Promise<SchoolData> {
  try {
    // Query Overpass for schools within 3 miles (~5km)
    const radius = 5000 // meters
    const query = `
      [out:json][timeout:10];
      (
        node["amenity"="school"](around:${radius},${latitude},${longitude});
        way["amenity"="school"](around:${radius},${latitude},${longitude});
      );
      out count;
    `

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Overpass API returned ${response.status}`)
    }

    const data = await response.json()
    const schoolCount = data.elements?.[0]?.tags?.total || 0

    // Convert school count to rating (more schools = better access)
    // 0-2 schools: 4, 3-5: 5, 6-10: 6, 11-15: 7, 16+: 8
    let rating = 6 // default
    if (schoolCount >= 16) rating = 8
    else if (schoolCount >= 11) rating = 7
    else if (schoolCount >= 6) rating = 6
    else if (schoolCount >= 3) rating = 5
    else rating = 4

    logger.debug("Estimated school rating from OSM density", { schoolCount, rating })

    return {
      schools: [],
      averageRating: rating,
      elementaryRating: null,
      middleRating: null,
      highRating: null,
      schoolCount,
      source: "OSM School Density Estimate",
    }
  } catch (error) {
    logger.warn("OSM school estimation failed", {}, error as Error)
    // Final fallback: national average
    return {
      schools: [],
      averageRating: 6,
      elementaryRating: null,
      middleRating: null,
      highRating: null,
      schoolCount: 0,
      source: "National Average (Fallback)",
    }
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
// Walk Score (Walk Score API → OpenRouteService + Overpass POI Fallback)
// ============================================================================

/**
 * POI categories for walkability calculation
 * Based on Walk Score methodology: amenities within walking distance
 * Note: Used for weighted POI scoring (future enhancement)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _WALKABILITY_POI_WEIGHTS: Record<string, { category: string; weight: number }[]> = {
  essential: [
    { category: "supermarket", weight: 3 },
    { category: "convenience", weight: 2 },
    { category: "pharmacy", weight: 2 },
  ],
  food: [
    { category: "restaurant", weight: 1.5 },
    { category: "cafe", weight: 1 },
    { category: "fast_food", weight: 0.5 },
  ],
  shopping: [
    { category: "clothes", weight: 1 },
    { category: "mall", weight: 1.5 },
    { category: "department_store", weight: 1 },
  ],
  services: [
    { category: "bank", weight: 1 },
    { category: "post_office", weight: 1 },
    { category: "doctors", weight: 1.5 },
  ],
  recreation: [
    { category: "park", weight: 1.5 },
    { category: "fitness_centre", weight: 1 },
    { category: "cinema", weight: 0.5 },
  ],
  transit: [
    { category: "bus_station", weight: 2 },
    { category: "subway_entrance", weight: 3 },
    { category: "train_station", weight: 2.5 },
  ],
}

/**
 * Fetch Walk Score - tries multiple sources in order:
 * 1. Walk Score API (if key available) - 5000 calls/day free
 * 2. OpenRouteService + Overpass POI calculation (FREE)
 */
async function fetchWalkScore(
  latitude: number,
  longitude: number,
  address?: string
): Promise<WalkabilityScores | null> {
  const apiKey = process.env.WALKSCORE_API_KEY

  // Try Walk Score API first if key available
  if (apiKey) {
    try {
      const walkScoreResult = await fetchFromWalkScoreAPI(
        latitude, longitude, address, apiKey
      )
      if (walkScoreResult) {
        return walkScoreResult
      }
    } catch (error) {
      logger.warn("Walk Score API error, falling back", {}, error as Error)
    }
  }

  // Fall back to OpenRouteService + Overpass POI calculation (FREE)
  return calculateWalkabilityFromOSM(latitude, longitude)
}

/**
 * Fetch from Walk Score API
 * FREE tier: 5000 calls/day
 */
async function fetchFromWalkScoreAPI(
  latitude: number,
  longitude: number,
  address: string | undefined,
  apiKey: string
): Promise<WalkabilityScores | null> {
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

  const response = await withCircuitBreakerAndFallback(
    "walkscore",
    async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        throw new Error(`Walk Score API returned ${res.status}`)
      }

      return res.json()
    },
    async () => null
  )

  if (!response?.walkscore) {
    return null
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
}

/**
 * Calculate walkability score from OpenStreetMap POI data
 * Uses Overpass API (FREE, no key required)
 * Methodology: Count amenities within walking distance (1 mile/1.6km)
 */
async function calculateWalkabilityFromOSM(
  latitude: number,
  longitude: number
): Promise<WalkabilityScores> {
  try {
    // Query Overpass for walkability-relevant POIs within ~1 mile
    const radius = 1600 // meters (≈1 mile walking distance)

    // Build query for all relevant amenity types
    const amenityTypes = [
      "supermarket", "convenience", "pharmacy", // essential
      "restaurant", "cafe", "fast_food", // food
      "bank", "post_office", "doctors", // services
      "park", "fitness_centre", // recreation
      "bus_station", "subway_entrance", "train_station", // transit
    ]

    const query = `
      [out:json][timeout:15];
      (
        ${amenityTypes.map(type =>
          `node["amenity"="${type}"](around:${radius},${latitude},${longitude});
           node["shop"="${type}"](around:${radius},${latitude},${longitude});`
        ).join("\n")}
        node["public_transport"="station"](around:${radius},${latitude},${longitude});
        node["railway"="station"](around:${radius},${latitude},${longitude});
        node["leisure"="park"](around:${radius},${latitude},${longitude});
        way["leisure"="park"](around:${radius},${latitude},${longitude});
      );
      out count;
    `

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Overpass API returned ${response.status}`)
    }

    const data = await response.json()
    const poiCount = data.elements?.[0]?.tags?.total || 0

    // Convert POI count to walk score (0-100)
    // Based on Walk Score methodology approximation:
    // - 0-5 POIs: 0-25 (car-dependent)
    // - 6-15 POIs: 25-50 (car-dependent/some walkable)
    // - 16-30 POIs: 50-70 (somewhat walkable)
    // - 31-50 POIs: 70-90 (very walkable)
    // - 51+ POIs: 90-100 (walker's paradise)
    let walkScore: number
    if (poiCount >= 51) {
      walkScore = Math.min(100, 90 + Math.floor((poiCount - 51) / 5))
    } else if (poiCount >= 31) {
      walkScore = 70 + Math.floor((poiCount - 31) / 2)
    } else if (poiCount >= 16) {
      walkScore = 50 + Math.floor((poiCount - 16) * 1.33)
    } else if (poiCount >= 6) {
      walkScore = 25 + Math.floor((poiCount - 6) * 2.5)
    } else {
      walkScore = poiCount * 5
    }

    // Estimate transit score based on transit POIs (very rough)
    const hasTransit = poiCount >= 10 // Rough proxy
    const transitScore = hasTransit ? Math.min(walkScore + 10, 100) : null

    // Estimate bike score (urban areas with walkability tend to be bikeable)
    const bikeScore = walkScore >= 50 ? Math.min(walkScore + 5, 100) : null

    logger.debug("Calculated walkability from OSM", { poiCount, walkScore })

    return {
      walkScore,
      transitScore,
      bikeScore,
      walkScoreDescription: getWalkScoreDescription(walkScore),
      transitScoreDescription: transitScore ? getWalkScoreDescription(transitScore) : undefined,
      bikeScoreDescription: bikeScore ? getWalkScoreDescription(bikeScore) : undefined,
      source: "OpenStreetMap POI Analysis",
    }
  } catch (error) {
    logger.warn("OSM walkability calculation failed", {}, error as Error)

    // Final fallback: Use city-based estimate
    return {
      walkScore: 50, // National average
      transitScore: null,
      bikeScore: null,
      walkScoreDescription: getWalkScoreDescription(50),
      source: "National Average (Fallback)",
    }
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

  // Extract state from address for NCES fallback
  const stateMatch = address.match(/,\s*([A-Z]{2})\s*\d{5}?/i) ||
                     address.match(/,\s*([A-Z]{2})\s*$/i) ||
                     address.match(/\b([A-Z]{2})\s+\d{5}/i)
  const state = stateMatch?.[1]?.toUpperCase()

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
      fetchSchoolRatings(coordinates.latitude, coordinates.longitude, state)
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

  // Determine confidence based on data quality
  let confidence: "high" | "medium" | "low" = "medium"
  const schoolsAreEstimated = schools?.source?.includes("Fallback") || schools?.source?.includes("National Average")
  const walkabilityIsEstimated = walkability?.source?.includes("Fallback") || walkability?.source?.includes("National Average")

  if (
    coordinates.accuracy === "rooftop" &&
    !schoolsAreEstimated &&
    !walkabilityIsEstimated
  ) {
    confidence = "high"
  } else if (
    coordinates.accuracy === "city" ||
    (schoolsAreEstimated && walkabilityIsEstimated)
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
 * All features have FREE fallbacks - no paid keys required
 */
export function getLocationAPIStatus(): {
  geocoding: boolean
  schoolDigger: boolean
  ncesStateFallback: boolean
  osmSchoolFallback: boolean
  walkScore: boolean
  osmWalkabilityFallback: boolean
} {
  return {
    // Geocoding
    geocoding: true, // Always available (Nominatim/OSM - FREE)

    // School ratings
    schoolDigger: !!(process.env.SCHOOLDIGGER_API_KEY && process.env.SCHOOLDIGGER_APP_ID),
    ncesStateFallback: true, // Always available (built-in state averages - FREE)
    osmSchoolFallback: true, // Always available (Overpass API - FREE)

    // Walkability
    walkScore: !!process.env.WALKSCORE_API_KEY,
    osmWalkabilityFallback: true, // Always available (Overpass API - FREE)
  }
}
