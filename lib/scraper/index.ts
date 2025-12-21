/**
 * Business Registry Data Module (Serverless-Compatible)
 *
 * Uses FREE, RELIABLE data sources only - NO Playwright/browser required.
 * All sources work in serverless environments (Vercel, AWS Lambda, etc.)
 *
 * Supported sources:
 * - Colorado: data.colorado.gov (Socrata API - FREE)
 * - New York: data.ny.gov (Socrata API - FREE)
 * - Florida: search.sunbiz.org (HTTP scraping - no browser needed)
 *
 * Usage:
 * ```typescript
 * import { searchBusinesses, searchByOfficer } from '@/lib/scraper'
 *
 * // Search by company name (uses CO, NY, FL)
 * const result = await searchBusinesses('Apple Inc', { states: ['CO', 'NY', 'FL'] })
 *
 * // Search by officer/agent name (CO only - uses registered agent search)
 * const result = await searchByOfficer('Tim Cook', { limit: 25 })
 * ```
 */

// Core configuration and types
export * from "./config"

// API-first business search (recommended)
// Uses only FREE, reliable sources: CO, NY, FL
export {
  // Unified search (routes to best source)
  searchBusinesses,
  searchByOfficer,
  getDataSourcesStatus,
  getReliableStates,
  // State Open Data APIs
  searchColoradoBusinesses,
  searchColoradoByAgent,
  hasStateOpenDataAPI,
  getStatesWithOpenDataAPI,
} from "./apis"

// Validation utilities
export {
  validateSearchQuery,
  validateStateCode,
  validateStateCodes,
  validateLimit,
  validateUrl,
  validateEntityNumber,
  sanitizeForUrl,
  sanitizeForSoql,
  VALID_STATE_CODES,
  type ValidationResult,
} from "./validation"

// State configuration templates
export * from "./config/index"

// Scraper engines (API and HTTP only - no browser)
export {
  // API Scraper (Tier 1)
  searchSocrataApi,
  searchRestApi,
  fetchSocrataApi,
  fetchRestApi,
  buildSocrataFilter,
  mapSocrataToEntity,
  type SocrataFieldMapping,
  // HTTP Scraper (Tier 2)
  scrapeHttpState,
  fetchHtml,
  parseHtmlResults,
  buildFormData,
  decodeHtmlEntities,
  extractWithSelector,
  extractRows,
  type HtmlParseConfig,
} from "./engine"

// Services
export {
  // Rate Limiter
  RateLimiter,
  getRateLimiter,
  rateLimited,
  withRateLimit,
  DEFAULT_RATE_LIMITS,
  type RateLimitConfig,
  // Circuit Breaker
  CircuitBreaker,
  getCircuitBreaker,
  withCircuitBreaker,
  DEFAULT_CIRCUIT_CONFIG,
  type CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerResult,
  // Cache
  ScraperCache,
  getScraperCache,
  withCache,
  generateCacheKey,
  DEFAULT_CACHE_CONFIG,
  type CacheEntry,
  type CacheConfig,
} from "./services"

// Person Search & Ownership Inference
export {
  // Person search
  searchBusinessesByPerson,
  quickPersonSearch,
  getOwnershipSummary,
  type PersonSearchResult,
  type PersonBusinessResult,
  type SecInsiderResult,
  type PersonSearchOptions,
  // Ownership inference
  inferOwnership,
  inferOwnershipFromRole,
  inferOwnershipFromRoles,
  detectEntityType,
  adjustForEntityType,
  adjustForSource,
  getLikelihoodLabel,
  getLikelihoodColor,
  type OwnershipLikelihood,
  type OwnershipInference,
  type DataSource,
  type EntityType,
} from "./search"

// State scrapers (API and HTTP only)
export {
  scrapeFloridaBusinesses,
  scrapeFloridaByOfficer,
  searchFloridaHttp,
  scrapeNewYorkBusinesses,
  searchNewYorkOpenData,
  scrapeColoradoBusinesses,
  searchColoradoOpenData,
} from "./scrapers/states"

import {
  type ScrapedBusinessEntity,
  type ScraperResult,
  type ScraperSource,
} from "./config"
import {
  scrapeFloridaBusinesses,
  scrapeNewYorkBusinesses,
  scrapeColoradoBusinesses,
} from "./scrapers/states"

/**
 * Unified business registry search across multiple sources
 * Serverless-compatible - no Playwright/browser required
 */
