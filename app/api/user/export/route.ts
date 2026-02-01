/**
 * GDPR Data Export API
 * POST /api/user/export
 *
 * Allows users to export their data in JSON format
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseEnabled } from '@/lib/supabase/config'
import { gatherExportData, estimateExportSize } from '@/lib/gdpr'
import type { ExportSection } from '@/lib/gdpr'
import {
  sendEmail,
  isEmailEnabled,
  getDataExportEmailHtml,
  getDataExportEmailSubject,
} from '@/lib/email'

// Rate limiting: 5 exports per hour
const exportRateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX = 5

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = exportRateLimit.get(userId)

  if (!userLimit || now > userLimit.resetAt) {
    exportRateLimit.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false
  }

  userLimit.count++
  return true
}

export async function POST(request: Request) {
  try {
    // Check if Supabase is enabled
    if (!isSupabaseEnabled) {
      return NextResponse.json(
        { success: false, error: 'Data export requires Supabase to be enabled' },
        { status: 400 }
      )
    }

    // Authenticate user
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database connection unavailable' },
        { status: 500 }
      )
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check rate limit
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. You can export up to 5 times per hour.',
        },
        { status: 429 }
      )
    }

    // Parse request body
    let body: { sections?: string[]; includeAttachments?: boolean } = {}
    try {
      body = await request.json()
    } catch {
      // Empty body defaults to all sections
      body = { sections: ['all'] }
    }

    // Validate sections
    const validSections: ExportSection[] = ['profile', 'preferences', 'chats', 'memories', 'crm', 'all']
    const requestedSections = body.sections || ['all']

    const sections = requestedSections.filter((s): s is ExportSection =>
      validSections.includes(s as ExportSection)
    )

    if (sections.length === 0) {
      sections.push('all')
    }

    const options = {
      sections,
      includeAttachments: body.includeAttachments || false,
    }

    // Estimate size for large export handling
    const estimatedSize = await estimateExportSize(supabase as any, user.id, options)

    // For now, we handle all exports inline (up to reasonable limits)
    // In production, exports > 5MB could be queued for background processing
    const MAX_INLINE_SIZE = 10 * 1024 * 1024 // 10MB

    if (estimatedSize > MAX_INLINE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: 'Your data export is too large. Please contact support for assistance.',
          estimatedSize,
        },
        { status: 413 }
      )
    }

    // Gather export data
    const exportData = await gatherExportData(supabase as any, user.id, options)

    // Send confirmation email (non-blocking)
    if (isEmailEnabled() && user.email) {
      // Get user's first name for personalization
      const { data: userData } = await supabase
        .from('users')
        .select('first_name')
        .eq('id', user.id)
        .single() as { data: any; error: any }

      const sectionsExported = sections.includes('all')
        ? ['profile', 'preferences', 'chats', 'memories', 'crm']
        : sections

      sendEmail({
        to: user.email,
        subject: getDataExportEmailSubject(),
        html: getDataExportEmailHtml({
          userName: userData?.first_name || 'there',
          exportDate: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          sectionsExported,
        }),
      }).catch((err) => {
        console.error('[Export] Failed to send confirmation email:', err)
      })
    }

    // Return as JSON
    return NextResponse.json({
      success: true,
      data: exportData,
      format: 'json',
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred while exporting your data. Please try again.',
      },
      { status: 500 }
    )
  }
}
