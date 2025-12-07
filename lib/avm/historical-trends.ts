/**
 * Historical Trend Analysis Module
 *
 * Provides:
 * - Market trend analysis over time
 * - Price appreciation tracking
 * - Seasonal patterns
 * - Market forecasting
 * - Comparative market analysis
 *
 * Uses FRED HPI data and property history to analyze trends.
 */

import { getHistoricalHPI, type HPIResult, type HPIDataPoint } from "./fred-hpi"
import { createLogger } from "./logger"

const logger = createLogger("historical-trends")

// ============================================================================
// Types
// ============================================================================

export interface MarketTrend {
  period: string // e.g., "2024 Q3", "Last 12 months"
  startDate: string
  endDate: string
  startValue: number
  endValue: number
  changePercent: number
  changeAnnualized: number
  direction: "up" | "down" | "flat"
  volatility: number // Standard deviation of changes
  confidence: "high" | "medium" | "low"
}

export interface SeasonalPattern {
  month: number
  monthName: string
  typicalChange: number // Typical price change this month
  transactionVolume: "high" | "medium" | "low"
  description: string
}

export interface MarketForecast {
  horizon: string // e.g., "6 months", "1 year"
  predictedChange: number // Percentage
  confidenceInterval: { low: number; high: number }
  methodology: string
  factors: string[]
  confidence: "high" | "medium" | "low"
}

export interface HistoricalAnalysis {
  location: {
    city?: string
    state?: string
    level: "metro" | "state" | "national"
  }
  currentValue: number
  trends: {
    lastMonth: MarketTrend
    lastQuarter: MarketTrend
    lastYear: MarketTrend
    last3Years?: MarketTrend
    last5Years?: MarketTrend
  }
  seasonalPatterns: SeasonalPattern[]
  forecast: MarketForecast
  hpiData?: HPIResult
  analyzedAt: string
}

export interface PriceHistory {
  date: string
  price: number
  event?: string // "Listed", "Sold", "Price Change"
  source?: string
}

export interface PropertyHistoryAnalysis {
  address: string
  history: PriceHistory[]
  appreciation: {
    totalChange: number
    annualizedChange: number
    periodYears: number
  }
  comparedToMarket: {
    outperformed: boolean
    differencePercent: number
    marketChange: number
  }
}

// ============================================================================
// Seasonal Patterns
// ============================================================================

// Based on historical real estate transaction patterns
const SEASONAL_PATTERNS: SeasonalPattern[] = [
  {
    month: 1,
    monthName: "January",
    typicalChange: -0.002,
    transactionVolume: "low",
    description: "Post-holiday slowdown, fewer buyers",
  },
  {
    month: 2,
    monthName: "February",
    typicalChange: 0.003,
    transactionVolume: "low",
    description: "Market begins to warm up",
  },
  {
    month: 3,
    monthName: "March",
    typicalChange: 0.008,
    transactionVolume: "medium",
    description: "Spring market begins, increasing activity",
  },
  {
    month: 4,
    monthName: "April",
    typicalChange: 0.012,
    transactionVolume: "high",
    description: "Peak buying season starts",
  },
  {
    month: 5,
    monthName: "May",
    typicalChange: 0.015,
    transactionVolume: "high",
    description: "Strongest month for sales",
  },
  {
    month: 6,
    monthName: "June",
    typicalChange: 0.012,
    transactionVolume: "high",
    description: "Summer market peak",
  },
  {
    month: 7,
    monthName: "July",
    typicalChange: 0.008,
    transactionVolume: "medium",
    description: "Activity slows for summer vacation",
  },
  {
    month: 8,
    monthName: "August",
    typicalChange: 0.005,
    transactionVolume: "medium",
    description: "Back-to-school preparation",
  },
  {
    month: 9,
    monthName: "September",
    typicalChange: 0.003,
    transactionVolume: "medium",
    description: "Fall market begins",
  },
  {
    month: 10,
    monthName: "October",
    typicalChange: 0.002,
    transactionVolume: "medium",
    description: "Last push before holidays",
  },
  {
    month: 11,
    monthName: "November",
    typicalChange: -0.001,
    transactionVolume: "low",
    description: "Holiday slowdown begins",
  },
  {
    month: 12,
    monthName: "December",
    typicalChange: -0.003,
    transactionVolume: "low",
    description: "Holiday season, minimal activity",
  },
]

// ============================================================================
// Trend Calculation
// ============================================================================

/**
 * Calculate trend between two points
 */
