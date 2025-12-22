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
  // GPT-5-Nano - Used internally for two-stage architecture (tool execution)
  // Ultra-fast, ultra-cheap model optimized for low latency tool calling
  {
    id: "openrouter:openai/gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "OpenRouter",
    providerId: "openrouter",
    modelFamily: "GPT-5",
    baseProviderId: "openai",
    description:
      "Smallest, fastest GPT-5 variant. Ultra-low latency, optimized for tool execution and rapid interactions.",
    tags: ["ultra-fast", "tools", "low-latency"],
    contextWindow: 400000,
    inputCost: 0.05,
    outputCost: 0.4,
    priceUnit: "per 1M tokens",
    vision: true,
    tools: true,
    audio: false,
    reasoning: true,
    webSearch: false,
    openSource: false,
    speed: "Fast",
    intelligence: "Medium",
    website: "https://openrouter.ai",
    apiDocs: "https://openrouter.ai/docs",
    modelPage: "https://openrouter.ai/openai/gpt-5-nano",
    releasedAt: "2025-04-01",
    icon: "openai",
    isPro: false,
    hidden: true, // Internal use only - for two-stage architecture
    apiSdk: (apiKey?: string) =>
      createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
      }).chat("openai/gpt-5-nano"),
  },
]
