/**
 * HTTP Scraper Engine (Tier 2)
 *
 * Handles states with simple HTML pages that don't require JavaScript rendering.
 * Uses fetch + HTML parsing (regex or DOM parser) instead of a browser.
 *
 * This is faster and cheaper than browser-based scraping.
 *
 * Tier 2 States (37 states):
 * PA, IL, NC, SC, OH, MN, TN, KY, LA, NV, AZ, OR, ID, MT, WY, UT, NM,
 * CT, MD, NJ, VT, NH, MA, RI, ME, GA, AL, MS, AR, OK, KS, NE, ND, SD,
 * MO, WV, AK, HI
 */

import type { StateRegistryConfig, SelectorStrategy } from "../config/state-template"
import type { ScrapedBusinessEntity, ScraperResult } from "../config"
import { getRateLimiter } from "../services/rate-limiter"
import { getCircuitBreaker } from "../services/circuit-breaker"
import { getScraperCache } from "../services/cache"

/**
 * Browser-like headers for HTTP requests
 */
const HTTP_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
}

/**
 * Decode HTML entities
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

/**
 * Extract text using a selector strategy (regex-based for HTTP scraping)
 */
export function extractWithSelector(
  html: string,
  selector: SelectorStrategy
): string | null {
  // If selector has a regex, use it directly
  if (selector.regex) {
    const match = selector.regex.exec(html)
    if (match) {
      let value = match[1] || match[0]
      if (selector.transform) {
        value = selector.transform(value)
      }
      return decodeHtmlEntities(value.trim())
    }
    return null
  }

  // Convert CSS selector to a simple regex pattern
  // This is a simplified approach - works for basic selectors
  const selectorPattern = cssToRegex(selector.selector)
  const match = selectorPattern.exec(html)

  if (match) {
    let value = match[1] || match[0]
    if (selector.transform) {
      value = selector.transform(value)
    }
    return decodeHtmlEntities(value.trim())
  }

  // Try fallback selectors
  if (selector.fallbacks) {
    for (const fallback of selector.fallbacks) {
      const fallbackPattern = cssToRegex(fallback)
      const fallbackMatch = fallbackPattern.exec(html)
      if (fallbackMatch) {
        let value = fallbackMatch[1] || fallbackMatch[0]
        if (selector.transform) {
          value = selector.transform(value)
        }
        return decodeHtmlEntities(value.trim())
      }
    }
  }

  return null
}

/**
 * Convert a simple CSS selector to a regex pattern
 * Note: This is a simplified implementation for common patterns
 */
