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
  code: "NOT_CONFIGURED" | "API_ERROR" | "TIMEOUT" | "UNKNOWN_ERROR"
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

    // Log response structure for debugging
    console.log("[Gemini] Response received, extracting content...")

    // Extract text from response - try multiple paths
    let text = ""
    try {
      // Primary: use convenience accessor
      text = response.text || ""
    } catch {
      // Fallback: access through candidates structure
      const candidate = response.candidates?.[0]
      if (candidate?.content?.parts?.[0]) {
        const part = candidate.content.parts[0] as { text?: string }
        text = part.text || ""
      }
    }

    if (!text) {
      console.warn("[Gemini] No text in response, raw response:", JSON.stringify(response).slice(0, 500))
    }

    // Extract grounding metadata for citations
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata as {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>
      webSearchQueries?: string[]
    } | undefined

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
    // Log the full error for debugging
    console.error("[Gemini] Error details:", error)

    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      const fullMessage = error.message // Keep original case for user

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

      // Be more specific about rate limits - check for actual rate limit errors
      // vs quota errors (which are different)
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

      // Check for quota exceeded (different from rate limit)
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

      // Pass through the actual error message for better debugging
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
