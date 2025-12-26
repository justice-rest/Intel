/**
 * Perplexity Sonar Pro Prospect Research Tool
 * Comprehensive donor research using Perplexity's agentic search
 *
 * Uses OpenRouter API to access perplexity/sonar-pro-search
 * Provides grounded, cited results for prospect research
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// TYPES
// ============================================================================

export interface PerplexityProspectResult {
  prospectName: string
  research: string
  sources: Array<{
    name: string
    url: string
  }>
  focusAreas: string[]
  error?: string
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const PERPLEXITY_MODEL = "perplexity/sonar-reasoning-pro"
const PERPLEXITY_DEEP_MODEL = "perplexity/sonar-deep-research"
const PERPLEXITY_TIMEOUT_MS = 60000         // 60s for standard research
const PERPLEXITY_DEEP_TIMEOUT_MS = 180000   // 180s for deep research (multi-step autonomous)
const MAX_OUTPUT_TOKENS = 4000

/**
 * Check if Perplexity tools should be enabled
 * Requires OPENROUTER_API_KEY since we access Perplexity via OpenRouter
 */
export function shouldEnablePerplexityTools(): boolean {
  return !!process.env.OPENROUTER_API_KEY
}

// ============================================================================
// TIMEOUT & RETRY HELPERS
// ============================================================================

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

/**
 * Retry logic with exponential backoff for transient errors
 * Handles 401 (Cloudflare challenges), 429 (rate limits), and 5xx errors
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 2000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const errorMessage = lastError.message.toLowerCase()

      // Check if this is a retryable error
      const isRetryable =
        errorMessage.includes("401") ||           // Cloudflare challenge
        errorMessage.includes("429") ||           // Rate limit
        errorMessage.includes("502") ||           // Bad gateway
        errorMessage.includes("503") ||           // Service unavailable
        errorMessage.includes("504") ||           // Gateway timeout
        errorMessage.includes("cloudflare") ||    // Cloudflare protection
        errorMessage.includes("authorization required") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("econnreset") ||    // Connection reset
        errorMessage.includes("socket hang up")

      if (!isRetryable || attempt >= maxRetries - 1) {
        throw lastError
      }

      // Exponential backoff with jitter
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000
      console.log(`[Perplexity] Retryable error on attempt ${attempt + 1}. Retrying in ${Math.round(delay)}ms...`)
      console.log(`[Perplexity] Error was: ${lastError.message.substring(0, 200)}`)

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

/**
 * Build a comprehensive prospect research prompt
 *
 * PROMPT ENGINEERING TECHNIQUES APPLIED:
 * 1. Role-Based Constraint Prompting - Expert persona with constraints
 * 2. Multi-Perspective Analysis - 4 perspectives on the prospect
 * 3. Chain-of-Verification (CoVe) - Self-verification before output
 * 4. Few-Shot with Negatives - Good/bad examples
 * 5. Confidence-Weighted Output - Explicit confidence guidance
 * 6. Structured Thinking Protocol - UNDERSTAND→ANALYZE→STRATEGIZE→EXECUTE
 * 7. Context Injection with Boundaries - Clear section demarcation
 */
