/**
 * AVM (Automated Valuation Model) Type Definitions
 *
 * This module defines TypeScript interfaces for:
 * - Property characteristics
 * - Comparable sales
 * - Online estimates
 * - Hedonic coefficients (from database)
 * - AVM results
 */

// ============================================================================
// Property Types
// ============================================================================

/**
 * Property type classification
 */
export type PropertyType =
  | "single_family"
  | "condo"
  | "townhouse"
  | "multi_family"
  | "manufactured"
  | "land"

/**
 * Property condition assessment
 */
export type PropertyCondition =
  | "excellent"
  | "good"
  | "average"
  | "fair"
  | "poor"

/**
 * Property characteristics for valuation
 */
export interface PropertyCharacteristics {
  // Address components
  address: string
  streetNumber?: string
  streetName?: string
  unit?: string
  city?: string
  state?: string
  zipCode?: string
  county?: string

  // Physical characteristics (continuous)
  squareFeet?: number
  lotSizeSqFt?: number
  bedrooms?: number
  bathrooms?: number // Full + 0.5×half baths
  halfBaths?: number
  yearBuilt?: number
  stories?: number
  garageSpaces?: number

  // Physical characteristics (binary features)
  hasPool?: boolean
  hasBasement?: boolean
  basementSqFt?: number
  hasFireplace?: boolean
  centralAir?: boolean

  // Property classification
  propertyType?: PropertyType
  condition?: PropertyCondition

  // Location features (for enhanced models)
  latitude?: number
  longitude?: number
  schoolScore?: number // 1-10 rating
  crimeScore?: number // Lower is better
  walkScore?: number // 0-100
  transitScore?: number // 0-100
}

// ============================================================================
// Comparable Sales Types
// ============================================================================

/**
 * Sale transaction type
 */
export type SaleType =
  | "arms_length"
  | "foreclosure"
  | "reo"
  | "short_sale"
  | "auction"

/**
 * Comparable sale record
 */
export interface ComparableSale {
  // Property identification
  address: string
  city?: string
  state?: string
  zipCode?: string

  // Sale information
  salePrice: number
  saleDate: string // ISO date string
  listingPrice?: number
  daysOnMarket?: number

  // Transaction details
  saleType?: SaleType

  // Property characteristics (for adjustment)
  squareFeet?: number
  lotSizeSqFt?: number
  bedrooms?: number
  bathrooms?: number
  yearBuilt?: number
  garageSpaces?: number
  hasPool?: boolean

  // Similarity metrics
  distanceMiles?: number
  similarityScore?: number

  // Source tracking
  source: string
  sourceUrl: string
  mlsNumber?: string
}

/**
 * Adjusted comparable with adjustment details
 */
export interface AdjustedComparable {
  comp: ComparableSale
  originalPrice: number
  adjustedPrice: number
  totalAdjustment: number
  adjustments: {
    sqft?: number
    bedrooms?: number
    bathrooms?: number
    age?: number
    garage?: number
    pool?: number
    [key: string]: number | undefined
  }
  weight: number
}

// ============================================================================
// Online Estimate Types
// ============================================================================

/**
 * Source of online estimate
 */
export type EstimateSource =
  | "zillow"
  | "redfin"
  | "realtor"
  | "county"
  | "other"

/**
 * Online property value estimate
 */
export interface OnlineEstimate {
  source: EstimateSource
  value: number
  valueRange?: {
    low: number
    high: number
  }
  lastUpdated?: string
  sourceUrl: string
}

// ============================================================================
// Hedonic Coefficient Types (Database)
// ============================================================================

/**
 * Market area type for coefficient lookup hierarchy
 */
export type MarketAreaType =
  | "zip"
  | "city"
  | "county"
  | "msa"
  | "state"
  | "national"

/**
 * Hedonic coefficients from database
 * Matches the hedonic_coefficients table schema
 */
export interface HedonicCoefficients {
  id?: string
  marketArea: string
  marketAreaType: MarketAreaType
  stateCode?: string

  // Model coefficients (log-linear)
  intercept: number
  lnSqftCoef: number
  lnLotSizeCoef: number
  bedroomCoef: number
  bathroomCoef: number
  ageCoef: number
  garageCoef: number
  poolCoef: number
  basementCoef: number
  fireplaceCoef: number

  // Comparable sales adjustment factors (dollars)
  adjSqftPer100: number
  adjBedroom: number
  adjBathroom: number
  adjAgePerYear: number
  adjGarage: number
  adjPool: number

