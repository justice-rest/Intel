/**
 * AVM (Automated Valuation Model) Module Index
 *
 * Enterprise-grade property valuation system with:
 *
 * Core Valuation:
 * - Hedonic Pricing Model (log-linear regression)
 * - Comparable Sales Approach (adjusted comps)
 * - Online Estimate Aggregation (Zillow, Redfin, County)
 * - Ensemble Model (weighted combination)
 *
 * Enhanced Features:
 * - Market appreciation adjustments (FRED HPI)
 * - Location factors (schools, walkability)
 * - Property type support (single-family, condo, townhouse)
 * - Rental valuation and investment analysis
 * - Historical trend analysis and forecasting
 *
 * Infrastructure:
 * - Circuit breaker pattern for API resilience
 * - Structured logging with request tracing
 * - Dual-layer caching (Supabase + memory)
 * - Comprehensive confidence scoring
 */

// ============================================================================
// Core Valuation Models
// ============================================================================

export {
  calculateHedonicValue,
  explainHedonicResult,
  calculateMarginalValueSqft,
  calculateMarginalValueBedroom,
  calculateMarginalValueBathroom,
  type HedonicResult,
  type HedonicComponents,
} from "./hedonic-model"

export {
  calculateCompValue,
  calculateSimilarityScore,
  formatAdjustmentGrid,
  explainCompSalesResult,
  getCompStatistics,
  type CompSalesResult,
} from "./comparable-sales"

export {
  calculateEnsembleValue,
  calculateEnsembleValueSync,
} from "./ensemble"

export {
  calculateConfidence,
  calculateValueRange,
} from "./confidence-score"

// ============================================================================
// Enhanced Valuation
// ============================================================================

export {
  calculateEnhancedHedonicValue,
  formatEnhancedHedonicResult,
  type EnhancedHedonicResult,
  type EnhancedHedonicInput,
} from "./enhanced-hedonic"

export {
  calculateEnhancedCompValue,
  calculateHaversineDistance,
  formatEnhancedCompResult,
  type EnhancedCompSalesResult,
  type EnhancedAdjustedComparable,
  type EnhancedCompInput,
  type GeoPoint,
  type CompStatistics,
} from "./enhanced-comparable-sales"

// ============================================================================
// Market Data
// ============================================================================

export {
  getAppreciationRate,
  adjustForAppreciation,
  getHistoricalHPI,
  clearHPICache,
  isFredHPIEnabled,
  type AppreciationRate,
  type HPIResult,
  type HPIDataPoint,
} from "./fred-hpi"

export {
  getLocationFactors,
  calculateLocationMultiplier,
  clearLocationCache,
  getLocationAPIStatus,
  type LocationFactors,
  type SchoolData,
  type SchoolRating,
  type WalkabilityScores,
  type GeoCoordinates,
} from "./location-data"

export {
  analyzeHistoricalTrends,
  analyzePropertyHistory,
  formatHistoricalAnalysis,
  type HistoricalAnalysis,
  type MarketTrend,
  type SeasonalPattern,
  type MarketForecast,
  type PriceHistory,
  type PropertyHistoryAnalysis,
} from "./historical-trends"

// ============================================================================
// Rental & Investment
// ============================================================================

export {
  estimateRentalValue,
  analyzeInvestment,
  calculateQuickMetrics,
  formatInvestmentAnalysis,
  type RentalEstimate,
  type RentComparable,
  type InvestmentAnalysis,
  type InvestmentAssumptions,
  type MonthlyExpenses,
} from "./rental-valuation"

// ============================================================================
// Infrastructure
// ============================================================================

export {
  CircuitBreaker,
  CircuitBreakerError,
  circuitBreakers,
  withCircuitBreaker,
  withCircuitBreakerAndFallback,
  isServiceAvailable,
  getCircuitBreakerSummary,
  CIRCUIT_CONFIGS,
  type CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerState,
  type CircuitBreakerMetrics,
} from "./circuit-breaker"

