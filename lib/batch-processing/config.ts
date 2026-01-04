/**
 * Batch Processing Configuration
 * Rate limits, constraints, and defaults for batch prospect processing
 */

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Minimum delay between processing individual prospects (ms)
 * With parallel processing enabled, this is less critical
 */
export const MIN_DELAY_BETWEEN_PROSPECTS_MS = 500

/**
 * Default delay between prospects (ms)
 * Lower default since we now use parallel processing
 */
export const DEFAULT_DELAY_BETWEEN_PROSPECTS_MS = 1000

/**
 * Maximum delay between prospects (ms)
 * User can configure up to this value
 */
export const MAX_DELAY_BETWEEN_PROSPECTS_MS = 30000

/**
 * Concurrent processing limits by plan (for parallel batch endpoint)
 * These define how many prospects can be processed simultaneously
 */
export const CONCURRENT_LIMITS: Record<string, number> = {
  growth: 3,
  pro: 5,
  scale: 8,
}

export const DEFAULT_CONCURRENT_LIMIT = 3

// ============================================================================
// BATCH LIMITS
// ============================================================================

/**
 * Row limits per plan - EASILY CONFIGURABLE
 * Change these values to adjust how many rows each plan can process
 */
export const PLAN_ROW_LIMITS: Record<string, number> = {
  growth: 100,
  pro: 500,
  scale: 1000,
}

export const DEFAULT_PLAN_ROW_LIMIT = 10

/**
 * Maximum prospects per batch job
 * Prevents excessively long-running jobs
 */
export const MAX_PROSPECTS_PER_BATCH = 1000

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
 * Stale item detection threshold (ms)
 * Items in "processing" status for longer than this are considered stale
 * and will be retried.
 *
 * Set to 10 minutes because:
 * - LinkUp multi-query search: 5 parallel queries × ~15-30s each = ~30-60s
 * - AI report generation: ~15-30s
 * - Network variability: +30-60s
 * - Total: ~1.5-2.5 minutes per prospect normally
 * - With retries/delays: up to 5-7 minutes
 * - 10 minutes gives generous buffer for slow networks
 */
export const STALE_ITEM_THRESHOLD_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Maximum tokens for prospect report output
 */
export const MAX_REPORT_OUTPUT_TOKENS = 16000

// ============================================================================
// ESTIMATED TIME CALCULATIONS
// ============================================================================

/**
 * Estimated seconds per prospect for Sonar+Grok flow
 * - Sonar Reasoning Pro: ~15-20s for deep research
 * - Grok 4.1 Fast: ~5-10s for synthesis
 * Total: ~25-35s per prospect
 */
export const ESTIMATED_SECONDS_PER_PROSPECT_SONAR_GROK = 30

/**
 * Estimated seconds per prospect for Standard mode (legacy Grok-only)
 * - 2 focused web searches (business + property)
 * - Brief 5-line AI generation
 * Total: ~15-20s per prospect
 */
export const ESTIMATED_SECONDS_PER_PROSPECT_STANDARD = 20

/**
 * Estimated seconds per prospect for Comprehensive mode
 * - 5 parallel web searches
 * - Full AI report generation
 * Total: ~90-120s per prospect (using 105s midpoint)
 */
export const ESTIMATED_SECONDS_PER_PROSPECT_COMPREHENSIVE = 105

/**
 * Legacy constant for backwards compatibility
 * @deprecated Use ESTIMATED_SECONDS_PER_PROSPECT_SONAR_GROK
 */
export const ESTIMATED_SECONDS_PER_PROSPECT = 30

// ============================================================================
// COST ESTIMATES (per prospect)
// ============================================================================

/**
 * Cost per prospect using Sonar+Grok flow
 * Matches chat quality at ~10-20x lower cost than iWave/DonorSearch
 */
export const COST_PER_PROSPECT = {
  /** Sonar Reasoning Pro via OpenRouter (~$0.04) */
  sonarReasoningPro: 0.04,
  /** Grok 4.1 Fast for synthesis (~$0.003) */
  grokSynthesis: 0.003,
  /** Total cost per prospect */
  total: 0.043,
}

/**
 * Compare to competitors
 */
export const COMPETITOR_COST_PER_PROSPECT = {
  iWave: 0.75,      // $0.50-$1.00 range
  donorSearch: 0.75, // $0.50-$1.00 range
}

/**
 * Calculate estimated time remaining
 * Uses Sonar+Grok timing by default
 */
