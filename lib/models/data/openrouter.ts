import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { ModelConfig } from "../types"

export const openrouterModels: ModelConfig[] = [
  // Gemini 3 Flash - Fast reasoning model for Research mode
  // Replaces Perplexity Sonar Reasoning Pro with native tool calling support
  {
    id: "openrouter:google/gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "OpenRouter",
    providerId: "openrouter",
    modelFamily: "Gemini",
    baseProviderId: "google",
    description:
      "High-speed thinking model designed for agentic workflows, multi-turn chat, and coding assistance. Near Pro-level reasoning with lower latency.",
    tags: ["reasoning", "fast", "agentic", "research", "tools"],
    contextWindow: 1048576, // 1M tokens
    inputCost: 0.5,
    outputCost: 3,
    priceUnit: "per 1M tokens",
    vision: true, // Supports images, video, PDF
    tools: true, // Native tool calling support
    audio: true,
    reasoning: true, // Configurable reasoning levels
    webSearch: true,
    openSource: false,
    speed: "Fast",
    intelligence: "High",
    website: "https://openrouter.ai",
    apiDocs: "https://openrouter.ai/docs",
    modelPage: "https://openrouter.ai/google/gemini-3-flash-preview",
    releasedAt: "2025-12-17",
    icon: "google",
    isPro: false,
    apiSdk: (apiKey?: string, opts?: { enableSearch?: boolean; enableReasoning?: boolean }) =>
      createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
        extraBody: {
          // Enable web search plugin when requested
          ...(opts?.enableSearch && {
            plugins: [{ id: "web", max_results: 5 }],
          }),
          // Enable reasoning with medium effort by default
          ...(opts?.enableReasoning !== false && {
            thinking: {
              type: "enabled",
              budget_tokens: 8000,
            },
          }),
        },
      }).chat("google/gemini-3-flash-preview"),
  },
  // Gemini 3 Pro - Advanced reasoning model for Deep Research mode
  // Replaces Perplexity Sonar Deep Research with native tool calling support
  {
    id: "openrouter:google/gemini-3-pro-preview",
    name: "Gemini 3 Pro",
    provider: "OpenRouter",
    providerId: "openrouter",
    modelFamily: "Gemini",
    baseProviderId: "google",
    description:
      "Advanced multimodal model excelling at agentic workflows, tool-calling, and structured long-form tasks. Strong performance across text, image, video, audio, and code.",
    tags: ["reasoning", "pro", "advanced", "research", "deep", "tools"],
    contextWindow: 1048576, // 1M tokens
    inputCost: 2,
    outputCost: 12,
    priceUnit: "per 1M tokens",
    vision: true, // Supports images, video, PDF
    tools: true, // Native tool calling support
    audio: true,
    reasoning: true, // Configurable reasoning levels
    webSearch: true,
    openSource: false,
    speed: "Medium",
    intelligence: "Very High",
    website: "https://openrouter.ai",
    apiDocs: "https://openrouter.ai/docs",
    modelPage: "https://openrouter.ai/google/gemini-3-pro-preview",
    releasedAt: "2025-11-18",
    icon: "google",
    isPro: false,
    apiSdk: (apiKey?: string, opts?: { enableSearch?: boolean; enableReasoning?: boolean }) =>
      createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
        extraBody: {
          // Enable web search plugin when requested
          ...(opts?.enableSearch && {
            plugins: [{ id: "web", max_results: 8 }],
          }),
          // Enable reasoning with high effort for deep research
          ...(opts?.enableReasoning !== false && {
            thinking: {
              type: "enabled",
              budget_tokens: 16000,
            },
          }),
        },
      }).chat("google/gemini-3-pro-preview"),
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
