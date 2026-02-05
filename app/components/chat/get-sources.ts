import type { ChatMessagePart } from "@/lib/ai/message-utils"
import { getLegacyToolInvocationParts } from "@/lib/ai/message-utils"
import type { SourceUIPart } from "@ai-sdk/ui-utils"

type SourceItem = SourceUIPart["source"]

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null

const asArray = <T>(value: unknown): T[] | null =>
  Array.isArray(value) ? (value as T[]) : null

const createUrlSource = (url: string, title?: string, id?: string): SourceItem => ({
  sourceType: "url",
  id: id || url,
  url,
  title: title ?? url,
})

const isDefined = <T>(value: T | null | undefined): value is T => value != null

const normalizeSource = (value: unknown): SourceItem | null => {
  const record = asRecord(value)
  if (!record) return null
  const url = typeof record.url === "string" ? record.url : undefined
  if (!url) return null
  const title = typeof record.title === "string" ? record.title : undefined
  const id = typeof record.id === "string" ? record.id : undefined
  return createUrlSource(url, title, id)
}

export function getSources(parts: ChatMessagePart[] | undefined): SourceItem[] {
  if (!parts || parts.length === 0) return []

  const directSources = parts
    .filter((part) => part && typeof part === "object" && "type" in part)
    .map((part) => {
      if (part.type === "source") {
        const source = (part as { source: { id?: string; url: string; title?: string } }).source
        return createUrlSource(source.url, source.title || source.url, source.id)
      }

      if (part.type === "source-url") {
        const source = part as { sourceId: string; url: string; title?: string }
        return createUrlSource(source.url, source.title || source.url, source.sourceId)
      }

      if (part.type === "source-document") {
        const source = part as {
          sourceId: string
          title: string
          filename?: string
          mediaType?: string
          providerMetadata?: { url?: string }
        }
        const url = source.providerMetadata?.url
        if (!url) return null
        return createUrlSource(url, source.title || source.filename || "Document", source.sourceId)
      }

      return null
    })
    .filter(isDefined)

  const toolSources = getLegacyToolInvocationParts(parts)
    .filter((part) => part.toolInvocation.state === "result")
    .flatMap((part) => {
      const result = part.toolInvocation.result
      const resultRecord = asRecord(result)

      // Handle LinkUp prospect research tool results
      // Enhanced: Includes field attribution when available
      if (
        part.toolInvocation.toolName === "linkup_prospect_research" &&
        resultRecord?.sources
      ) {
        const sources = asArray<{
          name?: string
          url: string
          snippet?: string
          fieldName?: string // Which field this source supports
          reasoning?: string // AI reasoning for relevance
        }>(resultRecord.sources)

        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "Source")
        )
      }

      // Handle You.com search tool results (matches Linkup format)
      if (part.toolInvocation.toolName === "youSearch" && resultRecord?.sources) {
        const sources = asArray<{ name?: string; url: string; snippet?: string }>(
          resultRecord.sources
        )
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "Untitled")
        )
      }

      // Handle Grok search tool results
      if (part.toolInvocation.toolName === "grokSearch" && resultRecord?.results) {
        const results = asArray<{ title?: string; url: string; snippet?: string }>(
          resultRecord.results
        )
        if (!results) return []

        return results.map((item) =>
          createUrlSource(item.url, item.title || "Untitled")
        )
      }

      // Handle Tavily search tool results
      if (part.toolInvocation.toolName === "tavilySearch" && resultRecord?.results) {
        const results = asArray<{ title?: string; url: string; snippet?: string }>(
          resultRecord.results
        )
        if (!results) return []

        return results.map((item) =>
          createUrlSource(item.url, item.title || "Untitled")
        )
      }

      // Handle Firecrawl search tool results
      if (part.toolInvocation.toolName === "firecrawlSearch" && resultRecord?.results) {
        const results = asArray<{ title?: string; url: string; snippet?: string }>(
          resultRecord.results
        )
        if (!results) return []

        return results.map((item) =>
          createUrlSource(item.url, item.title || "Untitled")
        )
      }

      // Handle Jina DeepSearch tool results
      if (part.toolInvocation.toolName === "jinaDeepSearch" && resultRecord?.sources) {
        const sources = asArray<{ title?: string; url: string; snippet?: string }>(
          resultRecord.sources
        )
        if (!sources) return []

        return sources.map((item) =>
          createUrlSource(item.url, item.title || "Untitled")
        )
      }

      // Handle Brave Search (searchWebGeneral) tool results
      if (part.toolInvocation.toolName === "searchWebGeneral" && resultRecord?.results) {
        const results = asArray<{ title?: string; url: string; snippet?: string }>(
          resultRecord.results
        )
        if (!results) return []

        return results.map((item) =>
          createUrlSource(item.url, item.title || "Untitled")
        )
      }

      // Handle SEC EDGAR filings tool results
      if (part.toolInvocation.toolName === "sec_edgar_filings" && resultRecord?.filings) {
        const filings = asArray<{
          url?: string | null
          formType?: string
          fiscalYear?: number
          fiscalPeriod?: string
        }>(resultRecord.filings)
        const sources = (filings || [])
          .filter((filing) => filing.url)
          .map((filing) =>
            createUrlSource(
              filing.url as string,
              `SEC ${filing.formType || "Filing"} - ${filing.fiscalPeriod || ""} ${filing.fiscalYear || ""}`.trim()
            )
          )
        // Add link to SEC EDGAR search
        const symbol = typeof resultRecord.symbol === "string" ? resultRecord.symbol : undefined
        const cik = typeof resultRecord.cik === "string" ? resultRecord.cik : undefined
        if (symbol) {
          sources.push(
            createUrlSource(
              `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik || symbol}&type=10&dateb=&owner=include&count=40`,
              `SEC EDGAR - ${symbol}`
            )
          )
        }
        return sources
      }

      // Handle FEC contributions tool results
      if (part.toolInvocation.toolName === "fec_contributions" && resultRecord?.sources) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "FEC Record")
        )
      }

      // Handle US Government Data tool results
      if (part.toolInvocation.toolName === "us_gov_data" && resultRecord?.sources) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "Government Data")
        )
      }

      // Handle Property Valuation (AVM) tool results
      if (part.toolInvocation.toolName === "property_valuation" && resultRecord?.sources) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "Property Data")
        )
      }

      // Handle Business Registry Scraper tool results
      if (
        part.toolInvocation.toolName === "business_registry_scraper" &&
        resultRecord?.sources
      ) {
        const sources = asArray<{ name: string; url: string; snippet?: string }>(
          resultRecord.sources
        )
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "Business Registry")
        )
      }

      // Handle summarizeSources tool results
      if (part.toolInvocation.toolName === "summarizeSources" && resultRecord?.result) {
        const resultItems = asArray<{ citations?: unknown[] }>(resultRecord.result)
        if (!resultItems) return []
        return resultItems
          .flatMap((item) => item.citations || [])
          .map(normalizeSource)
          .filter(isDefined)
      }

      // Handle ProPublica Nonprofit tools
      if (
        (part.toolInvocation.toolName === "propublica_nonprofit_search" ||
          part.toolInvocation.toolName === "propublica_nonprofit_details") &&
        resultRecord?.sources
      ) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "ProPublica Nonprofit")
        )
      }

      // Handle SEC Insider tools
      if (
        (part.toolInvocation.toolName === "sec_insider_search" ||
          part.toolInvocation.toolName === "sec_proxy_search") &&
        resultRecord?.sources
      ) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "SEC EDGAR")
        )
      }

      // Handle Wikidata tools
      if (
        (part.toolInvocation.toolName === "wikidata_search" ||
          part.toolInvocation.toolName === "wikidata_entity") &&
        resultRecord?.sources
      ) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "Wikidata")
        )
      }

      // Handle CourtListener tools
      if (
        (part.toolInvocation.toolName === "court_search" ||
          part.toolInvocation.toolName === "judge_search") &&
        resultRecord?.sources
      ) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "CourtListener")
        )
      }

      // Handle Household search
      if (part.toolInvocation.toolName === "household_search" && resultRecord?.sources) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "Household Data")
        )
      }

      // Handle Business affiliation search
      if (
        part.toolInvocation.toolName === "business_affiliation_search" &&
        resultRecord?.sources
      ) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "Business Affiliation")
        )
      }

      // Handle Nonprofit affiliation search
      if (
        part.toolInvocation.toolName === "nonprofit_affiliation_search" &&
        resultRecord?.sources
      ) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "Nonprofit Affiliation")
        )
      }

      // Handle Nonprofit board search
      if (
        part.toolInvocation.toolName === "nonprofit_board_search" &&
        resultRecord?.sources
      ) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "Board Position")
        )
      }

      // Handle Giving history
      if (part.toolInvocation.toolName === "giving_history" && resultRecord?.sources) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "Giving History")
        )
      }

      // Handle Prospect scoring
      if (part.toolInvocation.toolName === "prospect_score" && resultRecord?.sources) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "Prospect Data")
        )
      }

      // Handle Prospect report
      if (part.toolInvocation.toolName === "prospect_report" && resultRecord?.sources) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "Research Report")
        )
      }

      // Handle Rental investment
      if (part.toolInvocation.toolName === "rental_investment" && resultRecord?.sources) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "Rental Data")
        )
      }

      // Handle Find business ownership
      if (
        part.toolInvocation.toolName === "find_business_ownership" &&
        resultRecord?.sources
      ) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "Ownership Data")
        )
      }

      // Handle CRM tools
      if (
        (part.toolInvocation.toolName === "crm_search" ||
          part.toolInvocation.toolName.startsWith("neon_crm_")) &&
        resultRecord?.sources
      ) {
        const sources = asArray<{ name?: string; url: string; title?: string }>(
          resultRecord.sources
        )
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || source.title || "CRM Record")
        )
      }

      // Handle GLEIF LEI tools
      if (
        (part.toolInvocation.toolName === "gleif_search" ||
          part.toolInvocation.toolName === "gleif_lookup") &&
        resultRecord?.sources
      ) {
        const sources = asArray<{ name: string; url: string }>(resultRecord.sources)
        if (!sources) return []

        return sources.map((source) =>
          createUrlSource(source.url, source.name || "GLEIF Record")
        )
      }

      if (Array.isArray(result)) {
        return result
          .flat()
          .map(normalizeSource)
          .filter(isDefined)
      }

      const normalized = normalizeSource(result)
      return normalized ? [normalized] : []
    })

  const sources = [...directSources, ...toolSources]

  const validSources =
    sources?.filter(
      (source) =>
        source && typeof source === "object" && "url" in source && source.url && source.url !== ""
    ) || []

  return validSources
}
