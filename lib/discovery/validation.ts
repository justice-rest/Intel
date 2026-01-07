/**
 * Discovery Input Validation
 *
 * Comprehensive validation and sanitization for discovery requests.
 * Follows OWASP guidelines for input handling.
 *
 * @module lib/discovery/validation
 */

import {
  type DiscoveryRequest,
  type DiscoveryFocusArea,
  DEFAULT_DISCOVERY_CONFIG,
} from "./types"

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export interface ValidationResult {
  valid: boolean
  errors: string[]
  sanitized?: DiscoveryRequest
}

export interface PromptValidationResult {
  valid: boolean
  errors: string[]
  sanitizedPrompt?: string
}

// ============================================================================
// SANITIZATION
// ============================================================================

/**
 * Sanitize user input string
 * Removes potentially dangerous content while preserving legitimate text
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") {
    return ""
  }

  return (
    input
      // Remove null bytes
      .replace(/\0/g, "")
      // Remove script tags and event handlers
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/on\w+\s*=/gi, "")
      // Remove javascript: and data: protocols
      .replace(/javascript:/gi, "")
      .replace(/data:/gi, "")
      // Remove HTML tags but keep content
      .replace(/<[^>]*>/g, "")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      // Trim
      .trim()
  )
}

/**
 * Sanitize prompt specifically
 * More permissive than general sanitization to allow complex queries
 */
