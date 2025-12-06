"use client"

import { cn } from "@/lib/utils"
import type { ToolInvocationUIPart } from "@ai-sdk/ui-utils"
import {
  CaretDown,
  CheckCircle,
  Code,
  Link,
  Nut,
  Spinner,
  Wrench,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useState } from "react"

interface ToolInvocationProps {
  toolInvocations: ToolInvocationUIPart[]
  className?: string
  defaultOpen?: boolean
}

const TRANSITION = {
  type: "spring" as const,
  duration: 0.2,
  bounce: 0,
}

/**
 * Maps internal tool names to user-friendly display names
 */
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  searchWeb: "Web Search",
  exaSearch: "Web Search: Additional",
  tavilySearch: "News Search",
  firecrawlSearch: "Documents & Socials",
  propublica_nonprofit_search: "Nonprofit Search",
  propublica_nonprofit_details: "Nonprofit Details",
  yahoo_finance_quote: "Stock Quote",
  yahoo_finance_search: "Stock Search",
  yahoo_finance_profile: "Company Profile",
  rag_search: "Document Search",
  list_documents: "List Documents",
  search_memory: "Memory Search",
  sec_edgar_filings: "SEC Filings",
  fec_contributions: "Political Contributions",
  us_gov_data: "US Government Data",
  wikidata_search: "Wikidata Search",
  wikidata_entity: "Wikidata Profile",
  property_valuation: "Property Valuation",
}

/**
 * Get user-friendly display name for a tool
 */
function getToolDisplayName(toolName: string): string {
  return TOOL_DISPLAY_NAMES[toolName] || toolName
}

