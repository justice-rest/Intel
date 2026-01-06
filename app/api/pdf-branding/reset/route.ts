/**
 * PDF Branding Reset API
 *
 * POST: Reset all branding settings to defaults
 *       - Deletes logo from storage
 *       - Deletes branding record from database
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { extractPathFromUrl } from "@/lib/pdf-branding"

const STORAGE_BUCKET = "pdf-branding"

export async function POST() {
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

    // Get existing branding to find logo URL for cleanup
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
        await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([filePath])
          .catch((err) => console.warn("[PDF Branding] Storage delete warning:", err))
      }
    }

    // Delete the branding record entirely (will use defaults)
    const { error: deleteError } = await supabase
      .from("pdf_branding")
      .delete()
      .eq("user_id", user.id)

    if (deleteError && deleteError.code !== "PGRST116") {
      console.error("[PDF Branding] Error deleting branding:", deleteError)
      return NextResponse.json(
        { error: "Failed to reset branding" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Branding settings reset to defaults",
    })
  } catch (error) {
    console.error("[PDF Branding] Reset error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
