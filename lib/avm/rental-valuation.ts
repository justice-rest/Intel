/**
 * Rental Valuation & Investment Analysis Module
 *
 * Provides:
 * - Rental value estimation (monthly rent)
 * - Gross Rent Multiplier (GRM) analysis
 * - Cap Rate calculations
 * - Cash flow projections
 * - ROI analysis
 *
 * Key Metrics:
 * - GRM (Gross Rent Multiplier) = Property Price / Annual Rent
 *   - Lower GRM = Better investment (faster payback)
 *   - Typical: 10-15 for residential
 *
 * - Cap Rate = NOI / Property Price
 *   - Higher = Better returns
 *   - Typical: 4-10% for residential
 *
 * - Cash-on-Cash Return = Annual Cash Flow / Cash Invested
 */

import type { PropertyCharacteristics } from "./types"
import { getAppreciationRate } from "./fred-hpi"
import { createLogger } from "./logger"

const logger = createLogger("rental-valuation")

// ============================================================================
// Types
// ============================================================================

export interface RentalEstimate {
  monthlyRent: number
  rentRange: { low: number; high: number }
  annualRent: number
  rentPerSqFt: number // Monthly rent per sqft
  estimationMethod: string
  confidence: "high" | "medium" | "low"
  comparableRents?: RentComparable[]
}

export interface RentComparable {
  address?: string
  monthlyRent: number
  squareFeet?: number
  bedrooms?: number
  bathrooms?: number
  rentPerSqFt?: number
  source: string
}

export interface InvestmentAnalysis {
  // Property basics
  propertyValue: number
  estimatedRent: number

  // Key ratios
  grossRentMultiplier: number // Price / Annual Rent
  capRate: number // NOI / Price (as decimal)
  cashOnCashReturn: number // Annual cash flow / Cash invested

  // Monthly breakdown
  monthlyIncome: number
  monthlyExpenses: MonthlyExpenses
  monthlyCashFlow: number

  // Annual projections
  annualIncome: number
  annualExpenses: number
  annualCashFlow: number
  netOperatingIncome: number // Before debt service

  // Investment metrics
  breakEvenMonths: number
  roi1Year: number
  roi5Year: number
  totalCashRequired: number

  // Assumptions used
  assumptions: InvestmentAssumptions
}

export interface MonthlyExpenses {
  propertyTax: number
  insurance: number
  maintenance: number
  propertyManagement: number
  vacancy: number // Allowance for vacancy
  hoa: number
  utilities: number // If landlord pays
  mortgage: number // Principal + Interest
  total: number
}

export interface InvestmentAssumptions {
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
  propertyTaxRate: number
  insuranceRate: number
  maintenancePercent: number
  managementPercent: number
  vacancyRate: number
  appreciationRate: number
  rentGrowthRate: number
  closingCostsPercent: number
}

export interface PropertyTypeRentFactors {
  baseRentPerSqFt: number
  bedroomPremium: number
  bathroomPremium: number
  poolPremium: number
  garagePremium: number
  yearBuiltFactor: number
  condoDiscount: number
}

// ============================================================================
// Configuration
// ============================================================================

// National average rent factors by market tier
// These are calibrated to produce realistic rent estimates
const RENT_FACTORS: Record<string, PropertyTypeRentFactors> = {
  // Tier 1 markets (NYC, SF, LA, etc.)
  tier1: {
    baseRentPerSqFt: 3.5, // $3.50/sqft base
    bedroomPremium: 0.08, // +8% per bedroom
    bathroomPremium: 0.05, // +5% per additional bath
    poolPremium: 0.1, // +10% for pool
    garagePremium: 0.05, // +5% per garage space
    yearBuiltFactor: 0.002, // -0.2% per year of age
    condoDiscount: -0.05, // -5% for condos
  },
  // Tier 2 markets (Austin, Denver, Seattle, etc.)
  tier2: {
    baseRentPerSqFt: 2.0,
    bedroomPremium: 0.07,
    bathroomPremium: 0.04,
    poolPremium: 0.08,
    garagePremium: 0.04,
    yearBuiltFactor: 0.0015,
    condoDiscount: -0.04,
  },
  // Tier 3 and default
  default: {
    baseRentPerSqFt: 1.2,
    bedroomPremium: 0.06,
    bathroomPremium: 0.03,
    poolPremium: 0.06,
    garagePremium: 0.03,
    yearBuiltFactor: 0.001,
    condoDiscount: -0.03,
  },
}

