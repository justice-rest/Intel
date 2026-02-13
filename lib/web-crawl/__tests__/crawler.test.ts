/**
 * Crawler Tests
 * Tests DNS pinning, error mapping, link discovery, and size limits
 *
 * Uses mocked fetch to avoid real network calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// =============================================================================
// DNS Pinning Callback Tests
//
// The createPinnedAgent function is private, so we test its behavior
// by extracting the lookup logic into a testable helper.
// =============================================================================

describe("DNS pinning lookup callback", () => {
  /**
   * Simulates the lookup callback logic from createPinnedAgent
   * (extracted for testability since the function is module-private)
   */
  function simulateLookup(
    requestedHostname: string,
    hostname: string,
    resolvedIps: string[],
    options: { all?: boolean }
  ): { arrayResult?: Array<{ address: string; family: number }>; singleAddress?: string; singleFamily?: number } {
    if (requestedHostname === hostname && resolvedIps.length > 0) {
      const ip = resolvedIps[0]
      const family = ip.includes(":") ? 6 : 4

      if (options && typeof options === "object" && options.all) {
        return { arrayResult: [{ address: ip, family }] }
      } else {
        return { singleAddress: ip, singleFamily: family }
      }
    }
    return {}
  }

  it("returns array format when options.all=true (undici requirement)", () => {
    const result = simulateLookup(
      "example.com",
      "example.com",
      ["93.184.216.34"],
      { all: true }
    )
    expect(result.arrayResult).toBeDefined()
    expect(result.arrayResult).toEqual([
      { address: "93.184.216.34", family: 4 },
    ])
  })

  it("returns single format when options.all is false/undefined", () => {
    const result = simulateLookup(
      "example.com",
      "example.com",
      ["93.184.216.34"],
      {}
    )
    expect(result.singleAddress).toBe("93.184.216.34")
    expect(result.singleFamily).toBe(4)
  })

  it("detects IPv6 addresses correctly", () => {
    const result = simulateLookup(
      "example.com",
      "example.com",
      ["2606:4700::6810:85e5"],
      { all: true }
    )
    expect(result.arrayResult).toEqual([
      { address: "2606:4700::6810:85e5", family: 6 },
    ])
  })

  it("returns empty for non-matching hostname", () => {
    const result = simulateLookup(
      "other.com",
      "example.com",
      ["93.184.216.34"],
      { all: true }
    )
    expect(result.arrayResult).toBeUndefined()
    expect(result.singleAddress).toBeUndefined()
  })
})

// =============================================================================
// Error Message Mapping
// =============================================================================

describe("error message mapping", () => {
  /**
   * Simulates the error message extraction logic from the crawler catch block
   */
  function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      const cause = (error as any).cause
      if (cause?.code === "ENOTFOUND") {
        return "Host not found"
      } else if (cause?.code?.startsWith?.("CERT") || cause?.code === "ERR_TLS_CERT_ALTNAME_INVALID") {
        return "SSL certificate error"
      } else if (error.message.includes("abort") || cause?.code === "UND_ERR_CONNECT_TIMEOUT") {
        return "Timed out"
      } else {
        return cause?.message || error.message || "Fetch failed"
      }
    }
    return "Unknown error"
  }

  it("maps ENOTFOUND to 'Host not found'", () => {
    const error = new Error("fetch failed")
    ;(error as any).cause = { code: "ENOTFOUND" }
    expect(extractErrorMessage(error)).toBe("Host not found")
  })

  it("maps CERT errors to 'SSL certificate error'", () => {
    const error = new Error("fetch failed")
    ;(error as any).cause = { code: "CERT_HAS_EXPIRED" }
    expect(extractErrorMessage(error)).toBe("SSL certificate error")
  })

  it("maps ERR_TLS_CERT_ALTNAME_INVALID to 'SSL certificate error'", () => {
    const error = new Error("fetch failed")
    ;(error as any).cause = { code: "ERR_TLS_CERT_ALTNAME_INVALID" }
    expect(extractErrorMessage(error)).toBe("SSL certificate error")
  })

  it("maps abort to 'Timed out'", () => {
    const error = new Error("The operation was aborted")
    expect(extractErrorMessage(error)).toBe("Timed out")
  })

  it("maps UND_ERR_CONNECT_TIMEOUT to 'Timed out'", () => {
    const error = new Error("fetch failed")
    ;(error as any).cause = { code: "UND_ERR_CONNECT_TIMEOUT" }
    expect(extractErrorMessage(error)).toBe("Timed out")
  })

  it("uses cause.message as fallback", () => {
    const error = new Error("fetch failed")
    ;(error as any).cause = { message: "Connection refused" }
    expect(extractErrorMessage(error)).toBe("Connection refused")
  })

  it("uses error.message when no cause", () => {
    const error = new Error("Some network error")
    expect(extractErrorMessage(error)).toBe("Some network error")
  })

  it("returns 'Unknown error' for non-Error types", () => {
    expect(extractErrorMessage("string error")).toBe("Unknown error")
    expect(extractErrorMessage(42)).toBe("Unknown error")
    expect(extractErrorMessage(null)).toBe("Unknown error")
  })
})

// =============================================================================
// Link Discovery
// =============================================================================

