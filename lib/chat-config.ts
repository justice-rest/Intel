/**
 * Chat Configuration
 *
 * Fetches knowledge profile and custom system prompt for a chat.
 * Replaces the persona-based getEffectiveChatConfig.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ChatConfig {
  knowledge_prompt: string | null
  custom_system_prompt: string | null
}

/**
 * Get chat configuration (knowledge profile + custom system prompt).
 * Bypasses the persona system entirely.
 */
export async function getChatConfig(
  supabase: SupabaseClient,
  chatId: string,
  userId: string
): Promise<ChatConfig | null> {
  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('knowledge_profile_id, custom_system_prompt')
    .eq('id', chatId)
    .single()

  if (chatError || !chat) {
    return null
  }

  let knowledgePrompt: string | null = null

  if (chat.knowledge_profile_id) {
    const { data: profile } = await supabase
      .from('knowledge_profiles')
      .select('knowledge_prompt')
      .eq('id', chat.knowledge_profile_id)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single()

    knowledgePrompt = profile?.knowledge_prompt || null
  }

  return {
    knowledge_prompt: knowledgePrompt,
    custom_system_prompt: chat.custom_system_prompt || null,
  }
}
