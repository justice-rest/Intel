import posthog from 'posthog-js'

/**
 * PostHog Event Tracking Helpers
 * Centralized functions for tracking user actions and events in Rōmy
 */

/**
 * Check if PostHog is available and initialized
 */
export function isPostHogAvailable(): boolean {
  return typeof window !== 'undefined' && !!posthog && !!process.env.NEXT_PUBLIC_POSTHOG_KEY
}

/**
 * Identify a user in PostHog
 * Call this when a user logs in or their identity is confirmed
 */
export function identifyUser(userId: string, properties?: Record<string, any>) {
  if (!isPostHogAvailable()) return

  posthog.identify(userId, properties)
}

/**
 * Reset user identity (call on logout)
 */
export function resetUser() {
  if (!isPostHogAvailable()) return

  posthog.reset()
}

/**
 * Track a custom event
 */
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (!isPostHogAvailable()) return

  posthog.capture(eventName, properties)
}

// ============================================================================
// Chat Events
// ============================================================================

export function trackChatCreated(chatId: string, model: string) {
  trackEvent('chat_created', {
    chat_id: chatId,
    model,
  })
}

export function trackMessageSent(params: {
  chatId: string
  model: string
  hasAttachments: boolean
  attachmentCount?: number
  hasSearch: boolean
}) {
  trackEvent('message_sent', {
    chat_id: params.chatId,
    model: params.model,
    has_attachments: params.hasAttachments,
    attachment_count: params.attachmentCount || 0,
    has_search: params.hasSearch,
  })
}

export function trackMessageReceived(params: {
  chatId: string
  model: string
  responseTime: number
  hasToolInvocations: boolean
  hasSources: boolean
}) {
  trackEvent('message_received', {
    chat_id: params.chatId,
    model: params.model,
    response_time_ms: params.responseTime,
    has_tool_invocations: params.hasToolInvocations,
    has_sources: params.hasSources,
  })
}

export function trackChatDeleted(chatId: string) {
  trackEvent('chat_deleted', {
    chat_id: chatId,
  })
}

export function trackChatPinned(chatId: string, pinned: boolean) {
  trackEvent('chat_pinned', {
    chat_id: chatId,
    pinned,
  })
}

// ============================================================================
// Model Events
// ============================================================================

export function trackModelSelected(model: string) {
  trackEvent('model_selected', {
    model,
  })
}

export function trackModelSwitched(params: {
  chatId: string
  fromModel: string
  toModel: string
}) {
  trackEvent('model_switched', {
    chat_id: params.chatId,
    from_model: params.fromModel,
    to_model: params.toModel,
  })
}

// ============================================================================
// Settings Events
// ============================================================================

export function trackApiKeyAdded(provider: string) {
  trackEvent('api_key_added', {
    provider,
  })
}

export function trackApiKeyRemoved(provider: string) {
  trackEvent('api_key_removed', {
    provider,
  })
}

export function trackSettingsChanged(setting: string, value: any) {
  trackEvent('settings_changed', {
    setting,
    value,
  })
}

// ============================================================================
// File Upload Events
// ============================================================================

export function trackFileUploaded(params: {
  chatId: string
  fileType: string
  fileSize: number
}) {
  trackEvent('file_uploaded', {
    chat_id: params.chatId,
    file_type: params.fileType,
    file_size_bytes: params.fileSize,
  })
}

export function trackFileUploadFailed(params: {
  chatId: string
  error: string
}) {
  trackEvent('file_upload_failed', {
    chat_id: params.chatId,
    error: params.error,
  })
}

// ============================================================================
// Search Events
// ============================================================================

export function trackSearchToggled(enabled: boolean) {
  trackEvent('search_toggled', {
    enabled,
  })
}

export function trackSearchUsed(params: {
  chatId: string
  model: string
  resultCount: number
}) {
  trackEvent('search_used', {
    chat_id: params.chatId,
    model: params.model,
    result_count: params.resultCount,
  })
}

// ============================================================================
// Authentication Events
// ============================================================================

export function trackUserSignedIn(method: string) {
  trackEvent('user_signed_in', {
    method,
  })
}

export function trackUserSignedOut() {
  trackEvent('user_signed_out')
}

// ============================================================================
// Error Events
// ============================================================================

export function trackError(params: {
  error: string
  errorType: string
  context?: string
}) {
  trackEvent('error_occurred', {
    error: params.error,
    error_type: params.errorType,
    context: params.context,
  })
}

// ============================================================================
// Feature Usage Events
// ============================================================================

export function trackFeatureUsed(featureName: string, properties?: Record<string, any>) {
  trackEvent('feature_used', {
    feature: featureName,
    ...properties,
  })
}

export function trackShareChat(chatId: string) {
  trackEvent('chat_shared', {
    chat_id: chatId,
  })
}

export function trackProjectCreated(projectId: string) {
  trackEvent('project_created', {
    project_id: projectId,
  })
}

// ============================================================================
// Subscription Events
// ============================================================================

export function trackSubscriptionStarted(plan: string) {
  trackEvent('subscription_started', {
    plan,
  })
}

export function trackSubscriptionCancelled(plan: string) {
  trackEvent('subscription_cancelled', {
    plan,
  })
}

export function trackSubscriptionUpgraded(params: {
  fromPlan: string
  toPlan: string
}) {
  trackEvent('subscription_upgraded', {
    from_plan: params.fromPlan,
    to_plan: params.toPlan,
  })
}
