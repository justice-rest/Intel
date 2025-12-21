/**
 * Unified State Scraper Engine
 *
 * Routes scraping requests to the appropriate engine based on state tier:
 * - Tier 1: API-based scraping (Socrata, REST)
 * - Tier 2: HTTP-based scraping (fetch + regex)
 * - Tier 3: Browser-based scraping (Playwright)
 * - Tier 4: Browser + CAPTCHA solving
 *
 * Features:
 * - Automatic tier detection and routing
 * - Fallback from HTTP to browser on failure
 * - Rate limiting, caching, circuit breaker
 * - Parallel multi-state search
 * - Comprehensive error handling
 */

import type { StateRegistryConfig } from "../config/state-template"
import type { ScrapedBusinessEntity, ScraperResult } from "../config"
import { getStateConfig, getAvailableStates } from "../config/states"
import { getRateLimiter } from "../services/rate-limiter"
import { getCircuitBreaker } from "../services/circuit-breaker"
import { getScraperCache } from "../services/cache"
import { scrapeHttpState, type HtmlParseConfig } from "./http-scraper"
import { scrapeBrowserState } from "./browser-scraper"

/**
 * Scraper options
 */
export interface UnifiedScraperOptions {
  /** Maximum results to return */
  limit?: number
  /** Skip cache lookup */
  skipCache?: boolean
  /** Use browser even for Tier 2 states */
  forceBrowser?: boolean
  /** Timeout in milliseconds */
  timeout?: number
  /** Fetch detail pages for full officer lists */
  fetchDetails?: boolean
}

/**
 * Multi-state search options
 */
export interface MultiStateSearchOptions extends UnifiedScraperOptions {
  /** States to search (default: all configured) */
  states?: string[]
  /** Run searches in parallel */
  parallel?: boolean
  /** Maximum concurrent searches */
  maxConcurrent?: number
  /** Continue on error */
  continueOnError?: boolean
}

/**
 * Multi-state search result
 */
export interface MultiStateSearchResult {
  success: boolean
  totalFound: number
  results: ScrapedBusinessEntity[]
  statesSearched: string[]
  statesSucceeded: string[]
  statesFailed: Array<{ state: string; error: string }>
  duration: number
  warnings?: string[]
}

/**
 * Convert state config to HTTP parse config
 */
function configToParseConfig(config: StateRegistryConfig): HtmlParseConfig {
  if (!config.scraping) {
    throw new Error(`No scraping config for ${config.stateCode}`)
  }

  const { searchSelectors } = config.scraping

  return {
    rowSelector: searchSelectors.resultRows,
    fieldSelectors: {
      name: searchSelectors.entityName,
      entityNumber: searchSelectors.entityNumber,
      status: searchSelectors.status,
      filingDate: searchSelectors.filingDate,
      entityType: searchSelectors.entityType,
      detailLink: searchSelectors.detailLink,
    },
    baseUrl: config.baseUrl,
    source: config.stateCode,
  }
}

/**
 * Escape special characters for Socrata SoQL queries
 */
