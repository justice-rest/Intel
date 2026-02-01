/**
 * Giving Capacity Calculator Tool
 *
 * Implements TFG Research Formulas for prospect wealth screening:
 * 1. Generosity Screening (GS) - Basic formula
 * 2. Enhanced Generosity Screening (EGS) - Adds salary/age
 * 3. Snapshot Formula - Most thorough with DIF (Decrease/Increase Factor)
 *
 * Data sources (all FREE):
 * - Real Estate: County Assessor / Property Valuation tools
 * - Business: SEC EDGAR, State Registries, Business Revenue Estimator
 * - Giving: FEC contributions, ProPublica 990s
 * - Salary: Derived from home value (1M house = 150k salary) or government salary data
 *
 * Formula Details:
 *
 * GS = (RE Value × RE Factor + Lifetime Giving) × Donation Factor × Business/SEC Factor
 *   - RE Factor: 0.05 (1 property), 0.1 (2 properties), 0.15 (3+ properties)
 *   - Donation Factor: 1 (<100k), 1.1 (>=100k), 1.15 (>=1M)
 *   - Business/SEC Factor: 1.1 (if business OR SEC), 1.0 (if none)
 *
 * EGS = Salary × (Age-22) × 0.01 + RE Value × RE Factor + Business Revenue × 0.05 + Lifetime Giving
 *
 * Snapshot = (L1 + L2 + L3) + (L1 + L2 + L3) × DIF + L4
 *   - L1: Income × (Age-22) × 0.01
 *   - L2: Total RE Value × RE Factor
 *   - L3: Business Revenue × 0.05
 *   - L4: 100% of last 5 years of gifts
 *   - DIF: Sum of Decrease/Increase percentages
 *
 * DIF Modifiers:
 *   DECREASE: -25% (no demonstrated generosity), -10% (<$1M RE or <3 properties), -10% (employee)
 *   INCREASE: +10% (multiple business owner), +10% (6-figure gifts), +15% (7-figure gifts)
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// CONSTANTS - TFG Research Formulas
// ============================================================================

// Real Estate Factors
const RE_FACTOR_1_PROPERTY = 0.05
const RE_FACTOR_2_PROPERTIES = 0.1
const RE_FACTOR_3_PLUS_PROPERTIES = 0.15

// Donation Factors
const DONATION_FACTOR_BASE = 1.0
const DONATION_FACTOR_100K = 1.1
const DONATION_FACTOR_1M = 1.15

// Business/SEC Factor
const BUSINESS_SEC_FACTOR_PRESENT = 1.1
const BUSINESS_SEC_FACTOR_ABSENT = 1.0

// EGS/Snapshot Calculation Constants
const SALARY_AGE_MULTIPLIER = 0.01
const BUSINESS_REVENUE_MULTIPLIER = 0.05
const DEFAULT_WORKING_START_AGE = 22

// Salary Estimation from Home Value (TFG: 1M house = 150k salary)
const HOME_VALUE_TO_SALARY_RATIO = 0.15

// DIF Modifiers (Decrease/Increase Factor)
const DIF_NO_DEMONSTRATED_GENEROSITY = -0.25 // -25%
const DIF_LESS_THAN_1M_RE_OR_FEW_PROPERTIES = -0.10 // -10%
const DIF_EMPLOYEE_NON_ENTREPRENEUR = -0.10 // -10%
const DIF_MULTIPLE_BUSINESS_OWNER = 0.10 // +10%
const DIF_SIX_FIGURE_GIFTS = 0.10 // +10%
const DIF_SEVEN_FIGURE_GIFTS = 0.15 // +15%

// ============================================================================
// SCHEMAS
// ============================================================================

const givingCapacitySchema = z.object({
  // Required: Real Estate Data
  totalRealEstateValue: z
    .number()
    .min(0)
    .describe("Total value of all properties owned in dollars"),
  propertyCount: z
    .number()
    .int()
    .min(0)
    .describe("Number of properties owned"),

  // Optional: Giving History
  lifetimeGiving: z
    .number()
    .min(0)
    .optional()
    .default(0)
    .describe("Total lifetime giving to client nonprofit (provided by client)"),
  last5YearsGiving: z
    .number()
    .min(0)
    .optional()
    .describe("Total giving over the last 5 years to all nonprofits (for Snapshot formula)"),

  // Optional: For EGS/Snapshot (age-based calculations)
  estimatedSalary: z
    .number()
    .min(0)
    .optional()
    .describe("Estimated annual salary. If not provided, will be estimated from home value (1M house = 150k salary)"),
  age: z
    .number()
    .int()
    .min(22)
    .max(120)
    .optional()
    .describe("Prospect's age (required for EGS/Snapshot calculations)"),

  // Optional: Business Data
  hasBusinessOwnership: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether prospect owns a business"),
  businessRevenue: z
    .number()
    .min(0)
    .optional()
    .describe("Annual business revenue (for EGS/Snapshot)"),
  isMultipleBusinessOwner: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether prospect owns multiple businesses (DIF modifier)"),
  isEntrepreneur: z
    .boolean()
    .optional()
    .describe("Whether prospect is an entrepreneur (vs employee). Defaults to true if hasBusinessOwnership is true"),

  // Optional: SEC Data
  hasSecFilings: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether prospect has SEC insider filings (Form 3/4/5)"),

  // Optional: Giving Indicators (for DIF calculation)
  hasDemonstratedGenerosity: z
    .boolean()
    .optional()
    .describe("Whether prospect gives to 3+ philanthropic/political orgs (other than client)"),
  largestKnownGift: z
    .number()
    .min(0)
    .optional()
    .describe("Largest known single gift (for 6/7 figure gift DIF modifiers)"),

  // Calculation Mode
  calculationType: z
    .enum(["gs", "egs", "snapshot", "all"])
    .optional()
    .default("all")
    .describe("Which formula(s) to calculate: gs (basic), egs (enhanced), snapshot (thorough), or all"),
})

// ============================================================================
// TYPES
// ============================================================================

export interface CapacityBreakdown {
  formula: string
  result: number
  components: {
    name: string
    value: number
    description: string
  }[]
}

export interface DIFModifier {
  factor: string
  value: number
  reason: string
  isIncrease: boolean
}

export interface GivingCapacityResult {
  // Input Summary
  personName?: string
  totalRealEstateValue: number
  propertyCount: number
  estimatedSalary: number
  salarySource: "provided" | "estimated_from_home_value" | "unknown"
  age?: number
  lifetimeGiving: number
  last5YearsGiving: number
  businessRevenue: number

  // Capacity Calculations
  gsCapacity: number | null // Generosity Screening
  egsCapacity: number | null // Enhanced Generosity Screening
  snapshotCapacity: number | null // Snapshot (most thorough)
  recommendedCapacity: number // Best available calculation

  // Detailed Breakdowns
  gsBreakdown: CapacityBreakdown | null
  egsBreakdown: CapacityBreakdown | null
  snapshotBreakdown: CapacityBreakdown | null

  // DIF Details (for Snapshot)
  difModifiers: DIFModifier[]
  totalDIF: number

  // Capacity Rating
  capacityRating: "A" | "B" | "C" | "D"
  capacityRange: string

  // Methodology Notes
  methodologyNotes: string[]
  dataQuality: "high" | "medium" | "low"
  missingDataPoints: string[]

  // For AI consumption
  rawContent: string
  sources: Array<{ name: string; url: string }>
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get Real Estate Factor based on property count
 */
