/**
 * Browser Stealth and Fingerprint Randomization
 *
 * Techniques to make Playwright browsers appear more human-like
 * Based on puppeteer-extra-plugin-stealth and playwright-stealth
 *
 * Sources:
 * - https://github.com/berstend/puppeteer-extra/tree/master/packages/playwright-extra
 * - https://brightdata.com/blog/how-tos/avoid-bot-detection-with-playwright-stealth
 */

import type { Browser, BrowserContext, Page } from "playwright"
import type { Proxy } from "./proxy-rotator"

/**
 * Random user agents to rotate through
 * Mix of Chrome versions on different platforms
 */
const USER_AGENTS = [
  // Windows Chrome
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  // Mac Chrome
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  // Linux Chrome
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
]

/**
 * Common viewport sizes (desktop)
 */
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
]

/**
 * Timezone configurations
 */
const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Detroit",
]

/**
 * Locale configurations
 */
const LOCALES = ["en-US", "en-GB", "en-CA"]

/**
 * Stealth scripts to inject
 * Based on puppeteer-extra-plugin-stealth evasions
 */
const STEALTH_SCRIPTS = {
  // Override navigator.webdriver
  webdriver: `
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
      configurable: true
    });
  `,

  // Override chrome runtime
  chromeRuntime: `
    window.chrome = {
      runtime: {},
    };
  `,

  // Override permissions API
  permissions: `
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  `,

  // Override plugins
  plugins: `
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
      configurable: true
    });
  `,

  // Override languages
  languages: `
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
      configurable: true
    });
  `,

  // Hide automation-related properties
  automation: `
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  `,

  // WebGL vendor spoofing
  webgl: `
    const getParameterProxyHandler = {
      apply: function(target, thisArg, argumentsList) {
        if (argumentsList[0] === 37445) {
          return 'Intel Inc.';
        }
        if (argumentsList[0] === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return target.apply(thisArg, argumentsList);
      }
    };

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        gl.getParameter = new Proxy(gl.getParameter.bind(gl), getParameterProxyHandler);
      }
    } catch(e) {}
  `,

  // Console log spoofing
  console: `
    window.console.debug = () => null;
  `,
}

/**
 * Get a random element from an array
 */
function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

/**
 * Get randomized browser configuration
 */
export function getRandomBrowserConfig(): {
  userAgent: string
  viewport: { width: number; height: number }
  timezone: string
  locale: string
} {
  return {
    userAgent: randomChoice(USER_AGENTS),
    viewport: randomChoice(VIEWPORTS),
    timezone: randomChoice(TIMEZONES),
    locale: randomChoice(LOCALES),
  }
}

/**
 * Create a stealth browser context with randomized fingerprint
 */
export async function createStealthContext(
  browser: Browser,
  options: {
    proxy?: Proxy
    randomize?: boolean
  } = {}
): Promise<BrowserContext> {
  const { proxy, randomize = true } = options

  const config = randomize ? getRandomBrowserConfig() : {
    userAgent: USER_AGENTS[0],
    viewport: VIEWPORTS[0],
    timezone: TIMEZONES[0],
    locale: LOCALES[0],
  }

  const contextOptions: Parameters<Browser["newContext"]>[0] = {
    userAgent: config.userAgent,
    viewport: config.viewport,
    locale: config.locale,
    timezoneId: config.timezone,
    // Avoid "headless" detection
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    javaScriptEnabled: true,
    // Accept-Language header
    extraHTTPHeaders: {
      "Accept-Language": `${config.locale},en;q=0.9`,
    },
  }

  // Add proxy if provided
  if (proxy) {
    contextOptions.proxy = {
      server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
    }
  }

  const context = await browser.newContext(contextOptions)

  // Add stealth scripts to all new pages
  await context.addInitScript(() => {
    // Override navigator.webdriver
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
      configurable: true,
    })

    // Chrome runtime
    // @ts-ignore
    window.chrome = {
      runtime: {},
    }

    // Override plugins to look more realistic
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
      configurable: true,
    })

    // Override languages
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
      configurable: true,
    })
  })

  console.log("[Browser Stealth] Created stealth context:", {
    userAgent: config.userAgent.substring(0, 50) + "...",
    viewport: config.viewport,
    timezone: config.timezone,
    hasProxy: !!proxy,
  })

  return context
}

