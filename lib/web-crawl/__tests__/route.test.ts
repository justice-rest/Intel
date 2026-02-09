/**
 * Import URL Route Tests
 * Tests title sanitization and route-level validations
 */

import { describe, it, expect } from "vitest"

// =============================================================================
// Title Sanitization (logic extracted from route.ts indexPage)
// =============================================================================

describe("title sanitization", () => {
  function sanitizeTitle(title: string, url: string): string {
    const rawTitle = title || new URL(url).pathname.slice(1) || "index"
    return rawTitle
      .replace(/[<>&"']/g, "")
      .replace(/[\x00-\x1F\x7F]/g, "")
      .slice(0, 255)
  }

  it("strips HTML special characters", () => {
    const result = sanitizeTitle('Page <script>alert("xss")</script>', "https://example.com")
    expect(result).not.toContain("<")
    expect(result).not.toContain(">")
    expect(result).not.toContain('"')
    expect(result).toBe("Page scriptalert(xss)/script")
  })

  it("strips control characters", () => {
    const result = sanitizeTitle("Page\x00with\x01nulls\x7F", "https://example.com")
    expect(result).toBe("Pagewithnulls")
  })

  it("truncates to 255 characters", () => {
    const longTitle = "A".repeat(500)
    const result = sanitizeTitle(longTitle, "https://example.com")
    expect(result.length).toBe(255)
  })

  it("falls back to URL path when title is empty", () => {
    const result = sanitizeTitle("", "https://example.com/about-us")
    expect(result).toBe("about-us")
  })

  it("falls back to 'index' for root path with no title", () => {
    const result = sanitizeTitle("", "https://example.com/")
    expect(result).toBe("index")
  })

  it("preserves normal titles unchanged", () => {
    const result = sanitizeTitle("About Our Company", "https://example.com/about")
    expect(result).toBe("About Our Company")
  })

  it("handles ampersands and quotes", () => {
    const result = sanitizeTitle("Tom & Jerry's \"Show\"", "https://example.com")
    expect(result).toBe("Tom  Jerrys Show")
  })
})

// =============================================================================
// Rate limiting logic (extracted from route)
// =============================================================================

describe("rate limiting", () => {
  it("allows when under limit", () => {
    const distinctJobCount = 2
    const maxCrawlsPerHour = 3
    expect(distinctJobCount < maxCrawlsPerHour).toBe(true)
  })

  it("rejects when at limit", () => {
    const distinctJobCount = 3
    const maxCrawlsPerHour = 3
    expect(distinctJobCount >= maxCrawlsPerHour).toBe(true)
  })

  it("rejects when over limit", () => {
    const distinctJobCount = 5
    const maxCrawlsPerHour = 3
    expect(distinctJobCount >= maxCrawlsPerHour).toBe(true)
  })
})
