/**
 * OpenCorporates Web Scraper
 *
 * Scrapes company and officer data from opencorporates.com when API access
 * is unavailable. Falls back gracefully when Playwright is not installed.
 *
 * URL Patterns:
 * - Company search: https://opencorporates.com/companies?q=COMPANY_NAME
 * - Company search with jurisdiction: https://opencorporates.com/companies?q=COMPANY_NAME&jurisdiction_code=us_de
 * - Officer search: https://opencorporates.com/officers?q=OFFICER_NAME
 * - Company details: https://opencorporates.com/companies/us_de/1234567
 *
 * Selector Strategy:
 * OpenCorporates has various page structures. We use multiple selector strategies
 * to maximize data extraction success.
 */

import {
  OPENCORPORATES_SCRAPER_CONFIG,
  SCRAPER_CONFIG,
  type ScrapedBusinessEntity,
  type ScrapedOfficer,
  type ScraperResult,
} from "../config"
import {
  getStealthBrowser,
  createStealthPage,
  humanDelay,
  withRetry,
  closePage,
  isPlaywrightAvailable,
} from "../stealth-browser"
import {
  fetchOpenCorporatesCompaniesHttp,
  fetchOpenCorporatesOfficersHttp,
} from "../http-fallback"

const CONFIG = OPENCORPORATES_SCRAPER_CONFIG

// Multiple selector strategies for robustness
const COMPANY_SELECTORS = {
  // Primary selectors (most common structure)
  primary: {
    resultRows: ".company_search_result, li.search_result, .oc-search-result",
    name: "a.company, a[href*='/companies/'], .company-name a",
    jurisdiction: ".jurisdiction, .jurisdiction_code, [class*='jurisdiction']",
    companyNumber: ".company_number, .number, [class*='number']",
    status: ".status, .company_status, [class*='status']",
    address: ".registered_address, .address, [class*='address']",
    incorporationDate: ".incorporation_date, .inc_date, [class*='date']",
    entityType: ".company_type, .type, [class*='type']",
  },
  // Fallback selectors (alternative structure)
  fallback: {
    resultRows: "#companies li, .results li, table.companies tbody tr",
    name: "a:first-child, td:first-child a",
    jurisdiction: "td:nth-child(2), .meta span:first-child",
    companyNumber: "td:nth-child(3), .meta span:nth-child(2)",
    status: "td:nth-child(4), .meta span:nth-child(3)",
  },
}

const OFFICER_SELECTORS = {
  primary: {
    resultRows: ".officer_search_result, li.search_result, .oc-search-result",
    name: "a.officer, a[href*='/officers/'], .officer-name a",
    position: ".position, .role, [class*='position']",
    company: "a.company, a[href*='/companies/']",
    dates: ".dates, .tenure, [class*='date']",
    status: ".status, .current, [class*='status']",
  },
  fallback: {
    resultRows: "#officers li, .results li, table.officers tbody tr",
    name: "a:first-child, td:first-child",
    position: "td:nth-child(2), .meta span:first-child",
    company: "a[href*='/companies/'], td:nth-child(3) a",
  },
}

