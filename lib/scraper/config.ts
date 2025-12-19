/**
 * Business Registry Scraper Configuration
 *
 * Provides stealth web scraping for business registry data when API access
 * is unavailable or too expensive.
 *
 * Supported sources:
 * - US State Secretary of State registries:
 *   - Delaware (icis.corp.delaware.gov) - Note: Has CAPTCHA
 *   - New York (apps.dos.ny.gov) - Open data available
 *   - California (bizfileonline.sos.ca.gov)
 *   - Florida (search.sunbiz.org) - Most scrape-friendly
 *   - Colorado (sos.state.co.us) - Open data available
 *
 * Uses playwright-extra with puppeteer-extra-plugin-stealth for bot detection bypass
 */

/**
 * Scraper configuration defaults
 */
export const SCRAPER_CONFIG = {
  // Timeouts
  pageTimeout: 30000, // 30 seconds
  navigationTimeout: 30000,
  elementTimeout: 10000,

  // Delays (to appear human-like)
  minDelay: 1000, // 1 second minimum between requests
  maxDelay: 3000, // 3 seconds maximum
  typingDelay: 50, // ms between keystrokes

  // Retry configuration
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds between retries

  // Browser options
  headless: true, // Set to false for debugging
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",

  // Rate limiting
  requestsPerMinute: 10, // Max requests per minute to any single domain
} as const

/**
 * State registry URLs and selectors
 */
export const STATE_REGISTRY_CONFIG = {
  delaware: {
    name: "Delaware Division of Corporations",
    baseUrl: "https://icis.corp.delaware.gov",
    searchUrl: "https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx",
    hasCaptcha: true,
    selectors: {
      // ASP.NET naming convention - verified 2025-01
      searchInput: "#ctl00_ContentPlaceHolder1_frmEntityName",
      fileNumberInput: "#ctl00_ContentPlaceHolder1_frmFileNumber",
      searchButton: "#ctl00_ContentPlaceHolder1_btnSubmit",
      resultsTable: "#ctl00_ContentPlaceHolder1_pnlResults table, table[id*='Results'], .results-table",
      resultRows: "#ctl00_ContentPlaceHolder1_pnlResults table tr, table[id*='Results'] tr",
      entityName: "td:first-child a, td a",
      fileNumber: "td:nth-child(2)",
      status: "td:nth-child(7), td:last-child",
      incorporationDate: "td:nth-child(3)",
      entityType: "td:nth-child(5)",
    },
  },
  newYork: {
    name: "New York Department of State",
    baseUrl: "https://apps.dos.ny.gov",
    searchUrl: "https://apps.dos.ny.gov/publicInquiry/",
    hasCaptcha: false,
    selectors: {
      searchInput: "#search_text",
      searchButton: "#btnSearch",
      resultsTable: ".results-table",
      resultRows: ".results-table tbody tr",
      entityName: "td:nth-child(1)",
      dosId: "td:nth-child(2)",
      status: "td:nth-child(3)",
      jurisdiction: "td:nth-child(4)",
    },
    // NY also has open data at data.ny.gov
    openDataUrl: "https://data.ny.gov/resource/7tqb-y2d4.json",
  },
  california: {
    name: "California Secretary of State",
    baseUrl: "https://bizfileonline.sos.ca.gov",
    searchUrl: "https://bizfileonline.sos.ca.gov/search/business",
    hasCaptcha: false, // May have rate limiting
    selectors: {
      searchInput: 'input[name="searchValue"]',
      searchButton: 'button[type="submit"]',
      resultsContainer: ".search-results",
      resultRows: ".search-result-item",
      entityName: ".entity-name",
      entityNumber: ".entity-number",
      status: ".entity-status",
      formationDate: ".formation-date",
    },
  },
  florida: {
    name: "Florida Division of Corporations (Sunbiz)",
    baseUrl: "https://search.sunbiz.org",
    searchUrl: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName",
    hasCaptcha: false,
    selectors: {
      searchInput: "#SearchTerm",
      searchButton: 'input[type="submit"]',
      resultsTable: "#search-results",
      resultRows: "#search-results tbody tr",
      entityName: "td:nth-child(1) a",
      documentNumber: "td:nth-child(2)",
      status: "td:nth-child(3)",
      filingDate: "td:nth-child(4)",
    },
    // Alternative: search by officer
    officerSearchUrl: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByOfficerOrRegisteredAgent",
  },
  colorado: {
    name: "Colorado Secretary of State",
    baseUrl: "https://www.sos.state.co.us",
    searchUrl: "https://www.sos.state.co.us/biz/BusinessEntitySearch.do",
    hasCaptcha: false,
    // Colorado has FREE Open Data API (Socrata) - use this instead of web scraping!
    openDataUrl: "https://data.colorado.gov/resource/4ykn-tg5h.json",
    tier: 1, // API available, no scraping needed
    selectors: {
      // Web scraping selectors (fallback only)
      searchInput: "#searchField",
      searchButton: 'input[type="submit"]',
      resultsTable: "#resultsTable",
      resultRows: "#resultsTable tbody tr",
      entityName: "td:nth-child(1) a",
      entityNumber: "td:nth-child(2)",
      status: "td:nth-child(3)",
      entityType: "td:nth-child(4)",
      formationDate: "td:nth-child(5)",
    },
  },
  texas: {
    name: "Texas Secretary of State (SOSDirect)",
    baseUrl: "https://www.sos.state.tx.us",
    searchUrl: "https://www.sos.state.tx.us/corp/sosda/index.shtml",
    hasCaptcha: false,
    requiresAccount: true, // $1 per search fee
    feePerSearch: 1.0,
    notes: "Requires SOSDirect account. Consider phone search (free) at 512-463-5555",
  },
} as const

