/**
 * Browser Scraper Engine (Tier 3)
 *
 * Handles states that require JavaScript rendering.
 * Uses Puppeteer with stealth techniques for bot detection bypass.
 *
 * Tier 3 States (4 states):
 * - Michigan (MI)
 * - Indiana (IN)
 * - Virginia (VA)
 * - Wisconsin (WI)
 *
 * Also used as fallback for Tier 2 states when HTTP scraping fails.
 */

import type { Page, ElementHandle } from "puppeteer-core"
import type { StateRegistryConfig, SelectorStrategy } from "../config/state-template"
import type { ScrapedBusinessEntity, ScraperResult } from "../config"
import { getRateLimiter } from "../services/rate-limiter"
import { getCircuitBreaker } from "../services/circuit-breaker"
import { getScraperCache } from "../services/cache"
import {
  getStealthBrowser,
  createStealthPage,
  humanType,
  humanDelay,
  withRetry,
  isPuppeteerAvailable,
  waitForNetworkIdle,
} from "../stealth-browser"

/**
 * Get text content from element (Puppeteer API)
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
 * Get attribute from element (Puppeteer API)
 */
async function getElementAttribute(page: Page, element: ElementHandle, attr: string): Promise<string | null> {
  try {
    const value = await page.evaluate((el, a) => el.getAttribute(a), element, attr)
    return value || null
  } catch {
    return null
  }
}

/**
 * Extract text from element using selector strategy
 */
async function extractFromPage(
  page: Page,
  parentElement: ElementHandle | Page,
  selector: SelectorStrategy
): Promise<string | null> {
  try {
    const element = await parentElement.$(selector.selector)
    if (!element) {
      // Try fallbacks
      if (selector.fallbacks) {
        for (const fallback of selector.fallbacks) {
          const fallbackEl = await parentElement.$(fallback)
          if (fallbackEl) {
            return extractText(page, fallbackEl, selector)
          }
        }
      }
      return null
    }

    return extractText(page, element, selector)
  } catch {
    return null
  }
}

/**
 * Extract text from element handle
 */
async function extractText(
  page: Page,
  element: ElementHandle,
  selector: SelectorStrategy
): Promise<string | null> {
  let value: string | null = null

  if (selector.attribute) {
    value = await getElementAttribute(page, element, selector.attribute)
  } else {
    value = await getElementText(page, element)
  }

  if (!value) return null

  value = value.trim()

  if (selector.regex) {
    const match = selector.regex.exec(value)
    value = match ? (match[1] || match[0]) : null
  }

  if (value && selector.transform) {
    value = selector.transform(value)
  }

  return value
}

/**
 * Wait for page to be ready
 */
async function waitForPageReady(page: Page, config: StateRegistryConfig): Promise<void> {
  // Wait for network to be idle
  await waitForNetworkIdle(page, { timeout: 30000 })

  // Wait for specific selector if configured
  if (config.scraping?.waitForSelector) {
    await page.waitForSelector(config.scraping.waitForSelector, { timeout: 15000 }).catch(() => null)
  }

  // Additional delay if configured
  if (config.scraping?.postSearchDelay) {
    await new Promise(resolve => setTimeout(resolve, config.scraping!.postSearchDelay))
  }

  // Human-like delay
  await humanDelay()
}

/**
 * Submit search form
 */
async function submitSearch(
  page: Page,
  config: StateRegistryConfig,
  query: string
): Promise<void> {
  if (!config.scraping) {
    throw new Error("No scraping configuration")
  }

  const { searchSelectors, formFields, searchSubmitMethod = "click" } = config.scraping

  // Fill in search form
  if (formFields) {
    for (const field of formFields) {
      if (field.type === "hidden") continue

      const value = typeof field.value === "function" ? field.value(query) : (field.value || query)

      switch (field.type) {
        case "text":
          await humanType(page, field.selector, value)
          break
        case "select":
          // Puppeteer uses page.select instead of page.selectOption
          await page.select(field.selector, value)
          break
        case "checkbox":
        case "radio":
          if (value === "true" || value === "1") {
            // Puppeteer uses click on checkboxes
            await page.click(field.selector)
          }
          break
      }

      await humanDelay()
    }
  } else {
    // Default: find search input and fill it
    const searchInput = await page.$('input[type="text"], input[type="search"], input[name*="search"]')
    if (searchInput) {
      // Clear the input first using triple-click and type
      await searchInput.click({ clickCount: 3 })
      await page.keyboard.press("Backspace")
      await humanType(page, 'input[type="text"], input[type="search"], input[name*="search"]', query)
    }
  }

  // Submit form
  switch (searchSubmitMethod) {
    case "enter":
      await page.keyboard.press("Enter")
      break
    case "form":
      await page.evaluate(() => {
        const form = document.querySelector("form")
        if (form) form.submit()
      })
      break
    case "click":
    default:
      // Find and click submit button - Puppeteer doesn't have :has-text() selector
      const submitButton = await page.$(
        'button[type="submit"], input[type="submit"]'
      )
      if (submitButton) {
        await submitButton.click()
      } else {
        // Try to find by text content
        const buttons = await page.$$("button")
        let found = false
        for (const button of buttons) {
          const text = await page.evaluate((el) => el.textContent, button)
          if (text && (text.toLowerCase().includes("search") || text.toLowerCase().includes("find"))) {
            await button.click()
            found = true
            break
          }
        }
        if (!found) {
          // Fallback to Enter key
          await page.keyboard.press("Enter")
        }
      }
      break
  }

  // Wait for results
  await page.waitForSelector(searchSelectors.resultsContainer, { timeout: 15000 }).catch(() => null)
  await waitForPageReady(page, config)
}

