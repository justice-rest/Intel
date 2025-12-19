/**
 * Free Proxy Rotator Service
 *
 * Fetches and rotates through free proxies from TheSpeedX/PROXY-List
 * Provides proxy validation and rotation for web scraping
 *
 * Sources:
 * - https://github.com/TheSpeedX/PROXY-List (HTTP, SOCKS4, SOCKS5)
 */

export interface Proxy {
  host: string
  port: number
  protocol: "http" | "socks4" | "socks5"
  lastUsed?: number
  failCount: number
  successCount: number
}

interface ProxyStats {
  total: number
  working: number
  failed: number
  lastUpdated: number
}

const PROXY_SOURCES = {
  http: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
  socks4: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt",
  socks5: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt",
} as const

// Alternative proxy sources for fallback
const ALTERNATIVE_SOURCES = {
  http: [
    "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt",
    "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt",
  ],
} as const

const CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const MAX_FAIL_COUNT = 3 // Remove proxy after 3 failures
const MIN_WORKING_PROXIES = 10 // Refresh if below this threshold

class ProxyRotator {
  private proxies: Map<string, Proxy> = new Map()
  private workingProxies: Proxy[] = []
  private currentIndex = 0
  private lastFetchTime = 0
  private fetchPromise: Promise<void> | null = null

  /**
   * Initialize the proxy rotator
   */
  async initialize(protocols: ("http" | "socks4" | "socks5")[] = ["http"]): Promise<void> {
    if (this.proxies.size > 0 && Date.now() - this.lastFetchTime < CACHE_TTL) {
      console.log("[Proxy Rotator] Using cached proxies")
      return
    }

    // Prevent concurrent fetches
    if (this.fetchPromise) {
      await this.fetchPromise
      return
    }

    this.fetchPromise = this.fetchProxies(protocols)
    await this.fetchPromise
    this.fetchPromise = null
  }

  /**
   * Fetch proxies from GitHub sources
   */
  private async fetchProxies(protocols: ("http" | "socks4" | "socks5")[]): Promise<void> {
    console.log("[Proxy Rotator] Fetching fresh proxies...")

    for (const protocol of protocols) {
      try {
        const url = PROXY_SOURCES[protocol]
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ProxyFetcher/1.0)",
          },
        })

        if (!response.ok) {
          console.warn(`[Proxy Rotator] Failed to fetch ${protocol} proxies: ${response.status}`)
          continue
        }

        const text = await response.text()
        const lines = text.trim().split("\n")

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith("#")) continue

          const [host, portStr] = trimmed.split(":")
          const port = parseInt(portStr, 10)

          if (host && port && port > 0 && port < 65536) {
            const key = `${protocol}://${host}:${port}`
            if (!this.proxies.has(key)) {
              this.proxies.set(key, {
                host,
                port,
                protocol,
                failCount: 0,
                successCount: 0,
              })
            }
          }
        }

        console.log(`[Proxy Rotator] Loaded ${lines.length} ${protocol} proxies`)
      } catch (error) {
        console.error(`[Proxy Rotator] Error fetching ${protocol} proxies:`, error)
      }
    }

    // Build working proxies list
    this.workingProxies = Array.from(this.proxies.values()).filter(
      (p) => p.failCount < MAX_FAIL_COUNT
    )

    // Shuffle for randomness
    this.shuffleArray(this.workingProxies)

    this.lastFetchTime = Date.now()
    this.currentIndex = 0

    console.log(`[Proxy Rotator] Total available proxies: ${this.workingProxies.length}`)
  }

  /**
   * Fisher-Yates shuffle
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
  }

  /**
   * Get the next proxy in rotation
   */
  async getNext(): Promise<Proxy | null> {
    // Refresh if cache expired or too few working proxies
    if (
      Date.now() - this.lastFetchTime > CACHE_TTL ||
      this.workingProxies.length < MIN_WORKING_PROXIES
    ) {
      await this.initialize(["http"])
    }

    if (this.workingProxies.length === 0) {
      console.warn("[Proxy Rotator] No working proxies available")
      return null
    }

    const proxy = this.workingProxies[this.currentIndex]
    this.currentIndex = (this.currentIndex + 1) % this.workingProxies.length
    proxy.lastUsed = Date.now()

    return proxy
  }

  /**
   * Get multiple random proxies
   */
  async getMultiple(count: number): Promise<Proxy[]> {
    await this.initialize(["http"])

    const shuffled = [...this.workingProxies]
    this.shuffleArray(shuffled)
    return shuffled.slice(0, Math.min(count, shuffled.length))
  }

  /**
   * Report a proxy as working
   */
  markSuccess(proxy: Proxy): void {
    const key = `${proxy.protocol}://${proxy.host}:${proxy.port}`
    const existing = this.proxies.get(key)
    if (existing) {
      existing.successCount++
      existing.failCount = 0 // Reset on success
    }
  }

  /**
   * Report a proxy as failed
   */
  markFailed(proxy: Proxy): void {
    const key = `${proxy.protocol}://${proxy.host}:${proxy.port}`
    const existing = this.proxies.get(key)
    if (existing) {
      existing.failCount++

      // Remove from working list if too many failures
      if (existing.failCount >= MAX_FAIL_COUNT) {
        this.workingProxies = this.workingProxies.filter(
          (p) => !(p.host === proxy.host && p.port === proxy.port)
        )
        console.log(`[Proxy Rotator] Removed failed proxy: ${key}`)
      }
    }
  }

  /**
   * Get proxy string for Playwright
   */
  getPlaywrightProxy(proxy: Proxy): { server: string } {
    const protocol = proxy.protocol === "http" ? "http" : proxy.protocol
    return {
      server: `${protocol}://${proxy.host}:${proxy.port}`,
    }
  }

  /**
   * Get stats about the proxy pool
   */
  getStats(): ProxyStats {
    return {
      total: this.proxies.size,
      working: this.workingProxies.length,
      failed: this.proxies.size - this.workingProxies.length,
      lastUpdated: this.lastFetchTime,
    }
  }

  /**
   * Clear all proxies and reset
   */
  reset(): void {
    this.proxies.clear()
    this.workingProxies = []
    this.currentIndex = 0
    this.lastFetchTime = 0
    this.fetchPromise = null
  }
}

