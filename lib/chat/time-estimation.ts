/**
 * Time Estimation Utilities for Chat Responses
 * Provides adaptive time estimates based on tool usage and search state
 */

// Tool execution time estimates (in seconds) based on typical response times
export const TOOL_TIME_ESTIMATES: Record<string, number> = {
  linkup_prospect_research: 15, // LinkUp multi-query - 5 parallel queries, usually ~10-15s
  propublica_nonprofit_search: 3,
  propublica_nonprofit_details: 3,
  sec_edgar_filings: 5,
  sec_insider_search: 4,
  sec_proxy_search: 4,
  fec_contributions: 4,
  us_gov_data: 4,
  rag_search: 3,
  list_documents: 1,
  search_memory: 2,
}

// Base time for AI response generation without tools
export const BASE_RESPONSE_TIME_SECONDS = 5

// Time for AI to synthesize results after tools complete
export const SYNTHESIS_TIME_SECONDS = 8

// Minimum time to show (avoids showing "0s remaining")
export const MIN_DISPLAY_SECONDS = 3

/**
 * Calculate estimated time based on search state
 * @param enableSearch - Whether search tools are enabled
 * @returns Estimated time in seconds
 */
export function calculateInitialEstimate(enableSearch: boolean): number {
  if (!enableSearch) {
    return BASE_RESPONSE_TIME_SECONDS
  }

  // With search enabled, estimate based on typical prospect research
  // Average: 6-8 tools × ~5s each + synthesis time
  return 35 // ~35 seconds for a typical search-enabled response
}

/**
 * Calculate estimated time based on active tool count
 * @param activeToolCount - Number of tools currently being executed
 * @param enableSearch - Whether search is enabled
 * @returns Estimated time in seconds
 */
export function calculateEstimatedTime(
  activeToolCount: number,
  enableSearch: boolean
): number {
  if (!enableSearch || activeToolCount === 0) {
    return BASE_RESPONSE_TIME_SECONDS
  }

  // Average tool time when we don't know specific tools
  const avgToolTime = 5
  return activeToolCount * avgToolTime + SYNTHESIS_TIME_SECONDS
}

/**
 * Format seconds into human-readable time string
 * @param seconds - Number of seconds
 * @returns Formatted string (e.g., "~15s", "~1m 30s")
 */
export function formatTimeEstimate(seconds: number): string {
  const safeSeconds = Math.max(MIN_DISPLAY_SECONDS, Math.round(seconds))

  if (safeSeconds < 60) {
    return `~${safeSeconds}s`
  }

  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  if (remainingSeconds > 0) {
    return `~${minutes}m ${remainingSeconds}s`
  }

  return `~${minutes}m`
}

/**
 * Get time estimate for a specific tool
 * @param toolName - Name of the tool
 * @returns Estimated time in seconds
 */
export function getToolTimeEstimate(toolName: string): number {
  return TOOL_TIME_ESTIMATES[toolName] || 5 // Default to 5s if unknown
}
