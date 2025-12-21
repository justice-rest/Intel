/**
 * FINRA BrokerCheck Search Tool
 *
 * Searches the FINRA BrokerCheck database for financial professionals.
 * Registered brokers, investment advisers, and their firms.
 *
 * Data Source: FINRA BrokerCheck API
 * URL: https://brokercheck.finra.org/
 *
 * Use Cases:
 * - Verify financial advisor credentials
 * - Find investment professionals
 * - Wealth indicator (financial professionals have high income)
 * - Due diligence on financial advisors
 *
 * FREE - No API key required
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// TYPES
// ============================================================================

export interface FinancialProfessional {
  name: string
  crdNumber: string
  firmName: string
  firmCrd?: string
  registrations: string[]
  licenses: string[]
  disclosures: number
  yearsExperience: number
  city: string
  state: string
  status: "active" | "inactive" | "unknown"
  estimatedIncome?: string
}

export interface FINRABrokerCheckResult {
  searchTerm: string
  professionals: FinancialProfessional[]
  summary: {
    totalFound: number
    activeCount: number
    averageExperience: number
    firms: string[]
    wealthIndicator: "high" | "medium" | "unknown"
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// INCOME ESTIMATES
// ============================================================================

function estimateIncomeByExperience(yearsExperience: number, hasDisclosures: boolean): { min: number; max: number } {
  // Base income for financial professionals
  let base = { min: 80000, max: 150000 }

  if (yearsExperience >= 20) {
    base = { min: 300000, max: 1000000 } // Senior advisors
  } else if (yearsExperience >= 10) {
    base = { min: 150000, max: 400000 } // Experienced
  } else if (yearsExperience >= 5) {
    base = { min: 100000, max: 200000 } // Mid-career
  }

  // Reduce estimate if there are disclosures
  if (hasDisclosures) {
    base.min = Math.round(base.min * 0.8)
    base.max = Math.round(base.max * 0.8)
  }

  return base
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  }
  return `$${(amount / 1000).toFixed(0)}K`
}

// ============================================================================
// FINRA API SEARCH
// ============================================================================

async function searchFINRABrokerCheck(
  searchTerm: string,
  searchType: "individual" | "firm" = "individual"
): Promise<FINRABrokerCheckResult> {
  console.log(`[FINRABrokerCheck] Searching for "${searchTerm}" (${searchType})`)

  const professionals: FinancialProfessional[] = []
  const sources: Array<{ name: string; url: string }> = [
    {
      name: "FINRA BrokerCheck",
      url: `https://brokercheck.finra.org/search/genericsearch/grid?query=${encodeURIComponent(searchTerm)}`,
    },
  ]

  try {
    // FINRA BrokerCheck API
    const url = `https://api.brokercheck.finra.org/search/${searchType}?query=${encodeURIComponent(searchTerm)}&hl=true&nrows=25&start=0&r=25&sort=score+desc&wt=json`

    console.log(`[FINRABrokerCheck] Query URL: ${url}`)

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; Romy-Prospect-Research/1.0)",
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      console.error(`[FINRABrokerCheck] API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.hits && data.hits.hits) {
      for (const hit of data.hits.hits) {
        const source = hit._source || {}

        // Calculate years of experience
        const firstRegistration = source.bc_first_registration_date
        let yearsExperience = 0
        if (firstRegistration) {
          const startYear = new Date(firstRegistration).getFullYear()
          yearsExperience = new Date().getFullYear() - startYear
        }

        const disclosures = source.bc_disclosure_count || 0
        const income = estimateIncomeByExperience(yearsExperience, disclosures > 0)

        const professional: FinancialProfessional = {
          name: source.ind_firstname
            ? `${source.ind_firstname} ${source.ind_middlename || ""} ${source.ind_lastname}`.replace(/\s+/g, " ").trim()
            : source.bc_firm_name || "Unknown",
          crdNumber: String(source.ind_source_id || source.firm_source_id || ""),
          firmName: source.bc_current_employ_1 || source.bc_firm_name || "",
          firmCrd: source.bc_current_employ_1_bc_source_id || undefined,
          registrations: source.bc_state_reg_list || [],
          licenses: source.bc_exam_list || [],
          disclosures,
          yearsExperience,
          city: source.ind_other_city || source.firm_ia_city || "",
          state: source.ind_other_state || source.firm_ia_state || "",
          status: source.ind_bc_scope === "AC" ? "active" : "inactive",
          estimatedIncome: `${formatCurrency(income.min)} - ${formatCurrency(income.max)}`,
        }

        professionals.push(professional)
      }
    }

    console.log(`[FINRABrokerCheck] Found ${professionals.length} professionals`)
  } catch (error) {
    console.error(`[FINRABrokerCheck] Error:`, error)
  }

  // Calculate summary
  const activeCount = professionals.filter((p) => p.status === "active").length
  const totalExperience = professionals.reduce((sum, p) => sum + p.yearsExperience, 0)
  const avgExperience = professionals.length > 0 ? Math.round(totalExperience / professionals.length) : 0
  const firms = [...new Set(professionals.map((p) => p.firmName).filter(Boolean))]

  // Build raw content
  const rawLines: string[] = []
  rawLines.push(`# FINRA BrokerCheck Search: ${searchTerm}`)
  rawLines.push("")
  rawLines.push(`## Summary`)
  rawLines.push(`- **Total Professionals Found:** ${professionals.length}`)
  rawLines.push(`- **Active Registrations:** ${activeCount}`)
  rawLines.push(`- **Average Experience:** ${avgExperience} years`)
  rawLines.push(`- **Wealth Indicator:** ${avgExperience >= 10 ? "HIGH" : "MEDIUM"}`)

  if (firms.length > 0) {
    rawLines.push(`- **Firms:** ${firms.slice(0, 5).join(", ")}`)
  }
  rawLines.push("")

  if (professionals.length > 0) {
    rawLines.push(`## Financial Professionals`)
    rawLines.push("")

    for (const professional of professionals.slice(0, 15)) {
      rawLines.push(`### ${professional.name}`)
      rawLines.push(`- **CRD #:** ${professional.crdNumber}`)
      rawLines.push(`- **Status:** ${professional.status.toUpperCase()}`)
      rawLines.push(`- **Firm:** ${professional.firmName}`)
      rawLines.push(`- **Experience:** ${professional.yearsExperience} years`)
      rawLines.push(`- **Location:** ${professional.city}, ${professional.state}`)
      if (professional.disclosures > 0) {
        rawLines.push(`- **Disclosures:** ${professional.disclosures} (review BrokerCheck for details)`)
      }
      if (professional.licenses.length > 0) {
        rawLines.push(`- **Licenses:** ${professional.licenses.slice(0, 5).join(", ")}`)
      }
      if (professional.estimatedIncome) {
        rawLines.push(`- **Est. Income:** ${professional.estimatedIncome}`)
      }
      rawLines.push("")
    }

    if (professionals.length > 15) {
      rawLines.push(`*... and ${professionals.length - 15} more professionals*`)
    }
  } else {
    rawLines.push(`## Results`)
    rawLines.push(`No financial professionals found matching "${searchTerm}".`)
    rawLines.push("")
    rawLines.push(`**Note:** Search FINRA BrokerCheck directly at https://brokercheck.finra.org/`)
    rawLines.push("")
    rawLines.push(`**Wealth Indicator:** Financial professionals typically earn:`)
    rawLines.push(`- Entry level (0-5 years): $80K - $200K`)
    rawLines.push(`- Mid-career (5-10 years): $150K - $400K`)
    rawLines.push(`- Senior (10-20 years): $200K - $500K`)
    rawLines.push(`- Top performers (20+ years): $300K - $1M+`)
  }

  return {
    searchTerm,
    professionals,
    summary: {
      totalFound: professionals.length,
      activeCount,
      averageExperience: avgExperience,
      firms,
      wealthIndicator: avgExperience >= 10 ? "high" : "medium",
    },
    rawContent: rawLines.join("\n"),
    sources,
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const finraBrokerCheckSchema = z.object({
  searchTerm: z.string().describe("Name of the financial professional or firm to search for"),
  searchType: z
    .enum(["individual", "firm"])
    .optional()
    .default("individual")
    .describe("Search for individual brokers or firms"),
})

export const finraBrokerCheckTool = tool({
  description:
    "Search FINRA BrokerCheck for financial professionals and firms. " +
    "Registered brokers, investment advisers, and their employment history. " +
    "Returns: CRD number, firm, licenses, disclosures, years of experience. " +
    "WEALTH INDICATOR: Financial professionals have high income. " +
    "Entry: $80K-$200K, Senior (20+ yrs): $300K-$1M+. " +
    "Also reveals any disciplinary actions or complaints.",

  parameters: finraBrokerCheckSchema,

  execute: async ({ searchTerm, searchType }): Promise<FINRABrokerCheckResult> => {
    return searchFINRABrokerCheck(searchTerm, searchType)
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableFINRABrokerCheckTool(): boolean {
  return true
}

export { searchFINRABrokerCheck }
