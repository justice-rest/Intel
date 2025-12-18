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
 * Note: California also offers bulk data for $100 (Master Unload files)
 */

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
  closePage,
  isPlaywrightAvailable,
} from "../../stealth-browser"

const CONFIG = STATE_REGISTRY_CONFIG.california

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

  // Check if Playwright is available
  if (!(await isPlaywrightAvailable())) {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "california",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: "Playwright not installed. Run: npm install playwright-extra puppeteer-extra-plugin-stealth playwright",
    }
  }

  const browser = await getStealthBrowser()
  const { page, context } = await createStealthPage(browser)

  try {
    // Navigate to search page
    await withRetry(async () => {
      await page.goto(CONFIG.searchUrl, { waitUntil: "networkidle" })
    })

    await humanDelay()

    // California's search page is a React SPA, need to wait for it to load
    await page.waitForSelector('input[type="text"]', { timeout: 10000 })
    await humanDelay()

    // Find and fill the search input
    const searchInput = await page.$('input[type="text"]')
    if (searchInput) {
      await searchInput.click()
      await page.keyboard.type(query, { delay: 50 })
    }

    await humanDelay()

    // Submit search (press Enter or click search button)
    await page.keyboard.press("Enter")

    // Wait for results to load
    await page.waitForSelector(".search-results, .no-results, .entity-name", { timeout: 20000 }).catch(() => null)
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
        name = nameEl ? await nameEl.textContent() : null

        // Try entity-number
        const numberEl = await item.$(".entity-number, td:nth-child(2), [class*='number']")
        entityNumber = numberEl ? await numberEl.textContent() : null

        // Try status
        const statusEl = await item.$(".entity-status, td:nth-child(3), [class*='status']")
        status = statusEl ? await statusEl.textContent() : null

        // Try formation date
        const dateEl = await item.$(".formation-date, td:nth-child(4), [class*='date']")
        formationDate = dateEl ? await dateEl.textContent() : null

        // Try entity type
        const typeEl = await item.$(".entity-type, td:nth-child(5), [class*='type']")
        entityType = typeEl ? await typeEl.textContent() : null

        // Get link to details
        const linkEl = await item.$("a[href*='business']")
        const href = linkEl ? await linkEl.getAttribute("href") : null

        if (!name || !name.trim()) continue

        businesses.push({
          name: name.trim(),
          entityNumber: entityNumber?.trim().replace(/[^\w-]/g, "") || null,
          jurisdiction: "us_ca",
          status: status?.trim() || null,
          incorporationDate: formationDate?.trim() || null,
          entityType: entityType?.trim() || null,
          registeredAddress: null,
          registeredAgent: null,
          sourceUrl: href ? `${CONFIG.baseUrl}${href}` : CONFIG.searchUrl,
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
    await closePage(context)
  }
}
