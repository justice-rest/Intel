/**
 * Chat Configuration
 *
 * Fetches knowledge profile and custom system prompt for a chat.
 * Replaces the persona-based getEffectiveChatConfig.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getKnowledgePromptForProfile } from '@/lib/knowledge/prompt-generator'

export interface ChatConfig {
  knowledge_prompt: string | null
  custom_system_prompt: string | null
}

/**
 * Get chat configuration (knowledge profile + custom system prompt).
 * Bypasses the persona system entirely.
 *
 * When a knowledge profile is assigned to a chat, it is used regardless
 * of its global activation status — the per-chat assignment is an explicit
 * override that takes precedence over the global active profile.
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
    // Use getKnowledgePromptForProfile which:
    // 1. Does NOT filter by status — per-chat assignment works regardless of global activation
    // 2. Selects ALL prompt columns (voice, strategy, knowledge, rules)
    // 3. Combines all sections via combinePromptSections() for the full prompt
    knowledgePrompt = await getKnowledgePromptForProfile(chat.knowledge_profile_id)
  }

  return {
    knowledge_prompt: knowledgePrompt,
    custom_system_prompt: chat.custom_system_prompt || null,
  }
}