/**
 * Try multiple selectors until one works
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function trySelectors(element: any, selectors: string): Promise<any | null> {
  const selectorList = selectors.split(", ")
  for (const selector of selectorList) {
    try {
      const el = await element.$(selector.trim())
      if (el) return el
    } catch {
      // Continue to next selector
    }
  }
  return null
}

/**
 * Safely extract text content
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeTextContent(element: any | null): Promise<string | null> {
  if (!element) return null
  try {
    const text = await element.textContent()
    return text?.trim() || null
  } catch {
    return null
  }
}

/**
 * Safely extract attribute
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeAttribute(element: any | null, attr: string): Promise<string | null> {
  if (!element) return null
  try {
    return await element.getAttribute(attr)
  } catch {
    return null
  }
}

/**
 * Parse company data from search result element
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseCompanyResult(element: any): Promise<Partial<ScrapedBusinessEntity> | null> {
  try {
    // Try primary selectors first
    let nameEl = await trySelectors(element, COMPANY_SELECTORS.primary.name)
    if (!nameEl) {
      nameEl = await trySelectors(element, COMPANY_SELECTORS.fallback.name)
    }

    const name = await safeTextContent(nameEl)
    if (!name) return null

    const href = await safeAttribute(nameEl, "href")

    // Extract jurisdiction
    let jurisdictionEl = await trySelectors(element, COMPANY_SELECTORS.primary.jurisdiction)
    if (!jurisdictionEl) {
      jurisdictionEl = await trySelectors(element, COMPANY_SELECTORS.fallback.jurisdiction)
    }
    let jurisdiction = await safeTextContent(jurisdictionEl)

    // If no jurisdiction element, try to extract from URL
    if (!jurisdiction && href) {
      const match = href.match(/\/companies\/([^/]+)\//)
      jurisdiction = match ? match[1] : null
    }

    // Extract company number
    let numberEl = await trySelectors(element, COMPANY_SELECTORS.primary.companyNumber)
    if (!numberEl) {
      numberEl = await trySelectors(element, COMPANY_SELECTORS.fallback.companyNumber)
    }
    let companyNumber = await safeTextContent(numberEl)

    // If no number from element, try to extract from URL
    if (!companyNumber && href) {
      const match = href.match(/\/companies\/[^/]+\/([^/?]+)/)
      companyNumber = match ? match[1] : null
    }

    // Extract status
    let statusEl = await trySelectors(element, COMPANY_SELECTORS.primary.status)
    if (!statusEl) {
      statusEl = await trySelectors(element, COMPANY_SELECTORS.fallback.status)
    }
    const status = await safeTextContent(statusEl)

    // Extract address
    const addressEl = await trySelectors(element, COMPANY_SELECTORS.primary.address)
    const address = await safeTextContent(addressEl)

    // Extract incorporation date
    const dateEl = await trySelectors(element, COMPANY_SELECTORS.primary.incorporationDate)
    const incorporationDate = await safeTextContent(dateEl)

    // Extract entity type
    const typeEl = await trySelectors(element, COMPANY_SELECTORS.primary.entityType)
    const entityType = await safeTextContent(typeEl)

    return {
      name: name.trim(),
      entityNumber: companyNumber?.replace(/[^\w-]/g, "").trim() || null,
      jurisdiction: jurisdiction?.trim().toLowerCase() || "unknown",
      status: normalizeStatus(status),
      incorporationDate: normalizeDate(incorporationDate),
      entityType: entityType?.trim() || null,
      registeredAddress: address?.trim() || null,
      registeredAgent: null,
      sourceUrl: href ? `https://opencorporates.com${href}` : CONFIG.searchUrl,
      source: "opencorporates",
      scrapedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.warn("[OpenCorporates Scraper] Failed to parse company result:", error)
    return null
  }
}

/**
 * Parse officer data from search result element
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseOfficerResult(element: any): Promise<Partial<ScrapedOfficer> | null> {
  try {
    // Try primary selectors first
    let nameEl = await trySelectors(element, OFFICER_SELECTORS.primary.name)
    if (!nameEl) {
      nameEl = await trySelectors(element, OFFICER_SELECTORS.fallback.name)
    }

    const name = await safeTextContent(nameEl)
    if (!name) return null

    // Extract position
    let positionEl = await trySelectors(element, OFFICER_SELECTORS.primary.position)
    if (!positionEl) {
      positionEl = await trySelectors(element, OFFICER_SELECTORS.fallback.position)
    }
    const position = await safeTextContent(positionEl)

    // Extract company info
    let companyEl = await trySelectors(element, OFFICER_SELECTORS.primary.company)
    if (!companyEl) {
      companyEl = await trySelectors(element, OFFICER_SELECTORS.fallback.company)
    }
    const companyName = await safeTextContent(companyEl)
    const companyHref = await safeAttribute(companyEl, "href")

    // Extract jurisdiction and company number from URL
    let jurisdiction = "unknown"
    let companyNumber: string | null = null
    if (companyHref) {
      const jurisdictionMatch = companyHref.match(/\/companies\/([^/]+)\//)
      if (jurisdictionMatch) jurisdiction = jurisdictionMatch[1]

      const numberMatch = companyHref.match(/\/companies\/[^/]+\/([^/?]+)/)
      if (numberMatch) companyNumber = numberMatch[1]
    }

    // Extract dates if available
    const datesEl = await trySelectors(element, OFFICER_SELECTORS.primary.dates)
    const datesText = await safeTextContent(datesEl)
    const { startDate, endDate, current } = parseDates(datesText)

    // Check if marked as current
    const statusEl = await trySelectors(element, OFFICER_SELECTORS.primary.status)
    const statusText = await safeTextContent(statusEl)
    const isCurrent = current || statusText?.toLowerCase().includes("current") || !endDate

    return {
      name: name.trim(),
      position: position?.trim() || "Officer",
      companyName: companyName?.trim() || "",
      companyNumber,
      jurisdiction: jurisdiction.toLowerCase(),
      startDate,
      endDate,
      current: isCurrent,
      sourceUrl: companyHref ? `https://opencorporates.com${companyHref}` : CONFIG.officerSearchUrl,
      source: "opencorporates",
      scrapedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.warn("[OpenCorporates Scraper] Failed to parse officer result:", error)
    return null
  }
}

/**
 * Normalize status text
 */
