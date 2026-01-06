/**
 * PDF Branding Logo API
 *
 * POST: Upload a logo file
 * DELETE: Remove the current logo
 */

import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import * as fileType from "file-type"
import {
  MAX_LOGO_SIZE_BYTES,
  ALLOWED_LOGO_TYPES,
  isAllowedLogoType,
  generateLogoPath,
  getExtensionForMimeType,
  extractPathFromUrl,
} from "@/lib/pdf-branding"

const STORAGE_BUCKET = "pdf-branding"

// ============================================================================
// POST: Upload logo
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      )
    }

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      const maxMB = MAX_LOGO_SIZE_BYTES / (1024 * 1024)
      return NextResponse.json(
        { error: `Logo must be ${maxMB}MB or less` },
        { status: 400 }
      )
    }

    // Read file buffer
    const buffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(buffer)

    // Validate file type via magic bytes (security measure)
    const detectedType = await fileType.fileTypeFromBuffer(uint8Array)

    if (!detectedType || !isAllowedLogoType(detectedType.mime)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed types: ${ALLOWED_LOGO_TYPES.join(", ")}`,
        },
        { status: 400 }
      )
    }

    // Check for existing branding to get old logo URL for cleanup
    const { data: existingBranding } = await supabase
      .from("pdf_branding")
      .select("logo_url")
      .eq("user_id", user.id)
      .single()

    // Delete old logo if exists
    if (existingBranding?.logo_url) {
      const oldPath = extractPathFromUrl(existingBranding.logo_url)
      if (oldPath) {
        await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([oldPath])
          .catch((err) => console.warn("[PDF Branding] Old logo cleanup failed:", err))
      }
    }

    // Generate storage path
    const extension = getExtensionForMimeType(detectedType.mime)
    const filePath = generateLogoPath(user.id, extension)

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
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath)

    const publicUrl = urlData.publicUrl

    // Generate base64 for caching (used in PDF generation)
    const base64 = `data:${detectedType.mime};base64,${Buffer.from(buffer).toString("base64")}`

    // Update branding record with logo info
    const { data, error: dbError } = await supabase
      .from("pdf_branding")
      .upsert(
        {
          user_id: user.id,
          logo_url: publicUrl,
          logo_base64: base64,
          logo_content_type: detectedType.mime,
        },
        {
          onConflict: "user_id",
        }
      )
      .select("*")
      .single()

    if (dbError) {
      console.error("[PDF Branding] Database update error:", dbError)

      // Try to clean up uploaded file
      await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([filePath])
        .catch((err) => console.warn("[PDF Branding] Cleanup failed:", err))

      return NextResponse.json(
        { error: "Failed to save logo information" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      logo_url: data.logo_url,
      logo_base64: data.logo_base64,
      logo_content_type: data.logo_content_type,
    })
  } catch (error) {
    console.error("[PDF Branding] Logo upload error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE: Remove logo
// ============================================================================

export async function DELETE() {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      )
    }

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get existing branding to find logo URL
    const { data: existingBranding, error: fetchError } = await supabase
      .from("pdf_branding")
      .select("logo_url")
      .eq("user_id", user.id)
      .single()

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("[PDF Branding] Error fetching branding:", fetchError)
      return NextResponse.json(
        { error: "Failed to fetch branding settings" },
        { status: 500 }
      )
    }

    // Delete logo from storage if exists
    if (existingBranding?.logo_url) {
      const filePath = extractPathFromUrl(existingBranding.logo_url)
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([filePath])

        if (storageError) {
          console.warn("[PDF Branding] Storage delete warning:", storageError)
          // Continue anyway - logo might already be deleted
        }
      }
    }

    // Update branding record to clear logo fields
    const { error: updateError } = await supabase
      .from("pdf_branding")
      .update({
        logo_url: null,
        logo_base64: null,
        logo_content_type: null,
      })
      .eq("user_id", user.id)

    if (updateError && updateError.code !== "PGRST116") {
      console.error("[PDF Branding] Error clearing logo:", updateError)
      return NextResponse.json(
        { error: "Failed to clear logo" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[PDF Branding] Logo delete error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
