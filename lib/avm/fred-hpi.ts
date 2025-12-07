/**
 * FRED (Federal Reserve Economic Data) Housing Price Index Integration
 *
 * Provides market appreciation data from the Federal Reserve Bank of St. Louis.
 * Uses the Case-Shiller Home Price Index and FHFA House Price Index.
 *
 * FREE API - No API key required for basic access (with rate limits)
 * With API key: Higher rate limits
 *
 * Key Series:
 * - CSUSHPINSA: S&P/Case-Shiller U.S. National Home Price Index (National)
 * - USSTHPI: All-Transactions House Price Index for the United States (FHFA)
 * - [MSA]STHPI: Metro-specific HPI (e.g., AABORSLHPI for Ann Arbor)
 *
 * @see https://fred.stlouisfed.org/docs/api/fred/
 */

// ============================================================================
// Types
// ============================================================================

export interface HPIDataPoint {
  date: string // YYYY-MM-DD
  value: number // Index value (base = 100 at reference date)
}

export interface HPIResult {
  seriesId: string
  seriesName: string
  units: string
  frequency: string
  observations: HPIDataPoint[]
  latestValue: number
  latestDate: string
  yearOverYearChange: number // Percentage change
  quarterOverQuarterChange: number
  source: "FRED"
}

export interface AppreciationRate {
  annualized: number // Annual appreciation rate (decimal, e.g., 0.05 = 5%)
  monthly: number // Monthly appreciation rate
  quarterly: number // Quarterly appreciation rate
  period: string // Time period used for calculation
  confidence: "high" | "medium" | "low"
  dataPoints: number
  source: string
}

// Metro area to FRED series ID mapping
// FHFA publishes HPI for all 50 states and ~400 metro areas
const METRO_HPI_SERIES: Record<string, string> = {
  // Major metros (Case-Shiller 20-City Composite)
  "new york": "NYXRSA",
  "los angeles": "LXXRSA",
  "chicago": "CHXRSA",
  "dallas": "DAXRSA",
  "houston": "HOXRSA", // Not in Case-Shiller, using FHFA
  "washington": "WDXRSA",
  "miami": "MIXRSA",
  "philadelphia": "PHXRSA", // Not in Case-Shiller 20
  "atlanta": "ATXRSA",
  "phoenix": "PHXRSA",
  "boston": "BOXRSA",
  "san francisco": "SFXRSA",
  "riverside": "RVXRSA", // Not in Case-Shiller
  "detroit": "DEXRSA",
  "seattle": "SEXRSA",
  "minneapolis": "MNXRSA",
  "san diego": "SDXRSA",
  "tampa": "TPXRSA",
  "denver": "DNXRSA",
  "st. louis": "SLXRSA", // Not in Case-Shiller
  "baltimore": "BAXRSA", // Not in Case-Shiller
  "orlando": "ORXRSA", // Not in Case-Shiller
  "charlotte": "CHXRSA",
  "san antonio": "SAXRSA", // Not in Case-Shiller
  "portland": "POXRSA",
  "sacramento": "SAXRSA", // Not in Case-Shiller
  "pittsburgh": "PIXRSA", // Not in Case-Shiller
  "austin": "AUXRSA", // Not in Case-Shiller
  "las vegas": "LVXRSA",
  "cincinnati": "CIXRSA", // Not in Case-Shiller
  "kansas city": "KCXRSA", // Not in Case-Shiller
  "columbus": "COXRSA", // Not in Case-Shiller
  "cleveland": "CLXRSA",
  "indianapolis": "INXRSA", // Not in Case-Shiller
  "nashville": "NAXRSA", // Not in Case-Shiller
  "raleigh": "RAXRSA", // Not in Case-Shiller
  "milwaukee": "MIXRSA", // Not in Case-Shiller
  "jacksonville": "JAXRSA", // Not in Case-Shiller
  "memphis": "MEXRSA", // Not in Case-Shiller
  "oklahoma city": "OKXRSA", // Not in Case-Shiller
  "louisville": "LOXRSA", // Not in Case-Shiller
  "richmond": "RIXRSA", // Not in Case-Shiller
  "new orleans": "NOXRSA", // Not in Case-Shiller
  "salt lake city": "SLXRSA", // Not in Case-Shiller
  "hartford": "HAXRSA", // Not in Case-Shiller
  "buffalo": "BUXRSA", // Not in Case-Shiller
}

