/**
 * Content Extraction Pipeline
 * HTML → JSDOM → Readability → Turndown → clean Markdown
 *
 * Improvements:
 * - Preserves image alt text as content (helps image-heavy sites)
 * - Uses meta description as supplementary content when body text is thin
 * - Better resilience for homepage-style pages with minimal article content
 */

import { JSDOM } from "jsdom"
import { Readability } from "@mozilla/readability"
import TurndownService from "turndown"
import { CRAWL_MIN_CONTENT_LENGTH } from "./config"

// Shared Turndown instance
const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
})

// Remove scripts, iframes, styles from Markdown output
turndown.remove(["script", "style", "iframe", "noscript"])

// Preserve image alt text instead of dropping images entirely.
// Many sites (nonprofits, portfolios, homepages) convey meaning through
// alt text that would otherwise be lost, causing "Too little content" skips.
turndown.addRule("imageAltText", {
  filter: "img",
  replacement(_content, node) {
    const el = node as HTMLElement
    const alt = el.getAttribute("alt")?.trim()
    return alt ? ` ${alt} ` : ""
  },
})

/**
 * Extract meta description or og:description from a document.
 * These often contain a useful site summary, especially for homepages
 * and image-heavy pages where body content is thin after extraction.
 */
function extractMetaDescription(doc: Document): string {
  const metaDesc =
    doc.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ||
    doc.querySelector('meta[property="og:description"]')?.getAttribute("content")?.trim() ||
    ""
  // Cap at reasonable length and sanitize
  return metaDesc.substring(0, 500)
}

/**
 * Extract clean Markdown content from raw HTML
 *
 * Pipeline: HTML → JSDOM → Readability → Turndown → Markdown
 * Falls back to body text if Readability returns null
 *
 * @returns Markdown content, or null if content is too short (< 100 chars)
 */
export function extractContent(
  html: string,
  url: string
): { content: string; title: string } | null {
  // runScripts: undefined = don't execute any scripts (safe default, explicit for clarity)
  const dom = new JSDOM(html, { url, runScripts: undefined })
  const doc = dom.window.document

  // Extract meta description early (before DOM modifications)
  const metaDescription = extractMetaDescription(doc)

  // Try Readability first (Firefox Reader View engine)
  let articleHtml: string | null = null
  let title = ""

  try {
    const reader = new Readability(doc.cloneNode(true) as Document)
    const article = reader.parse()
    if (article) {
      articleHtml = article.content ?? null
      title = article.title || ""
    }
  } catch {
    // Readability failed — fall through to fallback
  }

  // Fallback: strip non-content elements and extract body text
  if (!articleHtml) {
    title = doc.title || ""
    // Remove elements that are typically non-content
    const removeSelectors = "script, style, nav, footer, header, aside, [role=navigation], [role=banner], [role=contentinfo], .nav, .footer, .header, .sidebar, .menu, .advertisement, .ad"
    doc.querySelectorAll(removeSelectors).forEach((el) => el.remove())

    articleHtml = doc.body?.innerHTML || null
  }

  if (!articleHtml) {
    return null
  }

  // Convert HTML to Markdown
  let markdown = turndown.turndown(articleHtml).trim()

  // If body content is thin, supplement with meta description.
  // This rescues homepage-style pages that rely on images/navigation but
  // have a good meta description (e.g., nonprofit homepages, portfolios).
  if (markdown.length < CRAWL_MIN_CONTENT_LENGTH && metaDescription) {
    markdown = metaDescription + (markdown ? "\n\n" + markdown : "")
    markdown = markdown.trim()
  }

  // Skip low-value pages (login forms, error pages, etc.)
  if (markdown.length < CRAWL_MIN_CONTENT_LENGTH) {
    return null
  }

  // Clean up excessive whitespace
  const cleaned = markdown
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return {
    content: cleaned,
    title: title || extractTitleFromUrl(url),
  }
}

/**
 * Extract a reasonable title from a URL path
 */
function extractTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname
    if (path === "/" || path === "") return parsed.hostname
    // Use last path segment, cleaned up
    const segments = path.split("/").filter(Boolean)
    const last = segments[segments.length - 1] || parsed.hostname
    return last
      .replace(/[-_]/g, " ")
      .replace(/\.\w+$/, "")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  } catch {
    return "Untitled"
  }
}

/**
 * Count words in text content
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length
}
