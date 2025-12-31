/**
 * Knowledge Examples API Routes
 * Handles CRUD operations for communication examples (few-shot learning)
 *
 * NOTE: Uses type assertions for knowledge tables because the migration
 * creates tables not yet in the generated Supabase types.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERROR_MESSAGES } from '@/lib/knowledge/config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KnowledgeClient = any

interface CreateExampleRequest {
  profile_id: string
  example_type: 'good' | 'bad' | 'template'
  category: string
  title?: string
  context?: string
  input?: string
  output: string
  explanation?: string
}

interface UpdateExampleRequest {
  id: string
  title?: string
  context?: string
  input?: string
  output?: string
  explanation?: string
  is_active?: boolean
}

/**
 * GET /api/knowledge/examples
 * List examples for a profile
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

    const { data: examples, error } = await (supabase as KnowledgeClient)
      .from('knowledge_examples')
      .select('*')
      .eq('profile_id', profileId)
      .order('example_type')
      .order('category')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('GET /api/knowledge/examples error:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch examples' }, { status: 500 })
    }

    return NextResponse.json({ success: true, examples: examples || [] })
  } catch (error) {
    console.error('GET /api/knowledge/examples error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch examples' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/knowledge/examples
 * Create a new example
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

    const body = (await req.json()) as CreateExampleRequest

    if (!body.profile_id || !body.example_type || !body.category || !body.output) {
      return NextResponse.json(
        { success: false, error: 'profile_id, example_type, category, and output are required' },
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

    const { data: example, error } = await (supabase as KnowledgeClient)
      .from('knowledge_examples')
      .insert({
        profile_id: body.profile_id,
        example_type: body.example_type,
        category: body.category.trim(),
        title: body.title?.trim() || null,
        context: body.context?.trim() || null,
        input: body.input?.trim() || null,
        output: body.output.trim(),
        explanation: body.explanation?.trim() || null,
        source_type: 'manual',
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('POST /api/knowledge/examples error:', error)
      return NextResponse.json({ success: false, error: 'Failed to create example' }, { status: 500 })
    }

    return NextResponse.json({ success: true, example })
  } catch (error) {
    console.error('POST /api/knowledge/examples error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create example' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/knowledge/examples
 * Update an example
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

    const body = (await req.json()) as UpdateExampleRequest

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    // Get example and verify ownership via profile
    const { data: example } = await (supabase as KnowledgeClient)
      .from('knowledge_examples')
      .select('id, profile_id')
      .eq('id', body.id)
      .single()

    if (!example) {
      return NextResponse.json({ success: false, error: 'Example not found' }, { status: 404 })
    }

    const { data: profile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('id')
      .eq('id', example.profile_id)
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ success: false, error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 403 })
    }

    const updates: Record<string, unknown> = {}
    if (body.title !== undefined) updates.title = body.title?.trim() || null
    if (body.context !== undefined) updates.context = body.context?.trim() || null
    if (body.input !== undefined) updates.input = body.input?.trim() || null
    if (body.output !== undefined) updates.output = body.output.trim()
    if (body.explanation !== undefined) updates.explanation = body.explanation?.trim() || null
    if (body.is_active !== undefined) updates.is_active = body.is_active

    const { data: updated, error } = await (supabase as KnowledgeClient)
      .from('knowledge_examples')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      console.error('PUT /api/knowledge/examples error:', error)
      return NextResponse.json({ success: false, error: 'Failed to update example' }, { status: 500 })
    }

    return NextResponse.json({ success: true, example: updated })
  } catch (error) {
    console.error('PUT /api/knowledge/examples error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update example' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/knowledge/examples
 * Delete an example
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

    // Get example and verify ownership via profile
    const { data: example } = await (supabase as KnowledgeClient)
      .from('knowledge_examples')
      .select('id, profile_id')
      .eq('id', id)
      .single()

    if (!example) {
      return NextResponse.json({ success: false, error: 'Example not found' }, { status: 404 })
    }

    const { data: profile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('id')
      .eq('id', example.profile_id)
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ success: false, error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 403 })
    }

    const { error } = await (supabase as KnowledgeClient)
      .from('knowledge_examples')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('DELETE /api/knowledge/examples error:', error)
      return NextResponse.json({ success: false, error: 'Failed to delete example' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Example deleted' })
  } catch (error) {
    console.error('DELETE /api/knowledge/examples error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete example' },
      { status: 500 }
    )
  }
}
