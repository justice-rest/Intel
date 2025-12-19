/**
 * Input Validation Module
 *
 * Validates and sanitizes user inputs for scraper operations.
 * Prevents injection attacks and ensures data quality.
 */

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  sanitized?: string
  error?: string
}

/**
 * Valid US state codes (all 50 states + DC)
 */
export const VALID_STATE_CODES = new Set([
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "dc", "fl",
  "ga", "hi", "id", "il", "in", "ia", "ks", "ky", "la", "me",
  "md", "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh",
  "nj", "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri",
  "sc", "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy"
])

/**
 * Characters that could be dangerous in search queries
 */
const DANGEROUS_CHARS = /[<>"'`\\;(){}[\]]/g

/**
 * Validate and sanitize a search query
 */
export function validateSearchQuery(query: string): ValidationResult {
  // Check for empty/missing query
  if (!query || typeof query !== "string") {
    return {
      valid: false,
      error: "Query is required",
    }
  }

  // Trim whitespace
  const trimmed = query.trim()

  // Check minimum length
  if (trimmed.length < 2) {
    return {
      valid: false,
      error: "Query must be at least 2 characters",
    }
  }

  // Check maximum length
  if (trimmed.length > 200) {
    return {
      valid: false,
      error: "Query too long (max 200 characters)",
    }
  }

  // Sanitize: remove dangerous characters
  const sanitized = trimmed.replace(DANGEROUS_CHARS, "")

  // Check if query is still meaningful after sanitization
  if (sanitized.length < 2) {
    return {
      valid: false,
      error: "Query contains too many invalid characters",
    }
  }

  return {
    valid: true,
    sanitized,
  }
}

/**
 * Validate state code
 */
export function validateStateCode(code: string): ValidationResult {
  if (!code || typeof code !== "string") {
    return {
      valid: false,
      error: "State code is required",
    }
  }

  const normalized = code.toLowerCase().trim()

  if (!VALID_STATE_CODES.has(normalized)) {
    return {
      valid: false,
      error: `Invalid state code: ${code}. Must be a valid 2-letter US state code.`,
    }
  }

  return {
    valid: true,
    sanitized: normalized,
  }
}

/**
 * Validate array of state codes
 */
export function validateStateCodes(codes: string[]): {
  valid: boolean
  validCodes: string[]
  invalidCodes: string[]
  error?: string
} {
  if (!Array.isArray(codes)) {
    return {
      valid: false,
      validCodes: [],
      invalidCodes: [],
      error: "State codes must be an array",
    }
  }

  const validCodes: string[] = []
  const invalidCodes: string[] = []

  for (const code of codes) {
    const result = validateStateCode(code)
    if (result.valid && result.sanitized) {
      validCodes.push(result.sanitized)
    } else {
      invalidCodes.push(code)
    }
  }

  return {
    valid: invalidCodes.length === 0,
    validCodes,
    invalidCodes,
    error: invalidCodes.length > 0
      ? `Invalid state codes: ${invalidCodes.join(", ")}`
      : undefined,
  }
}

/**
 * Validate limit parameter
 */
export function validateLimit(limit: unknown, max: number = 100): {
  valid: boolean
  value: number
  error?: string
} {
  // Default value
  if (limit === undefined || limit === null) {
    return { valid: true, value: 25 }
  }

  const num = typeof limit === "string" ? parseInt(limit, 10) : Number(limit)

  if (isNaN(num) || !Number.isInteger(num)) {
    return {
      valid: false,
      value: 25,
      error: "Limit must be a valid integer",
    }
  }

  if (num < 1) {
    return {
      valid: false,
      value: 25,
      error: "Limit must be at least 1",
    }
  }

  if (num > max) {
    return {
      valid: true,
      value: max,
      error: `Limit capped at maximum of ${max}`,
    }
  }

  return { valid: true, value: num }
}

/**
 * Validate URL
 */
export function validateUrl(url: string): ValidationResult {
  if (!url || typeof url !== "string") {
    return {
      valid: false,
      error: "URL is required",
    }
  }

  try {
    const parsed = new URL(url)

    // Only allow http and https
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return {
        valid: false,
        error: "URL must use http or https protocol",
      }
    }

    return {
      valid: true,
      sanitized: parsed.href,
    }
  } catch {
    return {
      valid: false,
      error: "Invalid URL format",
    }
  }
}

/**
 * Validate entity number/ID
 */
export function validateEntityNumber(entityNumber: string): ValidationResult {
  if (!entityNumber || typeof entityNumber !== "string") {
    return {
      valid: false,
      error: "Entity number is required",
    }
  }

  const trimmed = entityNumber.trim()

  // Entity numbers are typically alphanumeric with possible dashes
  const sanitized = trimmed.replace(/[^a-zA-Z0-9-]/g, "")

  if (sanitized.length === 0) {
    return {
      valid: false,
      error: "Entity number contains only invalid characters",
    }
  }

  if (sanitized.length > 50) {
    return {
      valid: false,
      error: "Entity number too long (max 50 characters)",
    }
  }

  return {
    valid: true,
    sanitized,
  }
}

/**
 * Sanitize string for URL encoding
 */
export function sanitizeForUrl(input: string): string {
  // Remove dangerous characters and encode
  const sanitized = input
    .replace(DANGEROUS_CHARS, "")
    .trim()

  return encodeURIComponent(sanitized)
}

/**
 * Sanitize string for SQL (for Socrata SoQL queries)
 */
export function sanitizeForSoql(input: string): string {
  // Escape single quotes (SoQL uses '' for escaped quotes)
  return input.replace(/'/g, "''")
}

/**
 * Check if a value looks like an email (to avoid scraping emails)
 */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Check if a value looks like a phone number
 */
export function looksLikePhone(value: string): boolean {
  // Matches common phone formats
  return /^[\d\s\-().\+]+$/.test(value) && value.replace(/\D/g, "").length >= 10
}

/**
 * Check if a value looks like a credit card number (to avoid storing sensitive data)
 */
export function looksLikeCreditCard(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 13 && digits.length <= 19 && /^\d+$/.test(digits)
}

/**
 * Redact potentially sensitive information from a string
 */
export function redactSensitive(value: string): string {
  let result = value

  // Redact emails
  result = result.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[EMAIL REDACTED]")

  // Redact phone numbers (simple pattern)
  result = result.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE REDACTED]")

  // Redact SSN-like patterns
  result = result.replace(/\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, "[SSN REDACTED]")

  return result
}
