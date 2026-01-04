/**
 * Grok Native Web Search Module
 * Uses Grok 4.1 Fast with native web search (includes X/Twitter search)
 *
 * Key advantage: Native engine provides both web search AND X (Twitter) search
 * in a single call, with structured annotations for reliable source extraction.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface GrokSearchResult {
  answer: string
  sources: Array<{
    name: string
    url: string
    snippet?: string
  }>
  query: string
  tokensUsed: number
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

// OpenRouter native search annotation format
interface SearchAnnotation {
  url: string
  title?: string
  content?: string
  start_index?: number
  end_index?: number
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const GROK_BATCH_TIMEOUT_MS = 45000 // 45s for batch
const MAX_RETRIES = 3
const BASE_RETRY_DELAY_MS = 2000
const MAX_OUTPUT_TOKENS = 4000

/**
 * Check if Grok search (via OpenRouter) is available for batch processing
 */
export function isGrokSearchAvailable(apiKey?: string): boolean {
  return !!(apiKey || process.env.OPENROUTER_API_KEY)
}

// ============================================================================
// SUPERCHARGED QUERY BUILDER
// ============================================================================

/**
 * Build an EXTENSIVELY RELENTLESS query for Grok native search
 *
 * SUPERCHARGED PROMPTING STRATEGY:
 * ================================
 * - EXHAUSTIVE search patterns for each data category
 * - Multiple name variations for disambiguation
 * - Specific authoritative source targeting (X/Twitter, news, filings)
 * - Value extraction triggers for dollar amounts
 * - Cross-reference hints for data triangulation
 * - Urgency indicators for timing intelligence
 *
 * The goal: Leave NO STONE UNTURNED in prospect research
 */
