import { MODEL_DEFAULT } from "@/lib/config"
import { scheduleOnboardingSequence } from "@/lib/email"
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

  try {
    // Try to insert user only if not exists
    const { error: insertError } = await supabaseAdmin.from("users").insert({
      id: user.id,
      email: user.email,
      created_at: new Date().toISOString(),
      message_count: 0,
      premium: false,
      favorite_models: [MODEL_DEFAULT],
      welcome_completed: false,
    })

    if (insertError && insertError.code !== "23505") {
      console.error("Error inserting user:", insertError)
    } else if (!insertError) {
      // Successfully inserted new user
      // Schedule onboarding email sequence for new users
      // Extract first name from user metadata or email
      const firstName =
        user.user_metadata?.full_name?.split(" ")[0] ||
        user.user_metadata?.name?.split(" ")[0] ||
        user.email?.split("@")[0] ||
        "there"

      // Fire and forget - don't block auth flow for email scheduling
      scheduleOnboardingSequence(user.email!, firstName).then((result) => {
        if (result.success) {
          console.log(
            `[Onboarding] Scheduled ${result.scheduledEmails} emails for ${user.email}`
          )
        } else {
          console.warn(
            `[Onboarding] Failed to schedule emails for ${user.email}:`,
            result.errors
          )
        }
      })
    }
  } catch (err) {
    console.error("Unexpected user insert error:", err)
  }

  const host = request.headers.get("host")
  const protocol = host?.includes("localhost") ? "http" : "https"

  // Redirect to the requested page (welcome popup will show on home if needed)
  const redirectUrl = `${protocol}://${host}${next}`

  return NextResponse.redirect(redirectUrl)
}
