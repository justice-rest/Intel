/**
 * CRM Integrations API Routes
 * GET: List all CRM integration statuses
 * POST: Save API key for a CRM provider
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { encryptKey } from "@/lib/encryption"
import { isCRMProvider, getCRMProviderName, validateBloomerangKey, validateVirtuousKey } from "@/lib/crm"
import type { CRMIntegrationStatus, CRMIntegrationsListResponse, SaveCRMKeyRequest, SaveCRMKeyResponse } from "@/lib/crm/types"

// ============================================================================
// GET - List all CRM integration statuses
// ============================================================================

export async function GET() {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      )
    }

    // Get current user
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

    // Get user's CRM keys from user_keys table
    const { data: keys, error: keysError } = await supabase
      .from("user_keys")
      .select("provider")
      .eq("user_id", user.id)
      .in("provider", ["bloomerang", "virtuous"])

    if (keysError) {
      console.error("Error fetching CRM keys:", keysError)
      return NextResponse.json(
        { error: "Failed to fetch CRM keys" },
        { status: 500 }
      )
    }

    const connectedProviders = new Set(keys?.map((k) => k.provider) || [])

    // Get latest sync info for each provider (using any to handle tables not yet in generated types)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: syncLogs } = await (supabase as any)
      .from("crm_sync_logs")
      .select("provider, status, records_synced, completed_at")
      .eq("user_id", user.id)
      .in("provider", ["bloomerang", "virtuous"])
      .order("completed_at", { ascending: false })

    // Group sync logs by provider (get latest for each)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const latestSyncs: Record<string, any> = {}
    if (syncLogs) {
      for (const log of syncLogs) {
        if (!latestSyncs[log.provider]) {
          latestSyncs[log.provider] = log
        }
      }
    }

    // Get constituent counts per provider
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: constituentCounts } = await (supabase as any)
      .from("crm_constituents")
      .select("provider")
      .eq("user_id", user.id)

    const countsByProvider: Record<string, number> = {}
    if (constituentCounts) {
      for (const c of constituentCounts) {
        countsByProvider[c.provider] = (countsByProvider[c.provider] || 0) + 1
      }
    }

    // Build response
    const integrations: CRMIntegrationStatus[] = [
      {
        provider: "bloomerang",
        connected: connectedProviders.has("bloomerang"),
        lastSync: latestSyncs["bloomerang"]?.completed_at || undefined,
        recordCount: countsByProvider["bloomerang"] || 0,
      },
      {
        provider: "virtuous",
        connected: connectedProviders.has("virtuous"),
        lastSync: latestSyncs["virtuous"]?.completed_at || undefined,
        recordCount: countsByProvider["virtuous"] || 0,
      },
    ]

    const response: CRMIntegrationsListResponse = { integrations }
    return NextResponse.json(response)
  } catch (error) {
    console.error("Error in GET /api/crm-integrations:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Save API key for a CRM provider
// ============================================================================

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      )
    }

    // Get current user
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
    const body: SaveCRMKeyRequest = await request.json()
    const { provider, apiKey } = body

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: "Provider and API key are required" },
        { status: 400 }
      )
    }

    // Validate API key format
    const trimmedKey = apiKey.trim()
    if (!trimmedKey || trimmedKey.length < 10) {
      return NextResponse.json(
        { error: "Invalid API key format. API keys must be at least 10 characters." },
        { status: 400 }
      )
    }

    if (!isCRMProvider(provider)) {
      return NextResponse.json(
        { error: "Invalid CRM provider" },
        { status: 400 }
      )
    }

    // Validate the API key before saving
    let validationResult: { valid: boolean; organizationName?: string; error?: string }

    if (provider === "bloomerang") {
      validationResult = await validateBloomerangKey(trimmedKey)
    } else if (provider === "virtuous") {
      validationResult = await validateVirtuousKey(trimmedKey)
    } else {
      return NextResponse.json(
        { error: "Unsupported CRM provider" },
        { status: 400 }
      )
    }

    if (!validationResult.valid) {
      return NextResponse.json(
        {
          success: false,
          isNewKey: false,
          message: validationResult.error || "Invalid API key",
        } satisfies SaveCRMKeyResponse,
        { status: 400 }
      )
    }

    // Check if key already exists
    const { data: existingKey } = await supabase
      .from("user_keys")
      .select("provider")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .single()

    const isNewKey = !existingKey

    // Encrypt the API key
    const { encrypted, iv } = encryptKey(trimmedKey)

    // Upsert the key
    const { error: upsertError } = await supabase.from("user_keys").upsert(
      {
        user_id: user.id,
        provider,
        encrypted_key: encrypted,
        iv,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,provider",
      }
    )

    if (upsertError) {
      console.error("Error saving CRM key:", upsertError)
      return NextResponse.json(
        { error: "Failed to save API key" },
        { status: 500 }
      )
    }

    const providerName = getCRMProviderName(provider)
    const response: SaveCRMKeyResponse = {
      success: true,
      isNewKey,
      message: isNewKey
        ? `Successfully connected to ${providerName}. You can now sync your data.`
        : `${providerName} API key updated successfully.`,
      organizationName: validationResult.organizationName,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error in POST /api/crm-integrations:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
