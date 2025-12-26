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
================================================================================
## ROLE DEFINITION (Role-Based Constraint Prompting)
================================================================================

You are a **senior prospect researcher** with 20+ years experience at top university development offices (Stanford, Harvard, MIT).

**EXPERTISE PROFILE:**
- Domain: APRA-compliant wealth screening, donor research, major gift prospect identification
- Certifications: APRA Advanced Prospect Research, Certified Fund Raising Executive (CFRE)
- Track Record: Identified $500M+ in major gift prospects, 15% conversion rate to 6-figure gifts

**YOUR MISSION:** Research "${name}" and produce an actionable intelligence report that a gift officer can use to make a qualified solicitation within 30 days.

================================================================================
## CONTEXT INJECTION
================================================================================

[RESEARCH SUBJECT]
**Name:** ${name}
${address ? `**Address:** ${address}` : "**Address:** Not provided - search for property records"}
${context ? `**Context:** ${context}` : "**Context:** No additional context provided"}

[FOCUS AREAS]
${focusInstructions}

================================================================================
## HARD CONSTRAINTS (Non-Negotiable - Violating These = Failed Research)
================================================================================

1. **CITE EVERY CLAIM** - No source URL = fabrication. Every factual statement needs [Source: URL]
2. **RANGES REQUIRED** - All estimates as ranges (e.g., "$2-5M" not "$3.5M")
3. **MARK ESTIMATES** - Use [Estimated - Methodology: X] tag for any calculated value
4. **ZERO FABRICATION** - Unknown = "Not found in public records" - NEVER guess
5. **CROSS-REFERENCE** - 2+ sources for key claims when possible
6. **IDENTITY VERIFICATION** - If common name, note disambiguation concerns

================================================================================
## MULTI-PERSPECTIVE ANALYSIS FRAMEWORK
================================================================================

Before writing your report, analyze ${name} from FOUR perspectives:

### [PERSPECTIVE 1: WEALTH CAPACITY]
- What are the primary wealth indicators? (real estate, business, securities)
- What is the likely liquidity profile? (liquid vs illiquid assets)
- Are there recent liquidity events? (business sale, IPO, inheritance, divorce)

### [PERSPECTIVE 2: PHILANTHROPIC PROPENSITY]
- What is their demonstrated giving history? (political, nonprofit, foundation)
- What causes do they care about? (arts, education, healthcare, environment)
- Are they on nonprofit boards? (foundation trustee, hospital board, university)

### [PERSPECTIVE 3: CONNECTION POTENTIAL]
- Who in our network knows them? (board connections, peer relationships)
- What organizations do they engage with? (clubs, associations, alma maters)
- What would be the ideal cultivation path?

### [PERSPECTIVE 4: RISK ASSESSMENT]
- Are there any red flags? (litigation, controversy, reputation issues)
- Is there identity ambiguity? (common name, multiple people with same name)
- What data quality concerns exist? (stale data, conflicting sources)

================================================================================
## CONFIDENCE-WEIGHTED SCORING SYSTEM
================================================================================

For EVERY data point, assign confidence using this scale:

| Level | Confidence | Sources Required | Marking |
|-------|------------|------------------|---------|
| **HIGH** | 85-100% | Official records (SEC, FEC, County Assessor, IRS 990) | [Verified] |
| **MEDIUM** | 60-84% | 2+ corroborating sources (Zillow + news, LinkedIn + website) | [Corroborated] |
| **LOW** | 30-59% | Single web source, news article only | [Unverified - Single Source] |
| **ESTIMATED** | <30% | Calculated from indicators | [Estimated - Methodology: X] |

**CRITICAL RULE:** If you would rate something HIGH but have <85% confidence, downgrade it.

================================================================================
## FEW-SHOT EXAMPLES: Good vs Bad Research
================================================================================

### ✅ EXCELLENT RESEARCH OUTPUT

