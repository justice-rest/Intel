/**
 * Sonar Research Helper
 * Calls Perplexity Sonar Reasoning Pro for deep prospect research
 */

import { generateText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { ProspectInputData, SonarResearchResult } from "./types"
import { buildProspectQueryString } from "./parser"

// ============================================================================
// SONAR RESEARCH PROMPT
// ============================================================================

const SONAR_RESEARCH_PROMPT = `You are a prospect research expert. Conduct thorough research on this individual for nonprofit fundraising purposes.

## RESEARCH PRIORITIES (in order):

1. **Real Estate Holdings**
   - Primary residence value (check Zillow, Redfin, county assessor)
   - Additional properties owned
   - Total real estate portfolio value

2. **Business Ownership & Employment**
   - Companies they own or founded
   - Current employment and title
   - Board positions (corporate and nonprofit)
   - Business revenue estimates

3. **Securities & Public Company Affiliations**
   - SEC Form 4 insider filings
   - Public company directorships
   - Stock holdings if disclosed

4. **Philanthropic Activity**
   - Foundation affiliations (check ProPublica Nonprofit Explorer for 990s)
   - Nonprofit board service
   - Known major gifts
   - Giving interests/causes

5. **Political Contributions**
   - FEC contribution records
   - Total political giving
   - Party affiliation pattern

6. **Background & Education**
   - Educational background
   - Career history
   - Professional affiliations
   - Notable achievements

## OUTPUT FORMAT:

Provide your findings in a structured format. For each category:
- Include specific dollar amounts where found
- Cite your sources (e.g., "per Zillow", "per SEC Form 4", "per FEC records")
- Note confidence level: [Verified], [Estimated], or [Unverified]
- Say "Not found in public records" if no data available

Be thorough but factual. Never fabricate data.`

// ============================================================================
// SONAR API CALL
// ============================================================================

/**
 * Call Perplexity Sonar Reasoning Pro for deep prospect research
 */
export async function callSonarReasoningPro(params: {
  name: string
  address: string
  city?: string
  state?: string
  context?: string
  apiKey?: string
}): Promise<SonarResearchResult> {
  const { name, address, city, state, context, apiKey } = params

  const location = [city, state].filter(Boolean).join(", ")
  const fullAddress = address || location

  const userMessage = `Research this individual for major gift prospect identification:

**Name:** ${name}
**Address:** ${fullAddress}
${context ? `**Additional Context:** ${context}` : ""}

Conduct comprehensive research using your web search capabilities. Focus on:
1. Property ownership and values at this address and any other properties
2. Business ownership, employment, and professional background
3. SEC filings if they're a public company insider
4. Philanthropic history and nonprofit affiliations (check ProPublica 990s)
5. Political contributions (FEC records)
6. Educational background and career history

Provide specific dollar amounts and cite your sources.`

  console.log(`[SonarResearch] Starting research for: ${name}`)
  const startTime = Date.now()

  try {
    const openrouter = createOpenRouter({
      apiKey: apiKey || process.env.OPENROUTER_API_KEY,
    })

    const result = await generateText({
      model: openrouter("perplexity/sonar-reasoning-pro"),
      system: SONAR_RESEARCH_PROMPT,
      prompt: userMessage,
      maxTokens: 4000,
    })

    const duration = Date.now() - startTime
    console.log(`[SonarResearch] Completed research for ${name} in ${duration}ms`)

    // Extract sources from the response
    const sources = extractSourcesFromText(result.text)

    return {
      content: result.text,
      sources,
      tokens: (result.usage?.promptTokens || 0) + (result.usage?.completionTokens || 0),
    }
  } catch (error) {
    console.error(`[SonarResearch] Error researching ${name}:`, error)
    throw error
  }
}

/**
 * Extract source URLs from Sonar's response text
 * Sonar includes citations inline in its responses
 */
function extractSourcesFromText(text: string): Array<{ name: string; url: string }> {
  const sources: Array<{ name: string; url: string }> = []
  const seen = new Set<string>()

  // Match URLs in the text
  const urlPattern = /https?:\/\/[^\s\)\]]+/g
  const matches = text.match(urlPattern) || []

  for (const url of matches) {
    // Clean up URL (remove trailing punctuation)
    const cleanUrl = url.replace(/[.,;:!?]+$/, "")

    if (!seen.has(cleanUrl)) {
      seen.add(cleanUrl)

      // Extract domain as name
      try {
        const urlObj = new URL(cleanUrl)
        const domain = urlObj.hostname.replace(/^www\./, "")
        sources.push({ name: domain, url: cleanUrl })
      } catch {
        // Skip invalid URLs
      }
    }
  }

  // Also look for citation patterns like [1], [2] with corresponding links
  const citationPattern = /\[(\d+)\]\s*(?:https?:\/\/[^\s\)\]]+|[^\[\]]+)/g
  const citationMatches = text.matchAll(citationPattern)

  for (const match of citationMatches) {
    const fullMatch = match[0]
    const urlMatch = fullMatch.match(/https?:\/\/[^\s\)\]]+/)
    if (urlMatch && !seen.has(urlMatch[0])) {
      const cleanUrl = urlMatch[0].replace(/[.,;:!?]+$/, "")
      seen.add(cleanUrl)
      try {
        const urlObj = new URL(cleanUrl)
        const domain = urlObj.hostname.replace(/^www\./, "")
        sources.push({ name: domain, url: cleanUrl })
      } catch {
        // Skip invalid URLs
      }
    }
  }

  return sources.slice(0, 10) // Limit to 10 sources
}

/**
 * Build a comprehensive prospect query string from input data
 */
export function buildResearchQuery(prospect: ProspectInputData): string {
  return buildProspectQueryString(prospect)
}
