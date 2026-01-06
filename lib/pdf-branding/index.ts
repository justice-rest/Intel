/**
 * PDF Branding Module
 *
 * Exports types, utilities, and storage functions for PDF branding customization.
 */

// Types
export type {
  PdfBranding,
  PdfBrandingInput,
  BrandingSettings,
  PdfBrandingApiResponse,
  AllowedLogoType,
} from "./types"

export {
  DEFAULT_BRANDING,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_ACCENT_COLOR,
  HEX_COLOR_REGEX,
  MAX_FOOTER_TEXT_LENGTH,
  MAX_LOGO_SIZE_BYTES,
  ALLOWED_LOGO_TYPES,
  convertFromApiFormat,
  convertToApiFormat,
  toBrandingSettings,
} from "./types"

// Utilities
export {
  isValidHexColor,
  sanitizeHexColor,
  getContrastColor,
  validateFooterText,
  sanitizeFooterText,
  validateLogoFile,
  isAllowedLogoType,
  getExtensionForMimeType,
  validateBrandingInput,
  generateLogoPath,
  extractPathFromUrl,
} from "./utils"

// Storage
export type { UploadLogoResult, DeleteLogoResult } from "./storage"

export {
  uploadLogo,
  deleteLogo,
  validateLogoBuffer,
  fileToBase64,
  bufferToBase64,
} from "./storage"