/**
 * Supported scraper sources
 */
export type ScraperSource = "delaware" | "newYork" | "california" | "florida" | "texas" | "colorado"

/**
 * Business entity result from any scraper
 */
export interface ScrapedBusinessEntity {
  name: string
  entityNumber: string | null
  jurisdiction: string
  status: string | null
  incorporationDate: string | null
  entityType: string | null
  registeredAddress: string | null
  registeredAgent: string | null
  officers?: Array<{
    name: string
    position: string
    startDate?: string | null
    endDate?: string | null
  }>
  sourceUrl: string
  source: ScraperSource
  scrapedAt: string
}

/**
 * Officer/director result from any scraper
 */
export interface ScrapedOfficer {
  name: string
  position: string
  companyName: string
  companyNumber: string | null
  jurisdiction: string
  startDate: string | null
  endDate: string | null
  current: boolean
  sourceUrl: string
  source: ScraperSource
  scrapedAt: string
}

/**
 * Scraper result with metadata
 */
export interface ScraperResult<T> {
  success: boolean
  data: T[]
  totalFound: number
  source: ScraperSource
  query: string
  scrapedAt: string
  duration: number // ms
  error?: string
  warnings?: string[]
}

/**
 * Check if scraping is enabled
 * DEFAULT: ENABLED (can be disabled with ENABLE_WEB_SCRAPING=false)
 *
 * Web scraping is enabled by default as a fallback for when:
 * - State registry data is needed beyond what APIs provide
 * - DatabaseUSA or similar commercial sources are too expensive
 */
export function isScrapingEnabled(): boolean {
  // Can be explicitly disabled via env var
  if (process.env.ENABLE_WEB_SCRAPING === "false") return false

  // Default: ENABLED (scraping is on by default)
  return true
}

/**
 * Get random delay for human-like behavior
 */
export function getRandomDelay(): number {
  return Math.floor(
    Math.random() * (SCRAPER_CONFIG.maxDelay - SCRAPER_CONFIG.minDelay) + SCRAPER_CONFIG.minDelay
  )
}
