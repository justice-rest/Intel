/**
 * PDF Branding Settings API
 *
 * GET: Fetch user's branding settings
 * PUT: Update branding settings (colors, footer)
 *
 * Note: Logo upload/delete is handled by /api/pdf-branding/logo
 */

import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_ACCENT_COLOR,
  isValidHexColor,
  validateFooterText,
  sanitizeFooterText,
} from "@/lib/pdf-branding"

// ============================================================================
// GET: Fetch branding settings
// ============================================================================

export async function GET() {
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

    // Get the user's branding settings
    const { data, error } = await supabase
      .from("pdf_branding")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (error) {
      // If no branding exists, return defaults
      if (error.code === "PGRST116") {
        return NextResponse.json({
          id: null,
          user_id: user.id,
          primary_color: DEFAULT_PRIMARY_COLOR,
          accent_color: DEFAULT_ACCENT_COLOR,
          logo_url: null,
          logo_base64: null,
          logo_content_type: null,
          hide_default_footer: false,
          custom_footer_text: null,
          created_at: null,
          updated_at: null,
        })
      }

      console.error("[PDF Branding] Error fetching branding:", error)
      return NextResponse.json(
        { error: "Failed to fetch branding settings" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: data.id,
      user_id: data.user_id,
      primary_color: data.primary_color || DEFAULT_PRIMARY_COLOR,
      accent_color: data.accent_color || DEFAULT_ACCENT_COLOR,
      logo_url: data.logo_url,
      logo_base64: data.logo_base64,
      logo_content_type: data.logo_content_type,
      hide_default_footer: data.hide_default_footer ?? false,
      custom_footer_text: data.custom_footer_text,
      created_at: data.created_at,
      updated_at: data.updated_at,
    })
  } catch (error) {
    console.error("[PDF Branding] GET error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// ============================================================================
// PUT: Update branding settings
// ============================================================================

export async function PUT(request: NextRequest) {
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

    // Parse the request body
    const body = await request.json()
    const {
      primary_color,
      accent_color,
      hide_default_footer,
      custom_footer_text,
    } = body

    // Validate colors
    if (primary_color !== undefined && !isValidHexColor(primary_color)) {
      return NextResponse.json(
        { error: "Invalid primary color format. Use hex format (e.g., #FF5500)" },
        { status: 400 }
      )
    }

    if (accent_color !== undefined && !isValidHexColor(accent_color)) {
      return NextResponse.json(
        { error: "Invalid accent color format. Use hex format (e.g., #FF5500)" },
        { status: 400 }
      )
    }

    // Validate footer text
    if (custom_footer_text !== undefined && custom_footer_text !== null) {
      const footerValidation = validateFooterText(custom_footer_text)
      if (!footerValidation.isValid) {
        return NextResponse.json(
          { error: footerValidation.error },
          { status: 400 }
        )
      }
    }

    // Prepare update object with only provided fields
    const updateData: Record<string, unknown> = {}

    if (primary_color !== undefined) {
      updateData.primary_color = primary_color.toUpperCase()
    }
    if (accent_color !== undefined) {
      updateData.accent_color = accent_color.toUpperCase()
    }
    if (hide_default_footer !== undefined) {
      updateData.hide_default_footer = Boolean(hide_default_footer)
    }
    if (custom_footer_text !== undefined) {
      updateData.custom_footer_text = sanitizeFooterText(custom_footer_text)
    }

    // Upsert the branding settings
    const { data, error } = await supabase
      .from("pdf_branding")
      .upsert(
        {
          user_id: user.id,
          ...updateData,
        },
        {
          onConflict: "user_id",
        }
      )
      .select("*")
      .single()

    if (error) {
      console.error("[PDF Branding] Error updating branding:", error)
      return NextResponse.json(
        { error: "Failed to update branding settings" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      user_id: data.user_id,
      primary_color: data.primary_color || DEFAULT_PRIMARY_COLOR,
      accent_color: data.accent_color || DEFAULT_ACCENT_COLOR,
      logo_url: data.logo_url,
      logo_base64: data.logo_base64,
      logo_content_type: data.logo_content_type,
      hide_default_footer: data.hide_default_footer ?? false,
      custom_footer_text: data.custom_footer_text,
      created_at: data.created_at,
      updated_at: data.updated_at,
    })
  } catch (error) {
    console.error("[PDF Branding] PUT error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