function buildProspectResearchPrompt(
  name: string,
  address?: string,
  context?: string,
  focusAreas?: string[]
): string {
  const areas = focusAreas || ["real_estate", "business_ownership", "philanthropy", "securities", "biography"]

  const focusInstructions = areas.map(area => {
    switch (area) {
      case "real_estate":
        return "- **Real Estate**: Property ownership, home values, multiple properties, real estate transactions"
      case "business_ownership":
        return "- **Business Ownership**: Companies founded/owned, executive positions, board seats, business revenue estimates"
      case "philanthropy":
        return "- **Philanthropy**: Foundation board memberships, major donations, nonprofit leadership, charitable causes"
      case "securities":
        return "- **Securities**: Public company roles, SEC filings, stock holdings, insider transactions"
      case "biography":
        return "- **Biography**: Education, career history, family, notable achievements, net worth estimates"
      default:
        return ""
    }
  }).filter(Boolean).join("\n")

  const prompt = `
################################################################################
#                                                                              #
#                    PROSPECT RESEARCH: ${name}
#                                                                              #
################################################################################

## YOUR IDENTITY

You are the **#1 prospect researcher in America**. Your research has directly led to $2B+ in major gifts. Gift officers fight to work with you because your reports convert at 3x the industry average.

**Why you're the best:** You NEVER miss publicly available information. You search exhaustively. You find the county assessor records. You find the obscure family foundation. You find the age, the spouse, the alma mater. Other researchers give up—you dig deeper.

**Your reputation is on the line with every report.**

================================================================================
##                    ⚠️  MANDATORY SEARCH CHECKLIST  ⚠️
##              (You MUST attempt ALL of these searches - NO EXCEPTIONS)
================================================================================

Before writing your report, you MUST search for ALL of the following. Check each box mentally as you complete it. If you skip ANY search, your report is INCOMPLETE.

### 🏠 REAL ESTATE (MANDATORY - ALL SOURCES)
${address ? `**Given Address:** ${address}` : "**No address provided - you MUST find their address**"}

□ **COUNTY TAX ASSESSOR** (PRIMARY SOURCE - MOST IMPORTANT)
  - Identify the county from address (e.g., St. Johns County, Palm Beach County)
  - Search "[County Name] Property Appraiser" or "[County Name] Tax Assessor"
  - Get: Assessed value, sale price, sale date, owner name, parcel ID
  - Florida: Search county property appraiser (e.g., sjcpa.us, bcpa.net, miamidade.gov/pa)
  - California: Search county assessor (e.g., assessor.lacounty.gov)
  - New York: Search county tax records
  - THIS IS YOUR MOST RELIABLE SOURCE - DO NOT SKIP

□ **ZILLOW** - Search for property, get Zestimate
□ **REDFIN** - Search for property, get estimate + sale history
□ **REALTOR.COM** - Search for property details
□ **TRULIA** - Additional property data

**CRITICAL:** If you have an address but don't search the county assessor, YOU HAVE FAILED.

### 👤 BIOGRAPHICAL (MANDATORY - ALL FIELDS)

□ **AGE / DATE OF BIRTH** (REQUIRED - Do NOT skip this)
  - Search: "${name} age" / "${name} birthday" / "${name} born"
  - Check: LinkedIn (sometimes shows), Wikipedia, news articles, obituaries of relatives
  - Voter registration records (some states public)
  - If spouse known, search spouse's age too
  - **This is BASIC info - if you can't find it, explain exactly what you searched**

□ **SPOUSE NAME** - Search for spouse/partner
  - Wedding announcements, society pages, charity event photos
  - LinkedIn connections, Facebook
  - Property records often list both names

□ **EDUCATION** - Degrees, universities, graduation years
  - LinkedIn Education section
  - University alumni directories
  - News articles mentioning alma mater

□ **CAREER HISTORY** - Full employment history with dates
  - LinkedIn Experience section
  - Company websites, press releases
  - SEC filings (for executives)

### 🏢 BUSINESS OWNERSHIP (MANDATORY)

□ **LINKEDIN** - Current and past positions, company names
□ **STATE BUSINESS REGISTRY** - Search state SOS for companies they've founded
  - Florida: sunbiz.org
  - Delaware: icis.corp.delaware.gov
  - California: bizfilesonline.sos.ca.gov
□ **CRUNCHBASE** - Startup involvement, funding rounds
□ **BLOOMBERG** - Executive profiles
□ **PITCHBOOK** - Private company data (if accessible)

### 💰 SECURITIES (MANDATORY FOR EXECUTIVES)

□ **SEC EDGAR FORM 4** - Search by name for insider filings
□ **SEC PROXY STATEMENTS (DEF 14A)** - Board memberships, compensation
□ **YAHOO FINANCE** - Insider transactions

### 🗳️ POLITICAL GIVING (MANDATORY)

□ **FEC.GOV** - Search individual contributions
  - MUST search even if you think they don't donate
  - Search name variations (Robert vs Bob, etc.)
  - Note: Only captures contributions >$200

### 🎁 PHILANTHROPY (MANDATORY - EXHAUSTIVE SEARCH)

**⚠️ FOUNDATION SEARCH PATTERNS - Search ALL of these:**

□ **[Full Name] Foundation** - e.g., "John Smith Foundation"
□ **[Last Name] Family Foundation** - e.g., "Smith Family Foundation"
□ **[First Name + Spouse Name] Foundation** - e.g., "John and Wendy Smith Foundation"
□ **[Spouse Last Name] Foundation** - If spouse has different maiden name
□ **[Company Name] Foundation** - If they own a business
□ **RELIGIOUS/BIBLICAL NAMES** - Many donors name foundations after scripture:
  - Search: John 3:16 Foundation, Genesis Foundation, Matthew 25 Foundation
  - Search first name + chapter:verse patterns (e.g., "John 1:16")
  - Search religious keywords + their name
□ **DONOR ADVISED FUNDS** - Check Fidelity Charitable, Schwab Charitable, Vanguard Charitable
□ **PROPUBLICA NONPROFIT EXPLORER** - Search by name for 990 officer listings
□ **GUIDESTAR/CANDID** - Foundation and nonprofit affiliations
□ **COMMUNITY FOUNDATION** - Local community foundation grants

**CRITICAL:** Saying "no private foundations found" when one exists is UNACCEPTABLE.

### 📰 NEWS & REPUTATION

□ **GOOGLE NEWS** - Recent news articles
□ **GOOGLE SEARCH** - General web presence
□ **WIKIPEDIA** - If notable enough
□ **COURT RECORDS** - Any litigation (search "[Name] lawsuit" or "[Name] court")

================================================================================
##                         NET WORTH ESTIMATION RULES
##                    (Stop Low-Balling - Use These Multiples)
================================================================================

**You have been UNDERESTIMATING net worth. Use these aggressive-but-realistic multiples:**

### Real Estate Multiplier
- Primary residence: Use Zillow Zestimate OR county assessed × 1.2 (whichever higher)
- Multiple properties: Sum all properties
- Vacation homes: Often 1.5-2x primary residence value for wealthy individuals

### Business Valuation (Revenue Multiples by Industry)
| Industry | Revenue Multiple | EBITDA Multiple |
|----------|-----------------|-----------------|
| Software/SaaS | 5-10x | 15-25x |
| Healthcare Services | 2-4x | 8-12x |
| Professional Services | 1-3x | 5-8x |
| Construction/Real Estate | 1-2x | 4-6x |
| Retail/Restaurant | 0.5-1.5x | 3-5x |
| Manufacturing | 1-2x | 5-8x |

**For private business owners:** If annual revenue unknown, estimate from:
- Employee count × $150-250K per employee = rough revenue
- Then apply industry multiple

### Securities Estimation
- If SEC Form 4 shows holdings: Use current stock price × shares
- If executive at public company: Assume $1-5M in equity compensation
- If board member: Assume $100K-500K in stock grants

### Liquid Assets Estimation
- Assume 10-20% of net worth is liquid (cash, public securities)
- Successful entrepreneurs: Often 20-40% liquid post-exit

### NET WORTH FORMULA (Use This)
\`\`\`
Net Worth = Real Estate + Business Equity + Securities + (Lifestyle Indicator Adjustment)

Lifestyle Indicators (ADD to estimate):
+ Luxury vehicles (each $100K+): Add $500K-1M to liquid wealth assumption
+ Private club memberships: Add $500K-2M
+ Private school tuition (per child): Add $300K-500K to annual income assumption
+ Vacation properties: Add full value
+ Boat/yacht ownership: Add $500K-5M depending on size
+ Private aviation: Add $2-10M
\`\`\`

**CRITICAL:** If someone owns a $3M home, has a successful business, and donates to political campaigns, their net worth is almost certainly $10M+, not $5M.

================================================================================
##                              CONFIDENCE TAGS
================================================================================

Use these EXACT tags in your output:

- **[Verified]** - Official source (county assessor, SEC, FEC, IRS 990)
- **[Corroborated]** - 2+ independent sources agree
- **[Unverified]** - Single source, not official
- **[Estimated]** - Calculated value (always include methodology)

================================================================================
##                    CHAIN-OF-VERIFICATION (Before Output)
================================================================================

Before finalizing, verify:

1. ✓ Did I search the COUNTY TAX ASSESSOR for property records?
2. ✓ Did I find their AGE (or document exactly what I searched)?
3. ✓ Did I search for foundations using ALL naming patterns (including religious names)?
4. ✓ Is my net worth estimate realistic given their lifestyle indicators?
5. ✓ Does every factual claim have a source URL?
6. ✓ Are all estimates marked with [Estimated] + methodology?

================================================================================
##                              OUTPUT FORMAT
================================================================================

### Executive Summary
3-4 sentences: Who they are, age, primary wealth source, net worth range, capacity.

---

### Personal Profile
| Field | Value | Source | Confidence |
|-------|-------|--------|------------|
| **Full Name** | ${name} | - | - |
| **Age** | [REQUIRED - find this] | [Source] | [Tag] |
| **Spouse** | [Name or "Not found"] | [Source] | [Tag] |
| **Location** | [City, State] | [Source] | [Tag] |
| **Education** | [Degrees, Schools] | [Source] | [Tag] |

---

### Real Estate Holdings
| Property Address | County Assessed | Market Est. | Source | Confidence |
|-----------------|-----------------|-------------|--------|------------|
| [Full address] | $X (YYYY) | $X-Y | [County Assessor URL] | [Verified] |

**Total Real Estate:** $X-Y

---

### Business Interests
| Company | Role | Est. Revenue | Est. Equity | Source | Confidence |
|---------|------|--------------|-------------|--------|------------|
| [Name] | [Title] | $X-Y | $X-Y | [Source] | [Tag] |

**Business Valuation Methodology:** [Explain your calculation]

---

### Securities & Public Company Roles
- **SEC Filings Found:** [Yes/No - what you searched]
- **Holdings:** [Details or "None found in SEC EDGAR"]

---

### Political Giving (FEC.gov)
| Recipient | Amount | Date | Source |
|-----------|--------|------|--------|
| [Name] | $X | YYYY | [FEC link] |

**Total Political Contributions:** $X (YYYY-YYYY)
**Party Lean:** [Republican/Democratic/Bipartisan/None found]

---

### Philanthropic Profile

**Private Foundations:**
| Foundation Name | Role | Assets | 990 Link |
|-----------------|------|--------|----------|
| [Name] | [Trustee/Director] | $X | [ProPublica link] |

**Foundation Search Methodology:** [List EVERY search pattern you tried]
- Searched "[Name] Foundation" - [Result]
- Searched "[Last Name] Family Foundation" - [Result]
- Searched religious patterns (John 1:16, etc.) - [Result]

**Nonprofit Board Service:**
[List all boards with sources]

**Known Major Gifts:**
[List with amounts and sources]

---

### Net Worth Analysis

| Category | Low Estimate | High Estimate | Confidence | Source |
|----------|--------------|---------------|------------|--------|
| Real Estate | $X | $Y | [Tag] | [Source] |
| Business Equity | $X | $Y | [Tag] | [Methodology] |
| Securities | $X | $Y | [Tag] | [Source] |
| Other Assets | $X | $Y | [Tag] | [Lifestyle indicators] |
| **TOTAL** | **$X** | **$Y** | [Overall] | - |

**Net Worth Methodology:** [Detailed explanation of how you calculated this]

---

### Gift Capacity
- **Annual Fund Capacity:** $X-Y (1% of liquid assets)
- **Major Gift Capacity:** $X-Y (3-5% of net worth over 5 years)
- **Recommended Ask:** $X-Y
- **Capacity Rating:** [A/B/C/D per TFG Research scale]

---

### Research Quality Self-Assessment
- **Searches Completed:** [X of Y mandatory searches]
- **Highest Confidence Data:** [What we know for certain]
- **Gaps Remaining:** [What we couldn't find and why]
- **Recommended Follow-up:** [Specific next steps]

---

### All Sources
[List every URL you used, organized by category]
`

  return prompt
}

