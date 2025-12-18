/**
 * Florida Division of Corporations (Sunbiz) Scraper
 *
 * Scrapes business entity data from search.sunbiz.org
 * This is one of the most scrape-friendly state registries.
 *
 * Features:
 * - HTTP fallback (faster, no browser needed)
 * - Search by entity name
 * - Search by officer/registered agent name
 * - No CAPTCHA (as of 2025)
 * - Free access
 *
 * URL Patterns:
 * - Search results: https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults/EntityName/{query}/Page1?searchNameOrder={QUERY}
 * - By officer: https://search.sunbiz.org/Inquiry/CorporationSearch/ByOfficerOrRegisteredAgent
 * - Entity details: https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResultDetail?inquirytype=EntityName&...
 */

import {
  STATE_REGISTRY_CONFIG,
  type ScrapedBusinessEntity,
  type ScrapedOfficer,
  type ScraperResult,
} from "../../config"
import {
  getStealthBrowser,
  createStealthPage,
  humanType,
  humanDelay,
  withRetry,
  closePage,
  isPlaywrightAvailable,
} from "../../stealth-browser"

const CONFIG = STATE_REGISTRY_CONFIG.florida

// Browser-like headers for HTTP requests
const HTTP_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
}

/**
 * Parse Florida search results from HTML using regex
 */
function parseFloridaResultsFromHtml(html: string): Partial<ScrapedBusinessEntity>[] {
  const results: Partial<ScrapedBusinessEntity>[] = []

  // Pattern to match table rows with company links
  // <td class="large-width"><a href="...">COMPANY NAME</a></td>
  // <td class="medium-width">DOC_NUMBER</td>
  // <td class="small-width">STATUS</td>
  const rowPattern = /<td class="large-width"><a href="([^"]+)"[^>]*>([^<]+)<\/a><\/td>\s*<td class="medium-width">([^<]+)<\/td>\s*<td class="small-width">([^<]+)<\/td>/gi

  let match
  while ((match = rowPattern.exec(html)) !== null) {
    const [, href, name, docNumber, status] = match

    results.push({
      name: decodeHtmlEntities(name.trim()),
      entityNumber: docNumber?.trim() || null,
      jurisdiction: "us_fl",
      status: normalizeStatus(status?.trim()),
      incorporationDate: null,
      entityType: null,
      registeredAddress: null,
      registeredAgent: null,
      sourceUrl: `https://search.sunbiz.org${href}`,
      source: "florida",
      scrapedAt: new Date().toISOString(),
    })
  }

  return results
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
}

/**
 * Normalize status text
 */
function normalizeStatus(status: string | null): string | null {
  if (!status) return null
  const s = status.toUpperCase()

  if (s === "ACTIVE" || s === "ACT") return "Active"
  if (s === "INACT" || s === "INACTIVE") return "Inactive"
  if (s === "ADMIN DISS" || s === "ADMIN") return "Administratively Dissolved"
  if (s === "NAME HS" || s === "NAME") return "Name History"
  if (s === "CROSS RF" || s === "CROSS") return "Cross Reference"
  if (s.includes("DISS")) return "Dissolved"

  return status
}

/**
 * Search Florida businesses via HTTP (fast, no browser needed)
 */
export async function searchFloridaHttp(
  query: string,
  options: { limit?: number } = {}
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const { limit = 25 } = options

  console.log("[Florida Scraper] HTTP search:", query)

  try {
    // Build search URL - Sunbiz uses a specific URL pattern for search results
    // searchNameOrder needs to be the query without spaces in uppercase
    const searchNameOrder = query.toUpperCase().replace(/[^A-Z0-9]/g, "")
    const searchUrl = `https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults/EntityName/${encodeURIComponent(query)}/Page1?searchNameOrder=${searchNameOrder}`

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: HTTP_HEADERS,
      redirect: "follow",
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()

    // Check for blocking
    if (html.toLowerCase().includes("captcha") || html.toLowerCase().includes("challenge")) {
      throw new Error("CAPTCHA detected, falling back to browser")
    }

    // Parse results
    const businesses = parseFloridaResultsFromHtml(html)
    console.log(`[Florida Scraper] HTTP found ${businesses.length} results`)

    // Apply limit
    const limitedResults = businesses.slice(0, limit)

    return {
      success: true,
      data: limitedResults as ScrapedBusinessEntity[],
      totalFound: businesses.length,
      source: "florida",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.log(`[Florida Scraper] HTTP failed: ${errorMessage}`)

    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "florida",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: errorMessage,
    }
  }
}

/**
 * Search Florida businesses by name
 * Strategy: Try HTTP first, then fallback to browser if needed
 */