  // Model statistics
  rSquared?: number
  sampleSize?: number
  medianPrice?: number
  coefficientOfVariation?: number

  // Validity
  effectiveDate?: string
  expiryDate?: string
  isActive?: boolean

  // Metadata
  dataSource?: string
}

/**
 * Database row type for hedonic_coefficients table
 * Uses snake_case to match SQL schema
 */
export interface HedonicCoefficientsRow {
  id: string
  market_area: string
  market_area_type: string
  state_code: string | null
  intercept: number
  ln_sqft_coef: number
  ln_lot_size_coef: number
  bedroom_coef: number
  bathroom_coef: number
  age_coef: number
  garage_coef: number
  pool_coef: number
  basement_coef: number
  fireplace_coef: number
  adj_sqft_per_100: number
  adj_bedroom: number
  adj_bathroom: number
  adj_age_per_year: number
  adj_garage: number
  adj_pool: number
  r_squared: number | null
  sample_size: number | null
  median_price: number | null
  coefficient_of_variation: number | null
  effective_date: string
  expiry_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  data_source: string | null
}

// ============================================================================
// Confidence Score Types
// ============================================================================

/**
 * Confidence level classification
 * Based on Freddie Mac HVE standards
 */
export type ConfidenceLevel = "high" | "medium" | "low"

/**
 * Confidence score result with factors
 */
export interface ConfidenceResult {
  score: number // 0-100
  level: ConfidenceLevel
  fsd: number // Forecast Standard Deviation (0-1)
  factors: {
    dataCompleteness: number // 0-1
    compCount: number // 0-1 normalized
    estimateAgreement: number // Coefficient of variation
    compRecency: number // Average days since sale
  }
}

// ============================================================================
// AVM Result Types
// ============================================================================

/**
 * Complete AVM valuation result
 */
export interface AVMResult {
  // Property identification
  address: string

  // Primary valuation
  estimatedValue: number
  valueLow: number
  valueHigh: number
  pricePerSqFt?: number

  // Confidence metrics
  confidenceScore: number // 0-100
  confidenceLevel: ConfidenceLevel
  fsd: number // Forecast Standard Deviation (0-1)

  // Component values
  hedonicValue?: number
  compAdjustedValue?: number
  onlineEstimateAvg?: number

  // Model weights used
  hedonicWeight: number
  compWeight: number
  onlineWeight: number

  // Coefficients used
  coefficientsSource?: string // market area that provided coefficients

  // Supporting data counts
  comparablesUsed: number
  estimateSources: string[]

  // Output for AI consumption
  rawContent: string

  // Sources for UI display
  sources: Array<{ name: string; url: string }>

  // Error information (if any)
  error?: string
}

// ============================================================================
// Input Types for Tools
// ============================================================================

/**
 * Input parameters for property valuation tool
 */
export interface PropertyValuationInput {
  address: string
  city?: string
  state?: string
  zipCode?: string

  // Property characteristics
  squareFeet?: number
  lotSizeSqFt?: number
  bedrooms?: number
  bathrooms?: number
  yearBuilt?: number
  garageSpaces?: number
  hasPool?: boolean
  hasBasement?: boolean
  hasFireplace?: boolean

  // Online estimates (from search results)
  onlineEstimates?: Array<{
    source: EstimateSource
    value: number
    sourceUrl?: string
  }>

  // Comparable sales (from search results)
  comparableSales?: Array<{
    address: string
    salePrice: number
    saleDate: string
    squareFeet?: number
    bedrooms?: number
    bathrooms?: number
    yearBuilt?: number
    distanceMiles?: number
    source?: string
    sourceUrl?: string
  }>
}

// ============================================================================
// Ensemble Model Types
// ============================================================================

/**
 * Input for ensemble calculation
 */
export interface EnsembleInput {
  property: Partial<PropertyCharacteristics>
  comparables: ComparableSale[]
  onlineEstimates: OnlineEstimate[]
  coefficients?: HedonicCoefficients
}

/**
 * Individual model result for ensemble
 */
export interface ModelResult {
  value: number | null
  confidence: number // 0-1, how confident is this model
  name: string
  weight: number // Final normalized weight
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Address parsing result
 */
export interface ParsedAddress {
  streetNumber?: string
  streetName?: string
  unit?: string
  city?: string
  state?: string
  zipCode?: string
  county?: string
  fullAddress: string
}

/**
 * Location lookup result for coefficient retrieval
 */
export interface LocationLookup {
  zipCode?: string
  city?: string
  county?: string
  state?: string
}
