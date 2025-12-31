/**
 * Knowledge Voice Elements API Routes
 * Handles CRUD operations for voice and style elements
 *
 * NOTE: Uses type assertions for knowledge tables because the migration
 * creates tables not yet in the generated Supabase types.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERROR_MESSAGES } from '@/lib/knowledge/config'
import type { VoiceElementType } from '@/lib/knowledge/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KnowledgeClient = any

interface CreateVoiceElementRequest {
  profile_id: string
  element_type: VoiceElementType
  value: string
  description?: string
}

interface UpdateVoiceElementRequest {
  id: string
  value?: string
  description?: string
  is_active?: boolean
}

/**
 * GET /api/knowledge/voice
 * List voice elements for a profile
 */
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 503 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const profileId = searchParams.get('profile_id')

    if (!profileId) {
      return NextResponse.json({ success: false, error: 'profile_id is required' }, { status: 400 })
    }

    // Verify profile ownership
    const { data: profile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('id')
      .eq('id', profileId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (!profile) {
      return NextResponse.json({ success: false, error: ERROR_MESSAGES.PROFILE_NOT_FOUND }, { status: 404 })
    }

    const { data: elements, error } = await (supabase as KnowledgeClient)
      .from('knowledge_voice_elements')
      .select('*')
      .eq('profile_id', profileId)
      .order('element_type')
      .order('confidence', { ascending: false })

    if (error) {
      console.error('GET /api/knowledge/voice error:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch voice elements' }, { status: 500 })
    }

    return NextResponse.json({ success: true, elements: elements || [] })
  } catch (error) {
    console.error('GET /api/knowledge/voice error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch voice elements' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/knowledge/voice
 * Create a new voice element
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 503 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    const body = (await req.json()) as CreateVoiceElementRequest

    if (!body.profile_id || !body.element_type || !body.value) {
      return NextResponse.json(
        { success: false, error: 'profile_id, element_type, and value are required' },
        { status: 400 }
      )
    }

    // Verify profile ownership
    const { data: profile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('id')
      .eq('id', body.profile_id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (!profile) {
      return NextResponse.json({ success: false, error: ERROR_MESSAGES.PROFILE_NOT_FOUND }, { status: 404 })
    }

    const { data: element, error } = await (supabase as KnowledgeClient)
      .from('knowledge_voice_elements')
      .insert({
        profile_id: body.profile_id,
        element_type: body.element_type,
        value: body.value.trim(),
        description: body.description?.trim() || null,
        confidence: 1.0, // User-defined elements have high confidence
        is_user_defined: true,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('POST /api/knowledge/voice error:', error)
      return NextResponse.json({ success: false, error: 'Failed to create voice element' }, { status: 500 })
    }

    return NextResponse.json({ success: true, element })
  } catch (error) {
    console.error('POST /api/knowledge/voice error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create voice element' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/knowledge/voice
 * Update a voice element
 */
export async function PUT(req: Request) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 503 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    const body = (await req.json()) as UpdateVoiceElementRequest

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    // Get element and verify ownership via profile
    const { data: element } = await (supabase as KnowledgeClient)
      .from('knowledge_voice_elements')
      .select('id, profile_id')
      .eq('id', body.id)
      .single()

    if (!element) {
      return NextResponse.json({ success: false, error: 'Voice element not found' }, { status: 404 })
    }

    const { data: profile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('id')
      .eq('id', element.profile_id)
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ success: false, error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 403 })
    }

    const updates: Record<string, unknown> = {}
    if (body.value !== undefined) updates.value = body.value.trim()
    if (body.description !== undefined) updates.description = body.description?.trim() || null
    if (body.is_active !== undefined) updates.is_active = body.is_active

    const { data: updated, error } = await (supabase as KnowledgeClient)
      .from('knowledge_voice_elements')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      console.error('PUT /api/knowledge/voice error:', error)
      return NextResponse.json({ success: false, error: 'Failed to update voice element' }, { status: 500 })
    }

    return NextResponse.json({ success: true, element: updated })
  } catch (error) {
    console.error('PUT /api/knowledge/voice error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update voice element' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/knowledge/voice
 * Delete a voice element
 */
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 503 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    // Get element and verify ownership via profile
    const { data: element } = await (supabase as KnowledgeClient)
      .from('knowledge_voice_elements')
      .select('id, profile_id')
      .eq('id', id)
      .single()

    if (!element) {
      return NextResponse.json({ success: false, error: 'Voice element not found' }, { status: 404 })
    }

    const { data: profile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('id')
      .eq('id', element.profile_id)
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ success: false, error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 403 })
    }

    // Soft delete by setting is_active to false
    const { error } = await (supabase as KnowledgeClient)
      .from('knowledge_voice_elements')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('DELETE /api/knowledge/voice error:', error)
      return NextResponse.json({ success: false, error: 'Failed to delete voice element' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Voice element deleted' })
  } catch (error) {
    console.error('DELETE /api/knowledge/voice error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete voice element' },
      { status: 500 }
    )
  }
}
