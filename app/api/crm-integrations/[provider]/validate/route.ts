/**
 * CRM API Key Validation Route
 * POST: Validate an API key without saving it
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isCRMProvider, validateBloomerangKey, validateVirtuousKey } from "@/lib/crm"
import type { ValidateKeyRequest, ValidateKeyResponse } from "@/lib/crm/types"

interface RouteParams {
  params: Promise<{ provider: string }>
}

// ============================================================================
// POST - Validate API key
// ============================================================================

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { provider } = await params

    if (!isCRMProvider(provider)) {
      return NextResponse.json(
        { error: "Invalid CRM provider" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Parse request body
    const body: ValidateKeyRequest = await request.json()
    const { apiKey } = body

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      )
    }

    // Validate based on provider
    let validationResult: { valid: boolean; organizationName?: string; error?: string }

    if (provider === "bloomerang") {
      validationResult = await validateBloomerangKey(apiKey)
    } else if (provider === "virtuous") {
      validationResult = await validateVirtuousKey(apiKey)
    } else {
      return NextResponse.json(
        { error: "Unsupported CRM provider" },
        { status: 400 }
      )
    }

    const response: ValidateKeyResponse = {
      valid: validationResult.valid,
      organizationName: validationResult.organizationName,
      errorMessage: validationResult.error,
    }

    return NextResponse.json(response, {
      status: validationResult.valid ? 200 : 400,
    })
  } catch (error) {
    console.error("Error in POST /api/crm-integrations/[provider]/validate:", error)
    return NextResponse.json(
      {
        valid: false,
        errorMessage: "Failed to validate API key. Please try again.",
      } satisfies ValidateKeyResponse,
      { status: 500 }
    )
  }
}
