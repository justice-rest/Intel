/**
 * PDF Branding Types
 *
 * Type definitions for PDF branding customization feature.
 * Available to Pro & Scale plan users.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * PDF Branding settings as stored in database
 */
export interface PdfBranding {
  id: string
  userId: string
  primaryColor: string
  accentColor: string
  logoUrl: string | null
  logoBase64: string | null
  logoContentType: string | null
  hideDefaultFooter: boolean
  customFooterText: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Input for creating/updating branding settings (without logo)
 */
export interface PdfBrandingInput {
  primaryColor?: string
  accentColor?: string
  hideDefaultFooter?: boolean
  customFooterText?: string | null
}

/**
 * Branding settings used by PDF generator
 */
export interface BrandingSettings {
  primaryColor: string
  accentColor: string
  logoBase64: string | null // null = use default Romy logo
  hideDefaultFooter: boolean
  customFooterText: string | null
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * API response format (snake_case from database)
 */
export interface PdfBrandingApiResponse {
  id: string
  user_id: string
  primary_color: string
  accent_color: string
  logo_url: string | null
  logo_base64: string | null
  logo_content_type: string | null
  hide_default_footer: boolean
  custom_footer_text: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default branding values (Romy brand colors)
 */
export const DEFAULT_BRANDING: BrandingSettings = {
  primaryColor: "#0f172a",
  accentColor: "#00A5E4",
  logoBase64: null, // Will use default Romy logo
  hideDefaultFooter: false,
  customFooterText: null,
}

/**
 * Default primary color (dark slate)
 */
export const DEFAULT_PRIMARY_COLOR = "#0f172a"

/**
 * Default accent color (Romy cyan/teal)
 */
export const DEFAULT_ACCENT_COLOR = "#00A5E4"

// ============================================================================
// Validation Constants
// ============================================================================

/**
 * Regex for validating hex color codes
 */
export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

/**
 * Maximum length for custom footer text
 */
export const MAX_FOOTER_TEXT_LENGTH = 200

/**
 * Maximum logo file size in bytes (2MB)
 */
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024

/**
 * Allowed MIME types for logo uploads
 * Note: SVG is excluded for security reasons (potential XSS)
 */
export const ALLOWED_LOGO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
] as const

export type AllowedLogoType = (typeof ALLOWED_LOGO_TYPES)[number]

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert API response (snake_case) to frontend format (camelCase)
 */
export function convertFromApiFormat(
  apiData: PdfBrandingApiResponse
): PdfBranding {
  return {
    id: apiData.id,
    userId: apiData.user_id,
    primaryColor: apiData.primary_color || DEFAULT_PRIMARY_COLOR,
    accentColor: apiData.accent_color || DEFAULT_ACCENT_COLOR,
    logoUrl: apiData.logo_url,
    logoBase64: apiData.logo_base64,
    logoContentType: apiData.logo_content_type,
    hideDefaultFooter: apiData.hide_default_footer ?? false,
    customFooterText: apiData.custom_footer_text,
    createdAt: apiData.created_at,
    updatedAt: apiData.updated_at,
  }
}

/**
 * Convert frontend format (camelCase) to API format (snake_case)
 */
export function convertToApiFormat(branding: PdfBrandingInput): Record<string, unknown> {
  const apiData: Record<string, unknown> = {}

  if (branding.primaryColor !== undefined) {
    apiData.primary_color = branding.primaryColor
  }
  if (branding.accentColor !== undefined) {
    apiData.accent_color = branding.accentColor
  }
  if (branding.hideDefaultFooter !== undefined) {
    apiData.hide_default_footer = branding.hideDefaultFooter
  }
  if (branding.customFooterText !== undefined) {
    apiData.custom_footer_text = branding.customFooterText
  }

  return apiData
}

/**
 * Convert PdfBranding to BrandingSettings for PDF generation
 */
export function toBrandingSettings(branding: PdfBranding | null): BrandingSettings {
  if (!branding) {
    return DEFAULT_BRANDING
  }

  return {
    primaryColor: branding.primaryColor || DEFAULT_PRIMARY_COLOR,
    accentColor: branding.accentColor || DEFAULT_ACCENT_COLOR,
    logoBase64: branding.logoBase64,
    hideDefaultFooter: branding.hideDefaultFooter,
    customFooterText: branding.customFooterText,
  }
}
