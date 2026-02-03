/**
 * Gemini API Configuration
 *
 * Configuration for Google's Gemini API with grounded search.
 * Used for beta features: Gemini Search (Flash) and Gemini Ultra Search (Pro)
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

/** Available Gemini models for grounded search */
export const GEMINI_MODELS = {
  /** Gemini 3 Flash Preview - Fast, efficient, great for standard searches */
  flash: "gemini-3-flash-preview",
  /** Gemini 3 Pro Preview - More capable, better for deep/ultra research */
  pro: "gemini-3-pro-preview",
} as const

export type GeminiModelType = keyof typeof GEMINI_MODELS

/**
 * Check if Gemini is available (API key is set)
 */
export function isGeminiAvailable(): boolean {
  return !!process.env.GOOGLE_AI_API_KEY
}

/**
 * Get Gemini configuration for a specific model type
 *
 * @param modelType - 'flash' for standard search, 'pro' for ultra/deep research
 */
export function getGeminiConfig(modelType: GeminiModelType = "flash"): GeminiConfig | null {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) return null

  const timeouts: Record<GeminiModelType, number> = {
    flash: 60000,  // 60 seconds
    pro: 120000,   // 120 seconds (Pro can take longer for complex queries)
  }

  return {
    apiKey,
    model: GEMINI_MODELS[modelType],
    timeout: timeouts[modelType],
  }
}
