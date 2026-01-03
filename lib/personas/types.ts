/**
 * Persona System Types
 *
 * Type definitions for the persona system that enables users to create
 * and manage reusable AI configurations with custom prompts and behavior.
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const SYSTEM_PROMPT_MODES = ['full', 'prepend', 'append', 'inject'] as const
export type SystemPromptMode = (typeof SYSTEM_PROMPT_MODES)[number]

export const PERSONA_STATUS = ['active', 'archived'] as const
export type PersonaStatus = (typeof PERSONA_STATUS)[number]

export const PERSONA_TEMPLATE_CATEGORIES = [
  'fundraising',
  'communication',
  'research',
  'strategy',
  'general',
] as const
export type PersonaTemplateCategory = (typeof PERSONA_TEMPLATE_CATEGORIES)[number]

export const VOICE_TONES = [
  'formal',
  'conversational',
  'professional',
  'warm',
  'academic',
] as const
export type VoiceTone = (typeof VOICE_TONES)[number]

// ============================================================================
// VOICE CONFIGURATION
// ============================================================================

/**
 * Voice configuration for persona communication style
 */
export interface PersonaVoiceConfig {
  /** Communication tone */
  tone?: VoiceTone
  /** Formality level (1 = very casual, 5 = very formal) */
  formality_level?: 1 | 2 | 3 | 4 | 5
  /** Whether to use emojis in responses */
  use_emojis?: boolean
  /** Optional closing signature */
  signature?: string
  /** Greeting style preference */
  greeting_style?: string
}

// ============================================================================
// CAPABILITY CONFIGURATION
// ============================================================================

/**
 * Capability configuration for persona tool access
 */
export interface PersonaCapabilities {
  /** Tools that are enabled ('all' for all tools, array for specific) */
  tools_enabled?: string[] | 'all' | 'none'
  /** Tools that are explicitly disabled */
  tools_disabled?: string[]
  /** Whether web search is enabled */
  enable_search?: boolean
  /** Whether memory system is enabled */
  enable_memory?: boolean
  /** Maximum tool call steps */
  max_tool_steps?: number
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

/**
 * Persona - Reusable AI configuration
 */
export interface Persona {
  id: string
  user_id: string

  // Basic Info
  name: string
  description: string | null
  icon: string
  color: string

  // System Prompt Configuration
  system_prompt: string | null
  system_prompt_mode: SystemPromptMode

  // Knowledge Profile Link
  knowledge_profile_id: string | null

  // Voice & Communication Style
  voice_config: PersonaVoiceConfig

  // Capability Configuration
  capabilities: PersonaCapabilities

  // Context injection
  context_injection: string | null

  // Model preferences
  preferred_model: string | null

  // Status
  status: PersonaStatus
  is_default: boolean

  // Soft delete
  deleted_at: string | null

  // Timestamps
  created_at: string
  updated_at: string
}

/**
 * Persona with related data for display
 */
export interface PersonaWithProfile extends Persona {
  knowledge_profile?: {
    id: string
    name: string
    status: string
  } | null
}

/**
 * Persona template - System-provided starting points
 */
export interface PersonaTemplate {
  id: string

  name: string
  description: string
  icon: string
  color: string

  // Template configuration
  system_prompt: string | null
  system_prompt_mode: SystemPromptMode
  voice_config: PersonaVoiceConfig
  capabilities: PersonaCapabilities
  context_injection: string | null

  // Categorization
  category: PersonaTemplateCategory
  display_order: number

  // Status
  is_active: boolean

