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

  let prompt = `You are a prospect researcher for nonprofit fundraising. Research the following individual and provide comprehensive, factual information with citations.

**Prospect Name:** ${name}
${address ? `**Address:** ${address}` : ""}
${context ? `**Additional Context:** ${context}` : ""}

## Research Focus Areas
${focusInstructions}

## Requirements
1. **CITE ALL SOURCES** - Every factual claim must include a source URL
2. **USE RANGES** for estimated values (e.g., "$2-5M" not "$3.5M")
3. **MARK ESTIMATES** clearly with [Estimated] tag
4. **VERIFY INFORMATION** - Cross-reference multiple sources when possible
5. **DO NOT FABRICATE** - If information is not found, say "Not found in public records"

## Output Format
Provide a structured research report with these sections:

### Executive Summary
2-3 sentence overview of the prospect's wealth indicators and philanthropic potential.

### Real Estate
Property holdings with estimated values and sources.

### Business Interests
Companies, executive positions, board seats with sources.

### Securities & Stock Holdings
Public company affiliations, insider holdings (if applicable).

### Philanthropic Profile
Foundation board seats, major gifts, nonprofit affiliations.

### Wealth Indicators Summary
| Indicator | Value | Confidence | Source |
|-----------|-------|------------|--------|
| Real Estate | $X-Y | HIGH/MEDIUM/LOW | [Source] |
| Business | Description | HIGH/MEDIUM/LOW | [Source] |
| Philanthropy | Description | HIGH/MEDIUM/LOW | [Source] |

### Sources
List all sources used with URLs.`

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
      ? "Deep prospect research using Perplexity Sonar Deep Research's multi-step autonomous search. " +
        "Performs comprehensive, multi-step investigation for complex research requests. " +
        "Returns deeply-researched results with extensive citations. " +
        "Use for thorough donor investigations requiring maximum depth."
      : "Comprehensive prospect research using Perplexity Sonar Pro's agentic web search. " +
        "Searches real estate, business ownership, securities, philanthropy, and biographical data with citations. " +
        "Returns grounded, factual results from authoritative sources. " +
        "Use for detailed donor research when you need verified information with sources.",
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
