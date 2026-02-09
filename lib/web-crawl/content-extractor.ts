/**
 * Content Extraction Pipeline
 * HTML → JSDOM → Readability → Turndown → clean Markdown
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

// Remove images, scripts, iframes from Markdown output
turndown.remove(["img", "script", "style", "iframe", "noscript"])

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
  const markdown = turndown.turndown(articleHtml).trim()

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
