/**
 * Knowledge Document [id] API Routes
 * Handles operations on individual documents
 *
 * NOTE: Uses type assertions for knowledge tables because the migration
 * creates tables not yet in the generated Supabase types. After running
 * the migration and regenerating types, these assertions can be removed.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/lib/knowledge/config'

// Type helper for knowledge table queries (until types are regenerated)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KnowledgeClient = any

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/knowledge/documents/[id]
 * Get a single document with analysis results
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

    // Get document with ownership check
    const { data: document, error } = await (supabase as KnowledgeClient)
      .from('knowledge_documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (error || !document) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.DOCUMENT_NOT_FOUND },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      document,
    })
  } catch (error) {
    console.error('GET /api/knowledge/documents/[id] error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch document',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/knowledge/documents/[id]
 * Soft delete a document
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
    const { data: document } = await (supabase as KnowledgeClient)
      .from('knowledge_documents')
      .select('id, profile_id, file_name, file_url')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (!document) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.DOCUMENT_NOT_FOUND },
        { status: 404 }
      )
    }

    // Soft delete document
    const { error } = await (supabase as KnowledgeClient)
      .from('knowledge_documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('DELETE /api/knowledge/documents/[id] error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete document' },
        { status: 500 }
      )
    }

    // Also remove extracted elements linked to this document
    await Promise.all([
      (supabase as KnowledgeClient)
        .from('knowledge_voice_elements')
        .update({ is_active: false })
        .eq('source_document_id', id),
      (supabase as KnowledgeClient)
        .from('knowledge_strategy_rules')
        .update({ is_active: false })
        .eq('source_document_id', id),
      (supabase as KnowledgeClient)
        .from('knowledge_facts')
        .update({ is_active: false })
        .eq('source_document_id', id),
      (supabase as KnowledgeClient)
        .from('knowledge_examples')
        .update({ is_active: false })
        .eq('source_document_id', id),
    ])

    // Log to audit
    await (supabase as KnowledgeClient).from('knowledge_audit_log').insert({
      user_id: user.id,
      profile_id: document.profile_id,
      action: 'delete',
      entity_type: 'document',
      entity_id: id,
      old_value: { file_name: document.file_name },
    })

    return NextResponse.json({
      success: true,
      message: SUCCESS_MESSAGES.DOCUMENT_DELETED,
    })
  } catch (error) {
    console.error('DELETE /api/knowledge/documents/[id] error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete document',
      },
      { status: 500 }
    )
  }
}