// Singleton instance
export const proxyRotator = new ProxyRotator()

/**
 * Test if a proxy is working
 */
export async function testProxy(
  proxy: Proxy,
  testUrl = "https://httpbin.org/ip",
  timeoutMs = 10000
): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    // For HTTP proxies, we'd need a fetch agent that supports proxies
    // In Node.js, this typically requires a package like 'https-proxy-agent'
    // For browser/edge environments, proxy is handled at the network layer

    // Simple connectivity check - just verify the proxy responds
    const response = await fetch(`http://${proxy.host}:${proxy.port}`, {
      signal: controller.signal,
      method: "HEAD",
    }).catch(() => null)

    clearTimeout(timeout)

    return response !== null
  } catch {
    return false
  }
}

/**
 * Execute a request with automatic proxy rotation and retries
 */
export async function withProxyRetry<T>(
  operation: (proxy: Proxy | null) => Promise<T>,
  options: {
    maxRetries?: number
    useProxy?: boolean
    initialDelay?: number
    maxDelay?: number
  } = {}
): Promise<T> {
  const { maxRetries = 3, useProxy = true, initialDelay = 1000, maxDelay = 10000 } = options

  let lastError: Error | null = null
  let delay = initialDelay

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const proxy = useProxy ? await proxyRotator.getNext() : null

    try {
      const result = await operation(proxy)
      if (proxy) {
        proxyRotator.markSuccess(proxy)
      }
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (proxy) {
        proxyRotator.markFailed(proxy)
      }

      console.warn(
        `[Proxy Retry] Attempt ${attempt + 1}/${maxRetries} failed:`,
        lastError.message
      )

      if (attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const jitter = Math.random() * 0.3 * delay
        const waitTime = Math.min(delay + jitter, maxDelay)
        console.log(`[Proxy Retry] Waiting ${Math.round(waitTime)}ms before retry...`)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
        delay *= 2
      }
    }
  }

  throw lastError || new Error("All retry attempts failed")
}

export default proxyRotator
