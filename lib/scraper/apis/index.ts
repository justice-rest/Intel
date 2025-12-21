/**
 * Unified Business Data API
 *
 * Smart routing to FREE, RELIABLE data sources only.
 *
 * Supported sources (all FREE, no API keys needed):
 * - Colorado: data.colorado.gov (Socrata API)
 * - New York: data.ny.gov (Socrata API)
 * - Florida: HTTP scraping (Sunbiz) - most reliable web scraper
 *
 * REMOVED (unreliable):
 * - California: Timeouts
 * - Delaware: CAPTCHA blocks
 * - OpenCorporates: Requires payment
 */

import type { ScrapedBusinessEntity, ScraperResult } from "../config"
import {
  searchColoradoBusinesses,
  searchColoradoByAgent,
  hasStateOpenDataAPI,
  getStatesWithOpenDataAPI,
} from "./state-open-data"
import { searchNewYorkOpenData } from "../scrapers/states/new-york"
import { scrapeFloridaBusinesses } from "../scrapers/states/florida"

/**
 * States with reliable FREE APIs
 */
const RELIABLE_STATES = ["CO", "NY", "FL"]

/**
 * Search businesses by company name
 *
 * Uses only FREE, reliable sources:
 * - Colorado Open Data API
 * - New York Open Data API
 * - Florida Sunbiz (HTTP scraping)
 */
export async function searchBusinesses(
  query: string,
  options: {
    states?: string[]  // Specific states to search
    limit?: number
  } = {}
): Promise<{
  results: ScrapedBusinessEntity[]
  totalFound: number
  sources: {
    state: string
    source: string
    success: boolean
    count: number
    error?: string
  }[]
  duration: number
}> {
  const startTime = Date.now()
  const { states = RELIABLE_STATES, limit = 25 } = options

  // Filter to only reliable states
  const targetStates = states
    .map((s) => s.toUpperCase())
    .filter((s) => RELIABLE_STATES.includes(s))

  if (targetStates.length === 0) {
    return {
      results: [],
      totalFound: 0,
      sources: [{
        state: "N/A",
        source: "None",
        success: false,
        count: 0,
        error: `No reliable sources for states: ${states.join(", ")}. Available: ${RELIABLE_STATES.join(", ")}`,
      }],
      duration: Date.now() - startTime,
    }
  }

  const results: ScrapedBusinessEntity[] = []
  const sources: Array<{
    state: string
    source: string
    success: boolean
    count: number
    error?: string
  }> = []

  const limitPerState = Math.max(5, Math.ceil(limit / targetStates.length))

  // Search all states in parallel
  const promises = targetStates.map(async (state) => {
    try {
      let result: ScraperResult<ScrapedBusinessEntity>

      switch (state) {
        case "CO":
          result = await searchColoradoBusinesses(query, { limit: limitPerState })
          return {
            state,
            source: "Colorado Open Data API",
            success: result.success,
            data: result.data,
            error: result.error,
          }

        case "NY":
          result = await searchNewYorkOpenData(query, { limit: limitPerState })
          return {
            state,
            source: "New York Open Data API",
            success: result.success,
            data: result.data,
            error: result.error,
          }

        case "FL":
          result = await scrapeFloridaBusinesses(query, { limit: limitPerState })
          return {
            state,
            source: "Florida Sunbiz (HTTP)",
            success: result.success,
            data: result.data,
            error: result.error,
          }

        default:
          return {
            state,
            source: "Unknown",
            success: false,
            data: [],
            error: `Unknown state: ${state}`,
          }
      }
    } catch (error) {
      return {
        state,
        source: `${state} API`,
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  const outcomes = await Promise.all(promises)

  for (const outcome of outcomes) {
    sources.push({
      state: outcome.state,
      source: outcome.source,
      success: outcome.success,
      count: outcome.data.length,
      error: outcome.error,
    })
    results.push(...outcome.data)
  }

  // Deduplicate by entity number + jurisdiction
  const unique = new Map<string, ScrapedBusinessEntity>()
  for (const entity of results) {
    const key = `${entity.jurisdiction}:${entity.entityNumber}`
    if (!unique.has(key)) {
      unique.set(key, entity)
    }
  }

  return {
    results: Array.from(unique.values()).slice(0, limit),
    totalFound: unique.size,
    sources,
    duration: Date.now() - startTime,
  }
}

/**
 * Search businesses by officer/agent name
 *
 * Uses Colorado agent search (only reliable source for this)
 */
export async function searchByOfficer(
  personName: string,
  options: {
    states?: string[]
    limit?: number
  } = {}
): Promise<{
  results: ScrapedBusinessEntity[]
  totalFound: number
  sources: {
    state: string
    source: string
    success: boolean
    count: number
    error?: string
  }[]
  duration: number
}> {
  const startTime = Date.now()
  const { limit = 25 } = options

  const results: ScrapedBusinessEntity[] = []
  const sources: Array<{
    state: string
    source: string
    success: boolean
    count: number
    error?: string
  }> = []

  // Colorado supports agent search
  try {
    const result = await searchColoradoByAgent(personName, { limit })
    sources.push({
      state: "CO",
      source: "Colorado Open Data (Agent Search)",
      success: result.success,
      count: result.data.length,
      error: result.error,
    })
    results.push(...result.data)
  } catch (error) {
    sources.push({
      state: "CO",
      source: "Colorado Open Data (Agent Search)",
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Add helpful note for other states
  sources.push({
    state: "INFO",
    source: "Note",
    success: true,
    count: 0,
    error: "For public company officers, use sec_insider_search tool instead",
  })

  return {
    results: results.slice(0, limit),
    totalFound: results.length,
    sources,
    duration: Date.now() - startTime,
  }
}

/**
 * Get available data sources status
 */
export function getDataSourcesStatus(): {
  stateAPIs: { state: string; enabled: boolean; description: string }[]
} {
  return {
    stateAPIs: [
      {
        state: "CO",
        enabled: true,
        description: "Colorado Open Data API - Free, no key required",
      },
      {
        state: "NY",
        enabled: true,
        description: "New York Open Data API - Free, no key required (active corps only)",
      },
      {
        state: "FL",
        enabled: true,
        description: "Florida Sunbiz - HTTP scraping, most reliable",
      },
    ],
  }
}

/**
 * Get list of reliable states
 */
export function getReliableStates(): string[] {
  return [...RELIABLE_STATES]
}

// Re-export state APIs
export {
  searchColoradoBusinesses,
  searchColoradoByAgent,
  hasStateOpenDataAPI,
  getStatesWithOpenDataAPI,
} from "./state-open-data"
