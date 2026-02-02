import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

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

    // Get the user's preferences
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (error) {
      // If no preferences exist, return defaults
      if (error.code === "PGRST116") {
        return NextResponse.json({
          layout: "sidebar",
          prompt_suggestions: true,
          show_tool_invocations: true,
          show_conversation_previews: true,
          multi_model_enabled: false,
          hidden_models: [],
          beta_features_enabled: false,
        })
      }

      console.error("Error fetching user preferences:", error)
      return NextResponse.json(
        { error: "Failed to fetch user preferences" },
        { status: 500 }
      )
    }

    // Type assertion needed until Supabase types are regenerated after migration
    const prefs = data as typeof data & { beta_features_enabled?: boolean }
    return NextResponse.json({
      layout: prefs.layout,
      prompt_suggestions: prefs.prompt_suggestions,
      show_tool_invocations: prefs.show_tool_invocations,
      show_conversation_previews: prefs.show_conversation_previews,
      multi_model_enabled: prefs.multi_model_enabled,
      hidden_models: prefs.hidden_models || [],
      beta_features_enabled: prefs.beta_features_enabled || false,
    })
  } catch (error) {
    console.error("Error in user-preferences GET API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

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
      layout,
      prompt_suggestions,
      show_tool_invocations,
      show_conversation_previews,
      multi_model_enabled,
      hidden_models,
      beta_features_enabled,
    } = body

    // Validate the data types
    if (layout && typeof layout !== "string") {
      return NextResponse.json(
        { error: "layout must be a string" },
        { status: 400 }
      )
    }

    if (hidden_models && !Array.isArray(hidden_models)) {
      return NextResponse.json(
        { error: "hidden_models must be an array" },
        { status: 400 }
      )
    }

    // Prepare update object with only provided fields
    const updateData: any = {}
    if (layout !== undefined) updateData.layout = layout
    if (prompt_suggestions !== undefined)
      updateData.prompt_suggestions = prompt_suggestions
    if (show_tool_invocations !== undefined)
      updateData.show_tool_invocations = show_tool_invocations
    if (show_conversation_previews !== undefined)
      updateData.show_conversation_previews = show_conversation_previews
    if (multi_model_enabled !== undefined)
      updateData.multi_model_enabled = multi_model_enabled
    if (hidden_models !== undefined) updateData.hidden_models = hidden_models
    if (beta_features_enabled !== undefined)
      updateData.beta_features_enabled = beta_features_enabled

    // Try to update first, then insert if doesn't exist
    const { data, error } = await supabase
      .from("user_preferences")
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
      console.error("Error updating user preferences:", error)
      return NextResponse.json(
        { error: "Failed to update user preferences" },
        { status: 500 }
      )
    }

    // Type assertion needed until Supabase types are regenerated after migration
    const prefsData = data as typeof data & { beta_features_enabled?: boolean }
    return NextResponse.json({
      success: true,
      layout: prefsData.layout,
      prompt_suggestions: prefsData.prompt_suggestions,
      show_tool_invocations: prefsData.show_tool_invocations,
      show_conversation_previews: prefsData.show_conversation_previews,
      multi_model_enabled: prefsData.multi_model_enabled,
      hidden_models: prefsData.hidden_models || [],
      beta_features_enabled: prefsData.beta_features_enabled || false,
    })
  } catch (error) {
    console.error("Error in user-preferences PUT API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
