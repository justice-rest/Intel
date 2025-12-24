import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { ModelConfig } from "../types"

export const openrouterModels: ModelConfig[] = [
  // Grok 4.1 Fast - Fast reasoning model for Research mode
  // xAI's best agentic tool calling model with Exa web search
  {
    id: "openrouter:x-ai/grok-4.1-fast",
    name: "Grok 4.1 Fast",
    provider: "OpenRouter",
    providerId: "openrouter",
    modelFamily: "Grok",
    baseProviderId: "x-ai",
    description:
      "xAI's best agentic tool calling model for real-world use cases like customer support and deep research.",
    tags: ["reasoning", "fast", "agentic", "research", "tools"],
    contextWindow: 2000000, // 2M tokens
    inputCost: 0.2,
    outputCost: 0.5,
    priceUnit: "per 1M tokens",
    vision: true,
    tools: true, // Native tool calling support
    audio: false,
    reasoning: true, // Configurable reasoning levels
    webSearch: true,
    openSource: false,
    speed: "Fast",
    intelligence: "High",
    website: "https://openrouter.ai",
    apiDocs: "https://openrouter.ai/docs",
    modelPage: "https://openrouter.ai/x-ai/grok-4.1-fast",
    releasedAt: "2025-11-19",
    icon: "xai",
    isPro: false,
    apiSdk: (apiKey?: string, opts?: { enableSearch?: boolean; enableReasoning?: boolean }) =>
      createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
        extraBody: {
          // Enable Exa web search when requested
          ...(opts?.enableSearch && {
            plugins: [{ id: "web", engine: "exa", max_results: 12 }],
          }),
          // High reasoning effort for research mode
          reasoning: { effort: "high" },
        },
      }).chat("x-ai/grok-4.1-fast"),
  },
  // Grok 4.1 Fast (Thinking) - High-effort reasoning for Deep Research mode
  // Extended thinking for comprehensive multi-step analysis
  {
    id: "openrouter:x-ai/grok-4.1-fast-thinking",
    name: "Grok 4.1 Fast (Thinking)",
    provider: "OpenRouter",
    providerId: "openrouter",
    modelFamily: "Grok",
    baseProviderId: "x-ai",
    description:
      "Grok 4.1 Fast with extended thinking for comprehensive multi-step analysis and full wealth screening.",
    tags: ["reasoning", "deep", "advanced", "research", "tools"],
    contextWindow: 2000000, // 2M tokens
    inputCost: 0.2,
    outputCost: 0.5, // + reasoning tokens
    priceUnit: "per 1M tokens",
    vision: true,
    tools: true, // Native tool calling support
    audio: false,
    reasoning: true, // Configurable reasoning levels
    webSearch: true,
    openSource: false,
    speed: "Medium",
    intelligence: "High",
    website: "https://openrouter.ai",
    apiDocs: "https://openrouter.ai/docs",
    modelPage: "https://openrouter.ai/x-ai/grok-4.1-fast",
    releasedAt: "2025-11-19",
    icon: "xai",
    isPro: false,
    apiSdk: (apiKey?: string, opts?: { enableSearch?: boolean; enableReasoning?: boolean }) =>
      createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
        extraBody: {
          // Enable Exa web search when requested
          ...(opts?.enableSearch && {
            plugins: [{ id: "web", engine: "exa", max_results: 15 }],
          }),
          // Enable high-effort reasoning for deep research
          ...(opts?.enableReasoning !== false && {
            reasoning: { effort: "high" },
          }),
        },
      }).chat("x-ai/grok-4.1-fast"),
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