function calculateTrend(
  startValue: number,
  endValue: number,
  startDate: string,
  endDate: string,
  observations: HPIDataPoint[]
): MarketTrend {
  const changePercent = (endValue - startValue) / startValue

  // Calculate months between dates
  const start = new Date(startDate)
  const end = new Date(endDate)
  const monthsDiff =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())

  // Annualize the change
  const yearsElapsed = monthsDiff / 12
  const changeAnnualized =
    yearsElapsed > 0
      ? Math.pow(1 + changePercent, 1 / yearsElapsed) - 1
      : changePercent

  // Determine direction
  let direction: "up" | "down" | "flat" = "flat"
  if (changePercent > 0.01) direction = "up"
  else if (changePercent < -0.01) direction = "down"

  // Calculate volatility (standard deviation of monthly changes)
  let volatility = 0
  if (observations.length >= 2) {
    const changes: number[] = []
    for (let i = 1; i < observations.length; i++) {
      const monthlyChange =
        (observations[i].value - observations[i - 1].value) /
        observations[i - 1].value
      changes.push(monthlyChange)
    }

    if (changes.length > 0) {
      const mean = changes.reduce((a, b) => a + b, 0) / changes.length
      const variance =
        changes.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) /
        changes.length
      volatility = Math.sqrt(variance)
    }
  }

  // Determine confidence based on data quality
  let confidence: "high" | "medium" | "low" = "medium"
  if (observations.length >= 12) confidence = "high"
  else if (observations.length < 6) confidence = "low"

  return {
    period: `${startDate} to ${endDate}`,
    startDate,
    endDate,
    startValue: Math.round(startValue),
    endValue: Math.round(endValue),
    changePercent: Math.round(changePercent * 10000) / 10000,
    changeAnnualized: Math.round(changeAnnualized * 10000) / 10000,
    direction,
    volatility: Math.round(volatility * 10000) / 10000,
    confidence,
  }
}

/**
 * Find observation closest to target date
 */