/**
 * Parse search results from page
 */
async function parseResults(
  page: Page,
  config: StateRegistryConfig,
  limit: number
): Promise<ScrapedBusinessEntity[]> {
  if (!config.scraping) {
    return []
  }

  const { searchSelectors } = config.scraping
  const results: ScrapedBusinessEntity[] = []

  // Get result rows
  const rows = await page.$$(searchSelectors.resultRows)
  console.log(`[Browser Scraper] Found ${rows.length} result rows`)

  for (const row of rows.slice(0, limit)) {
    try {
      // Extract name (required)
      const name = await extractFromPage(page, row, searchSelectors.entityName)
      if (!name) continue

      // Extract other fields
      const entityNumber = searchSelectors.entityNumber
        ? await extractFromPage(page, row, searchSelectors.entityNumber)
        : null

      const status = searchSelectors.status
        ? await extractFromPage(page, row, searchSelectors.status)
        : null

      const filingDate = searchSelectors.filingDate
        ? await extractFromPage(page, row, searchSelectors.filingDate)
        : null

      const entityType = searchSelectors.entityType
        ? await extractFromPage(page, row, searchSelectors.entityType)
        : null

      // Get detail link
      let sourceUrl = config.baseUrl
      if (searchSelectors.detailLink) {
        const link = await extractFromPage(page, row, searchSelectors.detailLink)
        if (link) {
          sourceUrl = link.startsWith("http") ? link : `${config.baseUrl}${link}`
        }
      } else if (searchSelectors.entityName.attribute === "href") {
        const link = await extractFromPage(page, row, searchSelectors.entityName)
        if (link) {
          sourceUrl = link.startsWith("http") ? link : `${config.baseUrl}${link}`
        }
      }

      results.push({
        name,
        entityNumber,
        jurisdiction: `us_${config.stateCode}`,
        status,
        incorporationDate: filingDate,
        entityType,
        registeredAddress: null,
        registeredAgent: null,
        sourceUrl,
        source: config.stateCode as ScrapedBusinessEntity["source"],
        scrapedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.warn("[Browser Scraper] Failed to parse row:", error)
    }
  }

  return results
}

/**
 * Browser-based scraper for Tier 3 states
 */
export async function scrapeBrowserState(
  stateCode: string,
  config: StateRegistryConfig,
  query: string,
  options: {
    limit?: number
    skipCache?: boolean
  } = {}
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const { limit = 25, skipCache = false } = options

  if (!config.scraping) {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: "State does not have scraping configuration",
    }
  }

  // Check if Puppeteer is available
  if (!(await isPuppeteerAvailable())) {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: "Puppeteer not installed. Run: npm install puppeteer-core @sparticuz/chromium",
    }
  }

  const rateLimiter = getRateLimiter()
  const circuitBreaker = getCircuitBreaker()
  const cache = getScraperCache()

  // Check cache
  if (!skipCache) {
    const cached = await cache.get<ScrapedBusinessEntity[]>(stateCode, query, { limit })
    if (cached) {
      return {
        success: true,
        data: cached.data,
        totalFound: cached.totalFound,
        source: stateCode as ScrapedBusinessEntity["source"],
        query,
        scrapedAt: cached.createdAt,
        duration: Date.now() - startTime,
      }
    }
  }

  // Check circuit breaker
  if (!circuitBreaker.isAllowed(stateCode)) {
    const info = circuitBreaker.getInfo(stateCode)
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: `Circuit breaker OPEN. Retry in ${Math.ceil((info.timeUntilReset || 0) / 1000)}s`,
    }
  }

  const browser = await getStealthBrowser()
  const { page, cleanup } = await createStealthPage(browser)

  try {
    // Rate limit
    await rateLimiter.acquire(stateCode)

    // Navigate to search page
    await withRetry(async () => {
      await page.goto(config.scraping!.searchUrl, { waitUntil: "networkidle2" })
    })

    await waitForPageReady(page, config)

    // Submit search
    await submitSearch(page, config, query)

    // Parse results
    const results = await parseResults(page, config, limit)

    // Record success
    circuitBreaker.recordSuccess(stateCode)

    // Cache results
    await cache.set(stateCode, query, results, results.length, { limit })

    return {
      success: true,
      data: results,
      totalFound: results.length,
      source: stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    circuitBreaker.recordFailure(stateCode, errorMessage)

    return {
      success: false,
      data: [],
      totalFound: 0,
      source: stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: errorMessage,
    }
  } finally {
    await cleanup()
  }
}