function normalizeStatus(status: string | null): string | null {
  if (!status) return null
  const s = status.toLowerCase().trim()

  if (s.includes("active") || s.includes("good standing")) return "Active"
  if (s.includes("inactive")) return "Inactive"
  if (s.includes("dissolved")) return "Dissolved"
  if (s.includes("merged")) return "Merged"
  if (s.includes("withdrawn")) return "Withdrawn"
  if (s.includes("revoked")) return "Revoked"
  if (s.includes("suspended")) return "Suspended"
  if (s.includes("pending")) return "Pending"

  return status.trim()
}

/**
 * Normalize date format
 */
function normalizeDate(date: string | null): string | null {
  if (!date) return null
  const d = date.trim()

  // Try to parse various date formats
  try {
    // Check if it's already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d

    // Try parsing as Date
    const parsed = new Date(d)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0]
    }
  } catch {
    // Return original if parsing fails
  }

  return d
}

/**
 * Parse dates from tenure string
 */
function parseDates(text: string | null): { startDate: string | null; endDate: string | null; current: boolean } {
  if (!text) return { startDate: null, endDate: null, current: true }

  const result = { startDate: null as string | null, endDate: null as string | null, current: true }

  // Look for date ranges like "2015 - 2020" or "2015 - present"
  const rangeMatch = text.match(/(\d{4}(?:-\d{2}(?:-\d{2})?)?)\s*[-–]\s*(\d{4}(?:-\d{2}(?:-\d{2})?)?|present|current)/i)
  if (rangeMatch) {
    result.startDate = normalizeDate(rangeMatch[1])
    if (rangeMatch[2].toLowerCase() === "present" || rangeMatch[2].toLowerCase() === "current") {
      result.current = true
    } else {
      result.endDate = normalizeDate(rangeMatch[2])
      result.current = false
    }
    return result
  }

  // Look for single date
  const singleMatch = text.match(/(\d{4}(?:-\d{2}(?:-\d{2})?)?)/)
  if (singleMatch) {
    result.startDate = normalizeDate(singleMatch[1])
  }

  // Check if marked as current/present
  if (text.toLowerCase().includes("current") || text.toLowerCase().includes("present")) {
    result.current = true
  }

  return result
}

/**
 * Simulate human-like mouse movements
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function simulateHumanBehavior(page: any) {
  try {
    // Random scroll
    await page.evaluate(() => {
      window.scrollTo({
        top: Math.random() * 300,
        behavior: "smooth",
      })
    })

    // Random mouse movement
    const viewportSize = page.viewportSize()
    if (viewportSize) {
      await page.mouse.move(
        Math.random() * viewportSize.width * 0.8 + viewportSize.width * 0.1,
        Math.random() * viewportSize.height * 0.8 + viewportSize.height * 0.1
      )
    }

    // Small delay
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500))
  } catch {
    // Ignore errors - this is just for stealth
  }
}

/**
 * Accept cookies if dialog appears
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function acceptCookies(page: any) {
  try {
    // Common cookie consent selectors
    const cookieSelectors = [
      'button[id*="accept"]',
      'button[class*="accept"]',
      'a[id*="accept"]',
      'button[id*="cookie"]',
      'button[class*="cookie"]',
      'button[id*="consent"]',
      'button[class*="consent"]',
      ".cookie-accept",
      "#cookie-accept",
      '[data-action="accept"]',
    ]

    for (const selector of cookieSelectors) {
      const btn = await page.$(selector)
      if (btn) {
        await btn.click()
        await new Promise((resolve) => setTimeout(resolve, 500))
        break
      }
    }
  } catch {
    // Ignore - cookie dialog may not exist
  }
}

/**
 * Search for companies on OpenCorporates
 * Strategy: Try HTTP first, then fallback to browser with improved stealth
 */
