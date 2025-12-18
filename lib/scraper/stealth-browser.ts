/**
 * Stealth Browser Module
 *
 * Provides a Playwright browser instance with anti-detection measures
 * using puppeteer-extra-plugin-stealth.
 *
 * Features:
 * - WebDriver property removal
 * - HeadlessChrome user-agent masking
 * - Plugin/language spoofing
 * - WebGL vendor masking
 * - Timezone/locale consistency
 *
 * Usage:
 * ```typescript
 * const browser = await getStealthBrowser()
 * const page = await browser.newPage()
 * // ... scrape ...
 * await browser.close()
 * ```
 */

import { SCRAPER_CONFIG, getRandomDelay } from "./config"

// Type declarations for optional dependencies
// These are only loaded at runtime if available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let playwrightExtra: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stealthPlugin: any = null

/**
 * Random viewport sizes for fingerprint randomization
 */
const VIEWPORT_SIZES = [
  { width: 1920, height: 1080 },
  { width: 1680, height: 1050 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1600, height: 900 },
  { width: 2560, height: 1440 },
]

/**
 * Random timezones for fingerprint variation
 */
const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Denver",
  "America/Phoenix",
]

/**
 * User agents rotation
 */
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
]

/**
 * Get random element from array
 */
function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Lazy load playwright-extra and stealth plugin
 * These packages are optional dependencies
 */
async function loadPlaywrightExtra() {
  if (!playwrightExtra) {
    try {
      // Dynamic imports using string variables to prevent TypeScript
      // from trying to resolve these optional dependencies at compile time
      const playwrightExtraModule = "playwright-extra"
      const stealthPluginModule = "puppeteer-extra-plugin-stealth"
      playwrightExtra = await import(playwrightExtraModule)
      stealthPlugin = await import(stealthPluginModule)
    } catch {
      throw new Error(
        "playwright-extra not installed. Run: npm install playwright-extra puppeteer-extra-plugin-stealth playwright"
      )
    }
  }
  return { playwrightExtra, stealthPlugin }
}

/**
 * Browser instance singleton (to reuse across requests)
 */
let browserInstance: Awaited<ReturnType<typeof createStealthBrowser>> | null = null
let lastUsed = 0
const BROWSER_IDLE_TIMEOUT = 5 * 60 * 1000 // 5 minutes

/**
 * Create a new stealth browser instance
 */
async function createStealthBrowser() {
  const { playwrightExtra: pw, stealthPlugin: stealth } = await loadPlaywrightExtra()

  if (!pw || !stealth) {
    throw new Error("Failed to load playwright-extra or stealth plugin")
  }

  // Get chromium from playwright-extra
  const { chromium } = pw

  // Apply stealth plugin
  chromium.use(stealth.default())

  // Launch browser with aggressive stealth settings
  const browser = await chromium.launch({
    headless: SCRAPER_CONFIG.headless,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-web-security",
      "--disable-features=BlockInsecurePrivateNetworkRequests",
      // Additional anti-detection args
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--disable-translate",
      "--metrics-recording-only",
      "--mute-audio",
      "--no-default-browser-check",
      "--safebrowsing-disable-auto-update",
      // Mimic a real browser window
      "--window-size=1920,1080",
      "--start-maximized",
    ],
  })

  return browser
}

/**
 * Get a stealth browser instance (singleton with auto-cleanup)
 */
export async function getStealthBrowser() {
  const now = Date.now()

  // Close idle browser
  if (browserInstance && now - lastUsed > BROWSER_IDLE_TIMEOUT) {
    try {
      await browserInstance.close()
    } catch {
      // Ignore close errors
    }
    browserInstance = null
  }

  // Create new browser if needed
  if (!browserInstance) {
    browserInstance = await createStealthBrowser()
  }

  lastUsed = now
  return browserInstance
}

/**
 * Close the browser instance
 */
export async function closeBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.close()
    } catch {
      // Ignore close errors
    }
    browserInstance = null
  }
}

/**
 * Create a new page with stealth settings and randomized fingerprint
 */