// Tier 1 cities
const TIER1_CITIES = new Set([
  "new york",
  "san francisco",
  "los angeles",
  "boston",
  "washington",
  "seattle",
  "san jose",
  "san diego",
])

// Tier 2 cities
const TIER2_CITIES = new Set([
  "austin",
  "denver",
  "portland",
  "miami",
  "atlanta",
  "chicago",
  "dallas",
  "houston",
  "phoenix",
  "raleigh",
  "nashville",
  "charlotte",
  "tampa",
  "orlando",
  "minneapolis",
])

// Default investment assumptions
const DEFAULT_ASSUMPTIONS: InvestmentAssumptions = {
  downPaymentPercent: 0.2, // 20% down
  interestRate: 0.07, // 7% interest rate
  loanTermYears: 30,
  propertyTaxRate: 0.012, // 1.2% of property value
  insuranceRate: 0.005, // 0.5% of property value
  maintenancePercent: 0.01, // 1% of property value annually
  managementPercent: 0.08, // 8% of rent for property management
  vacancyRate: 0.05, // 5% vacancy allowance
  appreciationRate: 0.04, // 4% annual appreciation
  rentGrowthRate: 0.03, // 3% annual rent growth
  closingCostsPercent: 0.03, // 3% closing costs
}

// ============================================================================
// Rent Estimation
// ============================================================================

/**
 * Get rent factors for a location
 */
function getRentFactors(city?: string): PropertyTypeRentFactors {
  if (!city) return RENT_FACTORS.default

  const cityLower = city.toLowerCase().trim()

  if (TIER1_CITIES.has(cityLower)) {
    return RENT_FACTORS.tier1
  }

  if (TIER2_CITIES.has(cityLower)) {
    return RENT_FACTORS.tier2
  }

  return RENT_FACTORS.default
}

/**
 * Estimate rental value for a property
 */
export async function estimateRentalValue(
  property: Partial<PropertyCharacteristics>,
  options: {
    comparableRents?: RentComparable[]
    marketRentPerSqFt?: number // Override if known
  } = {}
): Promise<RentalEstimate> {
  const { comparableRents, marketRentPerSqFt } = options

  logger.info("Estimating rental value", { address: property.address })

  // If we have comparable rents, use them
  if (comparableRents && comparableRents.length >= 3) {
    return estimateFromComparables(property, comparableRents)
  }

  // Otherwise use hedonic-style estimation
  const factors = getRentFactors(property.city)
  const sqft = property.squareFeet || 1500 // Default if unknown

  // Base rent
  const baseRentPerSqFt = marketRentPerSqFt || factors.baseRentPerSqFt
  let multiplier = 1.0

  // Bedroom adjustment
  const bedrooms = property.bedrooms || 3
  multiplier += factors.bedroomPremium * Math.max(0, bedrooms - 2) // Adjust from 2BR baseline

  // Bathroom adjustment
  const bathrooms = property.bathrooms || 2
  multiplier += factors.bathroomPremium * Math.max(0, bathrooms - 1.5) // Adjust from 1.5BA baseline

  // Pool premium
  if (property.hasPool) {
    multiplier += factors.poolPremium
  }

  // Garage premium
  if (property.garageSpaces) {
    multiplier += factors.garagePremium * property.garageSpaces
  }

  // Age adjustment
  if (property.yearBuilt) {
    const age = new Date().getFullYear() - property.yearBuilt
    multiplier -= factors.yearBuiltFactor * age
  }

  // Property type adjustment
  if (property.propertyType === "condo") {
    multiplier += factors.condoDiscount
  }

  // Calculate monthly rent
  const effectiveRentPerSqFt = baseRentPerSqFt * multiplier
  const monthlyRent = Math.round(sqft * effectiveRentPerSqFt)

  // Calculate range (±15%)
  const rentLow = Math.round(monthlyRent * 0.85)
  const rentHigh = Math.round(monthlyRent * 1.15)

  // Determine confidence
  let confidence: "high" | "medium" | "low" = "medium"
  if (property.squareFeet && property.bedrooms !== undefined) {
    confidence = "high"
  } else if (!property.squareFeet) {
    confidence = "low"
  }

  const result: RentalEstimate = {
    monthlyRent,
    rentRange: { low: rentLow, high: rentHigh },
    annualRent: monthlyRent * 12,
    rentPerSqFt: Math.round(effectiveRentPerSqFt * 100) / 100,
    estimationMethod: "Hedonic Model",
    confidence,
  }

  logger.info("Rental estimate calculated", {
    address: property.address,
    monthlyRent: result.monthlyRent,
    confidence: result.confidence,
  })

  return result
}

