/**
 * Detail Page Scraper Engine
 *
 * Scrapes entity detail pages for FULL officer/director lists.
 * This is critical because search results only show limited data.
 *
 * Detail pages contain:
 * - Complete officer/director lists with names and titles
 * - Registered agent name and address
 * - Principal business address
 * - Entity type details
 * - Filing history
 *
 * This engine supports both HTTP and browser-based scraping.
 */

import type { StateRegistryConfig, SelectorStrategy, DetailPageSelectors } from "../config/state-template"
import type { ScrapedBusinessEntity } from "../config"
import { getRateLimiter } from "../services/rate-limiter"
import { getCircuitBreaker } from "../services/circuit-breaker"
import { fetchHtml, decodeHtmlEntities, extractWithSelector } from "./http-scraper"
import { isPlaywrightAvailable, getStealthBrowser, createStealthPage, closePage, humanDelay } from "../stealth-browser"

/**
 * Officer/Director extracted from detail page
 */
export interface ExtractedOfficer {
  name: string
  title: string
  address?: string | null
  startDate?: string | null
  endDate?: string | null
}

/**
 * Full entity details from detail page
 */
export interface EntityDetails {
  // Core info
  name?: string | null
  entityType?: string | null
  status?: string | null
  incorporationDate?: string | null
  jurisdictionOfFormation?: string | null

  // Registered agent
  registeredAgent?: string | null
  registeredAgentAddress?: string | null

  // Addresses
  principalAddress?: string | null
  mailingAddress?: string | null

  // Officers (FULL LIST)
  officers: ExtractedOfficer[]

  // Filing history
  filings?: Array<{
    date: string | null
    type: string | null
    description?: string | null
  }>

  // Source
  sourceUrl: string
  scrapedAt: string
}

/**
 * HTTP-based detail page extraction (regex parsing)
 */
async function extractDetailHttp(
  url: string,
  selectors: DetailPageSelectors,
  stateCode: string
): Promise<EntityDetails> {
  const rateLimiter = getRateLimiter()
  await rateLimiter.acquire(stateCode)

  const html = await fetchHtml(url)

  // Extract core info
  const name = selectors.entityName
    ? extractWithSelector(html, selectors.entityName)
    : null

  const entityType = selectors.entityType
    ? extractWithSelector(html, selectors.entityType)
    : null

  const status = selectors.status
    ? extractWithSelector(html, selectors.status)
    : null

  const incorporationDate = selectors.incorporationDate
    ? extractWithSelector(html, selectors.incorporationDate)
    : null

  const jurisdictionOfFormation = selectors.jurisdictionOfFormation
    ? extractWithSelector(html, selectors.jurisdictionOfFormation)
    : null

  // Extract registered agent
  const registeredAgent = selectors.registeredAgent
    ? extractWithSelector(html, selectors.registeredAgent)
    : null

  const registeredAgentAddress = selectors.registeredAgentAddress
    ? extractWithSelector(html, selectors.registeredAgentAddress)
    : null

  // Extract addresses
  const principalAddress = selectors.principalAddress
    ? extractWithSelector(html, selectors.principalAddress)
    : null

  const mailingAddress = selectors.mailingAddress
    ? extractWithSelector(html, selectors.mailingAddress)
    : null

  // Extract officers
  const officers: ExtractedOfficer[] = []

  if (selectors.officerContainer && selectors.officerRows) {
    // Build regex patterns for officer extraction
    const containerPattern = new RegExp(
      `<[^>]*${escapeRegex(selectors.officerContainer)}[^>]*>([\\s\\S]*?)<\\/[^>]+>`,
      "i"
    )

    const containerMatch = containerPattern.exec(html)
    if (containerMatch) {
      const containerHtml = containerMatch[1]

      // Extract individual officer rows
      const rowPattern = new RegExp(
        `<tr[^>]*>([\\s\\S]*?)<\\/tr>`,
        "gi"
      )

      let rowMatch
      while ((rowMatch = rowPattern.exec(containerHtml)) !== null) {
        const rowHtml = rowMatch[1]

        const officerName = selectors.officerName
          ? extractWithSelector(rowHtml, selectors.officerName)
          : null

        const officerTitle = selectors.officerTitle
          ? extractWithSelector(rowHtml, selectors.officerTitle)
          : null

        const officerAddress = selectors.officerAddress
          ? extractWithSelector(rowHtml, selectors.officerAddress)
          : null

        const officerStartDate = selectors.officerStartDate
          ? extractWithSelector(rowHtml, selectors.officerStartDate)
          : null

        if (officerName) {
          officers.push({
            name: officerName,
            title: officerTitle || "Officer",
            address: officerAddress,
            startDate: officerStartDate,
          })
        }
      }
    }
  }

  // Extract filing history
  const filings: EntityDetails["filings"] = []

  if (selectors.filingHistoryContainer && selectors.filingRows) {
    const filingContainerPattern = new RegExp(
      `<[^>]*${escapeRegex(selectors.filingHistoryContainer)}[^>]*>([\\s\\S]*?)<\\/[^>]+>`,
      "i"
    )

    const filingContainerMatch = filingContainerPattern.exec(html)
    if (filingContainerMatch) {
      const filingHtml = filingContainerMatch[1]

      const filingRowPattern = new RegExp(
        `<tr[^>]*>([\\s\\S]*?)<\\/tr>`,
        "gi"
      )

      let filingRowMatch
      while ((filingRowMatch = filingRowPattern.exec(filingHtml)) !== null) {
        const rowHtml = filingRowMatch[1]

        const filingDate = selectors.filingDate
          ? extractWithSelector(rowHtml, selectors.filingDate)
          : null

        const filingType = selectors.filingType
          ? extractWithSelector(rowHtml, selectors.filingType)
          : null

        if (filingDate || filingType) {
          filings.push({
            date: filingDate,
            type: filingType,
          })
        }
      }
    }
  }

  return {
    name,
    entityType,
    status,
    incorporationDate,
    jurisdictionOfFormation,
    registeredAgent,
    registeredAgentAddress,
    principalAddress,
    mailingAddress,
    officers,
    filings: filings.length > 0 ? filings : undefined,
    sourceUrl: url,
    scrapedAt: new Date().toISOString(),
  }
}

