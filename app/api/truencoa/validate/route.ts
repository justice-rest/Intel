/**
 * TrueNCOA Address Validation API Route
 * POST: Validate batch addresses using TrueNCOA FREE tier
 *
 * This returns validation summary (counts/percentages) - no individual corrected addresses
 * For full corrected addresses, TrueNCOA charges $20/file
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  TrueNCOAClient,
  validateCredentialsFormat,
  type BatchProspectAddress,
  type TrueNCOAValidationSummary,
} from "@/lib/truencoa"

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

interface ValidateAddressesRequest {
  prospects: BatchProspectAddress[]
  credentials?: {
    id: string
    key: string
  }
}

interface ValidateAddressesResponse {
  success: boolean
  summary?: TrueNCOAValidationSummary
  error?: string
  message?: string
}

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ValidateAddressesResponse>> {
  try {
    // Authenticate user
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Parse request body
    const body: ValidateAddressesRequest = await request.json()

    // Validate request
    if (!body.prospects || !Array.isArray(body.prospects)) {
      return NextResponse.json(
        { success: false, error: "prospects array is required" },
        { status: 400 }
      )
    }

    if (body.prospects.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one prospect is required" },
        { status: 400 }
      )
    }

    // Validate prospect addresses
    for (let i = 0; i < body.prospects.length; i++) {
      const prospect = body.prospects[i]
      if (!prospect.id) {
        return NextResponse.json(
          { success: false, error: `Prospect at index ${i} is missing an ID` },
          { status: 400 }
        )
      }
      if (!prospect.address1 || !prospect.city || !prospect.state || !prospect.zip) {
        return NextResponse.json(
          {
            success: false,
            error: `Prospect ${prospect.id} is missing required address fields (address1, city, state, zip)`,
          },
          { status: 400 }
        )
      }
    }

    // Get credentials
    let credentials: { id: string; key: string }

    if (body.credentials) {
      // Use provided credentials
      credentials = body.credentials
    } else {
      // Try to get from user's stored keys
      const { data: userKey } = await supabase
        .from("user_keys")
        .select("encrypted_key")
        .eq("user_id", user.id)
        .eq("provider", "truencoa")
        .single() as { data: any; error: any }

      if (!userKey?.encrypted_key) {
        return NextResponse.json(
          {
            success: false,
            error: "TrueNCOA credentials not configured. Please add your credentials in Settings > Integrations.",
          },
          { status: 400 }
        )
      }

      // Decrypt and parse credentials
      // TrueNCOA credentials are stored as base64-encoded JSON
      try {
        const decoded = Buffer.from(userKey.encrypted_key, "base64").toString("utf-8")
        const parsed = JSON.parse(decoded)
        if (!parsed.id || !parsed.key) {
          throw new Error("Invalid credential format")
        }
        credentials = parsed
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid stored credentials format" },
          { status: 400 }
        )
      }
    }

    // Validate credentials format
    const credentialValidation = validateCredentialsFormat(credentials.id, credentials.key)
    if (!credentialValidation.valid) {
      return NextResponse.json(
        { success: false, error: credentialValidation.error },
        { status: 400 }
      )
    }

    // Perform validation
    const client = new TrueNCOAClient(credentials)

    // First validate credentials
    const credCheck = await client.validateCredentials()
    if (!credCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          error: credCheck.error || "Invalid TrueNCOA credentials",
        },
        { status: 401 }
      )
    }

    // Run batch validation
    const { summary } = await client.validateBatchAddresses(body.prospects)

    // Return summary
    return NextResponse.json({
      success: true,
      summary,
      message: `Validated ${summary.total_records} addresses. ${summary.deliverable} deliverable (${summary.deliverability_rate}%), ${summary.ncoa_matches} with moves detected.`,
    })
  } catch (error) {
    console.error("[TrueNCOA Validate API] Error:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Failed to validate addresses"

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
