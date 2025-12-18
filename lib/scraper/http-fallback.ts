/**
 * HTTP Fallback Module
 *
 * Attempts to scrape OpenCorporates using simple HTTP requests before
 * falling back to Playwright. This is faster and less likely to be blocked.
 *
 * Strategy:
 * 1. Use fetch with proper browser-like headers
 * 2. Parse HTML with regex (no browser needed)
 * 3. Falls back to Playwright if blocked
 */

import { type ScrapedBusinessEntity, type ScrapedOfficer } from "./config"

// Randomized user agents to rotate
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
]

// Get random user agent
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

// Browser-like headers
function getBrowserHeaders(): HeadersInit {
  return {
    "User-Agent": getRandomUserAgent(),
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  }
}

/**
 * Parse company results from HTML using regex
 */
function parseCompaniesFromHtml(html: string): Partial<ScrapedBusinessEntity>[] {
  const companies: Partial<ScrapedBusinessEntity>[] = []

  // Pattern 1: Search result items (most common)
  // Looking for patterns like: <a href="/companies/us_ca/12345">Company Name</a>
  const companyLinkPattern =
    /<a[^>]*href="(\/companies\/([a-z]{2}_[a-z]{2,3})\/([^"]+))"[^>]*>([^<]+)<\/a>/gi
  let match

  while ((match = companyLinkPattern.exec(html)) !== null) {
    const [, url, jurisdiction, entityNumber, name] = match

    // Skip navigation links and pagination
    if (name.toLowerCase().includes("next") || name.toLowerCase().includes("prev")) continue
    if (url.includes("page=") || url.includes("sort=")) continue

    companies.push({
      name: decodeHtmlEntities(name.trim()),
      entityNumber: entityNumber || null,
      jurisdiction: jurisdiction || "unknown",
      status: null, // Will try to extract separately
      incorporationDate: null,
      entityType: null,
      registeredAddress: null,
      registeredAgent: null,
      sourceUrl: `https://opencorporates.com${url}`,
      source: "opencorporates",
      scrapedAt: new Date().toISOString(),
    })
  }

  // Try to extract additional info from the surrounding context
  // Look for status badges
  const statusPattern =
    /<span[^>]*class="[^"]*status[^"]*"[^>]*>([^<]+)<\/span>/gi
  const statuses: string[] = []
  while ((match = statusPattern.exec(html)) !== null) {
    statuses.push(match[1].trim())
  }

  // Look for incorporation dates
  const datePattern =
    /<span[^>]*class="[^"]*(?:inc|date|incorporation)[^"]*"[^>]*>([^<]+)<\/span>/gi
  const dates: string[] = []
  while ((match = datePattern.exec(html)) !== null) {
    dates.push(match[1].trim())
  }

  // Assign statuses and dates to companies (best effort)
  companies.forEach((company, i) => {
    if (statuses[i]) {
      company.status = normalizeStatus(statuses[i])
    }
    if (dates[i]) {
      company.incorporationDate = dates[i]
    }
  })

  return companies
}

/**
 * Parse officer results from HTML using regex
 */
