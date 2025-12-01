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
  type: "spring",
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
  firecrawlSearch: "Web Search: Advanced",
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
