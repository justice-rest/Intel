/**
 * API Scraper Engine (Tier 1)
 *
 * Handles states with FREE API/Open Data access.
 * These states provide public APIs (usually Socrata) that don't require scraping.
 *
 * Supported API types:
 * - Socrata (data.ny.gov, data.colorado.gov, etc.)
 * - REST (custom state APIs)
 * - GraphQL (rare)
 *
 * Tier 1 States:
 * - Colorado (CO) - Socrata
 * - Iowa (IA) - REST API
 * - New York (NY) - Socrata
 * - California (CA) - REST API (limited)
 * - Florida (FL) - HTTP (no official API but scrape-friendly)
 * - Texas (TX) - Socrata (limited, requires account for full access)
 * - Washington (WA) - Bulk download
 */

import type { StateRegistryConfig, ApiConfig } from "../config/state-template"
import type { ScrapedBusinessEntity, ScraperResult } from "../config"
import { getRateLimiter } from "../services/rate-limiter"
import { getCircuitBreaker } from "../services/circuit-breaker"
import { getScraperCache } from "../services/cache"

/**
 * Socrata Query Language (SoQL) filter builder
 */
export function buildSocrataFilter(
  query: string,
  options: {
    searchField?: string
    statusField?: string
    status?: "active" | "inactive" | "all"
    limit?: number
    offset?: number
    orderBy?: string
  } = {}
): URLSearchParams {
  const {
    searchField = "name",
    statusField = "status",
    status = "all",
    limit = 25,
    offset = 0,
    orderBy = "name ASC",
  } = options

  const params = new URLSearchParams({
    $limit: limit.toString(),
    $offset: offset.toString(),
    $order: orderBy,
  })

  // Build WHERE clause
  const conditions: string[] = []

  // Name search (case-insensitive)
  const escapedQuery = query.toUpperCase().replace(/'/g, "''")
  conditions.push(`UPPER(${searchField}) LIKE '%${escapedQuery}%'`)

  // Status filter (if applicable)
  if (status !== "all" && statusField) {
    const statusValue = status === "active" ? "Active" : "Inactive"
    conditions.push(`${statusField} = '${statusValue}'`)
  }

  if (conditions.length > 0) {
    params.append("$where", conditions.join(" AND "))
  }

  return params
}

/**
 * Generic Socrata API response type
 */
interface SocrataEntity {
  [key: string]: string | number | null | undefined
}

/**
 * Field mapping for Socrata datasets
 */
export interface SocrataFieldMapping {
  name: string
  entityNumber?: string
  status?: string
  incorporationDate?: string
  entityType?: string
  registeredAgent?: string
  address?: string | string[] // Can be single field or array of address components
}

/**
 * Fetch data from a Socrata API
 */
export async function fetchSocrataApi<T = SocrataEntity>(
  config: ApiConfig,
  params: URLSearchParams,
  headers?: Record<string, string>
): Promise<T[]> {
  const url = `${config.baseUrl}?${params.toString()}`

  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "Romy/1.0 (Nonprofit Research Tool)",
    ...headers,
  }

  // Add app token if configured
  if (config.appToken) {
    requestHeaders["X-App-Token"] = config.appToken
  }

  const response = await fetch(url, { headers: requestHeaders })

  if (!response.ok) {
    throw new Error(`Socrata API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Map Socrata response to ScrapedBusinessEntity
 */
export function mapSocrataToEntity(
  data: SocrataEntity,
  fieldMapping: SocrataFieldMapping,
  source: string,
  baseUrl: string
): ScrapedBusinessEntity {
  // Build address from components if array
  let address: string | null = null
  if (fieldMapping.address) {
    if (Array.isArray(fieldMapping.address)) {
      const parts = fieldMapping.address
        .map(field => data[field])
        .filter(Boolean)
      address = parts.length > 0 ? parts.join(", ") : null
    } else {
      address = data[fieldMapping.address] as string | null
    }
  }

  // Extract entity number for detail URL
  const entityNumber = fieldMapping.entityNumber ? data[fieldMapping.entityNumber] as string | null : null

  return {
    name: (data[fieldMapping.name] as string) || "",
    entityNumber,
    jurisdiction: `us_${source}`,
    status: fieldMapping.status ? (data[fieldMapping.status] as string | null) : null,
    incorporationDate: fieldMapping.incorporationDate
      ? ((data[fieldMapping.incorporationDate] as string | null)?.split("T")[0] || null)
      : null,
    entityType: fieldMapping.entityType ? (data[fieldMapping.entityType] as string | null) : null,
    registeredAddress: address,
    registeredAgent: fieldMapping.registeredAgent ? (data[fieldMapping.registeredAgent] as string | null) : null,
    sourceUrl: entityNumber ? `${baseUrl}/${entityNumber}` : baseUrl,
    source: source as ScrapedBusinessEntity["source"],
    scrapedAt: new Date().toISOString(),
  }
}

/**
 * Search using Socrata API
 */
export async function searchSocrataApi(
  stateCode: string,
  config: StateRegistryConfig,
  query: string,
  options: {
    limit?: number
    status?: "active" | "inactive" | "all"
    fieldMapping: SocrataFieldMapping
  }
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const { limit = 25, status = "all", fieldMapping } = options

  if (!config.api || config.api.type !== "socrata") {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: "State does not have Socrata API configuration",
    }
  }

  const rateLimiter = getRateLimiter()
  const circuitBreaker = getCircuitBreaker()
  const cache = getScraperCache()

  // Check cache
  const cached = await cache.get<ScrapedBusinessEntity[]>(stateCode, query, { limit, status })
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

  try {
    // Rate limit
    await rateLimiter.acquire(stateCode)

    // Build query
    const params = buildSocrataFilter(query, {
      searchField: fieldMapping.name,
      statusField: fieldMapping.status,
      status,
      limit,
    })

    // Fetch data
    const data = await fetchSocrataApi(config.api, params)

    // Map to entities
    const entities = data.map(item =>
      mapSocrataToEntity(item, fieldMapping, stateCode, config.baseUrl)
    )

    // Record success
    circuitBreaker.recordSuccess(stateCode)

    // Cache results
    await cache.set(stateCode, query, entities, entities.length, { limit, status })

    return {
      success: true,
      data: entities,
      totalFound: entities.length,
      source: stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
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
 * Generic REST API fetch
 */
export async function fetchRestApi<T>(
  url: string,
  options: {
    method?: "GET" | "POST"
    headers?: Record<string, string>
    body?: Record<string, unknown>
    timeout?: number
  } = {}
): Promise<T> {
  const { method = "GET", headers = {}, body, timeout = 30000 } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Romy/1.0 (Nonprofit Research Tool)",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`REST API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Search using generic REST API
 */
export async function searchRestApi(
  stateCode: string,
  config: StateRegistryConfig,
  query: string,
  options: {
    limit?: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapResponse: (data: any) => ScrapedBusinessEntity[]
  }
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const { limit = 25, mapResponse } = options

  if (!config.api) {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: "State does not have API configuration",
    }
  }

  const rateLimiter = getRateLimiter()
  const circuitBreaker = getCircuitBreaker()
  const cache = getScraperCache()

  // Check cache
  const cached = await cache.get<ScrapedBusinessEntity[]>(stateCode, query, { limit })
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

  try {
    // Rate limit
    await rateLimiter.acquire(stateCode)

    // Build URL with query parameters
    const url = new URL(config.api.baseUrl)
    url.searchParams.set("q", query)
    url.searchParams.set("limit", limit.toString())

    // Fetch data
    const data = await fetchRestApi(url.toString(), {
      headers: config.api.headers,
    })

    // Map response
    const entities = mapResponse(data).slice(0, limit)

    // Record success
    circuitBreaker.recordSuccess(stateCode)

    // Cache results
    await cache.set(stateCode, query, entities, entities.length, { limit })

    return {
      success: true,
      data: entities,
      totalFound: entities.length,
      source: stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
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