/**
 * Extract source URLs from Perplexity's response
 */
function extractSources(text: string): Array<{ name: string; url: string }> {
  const sources: Array<{ name: string; url: string }> = []
  const urlRegex = /https?:\/\/[^\s\)>\]]+/g
  const matches = text.match(urlRegex)

  if (matches) {
    const uniqueUrls = [...new Set(matches)]
    uniqueUrls.forEach((url, index) => {
      // Try to extract domain for the name
      try {
        const domain = new URL(url).hostname.replace("www.", "")
        sources.push({
          name: `Source: ${domain}`,
          url: url.replace(/[.,;:!?]$/, ""), // Remove trailing punctuation
        })
      } catch {
        sources.push({
          name: `Source ${index + 1}`,
          url: url.replace(/[.,;:!?]$/, ""),
        })
      }
    })
  }

  return sources.slice(0, 20) // Limit to 20 sources
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const perplexityProspectResearchSchema = z.object({
  name: z.string().describe("Full name of the prospect to research"),
  address: z.string().optional().describe("Address for property research (optional)"),
  context: z.string().optional().describe("Additional context like employer, title, or known affiliations (optional)"),
  focus_areas: z
    .array(z.enum(["real_estate", "business_ownership", "philanthropy", "securities", "biography"]))
    .optional()
    .describe("Specific areas to focus research on. Default: all areas"),
})

