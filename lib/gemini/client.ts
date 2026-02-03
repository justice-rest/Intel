/**
 * Gemini API Client
 *
 * Client for Google's Gemini API with grounded search capability.
 * Uses the @google/genai SDK for native Google Search grounding.
 *
 * Supports two modes:
 * - Flash (gemini-3-flash-preview): Fast, efficient for standard searches
 * - Pro (gemini-3-pro-preview): More capable for deep/ultra research
 *
 * @see https://ai.google.dev/gemini-api/docs/grounding
 */

import { GoogleGenAI } from "@google/genai"
import { getGeminiConfig, type GeminiModelType } from "./config"

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
  /** Model used for this search */
  model: string
}

export interface GeminiSearchOptions {
  /** The search query */
  query: string
  /** Model type: 'flash' for fast search, 'pro' for deep/ultra research */
  modelType?: GeminiModelType
  /** Additional context to improve search quality */
  context?: string
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
 * Build an optimized prompt for grounded search
 * This ensures we get the most relevant, recent, and comprehensive results
 */
function buildSearchPrompt(query: string, modelType: GeminiModelType, context?: string): string {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const baseInstructions = `You are a research assistant with access to Google Search. Today's date is ${currentDate}.

IMPORTANT INSTRUCTIONS:
- Search for the MOST RECENT and UP-TO-DATE information available
- Prioritize authoritative sources (official websites, news outlets, government records, Wikipedia)
- Include specific facts, dates, numbers, and verifiable details
- If information might be outdated, search for the latest updates
- Cross-reference multiple sources when possible
- Format your response with clear structure using markdown`

  if (modelType === "pro") {
    // Pro model - more comprehensive, multi-angle research
    return `${baseInstructions}

FOR THIS DEEP RESEARCH QUERY:
- Conduct MULTIPLE searches from different angles to ensure comprehensive coverage
- Look for primary sources and official records
- Include relevant background context and history
- Identify any recent news, updates, or changes
- Note any controversies, different perspectives, or nuances
- Provide specific citations and source attribution

${context ? `ADDITIONAL CONTEXT:\n${context}\n\n` : ""}RESEARCH QUERY:
${query}

Provide a thorough, well-structured response with all relevant findings.`
  }

  // Flash model - fast, focused search
  return `${baseInstructions}

${context ? `CONTEXT:\n${context}\n\n` : ""}QUERY:
${query}

Provide a clear, accurate, and well-sourced response.`
}

/**
 * Execute a grounded search using Gemini with Google Search
 *
 * This uses Gemini's native Google Search grounding to provide
 * real-time search results with citations.
 *
 * @param options - Search options including query and model type
 * @returns Grounded result with text and sources
 */
export async function geminiGroundedSearch(
  options: GeminiSearchOptions | string
): Promise<GeminiGroundedResult> {
  // Handle both string query and options object for backwards compatibility
  const opts: GeminiSearchOptions = typeof options === "string"
    ? { query: options, modelType: "flash" }
    : options

  const { query, modelType = "flash", context } = opts

  const config = getGeminiConfig(modelType)
  if (!config) {
    throw createGeminiError(
      "GOOGLE_AI_API_KEY is not configured",
      "NOT_CONFIGURED"
    )
  }

  try {
    console.log(`[Gemini] Starting grounded search with model: ${config.model} (${modelType})`)
    const ai = new GoogleGenAI({ apiKey: config.apiKey })

    // Build optimized prompt for maximum quality results
    const optimizedPrompt = buildSearchPrompt(query, modelType, context)

    const response = await ai.models.generateContent({
      model: config.model,
      contents: optimizedPrompt,
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

    console.log(`[Gemini] Search complete: ${text.length} chars, ${validSources.length} sources, ${groundingMetadata?.webSearchQueries?.length || 0} queries`)

    return {
      text,
      sources: validSources,
      searchQueries: groundingMetadata?.webSearchQueries || [],
      model: config.model,
    }
  } catch (error) {
    // If it's already our error type, rethrow
    if (error instanceof Error && "code" in error && (error as GeminiError).code) {
      throw error
    }

    console.error("[Gemini] Error details:", error)

    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      const fullMessage = error.message

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
