import { createClient } from "@/lib/supabase/server"
import { hashIpAddress, CONSENT_VERSION } from "@/lib/consent"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/consent
 * Fetch the current user's consent status from database
 * Returns null choices if user has no consent record
 */
export async function GET() {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ choices: null, source: "no_supabase" })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      // Not logged in - client should use localStorage
      return NextResponse.json({ choices: null, source: "anonymous" })
    }

    // Fetch the most recent consent record for this user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("consent_logs")
      .select("choices, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      // No consent record found for this user
      return NextResponse.json({ choices: null, source: "no_record" })
    }

    return NextResponse.json({
      choices: data.choices,
      source: "database",
      consentedAt: data.created_at,
    })
  } catch (error) {
    console.error("Consent fetch error:", error)
    return NextResponse.json({ choices: null, source: "error" })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { choices } = body

    if (!choices || typeof choices !== "object") {
      return NextResponse.json(
        { error: "Invalid consent choices" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get client info for logging
    const headersList = await headers()
    const forwardedFor = headersList.get("x-forwarded-for")
    const realIp = headersList.get("x-real-ip")
    const ip = forwardedFor?.split(",")[0] || realIp || "unknown"
    const userAgent = headersList.get("user-agent") || undefined

    // Hash IP for compliance logging (not tracking)
    const ipHash = hashIpAddress(ip)

    // Get user ID if authenticated
    let userId: string | undefined = undefined
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      userId = user?.id
    }

    // Log consent to database if Supabase is available
    // Note: consent_logs table must be created via migration 041_add_consent_logs.sql
    if (supabase) {
      try {
        // Use type assertion to bypass TypeScript until migration is run
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("consent_logs")
          .insert({
            user_id: userId || null,
            ip_hash: ipHash,
            consent_version: CONSENT_VERSION,
            choices,
            user_agent: userAgent || null,
          })

        if (error) {
          // Table might not exist yet - that's fine
          console.error("Failed to log consent:", error)
        }
      } catch (err) {
        // Fail silently - consent still works via localStorage
        console.error("Consent logging error:", err)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Consent API error:", error)
    return NextResponse.json({ error: "Failed to log consent" }, { status: 500 })
  }
}
