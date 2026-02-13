/**
 * URL Validator Tests
 * Tests for SSRF prevention, URL normalization, robots.txt parsing
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock dns/promises before importing the module under test
vi.mock("dns/promises", () => ({
  resolve: vi.fn(),
}))

import {
  validateUrl,
  normalizeUrl,
  isSameOrigin,
  checkRobotsTxt,
} from "../url-validator"
import { resolve } from "dns/promises"

const mockResolve = vi.mocked(resolve)

beforeEach(() => {
  vi.resetAllMocks()
})

// =============================================================================
// validateUrl
// =============================================================================

describe("validateUrl", () => {
  it("accepts a valid HTTPS URL", async () => {
    mockResolve.mockResolvedValueOnce(["93.184.216.34"] as any)
    const result = await validateUrl("https://example.com")
    expect(result.valid).toBe(true)
    expect(result.url?.hostname).toBe("example.com")
    expect(result.resolvedIps).toEqual(["93.184.216.34"])
  })

  it("accepts a valid HTTP URL", async () => {
    mockResolve.mockResolvedValueOnce(["93.184.216.34"] as any)
    const result = await validateUrl("http://example.com")
    expect(result.valid).toBe(true)
  })

  it("rejects private IP 127.0.0.1 (loopback)", async () => {
    mockResolve.mockResolvedValueOnce(["127.0.0.1"] as any)
    const result = await validateUrl("https://evil.com")
    expect(result.valid).toBe(false)
    expect(result.error).toContain("security reasons")
  })

  it("rejects private IP 10.x.x.x (RFC 1918)", async () => {
    mockResolve.mockResolvedValueOnce(["10.0.0.1"] as any)
    const result = await validateUrl("https://evil.com")
    expect(result.valid).toBe(false)
    expect(result.error).toContain("security reasons")
  })

  it("rejects private IP 192.168.x.x (RFC 1918)", async () => {
    mockResolve.mockResolvedValueOnce(["192.168.1.1"] as any)
    const result = await validateUrl("https://evil.com")
    expect(result.valid).toBe(false)
  })

  it("rejects link-local IP 169.254.x.x", async () => {
    mockResolve.mockResolvedValueOnce(["169.254.169.254"] as any)
    const result = await validateUrl("https://evil.com")
    expect(result.valid).toBe(false)
  })

  it("rejects blocked hostnames (localhost)", async () => {
    const result = await validateUrl("https://localhost/admin")
    expect(result.valid).toBe(false)
    expect(result.error).toContain("not allowed for security reasons")
  })

  it("rejects blocked hostnames (metadata.google.internal)", async () => {
    const result = await validateUrl("https://metadata.google.internal/computeMetadata/v1/")
    expect(result.valid).toBe(false)
    expect(result.error).toContain("not allowed for security reasons")
  })

  it("rejects non-HTTP protocols (file://)", async () => {
    const result = await validateUrl("file:///etc/passwd")
    expect(result.valid).toBe(false)
    expect(result.error).toContain("not allowed")
  })

  it("rejects non-HTTP protocols (ftp://)", async () => {
    const result = await validateUrl("ftp://ftp.example.com/files")
    expect(result.valid).toBe(false)
    expect(result.error).toContain("not allowed")
  })

  it("rejects javascript: protocol", async () => {
    const result = await validateUrl("javascript:alert(1)")
    expect(result.valid).toBe(false)
  })

  it("handles DNS resolution failure", async () => {
    mockResolve.mockRejectedValue(new Error("ENOTFOUND"))
    const result = await validateUrl("https://nonexistent.example.test")
    expect(result.valid).toBe(false)
    expect(result.error).toContain("Could not resolve hostname")
  })

  it("handles IPv6-only hosts (falls back to AAAA)", async () => {
    // First call (A records) fails, second call (AAAA) succeeds
    mockResolve
      .mockRejectedValueOnce(new Error("ENODATA"))
      .mockResolvedValueOnce(["2606:4700::6810:85e5"] as any)

    const result = await validateUrl("https://ipv6only.example.com")
    expect(result.valid).toBe(true)
    expect(result.resolvedIps).toEqual(["2606:4700::6810:85e5"])
    // Verify AAAA was called
    expect(mockResolve).toHaveBeenCalledTimes(2)
    expect(mockResolve).toHaveBeenCalledWith("ipv6only.example.com", "AAAA")
  })

  it("rejects invalid URL format", async () => {
    const result = await validateUrl("not-a-url")
    expect(result.valid).toBe(false)
    expect(result.error).toBe("Invalid URL format")
  })

  it("trims whitespace from URL", async () => {
    mockResolve.mockResolvedValueOnce(["93.184.216.34"] as any)
    const result = await validateUrl("  https://example.com  ")
    expect(result.valid).toBe(true)
    expect(result.url?.hostname).toBe("example.com")
  })
})

// =============================================================================
// normalizeUrl
// =============================================================================

describe("normalizeUrl", () => {
  it("strips URL fragments", () => {
    const result = normalizeUrl("https://example.com/page#section")
    expect(result).toBe("https://example.com/page")
  })

  it("sorts query params for deduplication", () => {
    const result = normalizeUrl("https://example.com?z=1&a=2")
    expect(result).toBe("https://example.com/?a=2&z=1")
  })

  it("removes trailing slashes (except root)", () => {
    expect(normalizeUrl("https://example.com/path/")).toBe(
      "https://example.com/path"
    )
    expect(normalizeUrl("https://example.com/")).toBe(
      "https://example.com/"
    )
  })

  it("returns null for invalid URLs", () => {
    expect(normalizeUrl("not-a-url")).toBeNull()
  })

  it("resolves relative URLs with baseUrl", () => {
    const result = normalizeUrl("/about", "https://example.com")
    expect(result).toBe("https://example.com/about")
  })
})

// =============================================================================
// isSameOrigin
// =============================================================================

describe("isSameOrigin", () => {
  it("returns true for same hostname", () => {
    const a = new URL("https://example.com/page1")
    const b = new URL("https://example.com/page2")
    expect(isSameOrigin(a, b)).toBe(true)
  })

  it("returns false for different hostname", () => {
    const a = new URL("https://example.com/page")
    const b = new URL("https://other.com/page")
    expect(isSameOrigin(a, b)).toBe(false)
  })

  it("returns false for subdomain vs root", () => {
    const a = new URL("https://sub.example.com/page")
    const b = new URL("https://example.com/page")
    expect(isSameOrigin(a, b)).toBe(false)
  })

  it("treats www.example.com and example.com as same origin", () => {
    const a = new URL("https://www.example.com/about")
    const b = new URL("https://example.com")
    expect(isSameOrigin(a, b)).toBe(true)
  })

  it("treats example.com and www.example.com as same origin (reverse)", () => {
    const a = new URL("https://example.com/about")
    const b = new URL("https://www.example.com")
    expect(isSameOrigin(a, b)).toBe(true)
  })

  it("treats www.example.com and www.example.com as same origin", () => {
    const a = new URL("https://www.example.com/page1")
    const b = new URL("https://www.example.com/page2")
    expect(isSameOrigin(a, b)).toBe(true)
  })

  it("returns false for non-www subdomain even with www normalization", () => {
    const a = new URL("https://blog.example.com/page")
    const b = new URL("https://www.example.com")
    expect(isSameOrigin(a, b)).toBe(false)
  })
})

// =============================================================================
// checkRobotsTxt / isPathAllowed (via checkRobotsTxt)
// =============================================================================

describe("checkRobotsTxt", () => {
  it("allows crawling when robots.txt is 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", { status: 404 })
    )
    const result = await checkRobotsTxt(new URL("https://example.com"), "/")
    expect(result.allowed).toBe(true)
  })

  it("respects Disallow directive for wildcard agent", async () => {
    const robotsTxt = `User-agent: *\nDisallow: /private/`
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(robotsTxt, { status: 200 })
    )
    const result = await checkRobotsTxt(
      new URL("https://example.com"),
      "/private/page"
    )
    expect(result.allowed).toBe(false)
  })

  it("allows paths not matched by Disallow", async () => {
    const robotsTxt = `User-agent: *\nDisallow: /private/`
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(robotsTxt, { status: 200 })
    )
    const result = await checkRobotsTxt(
      new URL("https://example.com"),
      "/public/page"
    )
    expect(result.allowed).toBe(true)
  })

  it("respects Allow override for more specific path", async () => {
    const robotsTxt = `User-agent: *\nDisallow: /docs/\nAllow: /docs/public/`
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(robotsTxt, { status: 200 })
    )
    const result = await checkRobotsTxt(
      new URL("https://example.com"),
      "/docs/public/readme"
    )
    expect(result.allowed).toBe(true)
  })

  it("uses RomyBot-specific rules when present", async () => {
    const robotsTxt = `User-agent: *\nDisallow:\n\nUser-agent: romybot\nDisallow: /`
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(robotsTxt, { status: 200 })
    )
    const result = await checkRobotsTxt(
      new URL("https://example.com"),
      "/page"
    )
    expect(result.allowed).toBe(false)
  })

  it("allows crawling on network error (fail-open)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error")
    )
    const result = await checkRobotsTxt(new URL("https://example.com"), "/")
    expect(result.allowed).toBe(true)
  })
})
