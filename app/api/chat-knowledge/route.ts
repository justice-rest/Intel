/**
 * Chat-Scoped Knowledge API Route
 *
 * GET  /api/chat-knowledge?chatId=xxx - Get chat knowledge config
 * POST /api/chat-knowledge - Create, update, or remove chat knowledge profile
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getChatScopedProfile,
  createChatScopedProfile,
  updateChatScopedProfile,
  removeChatScopedProfile,
  estimateTokens,
  combinePromptSections,
} from '@/lib/knowledge'
import type { KnowledgeProfile, KnowledgeMergeMode, ChatKnowledgeConfig } from '@/lib/knowledge/types'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KnowledgeClient = any

/**
 * GET /api/chat-knowledge?chatId=xxx
 * Returns knowledge configuration for a chat
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const chatId = searchParams.get('chatId')

    if (!chatId || !UUID_REGEX.test(chatId)) {
      return NextResponse.json(
        { error: 'Valid chatId is required' },
        { status: 400 }
      )
    }

    // Verify chat ownership
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, user_id')
      .eq('id', chatId)
      .single()

    if (chatError || !chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    if ((chat as { user_id: string }).user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Fetch chat-scoped profile and global active profile in parallel
    const [chatScopedProfile, globalProfile] = await Promise.all([
      getChatScopedProfile(chatId, user.id),
      getGlobalActiveProfile(user.id),
    ])

    const chatScopedTokens = chatScopedProfile
      ? estimateTokens(combinePromptSections(chatScopedProfile) || '')
      : 0
    const globalTokens = globalProfile
      ? estimateTokens(combinePromptSections(globalProfile) || '')
      : 0

    const response: ChatKnowledgeConfig = {
      has_chat_scoped_profile: !!chatScopedProfile,
      chat_scoped_profile: chatScopedProfile,
      merge_mode: chatScopedProfile?.merge_mode ?? null,
      global_active_profile: globalProfile,
      estimated_tokens: {
        chat_scoped: chatScopedTokens,
        global: globalTokens,
        combined: chatScopedTokens + globalTokens,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('GET /api/chat-knowledge error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

interface PostBody {
  chat_id: string
  action: 'create' | 'update' | 'remove'
  profile_id?: string
  name?: string
  description?: string
  merge_mode?: KnowledgeMergeMode
  voice_content?: string
  strategy_content?: string
  knowledge_content?: string
  rules_content?: string
}

/**
 * POST /api/chat-knowledge
 * Create, update, or remove a chat-scoped knowledge profile
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = (await req.json()) as PostBody

    if (!body.chat_id || !UUID_REGEX.test(body.chat_id)) {
      return NextResponse.json(
        { error: 'Valid chat_id is required' },
        { status: 400 }
      )
    }

    if (!body.action || !['create', 'update', 'remove'].includes(body.action)) {
      return NextResponse.json(
        { error: 'Valid action is required (create, update, remove)' },
        { status: 400 }
      )
    }

    // Validate name/description lengths
    if (body.name && body.name.length > 200) {
      return NextResponse.json(
        { error: 'Name must be under 200 characters' },
        { status: 400 }
      )
    }
    if (body.description && body.description.length > 500) {
      return NextResponse.json(
        { error: 'Description must be under 500 characters' },
        { status: 400 }
      )
    }

    // Validate content field lengths (prevent DoS via oversized payloads)
    const MAX_CONTENT_LENGTH = 10000
    const contentFields = [
      body.voice_content,
      body.strategy_content,
      body.knowledge_content,
      body.rules_content,
    ]
    for (const field of contentFields) {
      if (field && field.length > MAX_CONTENT_LENGTH) {
        return NextResponse.json(
          { error: `Content fields must be under ${MAX_CONTENT_LENGTH} characters` },
          { status: 400 }
        )
      }
    }

    // Validate merge_mode if provided
    if (body.merge_mode && !['replace', 'merge'].includes(body.merge_mode)) {
      return NextResponse.json(
        { error: 'merge_mode must be "replace" or "merge"' },
        { status: 400 }
      )
    }

    // Verify chat ownership
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, user_id')
      .eq('id', body.chat_id)
      .single()

    if (chatError || !chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    if ((chat as { user_id: string }).user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    switch (body.action) {
      case 'create': {
        if (!body.name || !body.name.trim()) {
          return NextResponse.json(
            { error: 'Profile name is required' },
            { status: 400 }
          )
        }

        const { profile, error } = await createChatScopedProfile(
          user.id,
          body.chat_id,
          body.name,
          {
            description: body.description,
            mergeMode: body.merge_mode,
            voiceContent: body.voice_content,
            strategyContent: body.strategy_content,
            knowledgeContent: body.knowledge_content,
            rulesContent: body.rules_content,
          }
        )

        if (error) {
          return NextResponse.json({ error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Chat knowledge profile created',
          profile,
        })
      }

      case 'update': {
        if (!body.profile_id || !UUID_REGEX.test(body.profile_id)) {
          return NextResponse.json(
            { error: 'Valid profile_id is required for update' },
            { status: 400 }
          )
        }

        if (body.name !== undefined && !body.name.trim()) {
          return NextResponse.json(
            { error: 'Profile name cannot be empty' },
            { status: 400 }
          )
        }

        const { profile, error } = await updateChatScopedProfile(
          user.id,
          body.profile_id,
          {
            name: body.name,
            description: body.description,
            mergeMode: body.merge_mode,
            voiceContent: body.voice_content,
            strategyContent: body.strategy_content,
            knowledgeContent: body.knowledge_content,
            rulesContent: body.rules_content,
          }
        )

        if (error) {
          return NextResponse.json({ error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Chat knowledge profile updated',
          profile,
        })
      }

      case 'remove': {
        const { success, error } = await removeChatScopedProfile(
          user.id,
          body.chat_id
        )

        if (!success) {
          return NextResponse.json(
            { error: error || 'Failed to remove profile' },
            { status: 400 }
          )
        }

        return NextResponse.json({
          success: true,
          message: 'Chat knowledge profile removed',
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('POST /api/chat-knowledge error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Helper: Get the user's active global knowledge profile (not chat-scoped)
 */
async function getGlobalActiveProfile(
  userId: string
): Promise<KnowledgeProfile | null> {
  try {
    const supabase = await createClient()
    if (!supabase) return null

    const { data: profile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .is('chat_scoped_to', null)
      .single()

    return profile || null
  } catch {
    return null
  }
}
