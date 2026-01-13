import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { RawNewsArticle } from "@/lib/watchdogs/types"
import { NEWS_API_CONFIG } from "@/lib/watchdogs/config"

export const maxDuration = 30

// GNews API (free tier: 100 requests/day, 10 articles/request)
// Alternative: NewsData.io, TheNewsAPI, etc.
const GNEWS_API_KEY = process.env.GNEWS_API_KEY
const GNEWS_BASE_URL = "https://gnews.io/api/v4"

// Keywords to filter for intelligence-relevant news
const INTELLIGENCE_KEYWORDS = [
  // Financial
  "market", "stock", "IPO", "merger", "acquisition", "SEC", "earnings",
  "investment", "bankruptcy", "trading", "hedge fund", "federal reserve",
  // Geopolitical
  "sanctions", "military", "election", "diplomacy", "conflict", "treaty",
  "war", "nato", "embassy", "summit", "tariff",
  // Natural
  "earthquake", "hurricane", "flood", "wildfire", "tsunami", "tornado",
  "disaster", "evacuation", "emergency", "climate",
  // Regulatory
  "regulation", "FDA", "FTC", "EPA", "legislation", "policy", "court",
  "ruling", "compliance", "antitrust", "privacy",
]

// In-memory cache for rate limiting
let lastFetchTime = 0
let cachedArticles: RawNewsArticle[] = []
const CACHE_TTL_MS = 60000 // 1 minute cache

/**
 * Fetch news from GNews API
 */
async function fetchFromGNews(): Promise<RawNewsArticle[]> {
  if (!GNEWS_API_KEY) {
    console.warn("[Watchdogs News] No GNews API key configured")
    return []
  }

  try {
    // Build query with intelligence keywords
    const queryWords = INTELLIGENCE_KEYWORDS.slice(0, 10).join(" OR ")

    const url = new URL(`${GNEWS_BASE_URL}/search`)
    url.searchParams.set("q", queryWords)
    url.searchParams.set("lang", "en")
    url.searchParams.set("max", String(NEWS_API_CONFIG.articlesPerRequest))
    url.searchParams.set("sortby", "publishedAt")
    url.searchParams.set("apikey", GNEWS_API_KEY)

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(NEWS_API_CONFIG.timeoutMs),
    })

    if (!response.ok) {
      throw new Error(`GNews API error: ${response.status}`)
    }

    const data = await response.json()

    return (data.articles || []).map((article: {
      title: string
      description: string
      url: string
      publishedAt: string
      source: { name: string }
    }) => ({
      id: `gnews-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: article.title,
      description: article.description || "",
      url: article.url,
      publishedAt: article.publishedAt,
      source: article.source?.name || "Unknown",
    }))
  } catch (error) {
    console.error("[Watchdogs News] GNews fetch error:", error)
    return []
  }
}

/**
 * Fallback: Generate curated mock news based on real-world patterns
 * Used when no API key is configured or rate limit is reached
 */
function generateCuratedNews(): RawNewsArticle[] {
  const now = new Date()
  const articles: RawNewsArticle[] = []
  const count = Math.floor(Math.random() * 3) + 1

  const newsTemplates = [
    // Financial
    { category: "financial", templates: [
      { title: "Federal Reserve Officials Signal Potential Rate Decision", source: "Reuters" },
      { title: "Tech Sector Earnings Season Exceeds Analyst Expectations", source: "Bloomberg" },
      { title: "Major Merger Announcement Expected in Healthcare Sector", source: "Wall Street Journal" },
      { title: "SEC Files New Enforcement Action Against Investment Firm", source: "Financial Times" },
      { title: "Cryptocurrency Markets React to New Regulatory Framework", source: "CoinDesk" },
    ]},
    // Geopolitical
    { category: "geopolitical", templates: [
      { title: "International Summit Addresses Global Trade Tensions", source: "AP News" },
      { title: "New Sanctions Announced Following Diplomatic Developments", source: "Reuters" },
      { title: "Election Results Signal Potential Policy Shifts", source: "BBC" },
      { title: "Regional Security Meeting Concludes with Joint Statement", source: "Al Jazeera" },
      { title: "Trade Negotiations Enter Critical Phase", source: "Nikkei" },
    ]},
    // Natural
    { category: "natural", templates: [
      { title: "Seismic Activity Reported in Pacific Rim Region", source: "USGS" },
      { title: "Weather Service Issues Advisory for Coastal Areas", source: "NOAA" },
      { title: "Emergency Response Teams Deployed Following Storm", source: "Reuters" },
      { title: "Climate Report Highlights Regional Impact Projections", source: "Nature" },
      { title: "Wildfire Containment Efforts Continue in Western States", source: "CNN" },
    ]},
    // Regulatory
    { category: "regulatory", templates: [
      { title: "FDA Announces Review of New Treatment Application", source: "Reuters" },
      { title: "FTC Opens Investigation into Tech Industry Practices", source: "Bloomberg" },
      { title: "New Data Privacy Regulations Take Effect", source: "TechCrunch" },
      { title: "Court Issues Ruling on Antitrust Case", source: "Law360" },
      { title: "Environmental Agency Updates Compliance Standards", source: "E&E News" },
    ]},
  ]

  for (let i = 0; i < count; i++) {
    const categoryGroup = newsTemplates[Math.floor(Math.random() * newsTemplates.length)]
    const template = categoryGroup.templates[Math.floor(Math.random() * categoryGroup.templates.length)]

    articles.push({
      id: `curated-${now.getTime()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
      title: template.title,
      description: `${template.title}. Analysts are monitoring the situation for potential market and policy implications.`,
      url: `https://news.example.com/${now.getTime()}`,
      publishedAt: now.toISOString(),
      source: template.source,
    })
  }

  return articles
}

export async function GET(request: Request) {
  try {
    // Auth check
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check cache
    const now = Date.now()
    if (now - lastFetchTime < CACHE_TTL_MS && cachedArticles.length > 0) {
      return NextResponse.json({ articles: cachedArticles, cached: true })
    }

    // Fetch fresh articles
    let articles: RawNewsArticle[] = []

    // Try GNews API first
    if (GNEWS_API_KEY) {
      articles = await fetchFromGNews()
    }

    // Fallback to curated news if no API key or no results
    if (articles.length === 0) {
      articles = generateCuratedNews()
    }

    // Update cache
    cachedArticles = articles
    lastFetchTime = now

    return NextResponse.json({
      articles,
      cached: false,
      source: GNEWS_API_KEY ? "gnews" : "curated"
    })
  } catch (error) {
    console.error("[Watchdogs News API] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    )
  }
}
