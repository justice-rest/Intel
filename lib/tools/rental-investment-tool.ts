/**
 * Rental & Investment Analysis Tool
 *
 * Provides rental valuation and investment analysis for properties.
 * Works best when used AFTER property_valuation to get the property value.
 *
 * Features:
 * - Rental value estimation (monthly rent)
 * - Investment metrics (GRM, cap rate, cash-on-cash return)
 * - Monthly cash flow breakdown
 * - ROI projections (1-year, 5-year)
 */

import { tool } from "ai"
import { z } from "zod"
import {
  estimateRentalValue,
  analyzeInvestment,
  type InvestmentAnalysis,
  type RentalEstimate,
} from "@/lib/avm/rental-valuation"

// ============================================================================
// Schemas
// ============================================================================

const rentalInvestmentSchema = z.object({
  address: z
    .string()
    .describe("Full property address for context (city/state used for rent estimation)"),
  propertyValue: z
    .number()
    .positive()
    .describe("Property value in dollars (from property_valuation tool)"),
  squareFeet: z
    .number()
    .positive()
    .optional()
    .describe("Living area in square feet"),
  bedrooms: z.number().optional().describe("Number of bedrooms"),
  bathrooms: z.number().optional().describe("Number of bathrooms"),
  city: z.string().optional().describe("City name for rent estimation"),
  state: z.string().optional().describe("State code (e.g., TX, CA)"),
  monthlyHoa: z
    .number()
    .optional()
    .default(0)
    .describe("Monthly HOA fees (for condos/townhomes)"),
  // Investment assumptions (all optional with smart defaults)
  downPaymentPercent: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.2)
    .describe("Down payment as decimal (0.2 = 20%)"),
  interestRate: z
    .number()
    .min(0)
    .max(0.2)
    .optional()
    .default(0.07)
    .describe("Annual interest rate as decimal (0.07 = 7%)"),
})

export type RentalInvestmentParams = z.infer<typeof rentalInvestmentSchema>

// ============================================================================
// Result Type
// ============================================================================

interface RentalInvestmentResult {
  address: string
  rental: RentalEstimate
  investment: InvestmentAnalysis
  rawContent: string
  sources: Array<{ name: string; url: string }>
}

// ============================================================================
// Tool Definition
// ============================================================================

export const rentalInvestmentTool = tool({
  description:
    "Analyze a property as a rental investment. " +
    "Estimates monthly rent and calculates investment metrics (GRM, cap rate, cash-on-cash return, monthly cash flow). " +
    "REQUIRES property value from property_valuation tool. " +
    "Returns: estimated rent, investment metrics, monthly expense breakdown, and ROI projections. " +
    "Works best with property details (sqft, beds, baths) for accurate rent estimation.",

  parameters: rentalInvestmentSchema,

  execute: async (params: RentalInvestmentParams): Promise<RentalInvestmentResult> => {
    console.log("[Rental Investment] Analyzing:", params.address)

    // Parse city/state from address if not provided
    let city = params.city
    let state = params.state

    if (!city || !state) {
      const parts = params.address.split(",").map((p) => p.trim())
      if (parts.length >= 2) {
        city = city || parts[parts.length - 2]
        const stateZip = parts[parts.length - 1]
        const stateMatch = stateZip.match(/^([A-Z]{2})\b/i)
        state = state || stateMatch?.[1]?.toUpperCase()
      }
    }

    // Estimate rental value
    const rental = await estimateRentalValue(
      {
        address: params.address,
        city,
        state,
        squareFeet: params.squareFeet,
        bedrooms: params.bedrooms,
        bathrooms: params.bathrooms,
      },
      {}
    )

    // Analyze as investment
    const investment = await analyzeInvestment(
      params.propertyValue,
      rental.monthlyRent,
      {
        monthlyHoa: params.monthlyHoa,
        city,
        state,
        assumptions: {
          downPaymentPercent: params.downPaymentPercent,
          interestRate: params.interestRate,
        },
      }
    )

    // Format output
    const rawContent = formatOutput(params.address, rental, investment)

    console.log("[Rental Investment] Complete:", {
      address: params.address,
      monthlyRent: rental.monthlyRent,
      capRate: `${(investment.capRate * 100).toFixed(1)}%`,
      cashFlow: investment.monthlyCashFlow,
    })

    return {
      address: params.address,
      rental,
      investment,
      rawContent,
      sources: [],
    }
  },
})