export {
  createLogger,
  createTracedLogger,
  traceManager,
  loggers,
  withLogging,
  formatMetrics,
  generateId,
  type LogLevel,
  type LogContext,
  type StructuredLog,
  type ValuationMetrics,
  type RequestTrace,
  type TraceStep,
} from "./logger"

// ============================================================================
// Configuration & Types
// ============================================================================

export {
  NATIONAL_HEDONIC_COEFFICIENTS,
  MODEL_WEIGHTS,
  MIN_MODEL_WEIGHTS,
  CONFIDENCE_THRESHOLDS,
  FSD_THRESHOLDS,
  COMP_CONFIG,
  COMP_SIMILARITY_WEIGHTS,
  VALIDATION_RANGES,
  MAX_ADJUSTMENT_PERCENT,
  AVM_TIMEOUT_MS,
  COEFFICIENT_LOOKUP_TIMEOUT_MS,
  formatCurrency,
  formatCurrencyShort,
  formatPercent,
  formatDate,
  isAVMEnabled,
} from "./config"

// Note: Database-backed coefficients removed - using national defaults from config.ts

export type {
  PropertyType,
  PropertyCondition,
  PropertyCharacteristics,
  SaleType,
  ComparableSale,
  AdjustedComparable,
  EstimateSource,
  OnlineEstimate,
  MarketAreaType,
  HedonicCoefficients,
  HedonicCoefficientsRow,
  ConfidenceLevel,
  ConfidenceResult,
  AVMResult,
  PropertyValuationInput,
  EnsembleInput,
  ModelResult,
  ParsedAddress,
  LocationLookup,
} from "./types"

// ============================================================================
// Utility Functions
// ============================================================================

import { getCircuitBreakerSummary } from "./circuit-breaker"
import { isFredHPIEnabled, clearHPICache } from "./fred-hpi"
import { getLocationAPIStatus, clearLocationCache } from "./location-data"

/**
 * Get AVM system status and capabilities
 * All location features have FREE fallbacks - no paid API keys required
 */
export function getAVMStatus(): {
  enabled: boolean
  features: {
    hedonic: boolean
    comparables: boolean
    onlineEstimates: boolean
    appreciation: boolean
    location: boolean
    rental: boolean
    investment: boolean
    trends: boolean
  }
  apis: {
    fred: boolean
    schoolDigger: boolean
    walkScore: boolean
    freeFallbacks: {
      ncesStateAverages: boolean
      osmSchoolDensity: boolean
      osmWalkability: boolean
    }
  }
  circuitBreakers: {
    total: number
    healthy: number
    degraded: number
  }
} {
  const cbSummary = getCircuitBreakerSummary()
  const locationStatus = getLocationAPIStatus()

  return {
    enabled: true,
    features: {
      hedonic: true,
      comparables: true,
      onlineEstimates: true,
      appreciation: isFredHPIEnabled(),
      location: true, // Always true - has FREE fallbacks
      rental: true,
      investment: true,
      trends: true,
    },
    apis: {
      fred: isFredHPIEnabled(),
      schoolDigger: locationStatus.schoolDigger,
      walkScore: locationStatus.walkScore,
      // FREE fallbacks - always available, no API key required
      freeFallbacks: {
        ncesStateAverages: locationStatus.ncesStateFallback,
        osmSchoolDensity: locationStatus.osmSchoolFallback,
        osmWalkability: locationStatus.osmWalkabilityFallback,
      },
    },
    circuitBreakers: {
      total: cbSummary.total,
      healthy: cbSummary.closed,
      degraded: cbSummary.open + cbSummary.halfOpen,
    },
  }
}

/**
 * Clear all AVM caches
 */
export function clearAllCaches(): void {
  clearHPICache()
  clearLocationCache()
  console.log("[AVM] All caches cleared")
}
