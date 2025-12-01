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