export function ToolInvocation({
  toolInvocations,
  defaultOpen = false,
}: ToolInvocationProps) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen)

  const toolInvocationsData = Array.isArray(toolInvocations)
    ? toolInvocations
    : [toolInvocations]

  // Group tool invocations by toolCallId
  const groupedTools = toolInvocationsData.reduce(
    (acc, item) => {
      const { toolCallId } = item.toolInvocation
      if (!acc[toolCallId]) {
        acc[toolCallId] = []
      }
      acc[toolCallId].push(item)
      return acc
    },
    {} as Record<string, ToolInvocationUIPart[]>
  )

  const uniqueToolIds = Object.keys(groupedTools)
  const isSingleTool = uniqueToolIds.length === 1

  // Calculate aggregate status for the header badge
  const anyRunning = uniqueToolIds.some((toolId) => {
    const tools = groupedTools[toolId]
    return tools?.some((t) => t.toolInvocation.state === "call")
  })

  const allCompleted = uniqueToolIds.every((toolId) => {
    const tools = groupedTools[toolId]
    return tools?.some((t) => t.toolInvocation.state === "result")
  })

  const aggregateStatus = anyRunning ? "running" : allCompleted ? "completed" : "pending"

  if (isSingleTool) {
    return (
      <SingleToolView
        toolInvocations={toolInvocationsData}
        defaultOpen={defaultOpen}
        className="mb-10"
      />
    )
  }

  return (
    <div className="mb-10">
      <div className="border-border flex flex-col gap-0 overflow-hidden rounded-md border">
        <button
          onClick={(e) => {
            e.preventDefault()
            setIsExpanded(!isExpanded)
          }}
          type="button"
          className="hover:bg-accent flex w-full flex-row items-center rounded-t-md px-3 py-2 transition-colors"
        >
          <div className="flex flex-1 flex-row items-center gap-2 text-left text-base">
            <Nut className="text-muted-foreground size-4" />
            <span className="text-sm">Tools executed</span>
            <div className="bg-secondary text-secondary-foreground rounded-full px-1.5 py-0.5 font-mono text-xs">
              {uniqueToolIds.length}
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              {aggregateStatus === "running" ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, filter: "blur(2px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.9, filter: "blur(2px)" }}
                  transition={{ duration: 0.15 }}
                  key="running"
                >
                  <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
                    <Spinner className="mr-1 h-3 w-3 animate-spin" />
                    Working
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, filter: "blur(2px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.9, filter: "blur(2px)" }}
                  transition={{ duration: 0.15 }}
                  key="completed"
                >
                  <div className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Completed
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <CaretDown
            className={cn(
              "h-4 w-4 transition-transform",
              isExpanded ? "rotate-180 transform" : ""
            )}
          />
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={TRANSITION}
              className="overflow-hidden"
            >
              <div className="px-3 pt-3 pb-3">
                <div className="space-y-2">
                  {uniqueToolIds.map((toolId) => {
                    const toolInvocationsForId = groupedTools[toolId]

                    if (!toolInvocationsForId?.length) return null

                    return (
                      <div
                        key={toolId}
                        className="pb-2 last:border-0 last:pb-0"
                      >
                        <SingleToolView
                          toolInvocations={toolInvocationsForId}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

type SingleToolViewProps = {
  toolInvocations: ToolInvocationUIPart[]
  defaultOpen?: boolean
  className?: string
}

function SingleToolView({
  toolInvocations,
  defaultOpen = false,
  className,
}: SingleToolViewProps) {
  // Group by toolCallId and pick the most informative state
  const groupedTools = toolInvocations.reduce(
    (acc, item) => {
      const { toolCallId } = item.toolInvocation
      if (!acc[toolCallId]) {
        acc[toolCallId] = []
      }
      acc[toolCallId].push(item)
      return acc
    },
    {} as Record<string, ToolInvocationUIPart[]>
  )

  // For each toolCallId, get the most informative state (result > call > requested)
  const toolsToDisplay = Object.values(groupedTools)
    .map((group) => {
      const resultTool = group.find(
        (item) => item.toolInvocation.state === "result"
      )
      const callTool = group.find(
        (item) => item.toolInvocation.state === "call"
      )
      const partialCallTool = group.find(
        (item) => item.toolInvocation.state === "partial-call"
      )

      // Return the most informative one
      return resultTool || callTool || partialCallTool
    })
    .filter(Boolean) as ToolInvocationUIPart[]

  if (toolsToDisplay.length === 0) return null

  // If there's only one tool, display it directly
  if (toolsToDisplay.length === 1) {
    return (
      <SingleToolCard
        toolData={toolsToDisplay[0]}
        defaultOpen={defaultOpen}
        className={className}
      />
    )
  }

  // If there are multiple tools, show them in a list
  return (
    <div className={className}>
      <div className="space-y-4">
        {toolsToDisplay.map((tool) => (
          <SingleToolCard
            key={tool.toolInvocation.toolCallId}
            toolData={tool}
            defaultOpen={defaultOpen}
          />
        ))}
      </div>
    </div>
  )
}

// New component to handle individual tool cards
function SingleToolCard({
  toolData,
  defaultOpen = false,
  className,
}: {
  toolData: ToolInvocationUIPart
  defaultOpen?: boolean
  className?: string
}) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen)
  const { toolInvocation } = toolData
  const { state, toolName, toolCallId, args } = toolInvocation
  const isLoading = state === "call"
  const isCompleted = state === "result"
  const result = isCompleted ? toolInvocation.result : undefined

  // Parse the result JSON if available
  const { parsedResult, parseError } = useMemo(() => {
    if (!isCompleted || !result) return { parsedResult: null, parseError: null }

    try {
      if (Array.isArray(result))
        return { parsedResult: result, parseError: null }

      if (
        typeof result === "object" &&
        result !== null &&
        "content" in result
      ) {
        const textContent = result.content?.find(
          (item: { type: string }) => item.type === "text"
        )
        if (!textContent?.text) return { parsedResult: null, parseError: null }

        try {
          return {
            parsedResult: JSON.parse(textContent.text),
            parseError: null,
          }
        } catch {
          return { parsedResult: textContent.text, parseError: null }
        }
      }

      return { parsedResult: result, parseError: null }
    } catch {
      return { parsedResult: null, parseError: "Failed to parse result" }
    }
  }, [isCompleted, result])

  // Format the arguments for display
  const formattedArgs = args
    ? Object.entries(args).map(([key, value]) => (
        <div key={key} className="mb-1">
          <span className="text-muted-foreground font-medium">{key}:</span>{" "}
          <span className="font-mono">
            {typeof value === "object"
              ? value === null
                ? "null"
                : Array.isArray(value)
                  ? value.length === 0
                    ? "[]"
                    : JSON.stringify(value)
                  : JSON.stringify(value)
              : String(value)}
          </span>
        </div>
      ))
    : null

  // Render generic results based on their structure
  const renderResults = () => {
    if (!parsedResult) return "No result data available"

    // Handle Linkup searchWeb results (sourcedAnswer format)
    if (
      toolName === "searchWeb" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "answer" in parsedResult &&
      "sources" in parsedResult
    ) {
      const linkupResult = parsedResult as {
        answer: string
        sources: Array<{ name: string; url: string; snippet: string }>
        query?: string
        depth?: string
      }

      return (
        <div className="space-y-4">
          {/* Answer section */}
          <div>
            <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Answer
            </div>
            <div className="text-foreground leading-relaxed whitespace-pre-wrap">
              {linkupResult.answer}
            </div>
          </div>

          {/* Sources section */}
          {linkupResult.sources && linkupResult.sources.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources ({linkupResult.sources.length})
              </div>
              <div className="space-y-3">
                {linkupResult.sources.map((source, index) => (
                  <div
                    key={index}
                    className="border-border border-b pb-3 last:border-0 last:pb-0"
                  >
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary group flex items-center gap-1 font-medium hover:underline"
                    >
                      {source.name || "Untitled"}
                      <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                    </a>
                    <div className="text-muted-foreground mt-1 truncate font-mono text-xs">
                      {source.url}
                    </div>
                    {source.snippet && (
                      <div className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                        {source.snippet}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    // Handle Tavily tavilySearch results (similar to Linkup with answer + results)
    if (
      toolName === "tavilySearch" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "results" in parsedResult
    ) {
      const tavilyResult = parsedResult as {
        answer?: string
        results: Array<{ title: string; url: string; snippet: string }>
        query?: string
      }

      return (
        <div className="space-y-4">
          {/* Answer section (if available) */}
          {tavilyResult.answer && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Answer
              </div>
              <div className="text-foreground leading-relaxed whitespace-pre-wrap">
                {tavilyResult.answer}
              </div>
            </div>
          )}

          {/* Results section */}
          {tavilyResult.results && tavilyResult.results.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources ({tavilyResult.results.length})
              </div>
              <div className="space-y-3">
                {tavilyResult.results.map((result, index) => (
                  <div
                    key={index}
                    className="border-border border-b pb-3 last:border-0 last:pb-0"
                  >
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary group flex items-center gap-1 font-medium hover:underline"
                    >
                      {result.title || "Untitled"}
                      <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                    </a>
                    <div className="text-muted-foreground mt-1 truncate font-mono text-xs">
                      {result.url}
                    </div>
                    {result.snippet && (
                      <div className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                        {result.snippet}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tavilyResult.results?.length === 0 && !tavilyResult.answer && (
            <div className="text-muted-foreground">
              No results found for this search.
            </div>
          )}
        </div>
      )
    }

    // Handle Exa exaSearch results
    if (
      toolName === "exaSearch" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "results" in parsedResult
    ) {
      const exaResult = parsedResult as {
        results: Array<{ title: string; url: string; snippet: string; publishedDate?: string }>
        query?: string
      }

      return (
        <div className="space-y-4">
          {/* Results section */}
          {exaResult.results && exaResult.results.length > 0 ? (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Results ({exaResult.results.length})
              </div>
              <div className="space-y-3">
                {exaResult.results.map((result, index) => (
                  <div
                    key={index}
                    className="border-border border-b pb-3 last:border-0 last:pb-0"
                  >
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary group flex items-center gap-1 font-medium hover:underline"
                    >
                      {result.title || "Untitled"}
                      <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                    </a>
                    <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                      <span className="truncate font-mono">{result.url}</span>
                      {result.publishedDate && (
                        <span className="shrink-0">
                          • {new Date(result.publishedDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {result.snippet && (
                      <div className="text-muted-foreground mt-1 line-clamp-3 text-sm">
                        {result.snippet}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">
              No results found for this semantic search.
            </div>
          )}
        </div>
      )
    }

    // Handle Firecrawl firecrawlSearch results
    if (
      toolName === "firecrawlSearch" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "results" in parsedResult
    ) {
      const firecrawlResult = parsedResult as {
        results: Array<{ title: string; url: string; snippet: string; markdown?: string }>
        query?: string
      }

      return (
        <div className="space-y-4">
          {/* Results section */}
          {firecrawlResult.results && firecrawlResult.results.length > 0 ? (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Results ({firecrawlResult.results.length})
              </div>
              <div className="space-y-3">
                {firecrawlResult.results.map((result, index) => (
                  <div
                    key={index}
                    className="border-border border-b pb-3 last:border-0 last:pb-0"
                  >
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary group flex items-center gap-1 font-medium hover:underline"
                    >
                      {result.title || "Untitled"}
                      <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                    </a>
                    <div className="text-muted-foreground mt-1 truncate font-mono text-xs">
                      {result.url}
                    </div>
                    {result.snippet && (
                      <div className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                        {result.snippet}
                      </div>
                    )}
                    {result.markdown && (
                      <details className="mt-2">
                        <summary className="text-muted-foreground cursor-pointer text-xs hover:text-foreground">
                          View scraped content
                        </summary>
                        <div className="bg-muted/50 mt-2 max-h-40 overflow-auto rounded p-2 text-xs">
                          <pre className="whitespace-pre-wrap">{result.markdown.slice(0, 2000)}{result.markdown.length > 2000 ? "..." : ""}</pre>
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">
              No results found for this search.
            </div>
          )}
        </div>
      )
    }

    // Handle ProPublica nonprofit search results
    if (
      toolName === "propublica_nonprofit_search" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "organizations" in parsedResult
    ) {
      const nonprofitResult = parsedResult as {
        totalResults: number
        page: number
        totalPages: number
        organizations: Array<{
          ein: string
          name: string
          city?: string
          state?: string
          nteeCode?: string
          taxCode?: string
          hasFilings: boolean
        }>
        query: string
        error?: string
      }

      if (nonprofitResult.error) {
        return (
          <div className="text-muted-foreground">
            {nonprofitResult.error}
          </div>
        )
      }

      if (nonprofitResult.organizations.length === 0) {
        return (
          <div className="text-muted-foreground">
            No nonprofits found matching &quot;{nonprofitResult.query}&quot;
          </div>
        )
      }

      return (
        <div className="space-y-4">
          {/* Summary */}
          <div className="text-muted-foreground text-xs">
            Found {nonprofitResult.totalResults.toLocaleString()} nonprofit{nonprofitResult.totalResults !== 1 ? "s" : ""} matching &quot;{nonprofitResult.query}&quot;
            {nonprofitResult.totalPages > 1 && ` (page ${nonprofitResult.page + 1} of ${nonprofitResult.totalPages})`}
          </div>

          {/* Organizations list */}
          <div className="space-y-3">
            {nonprofitResult.organizations.map((org, index) => (
              <div
                key={org.ein || index}
                className="border-border border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-foreground">
                    {org.name}
                  </div>
                  {org.hasFilings && (
                    <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Has 990s
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="font-mono text-xs">EIN: {org.ein}</span>
                  {(org.city || org.state) && (
                    <span>
                      {[org.city, org.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>
                {(org.taxCode || org.nteeCode) && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {org.taxCode && <span>{org.taxCode}</span>}
                    {org.taxCode && org.nteeCode && <span> • </span>}
                    {org.nteeCode && <span>NTEE: {org.nteeCode}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Handle ProPublica nonprofit details results
    if (
      toolName === "propublica_nonprofit_details" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "filings" in parsedResult
    ) {
      const detailsResult = parsedResult as {
        ein: string
        name: string
        address?: string
        city?: string
        state?: string
        zipcode?: string
        nteeCode?: string
        taxCode?: string
        guidestarUrl?: string
        filings: Array<{
          year: number
          formType: string
          revenue?: number
          expenses?: number
          assets?: number
          liabilities?: number
          officerCompensationPercent?: number
          pdfUrl?: string
        }>
        error?: string
      }

      if (detailsResult.error) {
        return (
          <div className="text-muted-foreground">
            {detailsResult.error}
          </div>
        )
      }

      const formatCurrency = (amount?: number) => {
        if (amount === undefined || amount === null) return "—"
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(amount)
      }

      return (
        <div className="space-y-4">
          {/* Organization header */}
          <div>
            <div className="font-medium text-foreground text-lg">
              {detailsResult.name}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono">EIN: {detailsResult.ein}</span>
              {detailsResult.taxCode && <span className="ml-3">{detailsResult.taxCode}</span>}
            </div>
            {(detailsResult.address || detailsResult.city || detailsResult.state) && (
              <div className="mt-1 text-sm text-muted-foreground">
                {[detailsResult.address, detailsResult.city, detailsResult.state, detailsResult.zipcode]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}
            {detailsResult.guidestarUrl && (
              <a
                href={detailsResult.guidestarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-1 inline-flex items-center gap-1 text-sm hover:underline"
              >
                View on GuideStar
                <Link className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Filings */}
          {detailsResult.filings.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Form 990 Filings ({detailsResult.filings.length})
              </div>
              <div className="space-y-3">
                {detailsResult.filings.map((filing, index) => (
                  <div
                    key={index}
                    className="border-border rounded border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{filing.year} - {filing.formType}</span>
                      {filing.pdfUrl && (
                        <a
                          href={filing.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary text-xs hover:underline"
                        >
                          View PDF
                        </a>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Revenue:</span>{" "}
                        <span className="font-mono">{formatCurrency(filing.revenue)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expenses:</span>{" "}
                        <span className="font-mono">{formatCurrency(filing.expenses)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Assets:</span>{" "}
                        <span className="font-mono">{formatCurrency(filing.assets)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Liabilities:</span>{" "}
                        <span className="font-mono">{formatCurrency(filing.liabilities)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detailsResult.filings.length === 0 && (
            <div className="text-muted-foreground text-sm">
              No Form 990 filings available for this organization.
            </div>
          )}
        </div>
      )
    }

    // Handle US Government Data tool results
    if (
      toolName === "us_gov_data" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "dataSource" in parsedResult
    ) {
      const govResult = parsedResult as {
        dataSource: string
        query: string
        results: unknown[]
        totalCount: number
        rawContent: string
        sources: Array<{ name: string; url: string }>
        error?: string
      }

      if (govResult.error) {
        return (
          <div className="text-muted-foreground">
            {govResult.error}
          </div>
        )
      }

      // Get friendly data source name
      const dataSourceNames: Record<string, string> = {
        usaspending: "USAspending (Federal Awards)",
        treasury: "Treasury Fiscal Data",
        federal_register: "Federal Register",
      }
      const dataSourceName = dataSourceNames[govResult.dataSource] || govResult.dataSource

      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-xs">
              <span className="font-medium">{dataSourceName}</span>
              {govResult.totalCount > 0 && (
                <span> • {govResult.totalCount.toLocaleString()} result{govResult.totalCount !== 1 ? "s" : ""}</span>
              )}
            </div>
          </div>

          {/* Raw content (formatted markdown) */}
          {govResult.rawContent && (
            <div className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
              {govResult.rawContent.slice(0, 3000)}
              {govResult.rawContent.length > 3000 && "..."}
            </div>
          )}

          {/* Sources */}
          {govResult.sources && govResult.sources.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources ({govResult.sources.length})
              </div>
              <div className="space-y-2">
                {govResult.sources.map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary group flex items-center gap-1 text-sm hover:underline"
                  >
                    {source.name}
                    <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {govResult.results?.length === 0 && !govResult.rawContent && (
            <div className="text-muted-foreground">
              No results found for &quot;{govResult.query}&quot;
            </div>
          )}
        </div>
      )
    }

    // Handle FEC contributions results
    if (
      toolName === "fec_contributions" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "contributorName" in parsedResult
    ) {
      const fecResult = parsedResult as {
        contributorName: string
        totalContributions: number
        totalAmount: number
        contributions: Array<{
          amount: number
          date: string
          recipientCommittee: string
          recipientCandidate: string | null
          contributorEmployer: string
          contributorOccupation: string
          contributorLocation: string
          receiptType: string
          sourceUrl: string | null
        }>
        rawContent: string
        sources: Array<{ name: string; url: string }>
        error?: string
      }

      if (fecResult.error) {
        return (
          <div className="text-muted-foreground">
            {fecResult.error}
          </div>
        )
      }

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(amount)
      }

      const formatDate = (dateStr: string) => {
        try {
          const date = new Date(dateStr)
          return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        } catch {
          return dateStr
        }
      }

      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">
                {fecResult.contributorName}
              </div>
              <div className="text-muted-foreground text-sm">
                {fecResult.totalContributions} contribution{fecResult.totalContributions !== 1 ? "s" : ""} totaling {formatCurrency(fecResult.totalAmount)}
              </div>
            </div>
          </div>

          {/* Contributions list */}
          {fecResult.contributions.length > 0 && (
            <div className="space-y-3">
              {fecResult.contributions.slice(0, 10).map((contribution, index) => (
                <div
                  key={index}
                  className="border-border border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-medium text-foreground">
                        {formatCurrency(contribution.amount)}
                      </span>
                      <span className="text-muted-foreground text-sm"> • {formatDate(contribution.date)}</span>
                    </div>
                    {contribution.sourceUrl && (
                      <a
                        href={contribution.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary shrink-0 text-xs hover:underline"
                      >
                        View PDF
                      </a>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium">To:</span>{" "}
                      {contribution.recipientCandidate
                        ? `${contribution.recipientCandidate} (${contribution.recipientCommittee})`
                        : contribution.receiptType || contribution.recipientCommittee}
                    </div>
                    {contribution.contributorEmployer && contribution.contributorEmployer !== "Not Reported" && (
                      <div>
                        <span className="font-medium">Employer:</span> {contribution.contributorEmployer}
                      </div>
                    )}
                    {contribution.contributorOccupation && contribution.contributorOccupation !== "Not Reported" && (
                      <div>
                        <span className="font-medium">Occupation:</span> {contribution.contributorOccupation}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {fecResult.contributions.length > 10 && (
                <div className="text-muted-foreground text-sm">
                  ...and {fecResult.contributions.length - 10} more contributions
                </div>
              )}
            </div>
          )}

          {/* Sources */}
          {fecResult.sources && fecResult.sources.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources
              </div>
              <div className="space-y-1">
                {fecResult.sources.slice(0, 3).map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary group flex items-center gap-1 text-sm hover:underline"
                  >
                    {source.name}
                    <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {fecResult.contributions.length === 0 && (
            <div className="text-muted-foreground">
              No political contribution records found for &quot;{fecResult.contributorName}&quot;
            </div>
          )}
        </div>
      )
    }

    // Handle Yahoo Finance quote results
    if (
      toolName === "yahoo_finance_quote" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "symbol" in parsedResult &&
      "rawContent" in parsedResult
    ) {
      const quoteResult = parsedResult as {
        symbol: string
        shortName?: string
        longName?: string
        regularMarketPrice?: number
        regularMarketChange?: number
        regularMarketChangePercent?: number
        marketCap?: number
        currency?: string
        rawContent: string
        sources: Array<{ name: string; url: string }>
        error?: string
      }

      if (quoteResult.error) {
        return <div className="text-muted-foreground">{quoteResult.error}</div>
      }

      const formatCurrency = (amount?: number, currency = "USD") => {
        if (amount === undefined) return "—"
        if (amount >= 1e12) return `${currency} ${(amount / 1e12).toFixed(2)}T`
        if (amount >= 1e9) return `${currency} ${(amount / 1e9).toFixed(2)}B`
        if (amount >= 1e6) return `${currency} ${(amount / 1e6).toFixed(2)}M`
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          minimumFractionDigits: 2,
        }).format(amount)
      }

      return (
        <div className="space-y-4">
          <div>
            <div className="font-medium text-foreground text-lg">
              {quoteResult.longName || quoteResult.shortName || quoteResult.symbol}
            </div>
            <div className="text-muted-foreground text-sm font-mono">
              {quoteResult.symbol}
            </div>
          </div>

          {quoteResult.regularMarketPrice !== undefined && (
            <div className="flex items-baseline gap-3">
              <span className="font-medium text-foreground text-2xl">
                {formatCurrency(quoteResult.regularMarketPrice, quoteResult.currency)}
              </span>
              {quoteResult.regularMarketChange !== undefined && (
                <span className={cn(
                  "text-sm font-medium",
                  quoteResult.regularMarketChange >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {quoteResult.regularMarketChange >= 0 ? "+" : ""}
                  {quoteResult.regularMarketChange.toFixed(2)} ({quoteResult.regularMarketChangePercent?.toFixed(2)}%)
                </span>
              )}
            </div>
          )}

          {quoteResult.marketCap !== undefined && (
            <div className="text-muted-foreground text-sm">
              Market Cap: {formatCurrency(quoteResult.marketCap, quoteResult.currency)}
            </div>
          )}

          {quoteResult.sources && quoteResult.sources.length > 0 && (
            <div className="pt-2">
              {quoteResult.sources.map((source, index) => (
                <a
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary group flex items-center gap-1 text-sm hover:underline"
                >
                  {source.name}
                  <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                </a>
              ))}
            </div>
          )}
        </div>
      )
    }

    // Handle Yahoo Finance search results
    if (
      toolName === "yahoo_finance_search" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "results" in parsedResult &&
      "query" in parsedResult
    ) {
      const searchResult = parsedResult as {
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

      if (searchResult.error) {
        return <div className="text-muted-foreground">{searchResult.error}</div>
      }

      if (searchResult.results.length === 0) {
        return (
          <div className="text-muted-foreground">
            No stocks found matching &quot;{searchResult.query}&quot;
          </div>
        )
      }

      return (
        <div className="space-y-3">
          <div className="text-muted-foreground text-xs">
            Found {searchResult.results.length} result{searchResult.results.length !== 1 ? "s" : ""} for &quot;{searchResult.query}&quot;
          </div>
          {searchResult.results.map((result, index) => (
            <div key={index} className="border-border border-b pb-2 last:border-0 last:pb-0">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-medium text-foreground">
                    {result.longname || result.shortname || result.symbol}
                  </span>
                  <span className="text-muted-foreground ml-2 font-mono text-sm">
                    {result.symbol}
                  </span>
                </div>
              </div>
              {(result.exchDisp || result.typeDisp) && (
                <div className="text-muted-foreground text-xs mt-1">
                  {[result.exchDisp, result.typeDisp].filter(Boolean).join(" • ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )
    }

    // Handle Yahoo Finance profile results
    if (
      toolName === "yahoo_finance_profile" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "symbol" in parsedResult &&
      "rawContent" in parsedResult
    ) {
      const profileResult = parsedResult as {
        symbol: string
        industry?: string
        sector?: string
        website?: string
        employees?: number
        executives?: Array<{
          name: string
          title: string
          totalPay?: number
        }>
        marketCap?: number
        rawContent: string
        sources: Array<{ name: string; url: string }>
        error?: string
      }

      if (profileResult.error) {
        return <div className="text-muted-foreground">{profileResult.error}</div>
      }

      const formatCurrency = (amount?: number) => {
        if (amount === undefined) return "—"
        if (amount >= 1e12) return `$${(amount / 1e12).toFixed(2)}T`
        if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`
        if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`
        if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`
        return `$${amount.toLocaleString()}`
      }

      return (
        <div className="space-y-4">
          <div>
            <div className="font-medium text-foreground text-lg">{profileResult.symbol}</div>
            {(profileResult.industry || profileResult.sector) && (
              <div className="text-muted-foreground text-sm">
                {[profileResult.sector, profileResult.industry].filter(Boolean).join(" • ")}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            {profileResult.marketCap && (
              <div>
                <span className="text-muted-foreground">Market Cap:</span>{" "}
                <span className="font-mono">{formatCurrency(profileResult.marketCap)}</span>
              </div>
            )}
            {profileResult.employees && (
              <div>
                <span className="text-muted-foreground">Employees:</span>{" "}
                <span className="font-mono">{profileResult.employees.toLocaleString()}</span>
              </div>
            )}
          </div>

          {profileResult.executives && profileResult.executives.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Key Executives
              </div>
              <div className="space-y-2">
                {profileResult.executives.slice(0, 5).map((exec, index) => (
                  <div key={index} className="text-sm">
                    <span className="font-medium">{exec.name}</span>
                    <span className="text-muted-foreground"> — {exec.title}</span>
                    {exec.totalPay && (
                      <span className="text-muted-foreground ml-2 font-mono text-xs">
                        {formatCurrency(exec.totalPay)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {profileResult.sources && profileResult.sources.length > 0 && (
            <div className="pt-2">
              {profileResult.sources.map((source, index) => (
                <a
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary group flex items-center gap-1 text-sm hover:underline"
                >
                  {source.name}
                  <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                </a>
              ))}
            </div>
          )}
        </div>
      )
    }

    // Handle Wikidata search results
    if (
      toolName === "wikidata_search" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "results" in parsedResult &&
      "query" in parsedResult
    ) {
      const wikiResult = parsedResult as {
        query: string
        results: Array<{
          id: string
          label: string
          description?: string
          url: string
        }>
        totalResults: number
        rawContent: string
        sources: Array<{ name: string; url: string }>
        error?: string
      }

      if (wikiResult.error) {
        return <div className="text-muted-foreground">{wikiResult.error}</div>
      }

      if (wikiResult.results.length === 0) {
        return (
          <div className="text-muted-foreground">
            No Wikidata entities found matching &quot;{wikiResult.query}&quot;
          </div>
        )
      }

      return (
        <div className="space-y-3">
          <div className="text-muted-foreground text-xs">
            Found {wikiResult.totalResults} result{wikiResult.totalResults !== 1 ? "s" : ""} for &quot;{wikiResult.query}&quot;
          </div>
          {wikiResult.results.map((result) => (
            <div key={result.id} className="border-border border-b pb-2 last:border-0 last:pb-0">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary group flex items-center gap-1 font-medium hover:underline"
              >
                {result.label}
                <span className="text-muted-foreground font-mono text-xs">({result.id})</span>
                <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
              </a>
              {result.description && (
                <div className="text-muted-foreground text-sm mt-1">
                  {result.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )
    }

    // Handle Wikidata entity results
    if (
      toolName === "wikidata_entity" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "entityId" in parsedResult &&
      "rawContent" in parsedResult
    ) {
      const entityResult = parsedResult as {
        entityId: string
        data: {
          label: string
          description?: string
          occupations: string[]
          education: string[]
          employers: string[]
          positions: string[]
          netWorth?: string
          awards: string[]
        } | null
        rawContent: string
        sources: Array<{ name: string; url: string }>
        error?: string
      }

      if (entityResult.error) {
        return <div className="text-muted-foreground">{entityResult.error}</div>
      }

      if (!entityResult.data) {
        return (
          <div className="text-muted-foreground">
            No data found for entity {entityResult.entityId}
          </div>
        )
      }

      const { data } = entityResult

      return (
        <div className="space-y-4">
          <div>
            <div className="font-medium text-foreground text-lg">{data.label}</div>
            {data.description && (
              <div className="text-muted-foreground text-sm">{data.description}</div>
            )}
          </div>

          {data.occupations.length > 0 && (
            <div>
              <div className="text-muted-foreground text-xs font-medium uppercase">Occupation</div>
              <div className="text-sm">{data.occupations.join(", ")}</div>
            </div>
          )}

          {data.education.length > 0 && (
            <div>
              <div className="text-muted-foreground text-xs font-medium uppercase">Education</div>
              <div className="text-sm">{data.education.join(", ")}</div>
            </div>
          )}

          {(data.employers.length > 0 || data.positions.length > 0) && (
            <div>
              <div className="text-muted-foreground text-xs font-medium uppercase">Career</div>
              <div className="text-sm">
                {[...data.employers, ...data.positions].join(", ")}
              </div>
            </div>
          )}

          {data.netWorth && (
            <div>
              <div className="text-muted-foreground text-xs font-medium uppercase">Net Worth</div>
              <div className="text-sm font-medium">{data.netWorth}</div>
            </div>
          )}

          {data.awards.length > 0 && (
            <div>
              <div className="text-muted-foreground text-xs font-medium uppercase">Awards</div>
              <div className="text-sm">{data.awards.slice(0, 5).join(", ")}</div>
            </div>
          )}

          {entityResult.sources && entityResult.sources.length > 0 && (
            <div className="pt-2">
              {entityResult.sources.map((source, index) => (
                <a
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary group flex items-center gap-1 text-sm hover:underline"
                >
                  {source.name}
                  <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                </a>
              ))}
            </div>
          )}
        </div>
      )
    }

    // Handle Property Valuation (AVM) results
    if (
      toolName === "property_valuation" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "estimatedValue" in parsedResult
    ) {
      const avmResult = parsedResult as {
        address: string
        estimatedValue: number
        valueLow: number
        valueHigh: number
        pricePerSqFt?: number
        confidenceScore: number
        confidenceLevel: "high" | "medium" | "low"
        fsd: number
        hedonicValue?: number
        compAdjustedValue?: number
        onlineEstimateAvg?: number
        hedonicWeight: number
        compWeight: number
        onlineWeight: number
        comparablesUsed: number
        estimateSources: string[]
        rawContent: string
        sources: Array<{ name: string; url: string }>
        error?: string
      }

      if (avmResult.error) {
        return (
          <div className="space-y-3">
            <div className="text-red-600 dark:text-red-400">
              {avmResult.error}
            </div>
            {avmResult.rawContent && (
              <div className="text-muted-foreground whitespace-pre-wrap text-sm">
                {avmResult.rawContent}
              </div>
            )}
          </div>
        )
      }

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(amount)
      }

      const formatPercent = (value: number) => {
        return `${(value * 100).toFixed(0)}%`
      }

      // Confidence badge styling
      const confidenceBadgeClass = {
        high: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400",
        medium: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400",
        low: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
      }

      return (
        <div className="space-y-4">
          {/* Primary Value Display */}
          <div className="text-center">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
              Estimated Value
            </div>
            <div className="font-medium text-foreground text-3xl">
              {formatCurrency(avmResult.estimatedValue)}
            </div>
            <div className="text-muted-foreground text-sm mt-1">
              Range: {formatCurrency(avmResult.valueLow)} – {formatCurrency(avmResult.valueHigh)}
            </div>
            {avmResult.pricePerSqFt && (
              <div className="text-muted-foreground text-xs mt-1">
                {formatCurrency(avmResult.pricePerSqFt)}/sqft
              </div>
            )}
          </div>

          {/* Confidence Badge */}
          <div className="flex justify-center">
            <div className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
              confidenceBadgeClass[avmResult.confidenceLevel]
            )}>
              <span className="uppercase">{avmResult.confidenceLevel}</span>
              <span className="opacity-75">Confidence</span>
              <span className="font-mono">{avmResult.confidenceScore}/100</span>
            </div>
          </div>

          {/* Model Components Breakdown */}
          <div>
            <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Model Components
            </div>
            <div className="space-y-2 text-sm">
              {avmResult.hedonicValue && avmResult.hedonicWeight > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Hedonic Model ({formatPercent(avmResult.hedonicWeight)})
                  </span>
                  <span className="font-mono">{formatCurrency(avmResult.hedonicValue)}</span>
                </div>
              )}
              {avmResult.compAdjustedValue && avmResult.compWeight > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Comparable Sales ({formatPercent(avmResult.compWeight)}, {avmResult.comparablesUsed} comps)
                  </span>
                  <span className="font-mono">{formatCurrency(avmResult.compAdjustedValue)}</span>
                </div>
              )}
              {avmResult.onlineEstimateAvg && avmResult.onlineWeight > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Online Estimates ({formatPercent(avmResult.onlineWeight)}{avmResult.estimateSources.length > 0 ? `, ${avmResult.estimateSources.join(", ")}` : ""})
                  </span>
                  <span className="font-mono">{formatCurrency(avmResult.onlineEstimateAvg)}</span>
                </div>
              )}
            </div>
          </div>

          {/* FSD Note */}
          <div className="text-muted-foreground text-xs border-t border-border pt-3">
            Based on FSD of {formatPercent(avmResult.fsd)}, there is ~68% probability the actual value falls within the range shown.
          </div>

          {/* Sources */}
          {avmResult.sources && avmResult.sources.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources ({avmResult.sources.length})
              </div>
              <div className="space-y-1">
                {avmResult.sources.slice(0, 5).map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary group flex items-center gap-1 text-sm hover:underline"
                  >
                    {source.name}
                    <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                  </a>
                ))}
                {avmResult.sources.length > 5 && (
                  <div className="text-muted-foreground text-xs">
                    ...and {avmResult.sources.length - 5} more sources
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )
    }

    // Handle Exa search results specifically
    if (
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "results" in parsedResult &&
      Array.isArray(parsedResult.results)
    ) {
      const { results } = parsedResult as {
        results: Array<{
          id?: string
          url: string
          title: string
          text?: string
          content?: string
        }>
      }
      return (
        <div className="space-y-3">
          {results.map((item, index) => (
            <div
              key={item.id || index}
              className="border-border border-b pb-3 last:border-0 last:pb-0"
            >
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary group flex items-center gap-1 font-medium hover:underline"
              >
                {item.title}
                <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
              </a>
              <div className="text-muted-foreground mt-1 font-mono text-xs">
                {item.url}
              </div>
              {(item.text || item.content) && (
                <div className="mt-1 line-clamp-3 text-sm">
                  {item.text || item.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )
    }

    // Handle array of items with url, title, and snippet (like search results)
    if (Array.isArray(parsedResult) && parsedResult.length > 0) {
      // Check if items look like search results
      if (
        parsedResult[0] &&
        typeof parsedResult[0] === "object" &&
        "url" in parsedResult[0] &&
        "title" in parsedResult[0]
      ) {
        return (
          <div className="space-y-3">
            {parsedResult.map(
              (
                item: { url: string; title: string; snippet?: string },
                index: number
              ) => (
                <div
                  key={index}
                  className="border-border border-b pb-3 last:border-0 last:pb-0"
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary group flex items-center gap-1 font-medium hover:underline"
                  >
                    {item.title}
                    <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                  </a>
                  <div className="text-muted-foreground mt-1 font-mono text-xs">
                    {item.url}
                  </div>
                  {item.snippet && (
                    <div className="mt-1 line-clamp-2 text-sm">
                      {item.snippet}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )
      }

      // Generic array display
      return (
        <div className="font-mono text-xs">
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(parsedResult, null, 2)}
          </pre>
        </div>
      )
    }

    // Handle object results
    if (typeof parsedResult === "object" && parsedResult !== null) {
      const resultObj = parsedResult as Record<string, unknown>
      const title = typeof resultObj.title === "string" ? resultObj.title : null
      const htmlUrl =
        typeof resultObj.html_url === "string" ? resultObj.html_url : null

      return (
        <div>
          {title && <div className="mb-2 font-medium">{title}</div>}
          {htmlUrl && (
            <div className="mb-2">
              <a
                href={htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary flex items-center gap-1 hover:underline"
              >
                <span className="font-mono">{htmlUrl}</span>
                <Link className="h-3 w-3 opacity-70" />
              </a>
            </div>
          )}
          <div className="font-mono text-xs">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(parsedResult, null, 2)}
            </pre>
          </div>
        </div>
      )
    }

    // Handle string results
    if (typeof parsedResult === "string") {
      return <div className="whitespace-pre-wrap">{parsedResult}</div>
    }

    // Fallback
    return "No result data available"
  }

  return (
    <div
      className={cn(
        "border-border flex flex-col gap-0 overflow-hidden rounded-md border",
        className
      )}
    >
      <button
        onClick={(e) => {
          e.preventDefault()
          setIsExpanded(!isExpanded)
        }}
        type="button"
        className="hover:bg-accent flex w-full flex-row items-center rounded-t-md px-3 py-2 transition-colors"
      >
        <div className="flex flex-1 flex-row items-center gap-2 text-left text-base">
          <Wrench className="text-muted-foreground size-4" />
          <span className="text-sm">{getToolDisplayName(toolName)}</span>
          <AnimatePresence mode="popLayout" initial={false}>
            {isLoading ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, filter: "blur(2px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.9, filter: "blur(2px)" }}
                transition={{ duration: 0.15 }}
                key="loading"
              >
                <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
                  <Spinner className="mr-1 h-3 w-3 animate-spin" />
                  Running
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, filter: "blur(2px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.9, filter: "blur(2px)" }}
                transition={{ duration: 0.15 }}
                key="completed"
              >
                <div className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Completed
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <CaretDown
          className={cn(
            "h-4 w-4 transition-transform",
            isExpanded ? "rotate-180 transform" : ""
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={TRANSITION}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-3 pt-3 pb-3">
              {/* Arguments section */}
              {args && Object.keys(args).length > 0 && (
                <div>
                  <div className="text-muted-foreground mb-1 text-xs font-medium">
                    Arguments
                  </div>
                  <div className="bg-background rounded border p-2 text-sm">
                    {formattedArgs}
                  </div>
                </div>
              )}

              {/* Result section */}
              {isCompleted && (
                <div>
                  <div className="text-muted-foreground mb-1 text-xs font-medium">
                    Result
                  </div>
                  <div className="bg-background max-h-60 overflow-auto rounded border p-2 text-sm">
                    {parseError ? (
                      <div className="text-red-500">{parseError}</div>
                    ) : (
                      renderResults()
                    )}
                  </div>
                </div>
              )}

              {/* Tool call ID */}
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <div className="flex items-center">
                  <Code className="mr-1 inline size-3" />
                  Tool Call ID:{" "}
                  <span className="ml-1 font-mono">{toolCallId}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
