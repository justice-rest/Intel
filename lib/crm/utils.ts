/**
 * CRM Utility Functions
 * Shared utilities for retry logic, rate limiting, and error handling
 */

import { CRM_API_CONFIG } from "./config"

// ============================================================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF
// ============================================================================

export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  shouldRetry?: (error: Error, attempt: number) => boolean
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: CRM_API_CONFIG.maxRetries,
  initialDelay: CRM_API_CONFIG.retryDelay,
  maxDelay: 30000, // Max 30 seconds between retries
  shouldRetry: (error: Error) => {
    // Retry on network errors, timeouts, and 5xx errors
    const message = error.message.toLowerCase()
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("fetch failed") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504") ||
      message.includes("rate limit")
    )
  },
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on last attempt
      if (attempt > opts.maxRetries) {
        break
      }

      // Check if we should retry this error
      if (!opts.shouldRetry(lastError, attempt)) {
        throw lastError
      }

      // Calculate delay with exponential backoff and jitter
      const baseDelay = opts.initialDelay * Math.pow(2, attempt - 1)
      const jitter = Math.random() * 0.3 * baseDelay // 0-30% jitter
      const delay = Math.min(baseDelay + jitter, opts.maxDelay)

      console.warn(
        `[CRM] Retry attempt ${attempt}/${opts.maxRetries} after ${Math.round(delay)}ms: ${lastError.message}`
      )

      await sleep(delay)
    }
  }

  throw lastError
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Simple rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private tokens: number
  private lastRefill: number
  private readonly maxTokens: number
  private readonly refillRate: number // tokens per second

  constructor(maxTokens: number = 100, refillRate: number = 10) {
    this.maxTokens = maxTokens
    this.tokens = maxTokens
    this.refillRate = refillRate
    this.lastRefill = Date.now()
  }

  async acquire(): Promise<void> {
    this.refill()

    if (this.tokens <= 0) {
      // Wait for a token
      const waitTime = (1 / this.refillRate) * 1000
      await sleep(waitTime)
      this.refill()
    }

    this.tokens--
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000
    const newTokens = elapsed * this.refillRate
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens)
    this.lastRefill = now
  }
}

// ============================================================================
// PAGINATION SAFETY
// ============================================================================

export interface PaginationSafetyLimits {
  maxIterations: number
  maxRecords: number
  maxEmptyBatches: number
}

export const PAGINATION_LIMITS: PaginationSafetyLimits = {
  maxIterations: 1000, // Maximum number of API calls per sync
  maxRecords: 50000, // Maximum records to sync (matches CRM_SYNC_CONFIG.maxRecordsPerUser)
  maxEmptyBatches: 10, // Stop after this many consecutive empty batches
}

/**
 * Check if pagination should continue
 */
export function shouldContinuePagination(
  recordsFetched: number,
  iterationCount: number,
  consecutiveEmptyBatches: number,
  limits: PaginationSafetyLimits = PAGINATION_LIMITS
): { continue: boolean; reason?: string } {
  if (iterationCount >= limits.maxIterations) {
    return { continue: false, reason: `Maximum iterations reached (${limits.maxIterations})` }
  }

  if (recordsFetched >= limits.maxRecords) {
    return { continue: false, reason: `Maximum records reached (${limits.maxRecords})` }
  }

  if (consecutiveEmptyBatches >= limits.maxEmptyBatches) {
    return { continue: false, reason: `Too many consecutive empty batches (${limits.maxEmptyBatches})` }
  }

  return { continue: true }
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Safely parse a number, returning undefined for invalid values
 */
export function safeParseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined
  }

  const num = typeof value === "number" ? value : parseFloat(String(value))

  if (isNaN(num) || !isFinite(num)) {
    return undefined
  }

  return num
}

/**
 * Safely parse a positive number (for IDs, amounts)
 */
export function safeParsePositiveNumber(value: unknown): number | undefined {
  const num = safeParseNumber(value)
  return num !== undefined && num >= 0 ? num : undefined
}

/**
 * Safely get max ID from an array of objects
 */
export function safeMaxId<T>(
  items: T[],
  idExtractor: (item: T) => number | undefined,
  fallback: number = 0
): number {
  if (!items || items.length === 0) {
    return fallback
  }

  const ids = items
    .map(idExtractor)
    .filter((id): id is number => id !== undefined && id >= 0)

  if (ids.length === 0) {
    return fallback
  }

  return Math.max(...ids)
}

/**
 * Validate a string is non-empty after trimming
 */
export function isValidString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

/**
 * Safely create an external ID, ensuring it's never undefined/null
 */
export function safeExternalId(id: unknown, prefix: string): string {
  if (id === null || id === undefined || id === "") {
    console.warn(`[CRM] Missing external ID, generating fallback`)
    return `${prefix}-unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
  return String(id)
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Parse date string with validation
 * Supports: ISO 8601, MM/DD/YYYY, YYYY-MM-DD
 */
export function safeParseDate(dateStr: unknown): string | undefined {
  if (!dateStr || typeof dateStr !== "string") {
    return undefined
  }

  const trimmed = dateStr.trim()
  if (!trimmed) {
    return undefined
  }

  // Try ISO format first (YYYY-MM-DD or full ISO)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const date = new Date(trimmed)
    if (!isNaN(date.getTime())) {
      return trimmed.slice(0, 10) // Return just the date portion
    }
  }

  // Try MM/DD/YYYY format
  const parts = trimmed.split("/")
  if (parts.length === 3) {
    const [month, day, year] = parts.map((p) => parseInt(p, 10))

    if (
      !isNaN(month) && !isNaN(day) && !isNaN(year) &&
      month >= 1 && month <= 12 &&
      day >= 1 && day <= 31 &&
      year >= 1900 && year <= 2100
    ) {
      return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
    }
  }

  // Return original if unparseable (might be a valid format we don't handle)
  console.warn(`[CRM] Unparseable date format: ${trimmed}`)
  return trimmed
}

// ============================================================================
// HELPERS
// ============================================================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Truncate string to max length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + "..."
}

/**
 * Create a sanitized error message (no sensitive data)
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Remove any potential API keys or sensitive data
    return error.message
      .replace(/apikey=[^&\s]+/gi, "apikey=[REDACTED]")
      .replace(/key=[^&\s]+/gi, "key=[REDACTED]")
      .replace(/authorization:\s*\S+/gi, "Authorization: [REDACTED]")
  }
  return "Unknown error"
}
