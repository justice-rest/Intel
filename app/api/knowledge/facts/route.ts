/**
 * Knowledge Facts API Routes
 * Handles CRUD operations for organizational knowledge facts
 *
 * NOTE: Uses type assertions for knowledge tables because the migration
 * creates tables not yet in the generated Supabase types.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERROR_MESSAGES } from '@/lib/knowledge/config'
import type { FactCategory } from '@/lib/knowledge/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KnowledgeClient = any

interface CreateFactRequest {
  profile_id: string
  category: FactCategory
  fact: string
  importance?: number
  valid_from?: string
  valid_until?: string
}

interface UpdateFactRequest {
  id: string
  fact?: string
  importance?: number
  valid_from?: string
  valid_until?: string
  is_active?: boolean
}

/**
 * GET /api/knowledge/facts
 * List facts for a profile
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

    // Exclude embedding column for performance
    const { data: facts, error } = await (supabase as KnowledgeClient)
      .from('knowledge_facts')
      .select('id, profile_id, category, fact, importance, valid_from, valid_until, source_document_id, is_user_defined, is_active, created_at')
      .eq('profile_id', profileId)
      .eq('is_active', true)
      .order('category')
      .order('importance', { ascending: false })

    if (error) {
      console.error('GET /api/knowledge/facts error:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch facts' }, { status: 500 })
    }

    return NextResponse.json({ success: true, facts: facts || [] })
  } catch (error) {
    console.error('GET /api/knowledge/facts error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch facts' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/knowledge/facts
 * Create a new fact
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

    const body = (await req.json()) as CreateFactRequest

    if (!body.profile_id || !body.category || !body.fact) {
      return NextResponse.json(
        { success: false, error: 'profile_id, category, and fact are required' },
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

    const { data: fact, error } = await (supabase as KnowledgeClient)
      .from('knowledge_facts')
      .insert({
        profile_id: body.profile_id,
        category: body.category,
        fact: body.fact.trim(),
        importance: body.importance || 0.7,
        valid_from: body.valid_from || null,
        valid_until: body.valid_until || null,
        is_user_defined: true,
        is_active: true,
      })
      .select('id, profile_id, category, fact, importance, valid_from, valid_until, is_user_defined, is_active, created_at')
      .single()

    if (error) {
      console.error('POST /api/knowledge/facts error:', error)
      return NextResponse.json({ success: false, error: 'Failed to create fact' }, { status: 500 })
    }

    return NextResponse.json({ success: true, fact })
  } catch (error) {
    console.error('POST /api/knowledge/facts error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create fact' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/knowledge/facts
 * Update a fact
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

    const body = (await req.json()) as UpdateFactRequest

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    // Get fact and verify ownership via profile
    const { data: fact } = await (supabase as KnowledgeClient)
      .from('knowledge_facts')
      .select('id, profile_id')
      .eq('id', body.id)
      .single()

    if (!fact) {
      return NextResponse.json({ success: false, error: 'Fact not found' }, { status: 404 })
    }

    const { data: profile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('id')
      .eq('id', fact.profile_id)
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ success: false, error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 403 })
    }

    const updates: Record<string, unknown> = {}
    if (body.fact !== undefined) updates.fact = body.fact.trim()
    if (body.importance !== undefined) updates.importance = Math.min(1, Math.max(0, body.importance))
    if (body.valid_from !== undefined) updates.valid_from = body.valid_from || null
    if (body.valid_until !== undefined) updates.valid_until = body.valid_until || null
    if (body.is_active !== undefined) updates.is_active = body.is_active

    const { data: updated, error } = await (supabase as KnowledgeClient)
      .from('knowledge_facts')
      .update(updates)
      .eq('id', body.id)
      .select('id, profile_id, category, fact, importance, valid_from, valid_until, is_user_defined, is_active, created_at')
      .single()

    if (error) {
      console.error('PUT /api/knowledge/facts error:', error)
      return NextResponse.json({ success: false, error: 'Failed to update fact' }, { status: 500 })
    }

    return NextResponse.json({ success: true, fact: updated })
  } catch (error) {
    console.error('PUT /api/knowledge/facts error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update fact' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/knowledge/facts
 * Delete a fact
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

    // Get fact and verify ownership via profile
    const { data: fact } = await (supabase as KnowledgeClient)
      .from('knowledge_facts')
      .select('id, profile_id')
      .eq('id', id)
      .single()

    if (!fact) {
      return NextResponse.json({ success: false, error: 'Fact not found' }, { status: 404 })
    }

    const { data: profile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('id')
      .eq('id', fact.profile_id)
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ success: false, error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 403 })
    }

    const { error } = await (supabase as KnowledgeClient)
      .from('knowledge_facts')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('DELETE /api/knowledge/facts error:', error)
      return NextResponse.json({ success: false, error: 'Failed to delete fact' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Fact deleted' })
  } catch (error) {
    console.error('DELETE /api/knowledge/facts error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete fact' },
      { status: 500 }
    )
  }
}
