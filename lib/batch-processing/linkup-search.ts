/**
 * LinkUp Batch Search Module
 * Optimized LinkUp integration for batch prospect research
 *
 * Uses standard depth with highly optimized queries for cost efficiency
 * while maintaining research quality through precise prompt engineering
 */

import { LinkupClient } from "linkup-sdk"

// ============================================================================
// TYPES
// ============================================================================

export interface LinkupBatchResult {
  answer: string
  sources: Array<{
    name: string
    url: string
    snippet?: string
  }>
  query: string
  tokensUsed: number // Estimated
  durationMs: number
  error?: string
}

export interface ProspectInput {
  name: string
  address?: string
  employer?: string
  title?: string
  city?: string
  state?: string
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const LINKUP_BATCH_TIMEOUT_MS = 30000 // 30s for batch (faster than chat)
const MAX_RETRIES = 3
const BASE_RETRY_DELAY_MS = 1500

/**
 * Check if LinkUp is available for batch processing
 */
export function isLinkupAvailable(apiKey?: string): boolean {
  return !!(apiKey || process.env.LINKUP_API_KEY)
}

// ============================================================================
// OPTIMIZED QUERY BUILDER
// ============================================================================

/**
 * Build a HIGHLY optimized query for LinkUp
 * Engineered for MAXIMUM data extraction with prospect research focus
 *
 * Key optimizations:
 * 1. Search-engine-friendly keyword structure
 * 2. Explicit source domains to check
 * 3. Multiple search angles (property, business, philanthropy)
 * 4. Disambiguation hints from all available context
 * 5. Specific data point requests that LinkUp excels at finding
 */
export function buildOptimizedBatchQuery(prospect: ProspectInput): string {
  const { name, address, employer, title, city, state } = prospect

  // Build comprehensive location context
  const locationParts = [city, state].filter(Boolean)
  const location = locationParts.join(", ")

  // Build professional context for disambiguation
  const professionalContext = [title, employer].filter(Boolean).join(" at ")

  // Extract first and last name for search variations
  const nameParts = name.trim().split(/\s+/)
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]
  const searchableName = nameParts.length > 2 ? `${firstName} ${lastName}` : name

  return `COMPREHENSIVE PROSPECT RESEARCH: "${name}"

IDENTITY CONTEXT (use for disambiguation):
• Full name: ${name}
• Search variant: ${searchableName}
${address ? `• Address: ${address}` : ""}
${location ? `• Location: ${location}` : ""}
${professionalContext ? `• Professional: ${professionalContext}` : ""}

SEARCH THESE SPECIFIC SOURCES AND DATABASES:

1. REAL ESTATE (HIGH PRIORITY)
   Search: Zillow, Redfin, Realtor.com, county assessor records
   Find: "${searchableName}" property owner ${location}
   Extract: Property addresses, Zestimate/values, purchase price, year bought
   Note: Look for MULTIPLE properties (vacation homes, investment properties)

2. BUSINESS OWNERSHIP
   Search: LinkedIn, Crunchbase, Bloomberg, state SOS business registries
   Find: "${name}" CEO, founder, owner, president, executive
   Extract: Company names, roles, founding dates, revenue estimates, exits/acquisitions

3. SEC & PUBLIC COMPANY (if executive/board member)
   Search: SEC EDGAR, Yahoo Finance insider transactions
   Find: "${searchableName}" Form 4, Form 3, DEF 14A
   Extract: Company tickers, insider status (officer/director/10% owner), stock holdings

4. POLITICAL GIVING
   Search: FEC.gov, OpenSecrets, state campaign finance databases
   Find: "${name}" ${location} political contributions
   Extract: Total amount, recipient names, party affiliation, largest single gift

5. PHILANTHROPY & FOUNDATIONS
   Search: ProPublica Nonprofit Explorer, Foundation Directory, GuideStar
   Find: "${name}" foundation board, trustee, donor, philanthropy
   Extract: Foundation names, board roles, disclosed gifts, causes supported

6. NEWS & BIOGRAPHY
   Search: Major news outlets, Wikipedia, alumni directories
   Find: "${name}" ${professionalContext || location}
   Extract: Age, education (degrees/schools), career highlights, family info, net worth mentions

OUTPUT FORMAT - BE SPECIFIC:
• Property 1: [Address] - Value: $X-$Y - Source: [URL]
• Business: [Company] - Role: [Title] - Est. Value: $X - Source: [URL]
• SEC Status: [Insider at TICKER] - Source: [SEC EDGAR URL]
• Political: $X total - [Party lean] - Source: [FEC URL]
• Foundation: [Name] - Role: [Board/Trustee] - Source: [URL]
• Background: [Age], [Education], [Career summary] - Sources: [URLs]

CRITICAL RULES:
1. EVERY fact needs a SOURCE URL - no exceptions
2. Use DOLLAR RANGES for estimates (e.g., "$2M-$5M" not "$3.5M")
3. Mark uncertain data as [Estimated] or [Unverified]
4. If nothing found for a category, explicitly say "Not found in public records"
5. Prioritize AUTHORITATIVE sources: SEC, FEC, county records, ProPublica, news outlets`
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelayMs: number = BASE_RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const errorMessage = lastError.message.toLowerCase()

