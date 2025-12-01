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

        // Handle Linkup search tool results (sourcedAnswer format)
        if (
          part.toolInvocation.toolName === "searchWeb" &&
          result?.sources
        ) {
          // Map Linkup's source format to our standard format
          return result.sources.map((source: { name?: string; url: string; snippet?: string }) => ({
            title: source.name || "Untitled",
            url: source.url,
            text: source.snippet || "",
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

        // Handle Exa search tool results
        if (
          part.toolInvocation.toolName === "exaSearch" &&
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

        // Handle summarizeSources tool results
        if (
          part.toolInvocation.toolName === "summarizeSources" &&
          result?.result?.[0]?.citations
        ) {
          return result.result.flatMap((item: { citations?: unknown[] }) => item.citations || [])
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
