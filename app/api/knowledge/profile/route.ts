/**
 * Knowledge Profile API Routes
 * Handles CRUD operations for knowledge profiles
 *
 * NOTE: Uses type assertions for knowledge tables because the migration
 * creates tables not yet in the generated Supabase types. After running
 * the migration and regenerating types, these assertions can be removed.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  MAX_PROFILES_PER_USER,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '@/lib/knowledge/config'
import type {
  KnowledgeProfile,
  CreateProfileRequest,
  ProfileWithCounts,
} from '@/lib/knowledge/types'

// Type helper for knowledge table queries (until types are regenerated)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KnowledgeClient = any

/**
 * GET /api/knowledge/profile
 * List all knowledge profiles for authenticated user
 */
export async function GET() {
  try {
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

    // Get profiles with counts (exclude chat-scoped profiles from global list)
    const { data: profiles, error } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .is('chat_scoped_to', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('GET /api/knowledge/profile error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profiles' },
        { status: 500 }
      )
    }

    // Get counts for each profile
    const profilesWithCounts: ProfileWithCounts[] = await Promise.all(
      (profiles || []).map(async (profile: KnowledgeProfile) => {
        const [
          { count: documentCount },
          { count: voiceCount },
          { count: strategyCount },
          { count: factCount },
          { count: exampleCount },
        ] = await Promise.all([
          (supabase as KnowledgeClient)
            .from('knowledge_documents')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', profile.id)
            .is('deleted_at', null),
          (supabase as KnowledgeClient)
            .from('knowledge_voice_elements')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', profile.id)
            .eq('is_active', true),
          (supabase as KnowledgeClient)
            .from('knowledge_strategy_rules')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', profile.id)
            .eq('is_active', true),
          (supabase as KnowledgeClient)
            .from('knowledge_facts')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', profile.id)
            .eq('is_active', true),
          (supabase as KnowledgeClient)
            .from('knowledge_examples')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', profile.id)
            .eq('is_active', true),
        ])

        return {
          ...profile,
          document_count: documentCount || 0,
          voice_element_count: voiceCount || 0,
          strategy_rule_count: strategyCount || 0,
          fact_count: factCount || 0,
          example_count: exampleCount || 0,
        }
      })
    )

    return NextResponse.json({
      success: true,
      profiles: profilesWithCounts,
      count: profilesWithCounts.length,
    })
  } catch (error) {
    console.error('GET /api/knowledge/profile error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch profiles',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/knowledge/profile
 * Create a new knowledge profile
 */
export async function POST(req: Request) {
  try {
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

    const body = (await req.json()) as CreateProfileRequest

    // Validate required fields
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Profile name is required' },
        { status: 400 }
      )
    }

    // Check profile limit (chat-scoped profiles don't count toward limit)
    const { count: existingCount } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .is('chat_scoped_to', null)

    if ((existingCount || 0) >= MAX_PROFILES_PER_USER) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.PROFILE_LIMIT_REACHED },
        { status: 400 }
      )
    }

    // Check for duplicate name
    const { data: existingName } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', body.name.trim())
      .is('deleted_at', null)
      .single()

    if (existingName) {
      return NextResponse.json(
        { success: false, error: 'A profile with this name already exists' },
        { status: 400 }
      )
    }

    // Create profile
    const { data: profile, error } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        status: 'draft',
        version: 1,
      })
      .select()
      .single()

    if (error) {
      console.error('POST /api/knowledge/profile error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create profile' },
        { status: 500 }
      )
    }

    // Log to audit
    await (supabase as KnowledgeClient).from('knowledge_audit_log').insert({
      user_id: user.id,
      profile_id: profile.id,
      action: 'create',
      entity_type: 'profile',
      entity_id: profile.id,
      new_value: { name: profile.name, description: profile.description },
    })

    return NextResponse.json({
      success: true,
      message: SUCCESS_MESSAGES.PROFILE_CREATED,
      profile: {
        ...profile,
        document_count: 0,
        voice_element_count: 0,
        strategy_rule_count: 0,
        fact_count: 0,
        example_count: 0,
      } as ProfileWithCounts,
    })
  } catch (error) {
    console.error('POST /api/knowledge/profile error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create profile',
      },
      { status: 500 }
    )
  }
}