/**
 * Browser-based detail page extraction (for JS-heavy pages)
 */
async function extractDetailBrowser(
  url: string,
  selectors: DetailPageSelectors,
  stateCode: string
): Promise<EntityDetails> {
  if (!(await isPlaywrightAvailable())) {
    throw new Error("Playwright not available for browser-based detail scraping")
  }

  const rateLimiter = getRateLimiter()
  await rateLimiter.acquire(stateCode)

  const browser = await getStealthBrowser()
  const { page, context } = await createStealthPage(browser)

  try {
    await page.goto(url, { waitUntil: "networkidle" })
    await humanDelay()

    // Extract core info
    const name = selectors.entityName
      ? await extractFromPageSafe(page, selectors.entityName)
      : null

    const entityType = selectors.entityType
      ? await extractFromPageSafe(page, selectors.entityType)
      : null

    const status = selectors.status
      ? await extractFromPageSafe(page, selectors.status)
      : null

    const incorporationDate = selectors.incorporationDate
      ? await extractFromPageSafe(page, selectors.incorporationDate)
      : null

    const jurisdictionOfFormation = selectors.jurisdictionOfFormation
      ? await extractFromPageSafe(page, selectors.jurisdictionOfFormation)
      : null

    // Extract registered agent
    const registeredAgent = selectors.registeredAgent
      ? await extractFromPageSafe(page, selectors.registeredAgent)
      : null

    const registeredAgentAddress = selectors.registeredAgentAddress
      ? await extractFromPageSafe(page, selectors.registeredAgentAddress)
      : null

    // Extract addresses
    const principalAddress = selectors.principalAddress
      ? await extractFromPageSafe(page, selectors.principalAddress)
      : null

    const mailingAddress = selectors.mailingAddress
      ? await extractFromPageSafe(page, selectors.mailingAddress)
      : null

    // Extract officers
    const officers: ExtractedOfficer[] = []

    if (selectors.officerContainer && selectors.officerRows) {
      const officerElements = await page.$$(`${selectors.officerContainer} ${selectors.officerRows}`)

      for (const element of officerElements) {
        const officerName = selectors.officerName
          ? await extractFromElementSafe(element, selectors.officerName)
          : null

        const officerTitle = selectors.officerTitle
          ? await extractFromElementSafe(element, selectors.officerTitle)
          : null

        const officerAddress = selectors.officerAddress
          ? await extractFromElementSafe(element, selectors.officerAddress)
          : null

        const officerStartDate = selectors.officerStartDate
          ? await extractFromElementSafe(element, selectors.officerStartDate)
          : null

        if (officerName) {
          officers.push({
            name: officerName,
            title: officerTitle || "Officer",
            address: officerAddress,
            startDate: officerStartDate,
          })
        }
      }
    }

    return {
      name,
      entityType,
      status,
      incorporationDate,
      jurisdictionOfFormation,
      registeredAgent,
      registeredAgentAddress,
      principalAddress,
      mailingAddress,
      officers,
      sourceUrl: url,
      scrapedAt: new Date().toISOString(),
    }
  } finally {
    await closePage(context)
  }
}

