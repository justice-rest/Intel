/**
 * California Secretary of State Business Entity Scraper
 *
 * Scrapes business entity data from bizfileonline.sos.ca.gov
 *
 * Features:
 * - Search by entity name
 * - Search by entity number
 * - No CAPTCHA (but may have rate limiting)
 * - Free search access
 *
 * URL Patterns:
 * - Search: https://bizfileonline.sos.ca.gov/search/business
 * - Entity details: https://bizfileonline.sos.ca.gov/search/business/XXX
 *
 * Note: California's site is a React SPA, so HTTP fallback has limited effectiveness.
 * Browser-based scraping (Playwright) is the primary method.
 *
 * Bulk data: California offers bulk data for $100 (Master Unload files)
 */

import type { Page, ElementHandle } from "puppeteer-core"
import {
  STATE_REGISTRY_CONFIG,
  type ScrapedBusinessEntity,
  type ScraperResult,
} from "../../config"
import {
  getStealthBrowser,
  createStealthPage,
  humanType,
  humanDelay,
  withRetry,
  isPuppeteerAvailable,
  waitForNetworkIdle,
} from "../../stealth-browser"

/**
 * Helper to get text content from element (Puppeteer API)
 */
async function getElementText(page: Page, element: ElementHandle): Promise<string | null> {
  try {
    const text = await page.evaluate((el) => el.textContent, element)
    return text?.trim() || null
  } catch {
    return null
  }
}

/**
 * Helper to get attribute from element (Puppeteer API)
 */
async function getElementAttribute(page: Page, element: ElementHandle, attr: string): Promise<string | null> {
  try {
    const value = await page.evaluate((el, a) => el.getAttribute(a), element, attr)
    return value || null
  } catch {
    return null
  }
}

const CONFIG = STATE_REGISTRY_CONFIG.california

// Timeout constants for CA React SPA (needs more time)
const CA_PAGE_LOAD_TIMEOUT = 30000 // 30s for SPA to load
const CA_RESULTS_TIMEOUT = 25000 // 25s to wait for results

/**
 * Resolve a URL properly (handles both absolute and relative URLs)
 */
function resolveUrl(href: string | null, baseUrl: string): string {
  if (!href) return baseUrl
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href // Already absolute
  }
  // Use URL API for proper resolution
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    // Fallback to simple concatenation if URL parsing fails
    return href.startsWith("/") ? `${baseUrl}${href}` : `${baseUrl}/${href}`
  }
}

/**
 * Normalize California status values
 */
function normalizeStatus(status: string | null): string | null {
  if (!status) return null
  const s = status.trim().toUpperCase()

  if (s === "ACTIVE" || s.includes("ACTIVE")) return "Active"
  if (s === "SUSPENDED" || s.includes("SUSPEND")) return "Suspended"
  if (s === "DISSOLVED" || s.includes("DISSOLV")) return "Dissolved"
  if (s === "FORFEITED" || s.includes("FORFEIT")) return "Forfeited"
  if (s === "CANCELLED" || s === "CANCELED" || s.includes("CANCEL")) return "Cancelled"
  if (s === "CONVERTED" || s.includes("CONVERT")) return "Converted"
  if (s === "MERGED" || s.includes("MERGE")) return "Merged"

  return status.trim()
}

/**
 * Search California businesses by name or entity number
 */