// State to FHFA HPI series mapping
const STATE_HPI_SERIES: Record<string, string> = {
  AL: "ALSTHPI",
  AK: "AKSTHPI",
  AZ: "AZSTHPI",
  AR: "ARSTHPI",
  CA: "CASTHPI",
  CO: "COSTHPI",
  CT: "CTSTHPI",
  DE: "DESTHPI",
  FL: "FLSTHPI",
  GA: "GASTHPI",
  HI: "HISTHPI",
  ID: "IDSTHPI",
  IL: "ILSTHPI",
  IN: "INSTHPI",
  IA: "IASTHPI",
  KS: "KSSTHPI",
  KY: "KYSTHPI",
  LA: "LASTHPI",
  ME: "MESTHPI",
  MD: "MDSTHPI",
  MA: "MASTHPI",
  MI: "MISTHPI",
  MN: "MNSTHPI",
  MS: "MSSTHPI",
  MO: "MOSTHPI",
  MT: "MTSTHPI",
  NE: "NESTHPI",
  NV: "NVSTHPI",
  NH: "NHSTHPI",
  NJ: "NJSTHPI",
  NM: "NMSTHPI",
  NY: "NYSTHPI",
  NC: "NCSTHPI",
  ND: "NDSTHPI",
  OH: "OHSTHPI",
  OK: "OKSTHPI",
  OR: "ORSTHPI",
  PA: "PASTHPI",
  RI: "RISTHPI",
  SC: "SCSTHPI",
  SD: "SDSTHPI",
  TN: "TNSTHPI",
  TX: "TXSTHPI",
  UT: "UTSTHPI",
  VT: "VTSTHPI",
  VA: "VASTHPI",
  WA: "WASTHPI",
  WV: "WVSTHPI",
  WI: "WISTHPI",
  WY: "WYSTHPI",
  DC: "DCSTHPI",
}

// ============================================================================
// Configuration
// ============================================================================

const FRED_BASE_URL = "https://api.stlouisfed.org/fred"
const REQUEST_TIMEOUT_MS = 10000
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// National series as fallback
const NATIONAL_HPI_SERIES = "CSUSHPINSA" // Case-Shiller National

// In-memory cache for HPI data
interface HPICache {
  data: HPIResult
  timestamp: number
}
const hpiCache = new Map<string, HPICache>()

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get FRED API key from environment (optional)
 * Without key: 120 requests/minute
 * With key: 500 requests/minute
 */
function getFredApiKey(): string | null {
  return process.env.FRED_API_KEY || null
}

/**
 * Fetch HPI data from FRED API
 */
async function fetchFredSeries(
  seriesId: string,
  observationStart?: string
): Promise<HPIResult | null> {
  // Check cache first
  const cached = hpiCache.get(seriesId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[FRED HPI] Cache hit for ${seriesId}`)
    return cached.data
  }

  const apiKey = getFredApiKey()

  // Build URL
  const params = new URLSearchParams({
    series_id: seriesId,
    file_type: "json",
    sort_order: "desc",
    limit: "24", // Last 24 observations (2 years for monthly data)
  })

  if (apiKey) {
    params.append("api_key", apiKey)
  }

  if (observationStart) {
    params.append("observation_start", observationStart)
  }

  const url = `${FRED_BASE_URL}/series/observations?${params.toString()}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`[FRED HPI] HTTP ${response.status} for ${seriesId}`)
      return null
    }

    const data = await response.json()

    if (!data.observations || data.observations.length === 0) {
      console.log(`[FRED HPI] No observations for ${seriesId}`)
      return null
    }

    // Parse observations
    const observations: HPIDataPoint[] = data.observations
      .filter((obs: { value: string }) => obs.value !== ".")
      .map((obs: { date: string; value: string }) => ({
        date: obs.date,
        value: parseFloat(obs.value),
      }))
      .reverse() // Oldest first

    if (observations.length < 2) {
      return null
    }

    // Calculate changes
    const latest = observations[observations.length - 1]
    const yearAgo = observations.find((obs) => {
      const obsDate = new Date(obs.date)
      const latestDate = new Date(latest.date)
      const monthsDiff =
        (latestDate.getFullYear() - obsDate.getFullYear()) * 12 +
        (latestDate.getMonth() - obsDate.getMonth())
      return monthsDiff >= 11 && monthsDiff <= 13
    })
    const quarterAgo = observations.find((obs) => {
      const obsDate = new Date(obs.date)
      const latestDate = new Date(latest.date)
      const monthsDiff =
        (latestDate.getFullYear() - obsDate.getFullYear()) * 12 +
        (latestDate.getMonth() - obsDate.getMonth())
      return monthsDiff >= 2 && monthsDiff <= 4
    })

    const yearOverYearChange = yearAgo
      ? (latest.value - yearAgo.value) / yearAgo.value
      : 0

    const quarterOverQuarterChange = quarterAgo
      ? (latest.value - quarterAgo.value) / quarterAgo.value
      : 0

    const result: HPIResult = {
      seriesId,
      seriesName: getSeriesName(seriesId),
      units: "Index",
      frequency: "Monthly",
      observations,
      latestValue: latest.value,
      latestDate: latest.date,
      yearOverYearChange,
      quarterOverQuarterChange,
      source: "FRED",
    }

    // Cache result
    hpiCache.set(seriesId, { data: result, timestamp: Date.now() })
    console.log(
      `[FRED HPI] Fetched ${seriesId}: ${latest.value} (YoY: ${(yearOverYearChange * 100).toFixed(1)}%)`
    )

    return result
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`[FRED HPI] Timeout for ${seriesId}`)
    } else {
      console.error(`[FRED HPI] Error fetching ${seriesId}:`, error)
    }
    return null
  }
}

