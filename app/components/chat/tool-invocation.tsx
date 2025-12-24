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
  // Primary research tool
  perplexity_prospect_research: "Web Search",
  // Nonprofit tools
  propublica_nonprofit_search: "Nonprofit Search",
  propublica_nonprofit_details: "Nonprofit Details",
  // Document tools
  rag_search: "Document Search",
  list_documents: "List Documents",
  search_memory: "Memory Search",
  // SEC tools
  sec_edgar_filings: "SEC Filings",
  sec_insider_search: "SEC Insider Filings",
  sec_proxy_search: "SEC Proxy Statements",
  // Political/Government tools
  fec_contributions: "Political Contributions",
  us_gov_data: "US Government Data",
  usaspending_awards: "Federal Awards",
  // Court tools
  court_search: "Court Cases",
  judge_search: "Judge Profile",
  // Other tools
  rental_investment: "Rental Analysis",
  crm_search: "CRM Search",
  neon_crm_search_accounts: "CRM Accounts",
  neon_crm_get_account: "CRM Account",
  neon_crm_search_donations: "CRM Donations",
  gleif_search: "LEI Search",
  gleif_lookup: "LEI Details",
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

    // Handle USAspending Awards results (Federal contracts, grants, loans)
    if (
      toolName === "usaspending_awards" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "results" in parsedResult
    ) {
      const result = parsedResult as {
        query: string
        results: Array<{
          Award_ID: string
          Recipient_Name: string
          Award_Amount: number
          Total_Outlays: number
          Description: string
          Award_Type: string
          Awarding_Agency: string
          Awarding_Sub_Agency: string
          Start_Date: string
          End_Date: string
        }>
        totalCount: number
        rawContent?: string
        sources: Array<{ name: string; url: string }>
        error?: string
      }

      if (result.error) {
        return (
          <div className="text-red-600 dark:text-red-400">
            {result.error}
          </div>
        )
      }

      // Format currency
      const formatCurrency = (amount: number) => {
        if (Math.abs(amount) >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`
        if (Math.abs(amount) >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`
        if (Math.abs(amount) >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(amount)
      }

      // Calculate total award amount
      const totalAmount = result.results.reduce((sum, a) => sum + (a.Award_Amount || 0), 0)

      // Get unique agencies
      const agencies = [...new Set(result.results.map(a => a.Awarding_Agency).filter(Boolean))].slice(0, 4)

      // Award type badge colors
      const awardTypeBadge: Record<string, string> = {
        contract: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400",
        grant: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400",
        loan: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-400",
        idv: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400",
      }

      const getAwardTypeBadge = (type: string) => {
        const lowerType = type.toLowerCase()
        if (lowerType.includes("contract")) return awardTypeBadge.contract
        if (lowerType.includes("grant")) return awardTypeBadge.grant
        if (lowerType.includes("loan")) return awardTypeBadge.loan
        if (lowerType.includes("idv")) return awardTypeBadge.idv
        return awardTypeBadge.contract
      }

      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="text-center">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
              Federal Awards
            </div>
            <div className="font-medium text-foreground text-xl">
              {result.query}
            </div>
            <div className="text-muted-foreground text-sm mt-1">
              Contracts, Grants, Loans from USAspending.gov
            </div>
          </div>

          {/* Stats badges */}
          <div className="flex justify-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400">
              <span className="font-mono">{result.totalCount}</span>
              <span className="opacity-75">Awards</span>
            </div>
            {totalAmount > 0 && (
              <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
                <span className="font-mono">{formatCurrency(totalAmount)}</span>
                <span className="opacity-75">Total Value</span>
              </div>
            )}
          </div>

          {/* Agency badges */}
          {agencies.length > 0 && (
            <div className="flex justify-center gap-1 flex-wrap">
              {agencies.map((agency, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400"
                >
                  {agency.length > 25 ? agency.substring(0, 25) + "..." : agency}
                </span>
              ))}
            </div>
          )}

          {/* Awards list */}
          <div>
            <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Top Awards
            </div>
            <div className="space-y-2">
              {result.results.slice(0, 6).map((award, index) => (
                <div
                  key={index}
                  className="border-border rounded-lg border p-3 bg-muted/20"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{award.Recipient_Name}</div>
                      <div className="text-muted-foreground text-xs mt-0.5">
                        {award.Awarding_Agency}
                        {award.Awarding_Sub_Agency && ` • ${award.Awarding_Sub_Agency}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                        getAwardTypeBadge(award.Award_Type)
                      )}>
                        {award.Award_Type}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
                        {formatCurrency(award.Award_Amount)}
                      </span>
                    </div>
                  </div>
                  {award.Description && (
                    <div className="text-muted-foreground text-xs line-clamp-2 mb-2">
                      {award.Description}
                    </div>
                  )}
                  <div className="text-muted-foreground text-xs flex items-center gap-2">
                    {award.Start_Date && <span>Start: {award.Start_Date}</span>}
                    {award.End_Date && (
                      <>
                        <span className="opacity-50">→</span>
                        <span>End: {award.End_Date}</span>
                      </>
                    )}
                    {award.Award_ID && (
                      <>
                        <span className="opacity-50">|</span>
                        <span className="font-mono">{award.Award_ID}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {result.results.length > 6 && (
              <div className="text-muted-foreground text-xs text-center mt-2">
                +{result.results.length - 6} more awards
              </div>
            )}
          </div>

          {/* Sources */}
          {result.sources && result.sources.length > 0 && (
            <div className="border-t border-border pt-3">
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources
              </div>
              <div className="flex flex-wrap gap-2">
                {result.sources.map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary group inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    {source.name}
                    <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                  </a>
                ))}
              </div>
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

    // Handle Perplexity Prospect Research results
    if (
      toolName === "perplexity_prospect_research" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "prospectName" in parsedResult
    ) {
      const perplexityResult = parsedResult as {
        prospectName: string
        research: string
        sources: Array<{ name: string; url: string }>
        focusAreas: string[]
        error?: string
      }

      if (perplexityResult.error) {
        return (
          <div className="text-muted-foreground">
            {perplexityResult.error}
          </div>
        )
      }

      // Format focus areas for display
      const formatFocusArea = (area: string) => {
        switch (area) {
          case "real_estate":
            return "Real Estate"
          case "business_ownership":
            return "Business"
          case "philanthropy":
            return "Philanthropy"
          case "securities":
            return "Securities"
          case "biography":
            return "Biography"
          default:
            return area
        }
      }

      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium text-foreground text-lg">
                {perplexityResult.prospectName}
              </div>
              {perplexityResult.focusAreas && perplexityResult.focusAreas.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {perplexityResult.focusAreas.map((area, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
                    >
                      {formatFocusArea(area)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Research content - render as formatted text */}
          {perplexityResult.research && (
            <div className="border-border rounded-md border bg-muted/30 p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {perplexityResult.research}
                </pre>
              </div>
            </div>
          )}

          {/* Sources */}
          {perplexityResult.sources && perplexityResult.sources.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources ({perplexityResult.sources.length})
              </div>
              <div className="space-y-1">
                {perplexityResult.sources.slice(0, 10).map((source, index) => (
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
                {perplexityResult.sources.length > 10 && (
                  <div className="text-muted-foreground text-xs">
                    ...and {perplexityResult.sources.length - 10} more sources
                  </div>
                )}
              </div>
            </div>
          )}

          {!perplexityResult.research && (
            <div className="text-muted-foreground">
              No research results found for &quot;{perplexityResult.prospectName}&quot;
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

    // Handle County Assessor results
    if (
      toolName === "county_assessor" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "query" in parsedResult
    ) {
      const result = parsedResult as {
        query: {
          address?: string
          owner?: string
          county: string
          state: string
        }
        properties: Array<{
          address?: string
          owner?: string
          parcelId?: string
          assessedValue?: number
          marketValue?: number
          landValue?: number
          buildingValue?: number
          yearBuilt?: number
          squareFeet?: number
          acres?: number
          propertyType?: string
          taxAmount?: number
          lastSaleDate?: string
          lastSalePrice?: number
        }>
        totalFound: number
        county: string
        state: string
        dataSource: string
        confidence: "high" | "medium" | "low"
        sources: Array<{ name: string; url: string }>
        rawContent?: string
      }

      // Confidence badge styling
      const confidenceBadgeClass = {
        high: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400",
        medium: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400",
        low: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
      }

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(amount)
      }

      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="text-center">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
              County Property Records
            </div>
            <div className="font-medium text-foreground text-xl">
              {result.query.address || result.query.owner || "Property Search"}
            </div>
            <div className="text-muted-foreground text-sm mt-1">
              {result.county} County, {result.state}
            </div>
          </div>

          {/* Stats badges */}
          <div className="flex justify-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
              <span className="font-mono">{result.totalFound}</span>
              <span className="opacity-75">{result.totalFound === 1 ? "Property" : "Properties"}</span>
            </div>
            <div className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium capitalize",
              confidenceBadgeClass[result.confidence]
            )}>
              <span>{result.confidence}</span>
              <span className="opacity-75">Confidence</span>
            </div>
          </div>

          {/* Properties list */}
          {result.properties.length > 0 ? (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Properties Found
              </div>
              <div className="space-y-2">
                {result.properties.slice(0, 5).map((property, index) => (
                  <div
                    key={index}
                    className="border-border rounded-lg border p-3 bg-muted/20"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{property.address || "Address Unknown"}</div>
                        {property.owner && (
                          <div className="text-muted-foreground text-xs mt-0.5">
                            Owner: {property.owner}
                          </div>
                        )}
                      </div>
                      {(property.assessedValue || property.marketValue) && (
                        <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
                          {formatCurrency(property.marketValue || property.assessedValue || 0)}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs flex flex-wrap gap-x-3 gap-y-1">
                      {property.parcelId && <span>Parcel: {property.parcelId}</span>}
                      {property.yearBuilt && <span>Built: {property.yearBuilt}</span>}
                      {property.squareFeet && <span>{property.squareFeet.toLocaleString()} sqft</span>}
                      {property.acres && <span>{property.acres} acres</span>}
                      {property.propertyType && <span>{property.propertyType}</span>}
                    </div>
                    {(property.landValue || property.buildingValue || property.taxAmount) && (
                      <div className="text-muted-foreground text-xs mt-2 flex flex-wrap gap-x-3 gap-y-1">
                        {property.landValue && <span>Land: {formatCurrency(property.landValue)}</span>}
                        {property.buildingValue && <span>Building: {formatCurrency(property.buildingValue)}</span>}
                        {property.taxAmount && <span>Tax: {formatCurrency(property.taxAmount)}/yr</span>}
                      </div>
                    )}
                    {property.lastSaleDate && property.lastSalePrice && (
                      <div className="text-muted-foreground text-xs mt-2">
                        Last sale: {formatCurrency(property.lastSalePrice)} on {property.lastSaleDate}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-muted-foreground text-sm mb-2">
                No properties found matching the search criteria.
              </div>
              <div className="text-muted-foreground text-xs">
                Try a partial address or search by owner name
              </div>
            </div>
          )}

          {/* Sources */}
          {result.sources && result.sources.length > 0 && (
            <div className="border-t border-border pt-3">
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources ({result.sources.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {result.sources.slice(0, 6).map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary group inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    {source.name.length > 40 ? source.name.substring(0, 40) + "..." : source.name}
                    <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                  </a>
                ))}
                {result.sources.length > 6 && (
                  <span className="text-muted-foreground text-xs">
                    +{result.sources.length - 6} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )
    }

    // Handle FAA Aircraft Registry results
    if (
      toolName === "faa_registry" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "searchTerm" in parsedResult
    ) {
      const result = parsedResult as {
        searchTerm: string
        searchType: "name" | "nNumber" | "serial"
        aircraft: Array<{
          nNumber: string
          serialNumber?: string
          manufacturer: string
          model: string
          year?: number
          registrantName: string
          registrantCity?: string
          registrantState?: string
          aircraftType: string
          engineType?: string
          status?: string
          estimatedValue?: number
        }>
        summary: {
          totalFound: number
          estimatedTotalValue: string
          wealthIndicator: "ultra_high" | "very_high" | "high" | "moderate" | "unknown"
          aircraftTypes: string[]
        }
        rawContent?: string
        sources: Array<{ name: string; url: string }>
      }

      // Wealth indicator badge styling
      const wealthBadgeClass: Record<string, string> = {
        ultra_high: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-400",
        very_high: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400",
        high: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400",
        moderate: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400",
        unknown: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
      }

      const wealthLabels: Record<string, string> = {
        ultra_high: "$50M+ Net Worth",
        very_high: "$10M+ Net Worth",
        high: "Millionaire",
        moderate: "Upper Middle Class",
        unknown: "No Aircraft Found",
      }

      // Aircraft type badge colors
      const aircraftTypeBadge: Record<string, string> = {
        jet: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-400",
        turboprop: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400",
        helicopter: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400",
        piston: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400",
      }

      const getAircraftTypeBadge = (type: string) => {
        const lowerType = type.toLowerCase()
        if (lowerType.includes("jet")) return aircraftTypeBadge.jet
        if (lowerType.includes("turbo")) return aircraftTypeBadge.turboprop
        if (lowerType.includes("heli") || lowerType.includes("rotor")) return aircraftTypeBadge.helicopter
        return aircraftTypeBadge.piston
      }

      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="text-center">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
              FAA Aircraft Registry
            </div>
            <div className="font-medium text-foreground text-xl">
              {result.searchTerm}
            </div>
            <div className="text-muted-foreground text-sm mt-1">
              Registered Aircraft Search
            </div>
          </div>

          {/* Stats badges */}
          <div className="flex justify-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400">
              <span className="font-mono">{result.summary.totalFound}</span>
              <span className="opacity-75">Aircraft</span>
            </div>
            {result.summary.estimatedTotalValue && result.summary.estimatedTotalValue !== "$0" && (
              <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
                <span className="font-mono">{result.summary.estimatedTotalValue}</span>
                <span className="opacity-75">Est. Value</span>
              </div>
            )}
          </div>

          {/* Wealth indicator */}
          <div className="flex justify-center">
            <div className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
              wealthBadgeClass[result.summary.wealthIndicator]
            )}>
              {wealthLabels[result.summary.wealthIndicator]}
            </div>
          </div>

          {/* Aircraft type badges */}
          {result.summary.aircraftTypes.length > 0 && (
            <div className="flex justify-center gap-1 flex-wrap">
              {result.summary.aircraftTypes.map((type, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400"
                >
                  {type}
                </span>
              ))}
            </div>
          )}

          {/* Aircraft list */}
          {result.aircraft.length > 0 ? (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Registered Aircraft
              </div>
              <div className="space-y-2">
                {result.aircraft.slice(0, 5).map((aircraft, index) => (
                  <div
                    key={index}
                    className="border-border rounded-lg border p-3 bg-muted/20"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {aircraft.manufacturer} {aircraft.model}
                          {aircraft.year && <span className="text-muted-foreground"> ({aircraft.year})</span>}
                        </div>
                        <div className="text-muted-foreground text-xs mt-0.5">
                          {aircraft.registrantName}
                          {aircraft.registrantCity && aircraft.registrantState && (
                            <span> • {aircraft.registrantCity}, {aircraft.registrantState}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                          getAircraftTypeBadge(aircraft.aircraftType)
                        )}>
                          {aircraft.aircraftType}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-mono text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
                          N{aircraft.nNumber}
                        </span>
                      </div>
                    </div>
                    <div className="text-muted-foreground text-xs flex flex-wrap gap-x-3 gap-y-1">
                      {aircraft.serialNumber && <span>S/N: {aircraft.serialNumber}</span>}
                      {aircraft.engineType && <span>{aircraft.engineType}</span>}
                      {aircraft.status && <span>Status: {aircraft.status}</span>}
                      {aircraft.estimatedValue && (
                        <span className="text-green-600 dark:text-green-400">
                          Est. ${(aircraft.estimatedValue / 1000000).toFixed(1)}M
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {result.aircraft.length > 5 && (
                <div className="text-muted-foreground text-xs text-center mt-2">
                  +{result.aircraft.length - 5} more aircraft
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 border-border rounded-lg border bg-muted/20 p-4">
              <div className="text-muted-foreground text-sm mb-3">
                No aircraft found registered to "{result.searchTerm}"
              </div>
              <div className="text-muted-foreground text-xs space-y-1">
                <div className="font-medium mb-2">Aircraft ownership indicates high net worth:</div>
                <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto text-left">
                  <span>Single-engine piston</span><span className="text-right">$50K - $500K</span>
                  <span>Turboprop</span><span className="text-right">$1M - $8M</span>
                  <span>Light jet</span><span className="text-right">$2M - $15M</span>
                  <span>Large cabin jet</span><span className="text-right">$15M - $75M</span>
                </div>
              </div>
            </div>
          )}

          {/* Sources */}
          {result.sources && result.sources.length > 0 && (
            <div className="border-t border-border pt-3">
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources
              </div>
              <div className="flex flex-wrap gap-2">
                {result.sources.map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary group inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    {source.name}
                    <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    // Handle Business Affiliation Search results
    if (
      toolName === "business_affiliation_search" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "personName" in parsedResult &&
      "affiliations" in parsedResult
    ) {
      const affiliationResult = parsedResult as {
        personName: string
        totalAffiliations: number
        affiliations: Array<{
          companyName: string
          role: string
          roleType: string
          current: boolean
          companyType: string
          source: string
          sourceUrl?: string
          confidence: string
          isPublicCompany: boolean
        }>
        summary: {
          publicCompanyRoles: number
          privateCompanyRoles: number
          currentRoles: number
          formerRoles: number
          highestRole: string | null
          wealthIndicator: string
        }
        dataSources: string[]
        rawContent: string
        sources: Array<{ name: string; url: string }>
        error?: string
      }

      if (affiliationResult.error) {
        return (
          <div className="text-muted-foreground">
            {affiliationResult.error}
          </div>
        )
      }

      // Wealth indicator badge styling
      const getWealthBadgeClass = (indicator: string) => {
        if (indicator === "HIGH") {
          return "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
        }
        if (indicator === "MODERATE") {
          return "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400"
        }
        return "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
      }

      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium text-foreground text-lg">
                {affiliationResult.personName}
              </div>
              <div className="text-muted-foreground text-sm">
                {affiliationResult.totalAffiliations} business affiliation{affiliationResult.totalAffiliations !== 1 ? "s" : ""} found
              </div>
            </div>
            <div className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-medium",
              getWealthBadgeClass(affiliationResult.summary.wealthIndicator)
            )}>
              {affiliationResult.summary.wealthIndicator}
            </div>
          </div>

          {/* Summary Stats */}
          {affiliationResult.totalAffiliations > 0 && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Public Companies:</span>{" "}
                <span className="font-medium">{affiliationResult.summary.publicCompanyRoles}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Private/Other:</span>{" "}
                <span className="font-medium">{affiliationResult.summary.privateCompanyRoles}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Current Roles:</span>{" "}
                <span className="font-medium">{affiliationResult.summary.currentRoles}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Former Roles:</span>{" "}
                <span className="font-medium">{affiliationResult.summary.formerRoles}</span>
              </div>
            </div>
          )}

          {/* Affiliations List */}
          {affiliationResult.affiliations.length > 0 && (
            <div className="space-y-3">
              {affiliationResult.affiliations.slice(0, 10).map((aff, index) => (
                <div
                  key={index}
                  className="border-border border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-medium text-foreground">
                        {aff.companyName}
                      </span>
                      {aff.isPublicCompany && (
                        <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          Public
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-xs",
                      aff.current
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    )}>
                      {aff.current ? "Current" : "Former"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    <div>{aff.role}</div>
                    <div className="text-xs mt-0.5">
                      Source: {aff.source} ({aff.confidence} confidence)
                    </div>
                  </div>
                </div>
              ))}
              {affiliationResult.affiliations.length > 10 && (
                <div className="text-muted-foreground text-sm">
                  ...and {affiliationResult.affiliations.length - 10} more affiliations
                </div>
              )}
            </div>
          )}

          {affiliationResult.totalAffiliations === 0 && (
            <div className="text-muted-foreground">
              No business affiliations found for &quot;{affiliationResult.personName}&quot;
            </div>
          )}

          {/* Sources */}
          {affiliationResult.sources && affiliationResult.sources.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources
              </div>
              <div className="space-y-1">
                {affiliationResult.sources.slice(0, 5).map((source, index) => (
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
        </div>
      )
    }

    // Handle Nonprofit Board Search results
    if (
      toolName === "nonprofit_board_search" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "personName" in parsedResult &&
      "nonprofitPositions" in parsedResult
    ) {
      const boardResult = parsedResult as {
        personName: string
        totalPositions: number
        nonprofitPositions: Array<{
          organizationName: string
          organizationType: string
          role: string
          ein?: string
          assets?: number
          source: string
          sourceUrl?: string
          confidence: string
        }>
        publicCompanyPositions: Array<{
          organizationName: string
          role: string
          source: string
          sourceUrl?: string
          yearDiscovered?: number
        }>
        otherPositions: Array<{
          organizationName: string
          role: string
          source: string
        }>
        wealthIndicator: string
        rawContent: string
        sources: Array<{ name: string; url: string }>
        error?: string
      }

      if (boardResult.error) {
        return (
          <div className="text-muted-foreground">
            {boardResult.error}
          </div>
        )
      }

      const formatCurrency = (amount?: number) => {
        if (amount === undefined) return "—"
        if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`
        if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`
        if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`
        return `$${amount.toLocaleString()}`
      }

      return (
        <div className="space-y-4">
          {/* Header */}
          <div>
            <div className="font-medium text-foreground text-lg">
              {boardResult.personName}
            </div>
            <div className="text-muted-foreground text-sm">
              {boardResult.totalPositions} board position{boardResult.totalPositions !== 1 ? "s" : ""} found
            </div>
            {boardResult.wealthIndicator && (
              <div className="text-muted-foreground text-xs mt-1 italic">
                {boardResult.wealthIndicator}
              </div>
            )}
          </div>

          {/* Nonprofit Positions */}
          {boardResult.nonprofitPositions.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Nonprofit Board Positions ({boardResult.nonprofitPositions.length})
              </div>
              <div className="space-y-3">
                {boardResult.nonprofitPositions.map((pos, index) => (
                  <div
                    key={index}
                    className="border-border border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="font-medium text-foreground">
                      {pos.organizationName}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      <div>{pos.role}</div>
                      {pos.ein && <div className="text-xs font-mono">EIN: {pos.ein}</div>}
                      {pos.assets && pos.assets > 0 && (
                        <div className="text-xs">Assets: {formatCurrency(pos.assets)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Public Company Positions */}
          {boardResult.publicCompanyPositions.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Public Company Positions ({boardResult.publicCompanyPositions.length})
              </div>
              <div className="space-y-3">
                {boardResult.publicCompanyPositions.map((pos, index) => (
                  <div
                    key={index}
                    className="border-border border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {pos.organizationName}
                      </span>
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        SEC
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {pos.role}
                      {pos.yearDiscovered && (
                        <span className="ml-2 text-xs">({pos.yearDiscovered})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {boardResult.totalPositions === 0 && (
            <div className="text-muted-foreground">
              No board positions found for &quot;{boardResult.personName}&quot;
            </div>
          )}

          {/* Sources */}
          {boardResult.sources && boardResult.sources.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources
              </div>
              <div className="space-y-1">
                {boardResult.sources.slice(0, 5).map((source, index) => (
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
        </div>
      )
    }

    // Handle Giving History results
    if (
      toolName === "giving_history" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "personName" in parsedResult &&
      "summary" in parsedResult &&
      "givingRecords" in parsedResult
    ) {
      const givingResult = parsedResult as {
        personName: string
        summary: {
          totalGiving: number
          totalPolitical: number
          totalPhilanthropic: number
          giftCount: number
          averageGift: number
          largestGift: number
          yearsActive: string
          primaryCauses: string[]
          givingTrend: string
        }
        givingRecords: Array<{
          type: string
          amount: number
          recipient: string
          recipientType: string
          date?: string
          year?: number
          source: string
          notes?: string
        }>
        givingByYear: Record<string, { total: number; count: number }>
        wealthIndicator: string
        rawContent: string
        sources: Array<{ name: string; url: string }>
        error?: string
      }

      if (givingResult.error) {
        return (
          <div className="text-muted-foreground">
            {givingResult.error}
          </div>
        )
      }

      const formatCurrency = (amount: number) => {
        if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`
        if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`
        if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`
        return `$${amount.toLocaleString()}`
      }

      // Get wealth indicator badge class
      const getWealthClass = (indicator: string) => {
        if (indicator.includes("ULTRA HIGH") || indicator.includes("VERY HIGH")) {
          return "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
        }
        if (indicator.includes("HIGH") || indicator.includes("AFFLUENT")) {
          return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
        }
        return "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
      }

      return (
        <div className="space-y-4">
          {/* Header */}
          <div>
            <div className="font-medium text-foreground text-lg">
              {givingResult.personName}
            </div>
            <div className="text-muted-foreground text-sm">
              {givingResult.summary.giftCount} giving record{givingResult.summary.giftCount !== 1 ? "s" : ""} found
            </div>
          </div>

          {/* Wealth Indicator */}
          {givingResult.wealthIndicator && (
            <div className={cn(
              "rounded border px-3 py-2 text-sm",
              getWealthClass(givingResult.wealthIndicator)
            )}>
              {givingResult.wealthIndicator}
            </div>
          )}

          {/* Summary Stats */}
          {givingResult.summary.totalGiving > 0 && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Total Giving:</span>{" "}
                <span className="font-medium font-mono">{formatCurrency(givingResult.summary.totalGiving)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Largest Gift:</span>{" "}
                <span className="font-medium font-mono">{formatCurrency(givingResult.summary.largestGift)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Philanthropic:</span>{" "}
                <span className="font-medium font-mono">{formatCurrency(givingResult.summary.totalPhilanthropic)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Political:</span>{" "}
                <span className="font-medium font-mono">{formatCurrency(givingResult.summary.totalPolitical)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Years Active:</span>{" "}
                <span className="font-medium">{givingResult.summary.yearsActive}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Trend:</span>{" "}
                <span className="font-medium capitalize">{givingResult.summary.givingTrend}</span>
              </div>
            </div>
          )}

          {/* Top Gifts */}
          {givingResult.givingRecords.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Top Gifts
              </div>
              <div className="space-y-3">
                {givingResult.givingRecords
                  .sort((a, b) => b.amount - a.amount)
                  .slice(0, 8)
                  .map((record, index) => (
                  <div
                    key={index}
                    className="border-border border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-medium text-foreground">
                          {formatCurrency(record.amount)}
                        </span>
                        {record.year && (
                          <span className="text-muted-foreground text-sm ml-2">
                            ({record.year})
                          </span>
                        )}
                      </div>
                      <span className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-xs capitalize",
                        record.type === "political"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      )}>
                        {record.type}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      <div>{record.recipient}</div>
                      {record.notes && (
                        <div className="text-xs italic">{record.notes}</div>
                      )}
                    </div>
                  </div>
                ))}
                {givingResult.givingRecords.length > 8 && (
                  <div className="text-muted-foreground text-sm">
                    ...and {givingResult.givingRecords.length - 8} more records
                  </div>
                )}
              </div>
            </div>
          )}

          {givingResult.summary.giftCount === 0 && (
            <div className="text-muted-foreground">
              No giving records found for &quot;{givingResult.personName}&quot;
            </div>
          )}

          {/* Sources */}
          {givingResult.sources && givingResult.sources.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources
              </div>
              <div className="space-y-1">
                {givingResult.sources.slice(0, 5).map((source, index) => (
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
        </div>
      )
    }

    // Handle Prospect Report results
    if (
      toolName === "prospect_report" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "personName" in parsedResult &&
      "executiveSummary" in parsedResult &&
      "capacityRating" in parsedResult
    ) {
      const reportResult = parsedResult as {
        personName: string
        generatedAt: string
        executiveSummary: string
        sections: Array<{
          title: string
          content: string
          sources: Array<{ name: string; url: string }>
          confidence: string
        }>
        capacityRating: "A" | "B" | "C" | "D"
        estimatedCapacity: string
        rawContent: string
        sources: Array<{ name: string; url: string }>
        error?: string
      }

      if (reportResult.error) {
        return (
          <div className="text-muted-foreground">
            {reportResult.error}
          </div>
        )
      }

      // Rating badge styling
      const getRatingBadgeClass = (rating: string) => {
        switch (rating) {
          case "A":
            return "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
          case "B":
            return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
          case "C":
            return "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400"
          default:
            return "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
        }
      }

      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium text-foreground text-lg">
                {reportResult.personName}
              </div>
              <div className="text-muted-foreground text-xs">
                Generated: {reportResult.generatedAt}
              </div>
            </div>
            <div className={cn(
              "rounded-full border px-3 py-1 text-lg font-bold",
              getRatingBadgeClass(reportResult.capacityRating)
            )}>
              {reportResult.capacityRating}
            </div>
          </div>

          {/* Capacity Estimate */}
          <div className="rounded border border-border bg-muted/30 px-3 py-2 text-center">
            <div className="text-muted-foreground text-xs uppercase tracking-wide">Estimated Capacity</div>
            <div className="font-medium text-foreground">{reportResult.estimatedCapacity}</div>
          </div>

          {/* Executive Summary */}
          <div>
            <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Executive Summary
            </div>
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {reportResult.executiveSummary}
            </div>
          </div>

          {/* Sections (collapsed by default, showing titles) */}
          {reportResult.sections.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Report Sections
              </div>
              <div className="space-y-1">
                {reportResult.sections.map((section, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{section.title}</span>
                    <span className={cn(
                      "rounded px-1.5 py-0.5 text-xs",
                      section.confidence === "high"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : section.confidence === "medium"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : section.confidence === "none"
                        ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    )}>
                      {section.confidence === "none" ? "No data" : section.confidence}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {reportResult.sources && reportResult.sources.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources
              </div>
              <div className="space-y-1">
                {reportResult.sources.slice(0, 5).map((source, index) => (
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
        </div>
      )
    }

    // Handle Prospect Profile results (combined scoring + evidence)
    // Also handles legacy prospect_score for backwards compatibility
    if (
      (toolName === "prospect_profile" || toolName === "prospect_score") &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "personName" in parsedResult &&
      "score" in parsedResult
    ) {
      const scoringResult = parsedResult as {
        personName: string
        score: {
          capacityScore: number
          propensityScore: number
          affinityScore: number
          overallRating: "A" | "B" | "C" | "D"
          estimatedCapacity: string
          wealthIndicators: Array<{
            source: string
            indicator: string
            value: number | string
            score: number
            confidence: string
            url?: string
          }>
          givingHistory: Array<{
            type: string
            recipient: string
            amount: number
            date?: string
          }>
          recommendations: string[]
        }
        // Evidence sections with verification status (new in prospect_profile)
        evidence?: Array<{
          title: string
          status: "verified" | "unverified" | "not_found"
          confidence: "high" | "medium" | "low"
          items: Array<{
            claim: string
            value: string
            source?: { name: string; url: string }
          }>
          sourceUrl?: string
        }>
        rawContent: string
        sources: Array<{ name: string; url: string }>
        dataQuality: string
        error?: string
      }

      if (scoringResult.error) {
        return (
          <div className="text-muted-foreground">
            {scoringResult.error}
          </div>
        )
      }

      // Rating badge styling
      const getRatingBadgeClass = (rating: string) => {
        switch (rating) {
          case "A":
            return "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
          case "B":
            return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
          case "C":
            return "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400"
          default:
            return "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
        }
      }

      // Score bar color
      const getScoreColor = (score: number) => {
        if (score >= 70) return "bg-green-500"
        if (score >= 50) return "bg-blue-500"
        if (score >= 30) return "bg-yellow-500"
        return "bg-gray-400"
      }

      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium text-foreground text-lg">
                {scoringResult.personName}
              </div>
              <div className="text-muted-foreground text-xs capitalize">
                Data Quality: {scoringResult.dataQuality}
              </div>
            </div>
            <div className={cn(
              "rounded-full border px-3 py-1 text-lg font-bold",
              getRatingBadgeClass(scoringResult.score.overallRating)
            )}>
              {scoringResult.score.overallRating}
            </div>
          </div>

          {/* Capacity Estimate */}
          <div className="rounded border border-border bg-muted/30 px-3 py-2 text-center">
            <div className="text-muted-foreground text-xs uppercase tracking-wide">Estimated Capacity</div>
            <div className="font-medium text-foreground">{scoringResult.score.estimatedCapacity}</div>
          </div>

          {/* Score Bars */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Giving Capacity</span>
                <span className="font-medium">{scoringResult.score.capacityScore}/100</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", getScoreColor(scoringResult.score.capacityScore))}
                  style={{ width: `${scoringResult.score.capacityScore}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Propensity to Give</span>
                <span className="font-medium">{scoringResult.score.propensityScore}/100</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", getScoreColor(scoringResult.score.propensityScore))}
                  style={{ width: `${scoringResult.score.propensityScore}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Affinity</span>
                <span className="font-medium">{scoringResult.score.affinityScore}/100</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", getScoreColor(scoringResult.score.affinityScore))}
                  style={{ width: `${scoringResult.score.affinityScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* Wealth Indicators */}
          {scoringResult.score.wealthIndicators.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Wealth Indicators
              </div>
              <div className="space-y-2">
                {scoringResult.score.wealthIndicators.map((indicator, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0"
                  >
                    <div>
                      <div className="font-medium">{indicator.source}</div>
                      <div className="text-muted-foreground text-xs">{indicator.indicator}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">{indicator.value}</div>
                      <div className="text-muted-foreground text-xs">+{indicator.score} pts</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {scoringResult.score.recommendations.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Recommendations
              </div>
              <ul className="space-y-1 text-sm">
                {scoringResult.score.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence Sections (from prospect_profile) */}
          {scoringResult.evidence && scoringResult.evidence.length > 0 && (
            <div className="space-y-3">
              <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Evidence
              </div>
              {scoringResult.evidence.map((section, sectionIndex) => (
                <div key={sectionIndex} className="rounded border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-sm">{section.title}</div>
                    <div className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1",
                      section.status === "verified" && "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
                      section.status === "unverified" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
                      section.status === "not_found" && "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                    )}>
                      {section.status === "verified" && "✓"}
                      {section.status === "unverified" && "⚠"}
                      {section.status === "not_found" && "—"}
                      <span className="capitalize">{section.status.replace("_", " ")}</span>
                    </div>
                  </div>
                  {section.items.length > 0 ? (
                    <div className="space-y-2">
                      {section.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex items-start justify-between text-sm border-b border-border pb-2 last:border-0 last:pb-0">
                          <div className="text-muted-foreground">{item.claim}</div>
                          <div className="text-right">
                            <div className="font-medium">{item.value}</div>
                            {item.source && (
                              <a
                                href={item.source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary text-xs hover:underline"
                              >
                                {item.source.name}
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-sm italic">No data found</div>
                  )}
                  {section.sourceUrl && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <a
                        href={section.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-xs hover:underline flex items-center gap-1"
                      >
                        View source <Link className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Sources */}
          {scoringResult.sources && scoringResult.sources.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources
              </div>
              <div className="space-y-1">
                {scoringResult.sources.slice(0, 5).map((source, index) => (
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
        </div>
      )
    }

    // Handle SEC Insider Search results (Form 3/4/5)
    if (
      toolName === "sec_insider_search" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "filings" in parsedResult
    ) {
      const result = parsedResult as {
        personName: string
        totalFilings: number
        filings: Array<{
          formType: string
          companyName: string
          filedDate: string
          url: string
        }>
        sources?: Array<{ name: string; url: string }>
        rawContent?: string
      }

      // Form type badge colors
      const formBadgeClass: Record<string, string> = {
        "3": "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400",
        "4": "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-400",
        "5": "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400",
      }

      // Group filings by company
      const filingsByCompany = result.filings.reduce((acc, filing) => {
        if (!acc[filing.companyName]) {
          acc[filing.companyName] = []
        }
        acc[filing.companyName].push(filing)
        return acc
      }, {} as Record<string, typeof result.filings>)

      const companyCount = Object.keys(filingsByCompany).length

      return (
        <div className="space-y-4">
          {/* Header with person name */}
          <div className="text-center">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
              SEC Insider Filings
            </div>
            <div className="font-medium text-foreground text-xl">
              {result.personName}
            </div>
            <div className="text-muted-foreground text-sm mt-1">
              Officer/Director/10% Owner at {companyCount} {companyCount === 1 ? "company" : "companies"}
            </div>
          </div>

          {/* Filing count badge */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
              <span className="font-mono">{result.totalFilings}</span>
              <span className="opacity-75">Form 3/4/5 Filings</span>
            </div>
          </div>

          {/* Filings by company */}
          <div>
            <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Companies & Filings
            </div>
            <div className="space-y-3">
              {Object.entries(filingsByCompany).slice(0, 5).map(([company, filings], idx) => (
                <div key={idx} className="border-border rounded-lg border p-3 bg-muted/20">
                  <div className="font-medium text-sm mb-2">{company}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {filings.slice(0, 5).map((filing, index) => (
                      <a
                        key={index}
                        href={filing.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium hover:opacity-80 transition-opacity",
                          formBadgeClass[filing.formType] || formBadgeClass["4"]
                        )}
                        title={`Filed ${filing.filedDate}`}
                      >
                        Form {filing.formType}
                        <span className="opacity-60">{filing.filedDate.split("-")[0]}</span>
                      </a>
                    ))}
                    {filings.length > 5 && (
                      <span className="text-muted-foreground text-xs py-0.5">
                        +{filings.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {Object.keys(filingsByCompany).length > 5 && (
                <div className="text-muted-foreground text-xs text-center">
                  +{Object.keys(filingsByCompany).length - 5} more companies
                </div>
              )}
            </div>
          </div>

          {/* Sources */}
          {result.sources && result.sources.length > 0 && (
            <div className="border-t border-border pt-3">
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources
              </div>
              <div className="flex flex-wrap gap-2">
                {result.sources.map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary group inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    {source.name}
                    <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    // Handle SEC Proxy Search results (DEF 14A)
    if (
      toolName === "sec_proxy_search" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "filings" in parsedResult
    ) {
      const result = parsedResult as {
        companyName: string
        totalFilings: number
        filings: Array<{
          formType: string
          filedDate: string
          description?: string
          url: string
        }>
        sources?: Array<{ name: string; url: string }>
      }

      // Extract unique years from filings
      const years = [...new Set(result.filings.map(f => f.filedDate.split("-")[0]))].sort((a, b) => parseInt(b) - parseInt(a))

      return (
        <div className="space-y-4">
          {/* Company Header */}
          <div className="text-center">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
              SEC Proxy Statements
            </div>
            <div className="font-medium text-foreground text-xl">
              {result.companyName}
            </div>
            <div className="text-muted-foreground text-sm mt-1">
              Board composition, executive compensation, voting matters
            </div>
          </div>

          {/* Filing count and years badge */}
          <div className="flex justify-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
              <span className="font-mono">{result.totalFilings}</span>
              <span className="opacity-75">DEF 14A Filings</span>
            </div>
          </div>

          {/* Year badges */}
          {years.length > 0 && (
            <div className="flex justify-center gap-1 flex-wrap">
              {years.slice(0, 6).map((year) => (
                <span
                  key={year}
                  className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400"
                >
                  {year}
                </span>
              ))}
              {years.length > 6 && (
                <span className="text-muted-foreground text-xs py-0.5">+{years.length - 6} more</span>
              )}
            </div>
          )}

          {/* Filings list */}
          <div>
            <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Recent Filings
            </div>
            <div className="space-y-2">
              {result.filings.slice(0, 5).map((filing, index) => (
                <a
                  key={index}
                  href={filing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border rounded-lg border p-3 bg-muted/20 block hover:bg-muted/40 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-400">
                        {filing.formType}
                      </span>
                      <span className="text-sm font-medium">{filing.filedDate}</span>
                    </div>
                    <Link className="h-4 w-4 text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100" />
                  </div>
                  {filing.description && (
                    <div className="text-muted-foreground text-xs mt-2 line-clamp-2">{filing.description}</div>
                  )}
                </a>
              ))}
            </div>
            {result.filings.length > 5 && (
              <div className="text-muted-foreground text-xs text-center mt-2">
                +{result.filings.length - 5} more filings available
              </div>
            )}
          </div>

          {/* Sources */}
          {result.sources && result.sources.length > 0 && (
            <div className="border-t border-border pt-3">
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources
              </div>
              <div className="flex flex-wrap gap-2">
                {result.sources.map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary group inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    {source.name}
                    <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    // Handle OpenSanctions Screening results
    if (
      toolName === "opensanctions_screening" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "riskLevel" in parsedResult
    ) {
      const result = parsedResult as {
        query: string
        totalMatches: number
        riskLevel: "HIGH" | "MEDIUM" | "LOW" | "CLEAR"
        matches: Array<{
          id: string
          name: string
          matchScore: number
          entityType: string
          topics: string[]
          sanctions: string[]
          countries: string[]
          url: string
        }>
        rawContent: string
        sources: Array<{ name: string; url: string }>
      }

      const getBadgeClass = (level: string) => {
        switch (level) {
          case "CLEAR":
            return "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
          case "LOW":
            return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
          case "MEDIUM":
            return "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400"
          case "HIGH":
            return "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
          default:
            return "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
        }
      }

      const getRiskLabel = (level: string) => {
        switch (level) {
          case "CLEAR": return "Clear - No Matches"
          case "LOW": return "Low Risk"
          case "MEDIUM": return "Medium Risk"
          case "HIGH": return "High Risk"
          default: return level
        }
      }

      return (
        <div className="space-y-4">
          {/* Header with risk assessment */}
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium text-foreground text-lg">{result.query}</div>
              <div className="text-muted-foreground text-sm">
                Sanctions & PEP Screening
              </div>
            </div>
            <span className={cn("rounded-full border px-3 py-1 text-sm font-medium", getBadgeClass(result.riskLevel))}>
              {getRiskLabel(result.riskLevel)}
            </span>
          </div>

          {/* Summary box */}
          <div className={cn(
            "rounded-lg border p-4 text-center",
            result.riskLevel === "CLEAR"
              ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
              : result.riskLevel === "HIGH"
              ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
              : "border-border bg-muted/30"
          )}>
            <div className="text-2xl font-bold">
              {result.totalMatches}
            </div>
            <div className="text-muted-foreground text-sm">
              {result.totalMatches === 1 ? "Match Found" : result.totalMatches === 0 ? "No Matches" : "Matches Found"}
            </div>
          </div>

          {/* Matches list */}
          {result.matches && result.matches.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Potential Matches ({result.matches.length})
              </div>
              <div className="space-y-3">
                {result.matches.slice(0, 5).map((match, index) => (
                  <div key={index} className="border-border rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <a
                          href={match.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary font-medium hover:underline flex items-center gap-1"
                        >
                          {match.name}
                          <Link className="h-3 w-3" />
                        </a>
                        <div className="text-muted-foreground text-xs mt-0.5">
                          {match.entityType}
                        </div>
                      </div>
                      <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium shrink-0">
                        {Math.round(match.matchScore * 100)}% match
                      </span>
                    </div>
                    {match.sanctions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {match.sanctions.slice(0, 3).map((sanction, i) => (
                          <span key={i} className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded px-1.5 py-0.5 text-xs">
                            {sanction}
                          </span>
                        ))}
                        {match.sanctions.length > 3 && (
                          <span className="text-muted-foreground text-xs">+{match.sanctions.length - 3} more</span>
                        )}
                      </div>
                    )}
                    {match.topics.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {match.topics.slice(0, 3).map((topic, i) => (
                          <span key={i} className="bg-secondary rounded px-1.5 py-0.5 text-xs">{topic}</span>
                        ))}
                      </div>
                    )}
                    {match.countries.length > 0 && (
                      <div className="text-muted-foreground text-xs mt-1">
                        Countries: {match.countries.slice(0, 3).join(", ")}
                        {match.countries.length > 3 && ` +${match.countries.length - 3} more`}
                      </div>
                    )}
                  </div>
                ))}
                {result.matches.length > 5 && (
                  <div className="text-muted-foreground text-sm">
                    ...and {result.matches.length - 5} more matches
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sources */}
          {result.sources && result.sources.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources
              </div>
              <div className="space-y-1">
                {result.sources.map((source, index) => (
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
        </div>
      )
    }

    // Handle State Campaign Finance results
    if (
      toolName === "state_campaign_finance" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "personName" in parsedResult &&
      "summary" in parsedResult
    ) {
      const result = parsedResult as {
        personName: string
        state: string
        contributions: Array<{
          amount: number
          date: string
          recipient: string
          recipientType?: string
          party?: string
          office?: string
        }>
        summary: {
          totalAmount: number
          contributionCount: number
          dateRange: { earliest: string; latest: string } | null
          partyBreakdown: {
            democratic: number
            republican: number
            other: number
          }
          topRecipients: Array<{ name: string; amount: number }>
        }
        rawContent: string
        sources: Array<{ name: string; url: string }>
      }

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(amount)
      }

      const { summary } = result
      const totalParty = summary.partyBreakdown.democratic + summary.partyBreakdown.republican + summary.partyBreakdown.other
      const demPct = totalParty > 0 ? Math.round((summary.partyBreakdown.democratic / totalParty) * 100) : 0
      const repPct = totalParty > 0 ? Math.round((summary.partyBreakdown.republican / totalParty) * 100) : 0
      const otherPct = totalParty > 0 ? 100 - demPct - repPct : 0

      return (
        <div className="space-y-4">
          {/* Header */}
          <div>
            <div className="font-medium text-foreground text-lg">{result.personName}</div>
            <div className="text-muted-foreground text-sm">
              State Campaign Contributions • {result.state}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(summary.totalAmount)}
              </div>
              <div className="text-muted-foreground text-xs">Total Contributions</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <div className="text-2xl font-bold text-foreground">
                {summary.contributionCount}
              </div>
              <div className="text-muted-foreground text-xs">Contributions</div>
            </div>
          </div>

          {/* Party Breakdown */}
          {totalParty > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Party Breakdown
              </div>
              <div className="h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex">
                {demPct > 0 && (
                  <div
                    className="bg-blue-500 h-full"
                    style={{ width: `${demPct}%` }}
                    title={`Democratic: ${formatCurrency(summary.partyBreakdown.democratic)}`}
                  />
                )}
                {repPct > 0 && (
                  <div
                    className="bg-red-500 h-full"
                    style={{ width: `${repPct}%` }}
                    title={`Republican: ${formatCurrency(summary.partyBreakdown.republican)}`}
                  />
                )}
                {otherPct > 0 && (
                  <div
                    className="bg-gray-400 h-full"
                    style={{ width: `${otherPct}%` }}
                    title={`Other: ${formatCurrency(summary.partyBreakdown.other)}`}
                  />
                )}
              </div>
              <div className="flex justify-between mt-1 text-xs">
                <span className="text-blue-600 dark:text-blue-400">
                  Dem: {formatCurrency(summary.partyBreakdown.democratic)} ({demPct}%)
                </span>
                <span className="text-red-600 dark:text-red-400">
                  Rep: {formatCurrency(summary.partyBreakdown.republican)} ({repPct}%)
                </span>
                {summary.partyBreakdown.other > 0 && (
                  <span className="text-muted-foreground">
                    Other: {formatCurrency(summary.partyBreakdown.other)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Top Recipients */}
          {summary.topRecipients.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Top Recipients
              </div>
              <div className="space-y-2">
                {summary.topRecipients.slice(0, 5).map((recipient, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate mr-2">{recipient.name}</span>
                    <span className="text-muted-foreground font-mono shrink-0">
                      {formatCurrency(recipient.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Contributions */}
          {result.contributions.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Recent Contributions ({result.contributions.length})
              </div>
              <div className="space-y-2">
                {result.contributions.slice(0, 5).map((contribution, index) => (
                  <div key={index} className="border-border border-b pb-2 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-medium text-foreground">
                          {formatCurrency(contribution.amount)}
                        </span>
                        <span className="text-muted-foreground text-sm ml-2">
                          {contribution.date}
                        </span>
                      </div>
                      {contribution.party && (
                        <span className={cn(
                          "rounded px-1.5 py-0.5 text-xs shrink-0",
                          contribution.party.toLowerCase().includes("dem")
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : contribution.party.toLowerCase().includes("rep")
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        )}>
                          {contribution.party}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground text-sm mt-0.5">
                      {contribution.recipient}
                      {contribution.office && <span className="text-xs ml-1">({contribution.office})</span>}
                    </div>
                  </div>
                ))}
                {result.contributions.length > 5 && (
                  <div className="text-muted-foreground text-sm">
                    ...and {result.contributions.length - 5} more contributions
                  </div>
                )}
              </div>
            </div>
          )}

          {/* No contributions message */}
          {result.contributions.length === 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-center">
              <div className="text-muted-foreground text-sm">
                No state campaign contributions found for &quot;{result.personName}&quot; in {result.state}
              </div>
            </div>
          )}

          {/* Sources */}
          {result.sources && result.sources.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources
              </div>
              <div className="space-y-1">
                {result.sources.map((source, index) => (
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
        </div>
      )
    }

    // Handle Lobbying Search results
    if (
      toolName === "lobbying_search" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "filings" in parsedResult
    ) {
      const result = parsedResult as {
        query?: string
        totalFilings: number
        filings: Array<{
          registrantName: string
          clientName: string
          amount?: number
          year: number
          issues?: string[]
          url?: string
        }>
        sources?: Array<{ name: string; url: string }>
      }

      // Calculate total amount spent
      const totalAmount = result.filings.reduce((sum, f) => sum + (f.amount || 0), 0)

      // Get unique years
      const years = [...new Set(result.filings.map(f => f.year))].sort((a, b) => b - a)

      // Get all unique issues
      const allIssues = [...new Set(result.filings.flatMap(f => f.issues || []))].slice(0, 8)

      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="text-center">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
              Federal Lobbying Records
            </div>
            {result.query && (
              <div className="font-medium text-foreground text-xl">
                {result.query}
              </div>
            )}
          </div>

          {/* Stats badges */}
          <div className="flex justify-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400">
              <span className="font-mono">{result.totalFilings}</span>
              <span className="opacity-75">Filings</span>
            </div>
            {totalAmount > 0 && (
              <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
                <span className="font-mono">${(totalAmount / 1000000).toFixed(1)}M</span>
                <span className="opacity-75">Total</span>
              </div>
            )}
          </div>

          {/* Year badges */}
          {years.length > 0 && (
            <div className="flex justify-center gap-1 flex-wrap">
              {years.slice(0, 6).map((year) => (
                <span
                  key={year}
                  className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400"
                >
                  {year}
                </span>
              ))}
            </div>
          )}

          {/* Issues tags */}
          {allIssues.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Lobbying Issues
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allIssues.map((issue, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-400"
                  >
                    {issue}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Filings list */}
          <div>
            <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Top Filings
            </div>
            <div className="space-y-2">
              {result.filings.slice(0, 6).map((filing, index) => (
                <div
                  key={index}
                  className="border-border rounded-lg border p-3 bg-muted/20"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{filing.registrantName}</span>
                    {filing.amount && (
                      <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
                        ${filing.amount.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs flex items-center gap-2">
                    <span>Client: {filing.clientName}</span>
                    <span className="opacity-50">|</span>
                    <span>{filing.year}</span>
                  </div>
                  {filing.issues && filing.issues.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {filing.issues.slice(0, 3).map((issue, i) => (
                        <span
                          key={i}
                          className="text-xs text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5"
                        >
                          {issue}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {result.filings.length > 6 && (
              <div className="text-muted-foreground text-xs text-center mt-2">
                +{result.filings.length - 6} more filings
              </div>
            )}
          </div>

          {/* Sources */}
          {result.sources && result.sources.length > 0 && (
            <div className="border-t border-border pt-3">
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources
              </div>
              <div className="flex flex-wrap gap-2">
                {result.sources.map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary group inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    {source.name}
                    <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    // Handle Court Search results
    if (
      toolName === "court_search" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "cases" in parsedResult
    ) {
      const result = parsedResult as {
        query?: string
        totalCases: number
        cases: Array<{
          caseName: string
          docketNumber?: string
          court: string
          dateFiled?: string
          status?: string
          caseType?: string
          url: string
        }>
        sources?: Array<{ name: string; url: string }>
      }

      // Status badge colors
      const statusBadgeClass: Record<string, string> = {
        active: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400",
        open: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400",
        pending: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400",
        closed: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
        dismissed: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400",
        settled: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400",
      }

      // Get unique courts
      const courts = [...new Set(result.cases.map(c => c.court))].slice(0, 4)

      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="text-center">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
              Court Records
            </div>
            {result.query && (
              <div className="font-medium text-foreground text-xl">
                {result.query}
              </div>
            )}
          </div>

          {/* Case count badge */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
              <span className="font-mono">{result.totalCases}</span>
              <span className="opacity-75">Court Cases</span>
            </div>
          </div>

          {/* Court jurisdiction badges */}
          {courts.length > 0 && (
            <div className="flex justify-center gap-1 flex-wrap">
              {courts.map((court, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400"
                >
                  {court.length > 30 ? court.substring(0, 30) + "..." : court}
                </span>
              ))}
            </div>
          )}

          {/* Cases list */}
          <div>
            <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Cases
            </div>
            <div className="space-y-2">
              {result.cases.slice(0, 8).map((courtCase, index) => (
                <a
                  key={index}
                  href={courtCase.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border rounded-lg border p-3 bg-muted/20 block hover:bg-muted/40 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                        {courtCase.caseName}
                      </div>
                      <div className="text-muted-foreground text-xs mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>{courtCase.court}</span>
                        {courtCase.docketNumber && (
                          <>
                            <span className="opacity-50">|</span>
                            <span className="font-mono">{courtCase.docketNumber}</span>
                          </>
                        )}
                        {courtCase.dateFiled && (
                          <>
                            <span className="opacity-50">|</span>
                            <span>Filed: {courtCase.dateFiled}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {courtCase.status && (
                        <span className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
                          statusBadgeClass[courtCase.status.toLowerCase()] || statusBadgeClass["pending"]
                        )}>
                          {courtCase.status}
                        </span>
                      )}
                      <Link className="h-4 w-4 text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100" />
                    </div>
                  </div>
                  {courtCase.caseType && (
                    <div className="mt-2">
                      <span className="text-xs text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                        {courtCase.caseType}
                      </span>
                    </div>
                  )}
                </a>
              ))}
            </div>
            {result.cases.length > 8 && (
              <div className="text-muted-foreground text-xs text-center mt-2">
                +{result.cases.length - 8} more cases
              </div>
            )}
          </div>

          {/* Sources */}
          {result.sources && result.sources.length > 0 && (
            <div className="border-t border-border pt-3">
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources
              </div>
              <div className="flex flex-wrap gap-2">
                {result.sources.map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary group inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    {source.name}
                    <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    // Handle Business Registry Scraper results
    if (
      toolName === "business_registry_scraper" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "businesses" in parsedResult
    ) {
      const result = parsedResult as {
        totalFound: number
        sourcesSuccessful: string[]
        sourcesFailed?: string[]
        businesses: Array<{
          name: string
          entityNumber?: string
          jurisdiction: string
          status?: string
          incorporationDate?: string
          entityType?: string
          registeredAddress?: string
          sourceUrl: string
          source: string
        }>
        sources?: Array<{ name: string; url: string }>
      }

      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Found {result.totalFound} businesses</span>
            {result.sourcesSuccessful.length > 0 && (
              <span className="bg-secondary rounded px-1.5 py-0.5 text-xs">
                Sources: {result.sourcesSuccessful.join(", ")}
              </span>
            )}
          </div>
          <div className="space-y-3">
            {result.businesses.slice(0, 10).map((business, index) => (
              <div key={index} className="border-border rounded-md border p-3">
                <a
                  href={business.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary group flex items-center gap-1 font-medium hover:underline"
                >
                  {business.name}
                  <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                </a>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  <span className="bg-secondary rounded px-1.5 py-0.5">{business.jurisdiction}</span>
                  {business.status && (
                    <span className={cn(
                      "rounded px-1.5 py-0.5",
                      business.status.toLowerCase().includes("active")
                        ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    )}>
                      {business.status}
                    </span>
                  )}
                  {business.entityNumber && (
                    <span className="text-muted-foreground font-mono">{business.entityNumber}</span>
                  )}
                </div>
                {business.entityType && (
                  <div className="text-muted-foreground mt-1 text-xs">{business.entityType}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Handle Nonprofit Affiliation Search results
    if (
      toolName === "nonprofit_affiliation_search" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "affiliations" in parsedResult
    ) {
      const result = parsedResult as {
        personName: string
        totalAffiliations: number
        affiliations: Array<{
          organizationName: string
          ein?: string
          role: string
          proPublicaMatch: boolean
          financials?: {
            revenue?: number
            assets?: number
            mostRecentYear?: number
          }
          sources: Array<{ name: string; url: string }>
        }>
        matchedInProPublica: number
        sources?: Array<{ name: string; url: string }>
        error?: string
      }

      if (result.error) {
        return <div className="text-muted-foreground">{result.error}</div>
      }

      // Format currency helper
      const formatCurrency = (value: number | undefined) => {
        if (!value) return "N/A"
        if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
        if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
        if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
        return `$${value.toLocaleString()}`
      }

      // Get role badge color
      const getRoleBadgeClass = (role: string) => {
        const roleLower = role.toLowerCase()
        if (roleLower.includes("founder") || roleLower.includes("chair")) {
          return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
        }
        if (roleLower.includes("board") || roleLower.includes("director") || roleLower.includes("trustee")) {
          return "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400"
        }
        if (roleLower.includes("officer") || roleLower.includes("executive")) {
          return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400"
        }
        return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
      }

      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium text-foreground text-lg">
                {result.personName}
              </div>
              <div className="text-muted-foreground text-xs">
                {result.totalAffiliations} affiliations found
              </div>
            </div>
            <div className="flex items-center gap-2">
              {result.matchedInProPublica > 0 && (
                <span className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 rounded-full px-2 py-0.5 text-xs">
                  {result.matchedInProPublica} with 990 data
                </span>
              )}
            </div>
          </div>

          {/* Affiliations */}
          <div className="space-y-3">
            {result.affiliations.slice(0, 10).map((affiliation, index) => (
              <div key={index} className="rounded border border-border p-3">
                <div className="flex items-start justify-between">
                  <div className="font-medium">{affiliation.organizationName}</div>
                  <div className="flex items-center gap-1">
                    <span className={cn("rounded px-1.5 py-0.5 text-xs", getRoleBadgeClass(affiliation.role))}>
                      {affiliation.role}
                    </span>
                    {affiliation.proPublicaMatch && (
                      <span className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 rounded px-1.5 py-0.5 text-xs">
                        990 Data
                      </span>
                    )}
                  </div>
                </div>
                {affiliation.ein && (
                  <div className="text-muted-foreground text-xs mt-1 font-mono">EIN: {affiliation.ein}</div>
                )}
                {affiliation.financials && (
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    {affiliation.financials.revenue !== undefined && (
                      <div>
                        <span className="text-muted-foreground">Revenue:</span>{" "}
                        <span className="font-medium">{formatCurrency(affiliation.financials.revenue)}</span>
                      </div>
                    )}
                    {affiliation.financials.assets !== undefined && (
                      <div>
                        <span className="text-muted-foreground">Assets:</span>{" "}
                        <span className="font-medium">{formatCurrency(affiliation.financials.assets)}</span>
                      </div>
                    )}
                  </div>
                )}
                {affiliation.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <a
                      href={affiliation.sources[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-xs hover:underline flex items-center gap-1"
                    >
                      {affiliation.sources[0].name} <Link className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Sources */}
          {result.sources && result.sources.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources
              </div>
              <div className="space-y-1">
                {result.sources.slice(0, 3).map((source, index) => (
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
        </div>
      )
    }

    // Handle Household Search results
    if (
      toolName === "household_search" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "primaryPerson" in parsedResult
    ) {
      const result = parsedResult as {
        primaryPerson: string
        spouses: Array<{
          name: string
          wikidataId?: string
          relationship: string
          startDate?: string
          endDate?: string
          current: boolean
          sharedCompanies: string[]
          combinedPoliticalGiving?: number
        }>
        householdWealth: {
          estimatedCombined: string
          wealthIndicators: string[]
          confidenceLevel: string
        }
        sharedAffiliations: Array<{
          type: string
          name: string
          roles: string[]
        }>
        sources?: Array<{ name: string; url: string }>
        error?: string
      }

      if (result.error) {
        return <div className="text-muted-foreground">{result.error}</div>
      }

      // Confidence badge styling
      const getConfidenceBadgeClass = (level: string) => {
        switch (level.toLowerCase()) {
          case "high":
            return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
          case "medium":
            return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
          default:
            return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
        }
      }

      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium text-foreground text-lg">
                {result.primaryPerson}
              </div>
              <div className="text-muted-foreground text-xs">
                Household: {result.spouses.length + 1} member{result.spouses.length > 0 ? "s" : ""}
              </div>
            </div>
            <span className={cn("rounded-full px-2 py-0.5 text-xs", getConfidenceBadgeClass(result.householdWealth.confidenceLevel))}>
              {result.householdWealth.confidenceLevel} Confidence
            </span>
          </div>

          {/* Household Capacity */}
          <div className="rounded border border-border bg-muted/30 px-3 py-2 text-center">
            <div className="text-muted-foreground text-xs uppercase tracking-wide">Combined Household Capacity</div>
            <div className="font-medium text-foreground">{result.householdWealth.estimatedCombined}</div>
          </div>

          {/* Spouses */}
          {result.spouses.length > 0 ? (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Spouse / Partner
              </div>
              <div className="space-y-3">
                {result.spouses.map((spouse, index) => (
                  <div key={index} className="rounded border border-border p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">{spouse.name}</div>
                        <div className="text-muted-foreground text-xs">{spouse.relationship}</div>
                      </div>
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-xs",
                        spouse.current
                          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      )}>
                        {spouse.current ? "Current" : "Former"}
                      </span>
                    </div>
                    {(spouse.startDate || spouse.endDate) && (
                      <div className="text-muted-foreground text-xs mt-1">
                        {spouse.startDate && `From ${spouse.startDate}`}
                        {spouse.endDate && ` to ${spouse.endDate}`}
                      </div>
                    )}
                    {spouse.sharedCompanies.length > 0 && (
                      <div className="text-xs mt-2">
                        <span className="text-muted-foreground">Shared companies:</span>{" "}
                        {spouse.sharedCompanies.slice(0, 3).join(", ")}
                      </div>
                    )}
                    {spouse.combinedPoliticalGiving && (
                      <div className="text-xs mt-1">
                        <span className="text-muted-foreground">Combined political giving:</span>{" "}
                        <span className="font-medium">${spouse.combinedPoliticalGiving.toLocaleString()}</span>
                      </div>
                    )}
                    {spouse.wikidataId && (
                      <a
                        href={`https://www.wikidata.org/wiki/${spouse.wikidataId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-xs hover:underline flex items-center gap-1 mt-2"
                      >
                        Wikidata <Link className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded border border-border bg-muted/20 p-4 text-center">
              <div className="text-muted-foreground text-sm">No spouse/partner found</div>
              <div className="text-muted-foreground text-xs mt-1">
                Try using searchWeb for broader research
              </div>
            </div>
          )}

          {/* Wealth Indicators */}
          {result.householdWealth.wealthIndicators.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Wealth Indicators
              </div>
              <ul className="space-y-1 text-sm">
                {result.householdWealth.wealthIndicators.map((indicator, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{indicator}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sources */}
          {result.sources && result.sources.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Sources
              </div>
              <div className="space-y-1">
                {result.sources.slice(0, 3).map((source, index) => (
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
        </div>
      )
    }

    // Handle Find Business Ownership results
    if (
      toolName === "find_business_ownership" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "businesses" in parsedResult &&
      "summary" in parsedResult
    ) {
      const result = parsedResult as {
        personName: string
        businesses: Array<{
          companyName: string
          entityNumber: string | null
          state: string
          jurisdiction: string
          entityType: string | null
          status: string | null
          roles: string[]
          ownershipLikelihood: "confirmed" | "high" | "medium" | "low" | "unknown"
          ownershipReason: string
          sourceUrl: string
        }>
        summary: {
          confirmed: number
          highLikelihood: number
          mediumLikelihood: number
          lowLikelihood: number
          total: number
          uniqueStates: string[]
        }
        statesSearched: string[]
        statesSucceeded: string[]
        statesFailed: string[]
        sources?: Array<{ name: string; url: string }>
        error?: string
        warnings?: string[]
      }

      if (result.error) {
        return <div className="text-muted-foreground">{result.error}</div>
      }

      // Ownership likelihood badge styling
      const getLikelihoodBadgeClass = (likelihood: string) => {
        switch (likelihood) {
          case "confirmed":
            return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
          case "high":
            return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
          case "medium":
            return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
          case "low":
            return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          default:
            return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
        }
      }

      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium text-foreground text-lg">
                {result.personName}
              </div>
              <div className="text-muted-foreground text-xs">
                {result.summary.total} businesses found in {result.statesSucceeded.length} states
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            {result.summary.confirmed > 0 && (
              <div className="rounded border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 px-2 py-1">
                <div className="text-green-700 dark:text-green-400 font-bold">{result.summary.confirmed}</div>
                <div className="text-muted-foreground text-xs">Confirmed</div>
              </div>
            )}
            {result.summary.highLikelihood > 0 && (
              <div className="rounded border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-2 py-1">
                <div className="text-blue-700 dark:text-blue-400 font-bold">{result.summary.highLikelihood}</div>
                <div className="text-muted-foreground text-xs">High</div>
              </div>
            )}
            {result.summary.mediumLikelihood > 0 && (
              <div className="rounded border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30 px-2 py-1">
                <div className="text-yellow-700 dark:text-yellow-400 font-bold">{result.summary.mediumLikelihood}</div>
                <div className="text-muted-foreground text-xs">Medium</div>
              </div>
            )}
            {result.summary.lowLikelihood > 0 && (
              <div className="rounded border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30 px-2 py-1">
                <div className="text-gray-700 dark:text-gray-400 font-bold">{result.summary.lowLikelihood}</div>
                <div className="text-muted-foreground text-xs">Low</div>
              </div>
            )}
          </div>

          {/* Businesses */}
          <div className="space-y-3">
            {result.businesses.slice(0, 10).map((business, index) => (
              <div key={index} className="rounded border border-border p-3">
                <div className="flex items-start justify-between">
                  <a
                    href={business.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary group font-medium hover:underline flex items-center gap-1"
                  >
                    {business.companyName}
                    <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                  </a>
                  <span className={cn("rounded px-1.5 py-0.5 text-xs capitalize", getLikelihoodBadgeClass(business.ownershipLikelihood))}>
                    {business.ownershipLikelihood === "confirmed" ? "Owner" : `${business.ownershipLikelihood} likelihood`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-1 text-xs">
                  <span className="bg-secondary rounded px-1.5 py-0.5">{business.state}</span>
                  {business.status && (
                    <span className={cn(
                      "rounded px-1.5 py-0.5",
                      business.status.toLowerCase().includes("active")
                        ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    )}>
                      {business.status}
                    </span>
                  )}
                  {business.roles.length > 0 && (
                    <span className="text-muted-foreground">{business.roles.join(", ")}</span>
                  )}
                </div>
                {business.ownershipReason && (
                  <div className="text-muted-foreground text-xs mt-1 italic">{business.ownershipReason}</div>
                )}
              </div>
            ))}
          </div>

          {/* Warnings */}
          {result.warnings && result.warnings.length > 0 && (
            <div className="rounded border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20 p-3">
              <div className="text-yellow-700 dark:text-yellow-400 text-xs font-medium mb-1">Warnings</div>
              {result.warnings.map((warning, index) => (
                <div key={index} className="text-muted-foreground text-xs">{warning}</div>
              ))}
            </div>
          )}

          {/* Failed States */}
          {result.statesFailed.length > 0 && (
            <div className="text-muted-foreground text-xs">
              Could not search: {result.statesFailed.join(", ")}
            </div>
          )}
        </div>
      )
    }

    // Handle GLEIF Search results
    if (
      toolName === "gleif_search" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "entities" in parsedResult
    ) {
      const result = parsedResult as {
        totalResults: number
        entities: Array<{
          lei: string
          legalName: string
          jurisdiction: string
          status?: string
          entityCategory?: string
          legalAddress?: string
          url: string
        }>
        sources?: Array<{ name: string; url: string }>
      }

      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{result.totalResults} LEI records</span>
          </div>
          <div className="space-y-3">
            {result.entities.slice(0, 10).map((entity, index) => (
              <div key={index} className="border-border rounded-md border p-3">
                <a
                  href={entity.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary group flex items-center gap-1 font-medium hover:underline"
                >
                  {entity.legalName}
                  <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                </a>
                <div className="text-muted-foreground mt-1 font-mono text-xs">{entity.lei}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  <span className="bg-secondary rounded px-1.5 py-0.5">{entity.jurisdiction}</span>
                  {entity.status && (
                    <span className={cn(
                      "rounded px-1.5 py-0.5",
                      entity.status === "ACTIVE"
                        ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    )}>
                      {entity.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Handle GLEIF Lookup results (with ownership chain)
    if (
      toolName === "gleif_lookup" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "entity" in parsedResult
    ) {
      const result = parsedResult as {
        entity: {
          lei: string
          legalName: string
          jurisdiction: string
          status?: string
          entityCategory?: string
          legalAddress?: string
        }
        directParent?: {
          lei: string
          legalName: string
          jurisdiction?: string
        }
        ultimateParent?: {
          lei: string
          legalName: string
          jurisdiction?: string
        }
        sources?: Array<{ name: string; url: string }>
      }

      return (
        <div className="space-y-4">
          {/* Main Entity */}
          <div className="border-border rounded-md border p-3">
            <div className="font-medium">{result.entity.legalName}</div>
            <div className="text-muted-foreground mt-1 font-mono text-xs">{result.entity.lei}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="bg-secondary rounded px-1.5 py-0.5">{result.entity.jurisdiction}</span>
              {result.entity.status && (
                <span className={cn(
                  "rounded px-1.5 py-0.5",
                  result.entity.status === "ACTIVE"
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                )}>
                  {result.entity.status}
                </span>
              )}
            </div>
          </div>

          {/* Ownership Chain */}
          {(result.directParent || result.ultimateParent) && (
            <div>
              <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Ownership Chain
              </div>
              <div className="space-y-2">
                {result.directParent && (
                  <div className="border-border rounded border-l-2 border-l-blue-500 p-2">
                    <div className="text-muted-foreground text-xs">Direct Parent</div>
                    <div className="font-medium">{result.directParent.legalName}</div>
                    <div className="text-muted-foreground font-mono text-xs">{result.directParent.lei}</div>
                  </div>
                )}
                {result.ultimateParent && result.ultimateParent.lei !== result.directParent?.lei && (
                  <div className="border-border rounded border-l-2 border-l-green-500 p-2">
                    <div className="text-muted-foreground text-xs">Ultimate Parent</div>
                    <div className="font-medium">{result.ultimateParent.legalName}</div>
                    <div className="text-muted-foreground font-mono text-xs">{result.ultimateParent.lei}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )
    }

    // Handle Rental Investment results
    if (
      toolName === "rental_investment" &&
      typeof parsedResult === "object" &&
      parsedResult !== null &&
      "rentEstimate" in parsedResult
    ) {
      const result = parsedResult as {
        address: string
        rentEstimate: number
        rentRange?: { low: number; high: number }
        propertyValue?: number
        capRate?: number
        cashOnCashReturn?: number
        monthlyCashFlow?: number
        sources?: Array<{ name: string; url: string }>
      }

      return (
        <div className="space-y-4">
          <div className="font-medium">{result.address}</div>

          <div className="grid grid-cols-2 gap-4">
            <div className="border-border rounded-md border p-3">
              <div className="text-muted-foreground text-xs">Monthly Rent Estimate</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                ${result.rentEstimate.toLocaleString()}
              </div>
              {result.rentRange && (
                <div className="text-muted-foreground text-xs">
                  Range: ${result.rentRange.low.toLocaleString()} - ${result.rentRange.high.toLocaleString()}
                </div>
              )}
            </div>

            {result.capRate !== undefined && (
              <div className="border-border rounded-md border p-3">
                <div className="text-muted-foreground text-xs">Cap Rate</div>
                <div className="text-xl font-bold">{result.capRate.toFixed(2)}%</div>
              </div>
            )}
          </div>

          {result.monthlyCashFlow !== undefined && (
            <div className="border-border rounded-md border p-3">
              <div className="text-muted-foreground text-xs">Monthly Cash Flow</div>
              <div className={cn(
                "text-lg font-bold",
                result.monthlyCashFlow >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}>
                ${result.monthlyCashFlow.toLocaleString()}
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
