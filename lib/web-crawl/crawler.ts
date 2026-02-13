/**
 * BFS Web Crawler
 * Crawls a site breadth-first with depth tracking, throttling, and abort support
 *
 * Security: Uses DNS pinning via undici Agent to prevent DNS rebinding attacks.
 * After validateUrl() resolves and validates IPs, the crawler forces all connections
 * to those pre-validated IPs — a second DNS resolution cannot redirect to a private IP.
 */

import { Agent, fetch as undiciFetch } from "undici"
import {
  CRAWL_MAX_PAGES,
  CRAWL_MAX_DEPTH,
  CRAWL_MAX_PAGE_SIZE,
  CRAWL_FETCH_TIMEOUT,
  CRAWL_OVERALL_TIMEOUT,
  CRAWL_DOMAIN_THROTTLE,
  CRAWL_USER_AGENT,
  CRAWL_ALLOWED_CONTENT_TYPES,
} from "./config"
import type { CrawlConfig, CrawlPage, CrawlProgress, CrawlResult } from "./types"
import {
  validateRedirectedUrl,
  isSameOrigin,
  normalizeUrl,
  checkRobotsTxt,
} from "./url-validator"
import { extractContent, countWords } from "./content-extractor"
import { lookup as dnsLookup } from "dns"

/**
 * Create an undici Agent that pins DNS resolution to pre-validated IPs.
 * All connections go through the validated IPs — DNS rebinding cannot redirect
 * to a private IP between validation and fetch.
 */
function createPinnedAgent(
  hostname: string,
  resolvedIps: string[]
): Agent {
  let ipIndex = 0

  return new Agent({
    connect: {
      // Override DNS lookup to return only pre-validated IPs
      lookup: (requestedHostname, options, callback) => {
        if (requestedHostname === hostname && resolvedIps.length > 0) {
          // Round-robin through validated IPs
          const ip = resolvedIps[ipIndex % resolvedIps.length]
          ipIndex++
          const family = ip.includes(":") ? 6 : 4

          // undici calls with {all: true} — must return array format
          if (options && typeof options === "object" && (options as { all?: boolean }).all) {
            callback(null, [{ address: ip, family }] as any)
          } else {
            callback(null, ip, family)
          }
        } else {
          // For other hostnames (shouldn't happen in same-origin crawl), use real DNS
          dnsLookup(requestedHostname, options, callback)
        }
      },
    },
  })
}

/**
 * Crawl a website starting from the given URL
 * BFS: processes pages level by level, respects depth and page limits
 *
 * @param rootUrl - Validated root URL to start crawling from
 * @param onProgress - Callback for real-time progress updates
 * @param config - Optional configuration overrides
 */