function getREFactor(propertyCount: number): number {
  if (propertyCount <= 0) return 0
  if (propertyCount === 1) return RE_FACTOR_1_PROPERTY
  if (propertyCount === 2) return RE_FACTOR_2_PROPERTIES
  return RE_FACTOR_3_PLUS_PROPERTIES
}

/**
 * Get Donation Factor based on lifetime giving
 */
function getDonationFactor(lifetimeGiving: number): number {
  if (lifetimeGiving >= 1_000_000) return DONATION_FACTOR_1M
  if (lifetimeGiving >= 100_000) return DONATION_FACTOR_100K
  return DONATION_FACTOR_BASE
}

/**
 * Get Business/SEC Factor
 */
function getBusinessSecFactor(hasBusiness: boolean, hasSec: boolean): number {
  return hasBusiness || hasSec ? BUSINESS_SEC_FACTOR_PRESENT : BUSINESS_SEC_FACTOR_ABSENT
}

/**
 * Estimate salary from home value
 * TFG Formula: 1M house = 150k salary (ratio: 0.15)
 */
function estimateSalaryFromHomeValue(homeValue: number): number {
  return homeValue * HOME_VALUE_TO_SALARY_RATIO
}

/**
 * Calculate DIF (Decrease/Increase Factor) for Snapshot formula
 */