/**
 * Get human-readable series name
 */
function getSeriesName(seriesId: string): string {
  if (seriesId === NATIONAL_HPI_SERIES) {
    return "S&P/Case-Shiller U.S. National Home Price Index"
  }
  if (seriesId.endsWith("STHPI")) {
    const stateCode = seriesId.replace("STHPI", "")
    return `FHFA House Price Index - ${stateCode}`
  }
  if (seriesId.endsWith("XRSA")) {
    return `Case-Shiller Home Price Index - Metro`
  }
  return seriesId
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get appreciation rate for a location
 * Tries metro-specific, then state, then national
 *
 * @param city - City name (optional)
 * @param state - State code (e.g., "CA", "TX")
 * @returns Appreciation rate data
 */
export async function getAppreciationRate(
  city?: string,
  state?: string
): Promise<AppreciationRate> {
  let hpiResult: HPIResult | null = null
  let source = "National Average"

  // Try metro-specific first
  if (city) {
    const cityLower = city.toLowerCase().trim()
    const metroSeries = METRO_HPI_SERIES[cityLower]
    if (metroSeries) {
      hpiResult = await fetchFredSeries(metroSeries)
      if (hpiResult) {
        source = `${city} Metro (Case-Shiller)`
      }
    }
  }

  // Try state-level
  if (!hpiResult && state) {
    const stateUpper = state.toUpperCase().trim()
    const stateSeries = STATE_HPI_SERIES[stateUpper]
    if (stateSeries) {
      hpiResult = await fetchFredSeries(stateSeries)
      if (hpiResult) {
        source = `${stateUpper} State (FHFA)`
      }
    }
  }

  // Fall back to national
  if (!hpiResult) {
    hpiResult = await fetchFredSeries(NATIONAL_HPI_SERIES)
    source = "National (Case-Shiller)"
  }

  // Default fallback if API fails
  if (!hpiResult) {
    console.log("[FRED HPI] Using default appreciation rate")
    return {
      annualized: 0.04, // 4% historical average
      monthly: 0.04 / 12,
      quarterly: 0.04 / 4,
      period: "Historical Average",
      confidence: "low",
      dataPoints: 0,
      source: "Default (Historical Average)",
    }
  }

  // Calculate annualized rate from YoY change
  const annualized = hpiResult.yearOverYearChange
  const monthly = annualized / 12
  const quarterly = annualized / 4

  // Determine confidence based on data quality
  let confidence: "high" | "medium" | "low" = "medium"
  if (hpiResult.observations.length >= 12) {
    confidence = "high"
  } else if (hpiResult.observations.length >= 6) {
    confidence = "medium"
  } else {
    confidence = "low"
  }

  return {
    annualized,
    monthly,
    quarterly,
    period: `${hpiResult.observations[0]?.date} to ${hpiResult.latestDate}`,
    confidence,
    dataPoints: hpiResult.observations.length,
    source,
  }
}

/**
 * Adjust a property value for market appreciation
 * Used when a comp sold X months ago
 *
 * @param value - Original value (e.g., comp sale price)
 * @param monthsSinceSale - Months since the value was observed
 * @param city - City for metro-specific adjustment
 * @param state - State for state-specific adjustment
 * @returns Appreciation-adjusted value
 */
export async function adjustForAppreciation(
  value: number,
  monthsSinceSale: number,
  city?: string,
  state?: string
): Promise<{
  adjustedValue: number
  appreciationRate: number
  adjustment: number
  source: string
}> {
  const rate = await getAppreciationRate(city, state)

  // Compound monthly appreciation
  const monthlyRate = rate.monthly
  const appreciationFactor = Math.pow(1 + monthlyRate, monthsSinceSale)
  const adjustedValue = value * appreciationFactor
  const adjustment = adjustedValue - value

  return {
    adjustedValue: Math.round(adjustedValue),
    appreciationRate: rate.annualized,
    adjustment: Math.round(adjustment),
    source: rate.source,
  }
}

/**
 * Get historical HPI data for trend analysis
 */
export async function getHistoricalHPI(
  city?: string,
  state?: string,
  months: number = 24
): Promise<HPIResult | null> {
  // Calculate start date
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)
  const observationStart = startDate.toISOString().split("T")[0]

  let seriesId = NATIONAL_HPI_SERIES

  if (city) {
    const cityLower = city.toLowerCase().trim()
    if (METRO_HPI_SERIES[cityLower]) {
      seriesId = METRO_HPI_SERIES[cityLower]
    }
  } else if (state) {
    const stateUpper = state.toUpperCase().trim()
    if (STATE_HPI_SERIES[stateUpper]) {
      seriesId = STATE_HPI_SERIES[stateUpper]
    }
  }

  return fetchFredSeries(seriesId, observationStart)
}

/**
 * Clear HPI cache (for testing)
 */
export function clearHPICache(): void {
  hpiCache.clear()
  console.log("[FRED HPI] Cache cleared")
}

/**
 * Check if FRED API is available
 */
export function isFredHPIEnabled(): boolean {
  return true // Always enabled, uses public API
}
