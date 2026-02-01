import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { ModelConfig } from "../types"

/**
 * Google Gemini Model Definitions
 *
 * Direct Google Generative AI integration using @ai-sdk/google provider.
 * Gemini 3 models support native tool calling and Google Search grounding.
 *
 * Pricing (per 1M tokens):
 * - Gemini 3 Flash: $0.50 input / $3.00 output
 * - Gemini 3 Pro: $2.00 input / $12.00 output
 *
 * Google Search grounding: $0.014 per query
 */
export const googleModels: ModelConfig[] = [
  // Gemini 3 Flash - Fast reasoning model for Research mode
  // Google's fastest Gemini 3 model with native Google Search grounding
  {
    id: "google:gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "Google",
    providerId: "google",
    modelFamily: "Gemini",
    baseProviderId: "google",
    description:
      "Google's fastest Gemini 3 model with native Google Search grounding. Best for real-time research and agentic tool calling.",
    tags: ["reasoning", "fast", "agentic", "research", "tools"],
    contextWindow: 1000000, // 1M tokens
    inputCost: 0.5,
    outputCost: 3.0,
    priceUnit: "per 1M tokens",
    vision: true,
    tools: true, // Native tool calling support
    audio: false,
    reasoning: true,
    webSearch: true,
    openSource: false,
    speed: "Fast",
    intelligence: "High",
    website: "https://ai.google.dev",
    apiDocs: "https://ai.google.dev/gemini-api/docs",
    modelPage: "https://ai.google.dev/gemini-api/docs/models#gemini-3-flash",
    releasedAt: "2025-12-01",
    icon: "google",
    isPro: false,
    apiSdk: (apiKey?: string, opts?: { enableSearch?: boolean; enableReasoning?: boolean }) => {
      const provider = createGoogleGenerativeAI({
        apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      })
      // AI SDK v6: Native Google Search grounding via google.tools.googleSearch()
      // is now handled in the chat route with providerOptions for thinkingConfig
      return provider("gemini-3-flash-preview")
    },
  },
  // Gemini 3 Pro - High-capacity model for Deep Research mode
  // Extended thinking for comprehensive multi-step analysis
  {
    id: "google:gemini-3-pro-preview",
    name: "Gemini 3 Pro",
    provider: "Google",
    providerId: "google",
    modelFamily: "Gemini",
    baseProviderId: "google",
    description:
      "Google's most capable Gemini 3 model with extended thinking for comprehensive multi-step analysis and full wealth screening.",
    tags: ["reasoning", "deep", "advanced", "research", "tools"],
    contextWindow: 1000000, // 1M tokens
    inputCost: 2.0,
    outputCost: 12.0,
    priceUnit: "per 1M tokens",
    vision: true,
    tools: true, // Native tool calling support
    audio: false,
    reasoning: true,
    webSearch: true,
    openSource: false,
    speed: "Medium",
    intelligence: "High",
    website: "https://ai.google.dev",
    apiDocs: "https://ai.google.dev/gemini-api/docs",
    modelPage: "https://ai.google.dev/gemini-api/docs/models#gemini-3-pro",
    releasedAt: "2025-12-01",
    icon: "google",
    isPro: false,
    apiSdk: (apiKey?: string, opts?: { enableSearch?: boolean; enableReasoning?: boolean }) => {
      const provider = createGoogleGenerativeAI({
        apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      })
      // AI SDK v6: Native Google Search grounding via google.tools.googleSearch()
      // is now handled in the chat route with providerOptions for thinkingConfig
      return provider("gemini-3-pro-preview")
    },
  },
]
