/**
 * Jina DeepSearch Configuration
 * Centralized configuration for Jina DeepSearch integration
 *
 * Jina DeepSearch is an autonomous research agent that iteratively
 * searches, reads, and reasons about web content to answer complex queries.
 */

/**
 * Check if Jina API key is configured
 */
export function isJinaEnabled(): boolean {
  return !!process.env.JINA_API_KEY
}

/**
 * Get Jina API key from environment
 * @throws Error if JINA_API_KEY is not configured
 */
export function getJinaApiKey(): string {
  const apiKey = process.env.JINA_API_KEY

  if (!apiKey) {
    throw new Error(
      "JINA_API_KEY is not configured. Please add it to your environment variables."
    )
  }

  return apiKey
}

/**
 * Get Jina API key if available, otherwise return null
 */
export function getJinaApiKeyOptional(): string | null {
  return process.env.JINA_API_KEY || null
}

/**
 * Jina DeepSearch API endpoint
 * OpenAI-compatible chat completions API
 */
export const JINA_API_URL = "https://deepsearch.jina.ai/v1/chat/completions"

/**
 * Default configuration for Jina DeepSearch
 *
 * - reasoning_effort: Controls depth of reasoning (low/medium/high)
 *   - low: Fast, basic research (~20s, ~30k tokens)
 *   - medium: Balanced (default, ~57s, ~70k tokens)
 *   - high: Thorough, deep research (~120s, ~150k tokens)
 * - stream: Always true for handling long requests
 */
export const JINA_DEFAULTS = {
  model: "jina-deepsearch-v1" as const,
  reasoningEffort: "low" as const,
  stream: true,
  maxReturnedUrls: 10,
} as const

/**
 * Jina reasoning effort levels
 * - low: Fast, basic research
 * - medium: Balanced depth and speed (default)
 * - high: Deep, thorough research
 */
export type JinaReasoningEffort = "low" | "medium" | "high"
