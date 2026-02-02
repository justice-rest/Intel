// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any

/**
 * PDF Branding Storage
 *
 * Functions for uploading, deleting, and managing branding logos in Supabase storage.
 */

import { SupabaseClient } from "@supabase/supabase-js"
import * as fileType from "file-type"
import {
  ALLOWED_LOGO_TYPES,
  MAX_LOGO_SIZE_BYTES,
  type AllowedLogoType,
} from "./types"
import {
  generateLogoPath,
  getExtensionForMimeType,
  extractPathFromUrl,
  isAllowedLogoType,
} from "./utils"

const STORAGE_BUCKET = "pdf-branding"

// ============================================================================
// Logo Upload
// ============================================================================

export interface UploadLogoResult {
  success: boolean
  url?: string
  base64?: string
  contentType?: string
  error?: string
}

/**
 * Upload a logo file to Supabase storage
 *
 * @param supabase - Supabase client
 * @param file - File to upload
 * @param userId - User ID for path scoping
 * @returns Upload result with URL and base64
 */
export async function uploadLogo(
  supabase: AnySupabaseClient,
  file: File,
  userId: string
): Promise<UploadLogoResult> {
  try {
    // Validate file size
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      const maxMB = MAX_LOGO_SIZE_BYTES / (1024 * 1024)
      return {
        success: false,
        error: `Logo must be ${maxMB}MB or less`,
      }
    }

    // Read file buffer for magic bytes validation
    const buffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(buffer)

    // Validate file type via magic bytes (not just MIME type)
    const detectedType = await fileType.fileTypeFromBuffer(uint8Array)

    if (!detectedType || !isAllowedLogoType(detectedType.mime)) {
      return {
        success: false,
        error: "Invalid file type. Please upload a PNG, JPG, or GIF image.",
      }
    }

    // Generate storage path
    const extension = getExtensionForMimeType(detectedType.mime)
    const filePath = generateLogoPath(userId, extension)

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: detectedType.mime,
      })

    if (uploadError) {
      console.error("[PDF Branding] Storage upload error:", uploadError)
      return {
        success: false,
        error: `Upload failed: ${uploadError.message}`,
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath)

    const publicUrl = urlData.publicUrl

    // Generate base64 for caching
    const base64 = `data:${detectedType.mime};base64,${Buffer.from(buffer).toString("base64")}`

    return {
      success: true,
      url: publicUrl,
      base64,
      contentType: detectedType.mime,
    }
  } catch (error) {
    console.error("[PDF Branding] Upload error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    }
  }
}

// ============================================================================
// Logo Deletion
// ============================================================================

export interface DeleteLogoResult {
  success: boolean
  error?: string
}

/**
 * Delete a logo from Supabase storage
 *
 * @param supabase - Supabase client
 * @param logoUrl - Public URL of the logo to delete
 * @returns Deletion result
 */
export async function deleteLogo(
  supabase: AnySupabaseClient,
  logoUrl: string
): Promise<DeleteLogoResult> {
  try {
    // Extract file path from URL
    const filePath = extractPathFromUrl(logoUrl)

    if (!filePath) {
      console.warn("[PDF Branding] Could not extract path from URL:", logoUrl)
      // Don't fail if we can't extract path - logo might already be deleted
      return { success: true }
    }

    // Delete from storage
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath])

    if (error) {
      // Don't fail if file doesn't exist (might have been deleted already)
      if (error.message.includes("not found") || error.message.includes("Object not found")) {
        console.warn("[PDF Branding] Logo already deleted:", filePath)
        return { success: true }
      }

      console.error("[PDF Branding] Storage delete error:", error)
      return {
        success: false,
        error: `Delete failed: ${error.message}`,
      }
    }

    return { success: true }
  } catch (error) {
    console.error("[PDF Branding] Delete error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Delete failed",
    }
  }
}

// ============================================================================
// Server-Side Logo Validation
// ============================================================================

/**
 * Validate a logo file on the server (API route)
 *
 * @param buffer - File buffer
 * @returns Validation result with detected MIME type
 */
export async function validateLogoBuffer(
  buffer: ArrayBuffer
): Promise<{
  isValid: boolean
  mimeType?: AllowedLogoType
  error?: string
}> {
  try {
    const uint8Array = new Uint8Array(buffer)

    // Check file type via magic bytes
    const detectedType = await fileType.fileTypeFromBuffer(uint8Array)

    if (!detectedType) {
      return {
        isValid: false,
        error: "Could not detect file type",
      }
    }

    if (!isAllowedLogoType(detectedType.mime)) {
      return {
        isValid: false,
        error: `File type ${detectedType.mime} is not allowed. Use PNG, JPG, or GIF.`,
      }
    }

    return {
      isValid: true,
      mimeType: detectedType.mime as AllowedLogoType,
    }
  } catch (error) {
    console.error("[PDF Branding] Validation error:", error)
    return {
      isValid: false,
      error: "File validation failed",
    }
  }
}

// ============================================================================
// Base64 Conversion
// ============================================================================

/**
 * Convert a file to base64 data URI
 *
 * @param file - File to convert
 * @returns Base64 data URI
 */
export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString("base64")
  return `data:${file.type};base64,${base64}`
}

/**
 * Convert a buffer to base64 data URI
 *
 * @param buffer - Buffer to convert
 * @param mimeType - MIME type for data URI
 * @returns Base64 data URI
 */
export function bufferToBase64(buffer: ArrayBuffer, mimeType: string): string {
  const base64 = Buffer.from(buffer).toString("base64")
  return `data:${mimeType};base64,${base64}`
}
