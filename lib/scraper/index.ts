/**
 * Business Registry Data Module
 *
 * Uses FREE, RELIABLE data sources only:
 *
 * Supported sources:
 * - Colorado: data.colorado.gov (Socrata API - FREE)
 * - New York: data.ny.gov (Socrata API - FREE)
 * - Florida: search.sunbiz.org (HTTP scraping - reliable)
 *
 * REMOVED (unreliable):
 * - California: Timeouts
 * - Delaware: CAPTCHA blocks
 * - OpenCorporates: Requires payment
 *
 * Usage:
 * ```typescript
 * import { searchBusinesses, searchByOfficer } from '@/lib/scraper'
 *
 * // Search by company name (uses CO, NY, FL)
 * const result = await searchBusinesses('Apple Inc', { states: ['CO', 'NY', 'FL'] })
 *
 * // Search by officer/agent name (CO only)
 * const result = await searchByOfficer('Tim Cook', { limit: 25 })
 * ```
 */

// Core configuration and types
export * from "./config"
export * from "./stealth-browser"

// NEW: API-first business search (recommended)
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

// Scraper engines
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
  // Browser Scraper (Tier 3)
  scrapeBrowserState,
  scrapeDetailPageBrowser,
  scrapeDetailPages,
  // Detail Page Scraper
  scrapeDetailPage,
  mergeEntityDetails,
  enrichEntitiesWithDetails,
  type EntityDetails,
  type ExtractedOfficer,
  // Unified Scraper (Routes to appropriate engine)
  scrapeState,
  searchMultipleStates,
  searchCompany,
  getScraperHealth,
  resetStateCircuitBreaker,
  getTierStatistics,
  type UnifiedScraperOptions,
  type MultiStateSearchOptions,
  type MultiStateSearchResult,
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

// State scrapers
export {
  scrapeFloridaBusinesses,
  scrapeFloridaByOfficer,
  scrapeNewYorkBusinesses,
  searchNewYorkOpenData,
  scrapeNewYorkWebsite,
  scrapeCaliforniaBusinesses,
  scrapeColoradoBusinesses,
  searchColoradoOpenData,
} from "./scrapers/states"

import {
  type ScrapedBusinessEntity,
  type ScrapedOfficer,
  type ScraperResult,
  type ScraperSource,
  isScrapingEnabled,
} from "./config"
import {
  scrapeFloridaBusinesses,
  scrapeFloridaByOfficer,
  scrapeNewYorkBusinesses,
  scrapeCaliforniaBusinesses,
  scrapeColoradoBusinesses,
} from "./scrapers/states"

/**
 * Unified business registry search across multiple sources
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
  results: Map<ScraperSource, ScraperResult<ScrapedBusinessEntity | ScrapedOfficer>>
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

  if (!isScrapingEnabled()) {
    console.warn("[Scraper] Web scraping is disabled in production. Set ENABLE_WEB_SCRAPING=true to enable.")
  }

  const results = new Map<ScraperSource, ScraperResult<ScrapedBusinessEntity | ScrapedOfficer>>()
  const successful: ScraperSource[] = []
  const failed: ScraperSource[] = []
  let totalFound = 0

  // Define scraper functions for each source
  const scraperFunctions: Record<ScraperSource, () => Promise<ScraperResult<ScrapedBusinessEntity | ScrapedOfficer>>> = {
    florida: async () => {
      if (searchType === "officer") {
        return scrapeFloridaByOfficer(query, { limit })
      }
      return scrapeFloridaBusinesses(query, { limit })
    },
    newYork: async () => {
      // NY doesn't have officer search via Open Data
      return scrapeNewYorkBusinesses(query, { limit })
    },
    california: async () => {
      return scrapeCaliforniaBusinesses(query, { limit })
    },
    colorado: async () => {
      return scrapeColoradoBusinesses(query, { limit })
    },
    texas: async () => {
      // Texas requires account and $1 per search - not implemented
      return {
        success: false,
        data: [],
        totalFound: 0,
        source: "texas" as const,
        query,
        scrapedAt: new Date().toISOString(),
        duration: 0,
        error: "Texas SOSDirect requires paid account ($1/search). Use phone search (free): 512-463-5555",
      }
    },
  }

  // Run scrapers
  if (parallel) {
    const promises = sources.map(async (source) => {
      try {
        const result = await scraperFunctions[source]()
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
          } as ScraperResult<ScrapedBusinessEntity | ScrapedOfficer>,
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
    for (const source of sources) {
      try {
        const result = await scraperFunctions[source]()
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