export async function scrapeOpenCorporatesCompanies(
  query: string,
  options: {
    jurisdiction?: string
    includeInactive?: boolean
    limit?: number
  } = {}
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const { jurisdiction, includeInactive = false, limit = 20 } = options

  console.log("[OpenCorporates Scraper] Searching companies:", query)

  // STRATEGY 1: Try HTTP fetch first (fastest, least likely to be blocked)
  console.log("[OpenCorporates Scraper] Trying HTTP fallback first...")
  const httpResult = await fetchOpenCorporatesCompaniesHttp(query, options)

  if (httpResult.success && httpResult.data.length > 0) {
    console.log(`[OpenCorporates Scraper] HTTP succeeded with ${httpResult.data.length} results`)
    return {
      success: true,
      data: httpResult.data as ScrapedBusinessEntity[],
      totalFound: httpResult.data.length,
      source: "opencorporates",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  }

  if (httpResult.blocked) {
    console.log(`[OpenCorporates Scraper] HTTP blocked (${httpResult.reason}), trying browser...`)
  } else if (!httpResult.success) {
    console.log(`[OpenCorporates Scraper] HTTP failed: ${httpResult.error}, trying browser...`)
  }

  // STRATEGY 2: Browser with stealth (fallback)
  if (!(await isPlaywrightAvailable())) {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "opencorporates",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: "HTTP fetch failed and Playwright not installed",
      warnings: ["Install Playwright for browser fallback: npm install playwright-extra puppeteer-extra-plugin-stealth playwright"],
    }
  }

  let browser
  let context

  try {
    browser = await getStealthBrowser()
    const pageData = await createStealthPage(browser)
    context = pageData.context
    const page = pageData.page

    // Build search URL
    const params = new URLSearchParams({ q: query })
    if (jurisdiction) {
      params.append("jurisdiction_code", jurisdiction)
    }
    if (!includeInactive) {
      params.append("inactive", "false")
    }

    const searchUrl = `${CONFIG.searchUrl}?${params.toString()}`
    console.log("[OpenCorporates Scraper] Browser navigating to:", searchUrl)

    // Navigate with improved strategy - use domcontentloaded (faster than networkidle)
    await withRetry(
      async () => {
        await page.goto(searchUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60000, // 60 second timeout
        })
      },
      3, // 3 retries
      3000 // 3 second delay between retries
    )

    // Wait for content and simulate human behavior
    await humanDelay()
    await acceptCookies(page)
    await simulateHumanBehavior(page)

    // Wait a bit more for dynamic content
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Check for rate limiting or blocking
    const pageContent = await page.content()
    if (pageContent.includes("rate limit") || pageContent.includes("too many requests")) {
      throw new Error("Rate limited by OpenCorporates. Try again in a few minutes.")
    }
    if (pageContent.includes("captcha") || pageContent.includes("challenge-form")) {
      throw new Error("CAPTCHA detected. Consider using OpenCorporates API.")
    }
    if (pageContent.includes("Access Denied") || pageContent.includes("Forbidden")) {
      throw new Error("Access denied by OpenCorporates.")
    }

    // Try multiple selector strategies to find results
    let resultElements = await page.$$(COMPANY_SELECTORS.primary.resultRows)
    if (resultElements.length === 0) {
      resultElements = await page.$$(COMPANY_SELECTORS.fallback.resultRows)
    }

    // If still no results, try waiting a bit more and re-check
    if (resultElements.length === 0) {
      console.log("[OpenCorporates Scraper] No results found, waiting for dynamic content...")
      await new Promise((resolve) => setTimeout(resolve, 3000))
      resultElements = await page.$$(COMPANY_SELECTORS.primary.resultRows)
      if (resultElements.length === 0) {
        resultElements = await page.$$(COMPANY_SELECTORS.fallback.resultRows)
      }
    }

    console.log(`[OpenCorporates Scraper] Browser found ${resultElements.length} company results`)

    // Parse results
    const companies: ScrapedBusinessEntity[] = []
    const limitedResults = resultElements.slice(0, limit)

    for (const element of limitedResults) {
      const company = await parseCompanyResult(element)
      if (company && company.name) {
        companies.push(company as ScrapedBusinessEntity)
      }
    }

    // Try to get total count from page
    let totalFound = companies.length
    try {
      const countEl = await page.$(".total_count, .result-count, .count")
      if (countEl) {
        const countText = await countEl.textContent()
        const match = countText?.match(/(\d+(?:,\d{3})*)/)
        if (match) {
          totalFound = parseInt(match[1].replace(/,/g, ""), 10)
        }
      }
    } catch {
      // Use found count
    }

    return {
      success: true,
      data: companies,
      totalFound,
      source: "opencorporates",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[OpenCorporates Scraper] Browser search error:", errorMessage)

    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "opencorporates",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: errorMessage,
    }
  } finally {
    if (context) {
      await closePage(context)
    }
  }
}

