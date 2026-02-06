/**
 * Chat-Scoped Knowledge Profiles
 *
 * CRUD operations for knowledge profiles scoped to individual chats.
 * Reuses the existing knowledge_profiles table with chat_scoped_to column.
 */

import { createClient } from '@/lib/supabase/server'
import { DEFAULT_MERGE_MODE } from './config'
import type { KnowledgeProfile, KnowledgeMergeMode } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KnowledgeClient = any

/**
 * Get the chat-scoped knowledge profile for a specific chat.
 * Returns null if no scoped profile exists.
 * Requires userId for defense-in-depth authorization (not just RLS).
 */
export async function getChatScopedProfile(
  chatId: string,
  userId: string
): Promise<KnowledgeProfile | null> {
  try {
    const supabase = await createClient()
    if (!supabase) return null

    const { data: profile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('*')
      .eq('chat_scoped_to', chatId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single()

    return profile || null
  } catch (error) {
    console.error('getChatScopedProfile error:', error)
    return null
  }
}

/**
 * Create a chat-scoped knowledge profile.
 * Validates chat ownership and ensures only one scoped profile per chat.
 */
export async function createChatScopedProfile(
  userId: string,
  chatId: string,
  name: string,
  options?: {
    description?: string
    mergeMode?: KnowledgeMergeMode
    voiceContent?: string
    strategyContent?: string
    knowledgeContent?: string
    rulesContent?: string
  }
): Promise<{ profile: KnowledgeProfile | null; error: string | null }> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return { profile: null, error: 'Database not available' }
    }

    // Verify chat ownership
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, user_id')
      .eq('id', chatId)
      .single()

    if (chatError || !chat) {
      return { profile: null, error: 'Chat not found' }
    }

    if ((chat as { user_id: string }).user_id !== userId) {
      return { profile: null, error: 'Not authorized to modify this chat' }
    }

    // Check if a scoped profile already exists for this chat
    const { data: existing } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('id')
      .eq('chat_scoped_to', chatId)
      .is('deleted_at', null)
      .single()

    if (existing) {
      return { profile: null, error: 'This chat already has a knowledge profile' }
    }

    const mergeMode = options?.mergeMode ?? DEFAULT_MERGE_MODE

    // Create the profile — store freeform text directly in prompt fields
    const { data: profile, error } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .insert({
        user_id: userId,
        name: name.trim(),
        description: options?.description?.trim() || null,
        status: 'active',
        version: 1,
        chat_scoped_to: chatId,
        merge_mode: mergeMode,
        voice_prompt: options?.voiceContent?.trim() || null,
        strategy_prompt: options?.strategyContent?.trim() || null,
        knowledge_prompt: options?.knowledgeContent?.trim() || null,
        rules_prompt: options?.rulesContent?.trim() || null,
        prompt_generated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('createChatScopedProfile insert error:', error)
      return { profile: null, error: 'Failed to create chat knowledge profile' }
    }

    return { profile, error: null }
  } catch (error) {
    console.error('createChatScopedProfile error:', error)
    return {
      profile: null,
      error: error instanceof Error ? error.message : 'Failed to create profile',
    }
  }
}

/**
 * Update a chat-scoped knowledge profile's content or settings.
 */
export async function updateChatScopedProfile(
  userId: string,
  profileId: string,
  updates: {
    name?: string
    description?: string | null
    mergeMode?: KnowledgeMergeMode
    voiceContent?: string | null
    strategyContent?: string | null
    knowledgeContent?: string | null
    rulesContent?: string | null
  }
): Promise<{ profile: KnowledgeProfile | null; error: string | null }> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return { profile: null, error: 'Database not available' }
    }

    // Verify ownership
    const { data: existing } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('*')
      .eq('id', profileId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .not('chat_scoped_to', 'is', null)
      .single()

    if (!existing) {
      return { profile: null, error: 'Chat knowledge profile not found' }
    }

    // Build update payload — only include fields that were provided
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (updates.name !== undefined) {
      updatePayload.name = updates.name.trim()
    }
    if (updates.description !== undefined) {
      updatePayload.description = updates.description?.trim() || null
    }
    if (updates.mergeMode !== undefined) {
      updatePayload.merge_mode = updates.mergeMode
    }
    if (updates.voiceContent !== undefined) {
      updatePayload.voice_prompt = updates.voiceContent?.trim() || null
    }
    if (updates.strategyContent !== undefined) {
      updatePayload.strategy_prompt = updates.strategyContent?.trim() || null
    }
    if (updates.knowledgeContent !== undefined) {
      updatePayload.knowledge_prompt = updates.knowledgeContent?.trim() || null
    }
    if (updates.rulesContent !== undefined) {
      updatePayload.rules_prompt = updates.rulesContent?.trim() || null
    }

    const { data: profile, error } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .update(updatePayload)
      .eq('id', profileId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('updateChatScopedProfile error:', error)
      return { profile: null, error: 'Failed to update profile' }
    }

    return { profile, error: null }
  } catch (error) {
    console.error('updateChatScopedProfile error:', error)
    return {
      profile: null,
      error: error instanceof Error ? error.message : 'Failed to update profile',
    }
  }
}

/**
 * Soft-delete a chat-scoped knowledge profile.
 */
export async function removeChatScopedProfile(
  userId: string,
  chatId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return { success: false, error: 'Database not available' }
    }

    const { error } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('chat_scoped_to', chatId)
      .eq('user_id', userId)
      .is('deleted_at', null)

    if (error) {
      console.error('removeChatScopedProfile error:', error)
      return { success: false, error: 'Failed to remove profile' }
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('removeChatScopedProfile error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove profile',
    }
  }
}
