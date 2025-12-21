/**
 * Scraper Engine Index (Serverless-Compatible)
 *
 * Exports only serverless-compatible scraper engines:
 * - API Scraper (Tier 1): States with FREE API/Open Data (CO, NY)
 * - HTTP Scraper (Tier 2): States with simple HTML (FL - no JS required)
 *
 * NOTE: Browser scraper (Tier 3) has been removed for serverless compatibility.
 * Playwright/Puppeteer is not available in serverless environments.
 */

// API Scraper (Tier 1) - Serverless compatible
export {
  searchSocrataApi,
  searchRestApi,
  fetchSocrataApi,
  fetchRestApi,
  buildSocrataFilter,
  mapSocrataToEntity,
  type SocrataFieldMapping,
} from "./api-scraper"

// HTTP Scraper (Tier 2) - Serverless compatible
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
