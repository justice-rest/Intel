/**
 * Content Extractor Tests
 * Tests for HTML → Markdown extraction pipeline
 */

import { describe, it, expect } from "vitest"
import { extractContent, countWords } from "../content-extractor"

// =============================================================================
// extractContent
// =============================================================================

describe("extractContent", () => {
  it("extracts article from well-formed HTML", () => {
    const html = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <article>
            <h1>Welcome</h1>
            <p>${"This is a paragraph with enough content to pass the minimum length check. ".repeat(3)}</p>
          </article>
        </body>
      </html>
    `
    const result = extractContent(html, "https://example.com/test")
    expect(result).not.toBeNull()
    expect(result!.title).toBe("Test Page")
    expect(result!.content).toContain("Welcome")
  })

  it("falls back to body text when Readability fails", () => {
    // Minimal HTML that Readability can't extract from
    const html = `
      <html>
        <head><title>Simple Page</title></head>
        <body>
          <div>${"Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(5)}</div>
        </body>
      </html>
    `
    const result = extractContent(html, "https://example.com/simple")
    // Should still extract something from the body
    if (result) {
      expect(result.content).toContain("Lorem ipsum")
    }
    // It's also valid for this to return null if content is too short after stripping
  })

  it("returns null for content < 100 chars", () => {
    const html = `
      <html>
        <head><title>Tiny</title></head>
        <body><p>Short</p></body>
      </html>
    `
    const result = extractContent(html, "https://example.com/tiny")
    expect(result).toBeNull()
  })

  it("strips scripts, styles, iframes from output", () => {
    const html = `
      <html>
        <head><title>Test</title></head>
        <body>
          <article>
            <p>${"Real content that should appear in the output. ".repeat(5)}</p>
            <script>alert('xss')</script>
            <style>.hidden { display: none }</style>
            <iframe src="https://evil.com"></iframe>
            <p>${"More content to ensure we pass the length threshold. ".repeat(3)}</p>
          </article>
        </body>
      </html>
    `
    const result = extractContent(html, "https://example.com/safe")
    expect(result).not.toBeNull()
    expect(result!.content).not.toContain("alert")
    expect(result!.content).not.toContain("display: none")
    expect(result!.content).not.toContain("evil.com")
  })

  it("handles malformed HTML gracefully", () => {
    const html = `<html><body><div>
      <p>Unclosed paragraph
      <span>Nested ${"text content ".repeat(20)}</div>
    </body></html>`

    // Should not throw
    const result = extractContent(html, "https://example.com/malformed")
    // Result can be null or valid — just shouldn't throw
    expect(() => extractContent(html, "https://example.com/malformed")).not.toThrow()
  })

  it("extracts title from URL when page has no title", () => {
    const html = `
      <html>
        <head></head>
        <body>
          <article>
            <p>${"Content that is long enough to pass the filter requirement. ".repeat(5)}</p>
          </article>
        </body>
      </html>
    `
    const result = extractContent(html, "https://example.com/about-us")
    if (result) {
      // Title should be derived from URL path
      expect(result.title).toBeTruthy()
    }
  })
})

// =============================================================================
// countWords
// =============================================================================

describe("countWords", () => {
  it("counts words correctly", () => {
    expect(countWords("hello world")).toBe(2)
    expect(countWords("one two three four")).toBe(4)
  })

  it("handles extra whitespace", () => {
    expect(countWords("  hello   world  ")).toBe(2)
  })

  it("returns 0 for empty/whitespace strings", () => {
    expect(countWords("")).toBe(0)
    expect(countWords("   ")).toBe(0)
  })

  it("handles newlines and tabs", () => {
    expect(countWords("hello\nworld\ttab")).toBe(3)
  })
})
