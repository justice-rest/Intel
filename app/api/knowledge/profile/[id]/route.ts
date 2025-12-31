/**
 * Knowledge Profile [id] API Routes
 * Handles operations on individual knowledge profiles
 *
 * NOTE: Uses type assertions for knowledge tables because the migration
 * creates tables not yet in the generated Supabase types. After running
 * the migration and regenerating types, these assertions can be removed.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/lib/knowledge/config'
import type {
  KnowledgeProfile,
  UpdateProfileRequest,
  ProfileWithCounts,
} from '@/lib/knowledge/types'

// Type helper for knowledge table queries (until types are regenerated)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KnowledgeClient = any

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/knowledge/profile/[id]
 * Get a single knowledge profile with all related data
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Supabase not configured' },
        { status: 503 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      )
    }

    // Get profile
    const { data: profile, error } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (error || !profile) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.PROFILE_NOT_FOUND },
        { status: 404 }
      )
    }

    // Get all related data in parallel
    const [
      { data: documents },
      { data: voiceElements },
      { data: strategyRules },
      { data: facts },
      { data: examples },
      { data: versions },
    ] = await Promise.all([
      (supabase as KnowledgeClient)
        .from('knowledge_documents')
        .select('*')
        .eq('profile_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      (supabase as KnowledgeClient)
        .from('knowledge_voice_elements')
        .select('*')
        .eq('profile_id', id)
        .eq('is_active', true)
        .order('element_type'),
      (supabase as KnowledgeClient)
        .from('knowledge_strategy_rules')
        .select('*')
        .eq('profile_id', id)
        .eq('is_active', true)
        .order('priority', { ascending: false }),
      (supabase as KnowledgeClient)
        .from('knowledge_facts')
        .select('id, profile_id, category, fact, importance, valid_from, valid_until, source_document_id, is_user_defined, is_active, created_at')
        .eq('profile_id', id)
        .eq('is_active', true)
        .order('importance', { ascending: false }),
      (supabase as KnowledgeClient)
        .from('knowledge_examples')
        .select('*')
        .eq('profile_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      (supabase as KnowledgeClient)
        .from('knowledge_profile_versions')
        .select('*')
        .eq('profile_id', id)
        .order('version', { ascending: false })
        .limit(10),
    ])

    const profileWithCounts: ProfileWithCounts = {
      ...profile,
      document_count: documents?.length || 0,
      voice_element_count: voiceElements?.length || 0,
      strategy_rule_count: strategyRules?.length || 0,
      fact_count: facts?.length || 0,
      example_count: examples?.length || 0,
    }

    return NextResponse.json({
      success: true,
      profile: profileWithCounts,
      documents: documents || [],
      voice_elements: voiceElements || [],
      strategy_rules: strategyRules || [],
      facts: facts || [],
      examples: examples || [],
      versions: versions || [],
    })
  } catch (error) {
    console.error('GET /api/knowledge/profile/[id] error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch profile',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/knowledge/profile/[id]
 * Update a knowledge profile
 */
export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Supabase not configured' },
        { status: 503 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      )
    }

    const body = (await req.json()) as UpdateProfileRequest

    // Verify ownership
    const { data: existingProfile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (!existingProfile) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.PROFILE_NOT_FOUND },
        { status: 404 }
      )
    }

    // Build update object
    const updates: Partial<KnowledgeProfile> = {}
    const oldValues: Record<string, unknown> = {}

    if (body.name !== undefined && body.name.trim() !== existingProfile.name) {
      // Check for duplicate name
      const { data: duplicateName } = await (supabase as KnowledgeClient)
        .from('knowledge_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', body.name.trim())
        .neq('id', id)
        .is('deleted_at', null)
        .single()

      if (duplicateName) {
        return NextResponse.json(
          { success: false, error: 'A profile with this name already exists' },
          { status: 400 }
        )
      }

      oldValues.name = existingProfile.name
      updates.name = body.name.trim()
    }

    if (body.description !== undefined) {
      oldValues.description = existingProfile.description
      updates.description = body.description?.trim() || null
    }

    if (body.status !== undefined && body.status !== existingProfile.status) {
      oldValues.status = existingProfile.status
      updates.status = body.status

      // If activating, ensure only one profile is active
      if (body.status === 'active') {
        await (supabase as KnowledgeClient)
          .from('knowledge_profiles')
          .update({ status: 'draft' })
          .eq('user_id', user.id)
          .eq('status', 'active')
          .neq('id', id)
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes to save',
        profile: existingProfile,
      })
    }

    // Update profile
    const { data: profile, error } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('PUT /api/knowledge/profile/[id] error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    // Log to audit
    await (supabase as KnowledgeClient).from('knowledge_audit_log').insert({
      user_id: user.id,
      profile_id: id,
      action: 'update',
      entity_type: 'profile',
      entity_id: id,
      old_value: oldValues,
      new_value: updates,
    })

    return NextResponse.json({
      success: true,
      message: SUCCESS_MESSAGES.PROFILE_UPDATED,
      profile,
    })
  } catch (error) {
    console.error('PUT /api/knowledge/profile/[id] error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update profile',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/knowledge/profile/[id]
 * Soft delete a knowledge profile
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Supabase not configured' },
        { status: 503 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      )
    }

    // Verify ownership
    const { data: existingProfile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('id, name')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (!existingProfile) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.PROFILE_NOT_FOUND },
        { status: 404 }
      )
    }

    // Soft delete profile (cascades to documents via deleted_at pattern)
    const { error } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .update({ deleted_at: new Date().toISOString(), status: 'archived' })
      .eq('id', id)

    if (error) {
      console.error('DELETE /api/knowledge/profile/[id] error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete profile' },
        { status: 500 }
      )
    }

    // Also soft delete all documents
    await (supabase as KnowledgeClient)
      .from('knowledge_documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('profile_id', id)

    // Log to audit
    await (supabase as KnowledgeClient).from('knowledge_audit_log').insert({
      user_id: user.id,
      profile_id: id,
      action: 'delete',
      entity_type: 'profile',
      entity_id: id,
      old_value: { name: existingProfile.name },
    })

    return NextResponse.json({
      success: true,
      message: SUCCESS_MESSAGES.PROFILE_DELETED,
    })
  } catch (error) {
    console.error('DELETE /api/knowledge/profile/[id] error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete profile',
      },
      { status: 500 }
    )
  }
}