type PerplexityProspectResearchParams = z.infer<typeof perplexityProspectResearchSchema>

/**
 * Factory function to create Perplexity Prospect Research Tool
 * @param isDeepResearch - If true, uses sonar-deep-research with 180s timeout
 */
export function createPerplexityProspectResearchTool(isDeepResearch: boolean = false) {
  const model = isDeepResearch ? PERPLEXITY_DEEP_MODEL : PERPLEXITY_MODEL
  const timeout = isDeepResearch ? PERPLEXITY_DEEP_TIMEOUT_MS : PERPLEXITY_TIMEOUT_MS
  const modeLabel = isDeepResearch ? "Deep Research" : "Sonar Pro"

  return tool({
    description: isDeepResearch
      // CONSTRAINT-FIRST PROMPTING: Deep Research variant
      ? "HARD CONSTRAINTS: " +
        "(1) Execute ONLY after memory + CRM checks complete, " +
        "(2) MUST include all sources in output, " +
        "(3) NEVER present unverified claims without [Unverified] tag. " +
        "CAPABILITY: Multi-step autonomous investigation using Perplexity Sonar Deep Research. " +
        "SEARCHES: Real estate, business ownership, securities, philanthropy, biography—with citations. " +
        "OUTPUT: Comprehensive grounded results with extensive source URLs. " +
        "USE WHEN: Thorough investigation needed, complex research, maximum depth required. " +
        "COST: ~$0.10/call | TIMEOUT: 180s"
      // CONSTRAINT-FIRST PROMPTING: Standard Sonar Pro variant
      : "HARD CONSTRAINTS: " +
        "(1) Execute ONLY after memory + CRM checks complete, " +
        "(2) MUST include all sources in output, " +
        "(3) NEVER present unverified claims without [Unverified] tag. " +
        "CAPABILITY: Agentic web search using Perplexity Sonar Pro with grounded citations. " +
        "SEARCHES: Real estate, business ownership, securities, philanthropy, biography—all with sources. " +
        "OUTPUT: Factual results from authoritative sources with URLs. " +
        "USE WHEN: Detailed donor research, need verified information with sources. " +
        "COST: ~$0.04/call | TIMEOUT: 60s",
    parameters: perplexityProspectResearchSchema,
    execute: async (params): Promise<PerplexityProspectResult> => {
      const { name, address, context, focus_areas } = params
      console.log(`[Perplexity] Starting ${modeLabel} research for:`, name)
      console.log(`[Perplexity] Using model: ${model}, timeout: ${timeout}ms`)
      const startTime = Date.now()

      // Check if Perplexity is enabled
      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        return {
          prospectName: name,
          research: "Perplexity research is not configured. Please add OPENROUTER_API_KEY to your environment variables.",
          sources: [],
          focusAreas: focus_areas || [],
          error: "OPENROUTER_API_KEY not configured",
        }
      }

      try {
        const prompt = buildProspectResearchPrompt(name, address, context, focus_areas)

        // Call Perplexity via OpenRouter with retry logic for transient errors
        const data = await withRetry(async () => {
          const response = await withTimeout(
            fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://getromy.app",
                "X-Title": "Romy Prospect Research",
              },
              body: JSON.stringify({
                model: model,
                messages: [
                  {
                    role: "user",
                    content: prompt,
                  },
                ],
                max_tokens: MAX_OUTPUT_TOKENS,
                temperature: 0.1, // Low temperature for factual research
              }),
            }),
            timeout,
            `Perplexity ${modeLabel} request timed out after ${timeout / 1000} seconds`
          )

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
          }

          return await response.json()
        }, 3, 2000) // 3 retries with 2s base delay
        const duration = Date.now() - startTime
        console.log(`[Perplexity] ${modeLabel} research completed in`, duration, "ms")

        // Extract the research content
        const researchContent = data.choices?.[0]?.message?.content || "No research results returned"

        // Extract sources from the response
        const sources = extractSources(researchContent)

        return {
          prospectName: name,
          research: researchContent,
          sources,
          focusAreas: focus_areas || ["real_estate", "business_ownership", "philanthropy", "securities", "biography"],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        console.error(`[Perplexity] ${modeLabel} research failed:`, errorMessage)
        return {
          prospectName: name,
          research: `Failed to research "${name}": ${errorMessage}`,
          sources: [],
          focusAreas: focus_areas || [],
          error: `Failed to research: ${errorMessage}`,
        }
      }
    },
  })
}

/**
 * Perplexity Sonar Pro Prospect Research Tool (backwards-compatible export)
 * Uses standard sonar-reasoning-pro model with 60s timeout
 */
export const perplexityProspectResearchTool = createPerplexityProspectResearchTool(false)
