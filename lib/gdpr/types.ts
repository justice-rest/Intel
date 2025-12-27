/**
 * GDPR Compliance Types
 * Types for data export and account deletion functionality
 */

// Export section options
export type ExportSection =
  | 'profile'
  | 'preferences'
  | 'chats'
  | 'memories'
  | 'crm'
  | 'all'

export interface ExportOptions {
  sections: ExportSection[]
  includeAttachments?: boolean
}

// Exported data structure (human-readable, no internal IDs)
export interface ExportData {
  exportVersion: '1.0'
  generatedAt: string
  requestedSections: ExportSection[]

  profile?: {
    email: string
    displayName: string | null
    firstName: string | null
    createdAt: string
    systemPrompt: string | null
    welcomeCompleted: boolean
  }

  preferences?: {
    layout: string
    promptSuggestions: boolean
    showToolInvocations: boolean
    showConversationPreviews: boolean
    hiddenModels: string[]
    favoriteModels: string[]
  }

  chats?: ExportChat[]

  memories?: ExportMemory[]

  crmData?: {
    connectedProviders: string[]
    constituents: ExportConstituent[]
    donations: ExportDonation[]
    lastSyncAt: string | null
  }
}

export interface ExportChat {
  title: string | null
  model: string | null
  systemPrompt: string | null
  pinned: boolean
  createdAt: string
  updatedAt: string
  messages: ExportMessage[]
}

export interface ExportMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  model: string | null
  createdAt: string
  attachments?: ExportAttachment[]
}

export interface ExportAttachment {
  fileName: string
  fileType: string
  fileSize: number
  // URL only included if includeAttachments is true and we're generating a ZIP
}

export interface ExportMemory {
  content: string
  category: string | null
  importance: number
  memoryType: 'explicit' | 'automatic'
  createdAt: string
  lastAccessedAt: string | null
}

export interface ExportConstituent {
  provider: string
  externalId: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  totalGiving: number | null
  lastGiftDate: string | null
  lastGiftAmount: number | null
  createdAt: string
}

export interface ExportDonation {
  provider: string
  amount: number
  currency: string
  date: string
  type: string | null
  fund: string | null
  campaign: string | null
  createdAt: string
}

// Deletion types
export interface DeletionRequest {
  confirmation: string
  reason?: string
}

export interface DeletionResult {
  success: boolean
  deletedAt?: string
  error?: string
  code?: DeletionErrorCode
  details?: Record<string, unknown>
}

export type DeletionErrorCode =
  | 'AUTH_REQUIRED'
  | 'CONFIRMATION_MISMATCH'
  | 'PENDING_BATCH_JOBS'
  | 'ACTIVE_CRM_SYNC'
  | 'DELETION_FAILED'
  | 'SUBSCRIPTION_CANCEL_FAILED'

export interface DeletionPreCheck {
  canProceed: boolean
  warnings: string[]
  blockers: Array<{
    code: DeletionErrorCode
    message: string
    details?: Record<string, unknown>
  }>
}

// Subscription status for deletion handling
export interface SubscriptionStatus {
  hasSubscription: boolean
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'expired' | null
  tier: string | null
  willBeCanceled: boolean
}
