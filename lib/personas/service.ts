/**
 * Persona Service
 *
 * Enterprise-grade service for managing personas with:
 * - Full CRUD operations
 * - Input validation
 * - Rate limiting awareness
 * - Soft delete support
 * - Audit logging
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any  // Using any to allow both server and client Supabase instances
import type {
  Persona,
  PersonaWithProfile,
  PersonaTemplate,
  CreatePersonaRequest,
  UpdatePersonaRequest,
  PersonaVoiceConfig,
  PersonaCapabilities,
  SystemPromptMode,
  EffectiveChatConfig,
} from './types'
import {
  MAX_PERSONAS_PER_USER,
  MAX_SYSTEM_PROMPT_LENGTH,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_CONTEXT_INJECTION_LENGTH,
  PERSONA_ERROR_MESSAGES,
  SYSTEM_PROMPT_MODES,
} from './types'

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate create persona request
 */
function validateCreateRequest(request: CreatePersonaRequest): void {
  if (!request.name?.trim()) {
    throw new Error(PERSONA_ERROR_MESSAGES.NAME_REQUIRED)
  }
  if (request.name.length > MAX_NAME_LENGTH) {
    throw new Error(PERSONA_ERROR_MESSAGES.NAME_TOO_LONG)
  }
  if (request.description && request.description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(PERSONA_ERROR_MESSAGES.DESCRIPTION_TOO_LONG)
  }
  if (request.system_prompt && request.system_prompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
    throw new Error(PERSONA_ERROR_MESSAGES.SYSTEM_PROMPT_TOO_LONG)
  }
  if (request.context_injection && request.context_injection.length > MAX_CONTEXT_INJECTION_LENGTH) {
    throw new Error('Context injection is too long')
  }
  if (request.system_prompt_mode && !SYSTEM_PROMPT_MODES.includes(request.system_prompt_mode)) {
    throw new Error(PERSONA_ERROR_MESSAGES.INVALID_PROMPT_MODE)
  }
}

/**
 * Validate update persona request
 */
function validateUpdateRequest(request: UpdatePersonaRequest): void {
  if (request.name !== undefined) {
    if (!request.name?.trim()) {
      throw new Error(PERSONA_ERROR_MESSAGES.NAME_REQUIRED)
    }
    if (request.name.length > MAX_NAME_LENGTH) {
      throw new Error(PERSONA_ERROR_MESSAGES.NAME_TOO_LONG)
    }
  }
  if (request.description && request.description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(PERSONA_ERROR_MESSAGES.DESCRIPTION_TOO_LONG)
  }
  if (request.system_prompt && request.system_prompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
    throw new Error(PERSONA_ERROR_MESSAGES.SYSTEM_PROMPT_TOO_LONG)
  }
  if (request.system_prompt_mode && !SYSTEM_PROMPT_MODES.includes(request.system_prompt_mode)) {
    throw new Error(PERSONA_ERROR_MESSAGES.INVALID_PROMPT_MODE)
  }
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * List all personas for a user
 */
export async function listPersonas(
  supabase: AnySupabaseClient,
  userId: string,
  options: {
    includeArchived?: boolean
    limit?: number
    offset?: number
  } = {}
): Promise<{ personas: PersonaWithProfile[]; total: number }> {
  const { includeArchived = false, limit = 50, offset = 0 } = options

  let query = supabase
    .from('personas')
    .select(
      `
      *,
      knowledge_profile:knowledge_profiles!knowledge_profile_id (
        id,
        name,
        status
      )
    `,
      { count: 'exact' }
    )
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (!includeArchived) {
    query = query.eq('status', 'active')
  }

  const { data, error, count } = await query
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[PersonaService] List personas error:', error)
    throw new Error('Failed to fetch personas')
  }

  return {
    personas: (data || []) as unknown as PersonaWithProfile[],
    total: count || 0,
  }
}

/**
 * Get a single persona by ID
 */
