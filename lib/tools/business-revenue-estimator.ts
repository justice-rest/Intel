/**
 * Business Revenue Estimator Tool
 * Estimates private company revenue using publicly available indicators
 *
 * Key Features:
 * - Employee count-based estimation (primary method)
 * - Industry-specific multipliers from BLS data
 * - Multiple data points for confidence scoring
 * - Clear methodology disclosure for [Estimated] marking
 *
 * Methodology:
 * Revenue = Employee Count × Industry Revenue-per-Employee Multiplier
 *
 * Industry Benchmarks (Revenue per Employee):
 * - Professional Services: $150,000 - $300,000
 * - Technology: $200,000 - $500,000
 * - Real Estate Brokerage: $100,000 - $200,000 GCI
 * - Manufacturing: $150,000 - $250,000
 * - Retail: $150,000 - $250,000
 * - Healthcare: $100,000 - $200,000
 *
 * Data Sources (all FREE):
 * - LinkedIn employee count (via web search)
 * - Company website job postings
 * - Business registrations
 * - Industry databases
 */

import { tool } from "ai"
import { z } from "zod"
import { getLinkupApiKeyOptional, isLinkupEnabled } from "@/lib/linkup/config"
import { LinkupClient } from "linkup-sdk"

// ============================================================================
// TYPES
// ============================================================================

export interface RevenueEstimate {
  low: number
  mid: number
  high: number
}

export interface DataInput {
  indicator: string
  value: string | number
  source: string
  url?: string
  confidence: "high" | "medium" | "low"
}

