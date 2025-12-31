/**
 * Knowledge Documents API Routes
 * Handles document upload and listing for knowledge profiles
 *
 * NOTE: Uses type assertions for knowledge tables because the migration
 * creates tables not yet in the generated Supabase types. After running
 * the migration and regenerating types, these assertions can be removed.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  MAX_DOCUMENTS_PER_PROFILE,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '@/lib/knowledge/config'
import type { KnowledgeDocument } from '@/lib/knowledge/types'

// Type helper for knowledge table queries (until types are regenerated)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KnowledgeClient = any

/**
 * GET /api/knowledge/documents
 * List documents for a profile
 */
export async function GET(req: Request) {
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

    // Get profile_id from query params
    const { searchParams } = new URL(req.url)
    const profileId = searchParams.get('profile_id')

    if (!profileId) {
      return NextResponse.json(
        { success: false, error: 'profile_id is required' },
        { status: 400 }
      )
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
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.PROFILE_NOT_FOUND },
        { status: 404 }
      )
    }

    // Get documents
    const { data: documents, error } = await (supabase as KnowledgeClient)
      .from('knowledge_documents')
      .select('*')
      .eq('profile_id', profileId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('GET /api/knowledge/documents error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      documents: documents || [],
      count: documents?.length || 0,
    })
  } catch (error) {
    console.error('GET /api/knowledge/documents error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch documents',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/knowledge/documents
 * Upload a new document
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

    // Parse multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const profileId = formData.get('profile_id') as string | null
    const docPurposes = formData.get('doc_purpose') as string | null // JSON array string

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!profileId) {
      return NextResponse.json(
        { success: false, error: 'profile_id is required' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
        },
        { status: 400 }
      )
    }

    // Validate file type
    const fileType = file.type || 'application/octet-stream'
    if (!ALLOWED_FILE_TYPES.includes(fileType)) {
      return NextResponse.json(
        {
          success: false,
          error: `File type ${fileType} not supported. Allowed: PDF, DOCX, TXT, MD`,
        },
        { status: 400 }
      )
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
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.PROFILE_NOT_FOUND },
        { status: 404 }
      )
    }

    // Check document limit
    const { count: existingCount } = await (supabase as KnowledgeClient)
      .from('knowledge_documents')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .is('deleted_at', null)

    if ((existingCount || 0) >= MAX_DOCUMENTS_PER_PROFILE) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.DOCUMENT_LIMIT_REACHED },
        { status: 400 }
      )
    }

    // Generate unique file path
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 9)
    const fileExt = file.name.split('.').pop() || 'bin'
    const fileName = `${user.id}/${profileId}/${timestamp}-${random}.${fileExt}`

    // Upload to storage
    const { error: uploadError, data: uploadData } = await supabase.storage
      .from('knowledge-documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { success: false, error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('knowledge-documents').getPublicUrl(fileName)

    // Parse doc purposes
    let purposes: string[] = []
    if (docPurposes) {
      try {
        purposes = JSON.parse(docPurposes)
      } catch {
        purposes = []
      }
    }

    // Create document record
    const { data: document, error: dbError } = await (supabase as KnowledgeClient)
      .from('knowledge_documents')
      .insert({
        user_id: user.id,
        profile_id: profileId,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        file_type: fileType,
        status: 'pending',
        doc_purpose: purposes,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database insertion error:', dbError)
      // Try to clean up uploaded file
      try {
        await supabase.storage.from('knowledge-documents').remove([fileName])
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError)
      }
      return NextResponse.json(
        { success: false, error: 'Failed to save document record' },
        { status: 500 }
      )
    }

    // Log to audit
    await (supabase as KnowledgeClient).from('knowledge_audit_log').insert({
      user_id: user.id,
      profile_id: profileId,
      action: 'create',
      entity_type: 'document',
      entity_id: document.id,
      new_value: { file_name: file.name, file_size: file.size, file_type: fileType },
    })

    return NextResponse.json({
      success: true,
      message: SUCCESS_MESSAGES.DOCUMENT_UPLOADED,
      document,
    })
  } catch (error) {
    console.error('POST /api/knowledge/documents error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload document',
      },
      { status: 500 }
    )
  }
}