      // NOTE: 401 is NOT retryable (auth failure won't fix with retry)
      const isRetryable =
        errorMessage.includes("429") || // Rate limit
        errorMessage.includes("502") ||
        errorMessage.includes("503") ||
        errorMessage.includes("504") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("econnreset") ||
        errorMessage.includes("econnrefused") ||
        errorMessage.includes("enotfound") ||
        errorMessage.includes("socket hang up")

      if (!isRetryable || attempt >= maxRetries - 1) {
        throw lastError
      }

      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500
      console.log(`[LinkUp Batch] Retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

// ============================================================================
// SOURCE NORMALIZATION
// ============================================================================

/**
 * Normalize URL for deduplication
 * Handles: www vs non-www, trailing slashes, fragments, case normalization
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.replace(/[.,;:!?]$/, "")) // Remove trailing punctuation

    // Normalize hostname (lowercase, remove www)
    let hostname = parsed.hostname.toLowerCase().replace(/^www\./, "")

    // Normalize path (remove trailing slash, lowercase)
    let path = parsed.pathname.replace(/\/+$/, "").toLowerCase()
    if (path === "") path = "/"

    // Remove fragments and sort query params
    const sortedParams = [...parsed.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&")

    return `${hostname}${path}${sortedParams ? `?${sortedParams}` : ""}`
  } catch {
    // If URL parsing fails, return cleaned original
    return url.replace(/[.,;:!?]$/, "").toLowerCase()
  }
}

function normalizeSources(
  sources: Array<{ name?: string; url?: string; snippet?: string; content?: string }>
): Array<{ name: string; url: string; snippet?: string }> {
  const normalized: Array<{ name: string; url: string; snippet?: string }> = []
  const seenUrls = new Set<string>()

  for (const source of sources) {
    if (!source.url) continue

    const originalUrl = source.url.replace(/[.,;:!?]$/, "")
    const normalizedKey = normalizeUrl(originalUrl)

    if (seenUrls.has(normalizedKey)) continue
    seenUrls.add(normalizedKey)

    let name = source.name
    if (!name) {
      try {
        name = new URL(originalUrl).hostname.replace("www.", "")
      } catch {
        name = "Source"
      }
    }

    normalized.push({
      name,
      url: originalUrl, // Keep original URL for display
      snippet: source.snippet || source.content,
    })
  }

  return normalized.slice(0, 20)
}

// ============================================================================
// MAIN BATCH SEARCH FUNCTION
// ============================================================================

/**
 * Execute LinkUp search optimized for batch processing
 *
 * Key differences from chat mode:
 * - Uses "standard" depth (faster, cheaper)
 * - Highly optimized query format
 * - Shorter timeout (30s vs 45s)
 * - Returns token estimate for cost tracking
 */
export async function linkupBatchSearch(
  prospect: ProspectInput,
  apiKey?: string
): Promise<LinkupBatchResult> {
  const startTime = Date.now()
  const key = apiKey || process.env.LINKUP_API_KEY

  if (!key) {
    return {
      answer: "",
      sources: [],
      query: "",
      tokensUsed: 0,
      durationMs: 0,
      error: "LINKUP_API_KEY not configured",
    }
  }

  const query = buildOptimizedBatchQuery(prospect)
  console.log(`[LinkUp Batch] Starting search for: ${prospect.name}`)

  try {
    const client = new LinkupClient({ apiKey: key })

    const result = await withRetry(async () => {
      const searchPromise = client.search({
        query,
        depth: "standard", // Standard depth for batch efficiency
        outputType: "sourcedAnswer",
        includeInlineCitations: true,
      })

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`LinkUp batch search timed out after ${LINKUP_BATCH_TIMEOUT_MS / 1000}s`)),
          LINKUP_BATCH_TIMEOUT_MS
        )
      )

      return Promise.race([searchPromise, timeoutPromise])
    })

    const durationMs = Date.now() - startTime
    const answer = typeof result === "object" && "answer" in result ? result.answer : ""
    const rawSources =
      typeof result === "object" && "sources" in result
        ? (result.sources as Array<{ name?: string; url?: string; snippet?: string; content?: string }>)
        : []

    const sources = normalizeSources(rawSources)

    // Estimate tokens (rough approximation)
    const tokensUsed = Math.ceil((query.length + (answer?.length || 0)) / 4)

    console.log(`[LinkUp Batch] Completed in ${durationMs}ms, ${sources.length} sources`)

    return {
      answer: answer || "",
      sources,
      query,
      tokensUsed,
      durationMs,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`[LinkUp Batch] Failed for ${prospect.name}:`, errorMessage)

    return {
      answer: "",
      sources: [],
      query,
      tokensUsed: Math.ceil(query.length / 4),
      durationMs,
      error: errorMessage,
    }
  }
}

// ============================================================================
// RESULT MERGING
// ============================================================================

// ============================================================================
// STRUCTURED DATA EXTRACTION FROM LINKUP ANSWER
// ============================================================================

export interface ExtractedLinkupData {
  properties: Array<{
    address?: string
    value?: number
    source?: string
  }>
  businesses: Array<{
    name?: string
    role?: string
    value?: number
  }>
  secFilings: {
    hasFilings: boolean
    tickers: string[]
  }
  politicalGiving: {
    total?: number
    partyLean?: string
  }
  foundations: string[]
  majorGifts: Array<{
    organization?: string
    amount?: number
  }>
  age?: number
  education: string[]
  netWorthMentioned?: { low?: number; high?: number }
}

/**
 * Extract structured data from LinkUp's answer text
 * Uses pattern matching to find specific wealth indicators
 */
function extractStructuredDataFromAnswer(answer: string): ExtractedLinkupData {
  const data: ExtractedLinkupData = {
    properties: [],
    businesses: [],
    secFilings: { hasFilings: false, tickers: [] },
    politicalGiving: {},
    foundations: [],
    majorGifts: [],
    education: [],
  }

  if (!answer) return data

  // ========== PROPERTY EXTRACTION ==========
  // Match patterns like "$1.5M", "$2,500,000", "$850K"
  const propertyPatterns = [
    // "Property 1: 123 Main St - Value: $1.5M"
    /property[^:]*:\s*([^-]+)-[^$]*\$([0-9,.]+[kmb]?)/gi,
    // "home valued at $2.5M"
    /home[^$]*\$([0-9,.]+[kmb]?)/gi,
    // "property worth $1.2M"
    /property[^$]*\$([0-9,.]+[kmb]?)/gi,
    // "Zestimate: $1,500,000"
    /zestimate[^$]*\$([0-9,.]+[kmb]?)/gi,
    // "purchased for $850K"
    /purchased[^$]*\$([0-9,.]+[kmb]?)/gi,
  ]

  for (const pattern of propertyPatterns) {
    const matches = answer.matchAll(pattern)
    for (const match of matches) {
      const valueStr = match[match.length - 1] // Last capture group is the value
      const value = parseValueString(valueStr)
      if (value && value > 50000) {
        // Minimum $50K to be a property
        data.properties.push({ value })
      }
    }
  }

  // ========== BUSINESS EXTRACTION ==========
  const businessPatterns = [
    // "CEO of Acme Corp", "founder of XYZ Inc"
    /(ceo|founder|owner|president|chairman)\s+(?:of|at)\s+([A-Z][A-Za-z0-9\s&]+(?:Inc|LLC|Corp|Co|Ltd)?)/gi,
    // "Business: Acme Corp - Role: CEO"
    /business[^:]*:\s*([^-]+)-[^:]*:\s*([A-Za-z]+)/gi,
  ]

  for (const pattern of businessPatterns) {
    const matches = answer.matchAll(pattern)
    for (const match of matches) {
      if (match[1] && match[2]) {
        data.businesses.push({
          role: match[1].trim(),
          name: match[2].trim(),
        })
      }
    }
  }

  // ========== SEC FILINGS ==========
  // Look for stock ticker mentions after SEC/Form 4 context
  const secPatterns = [
    /sec[^a-z]*insider[^a-z]*(?:at|for)\s+([A-Z]{1,5})/gi,
    /form\s*[34][^a-z]*([A-Z]{1,5})/gi,
    /insider\s+(?:at|for)\s+([A-Z]{1,5})/gi,
    /\b(AAPL|GOOGL|MSFT|AMZN|META|TSLA|NVDA|JPM|GS|WMT|HD|UNH|JNJ|PG|V|MA|BAC|XOM|CVX|PFE)\b/g,
  ]

  for (const pattern of secPatterns) {
    const matches = answer.matchAll(pattern)
    for (const match of matches) {
      const ticker = match[1]?.toUpperCase()
      if (ticker && ticker.length >= 1 && ticker.length <= 5 && !data.secFilings.tickers.includes(ticker)) {
        data.secFilings.tickers.push(ticker)
        data.secFilings.hasFilings = true
      }
    }
  }

  // ========== POLITICAL GIVING ==========
  const politicalPatterns = [
    /political[^$]*\$([0-9,.]+[kmb]?)/gi,
    /fec[^$]*\$([0-9,.]+[kmb]?)/gi,
    /contributions?[^$]*\$([0-9,.]+[kmb]?)/gi,
    /donated[^$]*\$([0-9,.]+[kmb]?)[^a-z]*(?:to\s+)?(republican|democrat|gop|dnc|rnc)/gi,
  ]

  for (const pattern of politicalPatterns) {
    const matches = answer.matchAll(pattern)
    for (const match of matches) {
      const value = parseValueString(match[1])
      if (value && (!data.politicalGiving.total || value > data.politicalGiving.total)) {
        data.politicalGiving.total = value
      }
      // Check for party affiliation
      if (match[2]) {
        const party = match[2].toLowerCase()
        if (party.includes("republican") || party.includes("gop") || party.includes("rnc")) {
          data.politicalGiving.partyLean = "REPUBLICAN"
        } else if (party.includes("democrat") || party.includes("dnc")) {
          data.politicalGiving.partyLean = "DEMOCRATIC"
        }
      }
    }
  }

  // ========== FOUNDATIONS ==========
  const foundationPattern = /(?:board|trustee|director)[^a-z]*(?:of|at)\s+([A-Z][A-Za-z\s]+(?:Foundation|Fund|Trust))/gi
  const foundationMatches = answer.matchAll(foundationPattern)
  for (const match of foundationMatches) {
    if (match[1] && !data.foundations.includes(match[1].trim())) {
      data.foundations.push(match[1].trim())
    }
  }

  // ========== MAJOR GIFTS ==========
  const giftPatterns = [
    /gift[^$]*\$([0-9,.]+[kmb]?)[^a-z]*(?:to\s+)?([A-Z][A-Za-z\s]+)/gi,
    /donated?\s+\$([0-9,.]+[kmb]?)[^a-z]*(?:to\s+)?([A-Z][A-Za-z\s]+)/gi,
  ]

  for (const pattern of giftPatterns) {
    const matches = answer.matchAll(pattern)
    for (const match of matches) {
      const amount = parseValueString(match[1])
      if (amount && amount >= 10000) {
        // Major gift = $10K+
        data.majorGifts.push({
          amount,
          organization: match[2]?.trim(),
        })
      }
    }
  }

  // ========== NET WORTH ==========
  const netWorthPatterns = [
    /net\s*worth[^$]*\$([0-9,.]+[kmb]?)\s*-\s*\$([0-9,.]+[kmb]?)/gi, // Range
    /net\s*worth[^$]*\$([0-9,.]+[kmb]?)/gi, // Single value
    /worth[^$]*\$([0-9,.]+[kmb]?)\s*million/gi,
  ]

  for (const pattern of netWorthPatterns) {
    const matches = answer.matchAll(pattern)
    for (const match of matches) {
      const low = parseValueString(match[1])
      const high = match[2] ? parseValueString(match[2]) : low
      if (low && low > 100000) {
        // Min $100K to be meaningful
        data.netWorthMentioned = { low, high }
        break
      }
    }
  }

  // ========== AGE ==========
  const agePatterns = [/age[:\s]+(\d{2})/gi, /(\d{2})\s*years?\s*old/gi, /born\s+(?:in\s+)?(\d{4})/gi]

  for (const pattern of agePatterns) {
    const match = pattern.exec(answer)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > 1900 && num < 2010) {
        // Birth year
        data.age = new Date().getFullYear() - num
      } else if (num >= 25 && num <= 100) {
        // Direct age
        data.age = num
      }
      break
    }
  }

  // ========== EDUCATION ==========
  const educationPatterns = [
    /(?:graduated|alumni|degree)[^a-z]*(?:from|of)\s+([A-Z][A-Za-z\s]+(?:University|College|School|Institute))/gi,
    /(MBA|PhD|JD|MD|BS|BA|MS|MA)[^a-z]*(?:from|,)\s+([A-Z][A-Za-z\s]+)/gi,
  ]

  for (const pattern of educationPatterns) {
    const matches = answer.matchAll(pattern)
    for (const match of matches) {
      const edu = match[match.length - 1]?.trim()
      if (edu && !data.education.includes(edu)) {
        data.education.push(edu)
      }
    }
  }

  return data
}

/**
 * Parse value strings like "$1.5M", "$2,500,000", "850K" into numbers
 */
function parseValueString(str: string): number | undefined {
  if (!str) return undefined

  // Remove $ and commas
  let cleaned = str.replace(/[$,]/g, "").trim().toLowerCase()

  // Handle suffixes
  let multiplier = 1
  if (cleaned.endsWith("k")) {
    multiplier = 1000
    cleaned = cleaned.slice(0, -1)
  } else if (cleaned.endsWith("m")) {
    multiplier = 1000000
    cleaned = cleaned.slice(0, -1)
  } else if (cleaned.endsWith("b")) {
    multiplier = 1000000000
    cleaned = cleaned.slice(0, -1)
  }

  const num = parseFloat(cleaned)
  if (isNaN(num)) return undefined

  return num * multiplier
}

/**
 * Merge LinkUp results with Perplexity results
 * Deduplicates sources using normalized URLs and combines research content
 */
export function mergeLinkupWithPerplexity(
  linkupResult: LinkupBatchResult,
  perplexityContent: string,
  perplexitySources: Array<{ name: string; url: string }>
): {
  mergedContent: string
  mergedSources: Array<{ name: string; url: string; snippet?: string }>
  linkupContribution: string
  linkupUniqueInsights: string[]
  extractedData: ExtractedLinkupData
} {
  // Deduplicate sources by NORMALIZED URL
  const seenNormalizedUrls = new Set<string>()
  const mergedSources: Array<{ name: string; url: string; snippet?: string }> = []

  // Add Perplexity sources first (higher priority)
  for (const source of perplexitySources) {
    const normalizedKey = normalizeUrl(source.url)
    if (!seenNormalizedUrls.has(normalizedKey)) {
      seenNormalizedUrls.add(normalizedKey)
      mergedSources.push(source)
    }
  }

  // Track LinkUp-only sources for contribution analysis
  const linkupOnlySources: Array<{ name: string; url: string; snippet?: string }> = []

  // Add LinkUp sources (deduped using normalized URLs)
  for (const source of linkupResult.sources) {
    const normalizedKey = normalizeUrl(source.url)
    if (!seenNormalizedUrls.has(normalizedKey)) {
      seenNormalizedUrls.add(normalizedKey)
      mergedSources.push(source)
      linkupOnlySources.push(source)
    }
  }

  // Extract structured data from LinkUp answer
  const extractedData = extractStructuredDataFromAnswer(linkupResult.answer)

  // Build unique insights list based on what was actually found
  const linkupUniqueInsights: string[] = []

  if (extractedData.properties.length > 0) {
    const totalValue = extractedData.properties.reduce((sum, p) => sum + (p.value || 0), 0)
    linkupUniqueInsights.push(
      `Found ${extractedData.properties.length} property record(s) totaling ~$${(totalValue / 1000000).toFixed(1)}M`
    )
  }
  if (extractedData.businesses.length > 0) {
    linkupUniqueInsights.push(`Identified ${extractedData.businesses.length} business affiliation(s)`)
  }
  if (extractedData.secFilings.hasFilings) {
    linkupUniqueInsights.push(`SEC insider at: ${extractedData.secFilings.tickers.join(", ")}`)
  }
  if (extractedData.politicalGiving.total && extractedData.politicalGiving.total >= 1000) {
    linkupUniqueInsights.push(
      `Political giving: $${extractedData.politicalGiving.total.toLocaleString()}${extractedData.politicalGiving.partyLean ? ` (${extractedData.politicalGiving.partyLean})` : ""}`
    )
  }
  if (extractedData.foundations.length > 0) {
    linkupUniqueInsights.push(`Foundation affiliations: ${extractedData.foundations.slice(0, 3).join(", ")}`)
  }
  if (extractedData.majorGifts.length > 0) {
    const largestGift = Math.max(...extractedData.majorGifts.map((g) => g.amount || 0))
    linkupUniqueInsights.push(`Major gift(s) found: largest $${largestGift.toLocaleString()}`)
  }
  if (extractedData.netWorthMentioned) {
    const { low, high } = extractedData.netWorthMentioned
    linkupUniqueInsights.push(`Net worth mention: $${(low! / 1000000).toFixed(1)}M-$${((high || low)! / 1000000).toFixed(1)}M`)
  }

  const linkupContribution =
    linkupOnlySources.length > 0
      ? `LinkUp provided ${linkupOnlySources.length} additional source(s)${linkupUniqueInsights.length > 0 ? `: ${linkupUniqueInsights[0]}` : ""}`
      : linkupUniqueInsights.length > 0
        ? `LinkUp corroborated: ${linkupUniqueInsights.join("; ")}`
        : "LinkUp corroborated Perplexity findings"

  // Merge content - Perplexity as primary, LinkUp as supplementary
  const mergedContent = perplexityContent
    ? `${perplexityContent}\n\n---\n\n**Additional findings from LinkUp:**\n${linkupResult.answer || "No additional information found."}`
    : linkupResult.answer || ""

  return {
    mergedContent,
    mergedSources: mergedSources.slice(0, 30), // Cap at 30 total sources
    linkupContribution,
    linkupUniqueInsights,
    extractedData,
  }
}
