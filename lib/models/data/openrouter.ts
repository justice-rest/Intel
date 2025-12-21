import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { ModelConfig } from "../types"

export const openrouterModels: ModelConfig[] = [
  {
    id: "openrouter:perplexity/sonar-reasoning",
    name: "Perplexity Sonar Reasoning",
    provider: "OpenRouter",
    providerId: "openrouter",
    modelFamily: "Sonar",
    baseProviderId: "perplexity",
    description:
      "An enhanced version of Sonar optimized for deeper reasoning and more complex tasks, while retaining fast response times.",
    tags: ["reasoning", "fast", "QA", "affordable"],
    contextWindow: 127072,
    inputCost: 1,
    outputCost: 5,
    priceUnit: "per 1M tokens",
    vision: false,
    tools: false,
    audio: false,
    reasoning: true,
    webSearch: true,
    openSource: false,
    speed: "Medium",
    intelligence: "High",
    website: "https://openrouter.ai",
    apiDocs: "https://openrouter.ai/docs",
    modelPage: "https://openrouter.ai/perplexity/sonar-reasoning",
    releasedAt: "2025-01-29",
    icon: "perplexity",
    isPro: false,
    apiSdk: (apiKey?: string, opts?: { enableSearch?: boolean }) =>
      createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
        ...(opts?.enableSearch && {
          extraBody: {
            plugins: [{ id: "web", max_results: 3 }],
          },
        }),
      }).chat("perplexity/sonar-reasoning"),
  },
]
