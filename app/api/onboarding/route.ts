import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { Tables } from "@/app/types/database.types"

export type OnboardingFormData = Omit<
  Tables<"onboarding_data">,
  "user_id" | "created_at" | "updated_at"
>

export async function GET() {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 503 },
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("onboarding_data")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" error
      throw error
    }

    return NextResponse.json(data || null)
  } catch (error) {
    console.error("Error fetching onboarding data:", error)
    return NextResponse.json(
      { error: "Failed to fetch onboarding data" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 503 },
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as OnboardingFormData

    // Upsert onboarding data
    const { data: onboardingData, error: onboardingError } = await supabase
      .from("onboarding_data")
      .upsert(
        {
          user_id: user.id,
          ...body,
        },
        { onConflict: "user_id" },
      )
      .select()
      .single()

    if (onboardingError) throw onboardingError

    // Mark onboarding as completed
    const { error: userError } = await supabase
      .from("users")
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (userError) throw userError

    // Update user metadata to cache onboarding status in JWT (for faster middleware checks)
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        onboarding_completed: true,
      },
    })

    if (metadataError) {
      console.warn("Failed to update user metadata:", metadataError)
      // Non-critical error - don't fail the request
    }

    return NextResponse.json({ success: true, data: onboardingData })
  } catch (error) {
    console.error("Error saving onboarding data:", error)
    return NextResponse.json(
      { error: "Failed to save onboarding data" },
      { status: 500 },
    )
  }
}
