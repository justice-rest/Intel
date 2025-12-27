/**
 * GDPR Account Deletion API
 * DELETE /api/user/account
 *
 * Permanently deletes a user's account and all associated data
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createGuestServerClient } from '@/lib/supabase/server-guest'
import { isSupabaseEnabled } from '@/lib/supabase/config'
import {
  validateDeletionRequest,
  checkDeletionPrerequisites,
  getSubscriptionStatus,
  executeAccountDeletion,
  getDeletionSummary,
} from '@/lib/gdpr'
import type { DeletionRequest } from '@/lib/gdpr'
import {
  sendEmail,
  isEmailEnabled,
  getAccountDeletionEmailHtml,
  getAccountDeletionEmailSubject,
} from '@/lib/email'

// Rate limiting: 1 deletion attempt per 24 hours
const deletionRateLimit = new Map<string, number>()
const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000 // 24 hours

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const lastAttempt = deletionRateLimit.get(userId)

  if (lastAttempt && now - lastAttempt < RATE_LIMIT_WINDOW) {
    return false
  }

  deletionRateLimit.set(userId, now)
  return true
}

/**
 * GET /api/user/account
 * Get deletion summary (what will be deleted)
 */
export async function GET() {
  try {
    if (!isSupabaseEnabled) {
      return NextResponse.json(
        { success: false, error: 'Account management requires Supabase to be enabled' },
        { status: 400 }
      )
    }

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

    // Get deletion summary
    const summary = await getDeletionSummary(supabase, user.id)

    // Get subscription status
    const subscription = await getSubscriptionStatus(supabase, user.id)

    // Check prerequisites
    const prerequisites = await checkDeletionPrerequisites(supabase, user.id)

    return NextResponse.json({
      success: true,
      summary,
      subscription,
      canDelete: prerequisites.canProceed,
      blockers: prerequisites.blockers,
      warnings: prerequisites.warnings,
    })
  } catch (error) {
    console.error('Error getting deletion summary:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get account information' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/user/account
 * Permanently delete the user's account
 */
export async function DELETE(request: Request) {
  try {
    if (!isSupabaseEnabled) {
      return NextResponse.json(
        { success: false, error: 'Account deletion requires Supabase to be enabled' },
        { status: 400 }
      )
    }

    // Authenticate user
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database connection unavailable', code: 'DELETION_FAILED' },
        { status: 500 }
      )
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      )
    }

    // Check rate limit
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'You have already attempted to delete your account recently. Please try again later.',
        },
        { status: 429 }
      )
    }

    // Parse request body
    let body: DeletionRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          code: 'CONFIRMATION_MISMATCH',
        },
        { status: 400 }
      )
    }

    // Validate confirmation
    const validation = validateDeletionRequest(body)
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
          code: 'CONFIRMATION_MISMATCH',
        },
        { status: 400 }
      )
    }

    // Check prerequisites
    const prerequisites = await checkDeletionPrerequisites(supabase, user.id)
    if (!prerequisites.canProceed) {
      const blocker = prerequisites.blockers[0]
      return NextResponse.json(
        {
          success: false,
          error: blocker.message,
          code: blocker.code,
          details: blocker.details,
        },
        { status: 400 }
      )
    }

    // Get admin client for deletion operations
    const supabaseAdmin = await createGuestServerClient()
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Server configuration error. Please contact support.',
          code: 'DELETION_FAILED',
        },
        { status: 500 }
      )
    }

    // Get user info BEFORE deletion for farewell email
    let userEmail = user.email
    let userName = 'there'
    if (isEmailEnabled() && userEmail) {
      const { data: userData } = await supabase
        .from('users')
        .select('first_name, email')
        .eq('id', user.id)
        .single()

      if (userData) {
        userName = userData.first_name || 'there'
        userEmail = userData.email || user.email
      }
    }

    // Execute deletion
    const result = await executeAccountDeletion(supabaseAdmin, user.id, body.reason)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Deletion failed',
          code: result.code || 'DELETION_FAILED',
          details: result.details,
        },
        { status: 500 }
      )
    }

    // Clear rate limit entry (account is deleted)
    deletionRateLimit.delete(user.id)

    // Send farewell email (non-blocking, after successful deletion)
    if (isEmailEnabled() && userEmail) {
      sendEmail({
        to: userEmail,
        subject: getAccountDeletionEmailSubject(),
        html: getAccountDeletionEmailHtml({
          userName,
          deletionDate: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        }),
      }).catch((err) => {
        console.error('[Deletion] Failed to send farewell email:', err)
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Your account has been permanently deleted.',
      deletedAt: result.deletedAt,
    })
  } catch (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred. Please contact support.',
        code: 'DELETION_FAILED',
      },
      { status: 500 }
    )
  }
}