function findObservationNearDate(
  observations: HPIDataPoint[],
  targetDate: Date,
  maxMonthsDiff: number = 2
): HPIDataPoint | null {
  let closest: HPIDataPoint | null = null
  let closestDiff = Infinity

  for (const obs of observations) {
    const obsDate = new Date(obs.date)
    const diff = Math.abs(obsDate.getTime() - targetDate.getTime())
    const monthsDiff = diff / (1000 * 60 * 60 * 24 * 30)

    if (monthsDiff <= maxMonthsDiff && diff < closestDiff) {
      closest = obs
      closestDiff = diff
    }
  }

  return closest
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Perform historical trend analysis for a location
 */
export async function analyzeHistoricalTrends(
  city?: string,
  state?: string,
  months: number = 60 // 5 years of data
): Promise<HistoricalAnalysis> {
  logger.info("Analyzing historical trends", { city, state, months })

  // Fetch historical HPI data
  const hpiData = await getHistoricalHPI(city, state, months)

  if (!hpiData || hpiData.observations.length < 2) {
    logger.warn("Insufficient HPI data for analysis")
    return createDefaultAnalysis(city, state)
  }

  const observations = hpiData.observations
  const latest = observations[observations.length - 1]
  const now = new Date()

  // Calculate trends for different periods
  const trends: HistoricalAnalysis["trends"] = {} as HistoricalAnalysis["trends"]

  // Last month
  const oneMonthAgo = new Date(now)
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
  const oneMonthObs = findObservationNearDate(observations, oneMonthAgo)
  if (oneMonthObs) {
    const monthObs = observations.filter(
      (o) => new Date(o.date) >= oneMonthAgo
    )
    trends.lastMonth = calculateTrend(
      oneMonthObs.value,
      latest.value,
      oneMonthObs.date,
      latest.date,
      monthObs
    )
  } else {
    trends.lastMonth = createDefaultTrend("Last month")
  }

  // Last quarter
  const threeMonthsAgo = new Date(now)
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const threeMonthObs = findObservationNearDate(observations, threeMonthsAgo)
  if (threeMonthObs) {
    const quarterObs = observations.filter(
      (o) => new Date(o.date) >= threeMonthsAgo
    )
    trends.lastQuarter = calculateTrend(
      threeMonthObs.value,
      latest.value,
      threeMonthObs.date,
      latest.date,
      quarterObs
    )
  } else {
    trends.lastQuarter = createDefaultTrend("Last quarter")
  }

  // Last year
  const oneYearAgo = new Date(now)
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const oneYearObs = findObservationNearDate(observations, oneYearAgo)
  if (oneYearObs) {
    const yearObs = observations.filter((o) => new Date(o.date) >= oneYearAgo)
    trends.lastYear = calculateTrend(
      oneYearObs.value,
      latest.value,
      oneYearObs.date,
      latest.date,
      yearObs
    )
  } else {
    trends.lastYear = createDefaultTrend("Last year")
  }

  // Last 3 years (if data available)
  const threeYearsAgo = new Date(now)
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
  const threeYearObs = findObservationNearDate(observations, threeYearsAgo, 6)
  if (threeYearObs) {
    const threeYearObservations = observations.filter(
      (o) => new Date(o.date) >= threeYearsAgo
    )
    trends.last3Years = calculateTrend(
      threeYearObs.value,
      latest.value,
      threeYearObs.date,
      latest.date,
      threeYearObservations
    )
  }

  // Last 5 years (if data available)
  const fiveYearsAgo = new Date(now)
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
  const fiveYearObs = findObservationNearDate(observations, fiveYearsAgo, 6)
  if (fiveYearObs) {
    trends.last5Years = calculateTrend(
      fiveYearObs.value,
      latest.value,
      fiveYearObs.date,
      latest.date,
      observations
    )
  }

  // Generate forecast
  const forecast = generateForecast(trends, observations)

  // Determine location level
  let level: "metro" | "state" | "national" = "national"
  if (city) level = "metro"
  else if (state) level = "state"

  const analysis: HistoricalAnalysis = {
    location: { city, state, level },
    currentValue: latest.value,
    trends,
    seasonalPatterns: SEASONAL_PATTERNS,
    forecast,
    hpiData,
    analyzedAt: new Date().toISOString(),
  }

  logger.info("Historical analysis complete", {
    location: `${city || ""} ${state || "National"}`.trim(),
    yearlyChange: `${(trends.lastYear.changePercent * 100).toFixed(1)}%`,
    forecast: `${(forecast.predictedChange * 100).toFixed(1)}%`,
  })

  return analysis
}

/**
 * Generate market forecast based on trends
 */
function generateForecast(
  trends: HistoricalAnalysis["trends"],
  observations: HPIDataPoint[]
): MarketForecast {
  // Simple momentum-based forecast
  // In production, this could use more sophisticated ML models

  const recentTrend = trends.lastQuarter.changeAnnualized
  const yearTrend = trends.lastYear.changeAnnualized
  const longTermTrend = trends.last3Years?.changeAnnualized || yearTrend

  // Weight recent trends more heavily
  const weightedTrend =
    recentTrend * 0.4 + yearTrend * 0.35 + longTermTrend * 0.25

  // Mean reversion adjustment (pull toward historical average of ~4%)
  const historicalAvg = 0.04
  const meanReversionFactor = 0.2
  const predictedChange =
    weightedTrend * (1 - meanReversionFactor) +
    historicalAvg * meanReversionFactor

  // Calculate confidence interval based on volatility
  const volatility = trends.lastYear.volatility || 0.02
  const annualVolatility = volatility * Math.sqrt(12) // Annualized
  const confidenceFactor = 1.5 // ~85% confidence

  const factors: string[] = []
  if (trends.lastQuarter.direction === "up") {
    factors.push("Recent upward momentum")
  } else if (trends.lastQuarter.direction === "down") {
    factors.push("Recent price softening")
  }
  if (volatility > 0.02) {
    factors.push("Elevated market volatility")
  }
  factors.push("Historical mean reversion tendency")

  // Determine confidence
  let confidence: "high" | "medium" | "low" = "medium"
  if (observations.length >= 36 && volatility < 0.015) {
    confidence = "high"
  } else if (observations.length < 12 || volatility > 0.03) {
    confidence = "low"
  }

  return {
    horizon: "12 months",
    predictedChange: Math.round(predictedChange * 1000) / 1000,
    confidenceInterval: {
      low: Math.round((predictedChange - annualVolatility * confidenceFactor) * 1000) / 1000,
      high: Math.round((predictedChange + annualVolatility * confidenceFactor) * 1000) / 1000,
    },
    methodology: "Momentum + Mean Reversion Model",
    factors,
    confidence,
  }
}

/**
 * Create default trend when data unavailable
 */
function createDefaultTrend(period: string): MarketTrend {
  return {
    period,
    startDate: "",
    endDate: "",
    startValue: 0,
    endValue: 0,
    changePercent: 0,
    changeAnnualized: 0,
    direction: "flat",
    volatility: 0,
    confidence: "low",
  }
}

/**
 * Create default analysis when data unavailable
 */
function createDefaultAnalysis(
  city?: string,
  state?: string
): HistoricalAnalysis {
  return {
    location: { city, state, level: city ? "metro" : state ? "state" : "national" },
    currentValue: 100, // Index baseline
    trends: {
      lastMonth: createDefaultTrend("Last month"),
      lastQuarter: createDefaultTrend("Last quarter"),
      lastYear: createDefaultTrend("Last year"),
    },
    seasonalPatterns: SEASONAL_PATTERNS,
    forecast: {
      horizon: "12 months",
      predictedChange: 0.04, // Historical average
      confidenceInterval: { low: 0, high: 0.08 },
      methodology: "Historical Average (insufficient data)",
      factors: ["Insufficient data for location-specific forecast"],
      confidence: "low",
    },
    analyzedAt: new Date().toISOString(),
  }
}

// ============================================================================
// Property History Analysis
// ============================================================================

/**
 * Analyze price history for a specific property
 */
export async function analyzePropertyHistory(
  address: string,
  priceHistory: PriceHistory[],
  city?: string,
  state?: string
): Promise<PropertyHistoryAnalysis> {
  if (priceHistory.length < 2) {
    return {
      address,
      history: priceHistory,
      appreciation: {
        totalChange: 0,
        annualizedChange: 0,
        periodYears: 0,
      },
      comparedToMarket: {
        outperformed: false,
        differencePercent: 0,
        marketChange: 0,
      },
    }
  }

  // Sort by date
  const sorted = [...priceHistory].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const firstPrice = sorted[0].price
  const lastPrice = sorted[sorted.length - 1].price
  const totalChange = (lastPrice - firstPrice) / firstPrice

  // Calculate years between first and last
  const firstDate = new Date(sorted[0].date)
  const lastDate = new Date(sorted[sorted.length - 1].date)
  const periodYears =
    (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)

  const annualizedChange =
    periodYears > 0 ? Math.pow(1 + totalChange, 1 / periodYears) - 1 : 0

  // Compare to market
  let marketChange = 0.04 * periodYears // Default 4% annual
  try {
    const marketAnalysis = await analyzeHistoricalTrends(
      city,
      state,
      Math.ceil(periodYears * 12)
    )
    if (marketAnalysis.trends.last5Years) {
      marketChange = marketAnalysis.trends.last5Years.changePercent
    } else if (marketAnalysis.trends.last3Years) {
      marketChange = marketAnalysis.trends.last3Years.changePercent
    } else {
      marketChange = marketAnalysis.trends.lastYear.changeAnnualized * periodYears
    }
  } catch {
    // Keep default
  }

  const differencePercent = totalChange - marketChange
  const outperformed = differencePercent > 0

  return {
    address,
    history: sorted,
    appreciation: {
      totalChange: Math.round(totalChange * 1000) / 1000,
      annualizedChange: Math.round(annualizedChange * 1000) / 1000,
      periodYears: Math.round(periodYears * 10) / 10,
    },
    comparedToMarket: {
      outperformed,
      differencePercent: Math.round(differencePercent * 1000) / 1000,
      marketChange: Math.round(marketChange * 1000) / 1000,
    },
  }
}

/**
 * Format historical analysis for display
 */
export function formatHistoricalAnalysis(
  analysis: HistoricalAnalysis
): string {
  const lines: string[] = [
    "### Market Historical Analysis",
    "",
    `**Location:** ${analysis.location.city || ""} ${analysis.location.state || "National"}`.trim(),
    `**Analysis Level:** ${analysis.location.level.charAt(0).toUpperCase() + analysis.location.level.slice(1)}`,
    "",
    "**Price Trends:**",
  ]

  const formatTrend = (label: string, trend: MarketTrend) => {
    const sign = trend.changePercent >= 0 ? "+" : ""
    return `- ${label}: ${sign}${(trend.changePercent * 100).toFixed(2)}% (${trend.direction})`
  }

  lines.push(formatTrend("Last Month", analysis.trends.lastMonth))
  lines.push(formatTrend("Last Quarter", analysis.trends.lastQuarter))
  lines.push(formatTrend("Last Year", analysis.trends.lastYear))

  if (analysis.trends.last3Years) {
    lines.push(formatTrend("Last 3 Years", analysis.trends.last3Years))
  }
  if (analysis.trends.last5Years) {
    lines.push(formatTrend("Last 5 Years", analysis.trends.last5Years))
  }

  lines.push("")
  lines.push("**12-Month Forecast:**")
  const forecastSign = analysis.forecast.predictedChange >= 0 ? "+" : ""
  lines.push(
    `- Predicted Change: ${forecastSign}${(analysis.forecast.predictedChange * 100).toFixed(1)}%`
  )
  lines.push(
    `- Range: ${(analysis.forecast.confidenceInterval.low * 100).toFixed(1)}% to ${(analysis.forecast.confidenceInterval.high * 100).toFixed(1)}%`
  )
  lines.push(`- Confidence: ${analysis.forecast.confidence}`)

  lines.push("")
  lines.push("**Current Seasonal Factor:**")
  const currentMonth = new Date().getMonth() + 1
  const seasonalPattern = analysis.seasonalPatterns.find(
    (p) => p.month === currentMonth
  )
  if (seasonalPattern) {
    lines.push(`- ${seasonalPattern.monthName}: ${seasonalPattern.description}`)
    lines.push(`- Transaction Volume: ${seasonalPattern.transactionVolume}`)
  }

  return lines.join("\n")
}