/**
 * Estimate rent from comparable rentals
 */
function estimateFromComparables(
  property: Partial<PropertyCharacteristics>,
  comparables: RentComparable[]
): RentalEstimate {
  // Calculate rent per sqft from comparables
  const rentsPerSqFt = comparables
    .filter((c) => c.squareFeet && c.squareFeet > 0)
    .map((c) => c.monthlyRent / c.squareFeet!)

  if (rentsPerSqFt.length === 0) {
    // Fall back to average rent if no sqft data
    const avgRent =
      comparables.reduce((sum, c) => sum + c.monthlyRent, 0) / comparables.length

    return {
      monthlyRent: Math.round(avgRent),
      rentRange: {
        low: Math.round(avgRent * 0.9),
        high: Math.round(avgRent * 1.1),
      },
      annualRent: Math.round(avgRent * 12),
      rentPerSqFt: property.squareFeet
        ? Math.round((avgRent / property.squareFeet) * 100) / 100
        : 0,
      estimationMethod: "Comparable Rentals (Average)",
      confidence: "medium",
      comparableRents: comparables,
    }
  }

  // Calculate median rent per sqft
  const sorted = rentsPerSqFt.sort((a, b) => a - b)
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]

  const sqft = property.squareFeet || 1500
  const monthlyRent = Math.round(sqft * median)

  // Adjust for bedrooms/bathrooms if we can
  let adjustment = 0
  const compBeds = comparables.filter((c) => c.bedrooms !== undefined)
  if (compBeds.length > 0 && property.bedrooms !== undefined) {
    const avgCompBeds =
      compBeds.reduce((sum, c) => sum + c.bedrooms!, 0) / compBeds.length
    const bedDiff = property.bedrooms - avgCompBeds
    adjustment += bedDiff * 0.05 * monthlyRent // 5% per bedroom difference
  }

  const adjustedRent = Math.round(monthlyRent + adjustment)

  return {
    monthlyRent: adjustedRent,
    rentRange: {
      low: Math.round(adjustedRent * 0.9),
      high: Math.round(adjustedRent * 1.1),
    },
    annualRent: adjustedRent * 12,
    rentPerSqFt: Math.round(median * 100) / 100,
    estimationMethod: "Comparable Rentals",
    confidence: comparables.length >= 5 ? "high" : "medium",
    comparableRents: comparables,
  }
}

// ============================================================================
// Investment Analysis
// ============================================================================

/**
 * Calculate monthly mortgage payment
 * Uses standard amortization formula
 */
function calculateMortgagePayment(
  principal: number,
  annualRate: number,
  termYears: number
): number {
  if (principal <= 0 || annualRate <= 0) return 0

  const monthlyRate = annualRate / 12
  const numPayments = termYears * 12

  const payment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)

  return Math.round(payment)
}

/**
 * Perform comprehensive investment analysis
 */
