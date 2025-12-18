/**
 * Business Registry Scraper Module
 *
 * Provides stealth web scraping for business registry data when API access
 * is unavailable or too expensive.
 *
 * Supported sources:
 * - OpenCorporates (web scraper fallback)
 * - US State Secretary of State registries:
 *   - Florida (Sunbiz) - Most reliable
 *   - New York (DOS) - Has Open Data API
 *   - California (bizfile) - React SPA
 *   - Delaware (ICIS) - Has CAPTCHA
 *
 * Usage:
 * ```typescript
 * import { scrapeBusinessRegistry } from '@/lib/scraper'
 *
 * // Search across all sources
 * const results = await scrapeBusinessRegistry('Apple Inc', {
 *   sources: ['opencorporates', 'delaware', 'california'],
 *   limit: 20
 * })
 * ```
 */

export * from "./config"
export * from "./stealth-browser"

// OpenCorporates scraper
export {
  scrapeOpenCorporatesCompanies,
  scrapeOpenCorporatesOfficers,
  scrapeOpenCorporatesCompanyDetails,
} from "./scrapers/opencorporates"

// State scrapers
export {
  scrapeFloridaBusinesses,
  scrapeFloridaByOfficer,
  scrapeNewYorkBusinesses,
  searchNewYorkOpenData,
  scrapeNewYorkWebsite,
  scrapeCaliforniaBusinesses,
  scrapeDelawareBusinesses,
  getDelawareManualSearchInfo,
} from "./scrapers/states"

import {
  type ScrapedBusinessEntity,
  type ScrapedOfficer,
  type ScraperResult,
  type ScraperSource,
  isScrapingEnabled,
} from "./config"
import { scrapeOpenCorporatesCompanies, scrapeOpenCorporatesOfficers } from "./scrapers/opencorporates"
import {
  scrapeFloridaBusinesses,
  scrapeFloridaByOfficer,
  scrapeNewYorkBusinesses,
  scrapeCaliforniaBusinesses,
  scrapeDelawareBusinesses,
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
    sources = ["opencorporates", "florida", "newYork"],
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
    opencorporates: async () => {
      if (searchType === "officer") {
        return scrapeOpenCorporatesOfficers(query, { limit })
      }
      return scrapeOpenCorporatesCompanies(query, { limit })
    },
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
    delaware: async () => {
      return scrapeDelawareBusinesses(query, { limit })
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
