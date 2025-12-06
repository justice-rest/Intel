/**
 * Batch Processing Tools Configuration
 * Provides the same tools available to the normal chat AI for batch research.
 * This allows batch processing to gather more grounded, data-rich results.
 */

import { ToolSet } from "ai"

// Import all the tools from lib/tools
import { linkupSearchTool, shouldEnableLinkupTool } from "@/lib/tools/linkup-search"
import {
  yahooFinanceQuoteTool,
  yahooFinanceSearchTool,
  yahooFinanceProfileTool,
  shouldEnableYahooFinanceTools,
} from "@/lib/tools/yahoo-finance"
import {
  propublicaNonprofitSearchTool,
  propublicaNonprofitDetailsTool,
  shouldEnableProPublicaTools,
} from "@/lib/tools/propublica-nonprofits"
import { secEdgarFilingsTool, shouldEnableSecEdgarTools } from "@/lib/tools/sec-edgar"
import { fecContributionsTool, shouldEnableFecTools } from "@/lib/tools/fec-contributions"
import { usGovDataTool, shouldEnableUsGovDataTools } from "@/lib/tools/us-gov-data"
import {
  wikidataSearchTool,
  wikidataEntityTool,
  shouldEnableWikidataTools,
} from "@/lib/tools/wikidata"

/**
 * Build the tools object for batch processing
 * Same tools as the chat API, minus user-specific tools (RAG, memory, documents)
 */
export function buildBatchTools(): ToolSet {
  const tools: ToolSet = {
    // Web Search Tool - Linkup for prospect research with curated domains
    ...(shouldEnableLinkupTool() ? { searchWeb: linkupSearchTool } : {}),

    // Financial Data Tools
    ...(shouldEnableYahooFinanceTools()
      ? {
          yahoo_finance_quote: yahooFinanceQuoteTool,
          yahoo_finance_search: yahooFinanceSearchTool,
          yahoo_finance_profile: yahooFinanceProfileTool,
        }
      : {}),

    // Nonprofit Research Tools
    ...(shouldEnableProPublicaTools()
      ? {
          propublica_nonprofit_search: propublicaNonprofitSearchTool,
          propublica_nonprofit_details: propublicaNonprofitDetailsTool,
        }
      : {}),

    // SEC EDGAR (public company filings)
    ...(shouldEnableSecEdgarTools() ? { sec_edgar_filings: secEdgarFilingsTool } : {}),

    // FEC Contributions (political giving)
    ...(shouldEnableFecTools() ? { fec_contributions: fecContributionsTool } : {}),

    // US Government Data (federal contracts, treasury, regulations)
    ...(shouldEnableUsGovDataTools() ? { us_gov_data: usGovDataTool } : {}),

    // Wikidata (biographical research)
    ...(shouldEnableWikidataTools()
      ? {
          wikidata_search: wikidataSearchTool,
          wikidata_entity: wikidataEntityTool,
        }
      : {}),
  }

  return tools
}

/**
 * Get a description of available tools for the system prompt
 */
export function getToolDescriptions(): string {
  const dataTools: string[] = []

  // Data API tools
  if (shouldEnableSecEdgarTools()) {
    dataTools.push("sec_edgar_filings (SEC 10-K/10-Q filings, financial statements, executive compensation)")
  }
  if (shouldEnableFecTools()) {
    dataTools.push("fec_contributions (FEC political contributions by individual name)")
  }
  if (shouldEnableYahooFinanceTools()) {
    dataTools.push("yahoo_finance_* (stock quotes, company profiles, insider holdings)")
  }
  if (shouldEnableProPublicaTools()) {
    dataTools.push("propublica_nonprofit_* (foundation 990s, nonprofit financials)")
  }
  if (shouldEnableUsGovDataTools()) {
    dataTools.push("us_gov_data (federal contracts/grants via USAspending, treasury data, regulations)")
  }
  if (shouldEnableWikidataTools()) {
    dataTools.push("wikidata_search/entity (biographical data: education, employers, positions, net worth, awards)")
  }

  const hasLinkup = shouldEnableLinkupTool()
  let description = ""

  if (hasLinkup || dataTools.length > 0) {
    description += `## Available Research Tools\n\n`

    if (hasLinkup) {
      description += `### searchWeb - Your Primary Research Tool
Use searchWeb for prospect research with curated domains (SEC filings, FEC contributions, foundation 990s, property records, corporate data).
Run 6-10 searchWeb queries per prospect with different angles:
- Property: "[address] home value Zillow Redfin", "[address] property records"
- Business: "[name] founder CEO business [city]", "[name] LLC [state]"
- Philanthropy: "[name] foundation board nonprofit", "[name] donor charitable giving"\n\n`
    }

    if (dataTools.length > 0) {
      description += `### Data API Tools\n${dataTools.map((t) => `- ${t}`).join("\n")}\n\n`
      description += `**Usage:**
- sec_edgar_filings: Public company financials, 10-K/10-Q, executive compensation
- fec_contributions: Political contribution history by individual name
- yahoo_finance_*: Stock data, company profiles, insider holdings
- propublica_nonprofit_*: Foundation 990s, nonprofit financials (search by ORG name)
- us_gov_data: Federal contracts/grants by company/org name
- wikidata_search/entity: Biographical data (education, employers, net worth)\n\n`
    }

    description += `### Research Strategy
1. Run 6-10 **searchWeb** queries covering property, business, philanthropy
2. Use **data API tools** to get detailed info on discovered entities
3. **propublica workflow**: searchWeb to find nonprofit names → propublica_nonprofit_search with ORG name
4. Run tools in parallel when possible. Be thorough.\n`
  }

  return description
}

/**
 * Extract sources from tool results for display
 * Handles the various source formats returned by different tools
 */
export function extractSourcesFromToolResults(
  toolResults: Array<{ toolName: string; result: unknown }>
): Array<{ name: string; url: string }> {
  const sources: Array<{ name: string; url: string }> = []
  const seenUrls = new Set<string>()

  for (const { result } of toolResults) {
    if (!result || typeof result !== "object") continue

    // Handle tools that return sources array (Linkup)
    const resultObj = result as Record<string, unknown>
    if (Array.isArray(resultObj.sources)) {
      for (const source of resultObj.sources as Array<{ name?: string; title?: string; url?: string }>) {
        if (source.url && !seenUrls.has(source.url)) {
          seenUrls.add(source.url)
          sources.push({
            name: source.name || source.title || new URL(source.url).hostname,
            url: source.url,
          })
        }
      }
    }

    // Handle tools that return results array
    if (Array.isArray(resultObj.results)) {
      for (const item of resultObj.results as Array<{ title?: string; url?: string }>) {
        if (item.url && !seenUrls.has(item.url)) {
          seenUrls.add(item.url)
          sources.push({
            name: item.title || new URL(item.url).hostname,
            url: item.url,
          })
        }
      }
    }

    // Handle SEC EDGAR which has filings with URLs
    if (Array.isArray(resultObj.filings)) {
      for (const filing of resultObj.filings as Array<{ url?: string; formType?: string; fiscalYear?: number }>) {
        if (filing.url && !seenUrls.has(filing.url)) {
          seenUrls.add(filing.url)
          sources.push({
            name: `SEC ${filing.formType || "Filing"} (${filing.fiscalYear || ""})`,
            url: filing.url,
          })
        }
      }
    }
  }

  return sources
}