export async function crawlSite(
  rootUrl: URL,
  onProgress: (progress: CrawlProgress) => void,
  config?: Partial<CrawlConfig>
): Promise<CrawlResult> {
  const maxPages = config?.maxPages ?? CRAWL_MAX_PAGES
  const maxDepth = config?.maxDepth ?? CRAWL_MAX_DEPTH
  const maxPageSize = config?.maxPageSize ?? CRAWL_MAX_PAGE_SIZE
  const fetchTimeout = config?.fetchTimeout ?? CRAWL_FETCH_TIMEOUT
  const overallTimeout = config?.overallTimeout ?? CRAWL_OVERALL_TIMEOUT
  const domainThrottle = config?.domainThrottle ?? CRAWL_DOMAIN_THROTTLE
  const userAgent = config?.userAgent ?? CRAWL_USER_AGENT
  const signal = config?.signal
  const resolvedIps = config?.resolvedIps

  // Create DNS-pinned agent if we have pre-resolved IPs
  const pinnedAgent = resolvedIps && resolvedIps.length > 0
    ? createPinnedAgent(rootUrl.hostname, resolvedIps)
    : undefined

  const pages: CrawlPage[] = []
  const visited = new Set<string>()
  let skippedPages = 0
  let failedPages = 0

  // Effective origin for link discovery — updated after root URL redirect.
  // Example: user enters goodestdogs.com, server redirects to www.goodestdogs.com,
  // we use www.goodestdogs.com as the effective origin for same-origin checks.
  // isSameOrigin already normalizes www., but this also handles non-www redirects
  // (e.g., old-domain.com → new-domain.com) for the root URL only.
  let effectiveOrigin = rootUrl

  // Queue: [url, depth]
  const queue: Array<[string, number]> = []
  const rootNormalized = normalizeUrl(rootUrl.href)
  if (!rootNormalized) {
    throw new Error("Failed to normalize root URL")
  }

  visited.add(rootNormalized)
  queue.push([rootUrl.href, 0])

  // Check robots.txt before starting
  const robotsCheck = await checkRobotsTxt(rootUrl, rootUrl.pathname)
  if (!robotsCheck.allowed) {
    pinnedAgent?.close()
    onProgress({
      type: "crawl_error",
      pagesProcessed: 0,
      pagesTotal: 0,
      pagesSkipped: 0,
      pagesFailed: 0,
      error: "robots.txt disallows crawling this site.",
    })
    return {
      pages: [],
      totalPages: 0,
      skippedPages: 0,
      failedPages: 0,
      rootUrl: rootUrl.href,
      hostname: rootUrl.hostname,
    }
  }

  // Overall timeout
  const overallAbort = AbortSignal.timeout(overallTimeout)

  onProgress({
    type: "crawl_started",
    url: rootUrl.href,
    pagesProcessed: 0,
    pagesTotal: 1,
    pagesSkipped: 0,
    pagesFailed: 0,
  })

  let lastFetchTime = 0

  try {
    while (queue.length > 0 && pages.length < maxPages) {
      // Check abort signals
      if (signal?.aborted || overallAbort.aborted) break

      const [currentUrl, depth] = queue.shift()!

      // Throttle: wait between requests to same domain
      const now = Date.now()
      const elapsed = now - lastFetchTime
      if (elapsed < domainThrottle) {
        await sleep(domainThrottle - elapsed)
      }

      try {
        // Fetch the page using DNS-pinned agent
        const fetchSignal = AbortSignal.any([
          AbortSignal.timeout(fetchTimeout),
          ...(signal ? [signal] : []),
          overallAbort,
        ])

        const fetchOptions: Record<string, unknown> = {
          headers: {
            "User-Agent": userAgent,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
          },
          signal: fetchSignal,
          redirect: "follow",
        }

        // Use pinned agent if available (DNS rebinding prevention)
        if (pinnedAgent) {
          fetchOptions.dispatcher = pinnedAgent
        }

        const response = await undiciFetch(currentUrl, fetchOptions as any)

        lastFetchTime = Date.now()

        // Post-redirect SSRF check
        if (response.url !== currentUrl) {
          const redirectCheck = await validateRedirectedUrl(response.url)
          if (!redirectCheck.valid) {
            failedPages++
            onProgress({
              type: "page_error",
              url: currentUrl,
              pagesProcessed: pages.length,
              pagesTotal: pages.length + queue.length,
              pagesSkipped: skippedPages,
              pagesFailed: failedPages,
              error: redirectCheck.error || "Blocked redirect",
            })
            continue
          }

          // Update effective origin on root URL redirect so discovered links
          // match the final hostname (e.g., goodestdogs.com → www.goodestdogs.com).
          if (pages.length === 0 && depth === 0) {
            try {
              effectiveOrigin = new URL(response.url)
            } catch { /* keep original rootUrl */ }
          }
        }

        if (!response.ok) {
          failedPages++
          onProgress({
            type: "page_error",
            url: currentUrl,
            pagesProcessed: pages.length,
            pagesTotal: pages.length + queue.length,
            pagesSkipped: skippedPages,
            pagesFailed: failedPages,
            error: `${response.status} ${response.statusText}`,
          })
          continue
        }

        // Content-Type check
        const contentType = response.headers.get("content-type") || ""
        const isHtml = CRAWL_ALLOWED_CONTENT_TYPES.some((t) => contentType.includes(t))
        if (!isHtml) {
          skippedPages++
          onProgress({
            type: "page_skipped",
            url: currentUrl,
            pagesProcessed: pages.length,
            pagesTotal: pages.length + queue.length,
            pagesSkipped: skippedPages,
            pagesFailed: failedPages,
            error: `Non-HTML content: ${contentType}`,
          })
          continue
        }

        // Size check via Content-Length header (if available)
        const contentLength = response.headers.get("content-length")
        if (contentLength && parseInt(contentLength, 10) > maxPageSize) {
          skippedPages++
          onProgress({
            type: "page_skipped",
            url: currentUrl,
            pagesProcessed: pages.length,
            pagesTotal: pages.length + queue.length,
            pagesSkipped: skippedPages,
            pagesFailed: failedPages,
            error: "Page too large (>1MB)",
          })
          continue
        }

        // Read body with size limit
        const html = await readWithSizeLimit(response, maxPageSize)
        if (!html) {
          skippedPages++
          onProgress({
            type: "page_skipped",
            url: currentUrl,
            pagesProcessed: pages.length,
            pagesTotal: pages.length + queue.length,
            pagesSkipped: skippedPages,
            pagesFailed: failedPages,
            error: "Page exceeds 1MB",
          })
          continue
        }

        // Extract content
        const extracted = extractContent(html, response.url)
        if (!extracted) {
          skippedPages++
          onProgress({
            type: "page_skipped",
            url: currentUrl,
            pagesProcessed: pages.length,
            pagesTotal: pages.length + queue.length,
            pagesSkipped: skippedPages,
            pagesFailed: failedPages,
            error: "Too little content",
          })
          continue
        }

        // Success — add page to results
        const page: CrawlPage = {
          url: response.url,
          title: extracted.title,
          content: extracted.content,
          wordCount: countWords(extracted.content),
          depth,
          statusCode: response.status,
        }
        pages.push(page)

        onProgress({
          type: "page_fetched",
          url: response.url,
          title: extracted.title,
          pagesProcessed: pages.length,
          pagesTotal: pages.length + queue.length,
          pagesSkipped: skippedPages,
          pagesFailed: failedPages,
        })

        // Discover links for next level (only if we haven't hit max depth)
        if (depth < maxDepth) {
          const links = discoverLinks(html, response.url, effectiveOrigin)
          for (const link of links) {
            if (pages.length + queue.length >= maxPages) break
            const normalized = normalizeUrl(link)
            if (normalized && !visited.has(normalized)) {
              visited.add(normalized)
              queue.push([link, depth + 1])
            }
          }
        }
      } catch (error) {
        failedPages++
        // Don't log abort errors as failures during intentional cancellation
        if (signal?.aborted) break

        let errorMsg: string
        if (error instanceof Error) {
          const cause = (error as any).cause
          if (cause?.code === "ENOTFOUND") {
            errorMsg = "Host not found"
          } else if (cause?.code?.startsWith?.("CERT") || cause?.code === "ERR_TLS_CERT_ALTNAME_INVALID") {
            errorMsg = "SSL certificate error"
          } else if (error.message.includes("abort") || cause?.code === "UND_ERR_CONNECT_TIMEOUT") {
            errorMsg = "Timed out"
          } else {
            errorMsg = cause?.message || error.message || "Fetch failed"
          }
        } else {
          errorMsg = "Unknown error"
        }

        onProgress({
          type: "page_error",
          url: currentUrl,
          pagesProcessed: pages.length,
          pagesTotal: pages.length + queue.length,
          pagesSkipped: skippedPages,
          pagesFailed: failedPages,
          error: errorMsg,
        })
      }
    }
  } finally {
    // Always close the pinned agent to release connections
    pinnedAgent?.close()
  }

  const result: CrawlResult = {
    pages,
    totalPages: pages.length,
    skippedPages,
    failedPages,
    rootUrl: rootUrl.href,
    hostname: rootUrl.hostname,
  }

  onProgress({
    type: "crawl_complete",
    pagesProcessed: pages.length,
    pagesTotal: pages.length,
    pagesSkipped: skippedPages,
    pagesFailed: failedPages,
  })

  return result
}