export async function analyzeInvestment(
  propertyValue: number,
  estimatedMonthlyRent: number,
  options: {
    monthlyHoa?: number
    assumptions?: Partial<InvestmentAssumptions>
    city?: string
    state?: string
  } = {}
): Promise<InvestmentAnalysis> {
  const assumptions: InvestmentAssumptions = {
    ...DEFAULT_ASSUMPTIONS,
    ...options.assumptions,
  }

  logger.info("Analyzing investment", {
    propertyValue,
    estimatedMonthlyRent,
  })

  // Try to get location-specific appreciation rate
  try {
    const appreciationData = await getAppreciationRate(
      options.city,
      options.state
    )
    if (appreciationData.confidence !== "low") {
      assumptions.appreciationRate = appreciationData.annualized
    }
  } catch {
    // Keep default appreciation rate
  }

  // Calculate loan details
  const downPayment = propertyValue * assumptions.downPaymentPercent
  const loanAmount = propertyValue - downPayment
  const closingCosts = propertyValue * assumptions.closingCostsPercent
  const totalCashRequired = downPayment + closingCosts

  // Monthly mortgage payment
  const monthlyMortgage = calculateMortgagePayment(
    loanAmount,
    assumptions.interestRate,
    assumptions.loanTermYears
  )

  // Monthly expenses
  const monthlyPropertyTax =
    (propertyValue * assumptions.propertyTaxRate) / 12
  const monthlyInsurance = (propertyValue * assumptions.insuranceRate) / 12
  const monthlyMaintenance =
    (propertyValue * assumptions.maintenancePercent) / 12
  const monthlyManagement =
    estimatedMonthlyRent * assumptions.managementPercent
  const monthlyVacancy = estimatedMonthlyRent * assumptions.vacancyRate
  const monthlyHoa = options.monthlyHoa || 0

  const monthlyExpenses: MonthlyExpenses = {
    propertyTax: Math.round(monthlyPropertyTax),
    insurance: Math.round(monthlyInsurance),
    maintenance: Math.round(monthlyMaintenance),
    propertyManagement: Math.round(monthlyManagement),
    vacancy: Math.round(monthlyVacancy),
    hoa: monthlyHoa,
    utilities: 0, // Assuming tenant pays
    mortgage: monthlyMortgage,
    total: 0, // Calculated below
  }

  monthlyExpenses.total =
    monthlyExpenses.propertyTax +
    monthlyExpenses.insurance +
    monthlyExpenses.maintenance +
    monthlyExpenses.propertyManagement +
    monthlyExpenses.vacancy +
    monthlyExpenses.hoa +
    monthlyExpenses.utilities +
    monthlyExpenses.mortgage

  // Cash flow
  const monthlyIncome = estimatedMonthlyRent
  const monthlyCashFlow = monthlyIncome - monthlyExpenses.total

  // Annual figures
  const annualIncome = monthlyIncome * 12
  const annualExpenses = monthlyExpenses.total * 12
  const annualCashFlow = monthlyCashFlow * 12

  // NOI (before debt service)
  const operatingExpenses =
    (monthlyExpenses.propertyTax +
      monthlyExpenses.insurance +
      monthlyExpenses.maintenance +
      monthlyExpenses.propertyManagement +
      monthlyExpenses.vacancy +
      monthlyExpenses.hoa) *
    12
  const netOperatingIncome = annualIncome - operatingExpenses

  // Key ratios
  const grossRentMultiplier = propertyValue / annualIncome
  const capRate = netOperatingIncome / propertyValue
  const cashOnCashReturn = annualCashFlow / totalCashRequired

  // Break-even and ROI
  const breakEvenMonths =
    monthlyCashFlow > 0
      ? Math.ceil(totalCashRequired / monthlyCashFlow)
      : Infinity

  // 1-year ROI (cash flow + equity + appreciation)
  const yearlyAppreciation = propertyValue * assumptions.appreciationRate
  const yearlyEquityBuildUp =
    monthlyMortgage * 12 - loanAmount * assumptions.interestRate // Rough estimate
  const roi1Year =
    (annualCashFlow + yearlyAppreciation + Math.max(0, yearlyEquityBuildUp)) /
    totalCashRequired

  // 5-year ROI (compounded)
  const futureValue =
    propertyValue * Math.pow(1 + assumptions.appreciationRate, 5)
  const totalCashFlow5Year = annualCashFlow * 5 // Simplified
  const roi5Year =
    (futureValue - propertyValue + totalCashFlow5Year) / totalCashRequired

  const result: InvestmentAnalysis = {
    propertyValue,
    estimatedRent: estimatedMonthlyRent,
    grossRentMultiplier: Math.round(grossRentMultiplier * 10) / 10,
    capRate: Math.round(capRate * 1000) / 1000, // 3 decimal places
    cashOnCashReturn: Math.round(cashOnCashReturn * 1000) / 1000,
    monthlyIncome,
    monthlyExpenses,
    monthlyCashFlow,
    annualIncome,
    annualExpenses: Math.round(annualExpenses),
    annualCashFlow: Math.round(annualCashFlow),
    netOperatingIncome: Math.round(netOperatingIncome),
    breakEvenMonths: breakEvenMonths === Infinity ? -1 : breakEvenMonths,
    roi1Year: Math.round(roi1Year * 1000) / 1000,
    roi5Year: Math.round(roi5Year * 1000) / 1000,
    totalCashRequired: Math.round(totalCashRequired),
    assumptions,
  }

  logger.info("Investment analysis complete", {
    grm: result.grossRentMultiplier,
    capRate: `${(result.capRate * 100).toFixed(1)}%`,
    cashOnCash: `${(result.cashOnCashReturn * 100).toFixed(1)}%`,
    monthlyCashFlow: result.monthlyCashFlow,
  })

  return result
}

