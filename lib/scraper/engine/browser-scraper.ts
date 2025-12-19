/**
 * Browser Scraper Engine (Tier 3)
 *
 * Handles states that require JavaScript rendering.
 * Uses Playwright with stealth plugin for bot detection bypass.
 *
 * Tier 3 States (4 states):
 * - Michigan (MI)
 * - Indiana (IN)
 * - Virginia (VA)
 * - Wisconsin (WI)
 *
 * Also used as fallback for Tier 2 states when HTTP scraping fails.
 */

import type { Page, Frame } from "playwright"
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
  closePage,
  isPlaywrightAvailable,
} from "../stealth-browser"

/**
 * Extract text from element using selector strategy
 */
async function extractFromPage(
  page: Page | Frame,
  selector: SelectorStrategy
): Promise<string | null> {
  try {
    const element = await page.$(selector.selector)
    if (!element) {
      // Try fallbacks
      if (selector.fallbacks) {
        for (const fallback of selector.fallbacks) {
          const fallbackEl = await page.$(fallback)
          if (fallbackEl) {
            return extractText(fallbackEl, selector)
          }
        }
      }
      return null
    }

    return extractText(element, selector)
  } catch {
    return null
  }
}

/**
 * Extract text from element handle
 */
async function extractText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  element: any,
  selector: SelectorStrategy
): Promise<string | null> {
  let value: string | null = null

  if (selector.attribute) {
    value = await element.getAttribute(selector.attribute)
  } else {
    value = await element.textContent()
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
  await page.waitForLoadState("networkidle").catch(() => null)

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
          await page.selectOption(field.selector, value)
          break
        case "checkbox":
        case "radio":
          if (value === "true" || value === "1") {
            await page.check(field.selector)
          }
          break
      }

      await humanDelay()
    }
  } else {
    // Default: find search input and fill it
    const searchInput = await page.$('input[type="text"], input[type="search"], input[name*="search"]')
    if (searchInput) {
      await searchInput.fill("")
      await humanType(page, 'input[type="text"], input[type="search"], input[name*="search"]', query)
    }
  }

  // Submit form
  switch (searchSubmitMethod) {
    case "enter":
      await page.keyboard.press("Enter")
      break
    case "form":
      await page.$eval("form", (form: HTMLFormElement) => form.submit())
      break
    case "click":
    default:
      // Find and click submit button
      const submitButton = await page.$(
        'button[type="submit"], input[type="submit"], button:has-text("Search"), button:has-text("Find")'
      )
      if (submitButton) {
        await submitButton.click()
      } else {
        // Fallback to Enter key
        await page.keyboard.press("Enter")
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
      const name = await extractFromPage(row as unknown as Frame, searchSelectors.entityName)
      if (!name) continue

      // Extract other fields
      const entityNumber = searchSelectors.entityNumber
        ? await extractFromPage(row as unknown as Frame, searchSelectors.entityNumber)
        : null

      const status = searchSelectors.status
        ? await extractFromPage(row as unknown as Frame, searchSelectors.status)
        : null

      const filingDate = searchSelectors.filingDate
        ? await extractFromPage(row as unknown as Frame, searchSelectors.filingDate)
        : null

      const entityType = searchSelectors.entityType
        ? await extractFromPage(row as unknown as Frame, searchSelectors.entityType)
        : null

      // Get detail link
      let sourceUrl = config.baseUrl
      if (searchSelectors.detailLink) {
        const link = await extractFromPage(row as unknown as Frame, searchSelectors.detailLink)
        if (link) {
          sourceUrl = link.startsWith("http") ? link : `${config.baseUrl}${link}`
        }
      } else if (searchSelectors.entityName.attribute === "href") {
        const link = await extractFromPage(row as unknown as Frame, searchSelectors.entityName)
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

  // Check if Playwright is available
  if (!(await isPlaywrightAvailable())) {
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: "Playwright not installed. Run: npm install playwright-extra puppeteer-extra-plugin-stealth playwright",
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
  const { page, context } = await createStealthPage(browser)

  try {
    // Rate limit
    await rateLimiter.acquire(stateCode)

    // Navigate to search page
    await withRetry(async () => {
      await page.goto(config.scraping!.searchUrl, { waitUntil: "networkidle" })
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
    await closePage(context)
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
  let context: { close: () => Promise<void> } | null = null

  if (existingPage) {
    page = existingPage
  } else {
    if (!(await isPlaywrightAvailable())) {
      throw new Error("Playwright not available")
    }

    const browser = await getStealthBrowser()
    const result = await createStealthPage(browser)
    page = result.page
    context = result.context
  }

  try {
    await page.goto(url, { waitUntil: "networkidle" })
    await humanDelay()

    const { detailSelectors } = config.scraping

    // Extract entity details
    const entityType = detailSelectors.entityType
      ? await extractFromPage(page, detailSelectors.entityType)
      : null

    const entityName = detailSelectors.entityName
      ? await extractFromPage(page, detailSelectors.entityName)
      : null

    const status = detailSelectors.status
      ? await extractFromPage(page, detailSelectors.status)
      : null

    const incorporationDate = detailSelectors.incorporationDate
      ? await extractFromPage(page, detailSelectors.incorporationDate)
      : null

    const registeredAgent = detailSelectors.registeredAgent
      ? await extractFromPage(page, detailSelectors.registeredAgent)
      : null

    const registeredAddress = detailSelectors.registeredAgentAddress
      ? await extractFromPage(page, detailSelectors.registeredAgentAddress)
      : null

    const principalAddress = detailSelectors.principalAddress
      ? await extractFromPage(page, detailSelectors.principalAddress)
      : null

    // Extract officers
    const officers: ScrapedBusinessEntity["officers"] = []

    if (detailSelectors.officerContainer && detailSelectors.officerRows) {
      const officerRows = await page.$$(
        `${detailSelectors.officerContainer} ${detailSelectors.officerRows}`
      )

      for (const row of officerRows) {
        const name = detailSelectors.officerName
          ? await extractFromPage(row as unknown as Frame, detailSelectors.officerName)
          : null

        const position = detailSelectors.officerTitle
          ? await extractFromPage(row as unknown as Frame, detailSelectors.officerTitle)
          : null

        if (name) {
          officers.push({
            name,
            position: position || "Officer",
            startDate: detailSelectors.officerStartDate
              ? await extractFromPage(row as unknown as Frame, detailSelectors.officerStartDate)
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
    if (shouldClosePage && context) {
      await closePage(context)
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