/**
 * Extract same-origin links from HTML
 */
function discoverLinks(html: string, pageUrl: string, rootUrl: URL): string[] {
  const links: string[] = []

  // Use regex for link extraction (lighter than full DOM parse)
  const hrefRegex = /<a[^>]+href=["']([^"'#]+)["']/gi
  let match: RegExpExecArray | null

  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1]
    if (!href) continue

    try {
      const resolved = new URL(href, pageUrl)

      // Only follow same-origin links
      if (!isSameOrigin(resolved, rootUrl)) continue

      // Skip non-HTML looking paths
      const ext = resolved.pathname.split(".").pop()?.toLowerCase()
      if (ext && NON_HTML_EXTENSIONS.has(ext)) continue

      // Skip common non-page patterns
      if (resolved.pathname.match(/\/(wp-admin|wp-includes|cgi-bin|\.well-known)\//)) continue

      links.push(resolved.href)
    } catch {
      // Invalid URL — skip
    }
  }

  return links
}

const NON_HTML_EXTENSIONS = new Set([
  "pdf", "jpg", "jpeg", "png", "gif", "svg", "webp", "ico",
  "css", "js", "json", "xml", "rss", "atom",
  "zip", "tar", "gz", "rar", "7z",
  "mp3", "mp4", "avi", "mov", "wmv", "flv",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "woff", "woff2", "ttf", "eot",
])

/**
 * Read response body with a hard size limit
 * Accepts both global Response and undici Response (duck-typed for .body.getReader())
 */
async function readWithSizeLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any,
  maxSize: number
): Promise<string | null> {
  const reader = response.body?.getReader()
  if (!reader) return null

  const decoder = new TextDecoder()
  let result = ""
  let totalSize = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      totalSize += value.length
      if (totalSize > maxSize) {
        reader.cancel()
        return null
      }

      result += decoder.decode(value, { stream: true })
    }

    // Flush remaining bytes
    result += decoder.decode()
    return result
  } catch {
    try { reader.cancel() } catch { /* ignore */ }
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
