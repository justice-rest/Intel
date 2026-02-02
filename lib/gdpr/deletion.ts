/**
 * GDPR Account Deletion
 * Complete user data deletion with subscription handling
 */

import { deleteUserStorageFiles } from './storage-cleanup'
import type {
  DeletionRequest,
  DeletionResult,
  DeletionPreCheck,
  SubscriptionStatus,
} from './types'

// Use a more flexible type to handle tables not in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any

const CONFIRMATION_STRING = 'DELETE MY ACCOUNT'

/**
 * Validate deletion request confirmation
 */
export function validateDeletionRequest(request: DeletionRequest): {
  valid: boolean
  error?: string
} {
  if (!request.confirmation) {
    return { valid: false, error: 'Confirmation is required' }
  }

  if (request.confirmation !== CONFIRMATION_STRING) {
    return { valid: false, error: `Please type "${CONFIRMATION_STRING}" exactly to confirm` }
  }

  return { valid: true }
}

/**
 * Pre-check if account can be deleted
 * Returns blockers and warnings
 */
export async function checkDeletionPrerequisites(
  supabase: AnySupabaseClient,
  userId: string
): Promise<DeletionPreCheck> {
  const warnings: string[] = []
  const blockers: DeletionPreCheck['blockers'] = []

  // Check for pending batch jobs
  const { data: pendingJobs, count: jobCount } = await supabase
    .from('batch_prospect_jobs')
    .select('id, name, status', { count: 'exact' })
    .eq('user_id', userId)
    .in('status', ['pending', 'processing'])

  if (jobCount && jobCount > 0) {
    blockers.push({
      code: 'PENDING_BATCH_JOBS',
      message: `You have ${jobCount} pending batch job(s). Please wait for them to complete before deleting your account.`,
      details: { pendingJobs: pendingJobs?.map((j: any) => ({ id: j.id, name: j.name, status: j.status })) },
    })
  }

  // Check for active CRM sync
  const { data: activeSync } = await supabase
    .from('crm_sync_logs')
    .select('id, provider')
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .limit(1)
    .single()

  if (activeSync) {
    blockers.push({
      code: 'ACTIVE_CRM_SYNC',
      message: `A CRM sync is currently in progress (${activeSync.provider}). Please wait for it to complete.`,
    })
  }

  return {
    canProceed: blockers.length === 0,
    warnings,
    blockers,
  }
}

/**
 * Get user's subscription status for deletion handling
 */
export async function getSubscriptionStatus(
  supabase: AnySupabaseClient,
  userId: string
): Promise<SubscriptionStatus> {
  const { data: user } = await supabase
    .from('users')
    .select('subscription_status, subscription_tier')
    .eq('id', userId)
    .single()

  if (!user || !user.subscription_status) {
    return {
      hasSubscription: false,
      status: null,
      tier: null,
      willBeCanceled: false,
    }
  }

  const activeStatuses = ['active', 'trialing']
  const hasActiveSubscription = activeStatuses.includes(user.subscription_status)

  return {
    hasSubscription: !!user.subscription_status,
    status: user.subscription_status as SubscriptionStatus['status'],
    tier: user.subscription_tier,
    willBeCanceled: hasActiveSubscription,
  }
}

/**
 * Cancel subscription via Autumn (if active)
 * This is called before account deletion
 */
async function cancelSubscriptionIfNeeded(userId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Import Autumn client dynamically to avoid circular dependencies
    const { cancelSubscription } = await import('@/lib/subscription/autumn-client')

    const result = await cancelSubscription(userId)

    if (!result.success) {
      console.warn('Subscription cancellation warning:', result.error)
      // We'll proceed with deletion even if cancellation fails
      // The subscription will eventually expire on its own
    }

    return { success: true }
  } catch (error) {
    console.error('Error canceling subscription:', error)
    // Non-blocking - proceed with deletion
    return { success: true }
  }
}

/**
 * Revoke Google OAuth tokens if connected
 */
async function revokeGoogleOAuthIfNeeded(
  supabaseAdmin: AnySupabaseClient,
  userId: string
): Promise<void> {
  try {
    // Check if user has Google OAuth tokens
    const { data: tokens } = await supabaseAdmin
      .from('google_oauth_tokens')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (!tokens) {
      return // No Google integration
    }

    // Try to revoke via the token manager
    try {
      const { revokeTokens, deleteTokens } = await import('@/lib/google/oauth/token-manager')
      await revokeTokens(userId)
      await deleteTokens(userId)
    } catch {
      // If revocation fails, the tokens will still be deleted with the user record
      console.warn('Could not revoke Google OAuth tokens, they will be deleted with user')
    }
  } catch {
    // Non-blocking - tokens will be deleted via CASCADE
  }
}

