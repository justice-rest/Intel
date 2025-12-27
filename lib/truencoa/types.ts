/**
 * TrueNCOA API Types
 * Type definitions for TrueNCOA address validation integration
 *
 * API Documentation: https://truencoa.com/postman-documentation
 * Endpoints:
 *   - Testing: https://api.testing.truencoa.com
 *   - Production: https://api.truencoa.com
 */

// ============================================================================
// AUTHENTICATION
// ============================================================================

export interface TrueNCOACredentials {
  id: string // API id or email
  key: string // API key or password
}

export interface TrueNCOAAuthResponse {
  success: boolean
  token?: string
  userId?: string
  error?: string
}

// ============================================================================
// FILE/BATCH TYPES
// ============================================================================

export interface TrueNCOACreateFileRequest {
  file_name: string
  notification_email?: string
}

export interface TrueNCOAFile {
  id: string
  file_name: string
  status: TrueNCOAFileStatus
  record_count?: number
  created_at: string
  completed_at?: string
  summary?: TrueNCOAFileSummary
  error_message?: string
}

export type TrueNCOAFileStatus =
  | "pending"      // File created but not uploaded
  | "uploaded"     // Records uploaded, waiting to process
  | "processing"   // NCOA matching in progress
  | "complete"     // Processing finished
  | "error"        // Processing failed

export interface TrueNCOAFileSummary {
  total_records: number
  matched: number      // Records with NCOA match found
  unmatched: number    // No match in NCOA database
  moved: number        // Person has moved (new address available)
  forwardable: number  // Mail can be forwarded
  vacant: number       // Address is vacant
  invalid: number      // Invalid/undeliverable address
  valid: number        // Valid, deliverable address
  ncoa_link?: number   // NCOA Link (person found at address)
  cass_corrected: number // CASS/DPV corrected addresses
}

// ============================================================================
// ADDRESS RECORDS
// ============================================================================

export interface TrueNCOAInputRecord {
  id?: string // Optional unique ID for tracking
  full_name?: string
  first_name?: string
  last_name?: string
  company?: string
  address1: string
  address2?: string
  city: string
  state: string
  zip: string
}

export interface TrueNCOAOutputRecord {
  // Input fields (preserved)
  id?: string
  original_full_name?: string
  original_first_name?: string
  original_last_name?: string
  original_company?: string
  original_address1: string
  original_address2?: string
  original_city: string
  original_state: string
  original_zip: string

  // NCOA Results
  ncoa_action_code: TrueNCOAActionCode
  ncoa_move_type?: TrueNCOAMoveType
  ncoa_move_date?: string // MM/YYYY format
  ncoa_move_effective_date?: string

  // New Address (if moved)
  new_address1?: string
  new_address2?: string
  new_city?: string
  new_state?: string
  new_zip?: string
  new_zip4?: string

  // CASS/DPV Standardized Address
  cass_address1?: string
  cass_address2?: string
  cass_city?: string
  cass_state?: string
  cass_zip?: string
  cass_zip4?: string

  // DPV Indicators
  dpv_indicator: TrueNCOADPVIndicator
  dpv_footnotes?: string
  residential_indicator?: "Y" | "N" | "" // Y = Residential, N = Commercial

  // Processing Status
  error_code?: string
  error_message?: string
}

// ============================================================================
// NCOA CODES
// ============================================================================

/**
 * NCOA Action Codes - What happened during NCOA processing
 */
export type TrueNCOAActionCode =
  | "A"  // COA Match (new address found)
  | "91" // Secondary number dropped from COA
  | "92" // No NCOA match, ZIP+4 corrected
  | "N"  // No move found
  | "F"  // Found to be forwardable
  | ""   // No action taken

/**
 * Move Types - Type of address change
 */
export type TrueNCOAMoveType =
  | "I"  // Individual move (single person)
  | "F"  // Family move (entire household)
  | "B"  // Business move
  | ""   // Not a move

/**
 * DPV (Delivery Point Validation) Indicators
 */
export type TrueNCOADPVIndicator =
  | "Y"  // Confirmed deliverable
  | "D"  // Primary number confirmed, secondary not
  | "S"  // Secondary number confirmed (e.g., apartment)
  | "N"  // Not confirmed / undeliverable
  | ""   // DPV not performed

// ============================================================================
// VALIDATION SUMMARY (FREE TIER)
// ============================================================================

/**
 * Validation summary - Available in FREE tier
 * Full results require $20/file payment
 */
export interface TrueNCOAValidationSummary {
  file_id: string
  file_name: string
  status: "complete" | "processing" | "error"

  // Record counts
  total_records: number

  // NCOA Results (counts)
  ncoa_matches: number       // Records with confirmed moves
  ncoa_no_match: number      // No move found

  // Address Quality (counts)
  deliverable: number        // Valid, deliverable addresses
  undeliverable: number      // Invalid addresses
  vacant: number             // Vacant addresses

  // Move Details (counts)
  individual_moves: number   // Single person moved
  family_moves: number       // Family moved
  business_moves: number     // Business moved

  // Corrections (counts)
  cass_corrected: number     // Addresses standardized by CASS
  dpv_confirmed: number      // Confirmed by DPV

  // Percentages (calculated)
  deliverability_rate: number // 0-100
  move_rate: number          // 0-100
  correction_rate: number    // 0-100

  // Processing info
  processed_at?: string
  processing_time_seconds?: number
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface TrueNCOAAPIError {
  error: boolean
  message: string
  code?: string
  details?: Record<string, unknown>
}

export interface TrueNCOAUploadResponse {
  success: boolean
  file_id?: string
  records_uploaded?: number
  error?: string
}

export interface TrueNCOAStatusResponse {
  success: boolean
  file?: TrueNCOAFile
  error?: string
}

export interface TrueNCOASummaryResponse {
  success: boolean
  summary?: TrueNCOAValidationSummary
  error?: string
}

// ============================================================================
// BATCH RESEARCH INTEGRATION
// ============================================================================

export interface BatchAddressValidationRequest {
  prospects: BatchProspectAddress[]
  options?: {
    include_cass?: boolean // Include CASS/DPV standardization
    include_ncoa?: boolean // Include NCOA move checking
    skip_on_error?: boolean // Continue even if some addresses fail
  }
}

export interface BatchProspectAddress {
  id: string // Prospect ID from batch job
  name?: string
  address1: string
  address2?: string
  city: string
  state: string
  zip: string
}

export interface BatchAddressValidationResult {
  id: string // Original prospect ID
  status: "valid" | "moved" | "vacant" | "invalid" | "unknown"

  // Original address
  original_address: {
    address1: string
    address2?: string
    city: string
    state: string
    zip: string
  }

  // Corrected/standardized address (if different)
  corrected_address?: {
    address1: string
    address2?: string
    city: string
    state: string
    zip: string
    zip4?: string
  }

  // New address if person moved
  new_address?: {
    address1: string
    address2?: string
    city: string
    state: string
    zip: string
    zip4?: string
    move_date?: string
    move_type?: "individual" | "family" | "business"
  }

  // Metadata
  is_deliverable: boolean
  is_residential?: boolean
  confidence: number // 0-100
  flags: string[] // e.g., ["cass_corrected", "dpv_confirmed", "ncoa_match"]
}

export interface BatchAddressValidationResponse {
  success: boolean
  file_id: string
  summary: TrueNCOAValidationSummary
  results: BatchAddressValidationResult[]
  errors?: { id: string; message: string }[]
}
