/**
 * Batch Processing Tools Configuration
 *
 * TOOLS DISABLED: Perplexity Sonar Reasoning Pro has built-in web search
 * and does NOT support function calling. All data API tools have been removed.
 *
 * The batch research now relies entirely on Perplexity's built-in search
 * capabilities for prospect research.
 */

import { ToolSet } from "ai"

// ============================================================================
// REFERENCE: Keep one import commented for future use if tools are re-enabled
// ============================================================================
// import {
//   propublicaNonprofitSearchTool,
//   propublicaNonprofitDetailsTool,
//   shouldEnableProPublicaTools,
// } from "@/lib/tools/propublica-nonprofits"

/**
 * Build the tools object for batch processing
 *
 * TOOLS DISABLED: Returns empty object because Perplexity has built-in web search
 * and does not support function calling. All research is done via Perplexity's
 * native search capabilities.
 */
export function buildBatchTools(): ToolSet {
  // Tools disabled - Perplexity Sonar Reasoning has built-in web search
  // and does NOT support function calling
  return {}
}

/**
 * Get a description of available tools for the system prompt
 *
 * TOOLS DISABLED: Returns empty string since Perplexity has built-in search
 */
export function getToolDescriptions(): string {
  // Tool descriptions disabled - Perplexity has built-in web search
  return ""
}

/**
 * Extract sources from tool results for display
 * Handles the various source formats returned by different tools
 *
 * NOTE: Kept for backward compatibility if tools are re-enabled in future
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
