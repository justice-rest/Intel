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
  // Gemini 2.0 Flash - Used internally for two-stage architecture (tool execution)
  // Fast, cheap model with reliable tool support for gathering context before Perplexity synthesis
  // Note: Gemini 3 Flash requires thought signatures which don't work well with tool calling
  {
    id: "openrouter:google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    provider: "OpenRouter",
    providerId: "openrouter",
    modelFamily: "Gemini",
    baseProviderId: "google",
    description:
      "Fast, efficient model with reliable function calling. Used for tool execution in two-stage architecture.",
    tags: ["fast", "tools", "multimodal"],
    contextWindow: 1048576,
    inputCost: 0.1,
    outputCost: 0.4,
    priceUnit: "per 1M tokens",
    vision: true,
    tools: true,
    audio: true,
    reasoning: false,
    webSearch: false,
    openSource: false,
    speed: "Fast",
    intelligence: "Medium",
    website: "https://openrouter.ai",
    apiDocs: "https://openrouter.ai/docs",
    modelPage: "https://openrouter.ai/google/gemini-2.0-flash-001",
    releasedAt: "2024-12-11",
    icon: "google",
    isPro: false,
    hidden: true, // Internal use only - for two-stage architecture
    apiSdk: (apiKey?: string) =>
      createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
      }).chat("google/gemini-2.0-flash-001"),
  },
]
