/**
 * Response Verification Service
 *
 * Uses Perplexity Sonar to verify and enhance Grok responses
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
  MODELS_REQUIRING_VERIFICATION,
} from "./config"

export interface VerificationRequest {
  originalResponse: string
  userQuery: string
  chatContext?: string
  modelId: string
}

export interface VerificationResult {
  verified: boolean
  mergedResponse: string
  corrections: string[]
  gapsFilled: string[]
  confidenceScore: number
  sources?: string[]
  verificationTimestamp: string
}

const VERIFICATION_SYSTEM_PROMPT = `You are a fact-checking and research verification assistant. Your job is to:

1. VERIFY the factual accuracy of the provided response using web search
2. CORRECT any factual errors you find
3. FILL IN any important gaps or missing information
4. MERGE your corrections and additions seamlessly into the original response

IMPORTANT RULES:
- Keep the original response structure and tone
- Only modify what needs correction or enhancement
- Add citations/sources for corrections using [Source: URL] format
- If the original response is accurate and complete, return it unchanged
- Focus on factual claims, not opinions or recommendations
- Be concise and efficient

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "verified": true,
  "mergedResponse": "The corrected and enhanced response text here",
  "corrections": ["List of corrections made, or empty array if none"],
  "gapsFilled": ["List of gaps filled with new information, or empty array if none"],
  "confidenceScore": 0.95,
  "sources": ["URLs used for verification, or empty array if none"]
}

verified: true if the response is mostly accurate (even if minor corrections made)
confidenceScore: 0.0-1.0 indicating overall accuracy confidence
mergedResponse: The final corrected/enhanced response text`

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
 * Verify and enhance a response using Perplexity Sonar
 */
export async function verifyResponse(
  request: VerificationRequest,
  apiKey: string
): Promise<VerificationResult | null> {
  try {
    console.log("[Verification] Starting verification for response...")

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

    const prompt = `USER QUERY:
${request.userQuery}

ORIGINAL RESPONSE TO VERIFY:
${responseToVerify}

Please verify this response for factual accuracy, correct any errors, and fill in important gaps. Return your analysis as JSON.`

    // Create AbortController for timeout
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, VERIFICATION_TIMEOUT)

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
      const result = JSON.parse(jsonMatch[0]) as Omit<
        VerificationResult,
        "verificationTimestamp"
      >

      // Validate mergedResponse - must be non-empty and reasonable length
      if (
        !result.mergedResponse ||
        typeof result.mergedResponse !== "string" ||
        result.mergedResponse.trim().length < 50
      ) {
        console.warn(
          "[Verification] Invalid mergedResponse - too short or missing"
        )
        return null
      }

      // Validate confidenceScore
      const confidenceScore =
        typeof result.confidenceScore === "number" &&
        result.confidenceScore >= 0 &&
        result.confidenceScore <= 1
          ? result.confidenceScore
          : 0.5

      console.log("[Verification] Completed with confidence:", confidenceScore)
      console.log(
        "[Verification] Corrections:",
        result.corrections?.length || 0
      )
      console.log("[Verification] Gaps filled:", result.gapsFilled?.length || 0)

      return {
        verified: result.verified !== false, // Default to true if not explicitly false
        mergedResponse: result.mergedResponse,
        corrections: Array.isArray(result.corrections) ? result.corrections : [],
        gapsFilled: Array.isArray(result.gapsFilled) ? result.gapsFilled : [],
        confidenceScore,
        sources: Array.isArray(result.sources) ? result.sources : [],
        verificationTimestamp: new Date().toISOString(),
      }
    } catch (parseError) {
      console.error("[Verification] Failed to parse JSON response:", parseError)
      return null
    }
  } catch (error) {
    // Check if it was a timeout
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[Verification] Request timed out after", VERIFICATION_TIMEOUT, "ms")
    } else {
      console.error("[Verification] Failed to verify response:", error)
    }
    return null
  }
}
