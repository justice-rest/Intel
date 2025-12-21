import { FREE_MODELS_IDS } from "../config"
import { openrouterModels } from "./data/openrouter"
import { ModelConfig } from "./types"

// Static models (always available)
const STATIC_MODELS: ModelConfig[] = [...openrouterModels]

/**
 * Model ID migrations for backwards compatibility
 * Maps old/deprecated model IDs to their current versions
 */
const MODEL_ID_MIGRATIONS: Record<string, string> = {
  // Grok → Perplexity Sonar Reasoning Pro (model overhaul)
  "openrouter:x-ai/grok-4-fast": "openrouter:perplexity/sonar-reasoning-pro",
  "openrouter:x-ai/grok-4.1-fast": "openrouter:perplexity/sonar-reasoning-pro",
  // Old deprecated model → new model
  "openrouter:perplexity/sonar-reasoning": "openrouter:perplexity/sonar-reasoning-pro",
}

/**
 * Normalize model ID to handle deprecated/old model IDs
 * Automatically converts old model IDs to their current versions
 *
 * @param modelId - The model ID to normalize (may be old or current)
 * @returns The current/canonical model ID
 */
export function normalizeModelId(modelId: string): string {
  return MODEL_ID_MIGRATIONS[modelId] || modelId
}

// Helper to get model name from ID immediately (without async fetch)
export function getModelNameById(modelId: string): string | null {
  const model = STATIC_MODELS.find((m) => m.id === modelId)
  return model?.name || null
}

// Dynamic models cache
let dynamicModelsCache: ModelConfig[] | null = null
let lastFetchTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Function to get all models
export async function getAllModels(): Promise<ModelConfig[]> {
  const now = Date.now()

  // Use cache if it's still valid
  if (dynamicModelsCache && now - lastFetchTime < CACHE_DURATION) {
    return dynamicModelsCache
  }

  try {
    dynamicModelsCache = STATIC_MODELS
    lastFetchTime = now
    return dynamicModelsCache
  } catch (error) {
    console.warn("Failed to load models, using static models:", error)
    return STATIC_MODELS
  }
}

export async function getModelsWithAccessFlags(): Promise<ModelConfig[]> {
  const models = await getAllModels()

  const freeModels = models
    .filter((model) => FREE_MODELS_IDS.includes(model.id))
    .map((model) => ({
      ...model,
      accessible: true,
    }))

  const proModels = models
    .filter((model) => !freeModels.map((m) => m.id).includes(model.id))
    .map((model) => ({
      ...model,
      accessible: false,
    }))

  return [...freeModels, ...proModels]
}

export async function getModelsForProvider(
  provider: string
): Promise<ModelConfig[]> {
  const models = STATIC_MODELS

  const providerModels = models
    .filter((model) => model.providerId === provider)
    .map((model) => ({
      ...model,
      accessible: true,
    }))

  return providerModels
}

// Function to get models based on user's available providers
export async function getModelsForUserProviders(
  providers: string[]
): Promise<ModelConfig[]> {
  const providerModels = await Promise.all(
    providers.map((provider) => getModelsForProvider(provider))
  )

  const flatProviderModels = providerModels.flat()

  return flatProviderModels
}

// Synchronous function to get model info for simple lookups
// This uses cached data if available, otherwise falls back to static models
export function getModelInfo(modelId: string): ModelConfig | undefined {
  // First check the cache if it exists
  if (dynamicModelsCache) {
    return dynamicModelsCache.find((model) => model.id === modelId)
  }

  // Fall back to static models for immediate lookup
  return STATIC_MODELS.find((model) => model.id === modelId)
}

// For backward compatibility - static models only
export const MODELS: ModelConfig[] = STATIC_MODELS

// Function to refresh the models cache
export function refreshModelsCache(): void {
  dynamicModelsCache = null
  lastFetchTime = 0
}