function escapeSoqlQuery(query: string): string {
  // Escape single quotes and backslashes for SoQL
  return query.replace(/\\/g, "\\\\").replace(/'/g, "''")
}

/**
 * Validate and sanitize search query
 */
function sanitizeQuery(query: string): { valid: boolean; sanitized: string; error?: string } {
  if (!query || typeof query !== "string") {
    return { valid: false, sanitized: "", error: "Query is required" }
  }

  const trimmed = query.trim()
  if (trimmed.length < 2) {
    return { valid: false, sanitized: "", error: "Query must be at least 2 characters" }
  }

  if (trimmed.length > 200) {
    return { valid: false, sanitized: "", error: "Query too long (max 200 characters)" }
  }

  // Remove potentially dangerous characters but allow common business name chars
  const sanitized = trimmed.replace(/[<>]/g, "")

  return { valid: true, sanitized }
}

/**
 * Get Socrata field name for entity name based on state
 */
function getSocrataNameField(stateCode: string): string {
  const stateFields: Record<string, string> = {
    tx: "taxpayer_name",
    co: "entityname",
    ia: "business_name",
    ny: "current_entity_name",
  }
  return stateFields[stateCode] || "entityname"
}

/**
 * Scrape a state using API (Tier 1)
 */
async function scrapeApiState(
  config: StateRegistryConfig,
  query: string,
  options: UnifiedScraperOptions
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const { limit = 25, timeout = 30000 } = options

  if (!config.api) {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: config.stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: "No API configuration",
    }
  }

  // Validate query
  const validation = sanitizeQuery(query)
  if (!validation.valid) {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: config.stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: validation.error,
    }
  }

  try {
    let url: string
    const params = new URLSearchParams()

    switch (config.api.type) {
      case "socrata":
        // Socrata API format - use state-specific field name
        const nameField = getSocrataNameField(config.stateCode)
        params.set("$limit", String(limit))
        params.set("$where", `upper(${nameField}) LIKE upper('%${escapeSoqlQuery(validation.sanitized)}%')`)
        url = `${config.api.baseUrl}?${params.toString()}`
        break

      case "rest":
        // Generic REST API
        params.set("q", validation.sanitized)
        params.set("limit", String(limit))
        url = `${config.api.baseUrl}/search?${params.toString()}`
        break

      default:
        throw new Error(`Unsupported API type: ${config.api.type}`)
    }

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(config.api.appToken ? { "X-App-Token": config.api.appToken } : {}),
        ...config.api.headers,
      },
      signal: AbortSignal.timeout(timeout),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const results: ScrapedBusinessEntity[] = (Array.isArray(data) ? data : data.results || [])
      .slice(0, limit)
      .map((item: Record<string, unknown>) => {
        // Handle state-specific field names
        const name = String(
          item.entityname || item.name || item.business_name ||
          item.taxpayer_name || item.current_entity_name || ""
        )
        const entityNumber = item.entityid || item.id || item.file_number || item.taxpayer_number
          ? String(item.entityid || item.id || item.file_number || item.taxpayer_number)
          : null

        return {
          name,
          entityNumber,
          jurisdiction: `us_${config.stateCode}`,
          status: item.entitystatus || item.status
            ? String(item.entitystatus || item.status)
            : null,
          incorporationDate: item.entityformdate || item.formation_date
            ? String(item.entityformdate || item.formation_date)
            : null,
          entityType: item.entitytype || item.type
            ? String(item.entitytype || item.type)
            : null,
          registeredAddress: null,
          registeredAgent: item.agentname || item.agent
            ? String(item.agentname || item.agent)
            : null,
          sourceUrl: config.baseUrl,
          source: config.stateCode as ScrapedBusinessEntity["source"],
          scrapedAt: new Date().toISOString(),
        }
      })
      .filter((e: ScrapedBusinessEntity) => e.name && e.name.length > 0)

    return {
      success: true,
      data: results,
      totalFound: results.length,
      source: config.stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: config.stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Check if there's a dedicated scraper for a state
 */
async function tryDedicatedScraper(
  stateCode: string,
  query: string,
  options: UnifiedScraperOptions
): Promise<ScraperResult<ScrapedBusinessEntity> | null> {
  const { limit = 25 } = options

  try {
    switch (stateCode) {
      case "fl": {
        const { scrapeFloridaBusinesses } = await import("../scrapers/states/florida")
        return scrapeFloridaBusinesses(query, { limit })
      }
      case "ny": {
        const { searchNewYorkOpenData } = await import("../scrapers/states/new-york")
        return searchNewYorkOpenData(query, { limit })
      }
      case "ca": {
        const { scrapeCaliforniaBusinesses } = await import("../scrapers/states/california")
        return scrapeCaliforniaBusinesses(query, { limit })
      }
      default:
        return null
    }
  } catch (error) {
    console.log(`[Unified Scraper] No dedicated scraper for ${stateCode}, using generic`)
    return null
  }
}

/**
 * Scrape a single state
 */
export async function scrapeState(
  stateCode: string,
  query: string,
  options: UnifiedScraperOptions = {}
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const config = getStateConfig(stateCode)

  if (!config) {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: `No configuration found for state: ${stateCode}`,
    }
  }

  const rateLimiter = getRateLimiter()
  const circuitBreaker = getCircuitBreaker()
  const cache = getScraperCache()

  // Try dedicated scraper first for states with custom implementations
  const dedicatedResult = await tryDedicatedScraper(stateCode, query, options)
  if (dedicatedResult) {
    return dedicatedResult
  }

  // Check cache first
  if (!options.skipCache) {
    const cached = await cache.get<ScrapedBusinessEntity[]>(stateCode, query, { limit: options.limit })
    if (cached) {
      return {
        success: true,
        data: cached.data,
        totalFound: cached.totalFound,
        source: stateCode as ScrapedBusinessEntity["source"],
        query,
        scrapedAt: cached.createdAt,
        duration: Date.now() - startTime,
      }
    }
  }

  // Check circuit breaker
  if (!circuitBreaker.isAllowed(stateCode)) {
    const info = circuitBreaker.getInfo(stateCode)
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: `Circuit breaker OPEN. Retry in ${Math.ceil((info.timeUntilReset || 0) / 1000)}s`,
    }
  }

  // Rate limit
  await rateLimiter.acquire(stateCode)

  let result: ScraperResult<ScrapedBusinessEntity>

  try {
    // Route to appropriate scraper based on tier
    switch (config.tier) {
      case 1:
        // API-based scraping
        if (config.api) {
          result = await scrapeApiState(config, query, options)
          // If API fails, fall back to HTTP scraping if available
          if (!result.success && config.scraping) {
            console.log(`[Unified Scraper] API failed for ${stateCode}, trying HTTP...`)
            result = await scrapeHttpState(stateCode, config, query, {
              limit: options.limit,
              parseConfig: configToParseConfig(config),
            })
          }
        } else if (config.scraping) {
          result = await scrapeHttpState(stateCode, config, query, {
            limit: options.limit,
            parseConfig: configToParseConfig(config),
          })
        } else {
          throw new Error("No API or scraping configuration")
        }
        break

      case 2:
        // HTTP-based scraping with browser fallback
        if (!options.forceBrowser && config.scraping) {
          result = await scrapeHttpState(stateCode, config, query, {
            limit: options.limit,
            parseConfig: configToParseConfig(config),
          })
          // If HTTP fails (e.g., CAPTCHA), fall back to browser
          if (!result.success && result.error?.includes("CAPTCHA")) {
            console.log(`[Unified Scraper] HTTP blocked for ${stateCode}, trying browser...`)
            result = await scrapeBrowserState(stateCode, config, query, {
              limit: options.limit,
              skipCache: true,
            })
          }
        } else {
          result = await scrapeBrowserState(stateCode, config, query, {
            limit: options.limit,
            skipCache: options.skipCache,
          })
        }
        break

      case 3:
      case 4:
        // Browser-based scraping (with CAPTCHA for Tier 4)
        result = await scrapeBrowserState(stateCode, config, query, {
          limit: options.limit,
          skipCache: options.skipCache,
        })
        break

      default:
        throw new Error(`Unknown tier: ${config.tier}`)
    }

    // Record success/failure
    if (result.success) {
      circuitBreaker.recordSuccess(stateCode)
      // Cache successful results
      await cache.set(stateCode, query, result.data, result.totalFound, { limit: options.limit })
    } else {
      circuitBreaker.recordFailure(stateCode, result.error || "Unknown error")
    }

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    circuitBreaker.recordFailure(stateCode, errorMessage)

    return {
      success: false,
      data: [],
      totalFound: 0,
      source: stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: errorMessage,
    }
  }
}