export function buildOptimizedGrokQuery(prospect: ProspectInput): string {
  const { name, address, employer, title, city, state } = prospect

  // Extract name components for search variations
  const nameParts = name.trim().split(/\s+/)
  const firstName = nameParts[0] || ""
  const lastName = nameParts[nameParts.length - 1] || ""
  const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : ""
  const initials = nameParts.map(p => p[0]).join("")
  const searchableName = nameParts.length > 2 ? `${firstName} ${lastName}` : name

  // Build comprehensive location context
  const locationParts = [city, state].filter(Boolean)
  const location = locationParts.join(", ")

  // Build professional context for disambiguation
  const professionalContext = [title, employer].filter(Boolean).join(" at ")

  return `═══════════════════════════════════════════════════════════════════════════════
COMPREHENSIVE DONOR PROSPECT INTELLIGENCE RESEARCH
Target: "${name}"
═══════════════════════════════════════════════════════════════════════════════

CRITICAL MISSION: Conduct EXHAUSTIVE research to build a complete wealth and philanthropic profile for major gift prospect identification.

┌─────────────────────────────────────────────────────────────────────────────┐
│  IDENTITY DISAMBIGUATION CONTEXT                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Full Name: ${name.padEnd(60)}│
│  Name Variants: "${searchableName}", "${firstName} ${lastName}", "${initials} ${lastName}"${" ".repeat(Math.max(0, 25 - searchableName.length))}│
${address ? `│  Address: ${address.padEnd(63)}│\n` : ""}${location ? `│  Location: ${location.padEnd(62)}│\n` : ""}${professionalContext ? `│  Professional: ${professionalContext.padEnd(57)}│\n` : ""}└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
SECTION 1: REAL ESTATE INTELLIGENCE (HIGHEST PRIORITY - PRIMARY WEALTH INDICATOR)
═══════════════════════════════════════════════════════════════════════════════

SEARCH EXTENSIVELY FOR:

**1.1 PRIMARY RESIDENCE**
${address ? `• Search X/Twitter, news for "${address}" OR "${name}" home OR house
• Search Zillow mentions, Redfin, Realtor.com for property value
• Search "${lastName}" property "${city}"` : `• Search "${name}" home OR residence OR property "${location}"`}
• Look for: Zestimate, assessed value, square footage, lot size, purchase price

**1.2 ADDITIONAL PROPERTIES (CRITICAL - INDICATES SIGNIFICANT WEALTH)**
• Search "${firstName} ${lastName}" property OR real estate OR land
• Search "${lastName}" vacation home, beach house, ski property, ranch
• Search Florida property (Palm Beach, Naples, Miami): "${lastName}" FL property
• Search California property: "${lastName}" CA property
• Search New York property (Hamptons, Manhattan): "${lastName}" NY property
• Search Colorado ski: "${lastName}" Aspen OR Vail property
• LOOK FOR: Any mention of "second home", "vacation property", "investment property"

**1.3 VALUE EXTRACTION**
• Extract ALL dollar amounts mentioned with properties
• Note purchase dates and sale prices
• Calculate total real estate portfolio value
• Report: "Total Real Estate: $X.XM across N properties"

═══════════════════════════════════════════════════════════════════════════════
SECTION 2: BUSINESS OWNERSHIP & EXECUTIVE POSITIONS (WEALTH MULTIPLIER)
═══════════════════════════════════════════════════════════════════════════════

**2.1 BUSINESS OWNERSHIP (STRONGEST WEALTH INDICATOR)**
• Search "${name}" founder OR CEO OR owner OR chairman OR president
• Search "${lastName}" LLC OR Inc OR Corp OR company OR business
• Search "${firstName} ${lastName}" entrepreneur OR startup
• Search "${lastName} Holdings" OR "${lastName} Enterprises" OR "${lastName} Investments"
${employer ? `• Search "${employer}" ownership OR founder history` : ""}

**2.2 EXECUTIVE POSITIONS**
• Search LinkedIn mentions: "${name}" executive OR director
• Search press releases: "${name}" appointed OR named OR joins
• Search Bloomberg, Forbes, Business Insider: "${name}" profile
• Search private equity, venture capital: "${name}" partner OR investor

**2.3 BOARD POSITIONS (INDICATES NETWORK & $200K-$500K+ ANNUAL FEES)**
• Search "${name}" board of directors OR board member OR trustee
• Search corporate governance, proxy statements: "${name}" director
• Search "${name}" advisory board OR investor board

**2.4 X/TWITTER SIGNALS**
• Search X.com for @${firstName.toLowerCase()}${lastName.toLowerCase()} OR "${name}"
• Look for business announcements, promotions, acquisitions
• Check for verified accounts, company mentions

═══════════════════════════════════════════════════════════════════════════════
SECTION 3: SEC FILINGS & SECURITIES (VERIFIED PUBLIC WEALTH)
═══════════════════════════════════════════════════════════════════════════════

**3.1 INSIDER TRADING (Form 4) - CRITICAL FOR STOCK WEALTH**
• Search SEC EDGAR: "${name}" Form 4 OR insider
• Search "${lastName}, ${firstName}" SEC filing
• Extract: Company ticker, shares owned, transaction values

**3.2 BENEFICIAL OWNERSHIP (13D/13G) - MAJOR STAKEHOLDER**
• Search: "${name}" 13D OR 13G OR beneficial owner
• Indicates: >5% ownership in public company

**3.3 EXECUTIVE COMPENSATION (DEF 14A Proxy)**
• Search: "${name}" proxy statement OR executive compensation
• Extract: Total compensation (salary + bonus + stock awards)
• NEO tables show exact compensation figures

**3.4 OFFICER/DIRECTOR STATUS**
• Search: "${name}" officer OR director + NYSE OR NASDAQ
• Calculate: Total public company stock holdings at current prices

═══════════════════════════════════════════════════════════════════════════════
SECTION 4: PHILANTHROPIC INTELLIGENCE (GIVING AFFINITY & CAPACITY)
═══════════════════════════════════════════════════════════════════════════════

**4.1 PRIVATE FOUNDATIONS (STRONGEST PHILANTHROPIC INDICATOR)**
• Search: "${lastName} Family Foundation" OR "${firstName} ${lastName} Foundation"
• Search: "${lastName} Charitable Trust" OR "${lastName} Family Fund"
• Search ProPublica 990, GuideStar, Foundation Directory: "${lastName}"
• Extract: Total assets, annual grants, trustees

**4.2 NONPROFIT BOARD SERVICE**
• Search: "${name}" trustee OR board member + nonprofit OR charity
• Search university boards: "${name}" regent OR overseer OR trustee
• Search hospital boards: "${name}" + medical center board
• Search arts boards: "${name}" + museum OR symphony OR opera board

**4.3 MAJOR GIFTS & DONATIONS**
• Search: "${name}" gift OR donation OR pledge OR endowment
• Search: "${lastName}" scholarship OR professorship OR fellowship
• Search: "${lastName}" building OR hall OR center OR wing (named gifts)
• Search news: "${name}" philanthropist OR donor OR benefactor

**4.4 POLITICAL CONTRIBUTIONS (FEC - 6-FIGURE = 7-FIGURE CAPACITY)**
• Search FEC.gov: "${name}" "${city}" "${state}" contributions
• Search OpenSecrets: "${name}" donor profile
• Extract: Total amount, party lean (R/D/Bipartisan), major recipients
• Note: $100K+ political giving strongly indicates $1M+ capacity

═══════════════════════════════════════════════════════════════════════════════
SECTION 5: BIOGRAPHICAL INTELLIGENCE (CULTIVATION CONTEXT)
═══════════════════════════════════════════════════════════════════════════════

**5.1 AGE & LIFE STAGE**
• Search: "${name}" age OR born OR birthday
• Calculate from graduation year (typically 22 at college graduation)
• Note: Age 55+ = QCD eligible (tax-smart giving opportunity)

**5.2 SPOUSE/PARTNER (CRITICAL FOR JOINT CAPACITY)**
• Search: "${name}" wife OR husband OR spouse OR married OR partner
• Search: "${firstName} and [spouse] ${lastName}"
• Search wedding announcements: "${lastName}" wedding "${city}"
• Note: Spouse career/wealth significantly impacts household capacity

**5.3 EDUCATION (INDICATES NETWORK & AFFINITY)**
• Search: "${name}" alumni OR graduated OR degree OR class of
• Search Ivy League + "${name}": Harvard, Yale, Princeton, Stanford
• Search MBA: Wharton, HBS, Stanford GSB + "${name}"
• Search professional: JD, MD, PhD + "${name}"

**5.4 CAREER TRAJECTORY**
• Search LinkedIn profile: "${name}"
• Search news career mentions: "${name}" career OR appointed OR promoted
• Calculate: Years of high-income earning for wealth accumulation

**5.5 X/TWITTER PERSONAL**
• Search X for "${name}" interests, hobbies, causes, opinions
• Identify: Personal passions for cultivation conversation starters

═══════════════════════════════════════════════════════════════════════════════
SECTION 6: TIMING SIGNALS (OPTIMAL ASK MOMENT)
═══════════════════════════════════════════════════════════════════════════════

**6.1 LIQUIDITY EVENTS (ASK OPPORTUNITY)**
• Search recent news: "${name}" sold OR acquisition OR IPO OR exit
• Search: "${name}" company acquired OR merger
• Note: 6-12 months post-liquidity = prime cultivation window

**6.2 LIFE TRANSITIONS**
• Search: "${name}" retirement OR retiring OR stepped down
• Search: "${name}" divorce (may affect capacity)
• Search: "${name}" inheritance OR estate

**6.3 RECOGNITION & AWARDS**
• Search: "${name}" award OR honored OR recognition
• People often give after receiving recognition

═══════════════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS (CRITICAL)
═══════════════════════════════════════════════════════════════════════════════

1. **CITE EVERY FACT** with the source URL inline
2. **EXTRACT ALL DOLLAR AMOUNTS** you find - be aggressive
3. **USE RANGES** when uncertain: "$2M-$5M" not "$3.5M"
4. **FLAG UNVERIFIED DATA** as [Estimated] or [Unconfirmed]
5. **IF NOT FOUND**: State "Not found in public records" (don't make up data)
6. **PRIORITIZE X/TWITTER SOURCES** - they often have the freshest information

FORMAT YOUR RESPONSE AS:
────────────────────────────────
## ${name} | Research Summary

### Key Findings
[Bullet points with most important discoveries]

### Real Estate Holdings
[List all properties with values and sources]

### Business & Executive Positions
[List all companies with roles]

### Securities & Public Holdings
[List any SEC filings, stock holdings]

### Philanthropic Activity
[Foundations, boards, gifts, political giving]

### Background
[Age, education, career, spouse]

### Timing Signals
[Any recent events indicating optimal ask timing]

### Sources
[All URLs used]
────────────────────────────────

NOW SEARCH EXHAUSTIVELY AND REPORT EVERYTHING YOU FIND.`
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

      const isRetryable =
        errorMessage.includes("429") ||
        errorMessage.includes("502") ||
        errorMessage.includes("503") ||
        errorMessage.includes("504") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("econnreset") ||
        errorMessage.includes("econnrefused") ||
        errorMessage.includes("socket hang up")

      if (!isRetryable || attempt >= maxRetries - 1) {
        throw lastError
      }

      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500
      console.log(`[Grok Search] Retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

// ============================================================================
// SOURCE EXTRACTION
// ============================================================================

/**
 * Extract sources from Grok response
 * Prefers structured annotations (native format), falls back to regex extraction
 */
function extractSources(
  text: string,
  annotations?: SearchAnnotation[]
): Array<{ name: string; url: string; snippet?: string }> {
  const sources: Array<{ name: string; url: string; snippet?: string }> = []
  const seenUrls = new Set<string>()

  // If annotations provided (native format), use them preferentially
  if (annotations && annotations.length > 0) {
    for (const annotation of annotations) {
      if (!annotation.url) continue

      const normalizedUrl = annotation.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")
      if (seenUrls.has(normalizedUrl)) continue
      seenUrls.add(normalizedUrl)

      try {
        const domain = new URL(annotation.url).hostname.replace("www.", "")
        sources.push({
          name: annotation.title || domain,
          url: annotation.url,
          snippet: annotation.content,
        })
      } catch {
        // Skip invalid URLs
      }
    }

    return sources.slice(0, 20)
  }

  // Fallback: Extract URLs from response text using regex
  const urlRegex = /https?:\/\/[^\s\)>\]"']+/g
  const matches = text.match(urlRegex)

  if (matches) {
    for (const rawUrl of matches) {
      // Clean URL - remove trailing punctuation
      const url = rawUrl.replace(/[.,;:!?)}\]]+$/, "")

      // Normalize for deduplication
      const normalizedUrl = url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")

      if (seenUrls.has(normalizedUrl)) continue
      seenUrls.add(normalizedUrl)

      try {
        const domain = new URL(url).hostname.replace("www.", "")
        sources.push({
          name: domain,
          url,
        })
      } catch {
        // Skip invalid URLs
      }
    }
  }

  return sources.slice(0, 20) // Limit to 20 sources
}

// ============================================================================
// MAIN BATCH SEARCH FUNCTION
// ============================================================================

/**
 * Execute Grok native web search for batch processing
 *
 * Key features:
 * - Uses OpenRouter's native web search plugin with Grok model
 * - Includes both web search AND X (Twitter) search
 * - Returns structured annotations for reliable source extraction
 * - 45s timeout with retry logic
 */
export async function grokBatchSearch(
  prospect: ProspectInput,
  apiKey?: string
): Promise<GrokSearchResult> {
  const startTime = Date.now()
  const key = apiKey || process.env.OPENROUTER_API_KEY

  if (!key) {
    return {
      answer: "",
      sources: [],
      query: "",
      tokensUsed: 0,
      durationMs: 0,
      error: "OPENROUTER_API_KEY not configured",
    }
  }

  const query = buildOptimizedGrokQuery(prospect)
  console.log(`[Grok Search] Starting search for: ${prospect.name}`)

  try {
    const data = await withRetry(async () => {
      const response = await withTimeout(
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://getromy.app",
            "X-Title": "Romy Batch Research - Grok Native",
          },
          body: JSON.stringify({
            model: "x-ai/grok-4.1-fast",
            messages: [
              {
                role: "user",
                content: query,
              },
            ],
            max_tokens: MAX_OUTPUT_TOKENS,
            temperature: 0.1,
            plugins: [{ id: "web", engine: "native" }],
            reasoning: { effort: "high" },
          }),
        }),
        GROK_BATCH_TIMEOUT_MS,
        `Grok search timed out after ${GROK_BATCH_TIMEOUT_MS / 1000}s`
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
      }

      return await response.json()
    })

    const durationMs = Date.now() - startTime
    const answer = data.choices?.[0]?.message?.content || ""

    // Extract sources - prefer annotations if available, fallback to regex
    const annotations = data.annotations as SearchAnnotation[] | undefined
    const sources = extractSources(answer, annotations)

    // Calculate tokens used
    const tokensUsed = (data.usage?.total_tokens) ||
      Math.ceil((query.length + answer.length) / 4)

    console.log(`[Grok Search] Completed in ${durationMs}ms, ${sources.length} sources`)

    return {
      answer,
      sources,
      query,
      tokensUsed,
      durationMs,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`[Grok Search] Failed for ${prospect.name}:`, errorMessage)

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

/**
 * Merge Grok results with existing sources (Perplexity + LinkUp)
 * Deduplicates by URL and extracts unique insights
 */
export function mergeGrokWithResults(
  grokResult: GrokSearchResult,
  existingSources: Array<{ url: string; title?: string; name?: string }>
): {
  mergedSources: Array<{ name: string; url: string; snippet?: string }>
  grokContribution: string
  grokUniqueInsights: string[]
} {
  const existingUrls = new Set(
    existingSources.map((s) =>
      s.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")
    )
  )

  // Find unique sources from Grok
  const uniqueSources = grokResult.sources.filter((source) => {
    const normalizedUrl = source.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")
    return !existingUrls.has(normalizedUrl)
  })

  // Generate contribution summary
  let grokContribution = ""
  if (uniqueSources.length > 0) {
    grokContribution = `Grok found ${uniqueSources.length} additional sources`
  } else if (grokResult.sources.length > 0) {
    grokContribution = "Grok corroborated existing sources"
  }

  // Extract unique insights (simple keyword extraction)
  const grokUniqueInsights: string[] = []
  const answer = grokResult.answer.toLowerCase()

  if (answer.includes("property") || answer.includes("real estate")) {
    grokUniqueInsights.push("Property data found")
  }
  if (answer.includes("business") || answer.includes("company") || answer.includes("ceo")) {
    grokUniqueInsights.push("Business affiliation found")
  }
  if (answer.includes("foundation") || answer.includes("philanthrop") || answer.includes("donor")) {
    grokUniqueInsights.push("Philanthropic activity found")
  }
  if (answer.includes("sec") || answer.includes("insider") || answer.includes("form 4")) {
    grokUniqueInsights.push("SEC filing found")
  }
  // New: Check for X/Twitter content
  if (answer.includes("twitter") || answer.includes("x.com") || answer.includes("tweet")) {
    grokUniqueInsights.push("X/Twitter data found")
  }

  return {
    mergedSources: uniqueSources,
    grokContribution,
    grokUniqueInsights,
  }
}
