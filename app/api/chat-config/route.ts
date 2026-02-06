/**
 * Chat Configuration API Route
 *
 * GET  /api/chat-config?chatId=xxx - Get chat configuration (knowledge profile, custom prompt)
 * PUT  /api/chat-config - Update chat configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getChatConfig } from '@/lib/chat-config'

interface UpdateChatConfigRequest {
  chat_id: string
  knowledge_profile_id?: string | null
  custom_system_prompt?: string | null
}

/**
 * GET /api/chat-config?chatId=xxx
 * Get the effective configuration for a chat
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

    // Verify authentication
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

    // Parse query params
    const { searchParams } = new URL(req.url)
    const chatId = searchParams.get('chatId')

    if (!chatId) {
      return NextResponse.json(
        { error: 'chatId is required' },
        { status: 400 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(chatId)) {
      return NextResponse.json(
        { error: 'Invalid chatId format' },
        { status: 400 }
      )
    }

    // Verify chat ownership
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, user_id, knowledge_profile_id, custom_system_prompt')
      .eq('id', chatId)
      .single() as { data: { id: string; user_id: string; knowledge_profile_id: string | null; custom_system_prompt: string | null } | null; error: Error | null }

    if (chatError || !chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    if (chat.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 403 }
      )
    }

    // Get effective configuration
    const config = await getChatConfig(supabase, chatId, user.id)

    return NextResponse.json({
      chat_id: chatId,
      config,
      settings: {
        knowledge_profile_id: chat.knowledge_profile_id,
        custom_system_prompt: chat.custom_system_prompt,
      },
    })
  } catch (error) {
    console.error('[API] GET /api/chat-config error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch chat config' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/chat-config
 * Update chat configuration (knowledge profile, custom prompt)
 */
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      )
    }

    // Verify authentication
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

    // Parse request body
    const body = (await req.json()) as UpdateChatConfigRequest

    if (!body.chat_id) {
      return NextResponse.json(
        { error: 'chat_id is required' },
        { status: 400 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(body.chat_id)) {
      return NextResponse.json(
        { error: 'Invalid chat_id format' },
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
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    if (chat.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 403 }
      )
    }

    // Build update object
    const updateData: Record<string, unknown> = {}

    // Handle knowledge profile assignment
    if (body.knowledge_profile_id !== undefined) {
      // If assigning a profile, verify it belongs to user
      if (body.knowledge_profile_id !== null) {
        if (!uuidRegex.test(body.knowledge_profile_id)) {
          return NextResponse.json(
            { error: 'Invalid knowledge_profile_id format' },
            { status: 400 }
          )
        }

        const { data: profile } = await (supabase as any)
          .from('knowledge_profiles')
          .select('id')
          .eq('id', body.knowledge_profile_id)
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .single()

        if (!profile) {
          return NextResponse.json(
            { error: 'Knowledge profile not found' },
            { status: 404 }
          )
        }
      }
      updateData.knowledge_profile_id = body.knowledge_profile_id
    }

    // Handle custom system prompt
    if (body.custom_system_prompt !== undefined) {
      // Validate length if provided
      if (body.custom_system_prompt && body.custom_system_prompt.length > 10000) {
        return NextResponse.json(
          { error: 'Custom system prompt is too long (max 10000 characters)' },
          { status: 400 }
        )
      }
      updateData.custom_system_prompt = body.custom_system_prompt
    }

    // Ensure at least one field is being updated
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Update chat
    const { error: updateError } = await supabase
      .from('chats')
      .update(updateData)
      .eq('id', body.chat_id)

    if (updateError) {
      console.error('[API] Failed to update chat config:', updateError)
      return NextResponse.json(
        { error: 'Failed to update chat configuration' },
        { status: 500 }
      )
    }

    // Get updated configuration
    const config = await getChatConfig(supabase, body.chat_id, user.id)

    return NextResponse.json({
      message: 'Chat configuration updated',
      chat_id: body.chat_id,
      config,
    })
  } catch (error) {
    console.error('[API] PUT /api/chat-config error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update chat config' },
      { status: 500 }
    )
  }
}