export interface BusinessRevenueResult {
  companyName: string
  industry?: string
  estimatedRevenue: RevenueEstimate
  methodology: string
  inputs: DataInput[]
  confidence: "high" | "medium" | "low" | "very_low"
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// INDUSTRY BENCHMARKS
// ============================================================================

/**
 * Revenue per employee benchmarks by industry (in USD)
 * Based on BLS and industry data
 */
const INDUSTRY_BENCHMARKS: Record<
  string,
  {
    name: string
    revenuePerEmployee: { low: number; mid: number; high: number }
    keywords: string[]
  }
> = {
  technology: {
    name: "Technology / Software",
    revenuePerEmployee: { low: 200000, mid: 350000, high: 500000 },
    keywords: ["software", "tech", "technology", "saas", "app", "digital", "ai", "data"],
  },
  consulting: {
    name: "Consulting / Professional Services",
    revenuePerEmployee: { low: 150000, mid: 225000, high: 300000 },
    keywords: ["consulting", "advisory", "professional services", "management"],
  },
  real_estate: {
    name: "Real Estate",
    revenuePerEmployee: { low: 100000, mid: 150000, high: 200000 },
    keywords: ["real estate", "property", "realty", "broker", "development"],
  },
  financial_services: {
    name: "Financial Services",
    revenuePerEmployee: { low: 200000, mid: 400000, high: 600000 },
    keywords: ["financial", "investment", "wealth", "asset", "fund", "capital", "banking"],
  },
  healthcare: {
    name: "Healthcare",
    revenuePerEmployee: { low: 100000, mid: 150000, high: 200000 },
    keywords: ["healthcare", "medical", "health", "hospital", "clinic", "pharma"],
  },
  manufacturing: {
    name: "Manufacturing",
    revenuePerEmployee: { low: 150000, mid: 200000, high: 250000 },
    keywords: ["manufacturing", "factory", "production", "industrial"],
  },
  retail: {
    name: "Retail",
    revenuePerEmployee: { low: 150000, mid: 200000, high: 250000 },
    keywords: ["retail", "store", "shop", "commerce", "wholesale"],
  },
  construction: {
    name: "Construction",
    revenuePerEmployee: { low: 175000, mid: 250000, high: 350000 },
    keywords: ["construction", "builder", "contractor", "building"],
  },
  hospitality: {
    name: "Hospitality / Restaurant",
    revenuePerEmployee: { low: 50000, mid: 75000, high: 100000 },
    keywords: ["restaurant", "hotel", "hospitality", "food", "dining"],
  },
  legal: {
    name: "Legal Services",
    revenuePerEmployee: { low: 200000, mid: 300000, high: 400000 },
    keywords: ["law", "legal", "attorney", "lawyer"],
  },
  insurance: {
    name: "Insurance",
    revenuePerEmployee: { low: 150000, mid: 250000, high: 350000 },
    keywords: ["insurance", "underwriting", "risk"],
  },
  default: {
    name: "General Business",
    revenuePerEmployee: { low: 125000, mid: 175000, high: 225000 },
    keywords: [],
  },
}

// ============================================================================
// SCHEMAS
// ============================================================================

const businessRevenueSchema = z.object({
  companyName: z.string().describe("Company name to estimate revenue for"),
  industry: z
    .string()
    .optional()
    .describe(
      "Industry sector (e.g., 'technology', 'consulting', 'real estate', 'healthcare'). " +
        "If not provided, will attempt to determine from company description."
    ),
  state: z
    .string()
    .optional()
    .describe("State where company is headquartered (helps narrow search)"),
  employeeCount: z
    .number()
    .optional()
    .describe("Known employee count (if available, skips employee search)"),
})

export type BusinessRevenueParams = z.infer<typeof businessRevenueSchema>

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Detect industry from company name/description
 */
function detectIndustry(
  companyName: string,
  description?: string
): string {
  const text = `${companyName} ${description || ""}`.toLowerCase()

  for (const [key, industry] of Object.entries(INDUSTRY_BENCHMARKS)) {
    if (key === "default") continue
    for (const keyword of industry.keywords) {
      if (text.includes(keyword)) {
        return key
      }
    }
  }

  return "default"
}

/**
 * Get industry benchmark
 */
function getIndustryBenchmark(industry: string): {
  name: string
  revenuePerEmployee: { low: number; mid: number; high: number }
} {
  const normalized = industry.toLowerCase().replace(/[^a-z]/g, "_")

  for (const [key, benchmark] of Object.entries(INDUSTRY_BENCHMARKS)) {
    if (key === normalized) {
      return benchmark
    }
    // Check keywords
    for (const keyword of benchmark.keywords) {
      if (normalized.includes(keyword) || keyword.includes(normalized)) {
        return benchmark
      }
    }
  }

  return INDUSTRY_BENCHMARKS.default
}

/**
 * Search for employee count via Linkup
 */
async function searchEmployeeCount(
  companyName: string,
  state?: string
): Promise<{
  employeeCount: number | null
  sources: Array<{ name: string; url: string }>
  industry?: string
}> {
  const apiKey = getLinkupApiKeyOptional()
  if (!apiKey || !isLinkupEnabled()) {
    return { employeeCount: null, sources: [] }
  }

  const client = new LinkupClient({ apiKey })

  // Build search query
  const queryParts = [`"${companyName}"`, "employees", "company size", "staff"]
  if (state) queryParts.push(state)

  const query = queryParts.join(" ")

  console.log(`[Revenue Estimator] Searching employee count: ${query}`)

  try {
    const result = await client.search({
      query,
      depth: "standard",
      outputType: "sourcedAnswer",
    })

    if (!result.answer) {
      return { employeeCount: null, sources: [] }
    }

    // Parse employee count from answer
    const employeePatterns = [
      /(\d{1,3}(?:,\d{3})*)\s*(?:employees|staff|workers|team members)/gi,
      /(?:employs?|has|with)\s*(\d{1,3}(?:,\d{3})*)\s*(?:employees|people)/gi,
      /(?:company|firm|agency)\s*(?:of|with)\s*(\d{1,3}(?:,\d{3})*)/gi,
      /(\d{1,3}(?:,\d{3})*)\+?\s*employees/gi,
    ]

    let employeeCount: number | null = null
    const counts: number[] = []

    for (const pattern of employeePatterns) {
      let match
      while ((match = pattern.exec(result.answer)) !== null) {
        const count = parseInt(match[1].replace(/,/g, ""), 10)
        if (count > 0 && count < 1000000) {
          counts.push(count)
        }
      }
    }

    // Use median if multiple counts found
    if (counts.length > 0) {
      counts.sort((a, b) => a - b)
      employeeCount = counts[Math.floor(counts.length / 2)]
    }

    // Also try to detect industry from the answer
    let industry: string | undefined
    for (const [key, benchmark] of Object.entries(INDUSTRY_BENCHMARKS)) {
      if (key === "default") continue
      for (const keyword of benchmark.keywords) {
        if (result.answer.toLowerCase().includes(keyword)) {
          industry = key
          break
        }
      }
      if (industry) break
    }

    const sources = (result.sources || []).map(
      (s: { name?: string; url: string }) => ({
        name: s.name || "Company Information",
        url: s.url,
      })
    )

    return { employeeCount, sources, industry }
  } catch (error) {
    console.error("[Revenue Estimator] Search failed:", error)
    return { employeeCount: null, sources: [] }
  }
}

/**
 * Calculate revenue estimate from employee count
 */
function calculateRevenue(
  employeeCount: number,
  benchmark: { revenuePerEmployee: { low: number; mid: number; high: number } }
): RevenueEstimate {
  return {
    low: Math.round(employeeCount * benchmark.revenuePerEmployee.low),
    mid: Math.round(employeeCount * benchmark.revenuePerEmployee.mid),
    high: Math.round(employeeCount * benchmark.revenuePerEmployee.high),
  }
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(1)}B`
  }
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`
  }
  return `$${amount.toLocaleString()}`
}