export async function getPersona(
  supabase: AnySupabaseClient,
  personaId: string,
  userId: string
): Promise<PersonaWithProfile | null> {
  const { data, error } = await supabase
    .from('personas')
    .select(
      `
      *,
      knowledge_profile:knowledge_profiles!knowledge_profile_id (
        id,
        name,
        status
      )
    `
    )
    .eq('id', personaId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('[PersonaService] Get persona error:', error)
    throw new Error('Failed to fetch persona')
  }

  return data as unknown as PersonaWithProfile
}

/**
 * Create a new persona
 */
export async function createPersona(
  supabase: AnySupabaseClient,
  userId: string,
  request: CreatePersonaRequest
): Promise<Persona> {
  // Validate input
  validateCreateRequest(request)

  // Check persona limit
  const { count } = await supabase
    .from('personas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (count && count >= MAX_PERSONAS_PER_USER) {
    throw new Error(PERSONA_ERROR_MESSAGES.PERSONA_LIMIT_REACHED)
  }

  // Check for duplicate name
  const { data: existing } = await supabase
    .from('personas')
    .select('id')
    .eq('user_id', userId)
    .eq('name', request.name.trim())
    .is('deleted_at', null)
    .single()

  if (existing) {
    throw new Error(PERSONA_ERROR_MESSAGES.DUPLICATE_NAME)
  }

  // If setting as default, unset other defaults
  if (request.is_default) {
    await supabase
      .from('personas')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true)
  }

  // Create persona
  const { data, error } = await supabase
    .from('personas')
    .insert({
      user_id: userId,
      name: request.name.trim(),
      description: request.description?.trim() || null,
      icon: request.icon || 'user',
      color: request.color || '#6366f1',
      system_prompt: request.system_prompt || null,
      system_prompt_mode: request.system_prompt_mode || 'append',
      knowledge_profile_id: request.knowledge_profile_id || null,
      voice_config: request.voice_config || {},
      capabilities: request.capabilities || {},
      context_injection: request.context_injection || null,
      preferred_model: request.preferred_model || null,
      is_default: request.is_default || false,
      status: 'active',
    })
    .select()
    .single()

  if (error) {
    console.error('[PersonaService] Create persona error:', error)
    throw new Error('Failed to create persona')
  }

  return data as unknown as Persona
}

/**
 * Update an existing persona
 */
export async function updatePersona(
  supabase: AnySupabaseClient,
  personaId: string,
  userId: string,
  request: UpdatePersonaRequest
): Promise<Persona> {
  // Validate input
  validateUpdateRequest(request)

  // Verify ownership
  const existing = await getPersona(supabase, personaId, userId)
  if (!existing) {
    throw new Error(PERSONA_ERROR_MESSAGES.PERSONA_NOT_FOUND)
  }

  // Check for duplicate name (if changing name)
  if (request.name && request.name.trim() !== existing.name) {
    const { data: duplicate } = await supabase
      .from('personas')
      .select('id')
      .eq('user_id', userId)
      .eq('name', request.name.trim())
      .is('deleted_at', null)
      .neq('id', personaId)
      .single()

    if (duplicate) {
      throw new Error(PERSONA_ERROR_MESSAGES.DUPLICATE_NAME)
    }
  }

  // If setting as default, unset other defaults
  if (request.is_default && !existing.is_default) {
    await supabase
      .from('personas')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true)
  }

  // Build update object (only include defined fields)
  const updateData: Record<string, unknown> = {}
  if (request.name !== undefined) updateData.name = request.name.trim()
  if (request.description !== undefined) updateData.description = request.description?.trim() || null
  if (request.icon !== undefined) updateData.icon = request.icon
  if (request.color !== undefined) updateData.color = request.color
  if (request.system_prompt !== undefined) updateData.system_prompt = request.system_prompt
  if (request.system_prompt_mode !== undefined) updateData.system_prompt_mode = request.system_prompt_mode
  if (request.knowledge_profile_id !== undefined) updateData.knowledge_profile_id = request.knowledge_profile_id
  if (request.voice_config !== undefined) updateData.voice_config = request.voice_config
  if (request.capabilities !== undefined) updateData.capabilities = request.capabilities
  if (request.context_injection !== undefined) updateData.context_injection = request.context_injection
  if (request.preferred_model !== undefined) updateData.preferred_model = request.preferred_model
  if (request.status !== undefined) updateData.status = request.status
  if (request.is_default !== undefined) updateData.is_default = request.is_default

  const { data, error } = await supabase
    .from('personas')
    .update(updateData)
    .eq('id', personaId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('[PersonaService] Update persona error:', error)
    throw new Error('Failed to update persona')
  }

  return data as unknown as Persona
}