function calculateDIF(params: {
  hasDemonstratedGenerosity?: boolean
  totalRealEstateValue: number
  propertyCount: number
  isEntrepreneur: boolean
  isMultipleBusinessOwner: boolean
  largestKnownGift?: number
}): { totalDIF: number; modifiers: DIFModifier[] } {
  const modifiers: DIFModifier[] = []
  let totalDIF = 0

  // DECREASE factors

  // No demonstrated generosity (give to 3+ philanthropic/political orgs other than client)
  if (params.hasDemonstratedGenerosity === false) {
    modifiers.push({
      factor: "No Demonstrated Generosity",
      value: DIF_NO_DEMONSTRATED_GENEROSITY,
      reason: "Does not give to 3+ philanthropic or political organizations other than client",
      isIncrease: false,
    })
    totalDIF += DIF_NO_DEMONSTRATED_GENEROSITY
  }

  // Less than $1M in real estate OR fewer than 3 properties
  if (params.totalRealEstateValue < 1_000_000 || params.propertyCount < 3) {
    modifiers.push({
      factor: "Limited Real Estate",
      value: DIF_LESS_THAN_1M_RE_OR_FEW_PROPERTIES,
      reason: `Less than $1M in real estate ($${params.totalRealEstateValue.toLocaleString()}) or fewer than 3 properties (${params.propertyCount})`,
      isIncrease: false,
    })
    totalDIF += DIF_LESS_THAN_1M_RE_OR_FEW_PROPERTIES
  }

  // Employee (non-entrepreneur)
  if (!params.isEntrepreneur) {
    modifiers.push({
      factor: "Employee (Non-Entrepreneur)",
      value: DIF_EMPLOYEE_NON_ENTREPRENEUR,
      reason: "Identified as employee rather than business owner/entrepreneur",
      isIncrease: false,
    })
    totalDIF += DIF_EMPLOYEE_NON_ENTREPRENEUR
  }

  // INCREASE factors

  // Multiple business owner (entrepreneur)
  if (params.isMultipleBusinessOwner) {
    modifiers.push({
      factor: "Multiple Business Owner",
      value: DIF_MULTIPLE_BUSINESS_OWNER,
      reason: "Owns multiple businesses - indicates entrepreneurial wealth",
      isIncrease: true,
    })
    totalDIF += DIF_MULTIPLE_BUSINESS_OWNER
  }

  // Proof of 6-figure gifts ($100,000 - $999,999)
  if (params.largestKnownGift && params.largestKnownGift >= 100_000 && params.largestKnownGift < 1_000_000) {
    modifiers.push({
      factor: "Proof of 6-Figure Gifts",
      value: DIF_SIX_FIGURE_GIFTS,
      reason: `Largest known gift: $${params.largestKnownGift.toLocaleString()}`,
      isIncrease: true,
    })
    totalDIF += DIF_SIX_FIGURE_GIFTS
  }

  // Proof of 7-figure gifts ($1,000,000+)
  if (params.largestKnownGift && params.largestKnownGift >= 1_000_000) {
    modifiers.push({
      factor: "Proof of 7-Figure Gifts",
      value: DIF_SEVEN_FIGURE_GIFTS,
      reason: `Largest known gift: $${params.largestKnownGift.toLocaleString()}`,
      isIncrease: true,
    })
    totalDIF += DIF_SEVEN_FIGURE_GIFTS
  }

  return { totalDIF, modifiers }
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}

