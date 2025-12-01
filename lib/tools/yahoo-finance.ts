/**
 * Yahoo Finance Tool
 * Provides stock quotes, company profiles, insider transactions, and financial data
 * for prospect research and wealth screening.
 *
 * Uses yahoo-finance2 package - https://www.npmjs.com/package/yahoo-finance2
 */

import { tool } from "ai"
import { z } from "zod"
import YahooFinance from "yahoo-finance2"

// Create singleton Yahoo Finance instance (v3.x requires instantiation)
const yahooFinanceInstance = new YahooFinance()

function getYahooFinance() {
  return yahooFinanceInstance
}

// Type definitions for yahoo-finance2 responses
interface YahooQuote {
  symbol?: string
  shortName?: string
  longName?: string
  regularMarketPrice?: number
  regularMarketChange?: number
  regularMarketChangePercent?: number
  marketCap?: number
  currency?: string
  exchange?: string
  quoteType?: string
}

interface YahooSearchQuote {
  symbol: string
  shortname?: string
  longname?: string
  exchDisp?: string
  typeDisp?: string
}

interface YahooSearchResponse {
  quotes?: YahooSearchQuote[]
}

interface YahooCompanyOfficer {
  name?: string
  title?: string
  totalPay?: number
  exercisedValue?: number
  unexercisedValue?: number
}

interface YahooInsiderHolder {
  name?: string
  relation?: string
  positionDirect?: number
  positionDirectDate?: Date
  latestTransDate?: Date
  transactionDescription?: string
}

interface YahooAssetProfile {
  longBusinessSummary?: string
  companyOfficers?: YahooCompanyOfficer[]
  industry?: string
  sector?: string
  website?: string
  address1?: string
  city?: string
  state?: string
  country?: string
  fullTimeEmployees?: number
}

interface YahooSummaryDetail {
  marketCap?: number
}

interface YahooInsiderHolders {
  holders?: YahooInsiderHolder[]
}

interface YahooMajorHoldersBreakdown {
  insidersPercentHeld?: number
  institutionsPercentHeld?: number
  institutionsFloatPercentHeld?: number
  institutionsCount?: number
}

interface YahooQuoteSummary {
  assetProfile?: YahooAssetProfile
  summaryDetail?: YahooSummaryDetail
  insiderHolders?: YahooInsiderHolders
  majorHoldersBreakdown?: YahooMajorHoldersBreakdown
}

// ============================================================================
// SCHEMAS
// ============================================================================

const yahooFinanceQuoteSchema = z.object({
  symbol: z
    .string()
    .describe("Stock ticker symbol (e.g., 'AAPL', 'GOOGL', 'MSFT')"),
})

const yahooFinanceSearchSchema = z.object({
  query: z
    .string()
    .describe("Company name or partial ticker to search for (e.g., 'Apple', 'Microsoft')"),
})

const yahooFinanceProfileSchema = z.object({
  symbol: z
    .string()
    .describe("Stock ticker symbol to get company profile and executive info"),
  modules: z
    .array(z.enum([
      "assetProfile",
      "summaryProfile",
      "summaryDetail",
      "financialData",
      "majorHoldersBreakdown",
      "insiderHolders",
      "insiderTransactions",
      "institutionOwnership",
      "fundOwnership",
      "secFilings",
    ]))
    .optional()
    .default(["assetProfile", "summaryDetail", "insiderHolders", "majorHoldersBreakdown"])
    .describe("Data modules to retrieve. Default includes company profile, insider holders, and major holders."),
})

// ============================================================================
// TYPES
// ============================================================================