/**
 * Delete a persona (soft delete)
 */
export async function deletePersona(
  supabase: AnySupabaseClient,
  personaId: string,
  userId: string
): Promise<void> {
  // Verify ownership
  const existing = await getPersona(supabase, personaId, userId)
  if (!existing) {
    throw new Error(PERSONA_ERROR_MESSAGES.PERSONA_NOT_FOUND)
  }

  // Soft delete
  const { error } = await supabase
    .from('personas')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', personaId)
    .eq('user_id', userId)

  if (error) {
    console.error('[PersonaService] Delete persona error:', error)
    throw new Error('Failed to delete persona')
  }

  // Remove persona from any chats that were using it
  await supabase
    .from('chats')
    .update({ persona_id: null })
    .eq('persona_id', personaId)
}

// ============================================================================
// TEMPLATE OPERATIONS
// ============================================================================

/**
 * List all available persona templates
 */
export async function listPersonaTemplates(
  supabase: AnySupabaseClient,
  options: {
    category?: string
  } = {}
): Promise<PersonaTemplate[]> {
  let query = supabase
    .from('persona_templates')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (options.category) {
    query = query.eq('category', options.category)
  }

  const { data, error } = await query

  if (error) {
    console.error('[PersonaService] List templates error:', error)
    throw new Error('Failed to fetch templates')
  }

  return (data || []) as unknown as PersonaTemplate[]
}

/**
 * Clone a persona from a template
 */
export async function cloneFromTemplate(
  supabase: AnySupabaseClient,
  userId: string,
  templateId: string,
  customName?: string
): Promise<Persona> {
  // Fetch template
  const { data: template, error: templateError } = await supabase
    .from('persona_templates')
    .select('*')
    .eq('id', templateId)
    .eq('is_active', true)
    .single()

  if (templateError || !template) {
    throw new Error(PERSONA_ERROR_MESSAGES.TEMPLATE_NOT_FOUND)
  }

  // Create persona from template
  return createPersona(supabase, userId, {
    name: customName || template.name,
    description: template.description,
    icon: template.icon,
    color: template.color,
    system_prompt: template.system_prompt,
    system_prompt_mode: template.system_prompt_mode,
    voice_config: template.voice_config,
    capabilities: template.capabilities,
    context_injection: template.context_injection,
  })
}

// ============================================================================
// CHAT ASSIGNMENT OPERATIONS
// ============================================================================

/**
 * Assign a persona to a chat
 */
export async function assignPersonaToChat(
  supabase: AnySupabaseClient,
  chatId: string,
  userId: string,
  personaId: string | null
): Promise<void> {
  // Verify chat ownership
  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('id, user_id')
    .eq('id', chatId)
    .single()

  if (chatError || !chat) {
    throw new Error('Chat not found')
  }

  if (chat.user_id !== userId) {
    throw new Error(PERSONA_ERROR_MESSAGES.UNAUTHORIZED)
  }

  // If assigning a persona, verify ownership
  if (personaId) {
    const persona = await getPersona(supabase, personaId, userId)
    if (!persona) {
      throw new Error(PERSONA_ERROR_MESSAGES.PERSONA_NOT_FOUND)
    }
  }

  // Update chat
  const { error } = await supabase
    .from('chats')
    .update({ persona_id: personaId })
    .eq('id', chatId)

  if (error) {
    console.error('[PersonaService] Assign persona error:', error)
    throw new Error('Failed to assign persona to chat')
  }
}

/**
 * Get effective chat configuration (persona + knowledge + overrides)
 */