function parseOfficersFromHtml(html: string): Partial<ScrapedOfficer>[] {
  const officers: Partial<ScrapedOfficer>[] = []

  // Pattern: Look for officer links with company association
  // <a href="/officers/123">Officer Name</a> ... <a href="/companies/us_ca/456">Company Name</a>
  const officerPattern =
    /<a[^>]*href="(\/officers\/[^"]+)"[^>]*>([^<]+)<\/a>/gi
  const companyPattern =
    /<a[^>]*href="(\/companies\/([a-z]{2}_[a-z]{2,3})\/([^"]+))"[^>]*>([^<]+)<\/a>/gi

  let match
  const officerMatches: Array<{ name: string; url: string }> = []
  const companyMatches: Array<{
    url: string
    jurisdiction: string
    number: string
    name: string
  }> = []

  while ((match = officerPattern.exec(html)) !== null) {
    officerMatches.push({
      url: match[1],
      name: decodeHtmlEntities(match[2].trim()),
    })
  }

  while ((match = companyPattern.exec(html)) !== null) {
    companyMatches.push({
      url: match[1],
      jurisdiction: match[2],
      number: match[3],
      name: decodeHtmlEntities(match[4].trim()),
    })
  }

  // Try to match officers with companies (they appear in sequence)
  for (let i = 0; i < officerMatches.length && i < companyMatches.length; i++) {
    const officer = officerMatches[i]
    const company = companyMatches[i]

    officers.push({
      name: officer.name,
      position: "Officer", // Default, will try to extract separately
      companyName: company.name,
      companyNumber: company.number,
      jurisdiction: company.jurisdiction,
      startDate: null,
      endDate: null,
      current: true,
      sourceUrl: `https://opencorporates.com${company.url}`,
      source: "opencorporates",
      scrapedAt: new Date().toISOString(),
    })
  }

  // Try to extract positions
  const positionPattern =
    /<span[^>]*class="[^"]*(?:position|role)[^"]*"[^>]*>([^<]+)<\/span>/gi
  const positions: string[] = []
  while ((match = positionPattern.exec(html)) !== null) {
    positions.push(match[1].trim())
  }

  officers.forEach((officer, i) => {
    if (positions[i]) {
      officer.position = positions[i]
    }
  })

  return officers
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
 * Check if response indicates blocking
 */
function isBlocked(html: string): { blocked: boolean; reason?: string } {
  const lowerHtml = html.toLowerCase()

  // Rate limiting
  if (lowerHtml.includes("rate limit") || lowerHtml.includes("too many requests")) {
    return { blocked: true, reason: "rate_limit" }
  }

  // CAPTCHA detection - OpenCorporates uses HAProxy + hCaptcha
  if (lowerHtml.includes("captcha") || lowerHtml.includes("challenge")) {
    return { blocked: true, reason: "captcha" }
  }
  if (lowerHtml.includes("haproxy") && lowerHtml.includes("hcaptcha")) {
    return { blocked: true, reason: "hcaptcha" }
  }
  if (lowerHtml.includes("h-captcha") || lowerHtml.includes("hcaptcha.com")) {
    return { blocked: true, reason: "hcaptcha" }
  }
  if (lowerHtml.includes("verify you are human")) {
    return { blocked: true, reason: "human_verification" }
  }

  // Access denied
  if (lowerHtml.includes("access denied") || lowerHtml.includes("forbidden")) {
    return { blocked: true, reason: "access_denied" }
  }

  // Cloudflare protection
  if (lowerHtml.includes("cloudflare") && lowerHtml.includes("checking your browser")) {
    return { blocked: true, reason: "cloudflare" }
  }
  if (lowerHtml.includes("cf-browser-verification") || lowerHtml.includes("cf_chl_prog")) {
    return { blocked: true, reason: "cloudflare" }
  }

  return { blocked: false }
}

/**
 * Fetch OpenCorporates companies via HTTP
 */
export async function fetchOpenCorporatesCompaniesHttp(
  query: string,
  options: {
    jurisdiction?: string
    includeInactive?: boolean
    limit?: number
  } = {}
): Promise<{
  success: boolean
  data: Partial<ScrapedBusinessEntity>[]
  blocked?: boolean
  reason?: string
  error?: string
}> {
  const { jurisdiction, includeInactive = false } = options

  try {
    // Build search URL
    const params = new URLSearchParams({ q: query })
    if (jurisdiction) {
      params.append("jurisdiction_code", jurisdiction)
    }
    if (!includeInactive) {
      params.append("inactive", "false")
    }

    const searchUrl = `https://opencorporates.com/companies?${params.toString()}`
    console.log("[HTTP Fallback] Fetching:", searchUrl)

    // Make the request
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: getBrowserHeaders(),
      redirect: "follow",
    })

    if (!response.ok) {
      if (response.status === 403) {
        return { success: false, data: [], blocked: true, reason: "forbidden" }
      }
      if (response.status === 429) {
        return { success: false, data: [], blocked: true, reason: "rate_limit" }
      }
      return { success: false, data: [], error: `HTTP ${response.status}` }
    }

    const html = await response.text()

    // Check for blocking
    const blockCheck = isBlocked(html)
    if (blockCheck.blocked) {
      console.log("[HTTP Fallback] Blocked:", blockCheck.reason)
      return { success: false, data: [], blocked: true, reason: blockCheck.reason }
    }

    // Parse companies from HTML
    const companies = parseCompaniesFromHtml(html)
    console.log(`[HTTP Fallback] Parsed ${companies.length} companies`)

    // Apply limit
    const limitedCompanies = options.limit ? companies.slice(0, options.limit) : companies

    return { success: true, data: limitedCompanies }
  } catch (error) {
    console.error("[HTTP Fallback] Error:", error)
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Fetch OpenCorporates officers via HTTP
 */
export async function fetchOpenCorporatesOfficersHttp(
  query: string,
  options: {
    jurisdiction?: string
    currentOnly?: boolean
    limit?: number
  } = {}
): Promise<{
  success: boolean
  data: Partial<ScrapedOfficer>[]
  blocked?: boolean
  reason?: string
  error?: string
}> {
  const { jurisdiction, currentOnly = false } = options

  try {
    // Build search URL
    const params = new URLSearchParams({ q: query })
    if (jurisdiction) {
      params.append("jurisdiction_code", jurisdiction)
    }
    if (currentOnly) {
      params.append("current", "true")
    }

    const searchUrl = `https://opencorporates.com/officers?${params.toString()}`
    console.log("[HTTP Fallback] Fetching officers:", searchUrl)

    // Make the request
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: getBrowserHeaders(),
      redirect: "follow",
    })

    if (!response.ok) {
      if (response.status === 403) {
        return { success: false, data: [], blocked: true, reason: "forbidden" }
      }
      if (response.status === 429) {
        return { success: false, data: [], blocked: true, reason: "rate_limit" }
      }
      return { success: false, data: [], error: `HTTP ${response.status}` }
    }

    const html = await response.text()

    // Check for blocking
    const blockCheck = isBlocked(html)
    if (blockCheck.blocked) {
      console.log("[HTTP Fallback] Blocked:", blockCheck.reason)
      return { success: false, data: [], blocked: true, reason: blockCheck.reason }
    }

    // Parse officers from HTML
    const officers = parseOfficersFromHtml(html)
    console.log(`[HTTP Fallback] Parsed ${officers.length} officers`)

    // Apply limit
    const limitedOfficers = options.limit ? officers.slice(0, options.limit) : officers

    return { success: true, data: limitedOfficers }
  } catch (error) {
    console.error("[HTTP Fallback] Error:", error)
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Check if HTTP fallback is likely to work
 * (Quick health check)
 */
export async function checkHttpFallbackHealth(): Promise<boolean> {
  try {
    const response = await fetch("https://opencorporates.com/", {
      method: "GET",
      headers: getBrowserHeaders(),
    })

    if (!response.ok) return false

    const html = await response.text()
    return !isBlocked(html).blocked
  } catch {
    return false
  }
}
