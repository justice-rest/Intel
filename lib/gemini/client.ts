/**
 * Gemini API Client
 *
 * Client for Google's Gemini API with grounded search capability.
 * Uses the @google/genai SDK for native Google Search grounding.
 *
 * @see https://ai.google.dev/gemini-api/docs/grounding
 */

import { GoogleGenAI } from "@google/genai"
import { getGeminiConfig } from "./config"

export interface GeminiGroundedResult {
  /** The generated text response */
  text: string
  /** Sources with citations from Google Search */
  sources: Array<{
    uri: string
    title: string
  }>
  /** Search queries that were executed */
  searchQueries: string[]
}

export interface GeminiError extends Error {
  code: "NOT_CONFIGURED" | "API_ERROR" | "TIMEOUT" | "UNKNOWN_ERROR" | "EMPTY_RESPONSE" | "SAFETY_BLOCKED"
  statusCode?: number
  retryable: boolean
}

function createGeminiError(
  message: string,
  code: GeminiError["code"],
  options?: {
    statusCode?: number
    retryable?: boolean
    cause?: Error
  }
): GeminiError {
  const error = new Error(message) as GeminiError
  error.name = "GeminiError"
  error.code = code
  error.statusCode = options?.statusCode
  error.retryable = options?.retryable ?? false
  if (options?.cause) {
    error.cause = options.cause
  }
  return error
}

/**
 * Safely extract text from Gemini response
 * The SDK can throw when accessing response.text if there are issues
 */
function extractTextFromResponse(response: any): string {
  // Method 1: Try the convenience accessor (may throw)
  try {
    if (typeof response.text === "string") {
      return response.text
    }
    // If response.text is a getter that throws, this will be caught below
    const text = response.text
    if (text) return text
  } catch (e) {
    console.warn("[Gemini] response.text accessor failed:", e)
  }

  // Method 2: Try candidates[0].content.parts[0].text
  try {
    const candidate = response?.candidates?.[0]
    if (candidate?.content?.parts?.length > 0) {
      const textParts = candidate.content.parts
        .filter((p: any) => typeof p.text === "string")
        .map((p: any) => p.text)
      if (textParts.length > 0) {
        return textParts.join("\n")
      }
    }
  } catch (e) {
    console.warn("[Gemini] candidates parsing failed:", e)
  }

  // Method 3: Check for direct content field
  try {
    if (response?.content) {
      return typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content)
    }
  } catch (e) {
    console.warn("[Gemini] content field parsing failed:", e)
  }

  return ""
}

/**
 * Check if response was blocked by safety filters
 */
function checkSafetyBlock(response: any): string | null {
  try {
    const candidate = response?.candidates?.[0]
    if (candidate?.finishReason === "SAFETY") {
      return "Response blocked by safety filters"
    }
    if (candidate?.finishReason === "RECITATION") {
      return "Response blocked due to recitation concerns"
    }
    if (!candidate && response?.promptFeedback?.blockReason) {
      return `Prompt blocked: ${response.promptFeedback.blockReason}`
    }
  } catch {
    // Ignore parsing errors
  }
  return null
}

/**
 * Execute a grounded search using Gemini with Google Search
 *
 * This uses Gemini's native Google Search grounding to provide
 * real-time search results with citations.
 *
 * @param query - The search query
 * @returns Grounded result with text and sources
 */
export async function geminiGroundedSearch(
  query: string
): Promise<GeminiGroundedResult> {
  const config = getGeminiConfig()
  if (!config) {
    throw createGeminiError(
      "GOOGLE_AI_API_KEY is not configured",
      "NOT_CONFIGURED"
    )
  }

  try {
    console.log("[Gemini] Starting grounded search with model:", config.model)
    const ai = new GoogleGenAI({ apiKey: config.apiKey })

    const response = await ai.models.generateContent({
      model: config.model,
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    })

    console.log("[Gemini] Response received, extracting content...")

    // Check for safety blocks first
    const safetyBlock = checkSafetyBlock(response)
    if (safetyBlock) {
      throw createGeminiError(safetyBlock, "SAFETY_BLOCKED", {
        retryable: false,
      })
    }

    // Extract text using robust method
    const text = extractTextFromResponse(response)

    if (!text) {
      // Log response structure for debugging
      console.warn(
        "[Gemini] No text extracted. Response structure:",
        JSON.stringify(response, null, 2).slice(0, 1000)
      )
      throw createGeminiError(
        "Empty response from Gemini. The model may not have generated a response.",
        "EMPTY_RESPONSE",
        { retryable: true }
      )
    }

    // Extract grounding metadata for citations
    let groundingMetadata: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>
      webSearchQueries?: string[]
    } | undefined

    try {
      groundingMetadata = response.candidates?.[0]?.groundingMetadata
    } catch (e) {
      console.warn("[Gemini] Failed to extract grounding metadata:", e)
    }

    const sources =
      groundingMetadata?.groundingChunks?.map((chunk) => ({
        uri: chunk.web?.uri || "",
        title: chunk.web?.title || "",
      })) || []

    // Filter out empty sources
    const validSources = sources.filter((s) => s.uri && s.title)

    console.log(`[Gemini] Search complete: ${text.length} chars, ${validSources.length} sources`)

    return {
      text,
      sources: validSources,
      searchQueries: groundingMetadata?.webSearchQueries || [],
    }
  } catch (error) {
    // If it's already our error type, rethrow
    if (error instanceof Error && "code" in error && (error as GeminiError).code) {
      throw error
    }

    // Log the full error for debugging
    console.error("[Gemini] Error details:", error)

    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      const fullMessage = error.message

      // Check for specific error types
      if (message.includes("timeout") || message.includes("timed out")) {
        throw createGeminiError("Gemini request timed out", "TIMEOUT", {
          retryable: true,
          cause: error,
        })
      }

      if (
        message.includes("401") ||
        message.includes("unauthorized") ||
        message.includes("invalid api key") ||
        message.includes("api key not valid")
      ) {
        throw createGeminiError("Invalid Gemini API key", "API_ERROR", {
          statusCode: 401,
          retryable: false,
          cause: error,
        })
      }

      // Check for rate limits
      if (message.includes("429") || message.includes("resource_exhausted")) {
        throw createGeminiError(
          "Gemini rate limit exceeded. Try again in a moment.",
          "API_ERROR",
          {
            statusCode: 429,
            retryable: true,
            cause: error,
          }
        )
      }

      // Check for quota exceeded
      if (message.includes("quota") || message.includes("billing")) {
        throw createGeminiError(
          "Gemini quota exceeded. Check your Google Cloud billing and quotas.",
          "API_ERROR",
          {
            statusCode: 403,
            retryable: false,
            cause: error,
          }
        )
      }

      // Check for model not found
      if (message.includes("not found") || message.includes("404")) {
        throw createGeminiError(
          `Model ${config.model} not available. Check model name.`,
          "API_ERROR",
          {
            statusCode: 404,
            retryable: false,
            cause: error,
          }
        )
      }

      // Check for parsing errors from SDK
      if (message.includes("parse") || message.includes("json")) {
        throw createGeminiError(
          `Failed to parse Gemini response: ${fullMessage}`,
          "API_ERROR",
          {
            retryable: true,
            cause: error,
          }
        )
      }

      // Pass through the actual error message
      throw createGeminiError(fullMessage, "API_ERROR", {
        retryable: false,
        cause: error,
      })
    }

    throw createGeminiError(String(error), "UNKNOWN_ERROR", {
      retryable: false,
    })
  }
}