export interface YahooQuoteResult {
  symbol: string
  shortName?: string
  longName?: string
  regularMarketPrice?: number
  regularMarketChange?: number
  regularMarketChangePercent?: number
  marketCap?: number
  currency?: string
  exchange?: string
  quoteType?: string
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

export interface YahooSearchResult {
  results: Array<{
    symbol: string
    shortname?: string
    longname?: string
    exchDisp?: string
    typeDisp?: string
  }>
  query: string
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

export interface YahooProfileResult {
  symbol: string
  companyName?: string
  industry?: string
  sector?: string
  website?: string
  address?: string
  city?: string
  state?: string
  country?: string
  employees?: number
  executives?: Array<{
    name: string
    title: string
    totalPay?: number
    exercisedValue?: number
    unexercisedValue?: number
  }>
  insiderHolders?: Array<{
    name: string
    relation?: string
    positionDirect?: number
    positionDirectDate?: string
    latestTransDate?: string
    transactionDescription?: string
  }>
  majorHolders?: {
    insidersPercentHeld?: number
    institutionsPercentHeld?: number
    institutionsFloatPercentHeld?: number
    institutionsCount?: number
  }
  marketCap?: number
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

function formatCurrency(value: number | undefined, currency?: string): string {
  if (value === undefined) return "N/A"
  const curr = currency || "USD"
  if (value >= 1_000_000_000_000) {
    return `${curr} ${(value / 1_000_000_000_000).toFixed(2)}T`
  } else if (value >= 1_000_000_000) {
    return `${curr} ${(value / 1_000_000_000).toFixed(2)}B`
  } else if (value >= 1_000_000) {
    return `${curr} ${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `${curr} ${(value / 1_000).toFixed(2)}K`
  }
  return `${curr} ${value.toFixed(2)}`
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) return "N/A"
  return `${(value * 100).toFixed(2)}%`
}

function formatQuoteForAI(quote: YahooQuote, symbol: string): string {
  const lines: string[] = []
  lines.push(`# Yahoo Finance Quote: ${quote.longName || quote.shortName || symbol}`)
  lines.push("")
  lines.push(`**Symbol:** ${quote.symbol || symbol}`)
  if (quote.exchange) lines.push(`**Exchange:** ${quote.exchange}`)
  if (quote.quoteType) lines.push(`**Type:** ${quote.quoteType}`)
  lines.push("")
  lines.push("## Market Data")
  if (quote.regularMarketPrice !== undefined) {
    lines.push(`- **Current Price:** ${formatCurrency(quote.regularMarketPrice, quote.currency)}`)
  }
  if (quote.regularMarketChange !== undefined) {
    const changeSign = quote.regularMarketChange >= 0 ? "+" : ""
    lines.push(`- **Change:** ${changeSign}${quote.regularMarketChange.toFixed(2)} (${changeSign}${quote.regularMarketChangePercent?.toFixed(2) || "N/A"}%)`)
  }
  if (quote.marketCap !== undefined) {
    lines.push(`- **Market Cap:** ${formatCurrency(quote.marketCap, quote.currency)}`)
  }
  lines.push("")
  lines.push("## Source")
  lines.push(`- [Yahoo Finance - ${symbol}](https://finance.yahoo.com/quote/${symbol})`)
  return lines.join("\n")
}

function formatSearchForAI(results: YahooSearchQuote[], query: string): string {
  const lines: string[] = []
  lines.push(`# Yahoo Finance Search Results for "${query}"`)
  lines.push("")
  if (results.length === 0) {
    lines.push("No results found.")
    return lines.join("\n")
  }
  lines.push(`Found ${results.length} result${results.length === 1 ? "" : "s"}:`)
  lines.push("")
  results.forEach((r, i) => {
    lines.push(`## ${i + 1}. ${r.longname || r.shortname || r.symbol}`)
    lines.push(`- **Symbol:** ${r.symbol}`)
    if (r.exchDisp) lines.push(`- **Exchange:** ${r.exchDisp}`)
    if (r.typeDisp) lines.push(`- **Type:** ${r.typeDisp}`)
    lines.push("")
  })
  lines.push("## Source")
  lines.push(`- [Yahoo Finance Search](https://finance.yahoo.com/lookup?s=${encodeURIComponent(query)})`)
  return lines.join("\n")
}

function formatProfileForAI(
  symbol: string,
  profile: YahooAssetProfile | undefined,
  summaryDetail: YahooSummaryDetail | undefined,
  insiderHolders: YahooInsiderHolders | undefined,
  majorHolders: YahooMajorHoldersBreakdown | undefined
): string {
  const lines: string[] = []
  lines.push(`# Yahoo Finance Profile: ${symbol}`)
  lines.push("")

  // Company Info
  if (profile) {
    lines.push("## Company Information")
    if (profile.industry) lines.push(`- **Industry:** ${profile.industry}`)
    if (profile.sector) lines.push(`- **Sector:** ${profile.sector}`)
    if (profile.website) lines.push(`- **Website:** ${profile.website}`)
    if (profile.fullTimeEmployees) lines.push(`- **Employees:** ${profile.fullTimeEmployees.toLocaleString()}`)
    if (profile.address1 || profile.city || profile.state || profile.country) {
      const location = [profile.address1, profile.city, profile.state, profile.country].filter(Boolean).join(", ")
      lines.push(`- **Location:** ${location}`)
    }
    lines.push("")
  }

  // Market Cap
  if (summaryDetail?.marketCap) {
    lines.push("## Market Data")
    lines.push(`- **Market Cap:** ${formatCurrency(summaryDetail.marketCap)}`)
    lines.push("")
  }

  // Executives
  if (profile?.companyOfficers && profile.companyOfficers.length > 0) {
    lines.push("## Key Executives")
    profile.companyOfficers.slice(0, 10).forEach((officer) => {
      lines.push(`### ${officer.name || "Unknown"}`)
      lines.push(`- **Title:** ${officer.title || "Unknown"}`)
      if (officer.totalPay) lines.push(`- **Total Pay:** ${formatCurrency(officer.totalPay)}`)
      if (officer.exercisedValue) lines.push(`- **Exercised Options:** ${formatCurrency(officer.exercisedValue)}`)
      if (officer.unexercisedValue) lines.push(`- **Unexercised Options:** ${formatCurrency(officer.unexercisedValue)}`)
      lines.push("")
    })
  }

  // Insider Holders
  if (insiderHolders?.holders && insiderHolders.holders.length > 0) {
    lines.push("## Insider Holders")
    insiderHolders.holders.slice(0, 10).forEach((holder) => {
      lines.push(`### ${holder.name || "Unknown"}`)
      if (holder.relation) lines.push(`- **Relation:** ${holder.relation}`)
      if (holder.positionDirect) lines.push(`- **Shares Held:** ${holder.positionDirect.toLocaleString()}`)
      if (holder.transactionDescription) lines.push(`- **Latest Transaction:** ${holder.transactionDescription}`)
      if (holder.latestTransDate) lines.push(`- **Transaction Date:** ${holder.latestTransDate.toISOString().split("T")[0]}`)
      lines.push("")
    })
  }

  // Major Holders Breakdown
  if (majorHolders) {
    lines.push("## Ownership Breakdown")
    if (majorHolders.insidersPercentHeld !== undefined) {
      lines.push(`- **Insider Ownership:** ${formatPercent(majorHolders.insidersPercentHeld)}`)
    }
    if (majorHolders.institutionsPercentHeld !== undefined) {
      lines.push(`- **Institutional Ownership:** ${formatPercent(majorHolders.institutionsPercentHeld)}`)
    }
    if (majorHolders.institutionsFloatPercentHeld !== undefined) {
      lines.push(`- **Institutional Float:** ${formatPercent(majorHolders.institutionsFloatPercentHeld)}`)
    }
    if (majorHolders.institutionsCount !== undefined) {
      lines.push(`- **Number of Institutions:** ${majorHolders.institutionsCount.toLocaleString()}`)
    }
    lines.push("")
  }

  lines.push("## Source")
  lines.push(`- [Yahoo Finance - ${symbol}](https://finance.yahoo.com/quote/${symbol})`)
  return lines.join("\n")
}

// ============================================================================
// TIMEOUT HELPER
// ============================================================================

const YAHOO_FINANCE_TIMEOUT_MS = 15000

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

// ============================================================================
// TOOLS
// ============================================================================

/**
 * Get stock quote for a ticker symbol
 */
export const yahooFinanceQuoteTool = tool({
  description:
    "Get current stock quote and market data for a ticker symbol. " +
    "Returns price, market cap, and basic company info. " +
    "Use this to quickly check stock prices and market valuations for prospect research.",
  parameters: yahooFinanceQuoteSchema,
  execute: async ({ symbol }): Promise<YahooQuoteResult> => {
    console.log("[Yahoo Finance] Getting quote for:", symbol)
    const startTime = Date.now()

    try {
      const yf = getYahooFinance()
      const quote = await withTimeout(
        yf.quote(symbol.toUpperCase()) as Promise<YahooQuote>,
        YAHOO_FINANCE_TIMEOUT_MS,
        `Yahoo Finance quote timed out after ${YAHOO_FINANCE_TIMEOUT_MS / 1000} seconds`
      )

      const duration = Date.now() - startTime
      console.log("[Yahoo Finance] Quote retrieved in", duration, "ms")

      const rawContent = formatQuoteForAI(quote, symbol)
      const sources = [{ name: `Yahoo Finance - ${symbol}`, url: `https://finance.yahoo.com/quote/${symbol}` }]

      return {
        symbol: quote.symbol || symbol,
        shortName: quote.shortName,
        longName: quote.longName,
        regularMarketPrice: quote.regularMarketPrice,
        regularMarketChange: quote.regularMarketChange,
        regularMarketChangePercent: quote.regularMarketChangePercent,
        marketCap: quote.marketCap,
        currency: quote.currency,
        exchange: quote.exchange,
        quoteType: quote.quoteType,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[Yahoo Finance] Quote failed:", errorMessage)
      return {
        symbol,
        rawContent: `# Yahoo Finance Quote Error\n\nFailed to get quote for ${symbol}: ${errorMessage}`,
        sources: [],
        error: `Failed to get quote: ${errorMessage}`,
      }
    }
  },
})

/**
 * Search for companies by name
 */
export const yahooFinanceSearchTool = tool({
  description:
    "Search for companies by name to find their stock ticker symbols. " +
    "Use this when you know a company name but need to find the ticker symbol " +
    "for further research (e.g., search 'Apple' to find 'AAPL').",
  parameters: yahooFinanceSearchSchema,
  execute: async ({ query }): Promise<YahooSearchResult> => {
    console.log("[Yahoo Finance] Searching for:", query)
    const startTime = Date.now()

    try {
      const yf = getYahooFinance()
      const searchResult = await withTimeout(
        yf.search(query) as Promise<YahooSearchResponse>,
        YAHOO_FINANCE_TIMEOUT_MS,
        `Yahoo Finance search timed out after ${YAHOO_FINANCE_TIMEOUT_MS / 1000} seconds`
      )

      const duration = Date.now() - startTime
      console.log("[Yahoo Finance] Search completed in", duration, "ms, found", searchResult.quotes?.length || 0, "results")

      const quotes = (searchResult.quotes || []).slice(0, 10)
      const rawContent = formatSearchForAI(quotes, query)
      const sources = [{ name: "Yahoo Finance Search", url: `https://finance.yahoo.com/lookup?s=${encodeURIComponent(query)}` }]

      return {
        results: quotes.map((q) => ({
          symbol: q.symbol,
          shortname: q.shortname,
          longname: q.longname,
          exchDisp: q.exchDisp,
          typeDisp: q.typeDisp,
        })),
        query,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[Yahoo Finance] Search failed:", errorMessage)
      return {
        results: [],
        query,
        rawContent: `# Yahoo Finance Search Error\n\nFailed to search for "${query}": ${errorMessage}`,
        sources: [],
        error: `Failed to search: ${errorMessage}`,
      }
    }
  },
})

/**
 * Get detailed company profile with executives and insider holdings
 */
export const yahooFinanceProfileTool = tool({
  description:
    "Get detailed company profile including executives, insider holdings, and institutional ownership. " +
    "Essential for prospect research - shows executive compensation, insider transactions, " +
    "and major shareholders. Use after finding a ticker symbol.",
  parameters: yahooFinanceProfileSchema,
  execute: async ({ symbol, modules }): Promise<YahooProfileResult> => {
    console.log("[Yahoo Finance] Getting profile for:", symbol, "modules:", modules)
    const startTime = Date.now()

    try {
      const yf = getYahooFinance()
      const summary = await withTimeout(
        yf.quoteSummary(symbol.toUpperCase(), { modules }) as Promise<YahooQuoteSummary>,
        YAHOO_FINANCE_TIMEOUT_MS,
        `Yahoo Finance profile timed out after ${YAHOO_FINANCE_TIMEOUT_MS / 1000} seconds`
      )

      const duration = Date.now() - startTime
      console.log("[Yahoo Finance] Profile retrieved in", duration, "ms")

      const profile = summary.assetProfile
      const summaryDetail = summary.summaryDetail
      const insiderHolders = summary.insiderHolders
      const majorHolders = summary.majorHoldersBreakdown

      const rawContent = formatProfileForAI(symbol, profile, summaryDetail, insiderHolders, majorHolders)
      const sources = [{ name: `Yahoo Finance - ${symbol}`, url: `https://finance.yahoo.com/quote/${symbol}` }]

      return {
        symbol,
        companyName: profile?.longBusinessSummary ? undefined : profile?.companyOfficers?.[0]?.name,
        industry: profile?.industry,
        sector: profile?.sector,
        website: profile?.website,
        address: profile?.address1,
        city: profile?.city,
        state: profile?.state,
        country: profile?.country,
        employees: profile?.fullTimeEmployees,
        executives: profile?.companyOfficers?.slice(0, 10).map((officer: YahooCompanyOfficer) => ({
          name: officer.name || "Unknown",
          title: officer.title || "Unknown",
          totalPay: officer.totalPay,
          exercisedValue: officer.exercisedValue,
          unexercisedValue: officer.unexercisedValue,
        })),
        insiderHolders: insiderHolders?.holders?.slice(0, 10).map((holder: YahooInsiderHolder) => ({
          name: holder.name || "Unknown",
          relation: holder.relation,
          positionDirect: holder.positionDirect,
          positionDirectDate: holder.positionDirectDate?.toISOString(),
          latestTransDate: holder.latestTransDate?.toISOString(),
          transactionDescription: holder.transactionDescription,
        })),
        majorHolders: majorHolders ? {
          insidersPercentHeld: majorHolders.insidersPercentHeld,
          institutionsPercentHeld: majorHolders.institutionsPercentHeld,
          institutionsFloatPercentHeld: majorHolders.institutionsFloatPercentHeld,
          institutionsCount: majorHolders.institutionsCount,
        } : undefined,
        marketCap: summaryDetail?.marketCap,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[Yahoo Finance] Profile failed:", errorMessage)
      return {
        symbol,
        rawContent: `# Yahoo Finance Profile Error\n\nFailed to get profile for ${symbol}: ${errorMessage}`,
        sources: [],
        error: `Failed to get profile: ${errorMessage}`,
      }
    }
  },
})

/**
 * Check if Yahoo Finance tools should be enabled
 * Yahoo Finance doesn't require an API key - it's always available
 */
export function shouldEnableYahooFinanceTools(): boolean {
  return true
}