  created_at: string
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Create persona request
 */
export interface CreatePersonaRequest {
  name: string
  description?: string
  icon?: string
  color?: string
  system_prompt?: string
  system_prompt_mode?: SystemPromptMode
  knowledge_profile_id?: string
  voice_config?: PersonaVoiceConfig
  capabilities?: PersonaCapabilities
  context_injection?: string
  preferred_model?: string
  is_default?: boolean
}

/**
 * Update persona request
 */
export interface UpdatePersonaRequest {
  name?: string
  description?: string
  icon?: string
  color?: string
  system_prompt?: string
  system_prompt_mode?: SystemPromptMode
  knowledge_profile_id?: string | null
  voice_config?: PersonaVoiceConfig
  capabilities?: PersonaCapabilities
  context_injection?: string
  preferred_model?: string
  status?: PersonaStatus
  is_default?: boolean
}

/**
 * Clone from template request
 */
export interface CloneFromTemplateRequest {
  template_id: string
  custom_name?: string
}

/**
 * Assign persona to chat request
 */
export interface AssignPersonaToChatRequest {
  chat_id: string
  persona_id: string | null // null to unassign
}

/**
 * List personas response
 */
export interface ListPersonasResponse {
  personas: PersonaWithProfile[]
  total: number
}

/**
 * List templates response
 */
export interface ListTemplatesResponse {
  templates: PersonaTemplate[]
  categories: PersonaTemplateCategory[]
}

// ============================================================================
// EFFECTIVE CONFIGURATION (Computed at runtime)
// ============================================================================

/**
 * Effective chat configuration combining persona, knowledge, and chat settings
 */
export interface EffectiveChatConfig {
  /** Assigned persona (if any) */
  persona_id: string | null
  persona_name: string | null
  persona_system_prompt: string | null
  persona_prompt_mode: SystemPromptMode | null

  /** Knowledge profile (from chat or persona) */
  knowledge_profile_id: string | null
  knowledge_prompt: string | null

  /** Chat-level overrides */
  custom_system_prompt: string | null

  /** Voice and capabilities from persona */
  voice_config: PersonaVoiceConfig | null
  capabilities: PersonaCapabilities | null
}

/**
 * Computed system prompt with all layers applied
 */
export interface ComputedSystemPrompt {
  /** Final computed system prompt */
  prompt: string
  /** Token estimate */
  estimated_tokens: number
  /** Components included */
  components: {
    base: boolean
    persona: boolean
    knowledge: boolean
    memory: boolean
    chat_override: boolean
  }
}

// ============================================================================
// LIMITS & VALIDATION
// ============================================================================

/** Maximum personas per user */
export const MAX_PERSONAS_PER_USER = 20

/** Maximum system prompt length */
export const MAX_SYSTEM_PROMPT_LENGTH = 10000

/** Maximum name length */
export const MAX_NAME_LENGTH = 100

/** Maximum description length */
export const MAX_DESCRIPTION_LENGTH = 500

/** Maximum context injection length */
export const MAX_CONTEXT_INJECTION_LENGTH = 5000

/** Default icons available */
export const PERSONA_ICONS = [
  'user',
  'crown',
  'heart',
  'briefcase',
  'file-text',
  'search',
  'mail',
  'calculator',
  'bot',
  'sparkles',
  'target',
  'trophy',
  'star',
  'zap',
  'shield',
] as const

/** Default colors available */
export const PERSONA_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#84cc16', // Lime
] as const

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const PERSONA_ERROR_MESSAGES = {
  PERSONA_LIMIT_REACHED: `You've reached the maximum of ${MAX_PERSONAS_PER_USER} personas`,
  PERSONA_NOT_FOUND: 'Persona not found',
  TEMPLATE_NOT_FOUND: 'Template not found',
  NAME_REQUIRED: 'Persona name is required',
  NAME_TOO_LONG: `Name must be ${MAX_NAME_LENGTH} characters or less`,
  DESCRIPTION_TOO_LONG: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`,
  SYSTEM_PROMPT_TOO_LONG: `System prompt must be ${MAX_SYSTEM_PROMPT_LENGTH} characters or less`,
  DUPLICATE_NAME: 'A persona with this name already exists',
  INVALID_PROMPT_MODE: 'Invalid system prompt mode',
  UNAUTHORIZED: 'You do not have permission to access this persona',
} as const

export const PERSONA_SUCCESS_MESSAGES = {
  PERSONA_CREATED: 'Persona created successfully',
  PERSONA_UPDATED: 'Persona updated successfully',
  PERSONA_DELETED: 'Persona deleted successfully',
  PERSONA_CLONED: 'Persona cloned from template successfully',
  PERSONA_ASSIGNED: 'Persona assigned to chat',
  PERSONA_UNASSIGNED: 'Persona removed from chat',
} as const