/**
 * Apply stealth patches to an existing page
 */
export async function applyStealthToPage(page: Page): Promise<void> {
  // Inject all stealth scripts
  for (const [name, script] of Object.entries(STEALTH_SCRIPTS)) {
    try {
      await page.addInitScript(script)
    } catch (error) {
      console.warn(`[Browser Stealth] Failed to inject ${name} script:`, error)
    }
  }

  // Also evaluate immediately for already-loaded pages
  try {
    await page.evaluate(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
        configurable: true,
      })
    })
  } catch {
    // Page might not be loaded yet, that's fine
  }
}

/**
 * Add human-like delays between actions
 */
export async function humanDelay(minMs = 100, maxMs = 500): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  await new Promise((resolve) => setTimeout(resolve, delay))
}

/**
 * Simulate human-like mouse movement before clicking
 */
export async function humanClick(
  page: Page,
  selector: string,
  options: { delay?: number; jitter?: number } = {}
): Promise<void> {
  const { delay = 100, jitter = 10 } = options

  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Element not found: ${selector}`)
  }

  const box = await element.boundingBox()
  if (!box) {
    throw new Error(`Element has no bounding box: ${selector}`)
  }

  // Add some randomness to click position within the element
  const x = box.x + box.width / 2 + (Math.random() - 0.5) * jitter
  const y = box.y + box.height / 2 + (Math.random() - 0.5) * jitter

  // Move mouse to element first
  await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 3 })

  // Small delay before clicking
  await humanDelay(50, delay)

  // Click
  await page.mouse.click(x, y)
}

/**
 * Simulate human-like scrolling
 */
export async function humanScroll(
  page: Page,
  direction: "up" | "down" = "down",
  amount?: number
): Promise<void> {
  const scrollAmount = amount || Math.floor(Math.random() * 300) + 100

  await page.evaluate((args) => {
    const [dir, amt] = args
    window.scrollBy({
      top: dir === "down" ? amt : -amt,
      behavior: "smooth",
    })
  }, [direction, scrollAmount] as const)

  await humanDelay(200, 500)
}

/**
 * Type text with human-like delays between keystrokes
 */
export async function humanType(
  page: Page,
  selector: string,
  text: string,
  options: { minDelay?: number; maxDelay?: number } = {}
): Promise<void> {
  const { minDelay = 50, maxDelay = 150 } = options

  await page.click(selector)
  await humanDelay(100, 200)

  for (const char of text) {
    await page.keyboard.type(char, {
      delay: Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay,
    })
  }
}

/**
 * Check if the page has detected automation
 */
export async function checkBotDetection(page: Page): Promise<{
  detected: boolean
  indicators: string[]
}> {
  const indicators: string[] = []

  // Check for common bot detection indicators
  const checks = await page.evaluate(() => {
    const results: Record<string, boolean> = {}

    // Check navigator.webdriver
    // @ts-ignore
    results.webdriver = navigator.webdriver === true

    // Check for automation-related properties
    // @ts-ignore
    results.cdcRuntime = !!window.cdc_adoQpoasnfa76pfcZLmcfl_Array

    // Check for headless indicators
    // @ts-ignore
    results.headlessChrome = /HeadlessChrome/.test(navigator.userAgent)

    // Check permissions API behavior
    // @ts-ignore
    results.permissionsQuery =
      navigator.permissions === undefined

    return results
  })

  for (const [check, detected] of Object.entries(checks)) {
    if (detected) {
      indicators.push(check)
    }
  }

  return {
    detected: indicators.length > 0,
    indicators,
  }
}

export default {
  createStealthContext,
  applyStealthToPage,
  humanDelay,
  humanClick,
  humanScroll,
  humanType,
  checkBotDetection,
  getRandomBrowserConfig,
}