/**
 * Search for officers on OpenCorporates
 * Strategy: Try HTTP first, then fallback to browser with improved stealth
 */
export async function scrapeOpenCorporatesOfficers(
  query: string,
  options: {
    jurisdiction?: string
    currentOnly?: boolean
    limit?: number
  } = {}
): Promise<ScraperResult<ScrapedOfficer>> {
  const startTime = Date.now()
  const { jurisdiction, currentOnly = false, limit = 30 } = options

  console.log("[OpenCorporates Scraper] Searching officers:", query)

  // STRATEGY 1: Try HTTP fetch first (fastest, least likely to be blocked)
  console.log("[OpenCorporates Scraper] Trying HTTP fallback first for officers...")
  const httpResult = await fetchOpenCorporatesOfficersHttp(query, options)

  if (httpResult.success && httpResult.data.length > 0) {
    console.log(`[OpenCorporates Scraper] HTTP succeeded with ${httpResult.data.length} officer results`)
    return {
      success: true,
      data: httpResult.data as ScrapedOfficer[],
      totalFound: httpResult.data.length,
      source: "opencorporates",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  }

  if (httpResult.blocked) {
    console.log(`[OpenCorporates Scraper] HTTP blocked (${httpResult.reason}), trying browser...`)
  }

  // STRATEGY 2: Browser with stealth (fallback)
  if (!(await isPlaywrightAvailable())) {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "opencorporates",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: "HTTP fetch failed and Playwright not installed",
    }
  }

  let browser
  let context

  try {
    browser = await getStealthBrowser()
    const pageData = await createStealthPage(browser)
    context = pageData.context
    const page = pageData.page

    // Build search URL
    const params = new URLSearchParams({ q: query })
    if (jurisdiction) {
      params.append("jurisdiction_code", jurisdiction)
    }
    if (currentOnly) {
      params.append("current", "true")
    }

    const searchUrl = `${CONFIG.officerSearchUrl}?${params.toString()}`
    console.log("[OpenCorporates Scraper] Browser navigating to:", searchUrl)

    // Navigate with improved strategy
    await withRetry(
      async () => {
        await page.goto(searchUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        })
      },
      3,
      3000
    )

    // Wait for content and simulate human behavior
    await humanDelay()
    await acceptCookies(page)
    await simulateHumanBehavior(page)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Check for rate limiting
    const pageContent = await page.content()
    if (pageContent.includes("rate limit") || pageContent.includes("too many requests")) {
      throw new Error("Rate limited by OpenCorporates. Try again in a few minutes.")
    }
    if (pageContent.includes("captcha") || pageContent.includes("challenge-form")) {
      throw new Error("CAPTCHA detected.")
    }

    // Try multiple selector strategies to find results
    let resultElements = await page.$$(OFFICER_SELECTORS.primary.resultRows)
    if (resultElements.length === 0) {
      resultElements = await page.$$(OFFICER_SELECTORS.fallback.resultRows)
    }

    // Wait for dynamic content if needed
    if (resultElements.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      resultElements = await page.$$(OFFICER_SELECTORS.primary.resultRows)
      if (resultElements.length === 0) {
        resultElements = await page.$$(OFFICER_SELECTORS.fallback.resultRows)
      }
    }

    console.log(`[OpenCorporates Scraper] Browser found ${resultElements.length} officer results`)

    // Parse results
    const officers: ScrapedOfficer[] = []
    const limitedResults = resultElements.slice(0, limit)

    for (const element of limitedResults) {
      const officer = await parseOfficerResult(element)
      if (officer && officer.name) {
        officers.push(officer as ScrapedOfficer)
      }
    }

    // Try to get total count
    let totalFound = officers.length
    try {
      const countEl = await page.$(".total_count, .result-count, .count")
      if (countEl) {
        const countText = await countEl.textContent()
        const match = countText?.match(/(\d+(?:,\d{3})*)/)
        if (match) {
          totalFound = parseInt(match[1].replace(/,/g, ""), 10)
        }
      }
    } catch {
      // Use found count
    }

    return {
      success: true,
      data: officers,
      totalFound,
      source: "opencorporates",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[OpenCorporates Scraper] Officer search error:", errorMessage)

    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "opencorporates",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: errorMessage,
    }
  } finally {
    if (context) {
      await closePage(context)
    }
  }
}

