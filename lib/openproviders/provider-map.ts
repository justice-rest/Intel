import type { Provider, SupportedModel } from "./types"

// map each model ID to its provider
const MODEL_PROVIDER_MAP: Record<string, Provider> = {
  "openrouter:x-ai/grok-4.1-fast": "openrouter",
}

export function getProviderForModel(modelId: string | SupportedModel): Provider {
  const provider = MODEL_PROVIDER_MAP[modelId as string]
  if (!provider) {
    // Default to openrouter for any unrecognized model
    return "openrouter"
  }
  return provider
}
