/**
 * New York Department of State Business Entity Scraper
 *
 * Uses New York Open Data API (Socrata) - FREE, serverless-compatible.
 * No Playwright/browser required.
 *
 * Open Data URLs:
 * - Corporations: https://data.ny.gov/resource/n9v6-gdp6.json
 *
 * IMPORTANT LIMITATION:
 * The NY Open Data API dataset (n9v6-gdp6) ONLY contains ACTIVE corporations.
 * Dissolved, inactive, or historical entities are NOT included.
 * For historical data, users should search manually at:
 * https://apps.dos.ny.gov/publicInquiry/
 */

import {
  STATE_REGISTRY_CONFIG,
  type ScrapedBusinessEntity,
  type ScraperResult,
} from "../../config"

const CONFIG = STATE_REGISTRY_CONFIG.newYork

// NY Open Data API endpoints (Socrata API)
// Dataset: Active Corporations: Beginning 1800
// ID: n9v6-gdp6 (verified December 2025)
const NY_OPEN_DATA = {
  corporations: "https://data.ny.gov/resource/n9v6-gdp6.json",
}

// HTTP headers for API requests
const HTTP_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Romy/1.0 (Nonprofit Research Tool)",
}

/**
 * Search New York businesses via Open Data API (serverless-compatible)
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

  console.log("[New York API] Searching:", query)

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
        warnings: ["NY Open Data dataset n9v6-gdp6 only contains active corporations. " +
                   "For inactive/dissolved entities, search manually at: https://apps.dos.ny.gov/publicInquiry/"],
      }
    }

    const url = `${NY_OPEN_DATA.corporations}?${params.toString()}`

    const response = await fetch(url, { headers: HTTP_HEADERS })

    if (!response.ok) {
      throw new Error(`NY Open Data API error: ${response.status}`)
    }

    const data = await response.json()

    // Map NY Open Data fields to our ScrapedBusinessEntity format
    // Dataset n9v6-gdp6 fields: dos_id, current_entity_name, initial_dos_filing_date,
    // county, jurisdiction, entity_type, dos_process_name, dos_process_address_1, etc.
    const businesses: ScrapedBusinessEntity[] = data.map((entity: {
      current_entity_name?: string | null
      dos_id?: string | null
      initial_dos_filing_date?: string | null
      jurisdiction?: string | null
      entity_type?: string | null
      county?: string | null
      dos_process_name?: string | null
      dos_process_address_1?: string | null
      dos_process_city?: string | null
      dos_process_state?: string | null
      dos_process_zip?: string | null
    }) => {
      // Build address from components (filter nulls and empty strings)
      const addressParts = [
        entity.dos_process_address_1,
        entity.dos_process_city,
        entity.dos_process_state,
        entity.dos_process_zip,
      ].filter((part): part is string => Boolean(part))

      // Safely parse date - handle null, undefined, and invalid formats
      let incorporationDate: string | null = null
      if (entity.initial_dos_filing_date && typeof entity.initial_dos_filing_date === "string") {
        const datePart = entity.initial_dos_filing_date.split("T")[0]
        // Validate it looks like a date (YYYY-MM-DD)
        if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          incorporationDate = datePart
        }
      }

      return {
        name: entity.current_entity_name || "",
        entityNumber: entity.dos_id || null,
        jurisdiction: "us_ny",
        status: "Active", // This dataset only contains active corporations
        incorporationDate,
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

    const duration = Date.now() - startTime
    console.log(`[New York API] Found ${businesses.length} results in ${duration}ms`)

    return {
      success: true,
      data: businesses,
      totalFound: businesses.length,
      source: "newYork",
      query,
      scrapedAt: new Date().toISOString(),
      duration,
      warnings: [
        "NY Open Data API only contains ACTIVE corporations. " +
        "For dissolved/inactive entities, search manually at: https://apps.dos.ny.gov/publicInquiry/",
      ],
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[New York API] Error:", errorMessage)

    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "newYork",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: errorMessage,
      warnings: [
        "NY Open Data API failed. Search manually at: https://apps.dos.ny.gov/publicInquiry/",
      ],
    }
  }
}

// Export the Open Data search as the primary method
export { searchNewYorkOpenData as scrapeNewYorkBusinesses }