/**
 * Get capacity rating based on calculated capacity
 */
function getCapacityRating(capacity: number): "A" | "B" | "C" | "D" {
  if (capacity >= 1_000_000) return "A" // $1M+ capacity
  if (capacity >= 100_000) return "B" // $100K-$1M capacity
  if (capacity >= 25_000) return "C" // $25K-$100K capacity
  return "D" // Under $25K capacity
}

/**
 * Get capacity range description
 */
function getCapacityRange(capacity: number): string {
  if (capacity >= 10_000_000) return "$10M+ major gift capacity"
  if (capacity >= 1_000_000) return "$1M-$10M gift capacity"
  if (capacity >= 500_000) return "$500K-$1M gift capacity"
  if (capacity >= 100_000) return "$100K-$500K gift capacity"
  if (capacity >= 50_000) return "$50K-$100K gift capacity"
  if (capacity >= 25_000) return "$25K-$50K gift capacity"
  if (capacity >= 10_000) return "$10K-$25K gift capacity"
  if (capacity >= 5_000) return "$5K-$10K gift capacity"
  return "Under $5K capacity"
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate Generosity Screening (GS) Capacity
 * Formula: (RE Value × RE Factor + Lifetime Giving) × Donation Factor × Business/SEC Factor
 */
function calculateGSCapacity(params: {
  totalRealEstateValue: number
  propertyCount: number
  lifetimeGiving: number
  hasBusinessOwnership: boolean
  hasSecFilings: boolean
}): CapacityBreakdown {
  const reFactor = getREFactor(params.propertyCount)
  const donationFactor = getDonationFactor(params.lifetimeGiving)
  const businessSecFactor = getBusinessSecFactor(params.hasBusinessOwnership, params.hasSecFilings)

  const reComponent = params.totalRealEstateValue * reFactor
  const baseValue = reComponent + params.lifetimeGiving
  const result = baseValue * donationFactor * businessSecFactor

  return {
    formula: "(RE Value × RE Factor + Lifetime Giving) × Donation Factor × Business/SEC Factor",
    result: Math.round(result),
    components: [
      {
        name: "RE Value × RE Factor",
        value: Math.round(reComponent),
        description: `$${params.totalRealEstateValue.toLocaleString()} × ${reFactor} (${params.propertyCount} propert${params.propertyCount === 1 ? "y" : "ies"})`,
      },
      {
        name: "Lifetime Giving",
        value: params.lifetimeGiving,
        description: `$${params.lifetimeGiving.toLocaleString()} (provided by client)`,
      },
      {
        name: "Donation Factor",
        value: donationFactor,
        description: donationFactor === 1.15
          ? "1.15 (lifetime giving >= $1M)"
          : donationFactor === 1.1
          ? "1.1 (lifetime giving >= $100K)"
          : "1.0 (lifetime giving < $100K)",
      },
      {
        name: "Business/SEC Factor",
        value: businessSecFactor,
        description: businessSecFactor === 1.1
          ? "1.1 (has business ownership or SEC filings)"
          : "1.0 (no business or SEC indicators)",
      },
    ],
  }
}

/**
 * Calculate Enhanced Generosity Screening (EGS) Capacity
 * Formula: Salary × (Age-22) × 0.01 + RE Value × RE Factor + Business Revenue × 0.05 + Lifetime Giving
 */
function calculateEGSCapacity(params: {
  estimatedSalary: number
  age: number
  totalRealEstateValue: number
  propertyCount: number
  businessRevenue: number
  lifetimeGiving: number
}): CapacityBreakdown {
  const reFactor = getREFactor(params.propertyCount)
  const yearsWorking = Math.max(0, params.age - DEFAULT_WORKING_START_AGE)

  const salaryComponent = params.estimatedSalary * yearsWorking * SALARY_AGE_MULTIPLIER
  const reComponent = params.totalRealEstateValue * reFactor
  const businessComponent = params.businessRevenue * BUSINESS_REVENUE_MULTIPLIER
  const result = salaryComponent + reComponent + businessComponent + params.lifetimeGiving

  return {
    formula: "Salary × (Age-22) × 0.01 + RE Value × RE Factor + Business Revenue × 0.05 + Lifetime Giving",
    result: Math.round(result),
    components: [
      {
        name: "Salary/Age Component",
        value: Math.round(salaryComponent),
        description: `$${params.estimatedSalary.toLocaleString()} × ${yearsWorking} years × 0.01`,
      },
      {
        name: "Real Estate Component",
        value: Math.round(reComponent),
        description: `$${params.totalRealEstateValue.toLocaleString()} × ${reFactor}`,
      },
      {
        name: "Business Value Component",
        value: Math.round(businessComponent),
        description: `$${params.businessRevenue.toLocaleString()} × 0.05`,
      },
      {
        name: "Lifetime Giving",
        value: params.lifetimeGiving,
        description: `$${params.lifetimeGiving.toLocaleString()}`,
      },
    ],
  }
}

/**
 * Calculate Snapshot Capacity (Most Thorough)
 * Formula: (L1 + L2 + L3) + (L1 + L2 + L3) × DIF + L4
 * Where:
 *   L1 = Income × (Age-22) × 0.01
 *   L2 = Total RE Value × RE Factor
 *   L3 = Business Revenue × 0.05
 *   L4 = 100% of last 5 years of gifts
 */
function calculateSnapshotCapacity(params: {
  estimatedSalary: number
  age: number
  totalRealEstateValue: number
  propertyCount: number
  businessRevenue: number
  last5YearsGiving: number
  totalDIF: number
}): CapacityBreakdown {
  const reFactor = getREFactor(params.propertyCount)
  const yearsWorking = Math.max(0, params.age - DEFAULT_WORKING_START_AGE)

  const L1 = params.estimatedSalary * yearsWorking * SALARY_AGE_MULTIPLIER
  const L2 = params.totalRealEstateValue * reFactor
  const L3 = params.businessRevenue * BUSINESS_REVENUE_MULTIPLIER
  const L4 = params.last5YearsGiving

  const baseValue = L1 + L2 + L3
  const difAdjustment = baseValue * params.totalDIF
  const result = baseValue + difAdjustment + L4

  return {
    formula: "(L1 + L2 + L3) + (L1 + L2 + L3) × DIF + L4",
    result: Math.round(result),
    components: [
      {
        name: "L1: Salary/Age",
        value: Math.round(L1),
        description: `$${params.estimatedSalary.toLocaleString()} × ${yearsWorking} × 0.01`,
      },
      {
        name: "L2: Real Estate",
        value: Math.round(L2),
        description: `$${params.totalRealEstateValue.toLocaleString()} × ${reFactor}`,
      },
      {
        name: "L3: Business",
        value: Math.round(L3),
        description: `$${params.businessRevenue.toLocaleString()} × 0.05`,
      },
      {
        name: "DIF Adjustment",
        value: Math.round(difAdjustment),
        description: `(L1+L2+L3) × ${(params.totalDIF * 100).toFixed(0)}% = ${formatCurrency(Math.abs(difAdjustment))} ${params.totalDIF >= 0 ? "increase" : "decrease"}`,
      },
      {
        name: "L4: Last 5 Years Giving",
        value: Math.round(L4),
        description: `$${params.last5YearsGiving.toLocaleString()} (100% of last 5 years)`,
      },
    ],
  }
}

/**
 * Format result for AI consumption
 */
function formatForAI(result: GivingCapacityResult): string {
  const lines: string[] = [
    `# Giving Capacity Analysis`,
    "",
    `## Summary`,
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| **Recommended Capacity** | ${formatCurrency(result.recommendedCapacity)} |`,
    `| **Capacity Rating** | ${result.capacityRating} |`,
    `| **Capacity Range** | ${result.capacityRange} |`,
    `| **Data Quality** | ${result.dataQuality.toUpperCase()} |`,
    "",
  ]

  // Input Data Summary
  lines.push("## Input Data")
  lines.push("")
  lines.push(`| Data Point | Value | Source |`)
  lines.push(`|------------|-------|--------|`)
  lines.push(`| Total Real Estate | ${formatCurrency(result.totalRealEstateValue)} | Property records |`)
  lines.push(`| Properties Owned | ${result.propertyCount} | Property records |`)
  lines.push(`| Estimated Salary | ${formatCurrency(result.estimatedSalary)} | ${result.salarySource.replace(/_/g, " ")} |`)
  if (result.age) {
    lines.push(`| Age | ${result.age} | Provided |`)
  }
  lines.push(`| Lifetime Giving | ${formatCurrency(result.lifetimeGiving)} | Client data |`)
  lines.push(`| Last 5 Years Giving | ${formatCurrency(result.last5YearsGiving)} | Giving records |`)
  if (result.businessRevenue > 0) {
    lines.push(`| Business Revenue | ${formatCurrency(result.businessRevenue)} | Business records |`)
  }
  lines.push("")

  // Calculation Results
  lines.push("## Capacity Calculations")
  lines.push("")

  if (result.gsBreakdown) {
    lines.push(`### Generosity Screening (GS): ${formatCurrency(result.gsCapacity || 0)}`)
    lines.push(`Formula: \`${result.gsBreakdown.formula}\``)
    lines.push("")
    for (const comp of result.gsBreakdown.components) {
      lines.push(`- **${comp.name}**: ${typeof comp.value === "number" && comp.value >= 1000 ? formatCurrency(comp.value) : comp.value}`)
      lines.push(`  - ${comp.description}`)
    }
    lines.push("")
  }

  if (result.egsBreakdown) {
    lines.push(`### Enhanced Generosity Screening (EGS): ${formatCurrency(result.egsCapacity || 0)}`)
    lines.push(`Formula: \`${result.egsBreakdown.formula}\``)
    lines.push("")
    for (const comp of result.egsBreakdown.components) {
      lines.push(`- **${comp.name}**: ${typeof comp.value === "number" && comp.value >= 1000 ? formatCurrency(comp.value) : comp.value}`)
      lines.push(`  - ${comp.description}`)
    }
    lines.push("")
  }

  if (result.snapshotBreakdown) {
    lines.push(`### Snapshot (Most Thorough): ${formatCurrency(result.snapshotCapacity || 0)}`)
    lines.push(`Formula: \`${result.snapshotBreakdown.formula}\``)
    lines.push("")
    for (const comp of result.snapshotBreakdown.components) {
      lines.push(`- **${comp.name}**: ${typeof comp.value === "number" && comp.value >= 1000 ? formatCurrency(comp.value) : comp.value}`)
      lines.push(`  - ${comp.description}`)
    }
    lines.push("")
  }

  // DIF Modifiers (for Snapshot)
  if (result.difModifiers.length > 0) {
    lines.push("## DIF (Decrease/Increase Factor) Analysis")
    lines.push("")
    lines.push(`**Total DIF: ${(result.totalDIF * 100).toFixed(0)}%**`)
    lines.push("")

    const decreases = result.difModifiers.filter(m => !m.isIncrease)
    const increases = result.difModifiers.filter(m => m.isIncrease)

    if (decreases.length > 0) {
      lines.push("### Decrease Factors")
      for (const mod of decreases) {
        lines.push(`- **${mod.factor}**: ${(mod.value * 100).toFixed(0)}%`)
        lines.push(`  - ${mod.reason}`)
      }
      lines.push("")
    }

    if (increases.length > 0) {
      lines.push("### Increase Factors")
      for (const mod of increases) {
        lines.push(`- **${mod.factor}**: +${(mod.value * 100).toFixed(0)}%`)
        lines.push(`  - ${mod.reason}`)
      }
      lines.push("")
    }
  }

  // Missing Data Points
  if (result.missingDataPoints.length > 0) {
    lines.push("## Missing Data Points")
    lines.push("")
    lines.push("The following data would improve accuracy:")
    lines.push("")
    for (const point of result.missingDataPoints) {
      lines.push(`- ${point}`)
    }
    lines.push("")
  }

  // Methodology Notes
  if (result.methodologyNotes.length > 0) {
    lines.push("## Methodology Notes")
    lines.push("")
    for (const note of result.methodologyNotes) {
      lines.push(`- ${note}`)
    }
    lines.push("")
  }

  lines.push("---")
  lines.push("")
  lines.push("*Calculated using TFG Research Formulas (Generosity Screening, Enhanced Generosity Screening, Snapshot)*")

  return lines.join("\n")
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const givingCapacityCalculatorTool = (tool as any)({
  description:
    "Calculate giving capacity using TFG Research Formulas (GS, EGS, Snapshot). " +
    "Requires real estate value and property count at minimum. " +
    "For more accurate results, provide: age (for EGS/Snapshot), salary (or will estimate from home value), " +
    "business revenue, and giving history. " +
    "Returns capacity rating (A-D), dollar capacity, and detailed breakdown showing how each component contributes. " +
    "Use this AFTER gathering wealth data from property_valuation, find_business_ownership, fec_contributions, etc.",

  parameters: givingCapacitySchema,

  execute: async (params: {
    totalRealEstateValue: number;
    propertyCount: number;
    lifetimeGiving: number;
    last5YearsGiving?: number;
    estimatedSalary?: number;
    age?: number;
    hasBusinessOwnership: boolean;
    businessRevenue?: number;
    isMultipleBusinessOwner: boolean;
    isEntrepreneur?: boolean;
    hasSecFilings: boolean;
    hasDemonstratedGenerosity?: boolean;
    largestKnownGift?: number;
    calculationType: "gs" | "egs" | "snapshot" | "all";
  }): Promise<GivingCapacityResult> => {
    console.log("[Giving Capacity] Calculating capacity...")

    const missingDataPoints: string[] = []
    const methodologyNotes: string[] = []
    const sources: Array<{ name: string; url: string }> = []

    // Determine salary
    let estimatedSalary = params.estimatedSalary || 0
    let salarySource: "provided" | "estimated_from_home_value" | "unknown" = "unknown"

    if (params.estimatedSalary && params.estimatedSalary > 0) {
      salarySource = "provided"
    } else if (params.totalRealEstateValue > 0) {
      estimatedSalary = estimateSalaryFromHomeValue(params.totalRealEstateValue)
      salarySource = "estimated_from_home_value"
      methodologyNotes.push(
        `Salary estimated from home value: $${params.totalRealEstateValue.toLocaleString()} × 0.15 = $${estimatedSalary.toLocaleString()}/year (TFG formula: 1M house = 150K salary)`
      )
    } else {
      missingDataPoints.push("Salary or income data")
    }

    // Determine entrepreneur status
    const isEntrepreneur = params.isEntrepreneur ?? params.hasBusinessOwnership

    // Calculate DIF
    const { totalDIF, modifiers: difModifiers } = calculateDIF({
      hasDemonstratedGenerosity: params.hasDemonstratedGenerosity,
      totalRealEstateValue: params.totalRealEstateValue,
      propertyCount: params.propertyCount,
      isEntrepreneur,
      isMultipleBusinessOwner: params.isMultipleBusinessOwner,
      largestKnownGift: params.largestKnownGift,
    })

    // Track missing data
    if (!params.age) {
      missingDataPoints.push("Age (required for EGS and Snapshot calculations)")
    }
    if (!params.businessRevenue && params.hasBusinessOwnership) {
      missingDataPoints.push("Business revenue (would improve accuracy)")
    }
    if (params.last5YearsGiving === undefined) {
      missingDataPoints.push("Last 5 years giving history (for Snapshot calculation)")
    }
    if (params.hasDemonstratedGenerosity === undefined) {
      missingDataPoints.push("Demonstrated generosity indicator (gives to 3+ orgs)")
    }

    // Calculate GS (always possible)
    let gsCapacity: number | null = null
    let gsBreakdown: CapacityBreakdown | null = null

    if (params.calculationType === "gs" || params.calculationType === "all") {
      gsBreakdown = calculateGSCapacity({
        totalRealEstateValue: params.totalRealEstateValue,
        propertyCount: params.propertyCount,
        lifetimeGiving: params.lifetimeGiving,
        hasBusinessOwnership: params.hasBusinessOwnership,
        hasSecFilings: params.hasSecFilings,
      })
      gsCapacity = gsBreakdown.result
    }

    // Calculate EGS (requires age)
    let egsCapacity: number | null = null
    let egsBreakdown: CapacityBreakdown | null = null

    if ((params.calculationType === "egs" || params.calculationType === "all") && params.age) {
      egsBreakdown = calculateEGSCapacity({
        estimatedSalary,
        age: params.age,
        totalRealEstateValue: params.totalRealEstateValue,
        propertyCount: params.propertyCount,
        businessRevenue: params.businessRevenue || 0,
        lifetimeGiving: params.lifetimeGiving,
      })
      egsCapacity = egsBreakdown.result
      methodologyNotes.push("EGS averages 25% higher than GS due to age and salary consideration")
    }

    // Calculate Snapshot (requires age)
    let snapshotCapacity: number | null = null
    let snapshotBreakdown: CapacityBreakdown | null = null

    if ((params.calculationType === "snapshot" || params.calculationType === "all") && params.age) {
      snapshotBreakdown = calculateSnapshotCapacity({
        estimatedSalary,
        age: params.age,
        totalRealEstateValue: params.totalRealEstateValue,
        propertyCount: params.propertyCount,
        businessRevenue: params.businessRevenue || 0,
        last5YearsGiving: params.last5YearsGiving || params.lifetimeGiving,
        totalDIF,
      })
      snapshotCapacity = snapshotBreakdown.result
      methodologyNotes.push("Snapshot is the most thorough analysis, incorporating DIF modifiers")
    }

    // Determine recommended capacity (prefer most thorough available)
    const recommendedCapacity = snapshotCapacity ?? egsCapacity ?? gsCapacity ?? 0

    // Determine data quality
    let dataQuality: "high" | "medium" | "low" = "low"
    if (snapshotCapacity !== null && params.age && params.businessRevenue !== undefined) {
      dataQuality = "high"
    } else if (egsCapacity !== null || (gsCapacity !== null && params.hasBusinessOwnership !== undefined)) {
      dataQuality = "medium"
    }

    // Add methodology notes
    if (params.propertyCount === 0) {
      methodologyNotes.push("No property data - capacity calculation may be significantly underestimated")
    }

    // Build result
    const result: GivingCapacityResult = {
      totalRealEstateValue: params.totalRealEstateValue,
      propertyCount: params.propertyCount,
      estimatedSalary,
      salarySource,
      age: params.age,
      lifetimeGiving: params.lifetimeGiving,
      last5YearsGiving: params.last5YearsGiving || params.lifetimeGiving,
      businessRevenue: params.businessRevenue || 0,

      gsCapacity,
      egsCapacity,
      snapshotCapacity,
      recommendedCapacity,

      gsBreakdown,
      egsBreakdown,
      snapshotBreakdown,

      difModifiers,
      totalDIF,

      capacityRating: getCapacityRating(recommendedCapacity),
      capacityRange: getCapacityRange(recommendedCapacity),

      methodologyNotes,
      dataQuality,
      missingDataPoints,

      rawContent: "", // Will be filled below
      sources,
    }

    result.rawContent = formatForAI(result)

    console.log("[Giving Capacity] Calculation complete:", {
      gs: gsCapacity ? formatCurrency(gsCapacity) : "N/A",
      egs: egsCapacity ? formatCurrency(egsCapacity) : "N/A",
      snapshot: snapshotCapacity ? formatCurrency(snapshotCapacity) : "N/A",
      recommended: formatCurrency(recommendedCapacity),
      rating: result.capacityRating,
    })

    return result
  },
})

/**
 * Check if giving capacity calculator should be enabled
 */
export function shouldEnableGivingCapacityCalculatorTool(): boolean {
  return true // Always available - uses data from other tools
}