export async function createStealthPage(browser: Awaited<ReturnType<typeof getStealthBrowser>>) {
  // Random fingerprint for this session
  const viewport = getRandomElement(VIEWPORT_SIZES)
  const userAgent = getRandomElement(USER_AGENTS)
  const timezone = getRandomElement(TIMEZONES)

  // Random device scale factor (1, 1.25, 1.5, 2)
  const deviceScaleFactor = getRandomElement([1, 1.25, 1.5, 2])

  const context = await browser.newContext({
    userAgent,
    viewport,
    deviceScaleFactor,
    locale: "en-US",
    timezoneId: timezone,
    geolocation: { latitude: 40.7128, longitude: -74.006 }, // NYC
    permissions: ["geolocation"],
    // Accept cookies
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": userAgent.includes("Windows") ? '"Windows"' : '"macOS"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
  })

  const page = await context.newPage()

  // Add comprehensive stealth measures
  await page.addInitScript(() => {
    // Override navigator.webdriver
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    })

    // Create realistic plugins array
    const pluginData = [
      { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" },
      { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai" },
      { name: "Native Client", filename: "internal-nacl-plugin" },
    ]

    Object.defineProperty(navigator, "plugins", {
      get: () => {
        const plugins = pluginData.map((p) => ({
          name: p.name,
          filename: p.filename,
          description: p.name,
          length: 1,
        }))
        // Add length property
        Object.defineProperty(plugins, "length", { value: pluginData.length })
        return plugins
      },
    })

    // Override navigator.languages
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    })

    // Override navigator.platform
    Object.defineProperty(navigator, "platform", {
      get: () => "MacIntel",
    })

    // Override navigator.hardwareConcurrency (random 4-16)
    Object.defineProperty(navigator, "hardwareConcurrency", {
      get: () => Math.floor(Math.random() * 12) + 4,
    })

    // Override navigator.deviceMemory (random 4-16)
    Object.defineProperty(navigator, "deviceMemory", {
      get: () => [4, 8, 16][Math.floor(Math.random() * 3)],
    })

    // Mock chrome runtime
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).chrome = {
      runtime: {
        connect: () => {},
        sendMessage: () => {},
      },
      loadTimes: () => ({}),
      csi: () => ({}),
      app: {},
    }

    // Override permissions query
    const originalQuery = window.navigator.permissions.query
    window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters)

    // Override WebGL vendor/renderer
    const getParameterProxyHandler = {
      apply(target: typeof WebGLRenderingContext.prototype.getParameter, thisArg: WebGLRenderingContext, args: [number]) {
        const param = args[0]
        // UNMASKED_VENDOR_WEBGL
        if (param === 37445) return "Google Inc. (Apple)"
        // UNMASKED_RENDERER_WEBGL
        if (param === 37446) return "ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)"
        return target.apply(thisArg, args)
      },
    }

    // Apply to both WebGL and WebGL2
    const origGetParameter = WebGLRenderingContext.prototype.getParameter
    WebGLRenderingContext.prototype.getParameter = new Proxy(origGetParameter, getParameterProxyHandler)

    if (typeof WebGL2RenderingContext !== "undefined") {
      const origGetParameter2 = WebGL2RenderingContext.prototype.getParameter
      WebGL2RenderingContext.prototype.getParameter = new Proxy(origGetParameter2, getParameterProxyHandler)
    }

    // Override canvas fingerprinting
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL
    HTMLCanvasElement.prototype.toDataURL = function (type?: string) {
      if (type === "image/png" || !type) {
        const context = this.getContext("2d")
        if (context) {
          // Add minor noise to prevent fingerprinting
          const imageData = context.getImageData(0, 0, this.width, this.height)
          for (let i = 0; i < imageData.data.length; i += 4) {
            // Very slight random variation (invisible to eye)
            imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + (Math.random() > 0.5 ? 1 : -1)))
          }
          context.putImageData(imageData, 0, 0)
        }
      }
      return originalToDataURL.apply(this, [type] as [string | undefined])
    }
  })

  // Set longer timeouts (60 seconds)
  page.setDefaultTimeout(60000)
  page.setDefaultNavigationTimeout(60000)

  return { page, context }
}

/**
 * Human-like typing (with random delays between keystrokes)
 */
export async function humanType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  selector: string,
  text: string
) {
  await page.click(selector)
  for (const char of text) {
    await page.type(selector, char, { delay: SCRAPER_CONFIG.typingDelay + Math.random() * 50 })
  }
}

/**
 * Wait with random delay (to appear human-like)
 */
export async function humanDelay() {
  const delay = getRandomDelay()
  await new Promise((resolve) => setTimeout(resolve, delay))
}

/**
 * Retry wrapper for flaky operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = SCRAPER_CONFIG.maxRetries,
  retryDelay: number = SCRAPER_CONFIG.retryDelay
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`[Scraper] Attempt ${attempt}/${maxRetries} failed:`, lastError.message)

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
      }
    }
  }

  throw lastError || new Error("Operation failed after retries")
}

/**
 * Safe page close (closes page and context)
 */
export async function closePage(context: { close: () => Promise<void> }) {
  try {
    await context.close()
  } catch {
    // Ignore close errors
  }
}

/**
 * Check if Playwright is available
 */
export async function isPlaywrightAvailable(): Promise<boolean> {
  try {
    await loadPlaywrightExtra()
    return true
  } catch {
    return false
  }
}