export function sanitizePrompt(prompt: string): string {
  if (typeof prompt !== "string") {
    return ""
  }

  return (
    prompt
      // Remove null bytes
      .replace(/\0/g, "")
      // Remove script tags
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      // Remove javascript: protocol
      .replace(/javascript:/gi, "")
      // Normalize excessive whitespace but preserve structure
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      // Trim
      .trim()
  )
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate discovery request prompt
 */
export function validatePrompt(prompt: unknown): PromptValidationResult {
  const errors: string[] = []

  // Type check
  if (typeof prompt !== "string") {
    return {
      valid: false,
      errors: ["Prompt must be a string"],
    }
  }

  // Sanitize
  const sanitized = sanitizePrompt(prompt)

  // Length validation
  if (sanitized.length < DEFAULT_DISCOVERY_CONFIG.minPromptLength) {
    errors.push(
      `Prompt must be at least ${DEFAULT_DISCOVERY_CONFIG.minPromptLength} characters`
    )
  }

  if (sanitized.length > DEFAULT_DISCOVERY_CONFIG.maxPromptLength) {
    errors.push(
      `Prompt must be less than ${DEFAULT_DISCOVERY_CONFIG.maxPromptLength} characters`
    )
  }

  // Content validation - must contain meaningful search terms
  const wordCount = sanitized.split(/\s+/).filter((w) => w.length > 2).length
  if (wordCount < 3) {
    errors.push("Prompt must contain at least 3 meaningful words")
  }

  // Check for obviously invalid prompts
  const invalidPatterns = [
    /^[^a-zA-Z]*$/, // No letters at all
    /^(test|testing|hello|hi|hey)\s*$/i, // Common test inputs
  ]

  for (const pattern of invalidPatterns) {
    if (pattern.test(sanitized)) {
      errors.push("Please enter a valid search description")
      break
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedPrompt: errors.length === 0 ? sanitized : undefined,
  }
}

/**
 * Validate max results parameter
 * @param maxResults - The max results value to validate
 * @param isDeepResearch - If true, allows lower minimum (1 instead of 5)
 */
export function validateMaxResults(
  maxResults: unknown,
  isDeepResearch = false
): { valid: boolean; errors: string[]; value: number } {
  const errors: string[] = []
  // Deep Research defaults to 5, regular defaults to configured default
  const defaultValue = isDeepResearch ? 5 : DEFAULT_DISCOVERY_CONFIG.defaultResults
  let value = defaultValue

  if (maxResults === undefined || maxResults === null) {
    // Use default
    return { valid: true, errors: [], value }
  }

  // Parse number
  const parsed = typeof maxResults === "number" ? maxResults : parseInt(String(maxResults), 10)

  if (isNaN(parsed)) {
    errors.push("Max results must be a number")
    return { valid: false, errors, value }
  }

  // Deep Research allows minimum of 1, regular requires minResultsLimit (5)
  const minLimit = isDeepResearch ? 1 : DEFAULT_DISCOVERY_CONFIG.minResultsLimit
  // Deep Research max is 5, regular uses maxResultsLimit
  const maxLimit = isDeepResearch ? 5 : DEFAULT_DISCOVERY_CONFIG.maxResultsLimit

  // Range validation
  if (parsed < minLimit) {
    errors.push(`Max results must be at least ${minLimit}`)
    value = minLimit
  } else if (parsed > maxLimit) {
    errors.push(`Max results cannot exceed ${maxLimit}`)
    value = maxLimit
  } else {
    value = parsed
  }

  return {
    valid: errors.length === 0,
    errors,
    value,
  }
}

/**
 * Validate focus areas array
 */
export function validateFocusAreas(
  focusAreas: unknown
): { valid: boolean; errors: string[]; value: DiscoveryFocusArea[] | undefined } {
  if (focusAreas === undefined || focusAreas === null) {
    return { valid: true, errors: [], value: undefined }
  }

  if (!Array.isArray(focusAreas)) {
    return {
      valid: false,
      errors: ["Focus areas must be an array"],
      value: undefined,
    }
  }

  const validAreas: DiscoveryFocusArea[] = [
    "real_estate",
    "business",
    "philanthropy",
    "securities",
    "biography",
  ]

  const errors: string[] = []
  const validated: DiscoveryFocusArea[] = []

  for (const area of focusAreas) {
    if (typeof area === "string" && validAreas.includes(area as DiscoveryFocusArea)) {
      validated.push(area as DiscoveryFocusArea)
    } else {
      errors.push(`Invalid focus area: ${area}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    value: validated.length > 0 ? validated : undefined,
  }
}

/**
 * Validate location object
 */
export function validateLocation(
  location: unknown
): {
  valid: boolean
  errors: string[]
  value: { city?: string; state?: string; region?: string } | undefined
} {
  if (location === undefined || location === null) {
    return { valid: true, errors: [], value: undefined }
  }

  if (typeof location !== "object") {
    return {
      valid: false,
      errors: ["Location must be an object"],
      value: undefined,
    }
  }

  const loc = location as Record<string, unknown>
  const errors: string[] = []
  const value: { city?: string; state?: string; region?: string } = {}

  // Validate city
  if (loc.city !== undefined) {
    if (typeof loc.city !== "string") {
      errors.push("City must be a string")
    } else {
      const sanitizedCity = sanitizeInput(loc.city)
      if (sanitizedCity.length > 100) {
        errors.push("City must be less than 100 characters")
      } else if (sanitizedCity) {
        value.city = sanitizedCity
      }
    }
  }

  // Validate state
  if (loc.state !== undefined) {
    if (typeof loc.state !== "string") {
      errors.push("State must be a string")
    } else {
      const sanitizedState = sanitizeInput(loc.state)
      if (sanitizedState.length > 50) {
        errors.push("State must be less than 50 characters")
      } else if (sanitizedState) {
        value.state = sanitizedState
      }
    }
  }

  // Validate region
  if (loc.region !== undefined) {
    if (typeof loc.region !== "string") {
      errors.push("Region must be a string")
    } else {
      const sanitizedRegion = sanitizeInput(loc.region)
      if (sanitizedRegion.length > 100) {
        errors.push("Region must be less than 100 characters")
      } else if (sanitizedRegion) {
        value.region = sanitizedRegion
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    value: Object.keys(value).length > 0 ? value : undefined,
  }
}

/**
 * Validate template ID
 */
export function validateTemplateId(
  templateId: unknown
): { valid: boolean; errors: string[]; value: string | undefined } {
  if (templateId === undefined || templateId === null) {
    return { valid: true, errors: [], value: undefined }
  }

  if (typeof templateId !== "string") {
    return {
      valid: false,
      errors: ["Template ID must be a string"],
      value: undefined,
    }
  }

  // Sanitize and validate format
  const sanitized = sanitizeInput(templateId)

  // Template IDs should be alphanumeric with hyphens
  if (!/^[a-z0-9-]+$/.test(sanitized)) {
    return {
      valid: false,
      errors: ["Invalid template ID format"],
      value: undefined,
    }
  }

  if (sanitized.length > 50) {
    return {
      valid: false,
      errors: ["Template ID too long"],
      value: undefined,
    }
  }

  return {
    valid: true,
    errors: [],
    value: sanitized,
  }
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validate complete discovery request
 *
 * @param body - Raw request body
 * @returns Validation result with sanitized request if valid
 */
export function validateDiscoveryRequest(body: unknown): ValidationResult {
  const errors: string[] = []

  // Check body is object
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      errors: ["Request body must be an object"],
    }
  }

  const data = body as Record<string, unknown>

  // Check if deep research mode (affects validation limits)
  const isDeepResearch = data.deepResearch === true

  // Validate prompt (required)
  const promptResult = validatePrompt(data.prompt)
  if (!promptResult.valid) {
    errors.push(...promptResult.errors)
  }

  // Validate maxResults (optional) - pass deepResearch flag for adjusted limits
  const maxResultsResult = validateMaxResults(data.maxResults, isDeepResearch)
  if (!maxResultsResult.valid) {
    errors.push(...maxResultsResult.errors)
  }

  // Validate templateId (optional)
  const templateIdResult = validateTemplateId(data.templateId)
  if (!templateIdResult.valid) {
    errors.push(...templateIdResult.errors)
  }

  // Validate location (optional)
  const locationResult = validateLocation(data.location)
  if (!locationResult.valid) {
    errors.push(...locationResult.errors)
  }

  // Validate focusAreas (optional)
  const focusAreasResult = validateFocusAreas(data.focusAreas)
  if (!focusAreasResult.valid) {
    errors.push(...focusAreasResult.errors)
  }

  // Return result
  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    }
  }

  // Build sanitized request
  const sanitized: DiscoveryRequest = {
    prompt: promptResult.sanitizedPrompt!,
    maxResults: maxResultsResult.value,
  }

  if (templateIdResult.value) {
    sanitized.templateId = templateIdResult.value
  }

  if (locationResult.value) {
    sanitized.location = locationResult.value
  }

  if (focusAreasResult.value) {
    sanitized.focusAreas = focusAreasResult.value
  }

  // Pass through deepResearch flag
  if (isDeepResearch) {
    sanitized.deepResearch = true
  }

  return {
    valid: true,
    errors: [],
    sanitized,
  }
}

// ============================================================================
// RATE LIMITING HELPERS
// ============================================================================

/**
 * Rate limit key for discovery
 */
export function getDiscoveryRateLimitKey(userId: string): string {
  return `discovery:rate:${userId}`
}

/**
 * Check if rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.toLowerCase().includes("rate limit") ||
      error.message.includes("429")
    )
  }
  return false
}

// ============================================================================
// PROSPECT NAME VALIDATION
// ============================================================================

/**
 * Validate if a string is a valid person name
 */
export function isValidPersonName(name: string): boolean {
  if (!name || typeof name !== "string") {
    return false
  }

  const trimmed = name.trim()

  // Must have at least 2 parts (first and last name)
  const parts = trimmed.split(/\s+/)
  if (parts.length < 2) {
    return false
  }

  // Each part must be at least 2 characters
  if (parts.some((p) => p.length < 2)) {
    return false
  }

  // Must contain only letters, hyphens, apostrophes, and spaces
  if (!/^[A-Za-z\s\-']+$/.test(trimmed)) {
    return false
  }

  // Must start with capital letters (real names are capitalized)
  if (!/^[A-Z]/.test(trimmed)) {
    return false
  }

  // Filter out common false positives
  const invalidNames = [
    "the company",
    "this person",
    "john doe",
    "jane doe",
    "test user",
    "no name",
    "not available",
    "not found",
    "unknown person",
  ]

  if (invalidNames.includes(trimmed.toLowerCase())) {
    return false
  }

  // Reasonable length
  if (trimmed.length < 4 || trimmed.length > 100) {
    return false
  }

  return true
}

/**
 * Normalize a person name for deduplication
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
}
