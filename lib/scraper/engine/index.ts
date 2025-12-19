/**
 * Scraper Engine Index
 *
 * Exports all scraper engines:
 * - API Scraper (Tier 1): States with FREE API/Open Data
 * - HTTP Scraper (Tier 2): States with simple HTML (no JS required)
 * - Browser Scraper (Tier 3): States requiring JavaScript rendering
 * - Detail Page Scraper: Extracts FULL officer lists from entity pages
 */

// API Scraper (Tier 1)
export {
  searchSocrataApi,
  searchRestApi,
  fetchSocrataApi,
  fetchRestApi,
  buildSocrataFilter,
  mapSocrataToEntity,
  type SocrataFieldMapping,
} from "./api-scraper"

// HTTP Scraper (Tier 2)
export {
  scrapeHttpState,
  fetchHtml,
  parseHtmlResults,
  buildFormData,
  decodeHtmlEntities,
  extractWithSelector,
  extractRows,
  type HtmlParseConfig,
} from "./http-scraper"

// Browser Scraper (Tier 3)
export {
  scrapeBrowserState,
  scrapeDetailPage as scrapeDetailPageBrowser,
  scrapeDetailPages,
} from "./browser-scraper"

// Detail Page Scraper (Full officer extraction)
export {
  scrapeDetailPage,
  mergeEntityDetails,
  enrichEntitiesWithDetails,
  type EntityDetails,
  type ExtractedOfficer,
} from "./detail-page-scraper"

// Unified Scraper (Routes to appropriate engine)
export {
  scrapeState,
  searchMultipleStates,
  searchCompany,
  getScraperHealth,
  resetStateCircuitBreaker,
  getTierStatistics,
  type UnifiedScraperOptions,
  type MultiStateSearchOptions,
  type MultiStateSearchResult,
} from "./unified-scraper"
