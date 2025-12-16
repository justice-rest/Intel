/**
 * CRM Provider API Routes
 * GET: Get status for a specific provider
 * DELETE: Disconnect a CRM provider (remove API key and data)
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isCRMProvider, getCRMProviderName } from "@/lib/crm"
import type { CRMProvider, CRMIntegrationStatus } from "@/lib/crm/types"

interface RouteParams {
  params: Promise<{ provider: string }>
}

// ============================================================================
// GET - Get status for a specific provider
// ============================================================================

export async function GET(request: Request, { params }: RouteParams) {
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

    // Check if key exists
    const { data: key } = await supabase
      .from("user_keys")
      .select("provider")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .single()

    // Get latest sync (using any to handle tables not yet in generated types)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: syncLog } = await (supabase as any)
      .from("crm_sync_logs")
      .select("status, records_synced, completed_at, error_message")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .order("completed_at", { ascending: false })
      .limit(1)
      .single()

    // Get constituent count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from("crm_constituents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("provider", provider)

    const status: CRMIntegrationStatus = {
      provider: provider as CRMProvider,
      connected: !!key,
      lastSync: syncLog?.completed_at || undefined,
      recordCount: count || 0,
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error("Error in GET /api/crm-integrations/[provider]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Disconnect a CRM provider
// ============================================================================

export async function DELETE(request: Request, { params }: RouteParams) {
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

    // Delete API key
    const { error: keyDeleteError } = await supabase
      .from("user_keys")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider)

    if (keyDeleteError) {
      console.error("Error deleting CRM key:", keyDeleteError)
      return NextResponse.json(
        { error: "Failed to delete API key" },
        { status: 500 }
      )
    }

    // Delete cached constituents (using any to handle tables not yet in generated types)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: constituentDeleteError } = await (supabase as any)
      .from("crm_constituents")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider)

    if (constituentDeleteError) {
      console.error("Error deleting cached constituents:", constituentDeleteError)
      // Continue anyway, key was deleted
    }

    // Delete cached donations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: donationDeleteError } = await (supabase as any)
      .from("crm_donations")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider)

    if (donationDeleteError) {
      console.error("Error deleting cached donations:", donationDeleteError)
      // Continue anyway
    }

    // Delete sync logs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: syncDeleteError } = await (supabase as any)
      .from("crm_sync_logs")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider)

    if (syncDeleteError) {
      console.error("Error deleting sync logs:", syncDeleteError)
      // Continue anyway
    }

    const providerName = getCRMProviderName(provider as CRMProvider)
    return NextResponse.json({
      success: true,
      message: `Successfully disconnected from ${providerName}. All synced data has been removed.`,
    })
  } catch (error) {
    console.error("Error in DELETE /api/crm-integrations/[provider]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
