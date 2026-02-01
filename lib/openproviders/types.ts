/**
 * Provider and Model Type Definitions
 *
 * After the Gemini migration (2026-02):
 * - Google: Primary provider for Gemini 3 Flash/Pro research models
 * - OpenRouter: Secondary provider for GPT-5 Nano (internal tool execution)
 */

export type GoogleModel = "google:gemini-3-flash-preview" | "google:gemini-3-pro-preview"

export type OpenRouterModel = "openrouter:openai/gpt-5-nano"

export type Provider = "google" | "openrouter"

export type SupportedModel = GoogleModel | OpenRouterModel
