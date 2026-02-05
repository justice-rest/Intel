import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * Fetch Open Graph metadata from a URL for link previews
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 })
  }

  try {
    // Fetch the page with a timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RomyBot/1.0; +https://getromy.app)",
      },
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      return NextResponse.json({
        title: new URL(url).hostname,
        description: url
      })
    }

    const html = await response.text()

    // Extract OG metadata
    const title = extractMeta(html, "og:title") ||
                  extractMeta(html, "twitter:title") ||
                  extractTitle(html) ||
                  new URL(url).hostname

    const description = extractMeta(html, "og:description") ||
                       extractMeta(html, "twitter:description") ||
                       extractMeta(html, "description") ||
                       ""

    return NextResponse.json({
      title: title.slice(0, 100),
      description: description.slice(0, 200)
    }, {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400", // Cache for 24h
      }
    })
  } catch (error) {
    // Return fallback on error
    try {
      return NextResponse.json({
        title: new URL(url).hostname,
        description: url
      })
    } catch {
      return NextResponse.json({
        title: "Link",
        description: url
      })
    }
  }
}

function extractMeta(html: string, property: string): string | null {
  // Try property attribute (og:*, twitter:*)
  const propertyMatch = html.match(
    new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, "i")
  )
  if (propertyMatch) return decodeHtmlEntities(propertyMatch[1])

  // Try content before property
  const contentFirstMatch = html.match(
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, "i")
  )
  if (contentFirstMatch) return decodeHtmlEntities(contentFirstMatch[1])

  // Try name attribute (description)
  const nameMatch = html.match(
    new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, "i")
  )
  if (nameMatch) return decodeHtmlEntities(nameMatch[1])

  // Try content before name
  const nameContentFirstMatch = html.match(
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${property}["']`, "i")
  )
  if (nameContentFirstMatch) return decodeHtmlEntities(nameContentFirstMatch[1])

  return null
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return match ? decodeHtmlEntities(match[1].trim()) : null
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
}