/**
 * Search multiple states in parallel
 */
export async function searchMultipleStates(
  query: string,
  options: MultiStateSearchOptions = {}
): Promise<MultiStateSearchResult> {
  const startTime = Date.now()
  const {
    states = getAvailableStates(),
    parallel = true,
    maxConcurrent = 5,
    continueOnError = true,
    ...scraperOptions
  } = options

  const validStates = states.filter(s => getStateConfig(s))
  const statesSucceeded: string[] = []
  const statesFailed: Array<{ state: string; error: string }> = []
  const allResults: ScrapedBusinessEntity[] = []
  const warnings: string[] = []

  if (validStates.length === 0) {
    return {
      success: false,
      totalFound: 0,
      results: [],
      statesSearched: states,
      statesSucceeded: [],
      statesFailed: states.map(s => ({ state: s, error: "No configuration found" })),
      duration: Date.now() - startTime,
      warnings: ["No valid state configurations found"],
    }
  }

  // Invalid states warning
  const invalidStates = states.filter(s => !getStateConfig(s))
  if (invalidStates.length > 0) {
    warnings.push(`Skipped unconfigured states: ${invalidStates.join(", ")}`)
  }

  if (parallel) {
    // Process in batches for controlled parallelism
    for (let i = 0; i < validStates.length; i += maxConcurrent) {
      const batch = validStates.slice(i, i + maxConcurrent)

      const batchPromises = batch.map(async (stateCode) => {
        const result = await scrapeState(stateCode, query, scraperOptions)
        return { stateCode, result }
      })

      const batchResults = await Promise.allSettled(batchPromises)

      for (const settled of batchResults) {
        if (settled.status === "fulfilled") {
          const { stateCode, result } = settled.value
          if (result.success) {
            statesSucceeded.push(stateCode)
            allResults.push(...result.data)
          } else {
            statesFailed.push({ state: stateCode, error: result.error || "Unknown error" })
            if (!continueOnError) break
          }
        } else {
          // Promise rejected
          const error = settled.reason instanceof Error ? settled.reason.message : String(settled.reason)
          statesFailed.push({ state: "unknown", error })
        }
      }

      if (!continueOnError && statesFailed.length > 0) break
    }
  } else {
    // Sequential processing
    for (const stateCode of validStates) {
      const result = await scrapeState(stateCode, query, scraperOptions)

      if (result.success) {
        statesSucceeded.push(stateCode)
        allResults.push(...result.data)
      } else {
        statesFailed.push({ state: stateCode, error: result.error || "Unknown error" })
        if (!continueOnError) break
      }
    }
  }

  // Deduplicate results (same company might appear in multiple states)
  const deduped = deduplicateEntities(allResults)

  return {
    success: statesSucceeded.length > 0,
    totalFound: deduped.length,
    results: deduped,
    statesSearched: validStates,
    statesSucceeded,
    statesFailed,
    duration: Date.now() - startTime,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Deduplicate entities across states
 */
function deduplicateEntities(entities: ScrapedBusinessEntity[]): ScrapedBusinessEntity[] {
  const seen = new Map<string, ScrapedBusinessEntity>()

  for (const entity of entities) {
    // Key by normalized name + entity number (if available)
    const nameKey = entity.name.toLowerCase().replace(/[^a-z0-9]/g, "")
    const key = entity.entityNumber
      ? `${nameKey}_${entity.entityNumber}`
      : nameKey

    if (!seen.has(key)) {
      seen.set(key, entity)
    }
  }

  return Array.from(seen.values())
}

/**
 * Search specific states for a company
 */
export async function searchCompany(
  companyName: string,
  options: MultiStateSearchOptions = {}
): Promise<MultiStateSearchResult> {
  return searchMultipleStates(companyName, options)
}

/**
 * Get scraper health status for all states
 */
export function getScraperHealth(): Array<{
  stateCode: string
  stateName: string
  tier: number
  circuitBreakerStatus: string
  failureCount: number
  isAvailable: boolean
}> {
  const circuitBreaker = getCircuitBreaker()
  const states = getAvailableStates()

  return states.map(stateCode => {
    const config = getStateConfig(stateCode)
    const info = circuitBreaker.getInfo(stateCode)

    return {
      stateCode,
      stateName: config?.stateName || stateCode.toUpperCase(),
      tier: config?.tier || 0,
      circuitBreakerStatus: info.state,
      failureCount: info.failureCount,
      isAvailable: circuitBreaker.isAllowed(stateCode),
    }
  })
}

/**
 * Reset circuit breaker for a state
 */
export function resetStateCircuitBreaker(stateCode: string): void {
  const circuitBreaker = getCircuitBreaker()
  circuitBreaker.reset(stateCode)
}

/**
 * Get tier statistics
 */
export function getTierStatistics(): {
  tier1: { count: number; states: string[] }
  tier2: { count: number; states: string[] }
  tier3: { count: number; states: string[] }
  tier4: { count: number; states: string[] }
  total: number
} {
  const states = getAvailableStates()
  const tiers: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [] }

  for (const stateCode of states) {
    const config = getStateConfig(stateCode)
    if (config) {
      tiers[config.tier].push(stateCode)
    }
  }

  return {
    tier1: { count: tiers[1].length, states: tiers[1] },
    tier2: { count: tiers[2].length, states: tiers[2] },
    tier3: { count: tiers[3].length, states: tiers[3] },
    tier4: { count: tiers[4].length, states: tiers[4] },
    total: states.length,
  }
}