export function calculateEstimatedTimeRemaining(
  remainingProspects: number,
  delayMs: number = DEFAULT_DELAY_BETWEEN_PROSPECTS_MS
): number {
  const processingTimeMs = remainingProspects * ESTIMATED_SECONDS_PER_PROSPECT_SONAR_GROK * 1000
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
    /^person$/i,
    /^individual$/i,
    /^contact$/i,
    /^donor$/i,
    /^constituent$/i,
    /^owner$/i,
    /^owner[_\s-]?name$/i,
    /^resident$/i,
    /^client$/i,
    /^customer$/i,
    /^lead$/i,
    /name/i,  // Fallback: any column containing "name"
  ],
  address: [
    /^address$/i,
    /^street[_\s-]?address$/i,
    /^address[_\s-]?1$/i,
    /^street$/i,
    /^mailing[_\s-]?address$/i,
    /^property[_\s-]?address$/i,
    /^home[_\s-]?address$/i,
    /^residence$/i,
    /^location$/i,
    /address/i,  // Fallback: any column containing "address"
  ],
  city: [
    /^city$/i,
    /^town$/i,
    /^municipality$/i,
    /^locality$/i,
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
    /^postal$/i,
  ],
  full_address: [
    /^full[_\s-]?address$/i,
    /^complete[_\s-]?address$/i,
    /^mailing[_\s-]?address$/i,
    /^property[_\s-]?address$/i,
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

// ============================================================================
// ADDRESS NORMALIZATION
// ============================================================================

/**
 * Normalize a string value - return undefined for empty/null values
 */
export function normalizeString(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

/**
 * Normalize prospect address data to ensure consistency
 * This fixes the JSONB serialization issue where undefined values are lost
 */
export function normalizeProspectAddress<T extends {
  name?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  full_address?: string
  [key: string]: string | undefined
}>(prospect: T): T & {
  name: string
  address?: string
  city?: string
  state?: string
  zip?: string
  full_address?: string
} {
  const address = normalizeString(prospect.address)
  const city = normalizeString(prospect.city)
  const state = normalizeString(prospect.state)
  const zip = normalizeString(prospect.zip)

  // Construct full_address from components if not provided
  const components = [address, city, state, zip].filter(Boolean)
  const constructedFullAddress = components.length > 0 ? components.join(", ") : undefined
  const full_address = normalizeString(prospect.full_address) || constructedFullAddress

  return {
    ...prospect,
    name: normalizeString(prospect.name) || "",
    address,
    city,
    state,
    zip,
    full_address,
  } as T & {
    name: string
    address?: string
    city?: string
    state?: string
    zip?: string
    full_address?: string
  }
}

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

/**
 * Generate a hash for duplicate detection
 * Uses name + normalized address components
 */
export function generateProspectHash(prospect: {
  name?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  full_address?: string
}): string {
  const name = normalizeString(prospect.name)?.toLowerCase() || ""
  const address = normalizeString(prospect.address)?.toLowerCase() || ""
  const city = normalizeString(prospect.city)?.toLowerCase() || ""
  const state = normalizeString(prospect.state)?.toLowerCase() || ""
  const zip = normalizeString(prospect.zip)?.toLowerCase() || ""

  // Create a normalized key for duplicate detection
  // Using name + city + state as the primary key since address/zip may vary
  return `${name}|${city}|${state}`.replace(/\s+/g, " ").trim()
}

/**
 * Detect duplicates in a list of prospects
 * Returns indices of duplicate rows (keeps first occurrence)
 */
export function detectDuplicates(prospects: Array<{
  name?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  full_address?: string
}>): {
  duplicateIndices: number[]
  uniqueCount: number
  duplicateCount: number
  duplicateGroups: Map<string, number[]>
} {
  const seen = new Map<string, number>()
  const duplicateIndices: number[] = []
  const duplicateGroups = new Map<string, number[]>()

  prospects.forEach((prospect, index) => {
    const hash = generateProspectHash(prospect)

    if (seen.has(hash)) {
      duplicateIndices.push(index)
      const group = duplicateGroups.get(hash) || [seen.get(hash)!]
      group.push(index)
      duplicateGroups.set(hash, group)
    } else {
      seen.set(hash, index)
    }
  })

  return {
    duplicateIndices,
    uniqueCount: prospects.length - duplicateIndices.length,
    duplicateCount: duplicateIndices.length,
    duplicateGroups,
  }
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

export type BatchErrorCode =
  | "LINKUP_UNAVAILABLE"
  | "LINKUP_RATE_LIMITED"
  | "LINKUP_TIMEOUT"
  | "OPENROUTER_ERROR"
  | "OPENROUTER_RATE_LIMITED"
  | "INSUFFICIENT_ADDRESS"
  | "NETWORK_ERROR"
  | "DATABASE_ERROR"
  | "TIMEOUT"
  | "UNKNOWN_ERROR"

export interface ClassifiedError {
  code: BatchErrorCode
  message: string
  userMessage: string
  retryable: boolean
  retryAfterMs?: number
}

/**
 * Classify an error for better handling and user messaging
 */
export function classifyBatchError(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error)
  const lowerMessage = message.toLowerCase()

  // LinkUp errors
  if (lowerMessage.includes("linkup") || lowerMessage.includes("search api")) {
    if (lowerMessage.includes("rate limit") || lowerMessage.includes("429")) {
      return {
        code: "LINKUP_RATE_LIMITED",
        message,
        userMessage: "Search API rate limit reached. Will retry automatically.",
        retryable: true,
        retryAfterMs: 60000, // 1 minute
      }
    }
    if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
      return {
        code: "LINKUP_TIMEOUT",
        message,
        userMessage: "Search request timed out. Will retry automatically.",
        retryable: true,
        retryAfterMs: 5000,
      }
    }
    if (lowerMessage.includes("not configured") || lowerMessage.includes("not available")) {
      return {
        code: "LINKUP_UNAVAILABLE",
        message,
        userMessage: "Web search is not configured. Please check your API keys.",
        retryable: false,
      }
    }
  }

  // OpenRouter/AI errors
  if (lowerMessage.includes("openrouter") || lowerMessage.includes("<!doctype") || lowerMessage.includes("<html")) {
    if (lowerMessage.includes("rate limit") || lowerMessage.includes("429")) {
      return {
        code: "OPENROUTER_RATE_LIMITED",
        message,
        userMessage: "AI service rate limit reached. Will retry automatically.",
        retryable: true,
        retryAfterMs: 30000,
      }
    }
    return {
      code: "OPENROUTER_ERROR",
      message: "AI service returned an error",
      userMessage: "AI service temporarily unavailable. Will retry automatically.",
      retryable: true,
      retryAfterMs: 10000,
    }
  }

  // Network errors
  if (
    lowerMessage.includes("network") ||
    lowerMessage.includes("fetch") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("enotfound")
  ) {
    return {
      code: "NETWORK_ERROR",
      message,
      userMessage: "Network error occurred. Will retry automatically.",
      retryable: true,
      retryAfterMs: 5000,
    }
  }

  // Timeout errors
  if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
    return {
      code: "TIMEOUT",
      message,
      userMessage: "Request timed out. Will retry automatically.",
      retryable: true,
      retryAfterMs: 5000,
    }
  }

  // Database errors
  if (lowerMessage.includes("supabase") || lowerMessage.includes("database") || lowerMessage.includes("postgres")) {
    return {
      code: "DATABASE_ERROR",
      message,
      userMessage: "Database error occurred. Please try again.",
      retryable: true,
      retryAfterMs: 2000,
    }
  }

  // Unknown error
  return {
    code: "UNKNOWN_ERROR",
    message,
    userMessage: "An unexpected error occurred. Will retry automatically.",
    retryable: true,
    retryAfterMs: 5000,
  }
}

