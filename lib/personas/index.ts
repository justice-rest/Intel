/**
 * Personas Module
 *
 * Reusable AI configurations with custom prompts, voice settings, and behavior.
 *
 * @example
 * ```typescript
 * import { createPersona, listPersonas, assignPersonaToChat } from '@/lib/personas'
 *
 * // Create a new persona
 * const persona = await createPersona(supabase, userId, {
 *   name: 'Major Gifts Specialist',
 *   system_prompt: 'You are a major gifts specialist...',
 *   voice_config: { tone: 'formal', formality_level: 4 }
 * })
 *
 * // List user's personas
 * const { personas } = await listPersonas(supabase, userId)
 *
 * // Assign to a chat
 * await assignPersonaToChat(supabase, chatId, userId, persona.id)
 * ```
 */

// Types
export type {
  Persona,
  PersonaWithProfile,
  PersonaTemplate,
  PersonaVoiceConfig,
  PersonaCapabilities,
  SystemPromptMode,
  PersonaStatus,
  PersonaTemplateCategory,
  VoiceTone,
  CreatePersonaRequest,
  UpdatePersonaRequest,
  CloneFromTemplateRequest,
  AssignPersonaToChatRequest,
  ListPersonasResponse,
  ListTemplatesResponse,
  EffectiveChatConfig,
  ComputedSystemPrompt,
} from './types'

// Constants
export {
  SYSTEM_PROMPT_MODES,
  PERSONA_STATUS,
  PERSONA_TEMPLATE_CATEGORIES,
  VOICE_TONES,
  MAX_PERSONAS_PER_USER,
  MAX_SYSTEM_PROMPT_LENGTH,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_CONTEXT_INJECTION_LENGTH,
  PERSONA_ICONS,
  PERSONA_COLORS,
  PERSONA_ERROR_MESSAGES,
  PERSONA_SUCCESS_MESSAGES,
} from './types'

// Service functions
export {
  // CRUD
  listPersonas,
  getPersona,
  createPersona,
  updatePersona,
  deletePersona,
  // Templates
  listPersonaTemplates,
  cloneFromTemplate,
  // Chat assignment
  assignPersonaToChat,
  getEffectiveChatConfig,
  // Default persona
  getDefaultPersona,
  setDefaultPersona,
} from './service'

// Prompt builder
export { buildEffectiveSystemPrompt } from './prompt-builder'
