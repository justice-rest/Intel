import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { ModelConfig } from "../types"

/**
 * OpenRouter Model Definitions
 *
 * After the Gemini migration, OpenRouter is used only for:
 * - GPT-5 Nano: Internal use only for tool execution
 *
 * Primary research models (Gemini 3 Flash/Pro) are now in /lib/models/data/google.ts
 */
export const openrouterModels: ModelConfig[] = [
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