export async function scrapeBusinessRegistry(
  query: string,
  options: {
    sources?: ScraperSource[]
    searchType?: "company" | "officer"
    limit?: number
    parallel?: boolean
  } = {}
): Promise<{
  results: Map<ScraperSource, ScraperResult<ScrapedBusinessEntity>>
  totalFound: number
  successful: ScraperSource[]
  failed: ScraperSource[]
}> {
  const {
    sources = ["florida", "newYork", "colorado"],
    searchType = "company",
    limit = 20,
    parallel = true,
  } = options

  const results = new Map<ScraperSource, ScraperResult<ScrapedBusinessEntity>>()
  const successful: ScraperSource[] = []
  const failed: ScraperSource[] = []
  let totalFound = 0

  // Define scraper functions for each source (API/HTTP only - no browser)
  const scraperFunctions: Partial<Record<ScraperSource, () => Promise<ScraperResult<ScrapedBusinessEntity>>>> = {
    florida: async () => {
      // Florida uses HTTP scraping (serverless-compatible)
      // Note: Officer search is not supported in serverless
      if (searchType === "officer") {
        return {
          success: false,
          data: [],
          totalFound: 0,
          source: "florida" as const,
          query,
          scrapedAt: new Date().toISOString(),
          duration: 0,
          error: "Florida officer search requires browser. Use Colorado agent search or SEC EDGAR instead.",
        }
      }
      return scrapeFloridaBusinesses(query, { limit })
    },
    newYork: async () => {
      // NY uses Socrata Open Data API (serverless-compatible)
      // Note: API only contains active corporations
      return scrapeNewYorkBusinesses(query, { limit })
    },
    colorado: async () => {
      // Colorado uses Socrata Open Data API (serverless-compatible)
      return scrapeColoradoBusinesses(query, { limit })
    },
    california: async () => {
      // California requires browser - not supported in serverless
      return {
        success: false,
        data: [],
        totalFound: 0,
        source: "california" as const,
        query,
        scrapedAt: new Date().toISOString(),
        duration: 0,
        error: "California requires browser scraping, not supported in serverless. " +
               "Search manually at: https://bizfileonline.sos.ca.gov/search/business",
      }
    },
    texas: async () => {
      // Texas requires paid account
      return {
        success: false,
        data: [],
        totalFound: 0,
        source: "texas" as const,
        query,
        scrapedAt: new Date().toISOString(),
        duration: 0,
        error: "Texas SOSDirect requires paid account ($1/search). " +
               "Phone search is free: 512-463-5555",
      }
    },
  }

  // Filter to only supported sources
  const supportedSources = sources.filter(s => s in scraperFunctions)

  // Run scrapers
  if (parallel) {
    const promises = supportedSources.map(async (source) => {
      try {
        const scraperFn = scraperFunctions[source]
        if (!scraperFn) {
          return {
            source,
            result: {
              success: false,
              data: [],
              totalFound: 0,
              source,
              query,
              scrapedAt: new Date().toISOString(),
              duration: 0,
              error: `Source ${source} not supported`,
            } as ScraperResult<ScrapedBusinessEntity>,
          }
        }
        const result = await scraperFn()
        return { source, result }
      } catch (error) {
        return {
          source,
          result: {
            success: false,
            data: [],
            totalFound: 0,
            source,
            query,
            scrapedAt: new Date().toISOString(),
            duration: 0,
            error: error instanceof Error ? error.message : String(error),
          } as ScraperResult<ScrapedBusinessEntity>,
        }
      }
    })

    const outcomes = await Promise.all(promises)

    for (const { source, result } of outcomes) {
      results.set(source, result)
      if (result.success) {
        successful.push(source)
        totalFound += result.totalFound
      } else {
        failed.push(source)
      }
    }
  } else {
    // Sequential execution
    for (const source of supportedSources) {
      try {
        const scraperFn = scraperFunctions[source]
        if (!scraperFn) {
          failed.push(source)
          results.set(source, {
            success: false,
            data: [],
            totalFound: 0,
            source,
            query,
            scrapedAt: new Date().toISOString(),
            duration: 0,
            error: `Source ${source} not supported`,
          })
          continue
        }
        const result = await scraperFn()
        results.set(source, result)
        if (result.success) {
          successful.push(source)
          totalFound += result.totalFound
        } else {
          failed.push(source)
        }
      } catch (error) {
        failed.push(source)
        results.set(source, {
          success: false,
          data: [],
          totalFound: 0,
          source,
          query,
          scrapedAt: new Date().toISOString(),
          duration: 0,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return { results, totalFound, successful, failed }
}
