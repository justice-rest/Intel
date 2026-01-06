/**
 * PDF Branding Utilities
 *
 * Validation and helper functions for PDF branding feature.
 */

import {
  HEX_COLOR_REGEX,
  MAX_FOOTER_TEXT_LENGTH,
  MAX_LOGO_SIZE_BYTES,
  ALLOWED_LOGO_TYPES,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_ACCENT_COLOR,
  type AllowedLogoType,
} from "./types"

// ============================================================================
// Color Validation
// ============================================================================

/**
 * Validate a hex color code
 * @param color - Color string to validate (e.g., "#FF5500")
 * @returns true if valid hex color
 */
export function isValidHexColor(color: string): boolean {
  if (!color || typeof color !== "string") {
    return false
  }
  return HEX_COLOR_REGEX.test(color)
}

/**
 * Sanitize a hex color code
 * @param color - Color string to sanitize
 * @param defaultColor - Fallback color if invalid
 * @returns Sanitized hex color or default
 */
export function sanitizeHexColor(
  color: string | null | undefined,
  defaultColor: string = DEFAULT_PRIMARY_COLOR
): string {
  if (!color) {
    return defaultColor
  }

  // Normalize to uppercase
  const normalized = color.trim().toUpperCase()

  // Add # if missing
  const withHash = normalized.startsWith("#") ? normalized : `#${normalized}`

  // Validate
  if (isValidHexColor(withHash)) {
    return withHash
  }

  return defaultColor
}

/**
 * Get contrast color (black or white) for a given background
 * @param hexColor - Background hex color
 * @returns "#000000" or "#FFFFFF" for best contrast
 */
export function getContrastColor(hexColor: string): string {
  // Remove # and parse
  const hex = hexColor.replace("#", "")
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  return luminance > 0.5 ? "#000000" : "#FFFFFF"
}

// ============================================================================
// Footer Text Validation
// ============================================================================

/**
 * Validate custom footer text
 * @param text - Footer text to validate
 * @returns Validation result with error message if invalid
 */
export function validateFooterText(
  text: string | null | undefined
): { isValid: boolean; error?: string } {
  if (!text) {
    return { isValid: true }
  }

  if (text.length > MAX_FOOTER_TEXT_LENGTH) {
    return {
      isValid: false,
      error: `Footer text must be ${MAX_FOOTER_TEXT_LENGTH} characters or less`,
    }
  }

  // Check for potentially dangerous content
  if (/<script|<iframe|javascript:/i.test(text)) {
    return {
      isValid: false,
      error: "Footer text contains invalid characters",
    }
  }

  return { isValid: true }
}

/**
 * Sanitize footer text for safe HTML rendering
 * @param text - Footer text to sanitize
 * @returns Sanitized text safe for HTML
 */
export function sanitizeFooterText(text: string | null | undefined): string | null {
  if (!text) {
    return null
  }

  // Trim and truncate
  let sanitized = text.trim().slice(0, MAX_FOOTER_TEXT_LENGTH)

  // Escape HTML special characters
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")

  return sanitized
}

// ============================================================================
// Logo Validation
// ============================================================================

/**
 * Validate logo file before upload
 * @param file - File to validate
 * @returns Validation result with error message if invalid
 */
export function validateLogoFile(
  file: File
): { isValid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    const maxMB = MAX_LOGO_SIZE_BYTES / (1024 * 1024)
    return {
      isValid: false,
      error: `Logo must be ${maxMB}MB or less`,
    }
  }

  // Check MIME type
  if (!ALLOWED_LOGO_TYPES.includes(file.type as AllowedLogoType)) {
    return {
      isValid: false,
      error: "Logo must be a PNG, JPG, or GIF image",
    }
  }

  return { isValid: true }
}

/**
 * Check if a MIME type is allowed for logo upload
 * @param mimeType - MIME type to check
 * @returns true if allowed
 */
export function isAllowedLogoType(mimeType: string): mimeType is AllowedLogoType {
  return ALLOWED_LOGO_TYPES.includes(mimeType as AllowedLogoType)
}

/**
 * Get file extension for a MIME type
 * @param mimeType - MIME type
 * @returns File extension (e.g., "png", "jpg")
 */
export function getExtensionForMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
  }
  return mimeToExt[mimeType] || "png"
}

// ============================================================================
// Branding Input Validation
// ============================================================================

/**
 * Validate branding settings input
 * @param input - Branding input to validate
 * @returns Validation result with errors by field
 */
export function validateBrandingInput(input: {
  primaryColor?: string
  accentColor?: string
  customFooterText?: string | null
}): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  // Validate primary color
  if (input.primaryColor !== undefined && !isValidHexColor(input.primaryColor)) {
    errors.primaryColor = "Invalid hex color format (e.g., #FF5500)"
  }

  // Validate accent color
  if (input.accentColor !== undefined && !isValidHexColor(input.accentColor)) {
    errors.accentColor = "Invalid hex color format (e.g., #FF5500)"
  }

  // Validate footer text
  if (input.customFooterText !== undefined && input.customFooterText !== null) {
    const footerValidation = validateFooterText(input.customFooterText)
    if (!footerValidation.isValid && footerValidation.error) {
      errors.customFooterText = footerValidation.error
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

// ============================================================================
// Storage Path Helpers
// ============================================================================

/**
 * Generate storage path for a user's logo
 * @param userId - User ID
 * @param extension - File extension
 * @returns Storage path (e.g., "user-id/logo-timestamp.png")
 */
export function generateLogoPath(userId: string, extension: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 9)
  return `${userId}/logo-${timestamp}-${random}.${extension}`
}

/**
 * Extract file path from a Supabase public URL
 * @param publicUrl - Full public URL
 * @returns File path for storage operations
 */
export function extractPathFromUrl(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl)
    const pathParts = url.pathname.split("/storage/v1/object/public/pdf-branding/")
    return pathParts[1] || null
  } catch {
    return null
  }
}

// ============================================================================
// Default Color Exports
// ============================================================================

export { DEFAULT_PRIMARY_COLOR, DEFAULT_ACCENT_COLOR }
