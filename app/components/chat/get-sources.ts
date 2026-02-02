/**
 * Extract sources from message parts for citation display
 *
 * AI SDK v5 Migration Note:
 * - v4: parts have type: "tool-invocation" with toolInvocation.toolName, toolInvocation.result
 * - v5: parts have type: "tool-{toolName}" with output directly on the part
 * - v5: "source" type is now "source-url" or "source-document"
 */

import type { UIMessage as MessageAISDK } from "ai"

// Helper to get tool name from either v4 or v5 format
function getToolName(part: any): string | null {
  // v5 format: type is "tool-{toolName}"
  if (part.type.startsWith("tool-") && part.type !== "tool-invocation") {
    return part.type.replace("tool-", "")
  }
  // v4 format: toolName is in toolInvocation
  if (part.type === "tool-invocation" && part.toolInvocation?.toolName) {
    return part.toolInvocation.toolName
  }
  return null
}

// Helper to get tool result from either v4 or v5 format
function getToolResult(part: any): any {
  // v5 format: output is directly on the part
  if (part.output !== undefined) {
    return part.output
  }
  // v4 format: result is in toolInvocation.result
  if (part.toolInvocation?.result !== undefined) {
    return part.toolInvocation.result
  }
  return null
}

// Helper to check if tool has completed (v4 or v5)
function isToolComplete(part: any): boolean {
  // v5 format: state is on the part directly
  if (part.state === "result" || part.state === "completed") {
    return true
  }
  // v4 format: state is in toolInvocation
  if (part.toolInvocation?.state === "result") {
    return true
  }
  return false
}

// Helper to check if part is a tool part
function isToolPart(part: any): boolean {
  return part.type === "tool-invocation" || part.type.startsWith("tool-")
}

// Helper to check if part is a source part (v4 or v5)
function isSourcePart(part: any): boolean {
  return part.type === "source" || part.type === "source-url" || part.type === "source-document"
}

