/**
 * Prospect Report PDF Generator
 *
 * Converts prospect report data to PDF using Puppeteer.
 * Uses the exact HTML/CSS styling from the Rōmy brand template.
 */

import type { Browser, Page } from "puppeteer-core"
import { generateProspectReportHtml, type ProspectReportData } from "./template"

// Lazy-loaded modules (only load when needed)
let chromium: typeof import("@sparticuz/chromium") | null = null
let puppeteerCore: typeof import("puppeteer-core") | null = null

/**
 * Lazy load puppeteer-core and @sparticuz/chromium
 */
async function loadPuppeteer() {
  if (!puppeteerCore || !chromium) {
    try {
      const chromiumModule = "@sparticuz/chromium"
      const puppeteerModule = "puppeteer-core"
      chromium = await import(chromiumModule)
      puppeteerCore = await import(puppeteerModule)
    } catch (error) {
      throw new Error(
        `Failed to load puppeteer-core or @sparticuz/chromium: ${error instanceof Error ? error.message : String(error)}. ` +
          "Run: npm install puppeteer-core @sparticuz/chromium"
      )
    }
  }
  return { chromium, puppeteerCore }
}

/**
 * Check if running in serverless environment
 */
function isServerless(): boolean {
  return !!(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY
  )
}

/**
 * Create a browser instance for PDF generation
 */
async function createPdfBrowser(): Promise<Browser> {
  const { chromium: chr, puppeteerCore: pptr } = await loadPuppeteer()

  if (!chr || !pptr) {
    throw new Error("Failed to load puppeteer dependencies")
  }

  // Get executable path - different for serverless vs local
  let executablePath: string

  if (isServerless()) {
    executablePath = await chr.default.executablePath()
  } else {
    // Local development: try to find Chrome installation
    const possiblePaths = [
      // macOS
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      // Linux
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      // Windows
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ]

    const fs = await import("fs")
    executablePath =
      possiblePaths.find((p) => {
        try {
          return fs.existsSync(p)
        } catch {
          return false
        }
      }) || (await chr.default.executablePath())
  }

  // Launch browser with minimal args for PDF generation
  const browser = await pptr.default.launch({
    executablePath,
    headless: true,
    args: isServerless()
      ? [...chr.default.args, "--disable-dev-shm-usage"]
      : [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--no-zygote",
        ],
    defaultViewport: { width: 1200, height: 1600 },
  })

  return browser
}

// ============================================================================
// PDF GENERATION
// ============================================================================

export interface GeneratePdfOptions {
  /** Report data to render */
  data: ProspectReportData
  /** Paper format (default: Letter) */
  format?: "Letter" | "A4"
  /** Print background graphics (default: true) */
  printBackground?: boolean
}

export interface GeneratePdfResult {
  /** PDF as Buffer */
  buffer: Buffer
  /** Filename suggestion */
  filename: string
}

/**
 * Generate a PDF from prospect report data
 */
export async function generateProspectPdf(
  options: GeneratePdfOptions
): Promise<GeneratePdfResult> {
  const { data, format = "Letter", printBackground = true } = options

  let browser: Browser | null = null
  let page: Page | null = null

  try {
    // Create browser
    browser = await createPdfBrowser()
    page = await browser.newPage()

    // Set viewport for rendering
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2, // High DPI for crisp text
    })

    // Generate HTML from template
    const html = generateProspectReportHtml(data)

    // Set the HTML content
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 30000,
    })

    // Wait for fonts to load
    await page.evaluate(() => {
      return document.fonts.ready
    })

    // Small delay to ensure everything is rendered
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format,
      printBackground,
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in",
      },
      displayHeaderFooter: false,
      preferCSSPageSize: true,
    })

    // Generate filename
    const sanitizedName = data.prospectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50)

    const dateStr = new Date().toISOString().split("T")[0]
    const filename = `romy-donor-profile-${sanitizedName}-${dateStr}.pdf`

    return {
      buffer: Buffer.from(pdfBuffer),
      filename,
    }
  } finally {
    // Cleanup
    if (page) {
      try {
        await page.close()
      } catch {
        // Ignore
      }
    }
    if (browser) {
      try {
        await browser.close()
      } catch {
        // Ignore
      }
    }
  }
}

/**
 * Generate a PDF from raw HTML
 * Useful for custom report formats
 */
export async function generatePdfFromHtml(
  html: string,
  filename: string
): Promise<GeneratePdfResult> {
  let browser: Browser | null = null
  let page: Page | null = null

  try {
    browser = await createPdfBrowser()
    page = await browser.newPage()

    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2,
    })

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 30000,
    })

    await page.evaluate(() => {
      return document.fonts.ready
    })

    await new Promise((resolve) => setTimeout(resolve, 500))

    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in",
      },
      preferCSSPageSize: true,
    })

    return {
      buffer: Buffer.from(pdfBuffer),
      filename,
    }
  } finally {
    if (page) {
      try {
        await page.close()
      } catch {
        // Ignore
      }
    }
    if (browser) {
      try {
        await browser.close()
      } catch {
        // Ignore
      }
    }
  }
}

/**
 * Check if PDF generation is available
 */
export async function isPdfGenerationAvailable(): Promise<boolean> {
  try {
    await loadPuppeteer()
    return true
  } catch {
    return false
  }
}
