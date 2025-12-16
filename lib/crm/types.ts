/**
 * CRM Integration Types
 * Type definitions for Bloomerang and Virtuous CRM integrations
 */

// ============================================================================
// PROVIDER TYPES
// ============================================================================

export type CRMProvider = "bloomerang" | "virtuous"

export interface CRMProviderConfig {
  id: CRMProvider
  name: string
  icon: React.ComponentType<{ className?: string }>
  baseUrl: string
  placeholder: string // API key placeholder
  getKeyUrl: string // URL to get API key
  authHeader: "X-API-Key" | "Authorization" // Header name for auth
  authPrefix?: string // e.g., 'Bearer ' for Authorization header
  description: string
}

// ============================================================================
// CONNECTION STATUS
// ============================================================================

export type ConnectionStatus = "disconnected" | "connected" | "error" | "syncing"

export interface CRMConnectionStatus {
  provider: CRMProvider
  status: ConnectionStatus
  lastSync?: string
  recordCount?: number
  errorMessage?: string
  organizationName?: string
}

// ============================================================================
// CONSTITUENT (NORMALIZED)
// ============================================================================

export interface NormalizedConstituent {
  id: string
  externalId: string
  provider: CRMProvider

  // Name
  firstName?: string
  lastName?: string
  fullName: string

  // Contact
  email?: string
  phone?: string

  // Address
  streetAddress?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string

  // Giving summary
  totalLifetimeGiving?: number
  largestGift?: number
  lastGiftAmount?: number
  lastGiftDate?: string
  firstGiftDate?: string
  giftCount?: number

  // Custom
  customFields?: Record<string, unknown>

  // Metadata
  syncedAt: string
}

// ============================================================================
// DONATION (NORMALIZED)
// ============================================================================

export interface NormalizedDonation {
  id: string
  externalId: string
  provider: CRMProvider
  constituentExternalId: string

  amount: number
  donationDate?: string
  donationType?: string
  campaignName?: string
  fundName?: string
  paymentMethod?: string
  status?: string
  notes?: string

  customFields?: Record<string, unknown>
  syncedAt: string
}

// ============================================================================
// SYNC TYPES
// ============================================================================

export type SyncType = "full" | "incremental"
export type SyncStatus = "pending" | "in_progress" | "completed" | "failed"

export interface SyncLog {
  id: string
  userId: string
  provider: CRMProvider
  syncType: SyncType
  status: SyncStatus
  recordsSynced: number
  recordsFailed: number
  startedAt: string
  completedAt?: string
  errorMessage?: string
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface SaveCRMKeyRequest {
  provider: CRMProvider
  apiKey: string
}

export interface SaveCRMKeyResponse {
  success: boolean
  isNewKey: boolean
  message: string
  organizationName?: string
}

export interface ValidateKeyRequest {
  apiKey: string
}

export interface ValidateKeyResponse {
  valid: boolean
  organizationName?: string
  errorMessage?: string
}

export interface SyncTriggerResponse {
  success: boolean
  syncId?: string
  message: string
}

export interface CRMIntegrationStatus {
  provider: CRMProvider
  connected: boolean
  lastSync?: string
  recordCount?: number
  organizationName?: string
}

export interface CRMIntegrationsListResponse {
  integrations: CRMIntegrationStatus[]
}

// ============================================================================
// CRM SEARCH TYPES
// ============================================================================

export interface CRMSearchParams {
  query: string
  provider?: CRMProvider | "all"
  limit?: number
}

export interface CRMSearchResult {
  constituents: NormalizedConstituent[]
  totalCount: number
  providers: CRMProvider[]
}

// ============================================================================
// DATABASE ROW TYPES (matching Supabase schema)
// ============================================================================

export interface CRMConstituentRow {
  id: string
  user_id: string
  provider: string
  external_id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  street_address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  total_lifetime_giving: number | null
  largest_gift: number | null
  last_gift_amount: number | null
  last_gift_date: string | null
  first_gift_date: string | null
  gift_count: number | null
  custom_fields: Record<string, unknown>
  raw_data: Record<string, unknown>
  synced_at: string
  created_at: string
  updated_at: string
}

export interface CRMDonationRow {
  id: string
  user_id: string
  provider: string
  external_id: string
  constituent_external_id: string
  amount: number
  donation_date: string | null
  donation_type: string | null
  campaign_name: string | null
  fund_name: string | null
  payment_method: string | null
  status: string | null
  notes: string | null
  custom_fields: Record<string, unknown>
  raw_data: Record<string, unknown>
  synced_at: string
  created_at: string
}

export interface CRMSyncLogRow {
  id: string
  user_id: string
  provider: string
  sync_type: string
  status: string
  records_synced: number
  records_failed: number
  started_at: string
  completed_at: string | null
  error_message: string | null
  metadata: Record<string, unknown>
  created_at: string
}