// ============================================================================
// ADDRESS QUALITY SCORING
// ============================================================================

export type AddressQuality = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT"

/**
 * Score address data quality for research effectiveness
 */
export function scoreAddressQuality(prospect: {
  name?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  full_address?: string
}): {
  quality: AddressQuality
  score: number
  maxScore: number
  missing: string[]
  warnings: string[]
} {
  const missing: string[] = []
  const warnings: string[] = []
  let score = 0
  const maxScore = 10

  // Name is critical (3 points)
  const name = normalizeString(prospect.name)
  if (name) {
    score += 3
    // Check for common name that might cause false matches
    const commonNames = ["john smith", "michael johnson", "david williams", "james brown"]
    if (commonNames.includes(name.toLowerCase())) {
      warnings.push("Common name may result in less accurate research")
    }
  } else {
    missing.push("name")
  }

  // Street address (2 points)
  if (normalizeString(prospect.address)) {
    score += 2
  } else if (!normalizeString(prospect.full_address)) {
    missing.push("street address")
  }

  // City (2 points)
  if (normalizeString(prospect.city)) {
    score += 2
  } else {
    missing.push("city")
  }

  // State (2 points)
  if (normalizeString(prospect.state)) {
    score += 2
  } else {
    missing.push("state")
  }

  // ZIP (1 point - nice to have)
  if (normalizeString(prospect.zip)) {
    score += 1
  }

  // Determine quality level
  let quality: AddressQuality
  if (score >= 8) {
    quality = "HIGH"
  } else if (score >= 5) {
    quality = "MEDIUM"
  } else if (score >= 3) {
    quality = "LOW"
    warnings.push("Limited address data may result in incomplete research")
  } else {
    quality = "INSUFFICIENT"
    warnings.push("Insufficient data for reliable research")
  }

  return { quality, score, maxScore, missing, warnings }
}
