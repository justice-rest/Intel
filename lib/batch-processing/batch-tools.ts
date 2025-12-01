/**
 * Batch Processing Tools Configuration
 * Provides the same tools available to the normal chat AI for batch research.
 * This allows batch processing to gather more grounded, data-rich results.
 */

import { ToolSet } from "ai"

// Import all the tools from lib/tools
import { linkupSearchTool, shouldEnableLinkupTool } from "@/lib/tools/linkup-search"
import { exaSearchTool, shouldEnableExaTool } from "@/lib/tools/exa-search"
import { tavilySearchTool, shouldEnableTavilyTool } from "@/lib/tools/tavily-search"
import { firecrawlSearchTool, shouldEnableFirecrawlTool } from "@/lib/tools/firecrawl-search"
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
    // Web Search Tools
    ...(shouldEnableLinkupTool() ? { searchWeb: linkupSearchTool } : {}),
    ...(shouldEnableExaTool() ? { exaSearch: exaSearchTool } : {}),
    ...(shouldEnableTavilyTool() ? { tavilySearch: tavilySearchTool } : {}),
    ...(shouldEnableFirecrawlTool() ? { firecrawlSearch: firecrawlSearchTool } : {}),

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
  const searchTools: string[] = []
  const dataTools: string[] = []

  // Search tools
  if (shouldEnableLinkupTool()) {
    searchTools.push("searchWeb (YOUR PRIMARY TOOL - property values, business ownership, SEC, FEC, 990s, corporate filings)")
  }
  if (shouldEnableExaTool()) {
    searchTools.push("exaSearch (semantic search, broad web, finding similar content)")
  }
  if (shouldEnableTavilyTool()) {
    searchTools.push("tavilySearch (news, current events, real-time facts)")
  }
  if (shouldEnableFirecrawlTool()) {
    searchTools.push("firecrawlSearch (general web search, documentation, articles)")
  }

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

  let description = ""

  if (searchTools.length > 0 || dataTools.length > 0) {
    description += `## Available Research Tools\n\n`

    if (searchTools.length > 0) {
      description += `### Web Search Tools (USE AGGRESSIVELY)\n${searchTools.map((t) => `- ${t}`).join("\n")}\n\n`
      description += `**searchWeb is your PRIMARY research tool. Use it REPEATEDLY with different query variations.**
Each search costs ~$0.005 - essentially free. Run 8-12 searchWeb queries minimum per prospect.

**HOME VALUATION SEARCHES (run 3-4):**
- "[address] home value Zillow Redfin"
- "[address] property records tax assessment"
- "[address] sold price history"
- "[county] assessor [address]"

**BUSINESS OWNERSHIP SEARCHES (run 3-4):**
- "[name] owner founder business [city]"
- "[name] CEO president LLC [state]"
- "[state] secretary of state [name]"
- If you find a company: "[company name] revenue employees"

**PHILANTHROPIC SEARCHES (run 2-3):**
- "[name] foundation board nonprofit"
- "[name] donor charitable giving"
- "[name] FEC political contributions"\n\n`
    }

    if (dataTools.length > 0) {
      description += `### Data API Tools (Use AFTER web search to get detailed data)\n${dataTools.map((t) => `- ${t}`).join("\n")}\n\n`
      description += `**Usage Guidance:**
- Use sec_edgar_filings for public company financial data (10-K, 10-Q, balance sheets, income statements, executive compensation)
- Use fec_contributions to search FEC records for political contribution history
- Use yahoo_finance_quote/search/profile for stock prices, market cap, company profiles, executives
- Use propublica_nonprofit_search/details for foundation 990 data, nonprofit financials, EIN lookups
- Use us_gov_data for federal contracts, grants, treasury data, and regulations
- Use wikidata_search/entity for biographical data (education, employers, positions, net worth)\n\n`
    }

    description += `### Research Strategy
1. **Start with 8-12 searchWeb queries** covering property, business, and philanthropy
2. **Don't stop if results are limited** - reformulate and search again with different terms
3. **Go deep**: Use data API tools for detailed information on entities you discover
4. **Person-to-Nonprofit Workflow**:
   - First searchWeb for the person's name + "foundation board nonprofit"
   - Extract organization names and EINs from results
   - Then query ProPublica with discovered organizations for 990 financial data\n`
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

    // Handle tools that return sources array
    const resultObj = result as Record<string, unknown>
    if (Array.isArray(resultObj.sources)) {
      for (const source of resultObj.sources as Array<{ name?: string; url?: string }>) {
        if (source.url && !seenUrls.has(source.url)) {
          seenUrls.add(source.url)
          sources.push({
            name: source.name || new URL(source.url).hostname,
            url: source.url,
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