function cssToRegex(selector: string): RegExp {
  // Handle common patterns
  const patterns: Record<string, (sel: string) => RegExp> = {
    // ID selector: #id
    "^#": (sel) => {
      const id = sel.slice(1)
      return new RegExp(`id=["']${id}["'][^>]*>([^<]+)`, "i")
    },
    // Class selector: .class
    "^\\.": (sel) => {
      const className = sel.slice(1)
      return new RegExp(`class=["'][^"']*${className}[^"']*["'][^>]*>([^<]+)`, "i")
    },
    // Attribute selector: [attr="value"]
    "^\\[": (sel) => {
      const match = sel.match(/\[([^\]]+)\]/)
      if (match) {
        const attr = match[1].replace("=", '=["\']*').replace(/["']/g, "") + "[\"']*"
        return new RegExp(`${attr}[^>]*>([^<]+)`, "i")
      }
      return new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    },
    // td:nth-child(n)
    "td:nth-child": (sel) => {
      const match = sel.match(/td:nth-child\((\d+)\)/)
      if (match) {
        const n = parseInt(match[1])
        // Match the nth <td> in a row
        const tdPattern = "<td[^>]*>([^<]*)</td>"
        const pattern = Array(n).fill(tdPattern).join("\\s*")
        return new RegExp(pattern, "i")
      }
      return new RegExp("<td[^>]*>([^<]*)</td>", "i")
    },
    // Element with class: element.class
    "\\w+\\.": (sel) => {
      const [tag, className] = sel.split(".")
      return new RegExp(`<${tag}[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([^<]+)`, "i")
    },
  }

  // Find matching pattern
  for (const [pattern, fn] of Object.entries(patterns)) {
    if (new RegExp(pattern).test(selector)) {
      return fn(selector)
    }
  }

  // Default: treat as tag name
  const tag = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "gi")
}

/**
 * Extract all matches from HTML using a row pattern
 */
export function extractRows(
  html: string,
  rowSelector: string
): string[] {
  const rows: string[] = []

  // Common row patterns
  const patterns: Record<string, RegExp> = {
    "tr": /<tr[^>]*>([\s\S]*?)<\/tr>/gi,
    ".": new RegExp(`<[^>]*class=["'][^"']*${rowSelector.slice(1)}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "gi"),
    "#": new RegExp(`<[^>]*id=["']${rowSelector.slice(1)}["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "gi"),
  }

  const key = rowSelector.startsWith(".") ? "." : rowSelector.startsWith("#") ? "#" : rowSelector.toLowerCase()
  const pattern = patterns[key] || patterns["tr"]

  let match
  while ((match = pattern.exec(html)) !== null) {
    rows.push(match[0])
  }

  return rows
}

/**
 * Fetch HTML page with retries
 */
export async function fetchHtml(
  url: string,
  options: {
    method?: "GET" | "POST"
    headers?: Record<string, string>
    body?: string | URLSearchParams
    timeout?: number
    maxRetries?: number
    retryDelay?: number
  } = {}
): Promise<string> {
  const {
    method = "GET",
    headers = {},
    body,
    timeout = 30000,
    maxRetries = 3,
    retryDelay = 2000,
  } = options

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...HTTP_HEADERS,
          ...headers,
          ...(body instanceof URLSearchParams ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        body: body?.toString(),
        signal: controller.signal,
        redirect: "follow",
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const html = await response.text()

      // Check for blocking
      if (html.toLowerCase().includes("captcha") || html.toLowerCase().includes("challenge-form")) {
        throw new Error("CAPTCHA detected, need browser-based scraping")
      }

      return html
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        console.log(`[HTTP Scraper] Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }
  }

  throw lastError || new Error("Failed after retries")
}

/**
 * Parse search results from HTML
 */
export interface HtmlParseConfig {
  /** Row selector for result items */
  rowSelector: string
  /** Mapping of field names to selectors within each row */
  fieldSelectors: {
    name: SelectorStrategy
    entityNumber?: SelectorStrategy
    status?: SelectorStrategy
    filingDate?: SelectorStrategy
    entityType?: SelectorStrategy
    detailLink?: SelectorStrategy
  }
  /** Base URL for relative links */
  baseUrl: string
  /** Source identifier */
  source: string
}

/**
 * Parse HTML search results into ScrapedBusinessEntity array
 */
export function parseHtmlResults(
  html: string,
  config: HtmlParseConfig
): ScrapedBusinessEntity[] {
  const results: ScrapedBusinessEntity[] = []
  const rows = extractRows(html, config.rowSelector)

  for (const rowHtml of rows) {
    try {
      const name = extractWithSelector(rowHtml, config.fieldSelectors.name)
      if (!name) continue

      const entityNumber = config.fieldSelectors.entityNumber
        ? extractWithSelector(rowHtml, config.fieldSelectors.entityNumber)
        : null

      const status = config.fieldSelectors.status
        ? extractWithSelector(rowHtml, config.fieldSelectors.status)
        : null

      const filingDate = config.fieldSelectors.filingDate
        ? extractWithSelector(rowHtml, config.fieldSelectors.filingDate)
        : null

      const entityType = config.fieldSelectors.entityType
        ? extractWithSelector(rowHtml, config.fieldSelectors.entityType)
        : null

      let sourceUrl = config.baseUrl
      if (config.fieldSelectors.detailLink) {
        const link = extractWithSelector(rowHtml, config.fieldSelectors.detailLink)
        if (link) {
          sourceUrl = link.startsWith("http") ? link : `${config.baseUrl}${link}`
        }
      }

      results.push({
        name,
        entityNumber,
        jurisdiction: `us_${config.source}`,
        status,
        incorporationDate: filingDate,
        entityType,
        registeredAddress: null,
        registeredAgent: null,
        sourceUrl,
        source: config.source as ScrapedBusinessEntity["source"],
        scrapedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.warn("[HTTP Scraper] Failed to parse row:", error)
    }
  }

  return results
}

/**
 * HTTP-based scraper for Tier 2 states
 */
export async function scrapeHttpState(
  stateCode: string,
  config: StateRegistryConfig,
  query: string,
  options: {
    limit?: number
    parseConfig: HtmlParseConfig
  }
): Promise<ScraperResult<ScrapedBusinessEntity>> {
  const startTime = Date.now()
  const { limit = 25, parseConfig } = options

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

  const rateLimiter = getRateLimiter()
  const circuitBreaker = getCircuitBreaker()
  const cache = getScraperCache()

  // Check cache
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

  try {
    // Rate limit
    await rateLimiter.acquire(stateCode)

    // Build search URL
    let searchUrl = config.scraping.searchUrl
    if (searchUrl.includes("{query}")) {
      searchUrl = searchUrl.replace("{query}", encodeURIComponent(query))
    } else {
      const urlObj = new URL(searchUrl)
      urlObj.searchParams.set("q", query)
      urlObj.searchParams.set("search", query)
      searchUrl = urlObj.toString()
    }

    // Fetch HTML
    const html = await fetchHtml(searchUrl)

    // Parse results
    const results = parseHtmlResults(html, parseConfig)
    const limitedResults = results.slice(0, limit)

    // Record success
    circuitBreaker.recordSuccess(stateCode)

    // Cache results
    await cache.set(stateCode, query, limitedResults, results.length, { limit })

    return {
      success: true,
      data: limitedResults,
      totalFound: results.length,
      source: stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    circuitBreaker.recordFailure(stateCode, errorMessage)

    // If CAPTCHA detected, suggest browser fallback
    const warnings = errorMessage.includes("CAPTCHA")
      ? ["CAPTCHA detected. Use browser-based scraping for this state."]
      : undefined

    return {
      success: false,
      data: [],
      totalFound: 0,
      source: stateCode as ScrapedBusinessEntity["source"],
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: errorMessage,
      warnings,
    }
  }
}

/**
 * Build form data for POST requests
 */
export function buildFormData(
  fields: { name: string; value: string | ((query: string) => string) }[],
  query: string
): URLSearchParams {
  const formData = new URLSearchParams()

  for (const field of fields) {
    const value = typeof field.value === "function" ? field.value(query) : field.value
    formData.append(field.name, value)
  }

  return formData
}