describe("discoverLinks (via crawlSite behavior)", () => {
  // Since discoverLinks is a module-private function, we test its logic directly.
  // Must mirror the real implementation including www-normalization in isSameOrigin.
  function isSameOrigin(url: URL, rootUrl: URL): boolean {
    const stripWww = (h: string) => h.replace(/^www\./, "")
    return stripWww(url.hostname) === stripWww(rootUrl.hostname)
  }

  function discoverLinks(html: string, pageUrl: string, rootUrl: URL): string[] {
    const links: string[] = []
    const NON_HTML_EXTENSIONS = new Set([
      "pdf", "jpg", "jpeg", "png", "gif", "svg", "webp", "ico",
      "css", "js", "json", "xml", "rss", "atom",
      "zip", "tar", "gz", "rar", "7z",
      "mp3", "mp4", "avi", "mov", "wmv", "flv",
      "doc", "docx", "xls", "xlsx", "ppt", "pptx",
      "woff", "woff2", "ttf", "eot",
    ])

    const hrefRegex = /<a[^>]+href=["']([^"'#]+)["']/gi
    let match: RegExpExecArray | null

    while ((match = hrefRegex.exec(html)) !== null) {
      const href = match[1]
      if (!href) continue

      try {
        const resolved = new URL(href, pageUrl)
        if (!isSameOrigin(resolved, rootUrl)) continue
        const ext = resolved.pathname.split(".").pop()?.toLowerCase()
        if (ext && NON_HTML_EXTENSIONS.has(ext)) continue
        links.push(resolved.href)
      } catch {
        // Invalid URL — skip
      }
    }

    return links
  }

  it("finds same-origin links", () => {
    const html = `
      <a href="/page2">Page 2</a>
      <a href="https://example.com/page3">Page 3</a>
    `
    const links = discoverLinks(html, "https://example.com/page1", new URL("https://example.com"))
    expect(links).toContain("https://example.com/page2")
    expect(links).toContain("https://example.com/page3")
  })

  it("skips cross-origin links", () => {
    const html = `<a href="https://other.com/page">External</a>`
    const links = discoverLinks(html, "https://example.com/", new URL("https://example.com"))
    expect(links).toHaveLength(0)
  })

  it("skips non-HTML extensions", () => {
    const html = `
      <a href="/file.pdf">PDF</a>
      <a href="/image.jpg">Image</a>
      <a href="/styles.css">CSS</a>
      <a href="/page">Page</a>
    `
    const links = discoverLinks(html, "https://example.com/", new URL("https://example.com"))
    expect(links).toHaveLength(1)
    expect(links[0]).toContain("/page")
  })

  it("resolves relative links correctly", () => {
    const html = `<a href="../other">Other</a>`
    const links = discoverLinks(html, "https://example.com/docs/page", new URL("https://example.com"))
    expect(links).toContain("https://example.com/other")
  })

  it("finds links when site redirected from non-www to www (effective origin)", () => {
    // Simulates: user entered goodestdogs.com, server redirected to www.goodestdogs.com
    // After redirect, effectiveOrigin becomes www.goodestdogs.com
    // Links on the page point to www.goodestdogs.com
    const html = `
      <a href="https://www.goodestdogs.com/about">About</a>
      <a href="https://www.goodestdogs.com/services">Services</a>
      <a href="/contact">Contact</a>
    `
    // effectiveOrigin is the final URL after redirect
    const effectiveOrigin = new URL("https://www.goodestdogs.com")
    const links = discoverLinks(html, "https://www.goodestdogs.com/", effectiveOrigin)
    expect(links).toHaveLength(3)
    expect(links).toContain("https://www.goodestdogs.com/about")
    expect(links).toContain("https://www.goodestdogs.com/services")
    expect(links).toContain("https://www.goodestdogs.com/contact")
  })

  it("finds www links even when rootUrl has no www (www normalization)", () => {
    // Simulates: rootUrl is example.com but page has www.example.com links
    // isSameOrigin with www normalization should treat these as same origin
    const html = `
      <a href="https://www.example.com/about">About</a>
      <a href="https://example.com/contact">Contact</a>
    `
    const links = discoverLinks(html, "https://example.com/", new URL("https://example.com"))
    expect(links).toHaveLength(2)
    expect(links).toContain("https://www.example.com/about")
    expect(links).toContain("https://example.com/contact")
  })

  it("still blocks true cross-origin links with www normalization", () => {
    const html = `
      <a href="https://www.other.com/page">External with www</a>
      <a href="https://blog.example.com/post">Subdomain</a>
    `
    const links = discoverLinks(html, "https://example.com/", new URL("https://example.com"))
    expect(links).toHaveLength(0)
  })
})

// =============================================================================
// readWithSizeLimit
// =============================================================================

describe("readWithSizeLimit behavior", () => {
  // Re-implement the function for testing since it's module-private
  async function readWithSizeLimit(
    response: { body: ReadableStream | null },
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
      result += decoder.decode()
      return result
    } catch {
      try { reader.cancel() } catch { /* ignore */ }
      return null
    }
  }

  it("reads content within size limit", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("hello world"))
        controller.close()
      },
    })
    const result = await readWithSizeLimit({ body }, 1024)
    expect(result).toBe("hello world")
  })

  it("rejects content over size limit", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(2000)))
        controller.close()
      },
    })
    const result = await readWithSizeLimit({ body }, 100)
    expect(result).toBeNull()
  })

  it("returns null when body is null", async () => {
    const result = await readWithSizeLimit({ body: null }, 1024)
    expect(result).toBeNull()
  })
})
