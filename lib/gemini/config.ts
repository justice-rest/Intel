/**
 * Gemini API Configuration
 *
 * Configuration for Google's Gemini API with grounded search.
 * Used for beta feature: Gemini Grounded Search
 *
 * @see https://ai.google.dev/gemini-api/docs
 */

export interface GeminiConfig {
  /** API key (from GOOGLE_AI_API_KEY env var) */
  apiKey: string
  /** Model to use for grounded search */
  model: string
  /** Request timeout in ms */
  timeout: number
}

/**
 * Check if Gemini is available (API key is set)
 */
export function isGeminiAvailable(): boolean {
  return !!process.env.GOOGLE_AI_API_KEY
}

/**
 * Get Gemini configuration from environment
 */
export function getGeminiConfig(): GeminiConfig | null {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) return null

  return {
    apiKey,
    model: "gemini-2.0-flash",
    timeout: 30000, // 30 seconds
  }
}