/**
 * Get detailed company information from OpenCorporates
 */
export async function scrapeOpenCorporatesCompanyDetails(
  companyUrl: string
): Promise<ScrapedBusinessEntity | null> {
  console.log("[OpenCorporates Scraper] Fetching company details:", companyUrl)

  // Check if Playwright is available
  if (!(await isPlaywrightAvailable())) {
    console.error("[OpenCorporates Scraper] Playwright not available")
    return null
  }

  let browser
  let context

  try {
    browser = await getStealthBrowser()
    const pageData = await createStealthPage(browser)
    context = pageData.context
    const page = pageData.page

    await withRetry(async () => {
      await page.goto(companyUrl, { waitUntil: "networkidle", timeout: SCRAPER_CONFIG.navigationTimeout })
    })

    await humanDelay()

    // Parse company details
    const nameEl = await page.$("h1.company_name, h1, .company-name")
    const name = await safeTextContent(nameEl)

    if (!name) {
      throw new Error("Could not find company name on page")
    }

    // Get company number from URL or page
    const urlMatch = companyUrl.match(/\/companies\/([^/]+)\/([^/?]+)/)
    const jurisdiction = urlMatch ? urlMatch[1] : "unknown"
    const entityNumber = urlMatch ? urlMatch[2] : null

    // Get status
    const statusEl = await page.$(".status, .company-status, [class*='status']")
    const status = await safeTextContent(statusEl)

    // Get incorporation date
    const incDateEl = await page.$(".incorporation_date, .inc-date, [class*='incorporation']")
    const incorporationDate = await safeTextContent(incDateEl)

    // Get entity type
    const typeEl = await page.$(".company_type, .type, [class*='type']")
    const entityType = await safeTextContent(typeEl)

    // Get registered address
    const addressEl = await page.$(".registered_address .address, .address, [class*='address']")
    const registeredAddress = await safeTextContent(addressEl)

    // Get registered agent
    const agentEl = await page.$(".registered_agent, .agent, [class*='agent']")
    const registeredAgent = await safeTextContent(agentEl)

    // Get officers
    const officerElements = await page.$$(".officer, #officers li, .officers-list li")
    const officers: ScrapedBusinessEntity["officers"] = []

    for (const officerEl of officerElements.slice(0, 20)) {
      try {
        const officerNameEl = await officerEl.$(".name, a, strong")
        const officerPositionEl = await officerEl.$(".position, .role, span")
        const officerStartEl = await officerEl.$(".start_date, .date")

        const officerName = await safeTextContent(officerNameEl)
        const position = await safeTextContent(officerPositionEl)
        const startDate = await safeTextContent(officerStartEl)

        if (officerName) {
          officers.push({
            name: officerName.trim(),
            position: position?.trim() || "Officer",
            startDate: normalizeDate(startDate),
          })
        }
      } catch {
        // Skip malformed officer entries
      }
    }

    return {
      name: name.trim(),
      entityNumber,
      jurisdiction,
      status: normalizeStatus(status),
      incorporationDate: normalizeDate(incorporationDate),
      entityType: entityType?.trim() || null,
      registeredAddress: registeredAddress?.trim() || null,
      registeredAgent: registeredAgent?.trim() || null,
      officers: officers.length > 0 ? officers : undefined,
      sourceUrl: companyUrl,
      source: "opencorporates",
      scrapedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error("[OpenCorporates Scraper] Details error:", error)
    return null
  } finally {
    if (context) {
      await closePage(context)
    }
  }
}

// Export for use with humanDelay (for form-based searches if needed in future)
export { humanDelay }
