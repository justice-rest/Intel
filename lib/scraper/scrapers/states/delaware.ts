/**
 * Delaware Division of Corporations (ICIS) Scraper
 *
 * Scrapes business entity data from icis.corp.delaware.gov
 *
 * IMPORTANT: Delaware has CAPTCHA protection which makes automated scraping
 * very difficult. This scraper will work for basic searches but may fail
 * if CAPTCHA is triggered.
 *
 * Features:
 * - Search by entity name
 * - Search by file number
 * - Free search (basic info only)
 * - $10 for status, $20 for detailed info
 *
 * Delaware is the most important jurisdiction for corporate searches as it
 * hosts 65% of Fortune 500 companies and 1.1 million+ entities.
 *
 * URL Patterns:
 * - Search: https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx
 * - Entity: https://icis.corp.delaware.gov/Ecorp/EntitySearch/Status.aspx?i=XXX
 *
 * Alternative: For high-volume needs, consider OpenCorporates API or
 * applying for Delaware's bulk data access.
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

const CONFIG = STATE_REGISTRY_CONFIG.delaware

/**
 * Search Delaware businesses by name
 *
 * NOTE: Delaware has CAPTCHA protection. This scraper may fail if CAPTCHA
 * is triggered. Consider using OpenCorporates API for reliable Delaware data.
 */
export async function scrapeDelawareBusinesses(
  query: string,
  options: {
    searchType?: "name" | "fileNumber"
    limit?: number
  } = {}
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const { searchType = "name", limit = 25 } = options

  console.log(`[Delaware Scraper] Searching ${searchType}:`, query)
  console.warn("[Delaware Scraper] Note: Delaware has CAPTCHA protection that may block automated searches")

  // Check if Playwright is available
  if (!(await isPlaywrightAvailable())) {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "delaware",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: "Playwright not installed",
      warnings: [
        "Delaware has CAPTCHA protection - consider using OpenCorporates API instead",
        "For bulk data, contact Delaware Division of Corporations",
      ],
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

    // Check for CAPTCHA
    const captchaPresent = await page.$("[class*='captcha'], [id*='captcha'], iframe[src*='captcha']")
    if (captchaPresent) {
      console.error("[Delaware Scraper] CAPTCHA detected - cannot proceed with automated search")
      return {
        success: false,
        data: [],
        totalFound: 0,
        source: "delaware",
        query,
        scrapedAt: new Date().toISOString(),
        duration: Date.now() - startTime,
        error: "CAPTCHA detected - Delaware requires human verification",
        warnings: [
          "Delaware Division of Corporations uses CAPTCHA protection",
          "Manual search available at: " + CONFIG.searchUrl,
          "Consider using OpenCorporates API for automated Delaware data access",
        ],
      }
    }

    // Fill in search form
    const searchInputSelector = searchType === "fileNumber" ? "#txtFileNumber" : CONFIG.selectors.searchInput
    await humanType(page, searchInputSelector, query)
    await humanDelay()

    // Submit search
    await page.click(CONFIG.selectors.searchButton)

    // Wait for results (may trigger CAPTCHA here)
    try {
      await page.waitForSelector(CONFIG.selectors.resultsTable, { timeout: 15000 })
    } catch {
      // Check again for CAPTCHA after search submission
      const captchaAfterSearch = await page.$("[class*='captcha'], [id*='captcha']")
      if (captchaAfterSearch) {
        return {
          success: false,
          data: [],
          totalFound: 0,
          source: "delaware",
          query,
          scrapedAt: new Date().toISOString(),
          duration: Date.now() - startTime,
          error: "CAPTCHA triggered after search - cannot proceed",
          warnings: ["Use manual search at: " + CONFIG.searchUrl],
        }
      }

      // No results found
      return {
        success: true,
        data: [],
        totalFound: 0,
        source: "delaware",
        query,
        scrapedAt: new Date().toISOString(),
        duration: Date.now() - startTime,
      }
    }

    await humanDelay()

    // Parse results
    const resultRows = await page.$$(CONFIG.selectors.resultRows)
    console.log(`[Delaware Scraper] Found ${resultRows.length} results`)

    const businesses: ScrapedBusinessEntity[] = []

    for (const row of resultRows.slice(0, limit)) {
      try {
        // Delaware's results table structure:
        // Entity Name | File Number | Incorporation Date | Kind | Type | State | Status
        const cells = await row.$$("td")
        if (cells.length < 5) continue

        const name = await cells[0].textContent()
        const fileNumber = await cells[1].textContent()
        const incDate = await cells[2].textContent()
        const kind = await cells[3].textContent()
        const entityType = await cells[4].textContent()
        const state = cells.length > 5 ? await cells[5].textContent() : null
        const status = cells.length > 6 ? await cells[6].textContent() : null

        // Get link to details
        const linkEl = await cells[0].$("a")
        const href = linkEl ? await linkEl.getAttribute("href") : null

        if (!name || !name.trim()) continue

        businesses.push({
          name: name.trim(),
          entityNumber: fileNumber?.trim() || null,
          jurisdiction: "us_de",
          status: status?.trim() || null,
          incorporationDate: incDate?.trim() || null,
          entityType: entityType?.trim() || kind?.trim() || null,
          registeredAddress: state ? `${state.trim()}` : null,
          registeredAgent: null,
          sourceUrl: href ? `${CONFIG.baseUrl}${href}` : CONFIG.searchUrl,
          source: "delaware",
          scrapedAt: new Date().toISOString(),
        })
      } catch (error) {
        console.warn("[Delaware Scraper] Failed to parse row:", error)
      }
    }

    return {
      success: true,
      data: businesses,
      totalFound: resultRows.length,
      source: "delaware",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      warnings: CONFIG.hasCaptcha
        ? ["Delaware may trigger CAPTCHA on subsequent requests - results may be incomplete"]
        : undefined,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[Delaware Scraper] Error:", errorMessage)

    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "delaware",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: errorMessage,
      warnings: [
        "Delaware Division of Corporations has CAPTCHA protection",
        "For automated access, consider OpenCorporates API",
        "Manual search: " + CONFIG.searchUrl,
      ],
    }
  } finally {
    await closePage(context)
  }
}

/**
 * Get manual search instructions for Delaware
 * (For when CAPTCHA blocks automated access)
 */
export function getDelawareManualSearchInfo(query: string): string {
  return [
    "# Delaware Division of Corporations - Manual Search Required",
    "",
    "Delaware uses CAPTCHA protection that blocks automated searches.",
    "",
    "## Manual Search Steps:",
    "",
    `1. Visit: ${CONFIG.searchUrl}`,
    `2. Enter search term: "${query}"`,
    "3. Complete the CAPTCHA verification",
    "4. View results",
    "",
    "## Alternative Data Sources:",
    "",
    "- **OpenCorporates**: Has Delaware data via API (requires API key)",
    "- **SEC EDGAR**: For public company filings (free)",
    "- **Bloomberg/Pitchbook**: Commercial databases",
    "",
    "## Delaware Facts:",
    "",
    "- Hosts 65% of Fortune 500 companies",
    "- Over 1.1 million business entities",
    "- Popular due to business-friendly laws",
    "",
    "## Fee Structure:",
    "",
    "- Basic search: Free",
    "- Status check: $10 per entity",
    "- Detailed info: $20 per entity",
  ].join("\n")
}
