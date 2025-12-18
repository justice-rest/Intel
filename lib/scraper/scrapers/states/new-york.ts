/**
 * New York Department of State Business Entity Scraper
 *
 * New York offers BOTH:
 * 1. Open Data API (preferred - FREE, no scraping needed)
 * 2. Web scraping fallback (apps.dos.ny.gov)
 *
 * Open Data URLs:
 * - Corporations: https://data.ny.gov/resource/7tqb-y2d4.json
 * - Addresses: https://data.ny.gov/resource/djse-xbpp.json
 *
 * Web Scraping URLs:
 * - Search: https://apps.dos.ny.gov/publicInquiry/
 * - Entity: https://apps.dos.ny.gov/publicInquiry/EntityDisplay?dosId=XXX
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

const CONFIG = STATE_REGISTRY_CONFIG.newYork

// NY Open Data API endpoints (Socrata API)
// Dataset: Active Corporations: Beginning 1800
// ID: n9v6-gdp6 (verified December 2025)
const NY_OPEN_DATA = {
  corporations: "https://data.ny.gov/resource/n9v6-gdp6.json",
}

/**
 * Search New York businesses via Open Data API (preferred method)
 * This is FREE and doesn't require scraping!
 */
export async function searchNewYorkOpenData(
  query: string,
  options: {
    limit?: number
    status?: "active" | "inactive" | "all"
  } = {}
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const { limit = 25, status = "all" } = options

  console.log("[New York Scraper] Searching via Open Data API:", query)

  try {
    // Build Socrata Query Language (SoQL) query
    // Dataset n9v6-gdp6 only contains ACTIVE corporations
    const params = new URLSearchParams({
      $limit: limit.toString(),
      $order: "initial_dos_filing_date DESC",
    })

    // Add search filter - use UPPER for case-insensitive search
    // Escape single quotes in query
    const escapedQuery = query.toUpperCase().replace(/'/g, "''")
    const searchFilter = `UPPER(current_entity_name) LIKE '%${escapedQuery}%'`
    params.append("$where", searchFilter)

    // Note: This dataset only contains active corporations, so status filter is not needed
    // If status === "inactive", we return empty results since this dataset has no inactive entities
    if (status === "inactive") {
      return {
        success: true,
        data: [],
        totalFound: 0,
        source: "newYork",
        query,
        scrapedAt: new Date().toISOString(),
        duration: Date.now() - startTime,
        warnings: ["NY Open Data dataset n9v6-gdp6 only contains active corporations"],
      }
    }

    const url = `${NY_OPEN_DATA.corporations}?${params.toString()}`

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Romy/1.0 (Nonprofit Research Tool)",
      },
    })

    if (!response.ok) {
      throw new Error(`NY Open Data API error: ${response.status}`)
    }

    const data = await response.json()

    // Map NY Open Data fields to our ScrapedBusinessEntity format
    // Dataset n9v6-gdp6 fields: dos_id, current_entity_name, initial_dos_filing_date,
    // county, jurisdiction, entity_type, dos_process_name, dos_process_address_1, etc.
    const businesses: ScrapedBusinessEntity[] = data.map((entity: {
      current_entity_name?: string
      dos_id?: string
      initial_dos_filing_date?: string
      jurisdiction?: string
      entity_type?: string
      county?: string
      dos_process_name?: string
      dos_process_address_1?: string
      dos_process_city?: string
      dos_process_state?: string
      dos_process_zip?: string
    }) => {
      // Build address from components
      const addressParts = [
        entity.dos_process_address_1,
        entity.dos_process_city,
        entity.dos_process_state,
        entity.dos_process_zip,
      ].filter(Boolean)

      return {
        name: entity.current_entity_name || "",
        entityNumber: entity.dos_id || null,
        jurisdiction: "us_ny",
        status: "Active", // This dataset only contains active corporations
        incorporationDate: entity.initial_dos_filing_date?.split("T")[0] || null,
        entityType: entity.entity_type || null,
        registeredAddress: addressParts.length > 0 ? addressParts.join(", ") : (entity.county ? `${entity.county} County, NY` : null),
        registeredAgent: entity.dos_process_name || null,
        sourceUrl: entity.dos_id
          ? `https://apps.dos.ny.gov/publicInquiry/EntityDisplay?dosId=${entity.dos_id}`
          : CONFIG.searchUrl,
        source: "newYork" as const,
        scrapedAt: new Date().toISOString(),
      }
    })

    return {
      success: true,
      data: businesses,
      totalFound: businesses.length,
      source: "newYork",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[New York Scraper] Open Data API error:", errorMessage)

    // Fall back to web scraping
    console.log("[New York Scraper] Falling back to web scraping...")
    return scrapeNewYorkWebsite(query, { limit })
  }
}

/**
 * Search New York businesses via web scraping (fallback)
 */
export async function scrapeNewYorkWebsite(
  query: string,
  options: { limit?: number } = {}
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const { limit = 25 } = options

  console.log("[New York Scraper] Web scraping:", query)

  // Check if Playwright is available
  if (!(await isPlaywrightAvailable())) {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "newYork",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: "Playwright not installed and Open Data API failed",
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
    console.log(`[New York Scraper] Found ${resultRows.length} web results`)

    const businesses: ScrapedBusinessEntity[] = []

    for (const row of resultRows.slice(0, limit)) {
      try {
        const nameEl = await row.$(CONFIG.selectors.entityName)
        const name = nameEl ? await nameEl.textContent() : null

        if (!name) continue

        const dosIdEl = await row.$(CONFIG.selectors.dosId)
        const dosId = dosIdEl ? await dosIdEl.textContent() : null

        const statusEl = await row.$(CONFIG.selectors.status)
        const status = statusEl ? await statusEl.textContent() : null

        const jurisdictionEl = await row.$(CONFIG.selectors.jurisdiction)
        const jurisdiction = jurisdictionEl ? await jurisdictionEl.textContent() : null

        businesses.push({
          name: name.trim(),
          entityNumber: dosId?.trim() || null,
          jurisdiction: "us_ny",
          status: status?.trim() || null,
          incorporationDate: null,
          entityType: jurisdiction?.trim() || null,
          registeredAddress: null,
          registeredAgent: null,
          sourceUrl: dosId
            ? `https://apps.dos.ny.gov/publicInquiry/EntityDisplay?dosId=${dosId.trim()}`
            : CONFIG.searchUrl,
          source: "newYork",
          scrapedAt: new Date().toISOString(),
        })
      } catch (error) {
        console.warn("[New York Scraper] Failed to parse row:", error)
      }
    }

    return {
      success: true,
      data: businesses,
      totalFound: resultRows.length,
      source: "newYork",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[New York Scraper] Web scraping error:", errorMessage)

    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "newYork",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: errorMessage,
    }
  } finally {
    await closePage(context)
  }
}

// Export the Open Data search as the primary method
export { searchNewYorkOpenData as scrapeNewYorkBusinesses }
