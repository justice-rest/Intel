import { MODEL_DEFAULT } from "@/lib/config"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { createGuestServerClient } from "@/lib/supabase/server-guest"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (!isSupabaseEnabled) {
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent("Supabase is not enabled in this deployment.")}`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent("Missing authentication code")}`
    )
  }

  const supabase = await createClient()
  const supabaseAdmin = await createGuestServerClient()

  if (!supabase || !supabaseAdmin) {
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent("Supabase is not enabled in this deployment.")}`
    )
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error("Auth error:", error)
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent(error.message)}`
    )
  }

  const user = data?.user
  if (!user || !user.id || !user.email) {
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent("Missing user info")}`
    )
  }

  let isNewUser = false

  try {
    // Try to insert user only if not exists
    const { error: insertError } = await supabaseAdmin.from("users").insert({
      id: user.id,
      email: user.email,
      created_at: new Date().toISOString(),
      message_count: 0,
      premium: false,
      favorite_models: [MODEL_DEFAULT],
      onboarding_completed: false,
    })

    if (insertError && insertError.code !== "23505") {
      console.error("Error inserting user:", insertError)
    } else if (!insertError) {
      // Successfully inserted new user
      isNewUser = true
    }
  } catch (err) {
    console.error("Unexpected user insert error:", err)
  }

  // Check if user needs onboarding
  let needsOnboarding = isNewUser
  if (!isNewUser) {
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single()

    needsOnboarding = !userData?.onboarding_completed
  }

  const host = request.headers.get("host")
  const protocol = host?.includes("localhost") ? "http" : "https"

  // Redirect to onboarding if needed, otherwise to the requested page
  const redirectPath = needsOnboarding ? "/onboarding" : next
  const redirectUrl = `${protocol}://${host}${redirectPath}`

  return NextResponse.redirect(redirectUrl)
}
