/**
 * CRM API Key Validation Route
 * POST: Validate an API key without saving it
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  isCRMProvider,
  validateBloomerangKey,
  validateVirtuousKey,
  validateNeonCRMKey,
  validateDonorPerfectKey,
  validateSalesforceKey,
  validateBlackbaudKey,
  validateEveryActionKey,
  parseSalesforceCredentials,
  parseBlackbaudCredentials,
  parseEveryActionCredentials,
} from "@/lib/crm"
import type { ValidateKeyRequest, ValidateKeyResponse } from "@/lib/crm/types"

interface RouteParams {
  params: Promise<{ provider: string }>
}

// Extended request type for providers that need additional fields
interface ExtendedValidateKeyRequest extends ValidateKeyRequest {
  orgId?: string // For Neon CRM, Salesforce instance URL, Blackbaud subscription key, EveryAction app name
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
    const body: ExtendedValidateKeyRequest = await request.json()
    const { apiKey, orgId } = body

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      )
    }

    // Validate based on provider
    let validationResult: { valid: boolean; organizationName?: string; error?: string }

    switch (provider) {
      case "bloomerang":
        validationResult = await validateBloomerangKey(apiKey)
        break

      case "virtuous":
        validationResult = await validateVirtuousKey(apiKey)
        break

      case "neoncrm":
        // Neon CRM requires both orgId and apiKey
        if (!orgId) {
          return NextResponse.json(
            { error: "Organization ID is required for Neon CRM" },
            { status: 400 }
          )
        }
        validationResult = await validateNeonCRMKey(orgId, apiKey)
        break

      case "donorperfect":
        validationResult = await validateDonorPerfectKey(apiKey)
        break

      case "salesforce": {
        // Salesforce requires instance URL (orgId) and access token (apiKey)
        if (!orgId) {
          return NextResponse.json(
            { error: "Instance URL is required for Salesforce" },
            { status: 400 }
          )
        }
        validationResult = await validateSalesforceKey({
          instanceUrl: orgId,
          accessToken: apiKey,
        })
        break
      }

      case "blackbaud": {
        // Blackbaud requires subscription key (orgId) and access token (apiKey)
        if (!orgId) {
          return NextResponse.json(
            { error: "Subscription key is required for Blackbaud SKY API" },
            { status: 400 }
          )
        }
        validationResult = await validateBlackbaudKey({
          accessToken: apiKey,
          subscriptionKey: orgId,
        })
        break
      }

      case "everyaction": {
        // EveryAction requires application name (orgId) and API key
        if (!orgId) {
          return NextResponse.json(
            { error: "Application name is required for EveryAction" },
            { status: 400 }
          )
        }
        validationResult = await validateEveryActionKey({
          applicationName: orgId,
          apiKey: apiKey,
          databaseMode: 1, // Default to MyCampaign mode
        })
        break
      }

      default:
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
