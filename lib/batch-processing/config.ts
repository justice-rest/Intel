/**
 * Batch Processing Configuration
 * Rate limits, constraints, and defaults for batch prospect processing
 */

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Minimum delay between processing individual prospects (ms)
 * This prevents hitting API rate limits for Linkup (10 QPS) and OpenRouter
 */
export const MIN_DELAY_BETWEEN_PROSPECTS_MS = 2000

/**
 * Default delay between prospects (ms)
 * Conservative default to ensure stability
 */
export const DEFAULT_DELAY_BETWEEN_PROSPECTS_MS = 3000

/**
 * Maximum delay between prospects (ms)
 * User can configure up to this value
 */
export const MAX_DELAY_BETWEEN_PROSPECTS_MS = 30000

// ============================================================================
// BATCH LIMITS
// ============================================================================

/**
 * Maximum prospects per batch job
 * Prevents excessively long-running jobs
 */
export const MAX_PROSPECTS_PER_BATCH = 500

/**
 * Minimum prospects for a batch (below this, use individual chat)
 */
export const MIN_PROSPECTS_FOR_BATCH = 2

/**
 * Maximum concurrent batch jobs per user
 * Prevents resource hogging
 */
export const MAX_CONCURRENT_JOBS_PER_USER = 3

/**
 * Maximum file size for CSV/Excel upload (10MB)
 */
export const MAX_BATCH_FILE_SIZE = 10 * 1024 * 1024

// ============================================================================
// PROCESSING LIMITS
// ============================================================================

/**
 * Maximum retries per prospect before marking as failed
 */
export const MAX_RETRIES_PER_PROSPECT = 3

/**
 * Timeout for individual prospect processing (ms)
 * Includes web searches + AI generation
 */
export const PROSPECT_PROCESSING_TIMEOUT_MS = 120000 // 2 minutes

/**
 * Maximum tokens for prospect report output
 */
export const MAX_REPORT_OUTPUT_TOKENS = 16000

// ============================================================================
// ESTIMATED TIME CALCULATIONS
// ============================================================================

/**
 * Estimated seconds per prospect (for progress UI)
 * Based on: web searches (30-60s) + AI generation (30-60s) + buffer
 */
export const ESTIMATED_SECONDS_PER_PROSPECT = 90

/**
 * Calculate estimated time remaining
 */
export function calculateEstimatedTimeRemaining(
  remainingProspects: number,
  delayMs: number = DEFAULT_DELAY_BETWEEN_PROSPECTS_MS
): number {
  const processingTimeMs = remainingProspects * ESTIMATED_SECONDS_PER_PROSPECT * 1000
  const delayTimeMs = remainingProspects * delayMs
  return processingTimeMs + delayTimeMs
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds}s`
}

// ============================================================================
// COLUMN DETECTION
// ============================================================================

/**
 * Common column name variations for auto-detection
 */
export const COLUMN_NAME_PATTERNS: Record<string, RegExp[]> = {
  name: [
    /^name$/i,
    /^full[_\s-]?name$/i,
    /^prospect[_\s-]?name$/i,
    /^donor[_\s-]?name$/i,
    /^contact[_\s-]?name$/i,
    /^first[_\s-]?name$/i,  // Will need to combine with last_name
  ],
  address: [
    /^address$/i,
    /^street[_\s-]?address$/i,
    /^address[_\s-]?1$/i,
    /^street$/i,
    /^mailing[_\s-]?address$/i,
  ],
  city: [
    /^city$/i,
    /^town$/i,
    /^municipality$/i,
  ],
  state: [
    /^state$/i,
    /^province$/i,
    /^st$/i,
    /^region$/i,
  ],
  zip: [
    /^zip$/i,
    /^zip[_\s-]?code$/i,
    /^postal[_\s-]?code$/i,
    /^postcode$/i,
  ],
  full_address: [
    /^full[_\s-]?address$/i,
    /^complete[_\s-]?address$/i,
    /^mailing[_\s-]?address$/i,
  ],
  email: [
    /^email$/i,
    /^e[_\s-]?mail$/i,
    /^email[_\s-]?address$/i,
  ],
  phone: [
    /^phone$/i,
    /^telephone$/i,
    /^mobile$/i,
    /^cell$/i,
    /^phone[_\s-]?number$/i,
  ],
  company: [
    /^company$/i,
    /^organization$/i,
    /^employer$/i,
    /^business$/i,
    /^org$/i,
  ],
  title: [
    /^title$/i,
    /^job[_\s-]?title$/i,
    /^position$/i,
    /^role$/i,
  ],
  notes: [
    /^notes$/i,
    /^comments$/i,
    /^remarks$/i,
    /^additional[_\s-]?info$/i,
  ],
}

/**
 * Detect column mapping from headers
 */
export function detectColumnMapping(
  headers: string[]
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {}

  for (const [field, patterns] of Object.entries(COLUMN_NAME_PATTERNS)) {
    for (const header of headers) {
      for (const pattern of patterns) {
        if (pattern.test(header.trim())) {
          mapping[field] = header
          break
        }
      }
      if (mapping[field]) break
    }
    if (!mapping[field]) {
      mapping[field] = null
    }
  }

  return mapping
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Minimum required fields for a valid prospect
 */
export function validateProspectData(
  data: Record<string, string | undefined>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Name is required
  if (!data.name?.trim()) {
    errors.push("Name is required")
  }

  // At least one address component is required
  const hasAddress = !!(
    data.address?.trim() ||
    data.full_address?.trim() ||
    (data.city?.trim() && data.state?.trim())
  )

  if (!hasAddress) {
    errors.push("Address information is required (address, city/state, or full_address)")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// ============================================================================
// ALLOWED FILE TYPES
// ============================================================================

export const ALLOWED_BATCH_FILE_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/csv",
  ".csv",
  ".xlsx",
  ".xls",
] as const

export const ALLOWED_BATCH_EXTENSIONS = [".csv", ".xlsx", ".xls"]