/**
 * Determine confidence level
 */
function determineConfidence(
  inputs: DataInput[]
): "high" | "medium" | "low" | "very_low" {
  if (inputs.length === 0) return "very_low"

  const hasEmployeeCount = inputs.some((i) => i.indicator === "Employee Count")
  const hasMultipleSources = inputs.length >= 2

  if (hasEmployeeCount && hasMultipleSources) return "medium"
  if (hasEmployeeCount) return "low"
  return "very_low"
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const businessRevenueEstimatorTool = tool({
  description:
    "Estimate private company revenue using employee count and industry benchmarks. " +
    "Returns: revenue range (low/mid/high), methodology, confidence level. " +
    "Formula: Revenue = Employees × Industry Revenue-per-Employee. " +
    "All estimates clearly marked with [Estimated] and methodology. " +
    "Best for private companies without public financial data.",

  parameters: businessRevenueSchema,

  execute: async (params: BusinessRevenueParams): Promise<BusinessRevenueResult> => {
    console.log("[Revenue Estimator] Starting estimate:", params)

    const inputs: DataInput[] = []
    const sources: Array<{ name: string; url: string }> = []

    let employeeCount = params.employeeCount || null
    let detectedIndustry = params.industry

    // Search for employee count if not provided
    if (!employeeCount) {
      const searchResult = await searchEmployeeCount(params.companyName, params.state)
      employeeCount = searchResult.employeeCount
      sources.push(...searchResult.sources)

      if (searchResult.industry && !detectedIndustry) {
        detectedIndustry = searchResult.industry
      }

      if (employeeCount) {
        inputs.push({
          indicator: "Employee Count",
          value: employeeCount,
          source: "Web Search (LinkedIn/Company Info)",
          url: sources[0]?.url,
          confidence: "medium",
        })
      }
    } else {
      inputs.push({
        indicator: "Employee Count",
        value: employeeCount,
        source: "User Provided",
        confidence: "high",
      })
    }

    // Detect industry if not provided
    if (!detectedIndustry) {
      detectedIndustry = detectIndustry(params.companyName)
    }

    const benchmark = getIndustryBenchmark(detectedIndustry || "default")

    inputs.push({
      indicator: "Industry",
      value: benchmark.name,
      source: "Industry Classification",
      confidence: detectedIndustry ? "medium" : "low",
    })

    inputs.push({
      indicator: "Revenue/Employee Benchmark",
      value: `${formatCurrency(benchmark.revenuePerEmployee.low)} - ${formatCurrency(benchmark.revenuePerEmployee.high)}`,
      source: "BLS Industry Data",
      confidence: "medium",
    })

    // Calculate estimate
    let estimatedRevenue: RevenueEstimate = { low: 0, mid: 0, high: 0 }
    let methodology = ""

    if (employeeCount && employeeCount > 0) {
      estimatedRevenue = calculateRevenue(employeeCount, benchmark)
      methodology =
        `${employeeCount} employees × ${formatCurrency(benchmark.revenuePerEmployee.mid)}/employee (${benchmark.name} industry average)`
    } else {
      methodology = "Unable to estimate - no employee count found"
    }

    const confidence = determineConfidence(inputs)

    // Build raw content
    const rawLines: string[] = []
    rawLines.push("# Business Revenue Estimate")
    rawLines.push("")
    rawLines.push("## Company")
    rawLines.push(`- **Name:** ${params.companyName}`)
    if (params.state) rawLines.push(`- **State:** ${params.state}`)
    rawLines.push(`- **Industry:** ${benchmark.name}`)
    rawLines.push("")

    if (employeeCount && employeeCount > 0) {
      rawLines.push("## Revenue Estimate")
      rawLines.push("")
      rawLines.push(`| Range | Amount |`)
      rawLines.push(`|-------|--------|`)
      rawLines.push(`| Low | ${formatCurrency(estimatedRevenue.low)} |`)
      rawLines.push(`| **Mid** | **${formatCurrency(estimatedRevenue.mid)}** |`)
      rawLines.push(`| High | ${formatCurrency(estimatedRevenue.high)} |`)
      rawLines.push("")
      rawLines.push(`**Confidence:** ${confidence.toUpperCase()}`)
      rawLines.push("")
      rawLines.push("## Methodology")
      rawLines.push("")
      rawLines.push(`[ESTIMATED] ${methodology}`)
      rawLines.push("")
      rawLines.push("### Calculation")
      rawLines.push("```")
      rawLines.push(`Employee Count:     ${employeeCount.toLocaleString()}`)
      rawLines.push(`Industry:           ${benchmark.name}`)
      rawLines.push(`Rev/Employee Low:   ${formatCurrency(benchmark.revenuePerEmployee.low)}`)
      rawLines.push(`Rev/Employee Mid:   ${formatCurrency(benchmark.revenuePerEmployee.mid)}`)
      rawLines.push(`Rev/Employee High:  ${formatCurrency(benchmark.revenuePerEmployee.high)}`)
      rawLines.push("")
      rawLines.push(`Estimated Revenue:  ${formatCurrency(estimatedRevenue.low)} - ${formatCurrency(estimatedRevenue.high)}`)
      rawLines.push("```")
    } else {
      rawLines.push("## Revenue Estimate")
      rawLines.push("")
      rawLines.push("**Unable to estimate revenue** - no employee count found.")
      rawLines.push("")
      rawLines.push("**Suggestions:**")
      rawLines.push("- Provide employee count if known")
      rawLines.push("- Try searching for the company on LinkedIn")
      rawLines.push("- Check company website for team/careers page")
    }

    rawLines.push("")
    rawLines.push("## Data Inputs")
    for (const input of inputs) {
      rawLines.push(`- **${input.indicator}:** ${input.value} [${input.source}] (${input.confidence} confidence)`)
    }

    rawLines.push("")
    rawLines.push("## Sources")
    for (const source of sources) {
      rawLines.push(`- [${source.name}](${source.url})`)
    }
    if (sources.length === 0) {
      rawLines.push("- BLS Industry Revenue Benchmarks")
    }

    rawLines.push("")
    rawLines.push("---")
    rawLines.push("*Note: This is an ESTIMATE based on industry benchmarks. Actual revenue may vary significantly based on company-specific factors.*")

    const result: BusinessRevenueResult = {
      companyName: params.companyName,
      industry: benchmark.name,
      estimatedRevenue,
      methodology,
      inputs,
      confidence,
      rawContent: rawLines.join("\n"),
      sources,
    }

    return result
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Check if business revenue estimator tool should be enabled
 */
export function shouldEnableBusinessRevenueEstimatorTool(): boolean {
  // Works with or without Linkup (can use provided employee count)
  return true
}

/**
 * Get available industry categories
 */
export function getIndustryCategories(): string[] {
  return Object.values(INDUSTRY_BENCHMARKS)
    .filter((b) => b.name !== "General Business")
    .map((b) => b.name)
}