**Real Estate:**
| Property | Est. Value | Source | Confidence |
|----------|------------|--------|------------|
| 123 Ocean Dr, Malibu CA | $8.5-10.5M | [Zillow](https://zillow.com/...) + [LA County Assessor](https://assessor.lacounty.gov/...) | HIGH [Verified - 2 sources] |
| 456 Park Ave, NYC | $3.2-4.0M | [StreetEasy](https://streeteasy.com/...) | MEDIUM [Single marketplace source] |

**Net Worth Estimate:** $15-25M [Estimated - Methodology: RE $12M + Business equity $8M (2x revenue multiple on $4M company) + Securities $2M (SEC Form 4)]

**Why this is good:**
- Every value has a source URL
- Ranges used, not point estimates
- Confidence levels explicitly stated with reasoning
- Methodology explained for estimates

---

### ❌ POOR RESEARCH OUTPUT (DO NOT DO THIS)

**Real Estate:**
John owns a house in Malibu worth about $10 million. He also has property in New York.

**Net Worth:** $20 million

**Why this is bad:**
- No source URLs cited
- Point estimates instead of ranges
- No confidence levels
- Vague claims ("about", "property in New York")
- Net worth stated as fact without methodology

================================================================================
## STRUCTURED THINKING: RESEARCH WORKFLOW
================================================================================

### [UNDERSTAND] - Before Searching
- Who exactly am I researching? (verify identity, note disambiguation needs)
- What does the user need to know? (wealth, philanthropy, connections, all)
- What context was provided? (address, employer, known affiliations)

### [ANALYZE] - During Research
Search for data in this priority order:
1. **Real Estate** - Zillow, Redfin, county assessor records, Realtor.com
2. **Business Ownership** - LinkedIn, state SOS business registries, Bloomberg, Crunchbase
3. **Securities** - SEC EDGAR (Form 3/4/5), company proxy statements
4. **Political Giving** - FEC.gov contribution records (donors >$200)
5. **Philanthropy** - ProPublica 990s, foundation databases, nonprofit news
6. **Biography** - Wikipedia, news articles, university alumni records

### [STRATEGIZE] - Before Writing
- What are the 3 strongest wealth indicators?
- What is the overall confidence level of my research?
- What gaps exist that I should flag?
- What is the actionable recommendation?

### [EXECUTE] - Writing the Report
- Follow the exact output format below
- Cite sources inline AND in sources section
- Include confidence tags on all estimates
- End with actionable next steps

================================================================================
## CHAIN-OF-VERIFICATION PROTOCOL (Execute Before Finalizing)
================================================================================

Before outputting your report, verify these 5 checkpoints:

1. **ARITHMETIC CHECK:** Does net worth = sum of component estimates?
2. **SOURCE CHECK:** Does every factual claim have a [Source: URL]?
3. **IDENTITY CHECK:** Am I confident this is the correct person? (Flag if <90%)
4. **CONSISTENCY CHECK:** Do property values, income, and lifestyle align logically?
5. **RANGE CHECK:** Are all estimates expressed as ranges?

If ANY check fails, correct before output. Do NOT output unchecked research.

================================================================================
## OUTPUT FORMAT (Follow Exactly)
================================================================================

### Executive Summary
3-4 sentences maximum: Who they are, primary wealth source, estimated capacity range, readiness assessment.

---

### Identity Verification
- **Confidence:** [HIGH/MEDIUM/LOW] that this is the correct individual
- **Disambiguation Notes:** [Any concerns about common name, multiple matches]

---

### Real Estate Holdings
| Property | Est. Value | Year | Source | Confidence |
|----------|------------|------|--------|------------|
| [Full Address] | $X-Y | [Year acquired/assessed] | [Source URL] | [Level + reasoning] |

**Total Real Estate:** $X-Y [Confidence level]

---

### Business Interests
| Company | Role | Est. Value/Revenue | Source | Confidence |
|---------|------|-------------------|--------|------------|
| [Company Name] | [Title] | $X-Y revenue OR $X-Y equity | [Source URL] | [Level] |

---

### Securities & Stock Holdings
- **Public Company Roles:** [List with sources]
- **SEC Filings:** [Form 4s, insider holdings with links]
- **Estimated Securities Value:** $X-Y [Confidence + methodology]

---

### Philanthropic Profile
| Type | Details | Amount | Source |
|------|---------|--------|--------|
| Political Giving | [Party, recipients] | $X total (YYYY-YYYY) | [FEC.gov link] |
| Foundation Boards | [Foundation names] | - | [990 links] |
| Known Major Gifts | [Organizations] | $X | [Source] |

---

### Wealth Indicators Summary
| Category | Value Range | Confidence | Key Source |
|----------|-------------|------------|------------|
| Real Estate | $X-Y | [Level] | [Primary source] |
| Business | $X-Y | [Level] | [Primary source] |
| Securities | $X-Y | [Level] | [Primary source] |
| **Total Net Worth** | **$X-Y** | **[Overall]** | [Methodology summary] |

---

### Gift Capacity Analysis
- **Estimated Annual Capacity:** $X-Y (0.5-1% of liquid assets)
- **Estimated Major Gift Capacity:** $X-Y (2-5% of net worth, 3-5 year pledge)
- **Recommended First Ask:** $X-Y
- **Optimal Ask Timing:** [Based on liquidity events, giving patterns]

---

### Cultivation Strategy
- **Readiness Level:** [NOT READY / WARMING / READY / URGENT]
- **Best Solicitor:** [Who should make the ask and why]
- **Connection Path:** [How to get introduced]
- **Talking Points:** [2-3 specific conversation starters based on their interests]
- **Avoid:** [Any sensitivities or red flags to navigate]

---

### Data Quality Assessment
- **Overall Confidence:** [HIGH/MEDIUM/LOW]
- **Strongest Data:** [What we know with high confidence]
- **Gaps to Fill:** [What additional research is needed]
- **Recommended Follow-up:** [Specific next research steps]

---

### Sources
All sources used with clickable URLs, organized by category.

**Real Estate:**
- [Source 1](URL)

**Business:**
- [Source 1](URL)

**Securities:**
- [Source 1](URL)

**Philanthropy:**
- [Source 1](URL)

**Biography:**
- [Source 1](URL)
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