export function getSources(parts: MessageAISDK["parts"]) {
  const sources = parts
    ?.filter(
      (part) => isSourcePart(part) || isToolPart(part)
    )
    .map((part) => {
      // Handle source parts (v4: "source", v5: "source-url" or "source-document")
      if (isSourcePart(part)) {
        const anyPart = part as any
        // v5 source-url format
        if (part.type === "source-url" && anyPart.url) {
          return {
            title: anyPart.title || "Source",
            url: anyPart.url,
            text: anyPart.description || "",
          }
        }
        // v5 source-document format
        if (part.type === "source-document") {
          return {
            title: anyPart.title || "Document",
            url: anyPart.url || "",
            text: anyPart.description || anyPart.content?.substring(0, 200) || "",
          }
        }
        // v4 "source" format
        if (anyPart.source) {
          return anyPart.source
        }
        return null
      }

      // Handle tool parts
      if (isToolPart(part) && isToolComplete(part)) {
        const toolName = getToolName(part)
        const result = getToolResult(part)

        if (!toolName || !result) return null

        // Handle LinkUp prospect research tool results
        if (toolName === "linkup_prospect_research" && result?.sources) {
          return result.sources.map((source: {
            name?: string
            url: string
            snippet?: string
            fieldName?: string
            reasoning?: string
          }) => ({
            title: source.name || "Source",
            url: source.url,
            text: source.fieldName
              ? `[${source.fieldName}] ${source.snippet || source.reasoning || ""}`
              : (source.snippet || ""),
          }))
        }

        // Handle You.com search tool results
        if (toolName === "youSearch" && result?.sources) {
          return result.sources.map((source: { name?: string; url: string; snippet?: string }) => ({
            title: source.name || "Untitled",
            url: source.url,
            text: source.snippet || "",
          }))
        }

        // Handle Grok search tool results
        if (toolName === "grokSearch" && result?.results) {
          return result.results.map((r: { title?: string; url: string; snippet?: string }) => ({
            title: r.title || "Untitled",
            url: r.url,
            text: r.snippet || "",
          }))
        }

        // Handle Tavily search tool results
        if (toolName === "tavilySearch" && result?.results) {
          return result.results.map((r: { title?: string; url: string; snippet?: string }) => ({
            title: r.title || "Untitled",
            url: r.url,
            text: r.snippet || "",
          }))
        }

        // Handle Firecrawl search tool results
        if (toolName === "firecrawlSearch" && result?.results) {
          return result.results.map((r: { title?: string; url: string; snippet?: string }) => ({
            title: r.title || "Untitled",
            url: r.url,
            text: r.snippet || "",
          }))
        }

        // Handle Jina DeepSearch tool results
        if (toolName === "jinaDeepSearch" && result?.sources) {
          return result.sources.map((s: { title?: string; url: string; snippet?: string }) => ({
            title: s.title || "Untitled",
            url: s.url,
            text: s.snippet || "",
          }))
        }

        // Handle Brave Search (searchWebGeneral) tool results
        if (toolName === "searchWebGeneral" && result?.results) {
          return result.results.map((r: { title?: string; url: string; snippet?: string }) => ({
            title: r.title || "Untitled",
            url: r.url,
            text: r.snippet || "",
          }))
        }

        // Handle SEC EDGAR filings tool results
        if (toolName === "sec_edgar_filings" && result?.filings) {
          const sources = result.filings
            .filter((f: { url?: string | null }) => f.url)
            .map((f: { formType?: string; fiscalYear?: number; fiscalPeriod?: string; url: string }) => ({
              title: `SEC ${f.formType || "Filing"} - ${f.fiscalPeriod || ""} ${f.fiscalYear || ""}`.trim(),
              url: f.url,
              text: `${f.formType || "SEC Filing"} for fiscal ${f.fiscalPeriod || ""} ${f.fiscalYear || ""}`,
            }))
          if (result.symbol) {
            sources.push({
              title: `SEC EDGAR - ${result.symbol}`,
              url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${result.cik || result.symbol}&type=10&dateb=&owner=include&count=40`,
              text: `SEC EDGAR filings for ${result.symbol}`,
            })
          }
          return sources
        }

        // Handle FEC contributions tool results
        if (toolName === "fec_contributions" && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "FEC Record",
            url: s.url,
            text: `FEC contribution record`,
          }))
        }

        // Handle US Government Data tool results
        if (toolName === "us_gov_data" && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Government Data",
            url: s.url,
            text: `US Government data from ${result.dataSource || "federal API"}`,
          }))
        }

        // Handle Property Valuation (AVM) tool results
        if (toolName === "property_valuation" && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Property Data",
            url: s.url,
            text: `Property valuation source`,
          }))
        }

        // Handle Business Registry Scraper tool results
        if (toolName === "business_registry_scraper" && result?.sources) {
          return result.sources.map((s: { name: string; url: string; snippet?: string }) => ({
            title: s.name || "Business Registry",
            url: s.url,
            text: s.snippet || `Business registry data from ${result.sourcesSuccessful?.join(", ") || "registry"}`,
          }))
        }

        // Handle summarizeSources tool results
        if (toolName === "summarizeSources" && result?.result?.[0]?.citations) {
          return result.result.flatMap((item: { citations?: unknown[] }) => item.citations || [])
        }

        // Handle ProPublica Nonprofit tools
        if ((toolName === "propublica_nonprofit_search" || toolName === "propublica_nonprofit_details") && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "ProPublica Nonprofit",
            url: s.url,
            text: "Nonprofit data from ProPublica",
          }))
        }

        // Handle SEC Insider tools
        if ((toolName === "sec_insider_search" || toolName === "sec_proxy_search") && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "SEC EDGAR",
            url: s.url,
            text: "SEC filing data",
          }))
        }

        // Handle Wikidata tools
        if ((toolName === "wikidata_search" || toolName === "wikidata_entity") && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Wikidata",
            url: s.url,
            text: "Biographical data from Wikidata",
          }))
        }

        // Handle CourtListener tools
        if ((toolName === "court_search" || toolName === "judge_search") && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "CourtListener",
            url: s.url,
            text: "Federal court records",
          }))
        }

        // Handle Household search
        if (toolName === "household_search" && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Household Data",
            url: s.url,
            text: "Household wealth assessment",
          }))
        }

        // Handle Business affiliation search
        if (toolName === "business_affiliation_search" && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Business Affiliation",
            url: s.url,
            text: "Corporate role data",
          }))
        }

        // Handle Nonprofit affiliation search
        if (toolName === "nonprofit_affiliation_search" && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Nonprofit Affiliation",
            url: s.url,
            text: "Nonprofit connection data",
          }))
        }

        // Handle Nonprofit board search
        if (toolName === "nonprofit_board_search" && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Board Position",
            url: s.url,
            text: "Nonprofit board data",
          }))
        }

        // Handle Giving history
        if (toolName === "giving_history" && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Giving History",
            url: s.url,
            text: "Donation records",
          }))
        }

        // Handle Prospect scoring
        if (toolName === "prospect_score" && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Prospect Data",
            url: s.url,
            text: "Prospect research source",
          }))
        }

        // Handle Prospect report
        if (toolName === "prospect_report" && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Research Report",
            url: s.url,
            text: "Prospect report source",
          }))
        }

        // Handle Rental investment
        if (toolName === "rental_investment" && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Rental Data",
            url: s.url,
            text: "Rental valuation source",
          }))
        }

        // Handle Find business ownership
        if (toolName === "find_business_ownership" && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Ownership Data",
            url: s.url,
            text: "Business ownership source",
          }))
        }

        // Handle CRM tools
        if ((toolName === "crm_search" || toolName.startsWith("neon_crm_")) && result?.sources) {
          return result.sources.map((s: { name?: string; url: string; title?: string }) => ({
            title: s.name || s.title || "CRM Record",
            url: s.url,
            text: "CRM data",
          }))
        }

        // Handle GLEIF LEI tools
        if ((toolName === "gleif_search" || toolName === "gleif_lookup") && result?.sources) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "GLEIF Record",
            url: s.url,
            text: "Global LEI data",
          }))
        }

        // Generic fallback for tools with sources
        if (result?.sources && Array.isArray(result.sources)) {
          return result.sources.map((s: any) => ({
            title: s.name || s.title || "Source",
            url: s.url || "",
            text: s.snippet || s.description || "",
          }))
        }

        return Array.isArray(result) ? result.flat() : result
      }

      return null
    })
    .filter(Boolean)
    .flat()

  const validSources =
    sources?.filter(
      (source) =>
        source && typeof source === "object" && source.url && source.url !== ""
    ) || []

  return validSources
}
