import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { ModelConfig } from "../types"

export const openrouterModels: ModelConfig[] = [
  {
    id: "openrouter:x-ai/grok-4.1-fast",
    name: "Grok 4.1 Fast",
    provider: "OpenRouter",
    providerId: "openrouter",
    modelFamily: "Grok",
    baseProviderId: "xai",
    description:
      "xAI's latest Grok model with enhanced speed and reasoning capabilities, optimized for fast inference.",
    tags: ["fast", "reasoning", "efficient", "flagship"],
    contextWindow: 131072,
    inputCost: 0.5,
    outputCost: 1.0,
    priceUnit: "per 1M tokens",
    vision: true,
    tools: true,
    audio: false,
    reasoning: true,
    webSearch: true,
    openSource: false,
    speed: "Fast",
    intelligence: "High",
    website: "https://openrouter.ai",
    apiDocs: "https://openrouter.ai/x-ai/grok-4.1-fast",
    modelPage: "https://x.ai/api",
    releasedAt: "2025-11-01",
    icon: "xai",
    isPro: false, // Available for all users
    // Web search strategy:
    // - enableSearch=true: Use Linkup tool for prospect research (no native Exa to avoid conflicts)
    // - enableSearch=false: Use :online suffix for native Exa web grounding (general queries)
    apiSdk: (apiKey?: string, opts?: { enableSearch?: boolean }) => {
      const openrouter = createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
      })
      // When search is NOT enabled, use :online suffix for native Exa integration
      // When search IS enabled, use regular model + Linkup tool (no native Exa to prevent conflicts)
      const modelId = opts?.enableSearch ? "x-ai/grok-4.1-fast" : "x-ai/grok-4.1-fast:online"
      return openrouter.chat(modelId)
    },
  },
]
