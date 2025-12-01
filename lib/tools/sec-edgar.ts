/**
 * SEC EDGAR Tool
 * Provides access to SEC filings, financial reports, and company data
 * for prospect research and wealth screening.
 *
 * Uses sec-edgar-api package - https://github.com/andyevers/sec-edgar-api
 * No API key required - fetches directly from SEC EDGAR with throttling
 */

import { tool } from "ai"
import { z } from "zod"
import { secEdgarApi } from "sec-edgar-api"

// ============================================================================
// TYPES
// ============================================================================

// The sec-edgar-api package returns ReportTranslated objects
// We use a simplified interface for type safety while accessing any properties
interface SecReportData {
  cik?: number
  url?: string | null
  dateReport?: string
  dateFiled?: string
  fiscalPeriod?: string
  fiscalYear?: number
  // Balance Sheet
  assetTotal?: number | null
  assetCurrent?: number | null
  assetNonCurrent?: number | null
  liabilityTotal?: number | null
  liabilityCurrent?: number | null
  liabilityNonCurrent?: number | null
  equityTotal?: number | null
  equityRetainedEarnings?: number | null
  // Income Statement
  revenueTotal?: number | null
  revenueCost?: number | null
  incomeNet?: number | null
  incomeOperating?: number | null
  // Cash Flow
  cashFlowOperating?: number | null
  cashFlowInvesting?: number | null
  cashFlowFinancing?: number | null
  // Shares & Earnings
  sharesOutstanding?: number | null
  sharesOutstandingDiluted?: number | null
  eps?: number | null
  epsDiluted?: number | null
  // Other metrics (may or may not be present)
  propertyPlantEquipment?: number | null
  goodwill?: number | null
  intangibleAssets?: number | null
  debt?: number | null
  debtCurrent?: number | null
  debtNonCurrent?: number | null
  // Allow any other properties from the API
  [key: string]: unknown
}

export interface SecEdgarFilingsResult {
  symbol: string
  cik?: number
  filings: Array<{
    dateReport: string
    dateFiled: string
    fiscalPeriod: string
    fiscalYear: number
    formType: string
    url: string | null
    // Key financial metrics for wealth assessment
    totalAssets: number | null
    totalLiabilities: number | null
    totalEquity: number | null
    netIncome: number | null
    revenue: number | null
    eps: number | null
    sharesOutstanding: number | null
    marketCapEstimate: number | null
  }>
  // Raw content for AI analysis (formatted text)
  rawContent: string
  error?: string
}

// ============================================================================
// SCHEMAS
// ============================================================================

const secEdgarFilingsSchema = z.object({
  symbol: z
    .string()
    .describe("Stock ticker symbol (e.g., 'AAPL', 'GOOGL', 'MSFT')"),
  limit: z
    .number()
    .optional()
    .default(5)
    .describe("Maximum number of filings to return (default: 5, max: 20)"),
})

// ============================================================================
// TIMEOUT HELPER
// ============================================================================

const SEC_EDGAR_TIMEOUT_MS = 30000 // 30 seconds - SEC can be slow

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format currency for display
 */
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "N/A"
  if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

/**
 * Format raw report data into readable text for AI consumption
 */
function formatReportForAI(report: SecReportData, symbol: string): string {
  const lines: string[] = [
    `## SEC Filing: ${symbol} - ${report.fiscalPeriod || "Unknown"} ${report.fiscalYear || ""}`,
    `**Filed:** ${report.dateFiled || "N/A"} | **Report Date:** ${report.dateReport || "N/A"}`,
    `**CIK:** ${report.cik || "N/A"}`,
    "",
    "### Balance Sheet",
    `- Total Assets: ${formatCurrency(report.assetTotal ?? null)}`,
    `- Current Assets: ${formatCurrency(report.assetCurrent ?? null)}`,
    `- Total Liabilities: ${formatCurrency(report.liabilityTotal ?? null)}`,
    `- Total Equity: ${formatCurrency(report.equityTotal ?? null)}`,
    `- Retained Earnings: ${formatCurrency(report.equityRetainedEarnings ?? null)}`,
    `- Property, Plant & Equipment: ${formatCurrency(report.propertyPlantEquipment ?? null)}`,
    `- Goodwill: ${formatCurrency(report.goodwill ?? null)}`,
    `- Intangible Assets: ${formatCurrency(report.intangibleAssets ?? null)}`,
    `- Total Debt: ${formatCurrency(report.debt ?? null)}`,
    "",
    "### Income Statement",
    `- Total Revenue: ${formatCurrency(report.revenueTotal ?? null)}`,
    `- Cost of Revenue: ${formatCurrency(report.revenueCost ?? null)}`,
    `- Operating Income: ${formatCurrency(report.incomeOperating ?? null)}`,
    `- Net Income: ${formatCurrency(report.incomeNet ?? null)}`,
    `- EPS (Basic): ${report.eps != null ? `$${Number(report.eps).toFixed(2)}` : "N/A"}`,
    `- EPS (Diluted): ${report.epsDiluted != null ? `$${Number(report.epsDiluted).toFixed(2)}` : "N/A"}`,
    "",
    "### Cash Flow",
    `- Operating Cash Flow: ${formatCurrency(report.cashFlowOperating ?? null)}`,
    `- Investing Cash Flow: ${formatCurrency(report.cashFlowInvesting ?? null)}`,
    `- Financing Cash Flow: ${formatCurrency(report.cashFlowFinancing ?? null)}`,
    "",
    "### Share Information",
    `- Shares Outstanding: ${report.sharesOutstanding != null ? Number(report.sharesOutstanding).toLocaleString() : "N/A"}`,
    `- Shares Outstanding (Diluted): ${report.sharesOutstandingDiluted != null ? Number(report.sharesOutstandingDiluted).toLocaleString() : "N/A"}`,
  ]

  if (report.url) {
    lines.push("", `**Source:** ${report.url}`)
  }

  return lines.join("\n")
}