/**
 * Execute complete account deletion
 * This is the main deletion function that orchestrates everything
 */
export async function executeAccountDeletion(
  supabaseAdmin: AnySupabaseClient,
  userId: string,
  reason?: string
): Promise<DeletionResult> {
  const deletedAt = new Date().toISOString()

  try {
    // Step 1: Cancel subscription if needed
    await cancelSubscriptionIfNeeded(userId)

    // Step 2: Revoke Google OAuth if connected
    await revokeGoogleOAuthIfNeeded(supabaseAdmin, userId)

    // Step 3: Delete storage bucket files (not auto-cascaded)
    const storageResults = await deleteUserStorageFiles(supabaseAdmin, userId)
    const storageErrors = storageResults.filter(r => !r.success)
    if (storageErrors.length > 0) {
      console.warn('Some storage cleanup errors (non-blocking):', storageErrors)
    }

    // Step 4: Log deletion for audit (before deleting user)
    await logAccountDeletion(supabaseAdmin, userId, reason, deletedAt)

    // Step 5: Sign out all sessions
    try {
      await supabaseAdmin.auth.admin.signOut(userId, 'global')
    } catch (error) {
      console.warn('Could not sign out all sessions:', error)
      // Non-blocking - continue with deletion
    }

    // Step 6: Delete from users table (CASCADE handles all related tables)
    const { error: deleteUserError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId)

    if (deleteUserError) {
      console.error('Error deleting user record:', deleteUserError)
      return {
        success: false,
        error: 'Failed to delete user data. Please contact support.',
        code: 'DELETION_FAILED',
        details: { step: 'delete_user_record', error: deleteUserError.message },
      }
    }

    // Step 7: Delete from auth.users (requires admin client)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError)
      // User data is already deleted, but auth record remains
      // This is a partial success - log for manual cleanup
      return {
        success: true, // Data is deleted, which is the GDPR requirement
        deletedAt,
        details: { warning: 'Auth record cleanup may be needed' },
      }
    }

    return {
      success: true,
      deletedAt,
    }
  } catch (error) {
    console.error('Unexpected error during account deletion:', error)
    return {
      success: false,
      error: 'An unexpected error occurred. Please contact support.',
      code: 'DELETION_FAILED',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    }
  }
}

/**
 * Log account deletion for compliance audit
 * Stores minimal info needed for audit trail
 */
async function logAccountDeletion(
  supabaseAdmin: AnySupabaseClient,
  userId: string,
  reason?: string,
  deletedAt?: string
): Promise<void> {
  try {
    // Get minimal user info for audit before deletion
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email, created_at')
      .eq('id', userId)
      .single()

    // Log to a separate audit table or external service
    // For now, we'll just console log (in production, this should go to an audit service)
    console.info('GDPR Account Deletion Audit Log:', {
      userId,
      userEmail: user?.email ? `${user.email.substring(0, 3)}***` : 'unknown', // Partially masked
      accountCreatedAt: user?.created_at,
      deletedAt: deletedAt || new Date().toISOString(),
      reason: reason || 'Not provided',
      timestamp: new Date().toISOString(),
    })
  } catch {
    // Audit logging should never block deletion
  }
}

/**
 * Get summary of what will be deleted
 * Useful for showing in confirmation dialog
 */
export async function getDeletionSummary(
  supabase: AnySupabaseClient,
  userId: string
): Promise<{
  chatCount: number
  messageCount: number
  memoryCount: number
  fileCount: number
  crmConstituentCount: number
}> {
  const [
    { count: chatCount },
    { count: messageCount },
    { count: memoryCount },
    { count: fileCount },
    { count: crmConstituentCount },
  ] = await Promise.all([
    supabase.from('chats').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_memories').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('chat_attachments').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('crm_constituents').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  return {
    chatCount: chatCount || 0,
    messageCount: messageCount || 0,
    memoryCount: memoryCount || 0,
    fileCount: fileCount || 0,
    crmConstituentCount: crmConstituentCount || 0,
  }
}
