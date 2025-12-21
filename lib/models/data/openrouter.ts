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
      "DeepSeek R1 with Chain of Thought reasoning and built-in web search. Provides citations with every response.",
    tags: ["reasoning", "web-search", "citations", "flagship"],
    contextWindow: 128000,
    inputCost: 1.0,
    outputCost: 5.0,
    priceUnit: "per 1M tokens",
    vision: false,
    tools: false, // Perplexity Sonar models don't support tool calling
    audio: false,
    reasoning: true,
    webSearch: true,
    openSource: false,
    speed: "Medium",
    intelligence: "High",
    website: "https://openrouter.ai",
    apiDocs: "https://openrouter.ai/perplexity/sonar-reasoning",
    modelPage: "https://www.perplexity.ai/",
    releasedAt: "2025-02-01",
    icon: "perplexity",
    isPro: false, // Available for all users
    // Web search is BUILT-IN to Perplexity models - no plugins needed
    // Perplexity uses web_search_options, NOT plugins (plugins causes Bad Request)
    apiSdk: (apiKey?: string) =>
      createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
      }).chat("perplexity/sonar-reasoning"),
  },
]
