import type { LanguageModel } from "ai"
import { getProviderForModel } from "./provider-map"
import type { SupportedModel } from "./types"

export type OpenProvidersOptions<T extends SupportedModel> = Record<string, never>

export function openproviders<T extends SupportedModel>(
  modelId: T,
  settings?: OpenProvidersOptions<T>,
  apiKey?: string
): LanguageModel {
  const provider = getProviderForModel(modelId)

  if (provider === "openrouter") {
    // OpenRouter models are handled through their own apiSdk function
    // This function shouldn't be called directly for OpenRouter models
    throw new Error(
      "OpenRouter models should use their model definition's apiSdk function"
    )
  }

  throw new Error(`Unsupported model: ${modelId}`)
}
