export type LayoutType = "sidebar" | "fullscreen"

export type UserPreferences = {
  layout: LayoutType
  promptSuggestions: boolean
  showToolInvocations: boolean
  showConversationPreviews: boolean
  multiModelEnabled: boolean
  hiddenModels: string[]
  betaFeaturesEnabled: boolean
  avatarStyleIndex: number
  avatarColorIndex: number
}

export const defaultPreferences: UserPreferences = {
  layout: "sidebar",
  promptSuggestions: true,
  showToolInvocations: true,
  showConversationPreviews: true,
  multiModelEnabled: false,
  hiddenModels: [],
  betaFeaturesEnabled: false,
  avatarStyleIndex: 0,
  avatarColorIndex: 0,
}

/**
 * Validates that a layout value is valid
 * Returns the valid layout or "sidebar" as default
 */
export function validateLayout(layout: unknown): LayoutType {
  if (layout === "sidebar" || layout === "fullscreen") {
    return layout
  }
  return "sidebar"
}

/**
 * Validates and normalizes a UserPreferences object
 * Ensures all fields have valid values, filling in defaults for missing/invalid fields
 */
export function validatePreferences(prefs: unknown): UserPreferences {
  if (!prefs || typeof prefs !== "object") {
    return defaultPreferences
  }

  const p = prefs as Record<string, unknown>

  return {
    layout: validateLayout(p.layout),
    promptSuggestions: typeof p.promptSuggestions === "boolean" ? p.promptSuggestions : defaultPreferences.promptSuggestions,
    showToolInvocations: typeof p.showToolInvocations === "boolean" ? p.showToolInvocations : defaultPreferences.showToolInvocations,
    showConversationPreviews: typeof p.showConversationPreviews === "boolean" ? p.showConversationPreviews : defaultPreferences.showConversationPreviews,
    multiModelEnabled: typeof p.multiModelEnabled === "boolean" ? p.multiModelEnabled : defaultPreferences.multiModelEnabled,
    hiddenModels: Array.isArray(p.hiddenModels) ? p.hiddenModels.filter((id): id is string => typeof id === "string") : defaultPreferences.hiddenModels,
    betaFeaturesEnabled: typeof p.betaFeaturesEnabled === "boolean" ? p.betaFeaturesEnabled : defaultPreferences.betaFeaturesEnabled,
    avatarStyleIndex: typeof p.avatarStyleIndex === "number" && Number.isInteger(p.avatarStyleIndex) && p.avatarStyleIndex >= 0 ? p.avatarStyleIndex : defaultPreferences.avatarStyleIndex,
    avatarColorIndex: typeof p.avatarColorIndex === "number" && Number.isInteger(p.avatarColorIndex) && p.avatarColorIndex >= 0 ? p.avatarColorIndex : defaultPreferences.avatarColorIndex,
  }
}

// Helper functions to convert between API format (snake_case) and frontend format (camelCase)
export function convertFromApiFormat(apiData: Record<string, unknown>): UserPreferences {
  return {
    layout: validateLayout(apiData.layout),
    promptSuggestions: typeof apiData.prompt_suggestions === "boolean" ? apiData.prompt_suggestions : true,
    showToolInvocations: typeof apiData.show_tool_invocations === "boolean" ? apiData.show_tool_invocations : true,
    showConversationPreviews: typeof apiData.show_conversation_previews === "boolean" ? apiData.show_conversation_previews : true,
    multiModelEnabled: typeof apiData.multi_model_enabled === "boolean" ? apiData.multi_model_enabled : false,
    hiddenModels: Array.isArray(apiData.hidden_models) ? (apiData.hidden_models as string[]) : [],
    betaFeaturesEnabled: typeof apiData.beta_features_enabled === "boolean" ? apiData.beta_features_enabled : false,
    avatarStyleIndex: typeof apiData.avatar_style_index === "number" && Number.isInteger(apiData.avatar_style_index) && apiData.avatar_style_index >= 0 ? apiData.avatar_style_index : 0,
    avatarColorIndex: typeof apiData.avatar_color_index === "number" && Number.isInteger(apiData.avatar_color_index) && apiData.avatar_color_index >= 0 ? apiData.avatar_color_index : 0,
  }
}

export function convertToApiFormat(preferences: Partial<UserPreferences>): Record<string, unknown> {
  const apiData: Record<string, unknown> = {}
  if (preferences.layout !== undefined) apiData.layout = preferences.layout
  if (preferences.promptSuggestions !== undefined)
    apiData.prompt_suggestions = preferences.promptSuggestions
  if (preferences.showToolInvocations !== undefined)
    apiData.show_tool_invocations = preferences.showToolInvocations
  if (preferences.showConversationPreviews !== undefined)
    apiData.show_conversation_previews = preferences.showConversationPreviews
  if (preferences.multiModelEnabled !== undefined)
    apiData.multi_model_enabled = preferences.multiModelEnabled
  if (preferences.hiddenModels !== undefined)
    apiData.hidden_models = preferences.hiddenModels
  if (preferences.betaFeaturesEnabled !== undefined)
    apiData.beta_features_enabled = preferences.betaFeaturesEnabled
  if (preferences.avatarStyleIndex !== undefined)
    apiData.avatar_style_index = preferences.avatarStyleIndex
  if (preferences.avatarColorIndex !== undefined)
    apiData.avatar_color_index = preferences.avatarColorIndex
  return apiData
}
