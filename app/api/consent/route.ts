import { createClient } from "@/lib/supabase/server"
import { hashIpAddress, CONSENT_VERSION } from "@/lib/consent"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

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
