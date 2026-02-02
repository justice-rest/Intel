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
    const ai = new GoogleGenAI({ apiKey: config.apiKey })

    const response = await ai.models.generateContent({
      model: config.model,
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    })

    // Extract grounding metadata for citations
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata
    const sources =
      groundingMetadata?.groundingChunks?.map((chunk) => ({
        uri: chunk.web?.uri || "",
        title: chunk.web?.title || "",
      })) || []

    // Filter out empty sources
    const validSources = sources.filter((s) => s.uri && s.title)

    return {
      text: response.text || "",
      sources: validSources,
      searchQueries: groundingMetadata?.webSearchQueries || [],
    }
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

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
        message.includes("invalid api key")
      ) {
        throw createGeminiError("Invalid Gemini API key", "API_ERROR", {
          statusCode: 401,
          retryable: false,
          cause: error,
        })
      }

      if (message.includes("429") || message.includes("rate limit")) {
        throw createGeminiError("Gemini rate limit exceeded", "API_ERROR", {
          statusCode: 429,
          retryable: true,
          cause: error,
        })
      }

      throw createGeminiError(error.message, "API_ERROR", {
        retryable: false,
        cause: error,
      })
    }

    throw createGeminiError(String(error), "UNKNOWN_ERROR", {
      retryable: false,
    })
  }
}
