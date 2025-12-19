/**
 * Delaware Division of Corporations (ICIS) Scraper
 *
 * Scrapes business entity data from icis.corp.delaware.gov
 *
 * Features:
 * - Search by entity name
 * - Search by file number
 * - Free search (basic info only)
 *
 * Delaware is the most important jurisdiction for corporate searches as it
 * hosts 65% of Fortune 500 companies and 1.1 million+ entities.
 *
 * URL: https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx
 *
 * NOTE: Delaware frequently shows CAPTCHA (hCaptcha).
 * When CAPTCHA is detected, returns partial success with manual search link.
 * The scraper uses exponential backoff retry logic (3 attempts).
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

// CAPTCHA retry settings
const CAPTCHA_MAX_RETRIES = 3
const CAPTCHA_RETRY_DELAY_MS = 2000

/**
 * Normalize status values to consistent format
 */
function normalizeStatus(status: string | null): string | null {
  if (!status) return null
  const normalized = status.trim().toLowerCase()

  const statusMap: Record<string, string> = {
    "good standing": "Active",
    "active": "Active",
    "good": "Active",
    "void": "Void",
    "voided": "Void",
    "cancelled": "Cancelled",
    "canceled": "Cancelled",
    "forfeited": "Forfeited",
    "revoked": "Revoked",
    "dissolved": "Dissolved",
    "inactive": "Inactive",
    "merged out": "Merged",
    "converted out": "Converted",
    "pending": "Pending",
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(statusMap)) {
    if (normalized.includes(key)) {
      return value
    }
  }

  // Return original if no match (capitalize first letter)
  return status.trim().charAt(0).toUpperCase() + status.trim().slice(1).toLowerCase()
}

/**
 * Normalize date to ISO8601 format (YYYY-MM-DD)
 */
function normalizeDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  const trimmed = dateStr.trim()
  if (!trimmed) return null

  try {
    // Try parsing various formats
    // MM/DD/YYYY
    const usFormat = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (usFormat) {
      const [, month, day, year] = usFormat
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    }

    // YYYY-MM-DD (already ISO)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed
    }

    // Try Date parsing as fallback
    const parsed = new Date(trimmed)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0]
    }
  } catch {
    // Return null on parse failure
  }

  return null
}

/**
 * Validate Delaware file number format
 * Delaware file numbers are typically 7 digits
 */
function validateFileNumber(fileNumber: string | null): string | null {
  if (!fileNumber) return null
  const cleaned = fileNumber.trim().replace(/\D/g, "")
  // Delaware file numbers are typically 7 digits, but can vary
  if (cleaned.length >= 4 && cleaned.length <= 10) {
    return cleaned
  }
  return fileNumber.trim() // Return original if doesn't match expected format
}