/**
 * Determine form type from fiscal period
 */
function getFormType(fiscalPeriod: string): string {
  if (fiscalPeriod === "FY") return "10-K"
  if (fiscalPeriod.startsWith("Q")) return "10-Q"
  return "Filing"
}

// ============================================================================
// TOOLS
// ============================================================================

/**
 * Get SEC EDGAR filings and financial data for a company
 */
export const secEdgarFilingsTool = tool({
  description:
    "Get SEC EDGAR filings and financial reports for a public company by ticker symbol. " +
    "Returns 10-K (annual) and 10-Q (quarterly) financial data including balance sheet, " +
    "income statement, cash flow, and share information. Essential for wealth assessment " +
    "of executives and major shareholders. No API key required.",
  parameters: secEdgarFilingsSchema,
  execute: async ({ symbol, limit = 5 }): Promise<SecEdgarFilingsResult> => {
    console.log("[SEC EDGAR] Getting filings for:", symbol, "limit:", limit)
    const startTime = Date.now()

    try {
      // Fetch reports from SEC EDGAR API
      const reports = await withTimeout(
        secEdgarApi.getReports({ symbol: symbol.toUpperCase() }),
        SEC_EDGAR_TIMEOUT_MS,
        `SEC EDGAR request timed out after ${SEC_EDGAR_TIMEOUT_MS / 1000} seconds`
      )

      const duration = Date.now() - startTime
      console.log("[SEC EDGAR] Retrieved", reports.length, "reports in", duration, "ms")

      if (!reports || reports.length === 0) {
        return {
          symbol: symbol.toUpperCase(),
          filings: [],
          rawContent: `No SEC filings found for ${symbol.toUpperCase()}. This may not be a publicly traded company or the ticker symbol may be incorrect.`,
          error: "No filings found",
        }
      }

      // Cast reports to our flexible type - sec-edgar-api returns ReportTranslated objects
      const typedReports = reports as unknown as SecReportData[]

      // Limit results and extract the most recent filings
      const limitedReports = typedReports.slice(0, Math.min(limit, 20))

      // Extract CIK from first report
      const cik = limitedReports[0]?.cik

      // Format filings for structured output
      const filings = limitedReports.map((report) => {
        // Estimate market cap if we have shares and a reasonable price estimate
        let marketCapEstimate: number | null = null
        const shares = report.sharesOutstanding as number | null
        const equity = report.equityTotal as number | null
        if (shares && equity) {
          // Very rough estimate: equity per share as proxy
          const bookValuePerShare = equity / shares
          // Market typically trades at 1-5x book value for healthy companies
          marketCapEstimate = shares * bookValuePerShare * 2
        }

        return {
          dateReport: String(report.dateReport || ""),
          dateFiled: String(report.dateFiled || ""),
          fiscalPeriod: String(report.fiscalPeriod || ""),
          fiscalYear: Number(report.fiscalYear) || 0,
          formType: getFormType(String(report.fiscalPeriod || "")),
          url: report.url as string | null,
          totalAssets: (report.assetTotal as number | null) ?? null,
          totalLiabilities: (report.liabilityTotal as number | null) ?? null,
          totalEquity: equity,
          netIncome: (report.incomeNet as number | null) ?? null,
          revenue: (report.revenueTotal as number | null) ?? null,
          eps: (report.eps as number | null) ?? null,
          sharesOutstanding: shares,
          marketCapEstimate,
        }
      })

      // Generate raw content for AI analysis
      const rawContentParts: string[] = [
        `# SEC EDGAR Filings for ${symbol.toUpperCase()}`,
        `**CIK:** ${cik || "Unknown"}`,
        `**Total Filings Found:** ${reports.length}`,
        `**Showing:** ${limitedReports.length} most recent`,
        "",
        "---",
        "",
      ]

      limitedReports.forEach((report) => {
        rawContentParts.push(formatReportForAI(report, symbol.toUpperCase()))
        rawContentParts.push("")
        rawContentParts.push("---")
        rawContentParts.push("")
      })

      return {
        symbol: symbol.toUpperCase(),
        cik,
        filings,
        rawContent: rawContentParts.join("\n"),
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[SEC EDGAR] Failed:", errorMessage)
      return {
        symbol: symbol.toUpperCase(),
        filings: [],
        rawContent: `Failed to retrieve SEC filings for ${symbol.toUpperCase()}: ${errorMessage}`,
        error: `Failed to get SEC filings: ${errorMessage}`,
      }
    }
  },
})

/**
 * Check if SEC EDGAR tools should be enabled
 * SEC EDGAR API doesn't require an API key - it's always available
 */
export function shouldEnableSecEdgarTools(): boolean {
  return true
}