/**
 * Navigate to a detail page and extract full data
 */
export async function scrapeDetailPage(
  url: string,
  config: StateRegistryConfig,
  existingPage?: Page
): Promise<Partial<ScrapedBusinessEntity>> {
  if (!config.scraping?.detailSelectors) {
    throw new Error("No detail page selectors configured")
  }

  const shouldClosePage = !existingPage
  let page: Page
  let cleanup: (() => Promise<void>) | null = null

  if (existingPage) {
    page = existingPage
  } else {
    if (!(await isPuppeteerAvailable())) {
      throw new Error("Puppeteer not available")
    }

    const browser = await getStealthBrowser()
    const result = await createStealthPage(browser)
    page = result.page
    cleanup = result.cleanup
  }

  try {
    await page.goto(url, { waitUntil: "networkidle2" })
    await humanDelay()

    const { detailSelectors } = config.scraping

    // Extract entity details
    const entityType = detailSelectors.entityType
      ? await extractFromPage(page, page, detailSelectors.entityType)
      : null

    const entityName = detailSelectors.entityName
      ? await extractFromPage(page, page, detailSelectors.entityName)
      : null

    const status = detailSelectors.status
      ? await extractFromPage(page, page, detailSelectors.status)
      : null

    const incorporationDate = detailSelectors.incorporationDate
      ? await extractFromPage(page, page, detailSelectors.incorporationDate)
      : null

    const registeredAgent = detailSelectors.registeredAgent
      ? await extractFromPage(page, page, detailSelectors.registeredAgent)
      : null

    const registeredAddress = detailSelectors.registeredAgentAddress
      ? await extractFromPage(page, page, detailSelectors.registeredAgentAddress)
      : null

    const principalAddress = detailSelectors.principalAddress
      ? await extractFromPage(page, page, detailSelectors.principalAddress)
      : null

    // Extract officers
    const officers: ScrapedBusinessEntity["officers"] = []

    if (detailSelectors.officerContainer && detailSelectors.officerRows) {
      const officerRows = await page.$$(
        `${detailSelectors.officerContainer} ${detailSelectors.officerRows}`
      )

      for (const row of officerRows) {
        const name = detailSelectors.officerName
          ? await extractFromPage(page, row, detailSelectors.officerName)
          : null

        const position = detailSelectors.officerTitle
          ? await extractFromPage(page, row, detailSelectors.officerTitle)
          : null

        if (name) {
          officers.push({
            name,
            position: position || "Officer",
            startDate: detailSelectors.officerStartDate
              ? await extractFromPage(page, row, detailSelectors.officerStartDate)
              : null,
          })
        }
      }
    }

    return {
      name: entityName || undefined,
      entityType,
      status,
      incorporationDate,
      registeredAgent,
      registeredAddress: registeredAddress || principalAddress,
      officers: officers.length > 0 ? officers : undefined,
      sourceUrl: url,
    }
  } finally {
    if (shouldClosePage && cleanup) {
      await cleanup()
    }
  }
}

/**
 * Batch scrape detail pages
 */
export async function scrapeDetailPages(
  entities: ScrapedBusinessEntity[],
  config: StateRegistryConfig,
  options: {
    maxConcurrent?: number
    delayBetween?: number
  } = {}
): Promise<ScrapedBusinessEntity[]> {
  const { maxConcurrent = 3, delayBetween = 1000 } = options

  if (!config.scraping?.detailSelectors) {
    return entities // Return unchanged if no detail config
  }

  const results: ScrapedBusinessEntity[] = []

  // Process in batches
  for (let i = 0; i < entities.length; i += maxConcurrent) {
    const batch = entities.slice(i, i + maxConcurrent)

    const batchResults = await Promise.all(
      batch.map(async (entity) => {
        try {
          const details = await scrapeDetailPage(entity.sourceUrl, config)
          return {
            ...entity,
            ...details,
            // Preserve original fields if detail scrape didn't find them
            name: details.name || entity.name,
            entityNumber: entity.entityNumber,
            jurisdiction: entity.jurisdiction,
            source: entity.source,
            scrapedAt: new Date().toISOString(),
          }
        } catch (error) {
          console.warn(`[Browser Scraper] Failed to scrape detail page ${entity.sourceUrl}:`, error)
          return entity
        }
      })
    )

    results.push(...batchResults)

    // Delay between batches
    if (i + maxConcurrent < entities.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetween))
    }
  }

  return results
}