/**
 * Search Delaware businesses by name
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
        "Install Playwright: npm install playwright-extra puppeteer-extra-plugin-stealth playwright",
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

    // Check for CAPTCHA with retry logic
    let captchaDetected = false
    let captchaAttempt = 0

    const checkForCaptcha = async (): Promise<boolean> => {
      const content = await page.content()
      return content.includes("hcaptcha") || content.includes("captcha") || content.includes("h-captcha")
    }

    // Initial CAPTCHA check
    if (await checkForCaptcha()) {
      console.log("[Delaware Scraper] CAPTCHA detected on initial load")
      captchaDetected = true

      // Retry with exponential backoff
      while (captchaAttempt < CAPTCHA_MAX_RETRIES && captchaDetected) {
        captchaAttempt++
        const delay = CAPTCHA_RETRY_DELAY_MS * Math.pow(2, captchaAttempt - 1)
        console.log(`[Delaware Scraper] CAPTCHA retry ${captchaAttempt}/${CAPTCHA_MAX_RETRIES} after ${delay}ms`)

        await new Promise(resolve => setTimeout(resolve, delay))

        // Close and recreate page for fresh session
        await closePage(context)
        const newSession = await createStealthPage(browser)
        Object.assign(page, newSession.page)

        await page.goto(CONFIG.searchUrl, { waitUntil: "networkidle" })
        await humanDelay()

        captchaDetected = await checkForCaptcha()
        if (!captchaDetected) {
          console.log(`[Delaware Scraper] CAPTCHA cleared on retry ${captchaAttempt}`)
        }
      }

      // If still CAPTCHA after retries, return with helpful info
      if (captchaDetected) {
        console.log("[Delaware Scraper] CAPTCHA persists after all retries")
        return {
          success: false,
          data: [],
          totalFound: 0,
          source: "delaware",
          query,
          scrapedAt: new Date().toISOString(),
          duration: Date.now() - startTime,
          error: "CAPTCHA_DETECTED",
          warnings: [
            "⚠️ Delaware requires CAPTCHA verification",
            `Attempted ${CAPTCHA_MAX_RETRIES} retries with exponential backoff`,
            "Manual search required - please visit the link below:",
            `🔗 ${CONFIG.searchUrl}`,
            "Tip: Delaware is most accessible during off-peak hours (late night/early morning EST)",
          ],
        }
      }
    }

    // Fill in search form - use correct ASP.NET selectors
    // Delaware uses naming like ctl00_ContentPlaceHolder1_frmEntityName
    const searchInputSelector = "#ctl00_ContentPlaceHolder1_frmEntityName"
    const submitButtonSelector = "#ctl00_ContentPlaceHolder1_btnSubmit"

    // Wait for form elements
    console.log("[Delaware Scraper] Using search input:", searchInputSelector)
    await page.waitForSelector(searchInputSelector, { timeout: 10000 })

    // Enter search query with human-like typing
    await humanType(page, searchInputSelector, query)
    await humanDelay()

    // Click search button
    console.log("[Delaware Scraper] Clicking search button:", submitButtonSelector)
    await page.click(submitButtonSelector)

    // Wait for results - Delaware can be slow
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => null)
    await humanDelay()

    // Try multiple selectors for results
    const resultSelectors = [
      "table[id*='Results']",
      "table.rgMasterTable",
      "#ctl00_ContentPlaceHolder1_rptSearchResults",
      "table",
    ]

    let resultsFound = false
    for (const selector of resultSelectors) {
      const exists = await page.$(selector)
      if (exists) {
        console.log("[Delaware Scraper] Found results with selector:", selector)
        resultsFound = true
        break
      }
    }

    if (!resultsFound) {
      const noResultsText = await page.textContent("body")
      if (noResultsText?.includes("No records found") || noResultsText?.includes("0 records")) {
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
    }

    // Parse results - Delaware has a simple table structure
    const rows = await page.$$("table[id*='Results'] tr")
    console.log(`[Delaware Scraper] Found ${rows.length} results with selector: table[id*='Results'] tr`)

    const businesses: ScrapedBusinessEntity[] = []
    let totalParsed = 0

    // Skip header row, parse data rows
    const dataRows = rows.slice(1) // Skip header
    console.log(`[Delaware Scraper] Parsing ${dataRows.length} data rows`)

    for (const row of dataRows) {
      if (businesses.length >= limit) break

      try {
        const cells = await row.$$("td")
        if (cells.length < 2) continue

        // Delaware table structure (7 columns when available):
        // Column 0: File Number
        // Column 1: Entity Name
        // Column 2: Incorporation/Formation Date
        // Column 3: (Reserved/Unknown)
        // Column 4: Entity Type (Corporation, LLC, LP, etc.)
        // Column 5: (Reserved/Unknown)
        // Column 6: Status (Good Standing, Void, etc.)

        const fileNumberRaw = await cells[0]?.textContent()
        const entityName = await cells[1]?.textContent()
        const incorporationDateRaw = cells.length > 2 ? await cells[2]?.textContent() : null
        const entityTypeRaw = cells.length > 4 ? await cells[4]?.textContent() : null
        const statusRaw = cells.length > 6 ? await cells[6]?.textContent() : null

        // Validate and normalize extracted data
        const fileNumber = validateFileNumber(fileNumberRaw)
        const incorporationDate = normalizeDate(incorporationDateRaw)
        const status = normalizeStatus(statusRaw)
        const entityType = entityTypeRaw?.trim() || null

        if (entityName?.trim()) {
          businesses.push({
            name: entityName.trim(),
            entityNumber: fileNumber,
            jurisdiction: "us_de",
            status: status,
            incorporationDate: incorporationDate,
            entityType: entityType,
            registeredAddress: null,
            registeredAgent: null,
            sourceUrl: CONFIG.searchUrl,
            source: "delaware",
            scrapedAt: new Date().toISOString(),
          })
          totalParsed++

          // Log first few extracted for debugging
          if (totalParsed <= 3) {
            console.log(`[Delaware Scraper] Extracted: ${entityName.trim()} | Type: ${entityType} | Status: ${status} | Date: ${incorporationDate}`)
          }
        }
      } catch (err) {
        // Continue with next row
        continue
      }
    }

    console.log(`[Delaware Scraper] Successfully parsed ${businesses.length} businesses`)

    return {
      success: true,
      data: businesses,
      totalFound: totalParsed,
      source: "delaware",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    }
  } catch (error) {
    console.error("[Delaware Scraper] Error:", error)
    return {
      success: false,
      data: [],
      totalFound: 0,
      source: "delaware",
      query,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    await closePage(context)
  }
}