/**
 * Safe page extraction with error handling
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractFromPageSafe(page: any, selector: SelectorStrategy): Promise<string | null> {
  try {
    const element = await page.$(selector.selector)
    if (!element) {
      // Try fallbacks
      if (selector.fallbacks) {
        for (const fallback of selector.fallbacks) {
          const fallbackEl = await page.$(fallback)
          if (fallbackEl) {
            return extractFromElementSafe(fallbackEl, selector)
          }
        }
      }
      return null
    }
    return extractFromElementSafe(element, selector)
  } catch {
    return null
  }
}

/**
 * Safe element extraction with error handling
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractFromElementSafe(element: any, selector: SelectorStrategy): Promise<string | null> {
  try {
    let value: string | null = null

    if (selector.attribute) {
      value = await element.getAttribute(selector.attribute)
    } else {
      value = await element.textContent()
    }

    if (!value) return null

    value = decodeHtmlEntities(value.trim())

    if (selector.regex) {
      const match = selector.regex.exec(value)
      value = match ? (match[1] || match[0]) : null
    }

    if (value && selector.transform) {
      value = selector.transform(value)
    }

    return value
  } catch {
    return null
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Scrape entity detail page
 */
export async function scrapeDetailPage(
  url: string,
  config: StateRegistryConfig,
  options: {
    useBrowser?: boolean
    skipCircuitBreaker?: boolean
  } = {}
): Promise<EntityDetails> {
  const { useBrowser = false, skipCircuitBreaker = false } = options

  if (!config.scraping?.detailSelectors) {
    throw new Error(`No detail page selectors configured for ${config.stateCode}`)
  }

  const circuitBreaker = getCircuitBreaker()

  // Check circuit breaker
  if (!skipCircuitBreaker && !circuitBreaker.isAllowed(config.stateCode)) {
    throw new Error(`Circuit breaker OPEN for ${config.stateCode}`)
  }

  try {
    let details: EntityDetails

    if (useBrowser || config.scraping.jsRequired) {
      details = await extractDetailBrowser(url, config.scraping.detailSelectors, config.stateCode)
    } else {
      // Try HTTP first, fall back to browser
      try {
        details = await extractDetailHttp(url, config.scraping.detailSelectors, config.stateCode)
      } catch (httpError) {
        console.log(`[Detail Scraper] HTTP failed for ${url}, trying browser...`)
        details = await extractDetailBrowser(url, config.scraping.detailSelectors, config.stateCode)
      }
    }

    circuitBreaker.recordSuccess(config.stateCode)
    return details
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    circuitBreaker.recordFailure(config.stateCode, errorMessage)
    throw error
  }
}

/**
 * Merge detail page data into existing entity
 */
export function mergeEntityDetails(
  entity: ScrapedBusinessEntity,
  details: EntityDetails
): ScrapedBusinessEntity {
  return {
    ...entity,
    // Override with detail page data if available
    name: details.name || entity.name,
    entityType: details.entityType || entity.entityType,
    status: details.status || entity.status,
    incorporationDate: details.incorporationDate || entity.incorporationDate,
    registeredAgent: details.registeredAgent || entity.registeredAgent,
    registeredAddress: details.registeredAgentAddress || details.principalAddress || entity.registeredAddress,
    officers: details.officers.length > 0
      ? details.officers.map(o => ({
          name: o.name,
          position: o.title,
          startDate: o.startDate,
          endDate: o.endDate,
        }))
      : entity.officers,
    sourceUrl: details.sourceUrl || entity.sourceUrl,
    scrapedAt: new Date().toISOString(),
  }
}

/**
 * Enrich multiple entities with detail page data
 */
export async function enrichEntitiesWithDetails(
  entities: ScrapedBusinessEntity[],
  config: StateRegistryConfig,
  options: {
    maxConcurrent?: number
    delayBetweenMs?: number
    useBrowser?: boolean
    onProgress?: (completed: number, total: number) => void
  } = {}
): Promise<ScrapedBusinessEntity[]> {
  const {
    maxConcurrent = 3,
    delayBetweenMs = 1000,
    useBrowser = false,
    onProgress,
  } = options

  if (!config.scraping?.detailSelectors) {
    console.log(`[Detail Scraper] No detail selectors for ${config.stateCode}, returning unchanged`)
    return entities
  }

  const results: ScrapedBusinessEntity[] = []
  let completed = 0

  // Process in batches
  for (let i = 0; i < entities.length; i += maxConcurrent) {
    const batch = entities.slice(i, i + maxConcurrent)

    const batchResults = await Promise.all(
      batch.map(async (entity) => {
        try {
          const details = await scrapeDetailPage(entity.sourceUrl, config, { useBrowser })
          completed++
          onProgress?.(completed, entities.length)
          return mergeEntityDetails(entity, details)
        } catch (error) {
          console.warn(`[Detail Scraper] Failed to enrich ${entity.sourceUrl}:`, error)
          completed++
          onProgress?.(completed, entities.length)
          return entity // Return original on failure
        }
      })
    )

    results.push(...batchResults)

    // Delay between batches
    if (i + maxConcurrent < entities.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenMs))
    }
  }

  return results
}