// ============================================================================
// Output Formatting
// ============================================================================

function formatOutput(
  address: string,
  rental: RentalEstimate,
  investment: InvestmentAnalysis
): string {
  const lines: string[] = [
    `# Rental & Investment Analysis: ${address}`,
    "",
    "## Rental Estimate",
    `**Monthly Rent:** $${rental.monthlyRent.toLocaleString()}`,
    `**Range:** $${rental.rentRange.low.toLocaleString()} - $${rental.rentRange.high.toLocaleString()}`,
    `**$/SqFt:** $${rental.rentPerSqFt}/month`,
    `**Confidence:** ${rental.confidence}`,
    "",
    "## Investment Summary",
    `**Property Value:** $${investment.propertyValue.toLocaleString()}`,
    `**Gross Rent Multiplier:** ${investment.grossRentMultiplier}`,
    `**Cap Rate:** ${(investment.capRate * 100).toFixed(2)}%`,
    `**Cash-on-Cash Return:** ${(investment.cashOnCashReturn * 100).toFixed(2)}%`,
    "",
    "## Monthly Cash Flow",
    `**Gross Rent:** $${investment.monthlyIncome.toLocaleString()}`,
    `**Total Expenses:** $${investment.monthlyExpenses.total.toLocaleString()}`,
    `**Net Cash Flow:** $${investment.monthlyCashFlow.toLocaleString()}`,
    "",
    "### Expense Breakdown",
    `- Mortgage (P&I): $${investment.monthlyExpenses.mortgage.toLocaleString()}`,
    `- Property Tax: $${investment.monthlyExpenses.propertyTax.toLocaleString()}`,
    `- Insurance: $${investment.monthlyExpenses.insurance.toLocaleString()}`,
    `- Maintenance: $${investment.monthlyExpenses.maintenance.toLocaleString()}`,
    `- Management (8%): $${investment.monthlyExpenses.propertyManagement.toLocaleString()}`,
    `- Vacancy (5%): $${investment.monthlyExpenses.vacancy.toLocaleString()}`,
  ]

  if (investment.monthlyExpenses.hoa > 0) {
    lines.push(`- HOA: $${investment.monthlyExpenses.hoa.toLocaleString()}`)
  }

  lines.push("")
  lines.push("## Investment Returns")
  lines.push(`**Cash Required:** $${investment.totalCashRequired.toLocaleString()}`)
  lines.push(`- Down Payment (${(investment.assumptions.downPaymentPercent * 100).toFixed(0)}%): $${Math.round(investment.propertyValue * investment.assumptions.downPaymentPercent).toLocaleString()}`)
  lines.push(`- Closing Costs (3%): $${Math.round(investment.propertyValue * 0.03).toLocaleString()}`)
  lines.push("")
  lines.push(`**Annual Cash Flow:** $${investment.annualCashFlow.toLocaleString()}`)
  lines.push(`**1-Year ROI:** ${(investment.roi1Year * 100).toFixed(1)}%`)
  lines.push(`**5-Year ROI:** ${(investment.roi5Year * 100).toFixed(1)}%`)

  if (investment.breakEvenMonths > 0) {
    lines.push(`**Break-Even:** ${investment.breakEvenMonths} months`)
  }

  lines.push("")
  lines.push("## Investment Rating")

  if (investment.capRate >= 0.08) {
    lines.push("**Strong Investment** - Cap rate above 8% indicates good cash flow potential")
  } else if (investment.capRate >= 0.05) {
    lines.push("**Moderate Investment** - Cap rate 5-8% is typical for residential rentals")
  } else {
    lines.push("**Appreciation Play** - Low cap rate suggests value is in appreciation, not cash flow")
  }

  if (investment.monthlyCashFlow > 0) {
    lines.push(`\n*Positive cash flow of $${investment.monthlyCashFlow}/month after all expenses*`)
  } else {
    lines.push(`\n*Negative cash flow of $${Math.abs(investment.monthlyCashFlow)}/month - requires additional capital*`)
  }

  return lines.join("\n")
}

// ============================================================================
// Enable Check
// ============================================================================

export function shouldEnableRentalInvestmentTool(): boolean {
  return true
}
