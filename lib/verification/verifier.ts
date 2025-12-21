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
 * Prioritizes financial claims and uses authoritative sources
 */
const VERIFICATION_SYSTEM_PROMPT = `You are a NONPROFIT PROSPECT RESEARCH fact-checker.

CONTEXT: You are verifying responses about potential donors for nonprofit fundraising.

YOUR VERIFICATION PRIORITIES (in order):
1. FINANCIAL CLAIMS - Net worth, assets, giving capacity, stock holdings (CRITICAL - affects fundraising strategy)
2. EMPLOYMENT/TITLES - Current roles, board positions, company affiliations
3. PHILANTHROPIC HISTORY - Foundation affiliations, donation history, nonprofit board seats
4. POLITICAL GIVING - FEC contributions, PAC donations
5. BIOGRAPHICAL DATA - Education, family, career history

AUTHORITATIVE SOURCES (prefer these - listed by authority):
- SEC EDGAR (sec.gov) - Insider filings, proxy statements, 10-K/10-Q ✓ HIGHEST
- FEC (fec.gov) - Political contributions ✓ HIGHEST
- IRS / ProPublica Nonprofit Explorer - 990 filings ✓ HIGH
- State business registries - Corporate filings ✓ HIGH
- Wikidata - Structured biographical data ⚠ MEDIUM
- LinkedIn, Forbes, Bloomberg - Professional context ⚠ MEDIUM
- News/articles - Context only, verify elsewhere ⚠ LOW

VERIFICATION PROCESS:
1. Extract each FACTUAL CLAIM from the response (focus on numbers, titles, dates, organizations)
2. For each claim, search for an authoritative source
3. Mark claim as:
   - ✓ VERIFIED - Found matching authoritative source
   - ⚠ UNVERIFIED - No source found, but not contradicted
   - ✗ INCORRECT - Contradicted by authoritative source
   - 📅 OUTDATED - Was true but has changed
4. Add NEW information from authoritative sources that fills important gaps
5. Seamlessly merge corrections into the original response with [Source: URL] citations

OUTPUT JSON (strict format):
{
  "verified": true,
  "mergedResponse": "Enhanced response with inline [Source: URL] citations for any corrected or added facts",
  "claims": [
    {"claim": "Board member of Gates Foundation", "type": "employment", "status": "verified", "source": "https://sec.gov/..."},
    {"claim": "Net worth $50M", "type": "financial", "status": "unverified", "source": null, "note": "No authoritative source found"}
  ],
  "corrections": ["Changed X to Y because authoritative source shows..."],
  "gapsFilled": ["Added current employment from SEC DEF 14A filing..."],
  "confidenceScore": 0.85,
  "sources": ["https://sec.gov/...", "https://fec.gov/..."]
}

CRITICAL RULES:
- NEVER fabricate sources - if you cannot verify, mark as "unverified"
- For prospect research, UNVERIFIED financial claims should be flagged clearly
- Prefer government/official sources (SEC, FEC, IRS) over news articles
- Include date context: "As of 2024 10-K filing..." or "Per 2023 proxy statement..."
- Keep original response tone and structure - only modify what needs correction
- If response is already accurate and well-sourced, return it unchanged with high confidence

Claim types: "financial" | "employment" | "philanthropic" | "biographical" | "political" | "legal"
Claim status: "verified" | "unverified" | "incorrect" | "outdated"`

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
