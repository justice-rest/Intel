/**
 * Florida Division of Corporations (Sunbiz) HTTP Scraper
 *
 * Scrapes business entity data from search.sunbiz.org using pure HTTP.
 * Serverless-compatible - no browser/Playwright required.
 *
 * Features:
 * - Pure HTTP fetch (works in serverless environments)
 * - Search by entity name
 * - Pagination support
 * - No CAPTCHA (as of 2025)
 * - Free access
 *
 * URL Patterns:
 * - Search results: https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults/EntityName/{query}/Page1?searchNameOrder={QUERY}
 *
 * NOTE: Officer search requires browser and is NOT supported in serverless.
 * Use Colorado Open Data API for agent search, or SEC EDGAR for public company officers.
 */

import type {
  ScrapedBusinessEntity,
  ScraperResult,
} from "../../config"

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
 * Build searchNameOrder parameter for Sunbiz URL
 * Sunbiz uses a specific format:
 * - Uppercase
 * - Keep alphanumeric chars and spaces
 * - Replace spaces with nothing (concatenate words)
 * - Special chars like & become AND, etc.
 */
function buildSearchNameOrder(query: string): string {
  return query
    .toUpperCase()
    // Replace & with AND (common in company names like "Ben & Jerry's")
    .replace(/&/g, "AND")
    // Replace common punctuation that might be in company names
    .replace(/'/g, "")  // O'Brien -> OBRIEN
    .replace(/-/g, "")  // Smith-Jones -> SMITHJONES
    .replace(/\./g, "") // Inc. -> INC
    .replace(/,/g, "")  // Remove commas
    // Keep only alphanumeric (spaces will be removed but first kept for ordering)
    .replace(/[^A-Z0-9 ]/g, "")
    // Remove spaces (Sunbiz concatenates)
    .replace(/\s+/g, "")
}

/**
 * Extract total page count from search results HTML
 */
function extractTotalPages(html: string): number {
  // Look for pagination links like "Page2", "Page3", etc.
  const pageLinks = html.match(/Page(\d+)/g)
  if (!pageLinks || pageLinks.length === 0) return 1

  const pageNumbers = pageLinks.map(p => parseInt(p.replace("Page", ""), 10))
  return Math.max(...pageNumbers, 1)
}

/**
 * Search Florida businesses via HTTP (serverless-compatible)
 * Supports pagination to fetch multiple pages of results
 */
export async function searchFloridaHttp(
  query: string,
  options: { limit?: number; maxPages?: number } = {}
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const { limit = 25, maxPages = 3 } = options

  console.log("[Florida HTTP] Searching:", query)

  try {
    // Build search URL - Sunbiz uses a specific URL pattern for search results
    const searchNameOrder = buildSearchNameOrder(query)
    const encodedQuery = encodeURIComponent(query)

    // Fetch first page
    const firstPageUrl = `https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults/EntityName/${encodedQuery}/Page1?searchNameOrder=${searchNameOrder}`

    const response = await fetch(firstPageUrl, {
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
      throw new Error("CAPTCHA detected - Florida Sunbiz may be blocking automated requests")
    }

    // Parse first page results
    let allBusinesses = parseFloridaResultsFromHtml(html)
    console.log(`[Florida HTTP] Page 1: ${allBusinesses.length} results`)

    // Check if we need more results and have pagination
    const totalPages = extractTotalPages(html)
    console.log(`[Florida HTTP] Total pages available: ${totalPages}`)

    // Fetch additional pages if needed (up to maxPages)
    if (allBusinesses.length < limit && totalPages > 1) {
      const pagesToFetch = Math.min(totalPages, maxPages)

      for (let page = 2; page <= pagesToFetch && allBusinesses.length < limit; page++) {
        try {
          const pageUrl = `https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults/EntityName/${encodedQuery}/Page${page}?searchNameOrder=${searchNameOrder}`

          const pageResponse = await fetch(pageUrl, {
            method: "GET",
            headers: HTTP_HEADERS,
            redirect: "follow",
          })

          if (pageResponse.ok) {
            const pageHtml = await pageResponse.text()
            const pageResults = parseFloridaResultsFromHtml(pageHtml)
            console.log(`[Florida HTTP] Page ${page}: ${pageResults.length} results`)
            allBusinesses = [...allBusinesses, ...pageResults]
          }

          // Small delay between page requests to be respectful
          await new Promise(resolve => setTimeout(resolve, 300))
        } catch (pageError) {
          console.warn(`[Florida HTTP] Failed to fetch page ${page}:`, pageError)
          break // Stop fetching more pages on error
        }
      }
    }

    console.log(`[Florida HTTP] Total found: ${allBusinesses.length} results`)

    // Apply limit
    const limitedResults = allBusinesses.slice(0, limit)

    return {
      success: true,
      data: limitedResults as ScrapedBusinessEntity[],
      totalFound: allBusinesses.length,
      source: "florida",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.log(`[Florida HTTP] Failed: ${errorMessage}`)

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
 * Search Florida businesses by name (HTTP-only, serverless-compatible)
 */
export async function scrapeFloridaBusinesses(
  query: string,
  options: {
    limit?: number
  } = {}
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const { limit = 25 } = options

  console.log("[Florida Scraper] Searching:", query)

  // Use HTTP-only search (serverless-compatible)
  const result = await searchFloridaHttp(query, { limit })

  if (result.success && result.data.length > 0) {
    console.log(`[Florida Scraper] Found ${result.data.length} results`)
    return result
  }

  // If HTTP failed, return the error result
  return result
}

/**
 * Officer search is NOT supported in serverless environments
 * Use these alternatives instead:
 * - Colorado Open Data API: searchColoradoByAgent() - searches by registered agent
 * - SEC EDGAR: sec_insider_search tool - for public company officers/directors
 * - Linkup Web Search: searchWeb tool - for general web search
 */
export async function scrapeFloridaByOfficer(
  officerName: string,
  options: { limit?: number } = {}
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()

  console.log("[Florida Scraper] Officer search requested:", officerName)
  console.log("[Florida Scraper] NOTE: Officer search requires browser, not supported in serverless")

  return {
    success: false,
    data: [],
    totalFound: 0,
    source: "florida",
    query: officerName,
    scrapedAt: new Date().toISOString(),
    duration: Date.now() - startTime,
    error: "Florida officer search requires browser and is not supported in serverless. " +
           "Use alternatives: (1) Colorado Open Data API for agent search, " +
           "(2) SEC EDGAR (sec_insider_search) for public company officers, " +
           "(3) Linkup Web Search (searchWeb) for general search.",
  }
}
