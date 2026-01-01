/**
 * Knowledge Strategy Rules API Routes
 * Handles CRUD operations for fundraising strategy rules
 *
 * NOTE: Uses type assertions for knowledge tables because the migration
 * creates tables not yet in the generated Supabase types.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERROR_MESSAGES } from '@/lib/knowledge/config'
import type { StrategyCategory } from '@/lib/knowledge/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KnowledgeClient = any

interface CreateStrategyRuleRequest {
  profile_id: string
  category: StrategyCategory
  rule: string
  rationale?: string
  priority?: number
}

interface UpdateStrategyRuleRequest {
  id: string
  rule?: string
  rationale?: string
  priority?: number
  is_active?: boolean
}

/**
 * GET /api/knowledge/strategy
 * List strategy rules for a profile
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

    const { data: rules, error } = await (supabase as KnowledgeClient)
      .from('knowledge_strategy_rules')
      .select('*')
      .eq('profile_id', profileId)
      .eq('is_active', true)
      .order('category')
      .order('priority', { ascending: false })

    if (error) {
      console.error('GET /api/knowledge/strategy error:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch strategy rules' }, { status: 500 })
    }

    return NextResponse.json({ success: true, rules: rules || [] })
  } catch (error) {
    console.error('GET /api/knowledge/strategy error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch strategy rules' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/knowledge/strategy
 * Create a new strategy rule
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

    const body = (await req.json()) as CreateStrategyRuleRequest

    if (!body.profile_id || !body.category || !body.rule) {
      return NextResponse.json(
        { success: false, error: 'profile_id, category, and rule are required' },
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

    const { data: rule, error } = await (supabase as KnowledgeClient)
      .from('knowledge_strategy_rules')
      .insert({
        profile_id: body.profile_id,
        category: body.category,
        rule: body.rule.trim(),
        rationale: body.rationale?.trim() || null,
        priority: body.priority || 5,
        source_type: 'user_defined',
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('POST /api/knowledge/strategy error:', error)
      return NextResponse.json({ success: false, error: 'Failed to create strategy rule' }, { status: 500 })
    }

    return NextResponse.json({ success: true, rule })
  } catch (error) {
    console.error('POST /api/knowledge/strategy error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create strategy rule' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/knowledge/strategy
 * Update a strategy rule
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

    const body = (await req.json()) as UpdateStrategyRuleRequest

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    // Get rule and verify ownership via profile
    const { data: rule } = await (supabase as KnowledgeClient)
      .from('knowledge_strategy_rules')
      .select('id, profile_id')
      .eq('id', body.id)
      .single()

    if (!rule) {
      return NextResponse.json({ success: false, error: 'Strategy rule not found' }, { status: 404 })
    }

    const { data: profile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('id')
      .eq('id', rule.profile_id)
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ success: false, error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 403 })
    }

    const updates: Record<string, unknown> = {}
    if (body.rule !== undefined) updates.rule = body.rule.trim()
    if (body.rationale !== undefined) updates.rationale = body.rationale?.trim() || null
    if (body.priority !== undefined) updates.priority = Math.min(10, Math.max(1, body.priority))
    if (body.is_active !== undefined) updates.is_active = body.is_active

    const { data: updated, error } = await (supabase as KnowledgeClient)
      .from('knowledge_strategy_rules')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      console.error('PUT /api/knowledge/strategy error:', error)
      return NextResponse.json({ success: false, error: 'Failed to update strategy rule' }, { status: 500 })
    }

    return NextResponse.json({ success: true, rule: updated })
  } catch (error) {
    console.error('PUT /api/knowledge/strategy error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update strategy rule' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/knowledge/strategy
 * Delete a strategy rule
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

    // Get rule and verify ownership via profile
    const { data: rule } = await (supabase as KnowledgeClient)
      .from('knowledge_strategy_rules')
      .select('id, profile_id')
      .eq('id', id)
      .single()

    if (!rule) {
      return NextResponse.json({ success: false, error: 'Strategy rule not found' }, { status: 404 })
    }

    const { data: profile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('id')
      .eq('id', rule.profile_id)
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ success: false, error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 403 })
    }

    const { error } = await (supabase as KnowledgeClient)
      .from('knowledge_strategy_rules')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('DELETE /api/knowledge/strategy error:', error)
      return NextResponse.json({ success: false, error: 'Failed to delete strategy rule' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Strategy rule deleted' })
  } catch (error) {
    console.error('DELETE /api/knowledge/strategy error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete strategy rule' },
      { status: 500 }
    )
  }
}
