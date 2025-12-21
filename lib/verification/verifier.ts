/**
 * Response Verification Service
 *
 * Enterprise-grade Perplexity Sonar verification for Grok responses
 * Optimized for nonprofit prospect research with:
 * - Domain-specific fact-checking priorities
 * - Structured claim extraction and verification
 * - Source authority scoring
 * - Audit trail preservation
 */

import { generateText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import {
  isVerificationEnabled,
  VERIFICATION_MODEL_ID,
  MIN_RESPONSE_LENGTH_FOR_VERIFICATION,
  MAX_RESPONSE_LENGTH_FOR_VERIFICATION,
  VERIFICATION_MAX_TOKENS,
  VERIFICATION_TIMEOUT,
  BLOCKING_VERIFICATION_TIMEOUT,
  MODELS_REQUIRING_VERIFICATION,
  getSourceAuthority,
  CONFIDENCE_THRESHOLDS,
  type ClaimType,
  type ClaimStatus,
} from "./config"

export interface VerificationRequest {
  originalResponse: string
  userQuery: string
  chatContext?: string
  modelId: string
  /** Optional: tools that were used to generate the response (for context) */
  toolsUsed?: string[]
  /** Use blocking mode with shorter timeout (user is actively waiting) */
  blocking?: boolean
}

/**
 * Individual claim with verification status
 */
export interface VerifiedClaim {
  claim: string
  type: ClaimType
  status: ClaimStatus
  source?: string
  sourceAuthority?: number
  note?: string
}

export interface VerificationResult {
  verified: boolean
  mergedResponse: string
  corrections: string[]
  gapsFilled: string[]
  confidenceScore: number
  /** Average authority score of sources used */
  sourceAuthorityScore: number
  /** Individual claims with verification status */
  claims: VerifiedClaim[]
  sources?: string[]
  verificationTimestamp: string
  /** Confidence badge for UI: "verified" | "partial" | "unverified" | "low" */
  confidenceBadge: "verified" | "partial" | "unverified" | "low"
}

/**
 * Domain-specific system prompt for nonprofit prospect research verification
 * Optimized for Perplexity Sonar Pro's real-time web search capability
 */
const VERIFICATION_SYSTEM_PROMPT = `You are a NONPROFIT PROSPECT RESEARCH fact-checker with real-time web search.

CRITICAL: You MUST use your web search capability to verify claims. Do NOT rely on memory alone.

## YOUR MISSION
Verify a prospect research report for a nonprofit fundraiser. Your goal is to:
1. VERIFY factual claims against authoritative sources
2. CORRECT any errors you find
3. FILL GAPS with important missing information

## WHAT YOU CAN VERIFY (search for these)
For each claim type, search these SPECIFIC sources:

| Claim Type | Where to Search | What to Find |
|------------|-----------------|--------------|
| Board positions | "site:sec.gov DEF 14A [person name]" | Proxy statements list all directors |
| Executive roles | "site:sec.gov 10-K [company] officers" | Annual reports list officers |
| Stock holdings | "site:sec.gov Form 4 [person name]" | Insider transaction filings |
| Political giving | "site:fec.gov [person name] contributions" | Individual contribution records |
| Foundation grants | "site:projects.propublica.org 990 [foundation]" | IRS 990 grant data |
| Nonprofit boards | "site:propublica.org 990 [person name] officer" | 990 officer/director lists |
| Company ownership | "[person name] business entity [state] secretary of state" | State corporate filings |

## WHAT YOU CANNOT VERIFY (mark as "unverifiable")
- **Net worth** - No authoritative source exists (Forbes/Bloomberg are estimates)
- **Giving capacity** - Calculated estimate, not a verifiable fact
- **Private donations** - Not publicly disclosed
- **Family wealth** - Private information

## GAPS TO ACTIVELY SEARCH FOR
If the report is MISSING any of these, search and add them:

1. **SEC Form 4 filings** - Search: "site:sec.gov Form 4 [name]"
   → Shows stock transactions, proves insider status at public companies

2. **FEC contributions** - Search: "site:fec.gov [name] individual contributions"
   → Political giving history, often indicates wealth level

3. **Nonprofit 990 officer listings** - Search: "site:propublica.org [name] 990"
   → Board positions at nonprofits, foundation affiliations

4. **DEF 14A compensation** - Search: "site:sec.gov DEF 14A [name] compensation"
   → Executive compensation at public companies

5. **State business filings** - Search: "[name] registered agent [state]"
   → Business ownership, LLC memberships

## VERIFICATION WORKFLOW

STEP 1: Extract each factual claim from the response
STEP 2: For EACH claim, run a web search to verify
STEP 3: Mark each claim:
- ✓ VERIFIED - Found matching authoritative source (include URL)
- ✗ INCORRECT - Found contradicting authoritative source (explain what's wrong)
- ⚠ UNVERIFIED - Searched but found no authoritative source
- 🚫 UNVERIFIABLE - Claim type cannot be verified (net worth, capacity)

STEP 4: Search for MISSING information (gaps listed above)
STEP 5: Merge corrections and additions into the original response

## OUTPUT FORMAT (JSON)

{
  "verified": true,
  "mergedResponse": "The enhanced response with [Source: actual-url] citations inline for every added or corrected fact. Keep the original structure but weave in corrections naturally.",
  "claims": [
    {
      "claim": "Serves on Apple's board of directors",
      "type": "employment",
      "status": "verified",
      "source": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=apple&type=DEF+14A",
      "note": "Confirmed in Apple's 2024 DEF 14A proxy statement"
    },
    {
      "claim": "Net worth of $50 million",
      "type": "financial",
      "status": "unverifiable",
      "source": null,
      "note": "Net worth cannot be verified - no authoritative source exists"
    }
  ],
  "corrections": [
    "Changed 'CEO of XYZ Corp' to 'Former CEO' - SEC 8-K filing from March 2024 shows resignation"
  ],
  "gapsFilled": [
    "Added FEC contribution history: $125,000 to federal candidates 2020-2024 [Source: fec.gov]",
    "Added nonprofit board position: Trustee, Gates Foundation since 2019 [Source: 990 filing]"
  ],
  "confidenceScore": 0.85,
  "sources": ["https://sec.gov/...", "https://fec.gov/...", "https://projects.propublica.org/..."]
}

## CRITICAL RULES

1. **ALWAYS SEARCH** - Do not verify from memory. Use web search for every claim.
2. **CITE ACTUAL URLs** - Every correction/addition must have a real, working source URL
3. **NEVER FABRICATE** - If you can't find a source, mark as "unverified", don't make one up
4. **DATE CONTEXT** - Include "As of [date]" or "Per [year] filing" for time-sensitive claims
5. **PRESERVE TONE** - Keep the original report's structure and tone, just fix facts
6. **BE HONEST** - If the original is already accurate, say so with high confidence

Claim types: "financial" | "employment" | "philanthropic" | "biographical" | "political" | "legal"
Claim status: "verified" | "unverified" | "incorrect" | "outdated" | "unverifiable"`

/**
 * Check if verification should run for this response
 */
export function shouldVerifyResponse(
  modelId: string,
  responseText: string
): boolean {
  if (!isVerificationEnabled()) {
    console.log("[Verification] Disabled via environment variable")
    return false
  }
  if (!MODELS_REQUIRING_VERIFICATION.includes(modelId)) {
    console.log("[Verification] Model not in verification list:", modelId)
    return false
  }
  if (responseText.length < MIN_RESPONSE_LENGTH_FOR_VERIFICATION) {
    console.log(
      "[Verification] Response too short:",
      responseText.length,
      "chars"
    )
    return false
  }
  return true
}

/**
 * Calculate confidence badge based on score
 */
function getConfidenceBadge(score: number): "verified" | "partial" | "unverified" | "low" {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return "verified"
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return "partial"
  if (score >= CONFIDENCE_THRESHOLDS.LOW) return "unverified"
  return "low"
}

/**
 * Calculate average source authority from claims and sources
 */
function calculateSourceAuthorityScore(
  claims: VerifiedClaim[],
  sources: string[]
): number {
  const scores: number[] = []

  // Get scores from claims with sources
  for (const claim of claims) {
    if (claim.source && claim.status === "verified") {
      const score = claim.sourceAuthority ?? getSourceAuthority(claim.source)
      scores.push(score)
    }
  }

  // Get scores from standalone sources
  for (const source of sources) {
    scores.push(getSourceAuthority(source))
  }

  if (scores.length === 0) return 0.3 // No sources = low authority
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

/**
 * Verify and enhance a response using Perplexity Sonar
 * Enterprise-grade verification with claim extraction and source authority scoring
 */
export async function verifyResponse(
  request: VerificationRequest,
  apiKey: string
): Promise<VerificationResult | null> {
  try {
    console.log("[Verification] Starting enterprise verification...")
    console.log("[Verification] Query:", request.userQuery.substring(0, 100) + "...")

    // Validate API key
    if (!apiKey) {
      console.error("[Verification] No API key provided")
      return null
    }

    const openrouter = createOpenRouter({ apiKey })
    const model = openrouter.chat(VERIFICATION_MODEL_ID)

    // Truncate response if too long to save tokens
    const responseToVerify =
      request.originalResponse.length > MAX_RESPONSE_LENGTH_FOR_VERIFICATION
        ? request.originalResponse.substring(
            0,
            MAX_RESPONSE_LENGTH_FOR_VERIFICATION
          ) + "\n\n[Response truncated for verification]"
        : request.originalResponse

    // Build context-aware prompt
    let prompt = `USER QUERY:
${request.userQuery}

ORIGINAL RESPONSE TO VERIFY:
${responseToVerify}`

    // Add tool context if available (helps verification understand data sources)
    if (request.toolsUsed && request.toolsUsed.length > 0) {
      prompt += `\n\nTOOLS USED TO GENERATE RESPONSE:
${request.toolsUsed.join(", ")}
(This context helps you understand which data sources were already queried)`
    }

    prompt += `\n\nPlease verify this response for factual accuracy using your web search capability. Extract key claims, verify each against authoritative sources, correct any errors, and fill in important gaps. Return your analysis as JSON.`

    // Create AbortController for timeout
    // Use shorter timeout in blocking mode (user is actively waiting)
    const timeout = request.blocking ? BLOCKING_VERIFICATION_TIMEOUT : VERIFICATION_TIMEOUT
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, timeout)

    console.log(`[Verification] Mode: ${request.blocking ? "BLOCKING" : "async"}, Timeout: ${timeout}ms`)

    let text: string
    try {
      const result = await generateText({
        model,
        system: VERIFICATION_SYSTEM_PROMPT,
        prompt,
        maxTokens: VERIFICATION_MAX_TOKENS,
        abortSignal: abortController.signal,
      })
      text = result.text
    } finally {
      clearTimeout(timeoutId)
    }

    // Parse JSON response - find JSON object in response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn("[Verification] No JSON found in response")
      return null
    }

    try {
      const parsed = JSON.parse(jsonMatch[0])

      // Validate mergedResponse - must be non-empty and reasonable length
      if (
        !parsed.mergedResponse ||
        typeof parsed.mergedResponse !== "string" ||
        parsed.mergedResponse.trim().length < 50
      ) {
        console.warn(
          "[Verification] Invalid mergedResponse - too short or missing"
        )
        return null
      }

      // Validate and normalize confidenceScore
      const confidenceScore =
        typeof parsed.confidenceScore === "number" &&
        parsed.confidenceScore >= 0 &&
        parsed.confidenceScore <= 1
          ? parsed.confidenceScore
          : 0.5

      // Parse and validate claims array
      const claims: VerifiedClaim[] = []
      if (Array.isArray(parsed.claims)) {
        for (const claim of parsed.claims) {
          if (claim && typeof claim.claim === "string") {
            claims.push({
              claim: claim.claim,
              type: claim.type || "biographical",
              status: claim.status || "unverified",
              source: claim.source || undefined,
              sourceAuthority: claim.source ? getSourceAuthority(claim.source) : undefined,
              note: claim.note || undefined,
            })
          }
        }
      }

      // Extract sources
      const sources = Array.isArray(parsed.sources) ? parsed.sources : []

      // Calculate source authority score
      const sourceAuthorityScore = calculateSourceAuthorityScore(claims, sources)

      // Adjust confidence based on source authority
      // High authority sources increase confidence, low authority decreases it
      const adjustedConfidence = Math.min(1, Math.max(0,
        confidenceScore * 0.6 + sourceAuthorityScore * 0.4
      ))

      // Get confidence badge
      const confidenceBadge = getConfidenceBadge(adjustedConfidence)

      // Log verification summary
      console.log("[Verification] Completed successfully:")
      console.log(`  - Raw confidence: ${(confidenceScore * 100).toFixed(0)}%`)
      console.log(`  - Source authority: ${(sourceAuthorityScore * 100).toFixed(0)}%`)
      console.log(`  - Adjusted confidence: ${(adjustedConfidence * 100).toFixed(0)}%`)
      console.log(`  - Badge: ${confidenceBadge}`)
      console.log(`  - Claims extracted: ${claims.length}`)
      console.log(`  - Verified claims: ${claims.filter(c => c.status === "verified").length}`)
      console.log(`  - Unverified claims: ${claims.filter(c => c.status === "unverified").length}`)
      console.log(`  - Incorrect claims: ${claims.filter(c => c.status === "incorrect").length}`)
      console.log(`  - Corrections: ${parsed.corrections?.length || 0}`)
      console.log(`  - Gaps filled: ${parsed.gapsFilled?.length || 0}`)

      return {
        verified: parsed.verified !== false,
        mergedResponse: parsed.mergedResponse,
        corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
        gapsFilled: Array.isArray(parsed.gapsFilled) ? parsed.gapsFilled : [],
        confidenceScore: adjustedConfidence,
        sourceAuthorityScore,
        claims,
        sources,
        verificationTimestamp: new Date().toISOString(),
        confidenceBadge,
      }
    } catch (parseError) {
      console.error("[Verification] Failed to parse JSON response:", parseError)
      console.error("[Verification] Raw response:", text.substring(0, 500))
      return null
    }
  } catch (error) {
    // Check if it was a timeout
    if (error instanceof Error && error.name === "AbortError") {
      const timeout = request.blocking ? BLOCKING_VERIFICATION_TIMEOUT : VERIFICATION_TIMEOUT
      console.error(`[Verification] Request timed out after ${timeout}ms (blocking: ${request.blocking})`)
    } else {
      console.error("[Verification] Failed to verify response:", error)
    }
    return null
  }
}
