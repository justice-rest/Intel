import type { Provider, SupportedModel } from "./types"

/**
 * Model to Provider Mapping
 *
 * After the Gemini migration (2026-02):
 * - Google models: Direct Google Generative AI integration
 * - OpenRouter models: GPT-5 Nano for internal tool execution
 */
const MODEL_PROVIDER_MAP: Record<string, Provider> = {
  // Google Gemini models (primary)
  "google:gemini-3-flash-preview": "google",
  "google:gemini-3-pro-preview": "google",
  // OpenRouter models (internal use)
  "openrouter:openai/gpt-5-nano": "openrouter",
}

export function getProviderForModel(modelId: string | SupportedModel): Provider {
  const provider = MODEL_PROVIDER_MAP[modelId as string]
  if (provider) {
    return provider
  }

  // Determine provider from model ID prefix
  if (modelId.startsWith("google:")) {
    return "google"
  }

  // Default to openrouter for any unrecognized model
  return "openrouter"
}