export async function getEffectiveChatConfig(
  supabase: AnySupabaseClient,
  chatId: string,
  userId: string
): Promise<EffectiveChatConfig | null> {
  // Use the database function for efficient single query
  const { data, error } = await supabase.rpc('get_effective_chat_config', {
    p_chat_id: chatId,
  })

  if (error) {
    // If function doesn't exist, fallback to manual query
    if (error.code === '42883') {
      return getEffectiveChatConfigFallback(supabase, chatId, userId)
    }
    console.error('[PersonaService] Get effective config error:', error)
    return null
  }

  if (!data || data.length === 0) {
    return null
  }

  const row = data[0]
  return {
    persona_id: row.persona_id,
    persona_name: row.persona_name,
    persona_system_prompt: row.persona_system_prompt,
    persona_prompt_mode: row.persona_prompt_mode as SystemPromptMode | null,
    knowledge_profile_id: row.knowledge_profile_id,
    knowledge_prompt: row.knowledge_prompt,
    custom_system_prompt: row.custom_system_prompt,
    voice_config: row.voice_config as PersonaVoiceConfig | null,
    capabilities: row.capabilities as PersonaCapabilities | null,
  }
}

/**
 * Fallback method for getting effective chat config without database function
 */
async function getEffectiveChatConfigFallback(
  supabase: AnySupabaseClient,
  chatId: string,
  userId: string
): Promise<EffectiveChatConfig | null> {
  // Fetch chat with persona
  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select(
      `
      id,
      persona_id,
      knowledge_profile_id,
      custom_system_prompt,
      persona:personas!persona_id (
        id,
        name,
        system_prompt,
        system_prompt_mode,
        knowledge_profile_id,
        voice_config,
        capabilities
      )
    `
    )
    .eq('id', chatId)
    .single()

  if (chatError || !chat) {
    return null
  }

  // Determine knowledge profile ID (chat override > persona setting)
  const knowledgeProfileId =
    chat.knowledge_profile_id ||
    (chat.persona as unknown as Persona)?.knowledge_profile_id ||
    null

  // Fetch knowledge prompt if we have a profile ID
  let knowledgePrompt: string | null = null
  if (knowledgeProfileId) {
    const { data: profile } = await supabase
      .from('knowledge_profiles')
      .select('knowledge_prompt')
      .eq('id', knowledgeProfileId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single()

    knowledgePrompt = profile?.knowledge_prompt || null
  }

  const persona = chat.persona as unknown as Persona | null

  return {
    persona_id: persona?.id || null,
    persona_name: persona?.name || null,
    persona_system_prompt: persona?.system_prompt || null,
    persona_prompt_mode: persona?.system_prompt_mode || null,
    knowledge_profile_id: knowledgeProfileId,
    knowledge_prompt: knowledgePrompt,
    custom_system_prompt: chat.custom_system_prompt || null,
    voice_config: persona?.voice_config || null,
    capabilities: persona?.capabilities || null,
  }
}

// ============================================================================
// DEFAULT PERSONA OPERATIONS
// ============================================================================

/**
 * Get user's default persona
 */
export async function getDefaultPersona(
  supabase: AnySupabaseClient,
  userId: string
): Promise<Persona | null> {
  const { data, error } = await supabase
    .from('personas')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .is('deleted_at', null)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // No default set
    }
    console.error('[PersonaService] Get default persona error:', error)
    return null
  }

  return data as unknown as Persona
}

/**
 * Set a persona as the default
 */
export async function setDefaultPersona(
  supabase: AnySupabaseClient,
  personaId: string,
  userId: string
): Promise<void> {
  // Verify ownership
  const existing = await getPersona(supabase, personaId, userId)
  if (!existing) {
    throw new Error(PERSONA_ERROR_MESSAGES.PERSONA_NOT_FOUND)
  }

  // Unset current default
  await supabase
    .from('personas')
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('is_default', true)

  // Set new default
  const { error } = await supabase
    .from('personas')
    .update({ is_default: true })
    .eq('id', personaId)
    .eq('user_id', userId)

  if (error) {
    console.error('[PersonaService] Set default persona error:', error)
    throw new Error('Failed to set default persona')
  }
}
