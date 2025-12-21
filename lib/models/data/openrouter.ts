import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { ModelConfig } from "../types"

export const openrouterModels: ModelConfig[] = [
  {
    id: "openrouter:perplexity/sonar-reasoning-pro",
    name: "Perplexity Sonar Reasoning Pro",
    provider: "OpenRouter",
    providerId: "openrouter",
    modelFamily: "Sonar",
    baseProviderId: "perplexity",
    description:
      "Premier reasoning model powered by DeepSeek R1 with Chain of Thought. Supports in-depth, multi-step queries with built-in web search.",
    tags: ["reasoning", "pro", "advanced", "QA", "research"],
    contextWindow: 128000,
    inputCost: 2,
    outputCost: 8,
    priceUnit: "per 1M tokens",
    vision: true, // Now supports images
    tools: false,
    audio: false,
    reasoning: true,
    webSearch: true,
    openSource: false,
    speed: "Medium",
    intelligence: "High",
    website: "https://openrouter.ai",
    apiDocs: "https://openrouter.ai/docs",
    modelPage: "https://openrouter.ai/perplexity/sonar-reasoning-pro",
    releasedAt: "2025-03-07",
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
      }).chat("perplexity/sonar-reasoning-pro"),
  },
  {
    id: "openrouter:perplexity/sonar-deep-research",
    name: "Perplexity Sonar Deep Research",
    provider: "OpenRouter",
    providerId: "openrouter",
    modelFamily: "Sonar",
    baseProviderId: "perplexity",
    description:
      "Advanced multi-step research model for comprehensive, in-depth analysis. Performs thorough web research with multiple search iterations.",
    tags: ["reasoning", "pro", "advanced", "research", "deep"],
    contextWindow: 128000,
    inputCost: 2,
    outputCost: 8,
    priceUnit: "per 1M tokens",
    vision: false,
    tools: false,
    audio: false,
    reasoning: true,
    webSearch: true,
    openSource: false,
    speed: "Slow",
    intelligence: "High",
    website: "https://openrouter.ai",
    apiDocs: "https://openrouter.ai/docs",
    modelPage: "https://openrouter.ai/perplexity/sonar-deep-research",
    releasedAt: "2025-03-07",
    icon: "perplexity",
    isPro: false,
    apiSdk: (apiKey?: string, opts?: { enableSearch?: boolean }) =>
      createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
        ...(opts?.enableSearch && {
          extraBody: {
            plugins: [{ id: "web", max_results: 5 }],
          },
        }),
      }).chat("perplexity/sonar-deep-research"),
  },
]
