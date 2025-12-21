/**
 * Serverless Stealth Browser Module
 *
 * Provides a Puppeteer browser instance optimized for Vercel serverless.
 * Uses @sparticuz/chromium for serverless compatibility and manual stealth techniques.
 *
 * Features:
 * - Serverless-compatible (works on Vercel, AWS Lambda)
 * - WebDriver property removal
 * - HeadlessChrome user-agent masking
 * - Plugin/language spoofing
 * - WebGL vendor masking
 * - Timezone/locale consistency
 * - Comprehensive anti-bot detection bypass
 *
 * Usage:
 * ```typescript
 * const browser = await getStealthBrowser()
 * const { page, cleanup } = await createStealthPage(browser)
 * // ... scrape ...
 * await cleanup()
 * ```
 */

import type { Browser, Page } from "puppeteer-core"
import { SCRAPER_CONFIG, getRandomDelay } from "./config"

// Lazy-loaded modules (only load when needed)
let chromium: typeof import("@sparticuz/chromium") | null = null
let puppeteerCore: typeof import("puppeteer-core") | null = null

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
 * User agents rotation (Chrome on macOS and Windows)
 */
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
]

/**
 * Get random element from array
 */
function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Lazy load puppeteer-core and @sparticuz/chromium
 */
async function loadPuppeteer() {
  if (!puppeteerCore || !chromium) {
    try {
      // Dynamic imports to prevent bundling issues
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
 * Browser instance singleton with mutex for thread safety
 */
let browserInstance: Browser | null = null
let browserCreationPromise: Promise<Browser> | null = null
let lastUsed = 0
const BROWSER_IDLE_TIMEOUT = 5 * 60 * 1000 // 5 minutes

/**
 * Check if running in serverless environment (Vercel, AWS Lambda)
 */
function isServerless(): boolean {
  return !!(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY
  )
}

/**
 * Create a new stealth browser instance
 */
async function createStealthBrowser(): Promise<Browser> {
  const { chromium: chr, puppeteerCore: pptr } = await loadPuppeteer()

  if (!chr || !pptr) {
    throw new Error("Failed to load puppeteer dependencies")
  }

  // Get executable path - different for serverless vs local
  let executablePath: string

  if (isServerless()) {
    // Serverless: use @sparticuz/chromium
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

    // Check which path exists
    const fs = await import("fs")
    executablePath = possiblePaths.find((p) => {
      try {
        return fs.existsSync(p)
      } catch {
        return false
      }
    }) || await chr.default.executablePath() // Fallback to chromium
  }

  // Launch browser with anti-detection args
  const browser = await pptr.default.launch({
    executablePath,
    headless: isServerless() ? true : (SCRAPER_CONFIG.headless ? true : false),
    args: isServerless()
      ? [
          ...chr.default.args,
          "--disable-blink-features=AutomationControlled",
          "--disable-features=IsolateOrigins,site-per-process",
        ]
      : [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-web-security",
          "--disable-features=BlockInsecurePrivateNetworkRequests",
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
          "--window-size=1920,1080",
          "--start-maximized",
        ],
    defaultViewport: isServerless() ? { width: 1920, height: 1080 } : null,
  })

  return browser
}

/**
 * Check if browser is healthy and connected
 */
function isBrowserHealthy(browser: Browser | null): boolean {
  if (!browser) return false
  try {
    // Check if browser is still connected
    return browser.connected
  } catch {
    return false
  }
}

/**
 * Get a stealth browser instance (singleton with auto-cleanup and race condition protection)
 */
export async function getStealthBrowser(): Promise<Browser> {
  const now = Date.now()

  // Close idle or disconnected browser
  if (browserInstance) {
    const isIdle = now - lastUsed > BROWSER_IDLE_TIMEOUT
    const isDisconnected = !isBrowserHealthy(browserInstance)

    if (isIdle || isDisconnected) {
      if (isDisconnected) {
        console.log("[StealthBrowser] Browser disconnected, recreating...")
      }
      try {
        await browserInstance.close()
      } catch {
        // Ignore close errors
      }
      browserInstance = null
      browserCreationPromise = null
    }
  }

  // Return existing healthy browser
  if (browserInstance && isBrowserHealthy(browserInstance)) {
    lastUsed = now
    return browserInstance
  }

  // Wait for in-progress creation (prevents race condition)
  if (browserCreationPromise) {
    try {
      const browser = await browserCreationPromise
      if (isBrowserHealthy(browser)) {
        lastUsed = Date.now()
        return browser
      }
    } catch {
      // Creation failed, we'll try again below
      browserCreationPromise = null
    }
  }

  // Create new browser with mutex
  browserCreationPromise = createStealthBrowser()

  try {
    browserInstance = await browserCreationPromise
    lastUsed = Date.now()
    return browserInstance
  } catch (error) {
    browserCreationPromise = null
    throw error
  }
}

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  browserCreationPromise = null
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
 * Stealth page setup script - injects anti-detection measures
 */
const STEALTH_SCRIPT = `
  // Override navigator.webdriver
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
  });

  // Create realistic plugins array
  const pluginData = [
    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
    { name: 'Native Client', filename: 'internal-nacl-plugin' },
  ];

  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      const plugins = pluginData.map((p) => ({
        name: p.name,
        filename: p.filename,
        description: p.name,
        length: 1,
      }));
      Object.defineProperty(plugins, 'length', { value: pluginData.length });
      return plugins;
    },
  });

  // Override navigator.languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
  });

  // Override navigator.platform
  Object.defineProperty(navigator, 'platform', {
    get: () => 'MacIntel',
  });

  // Override navigator.hardwareConcurrency (random 4-16)
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: () => Math.floor(Math.random() * 12) + 4,
  });

  // Override navigator.deviceMemory (random 4-16)
  Object.defineProperty(navigator, 'deviceMemory', {
    get: () => [4, 8, 16][Math.floor(Math.random() * 3)],
  });

  // Mock chrome runtime
  window.chrome = {
    runtime: {
      connect: () => {},
      sendMessage: () => {},
    },
    loadTimes: () => ({}),
    csi: () => ({}),
    app: {},
  };

  // Override permissions query
  const originalQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (parameters) =>
    parameters.name === 'notifications'
      ? Promise.resolve({ state: Notification.permission })
      : originalQuery(parameters);

  // Override WebGL vendor/renderer
  const getParameterProxyHandler = {
    apply(target, thisArg, args) {
      const param = args[0];
      // UNMASKED_VENDOR_WEBGL
      if (param === 37445) return 'Google Inc. (Apple)';
      // UNMASKED_RENDERER_WEBGL
      if (param === 37446) return 'ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)';
      return target.apply(thisArg, args);
    },
  };

  // Apply to both WebGL and WebGL2
  const origGetParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = new Proxy(origGetParameter, getParameterProxyHandler);

  if (typeof WebGL2RenderingContext !== 'undefined') {
    const origGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = new Proxy(origGetParameter2, getParameterProxyHandler);
  }

  // Override canvas fingerprinting
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (type) {
    if (type === 'image/png' || !type) {
      const context = this.getContext('2d');
      if (context) {
        const imageData = context.getImageData(0, 0, this.width, this.height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + (Math.random() > 0.5 ? 1 : -1)));
        }
        context.putImageData(imageData, 0, 0);
      }
    }
    return originalToDataURL.apply(this, [type]);
  };
`;

/**
 * Create a new page with stealth settings and randomized fingerprint
 * Includes proper cleanup on failure
 */
export async function createStealthPage(browser: Browser): Promise<{
  page: Page
  cleanup: () => Promise<void>
}> {
  // Random fingerprint for this session
  const viewport = getRandomElement(VIEWPORT_SIZES)
  const userAgent = getRandomElement(USER_AGENTS)
  const timezone = getRandomElement(TIMEZONES)

  let page: Page | null = null

  try {
    page = await browser.newPage()

    // Set user agent
    await page.setUserAgent(userAgent)

    // Set viewport
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: getRandomElement([1, 1.25, 1.5, 2]),
    })

    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="122", "Google Chrome";v="122"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": userAgent.includes("Windows") ? '"Windows"' : '"macOS"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    })

    // Emulate timezone
    await page.emulateTimezone(timezone)

    // Inject stealth script before any page loads
    await page.evaluateOnNewDocument(STEALTH_SCRIPT)

    // Set longer timeouts (60 seconds)
    page.setDefaultTimeout(60000)
    page.setDefaultNavigationTimeout(60000)

    // Create cleanup function that tracks if already cleaned up
    let isClosed = false
    const cleanup = async () => {
      if (isClosed) return
      isClosed = true
      try {
        if (page && !page.isClosed()) {
          await page.close()
        }
      } catch {
        // Ignore close errors
      }
    }

    return { page, cleanup }
  } catch (error) {
    // Cleanup on setup failure
    if (page) {
      try {
        await page.close()
      } catch {
        // Ignore cleanup errors
      }
    }
    throw error
  }
}

/**
 * Human-like typing (with random delays between keystrokes)
 * Clicks element once, focuses it, then types all text with realistic delays
 */
export async function humanType(
  page: Page,
  selector: string,
  text: string
): Promise<void> {
  // Find and click element once
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Element not found: ${selector}`)
  }

  await element.click()

  // Small delay after click before typing
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 100))

  // Type all text with human-like delays using keyboard
  for (const char of text) {
    await page.keyboard.type(char, {
      delay: SCRAPER_CONFIG.typingDelay + Math.random() * 50,
    })
  }
}

/**
 * Wait with random delay (to appear human-like)
 */
export async function humanDelay(): Promise<void> {
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
        // Exponential backoff
        const backoffDelay = retryDelay * Math.pow(2, attempt - 1)
        await new Promise((resolve) => setTimeout(resolve, backoffDelay))
      }
    }
  }

  throw lastError || new Error("Operation failed after retries")
}

/**
 * Safe page close (for backwards compatibility)
 * @deprecated Use the cleanup function from createStealthPage instead
 */
export async function closePage(pageOrContext: { close: () => Promise<void> }): Promise<void> {
  try {
    await pageOrContext.close()
  } catch {
    // Ignore close errors
  }
}

/**
 * Check if Puppeteer/Chromium is available
 */
export async function isPlaywrightAvailable(): Promise<boolean> {
  try {
    await loadPuppeteer()
    return true
  } catch {
    return false
  }
}

/**
 * Alias for backwards compatibility
 */
export const isPuppeteerAvailable = isPlaywrightAvailable

/**
 * Wait for selector with timeout and optional visibility check
 */
export async function waitForSelector(
  page: Page,
  selector: string,
  options: { timeout?: number; visible?: boolean } = {}
): Promise<boolean> {
  const { timeout = 15000, visible = false } = options
  try {
    await page.waitForSelector(selector, { timeout, visible })
    return true
  } catch {
    return false
  }
}

/**
 * Safe navigation with retry
 */
export async function safeGoto(
  page: Page,
  url: string,
  options: { timeout?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2" } = {}
): Promise<boolean> {
  const { timeout = 30000, waitUntil = "networkidle2" } = options

  return withRetry(async () => {
    const response = await page.goto(url, { timeout, waitUntil })
    if (!response) {
      throw new Error(`Failed to navigate to ${url}`)
    }
    const status = response.status()
    if (status >= 400) {
      throw new Error(`HTTP ${status} for ${url}`)
    }
    return true
  })
}

/**
 * Extract text content from element
 */
export async function getTextContent(page: Page, selector: string): Promise<string | null> {
  try {
    const element = await page.$(selector)
    if (!element) return null
    const text = await page.evaluate((el) => el.textContent, element)
    return text?.trim() || null
  } catch {
    return null
  }
}

/**
 * Extract attribute from element
 */
export async function getAttribute(
  page: Page,
  selector: string,
  attribute: string
): Promise<string | null> {
  try {
    const element = await page.$(selector)
    if (!element) return null
    const value = await page.evaluate(
      (el, attr) => el.getAttribute(attr),
      element,
      attribute
    )
    return value || null
  } catch {
    return null
  }
}

/**
 * Check if page contains CAPTCHA
 */
export async function hasCaptcha(page: Page): Promise<boolean> {
  const content = await page.content()
  const captchaIndicators = [
    "captcha",
    "recaptcha",
    "hcaptcha",
    "h-captcha",
    "challenge",
    "robot",
    "verify you are human",
    "are you a robot",
  ]
  const lowerContent = content.toLowerCase()
  return captchaIndicators.some((indicator) => lowerContent.includes(indicator))
}

/**
 * Wait for network to be idle with fallback for older Puppeteer versions
 */
export async function waitForNetworkIdle(
  page: Page,
  options: { timeout?: number; idleTime?: number } = {}
): Promise<void> {
  const { timeout = 30000, idleTime = 500 } = options

  try {
    // Try modern Puppeteer API first
    if (typeof page.waitForNetworkIdle === "function") {
      await page.waitForNetworkIdle({ timeout, idleTime })
      return
    }
  } catch (error) {
    // If waitForNetworkIdle fails, fall back to alternative
    console.log("[StealthBrowser] waitForNetworkIdle failed, using fallback")
  }

  // Fallback: wait for a short period with no new network requests
  await new Promise<void>((resolve) => {
    let networkIdleTimer: NodeJS.Timeout | null = null
    let timeoutTimer: NodeJS.Timeout | null = null

    const cleanup = () => {
      if (networkIdleTimer) clearTimeout(networkIdleTimer)
      if (timeoutTimer) clearTimeout(timeoutTimer)
    }

    // Start idle timer
    const startIdleTimer = () => {
      if (networkIdleTimer) clearTimeout(networkIdleTimer)
      networkIdleTimer = setTimeout(() => {
        cleanup()
        resolve()
      }, idleTime)
    }

    // Set up request listeners
    const onRequest = () => {
      if (networkIdleTimer) clearTimeout(networkIdleTimer)
    }

    const onResponse = () => {
      startIdleTimer()
    }

    // Add listeners
    page.on("request", onRequest)
    page.on("response", onResponse)
    page.on("requestfailed", onResponse)

    // Global timeout
    timeoutTimer = setTimeout(() => {
      page.off("request", onRequest)
      page.off("response", onResponse)
      page.off("requestfailed", onResponse)
      cleanup()
      resolve()
    }, timeout)

    // Start initial idle timer
    startIdleTimer()
  })
}

/**
 * Safely dispose of an ElementHandle to prevent memory leaks
 */
export async function disposeElement(element: import("puppeteer-core").ElementHandle | null): Promise<void> {
  if (!element) return
  try {
    await element.dispose()
  } catch {
    // Ignore disposal errors (element may already be disposed or detached)
  }
}