/**
 * Quick GRM and cap rate calculation
 */
export function calculateQuickMetrics(
  propertyValue: number,
  monthlyRent: number,
  annualExpenses?: number
): {
  grossRentMultiplier: number
  capRate: number | null
  cashOnCashReturn: number | null
} {
  const annualRent = monthlyRent * 12
  const grossRentMultiplier = propertyValue / annualRent

  let capRate: number | null = null
  if (annualExpenses !== undefined) {
    const noi = annualRent - annualExpenses
    capRate = noi / propertyValue
  }

  return {
    grossRentMultiplier: Math.round(grossRentMultiplier * 10) / 10,
    capRate: capRate ? Math.round(capRate * 1000) / 1000 : null,
    cashOnCashReturn: null, // Requires more assumptions
  }
}

/**
 * Format investment analysis for display
 */
export function formatInvestmentAnalysis(
  analysis: InvestmentAnalysis
): string {
  const lines: string[] = [
    "### Investment Analysis",
    "",
    "**Property Overview:**",
    `- Value: $${analysis.propertyValue.toLocaleString()}`,
    `- Monthly Rent: $${analysis.estimatedRent.toLocaleString()}`,
    "",
    "**Key Ratios:**",
    `- Gross Rent Multiplier: ${analysis.grossRentMultiplier}`,
    `- Cap Rate: ${(analysis.capRate * 100).toFixed(2)}%`,
    `- Cash-on-Cash Return: ${(analysis.cashOnCashReturn * 100).toFixed(2)}%`,
    "",
    "**Monthly Cash Flow:**",
    `- Income: $${analysis.monthlyIncome.toLocaleString()}`,
    `- Expenses: $${analysis.monthlyExpenses.total.toLocaleString()}`,
    `- Net Cash Flow: $${analysis.monthlyCashFlow.toLocaleString()}`,
    "",
    "**Monthly Expenses Breakdown:**",
    `- Mortgage (P&I): $${analysis.monthlyExpenses.mortgage.toLocaleString()}`,
    `- Property Tax: $${analysis.monthlyExpenses.propertyTax.toLocaleString()}`,
    `- Insurance: $${analysis.monthlyExpenses.insurance.toLocaleString()}`,
    `- Maintenance: $${analysis.monthlyExpenses.maintenance.toLocaleString()}`,
    `- Management: $${analysis.monthlyExpenses.propertyManagement.toLocaleString()}`,
    `- Vacancy Reserve: $${analysis.monthlyExpenses.vacancy.toLocaleString()}`,
  ]

  if (analysis.monthlyExpenses.hoa > 0) {
    lines.push(`- HOA: $${analysis.monthlyExpenses.hoa.toLocaleString()}`)
  }

  lines.push("")
  lines.push("**Investment Returns:**")
  lines.push(
    `- Cash Required: $${analysis.totalCashRequired.toLocaleString()}`
  )
  lines.push(`- Annual Cash Flow: $${analysis.annualCashFlow.toLocaleString()}`)
  lines.push(`- 1-Year ROI: ${(analysis.roi1Year * 100).toFixed(1)}%`)
  lines.push(`- 5-Year ROI: ${(analysis.roi5Year * 100).toFixed(1)}%`)

  if (analysis.breakEvenMonths > 0) {
    lines.push(`- Break-Even: ${analysis.breakEvenMonths} months`)
  }

  lines.push("")
  lines.push("**Assumptions:**")
  lines.push(
    `- Down Payment: ${(analysis.assumptions.downPaymentPercent * 100).toFixed(0)}%`
  )
  lines.push(
    `- Interest Rate: ${(analysis.assumptions.interestRate * 100).toFixed(2)}%`
  )
  lines.push(
    `- Appreciation: ${(analysis.assumptions.appreciationRate * 100).toFixed(1)}%/year`
  )

  return lines.join("\n")
}