export async function scrapeFloridaBusinesses(
  query: string,
  options: {
    searchType?: "name" | "officer"
    limit?: number
  } = {}
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const { searchType = "name", limit = 25 } = options

  console.log(`[Florida Scraper] Searching ${searchType}:`, query)

  // STRATEGY 1: Try HTTP first for entity name search (fast, no browser needed)
  if (searchType === "name") {
    const httpResult = await searchFloridaHttp(query, { limit })
    if (httpResult.success && httpResult.data.length > 0) {
      console.log(`[Florida Scraper] HTTP succeeded with ${httpResult.data.length} results`)
      return httpResult
    }
    console.log("[Florida Scraper] HTTP failed or no results, trying browser...")
  }

  // STRATEGY 2: Browser fallback
  if (!(await isPlaywrightAvailable())) {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "florida",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: "HTTP fetch failed and Playwright not installed",
      warnings: ["Install Playwright for browser fallback: npm install playwright-extra puppeteer-extra-plugin-stealth playwright"],
    }
  }

  const browser = await getStealthBrowser()
  const { page, context } = await createStealthPage(browser)

  try {
    const searchUrl = searchType === "officer" ? CONFIG.officerSearchUrl : CONFIG.searchUrl

    // Navigate to search page
    await withRetry(async () => {
      await page.goto(searchUrl, { waitUntil: "networkidle" })
    })

    await humanDelay()

    // Fill in search form
    await humanType(page, CONFIG.selectors.searchInput, query)
    await humanDelay()

    // Submit search
    await page.click(CONFIG.selectors.searchButton)

    // Wait for results
    await page.waitForSelector(CONFIG.selectors.resultsTable, { timeout: 15000 }).catch(() => null)
    await humanDelay()

    // Parse results
    const resultRows = await page.$$(CONFIG.selectors.resultRows)
    console.log(`[Florida Scraper] Found ${resultRows.length} results`)

    const businesses: ScrapedBusinessEntity[] = []

    for (const row of resultRows.slice(0, limit)) {
      try {
        // Get name and link
        const nameEl = await row.$(CONFIG.selectors.entityName)
        const name = nameEl ? await nameEl.textContent() : null
        const href = nameEl ? await nameEl.getAttribute("href") : null

        if (!name) continue

        // Get document number
        const docNumEl = await row.$(CONFIG.selectors.documentNumber)
        const documentNumber = docNumEl ? await docNumEl.textContent() : null

        // Get status
        const statusEl = await row.$(CONFIG.selectors.status)
        const status = statusEl ? await statusEl.textContent() : null

        // Get filing date
        const dateEl = await row.$(CONFIG.selectors.filingDate)
        const filingDate = dateEl ? await dateEl.textContent() : null

        businesses.push({
          name: name.trim(),
          entityNumber: documentNumber?.trim() || null,
          jurisdiction: "us_fl",
          status: status?.trim() || null,
          incorporationDate: filingDate?.trim() || null,
          entityType: null, // Would need to fetch details page
          registeredAddress: null,
          registeredAgent: null,
          sourceUrl: href ? `${CONFIG.baseUrl}${href}` : CONFIG.searchUrl,
          source: "florida",
          scrapedAt: new Date().toISOString(),
        })
      } catch (error) {
        console.warn("[Florida Scraper] Failed to parse row:", error)
      }
    }

    return {
      success: true,
      data: businesses,
      totalFound: resultRows.length,
      source: "florida",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[Florida Scraper] Error:", errorMessage)

    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "florida",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: errorMessage,
    }
  } finally {
    await closePage(context)
  }
}

/**
 * Search Florida businesses by officer/registered agent name
 */
export async function scrapeFloridaByOfficer(
  officerName: string,
  options: { limit?: number } = {}
): Promise<ScraperResult<ScrapedOfficer>> {
  const startTime = Date.now()
  const { limit = 30 } = options

  console.log("[Florida Scraper] Searching by officer:", officerName)

  // Check if Playwright is available
  if (!(await isPlaywrightAvailable())) {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "florida",
      query: officerName,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: "Playwright not installed",
    }
  }

  const browser = await getStealthBrowser()
  const { page, context } = await createStealthPage(browser)

  try {
    // Navigate to officer search page
    await withRetry(async () => {
      await page.goto(CONFIG.officerSearchUrl!, { waitUntil: "networkidle" })
    })

    await humanDelay()

    // Fill in search form - Sunbiz expects "Last Name, First Name" format
    const searchInput = await page.$("#SearchTerm")
    if (searchInput) {
      await humanType(page, "#SearchTerm", officerName)
    }

    await humanDelay()

    // Submit search
    await page.click('input[type="submit"]')

    // Wait for results
    await page.waitForSelector("#search-results", { timeout: 15000 }).catch(() => null)
    await humanDelay()

    // Parse results
    const resultRows = await page.$$("#search-results tbody tr")
    console.log(`[Florida Scraper] Found ${resultRows.length} officer results`)

    const officers: ScrapedOfficer[] = []

    for (const row of resultRows.slice(0, limit)) {
      try {
        // Each row contains: Entity Name, Doc Number, Status
        const cells = await row.$$("td")
        if (cells.length < 3) continue

        const nameEl = await cells[0].$("a")
        const companyName = nameEl ? await nameEl.textContent() : null
        const href = nameEl ? await nameEl.getAttribute("href") : null

        if (!companyName) continue

        const docNumber = await cells[1].textContent()
        const status = await cells[2].textContent()

        officers.push({
          name: officerName, // The searched name
          position: "Officer/Registered Agent", // Sunbiz doesn't distinguish in search results
          companyName: companyName.trim(),
          companyNumber: docNumber?.trim() || null,
          jurisdiction: "us_fl",
          startDate: null,
          endDate: null,
          current: status?.toLowerCase().includes("active") ?? true,
          sourceUrl: href ? `${CONFIG.baseUrl}${href}` : CONFIG.officerSearchUrl!,
          source: "florida",
          scrapedAt: new Date().toISOString(),
        })
      } catch (error) {
        console.warn("[Florida Scraper] Failed to parse officer row:", error)
      }
    }

    return {
      success: true,
      data: officers,
      totalFound: resultRows.length,
      source: "florida",
      query: officerName,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[Florida Scraper] Officer search error:", errorMessage)

    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "florida",
      query: officerName,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: errorMessage,
    }
  } finally {
    await closePage(context)
  }
}
