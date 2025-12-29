import type { Message as MessageAISDK } from "@ai-sdk/react"

export function getSources(parts: MessageAISDK["parts"]) {
  const sources = parts
    ?.filter(
      (part) => part.type === "source" || part.type === "tool-invocation"
    )
    .map((part) => {
      if (part.type === "source") {
        return part.source
      }

      if (
        part.type === "tool-invocation" &&
        part.toolInvocation.state === "result"
      ) {
        const result = part.toolInvocation.result

        // Handle Parallel AI prospect research tool results (Task API + Search API)
        // Enhanced: Includes field attribution from Task API basis when available
        if (
          part.toolInvocation.toolName === "parallel_prospect_research" &&
          result?.sources
        ) {
          return result.sources.map((source: {
            name?: string
            url: string
            snippet?: string
            fieldName?: string    // From Task API basis - which field this source supports
            reasoning?: string    // From Task API basis - AI reasoning for relevance
          }) => ({
            title: source.name || "Source",
            url: source.url,
            // Include field attribution in text if available (e.g., "[realEstate] Property records...")
            text: source.fieldName
              ? `[${source.fieldName}] ${source.snippet || source.reasoning || ""}`
              : (source.snippet || ""),
          }))
        }

        // Handle You.com search tool results (matches Linkup format)
        if (
          part.toolInvocation.toolName === "youSearch" &&
          result?.sources
        ) {
          return result.sources.map((source: { name?: string; url: string; snippet?: string }) => ({
            title: source.name || "Untitled",
            url: source.url,
            text: source.snippet || "",
          }))
        }

        // Handle Grok search tool results
        if (
          part.toolInvocation.toolName === "grokSearch" &&
          result?.results
        ) {
          return result.results.map((r: { title?: string; url: string; snippet?: string }) => ({
            title: r.title || "Untitled",
            url: r.url,
            text: r.snippet || "",
          }))
        }

        // Handle Tavily search tool results
        if (
          part.toolInvocation.toolName === "tavilySearch" &&
          result?.results
        ) {
          return result.results.map((r: { title?: string; url: string; snippet?: string }) => ({
            title: r.title || "Untitled",
            url: r.url,
            text: r.snippet || "",
          }))
        }

        // Handle Firecrawl search tool results
        if (
          part.toolInvocation.toolName === "firecrawlSearch" &&
          result?.results
        ) {
          return result.results.map((r: { title?: string; url: string; snippet?: string }) => ({
            title: r.title || "Untitled",
            url: r.url,
            text: r.snippet || "",
          }))
        }

        // Handle Jina DeepSearch tool results
        if (
          part.toolInvocation.toolName === "jinaDeepSearch" &&
          result?.sources
        ) {
          return result.sources.map((s: { title?: string; url: string; snippet?: string }) => ({
            title: s.title || "Untitled",
            url: s.url,
            text: s.snippet || "",
          }))
        }

        // Handle Brave Search (searchWebGeneral) tool results
        if (
          part.toolInvocation.toolName === "searchWebGeneral" &&
          result?.results
        ) {
          return result.results.map((r: { title?: string; url: string; snippet?: string }) => ({
            title: r.title || "Untitled",
            url: r.url,
            text: r.snippet || "",
          }))
        }

        // Handle SEC EDGAR filings tool results
        if (
          part.toolInvocation.toolName === "sec_edgar_filings" &&
          result?.filings
        ) {
          const sources = result.filings
            .filter((f: { url?: string | null }) => f.url)
            .map((f: { formType?: string; fiscalYear?: number; fiscalPeriod?: string; url: string }) => ({
              title: `SEC ${f.formType || "Filing"} - ${f.fiscalPeriod || ""} ${f.fiscalYear || ""}`.trim(),
              url: f.url,
              text: `${f.formType || "SEC Filing"} for fiscal ${f.fiscalPeriod || ""} ${f.fiscalYear || ""}`,
            }))
          // Add link to SEC EDGAR search
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
        if (
          part.toolInvocation.toolName === "fec_contributions" &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "FEC Record",
            url: s.url,
            text: `FEC contribution record`,
          }))
        }

        // Handle US Government Data tool results
        if (
          part.toolInvocation.toolName === "us_gov_data" &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Government Data",
            url: s.url,
            text: `US Government data from ${result.dataSource || "federal API"}`,
          }))
        }

        // Handle Property Valuation (AVM) tool results
        if (
          part.toolInvocation.toolName === "property_valuation" &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Property Data",
            url: s.url,
            text: `Property valuation source`,
          }))
        }

        // Handle Business Registry Scraper tool results
        if (
          part.toolInvocation.toolName === "business_registry_scraper" &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string; snippet?: string }) => ({
            title: s.name || "Business Registry",
            url: s.url,
            text: s.snippet || `Business registry data from ${result.sourcesSuccessful?.join(", ") || "registry"}`,
          }))
        }

        // Handle summarizeSources tool results
        if (
          part.toolInvocation.toolName === "summarizeSources" &&
          result?.result?.[0]?.citations
        ) {
          return result.result.flatMap((item: { citations?: unknown[] }) => item.citations || [])
        }

        // Handle ProPublica Nonprofit tools
        if (
          (part.toolInvocation.toolName === "propublica_nonprofit_search" ||
           part.toolInvocation.toolName === "propublica_nonprofit_details") &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "ProPublica Nonprofit",
            url: s.url,
            text: "Nonprofit data from ProPublica",
          }))
        }

        // Handle SEC Insider tools
        if (
          (part.toolInvocation.toolName === "sec_insider_search" ||
           part.toolInvocation.toolName === "sec_proxy_search") &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "SEC EDGAR",
            url: s.url,
            text: "SEC filing data",
          }))
        }

        // Handle Wikidata tools
        if (
          (part.toolInvocation.toolName === "wikidata_search" ||
           part.toolInvocation.toolName === "wikidata_entity") &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Wikidata",
            url: s.url,
            text: "Biographical data from Wikidata",
          }))
        }

        // Handle CourtListener tools
        if (
          (part.toolInvocation.toolName === "court_search" ||
           part.toolInvocation.toolName === "judge_search") &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "CourtListener",
            url: s.url,
            text: "Federal court records",
          }))
        }

        // Handle Household search
        if (
          part.toolInvocation.toolName === "household_search" &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Household Data",
            url: s.url,
            text: "Household wealth assessment",
          }))
        }

        // Handle Business affiliation search
        if (
          part.toolInvocation.toolName === "business_affiliation_search" &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Business Affiliation",
            url: s.url,
            text: "Corporate role data",
          }))
        }

        // Handle Nonprofit affiliation search
        if (
          part.toolInvocation.toolName === "nonprofit_affiliation_search" &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Nonprofit Affiliation",
            url: s.url,
            text: "Nonprofit connection data",
          }))
        }

        // Handle Nonprofit board search
        if (
          part.toolInvocation.toolName === "nonprofit_board_search" &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Board Position",
            url: s.url,
            text: "Nonprofit board data",
          }))
        }

        // Handle Giving history
        if (
          part.toolInvocation.toolName === "giving_history" &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Giving History",
            url: s.url,
            text: "Donation records",
          }))
        }

        // Handle Prospect scoring
        if (
          part.toolInvocation.toolName === "prospect_score" &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Prospect Data",
            url: s.url,
            text: "Prospect research source",
          }))
        }

        // Handle Prospect report
        if (
          part.toolInvocation.toolName === "prospect_report" &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Research Report",
            url: s.url,
            text: "Prospect report source",
          }))
        }

        // Handle Rental investment
        if (
          part.toolInvocation.toolName === "rental_investment" &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Rental Data",
            url: s.url,
            text: "Rental valuation source",
          }))
        }

        // Handle Find business ownership
        if (
          part.toolInvocation.toolName === "find_business_ownership" &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "Ownership Data",
            url: s.url,
            text: "Business ownership source",
          }))
        }

        // Handle CRM tools
        if (
          (part.toolInvocation.toolName === "crm_search" ||
           part.toolInvocation.toolName.startsWith("neon_crm_")) &&
          result?.sources
        ) {
          return result.sources.map((s: { name?: string; url: string; title?: string }) => ({
            title: s.name || s.title || "CRM Record",
            url: s.url,
            text: "CRM data",
          }))
        }

        // Handle GLEIF LEI tools
        if (
          (part.toolInvocation.toolName === "gleif_search" ||
           part.toolInvocation.toolName === "gleif_lookup") &&
          result?.sources
        ) {
          return result.sources.map((s: { name: string; url: string }) => ({
            title: s.name || "GLEIF Record",
            url: s.url,
            text: "Global LEI data",
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