export async function scrapeCaliforniaBusinesses(
  query: string,
  options: {
    searchType?: "name" | "number"
    limit?: number
  } = {}
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const { searchType = "name", limit = 25 } = options

  console.log(`[California Scraper] Searching ${searchType}:`, query)

  // Check if Puppeteer is available
  if (!(await isPuppeteerAvailable())) {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "california",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: "Puppeteer not installed. Run: npm install puppeteer-core @sparticuz/chromium",
    }
  }

  const browser = await getStealthBrowser()
  const { page, cleanup } = await createStealthPage(browser)

  try {
    // Navigate to search page
    await withRetry(async () => {
      await page.goto(CONFIG.searchUrl, { waitUntil: "networkidle2" })
    })

    await humanDelay()

    // California's search page is a React SPA, need to wait for it to load
    // Try multiple selectors for the search input
    const searchInputSelectors = [
      'input[type="text"]',
      'input[name="searchInput"]',
      'input[placeholder*="search" i]',
      'input[placeholder*="business" i]',
      '#searchInput',
      '.search-input input',
    ]

    let searchInput = null
    for (const selector of searchInputSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 })
        searchInput = await page.$(selector)
        if (searchInput) {
          console.log(`[California Scraper] Found search input with selector: ${selector}`)
          break
        }
      } catch {
        // Try next selector
      }
    }

    if (!searchInput) {
      // Try one more time with longer timeout for any text input
      await page.waitForSelector('input[type="text"]', { timeout: CA_PAGE_LOAD_TIMEOUT })
      searchInput = await page.$('input[type="text"]')
    }

    await humanDelay()

    // Fill the search input
    if (searchInput) {
      await searchInput.click()
      await page.keyboard.type(query, { delay: 50 })
    } else {
      throw new Error("Could not find search input on California SOS website")
    }

    await humanDelay()

    // Submit search (press Enter or click search button)
    await page.keyboard.press("Enter")

    // Wait for results to load with multiple possible selectors
    const resultsSelectors = [
      ".search-results",
      ".no-results",
      ".entity-name",
      "[class*='result']",
      "table tbody tr",
      ".list-group-item",
    ]

    await page.waitForSelector(resultsSelectors.join(", "), { timeout: CA_RESULTS_TIMEOUT }).catch(() => null)

    // Extra wait for React to finish rendering
    await waitForNetworkIdle(page, { timeout: 5000 })
    await humanDelay()

    // Check for no results
    const noResults = await page.$(".no-results")
    if (noResults) {
      return {
        success: true,
        data: [],
        totalFound: 0,
        source: "california",
        query,
        scrapedAt: new Date().toISOString(),
        duration: Date.now() - startTime,
      }
    }

    // Parse results - California uses a dynamic list
    const resultItems = await page.$$(".search-result-item, [class*='result'], table tbody tr")
    console.log(`[California Scraper] Found ${resultItems.length} results`)

    const businesses: ScrapedBusinessEntity[] = []

    for (const item of resultItems.slice(0, limit)) {
      try {
        // Try multiple selectors since CA's site structure may vary
        let name: string | null = null
        let entityNumber: string | null = null
        let status: string | null = null
        let formationDate: string | null = null
        let entityType: string | null = null

        // Try entity-name class
        const nameEl = await item.$(".entity-name, td:first-child a, a[href*='business']")
        name = nameEl ? await getElementText(page, nameEl) : null

        // Try entity-number
        const numberEl = await item.$(".entity-number, td:nth-child(2), [class*='number']")
        entityNumber = numberEl ? await getElementText(page, numberEl) : null

        // Try status
        const statusEl = await item.$(".entity-status, td:nth-child(3), [class*='status']")
        status = statusEl ? await getElementText(page, statusEl) : null

        // Try formation date
        const dateEl = await item.$(".formation-date, td:nth-child(4), [class*='date']")
        formationDate = dateEl ? await getElementText(page, dateEl) : null

        // Try entity type
        const typeEl = await item.$(".entity-type, td:nth-child(5), [class*='type']")
        entityType = typeEl ? await getElementText(page, typeEl) : null

        // Get link to details
        const linkEl = await item.$("a[href*='business']")
        const href = linkEl ? await getElementAttribute(page, linkEl, "href") : null

        if (!name || !name.trim()) continue

        // Clean and validate entity number
        const cleanEntityNumber = entityNumber?.trim().replace(/[^\w-]/g, "") || null

        // Normalize the status
        const normalizedStatus = normalizeStatus(status)

        // Properly resolve the URL
        const sourceUrl = resolveUrl(href, CONFIG.baseUrl)

        businesses.push({
          name: name.trim(),
          entityNumber: cleanEntityNumber,
          jurisdiction: "us_ca",
          status: normalizedStatus,
          incorporationDate: formationDate?.trim() || null,
          entityType: entityType?.trim() || null,
          registeredAddress: null,
          registeredAgent: null,
          sourceUrl,
          source: "california",
          scrapedAt: new Date().toISOString(),
        })
      } catch (error) {
        console.warn("[California Scraper] Failed to parse result:", error)
      }
    }

    return {
      success: true,
      data: businesses,
      totalFound: resultItems.length,
      source: "california",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[California Scraper] Error:", errorMessage)

    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "california",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: errorMessage,
      warnings: ["California's bizfile website is a React SPA and may require additional handling"],
    }
  } finally {
    await cleanup()
  }
}
