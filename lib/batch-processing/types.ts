/**
 * Batch Processing Types
 * Type definitions for batch prospect processing system
 */

// ============================================================================
// STATUS TYPES
// ============================================================================

export type BatchJobStatus =
  | "pending"
  | "processing"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"

export type BatchItemStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "skipped"

// ============================================================================
// PROSPECT INPUT DATA
// ============================================================================

/**
 * Core prospect fields that we recognize and normalize
 */
export interface ProspectInputData {
  // Required fields
  name: string

  // Address fields (at least one required for research)
  address?: string
  city?: string
  state?: string
  zip?: string
  full_address?: string

  // Optional enrichment fields
  email?: string
  phone?: string
  company?: string
  title?: string
  notes?: string

  // Catch-all for custom columns
  [key: string]: string | undefined
}

/**
 * Column mapping configuration
 * Maps CSV column headers to our normalized field names
 */
export interface ColumnMapping {
  name: string | null  // Required - column containing prospect name
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  full_address?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  title?: string | null
  notes?: string | null
}

// ============================================================================
// BATCH JOB
// ============================================================================

export interface BatchJobSettings {
  delay_between_prospects_ms: number
  enable_web_search: boolean
  max_retries: number
  generate_romy_score: boolean
}

export const DEFAULT_BATCH_SETTINGS: BatchJobSettings = {
  delay_between_prospects_ms: 3000,
  enable_web_search: true,
  max_retries: 2,
  generate_romy_score: true,
}

export interface BatchProspectJob {
  id: string
  user_id: string
  name: string
  description?: string
  status: BatchJobStatus

  // Progress
  total_prospects: number
  completed_count: number
  failed_count: number
  skipped_count: number

  // Source file
  source_file_name?: string
  source_file_url?: string
  source_file_size?: number

  // Configuration
  column_mapping?: ColumnMapping
  settings: BatchJobSettings

  // Timestamps
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string

  // Error tracking
  error_message?: string
  last_error_at?: string
}

// ============================================================================
// BATCH ITEM
// ============================================================================

export interface BatchProspectItem {
  id: string
  job_id: string
  user_id: string

  // Position and status
  item_index: number
  status: BatchItemStatus

  // Input data
  input_data: ProspectInputData

  // Normalized fields (for querying)
  prospect_name?: string
  prospect_address?: string
  prospect_city?: string
  prospect_state?: string
  prospect_zip?: string

  // Generated report
  report_content?: string
  report_format?: "markdown" | "html"

  // Extracted metrics
  romy_score?: number
  romy_score_tier?: string
  capacity_rating?: string
  estimated_net_worth?: number
  estimated_gift_capacity?: number
  recommended_ask?: number

  // Search data
  search_queries_used?: string[]
  sources_found?: Array<{ name: string; url: string }>

  // Processing metadata
  processing_started_at?: string
  processing_completed_at?: string
  processing_duration_ms?: number
  tokens_used?: number
  model_used?: string

  // Error handling
  error_message?: string
  retry_count: number
  last_retry_at?: string

  // Timestamps
  created_at: string
  updated_at: string
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateBatchJobRequest {
  name: string
  description?: string
  prospects: ProspectInputData[]
  column_mapping?: ColumnMapping
  settings?: Partial<BatchJobSettings>
  source_file_name?: string
  source_file_size?: number
}

export interface CreateBatchJobResponse {
  job: BatchProspectJob
  items_created: number
  message: string
}

export interface BatchJobListResponse {
  jobs: BatchProspectJob[]
  total: number
}

export interface BatchJobDetailResponse {
  job: BatchProspectJob
  items: BatchProspectItem[]
  progress: {
    percentage: number
    estimated_remaining_ms?: number
  }
}

export interface ProcessNextItemRequest {
  job_id: string
}

export interface ProcessNextItemResponse {
  item?: BatchProspectItem
  job_status: BatchJobStatus
  progress: {
    completed: number
    total: number
    failed: number
  }
  has_more: boolean
  message: string
}

// ============================================================================
// PARSED FILE RESULT
// ============================================================================

export interface ParsedFileResult {
  success: boolean
  rows: Record<string, string>[]
  columns: string[]
  total_rows: number
  errors: string[]
  suggested_mapping: Partial<ColumnMapping>
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type ExportFormat = "csv" | "pdf" | "json"

export interface ExportRequest {
  job_id: string
  format: ExportFormat
  include_full_reports?: boolean
  include_failed?: boolean
}

export interface ExportResponse {
  success: boolean
  download_url?: string
  file_name?: string
  error?: string
}
