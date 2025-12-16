/**
 * CRM Data Sync Route
 * POST: Trigger a data sync from the CRM
 * GET: Get sync status
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { decryptKey } from "@/lib/encryption"
import {
  isCRMProvider,
  getCRMProviderName,
  fetchAllBloomerangConstituents,
  fetchAllBloomerangTransactions,
  mapBloomerangConstituent,
  mapBloomerangTransaction,
  fetchAllVirtuousContacts,
  fetchAllVirtuousGifts,
  mapVirtuousContact,
  mapVirtuousGift,
  fetchAllNeonCRMAccounts,
  fetchAllNeonCRMDonations,
  mapNeonCRMAccount,
  mapNeonCRMDonation,
  parseNeonCRMCredentials,
  fetchAllDonorPerfectDonors,
  fetchAllDonorPerfectGifts,
  mapDonorPerfectDonor,
  mapDonorPerfectGift,
  CRM_SYNC_CONFIG,
} from "@/lib/crm"
import type { CRMProvider, SyncTriggerResponse } from "@/lib/crm/types"
import { CRM_API_CONFIG } from "@/lib/crm"

// Rate limit helper - delay between API batches
const rateLimitDelay = () => new Promise(resolve => setTimeout(resolve, CRM_API_CONFIG.rateLimitDelay))

interface RouteParams {
  params: Promise<{ provider: string }>
}

// ============================================================================
// GET - Get sync status
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

    // Get latest sync logs (using any to handle tables not yet in generated types)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: logs, error: logsError } = await (supabase as any)
      .from("crm_sync_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .order("started_at", { ascending: false })
      .limit(5)

    if (logsError) {
      console.error("Error fetching sync logs:", logsError)
      return NextResponse.json(
        { error: "Failed to fetch sync status" },
        { status: 500 }
      )
    }

    return NextResponse.json({ logs: logs || [] })
  } catch (error) {
    console.error("Error in GET /api/crm-integrations/[provider]/sync:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Trigger data sync
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

    // Check if there's already a sync in progress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inProgressSync } = await (supabase as any)
      .from("crm_sync_logs")
      .select("id, started_at")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .eq("status", "in_progress")
      .single()

    if (inProgressSync) {
      // Check if the sync is stale (older than 30 minutes)
      const startedAt = new Date(inProgressSync.started_at).getTime()
      const STALE_THRESHOLD = 30 * 60 * 1000 // 30 minutes

      if (Date.now() - startedAt > STALE_THRESHOLD) {
        // Mark stale sync as failed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("crm_sync_logs")
          .update({
            status: "failed",
            error_message: "Sync timed out (exceeded 30 minutes)",
            completed_at: new Date().toISOString(),
          })
          .eq("id", inProgressSync.id)
      } else {
        return NextResponse.json(
          {
            success: false,
            message: "A sync is already in progress. Please wait for it to complete.",
          } satisfies SyncTriggerResponse,
          { status: 409 }
        )
      }
    }

    // Check minimum sync interval
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lastSync } = await (supabase as any)
      .from("crm_sync_logs")
      .select("completed_at")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .single()

    if (lastSync?.completed_at) {
      const lastSyncTime = new Date(lastSync.completed_at).getTime()
      const minInterval = CRM_SYNC_CONFIG.minSyncInterval * 60 * 1000
      if (Date.now() - lastSyncTime < minInterval) {
        return NextResponse.json(
          {
            success: false,
            message: `Please wait at least ${CRM_SYNC_CONFIG.minSyncInterval} minutes between syncs.`,
          } satisfies SyncTriggerResponse,
          { status: 429 }
        )
      }
    }

    // Get API key
    const { data: keyData, error: keyError } = await supabase
      .from("user_keys")
      .select("encrypted_key, iv")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .single()

    if (keyError || !keyData) {
      return NextResponse.json(
        {
          success: false,
          message: "No API key found. Please connect your CRM first.",
        } satisfies SyncTriggerResponse,
        { status: 400 }
      )
    }

    const apiKey = decryptKey(keyData.encrypted_key, keyData.iv)

    // Create sync log entry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: syncLog, error: syncLogError } = await (supabase as any)
      .from("crm_sync_logs")
      .insert({
        user_id: user.id,
        provider,
        sync_type: "full",
        status: "in_progress",
        records_synced: 0,
        records_failed: 0,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (syncLogError || !syncLog) {
      console.error("Error creating sync log:", syncLogError)
      return NextResponse.json(
        { error: "Failed to start sync" },
        { status: 500 }
      )
    }

    // Start sync in background (non-blocking)
    performSync(user.id, provider as CRMProvider, apiKey, syncLog.id, supabase)
      .catch((error) => {
        console.error("Sync error:", error)
      })

    const providerName = getCRMProviderName(provider as CRMProvider)
    const response: SyncTriggerResponse = {
      success: true,
      syncId: syncLog.id,
      message: `Started syncing data from ${providerName}. This may take a few minutes.`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error in POST /api/crm-integrations/[provider]/sync:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// ============================================================================
// SYNC IMPLEMENTATION
// ============================================================================

async function performSync(
  userId: string,
  provider: CRMProvider,
  apiKey: string,
  syncLogId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  if (!supabase) return

  let recordsSynced = 0
  let recordsFailed = 0
  let errorMessage: string | undefined

  try {
    if (provider === "bloomerang") {
      // Sync Bloomerang constituents
      for await (const batch of fetchAllBloomerangConstituents(apiKey, CRM_SYNC_CONFIG.batchSize)) {
        const mapped = batch.map((c) => ({
          ...mapBloomerangConstituent(c),
          user_id: userId,
          synced_at: new Date().toISOString(),
          raw_data: c,
        }))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("crm_constituents")
          .upsert(
            mapped.map((c) => ({
              user_id: c.user_id,
              provider: c.provider,
              external_id: c.externalId,
              first_name: c.firstName,
              last_name: c.lastName,
              full_name: c.fullName,
              email: c.email,
              phone: c.phone,
              street_address: c.streetAddress,
              city: c.city,
              state: c.state,
              zip_code: c.zipCode,
              country: c.country,
              total_lifetime_giving: c.totalLifetimeGiving,
              largest_gift: c.largestGift,
              last_gift_amount: c.lastGiftAmount,
              last_gift_date: c.lastGiftDate,
              first_gift_date: c.firstGiftDate,
              gift_count: c.giftCount,
              custom_fields: c.customFields || {},
              raw_data: c.raw_data,
              synced_at: c.synced_at,
            })),
            { onConflict: "user_id,provider,external_id" }
          )

        if (error) {
          console.error("Error upserting constituents:", error)
          recordsFailed += batch.length
        } else {
          recordsSynced += batch.length
        }

        // Update progress
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("crm_sync_logs")
          .update({ records_synced: recordsSynced, records_failed: recordsFailed })
          .eq("id", syncLogId)

        // Check if we've hit the limit
        if (recordsSynced >= CRM_SYNC_CONFIG.maxRecordsPerUser) {
          break
        }

        // Rate limit delay between batches
        await rateLimitDelay()
      }

      // Sync Bloomerang transactions
      for await (const batch of fetchAllBloomerangTransactions(apiKey, CRM_SYNC_CONFIG.batchSize)) {
        const mapped = batch.map((t) => ({
          ...mapBloomerangTransaction(t),
          user_id: userId,
          synced_at: new Date().toISOString(),
          raw_data: t,
        }))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("crm_donations")
          .upsert(
            mapped.map((d) => ({
              user_id: d.user_id,
              provider: d.provider,
              external_id: d.externalId,
              constituent_external_id: d.constituentExternalId,
              amount: d.amount,
              donation_date: d.donationDate,
              donation_type: d.donationType,
              campaign_name: d.campaignName,
              fund_name: d.fundName,
              payment_method: d.paymentMethod,
              status: d.status,
              notes: d.notes,
              custom_fields: d.customFields || {},
              raw_data: d.raw_data,
              synced_at: d.synced_at,
            })),
            { onConflict: "user_id,provider,external_id" }
          )

        if (error) {
          console.error("Error upserting donations:", error)
          recordsFailed += batch.length
        } else {
          recordsSynced += batch.length
        }

        // Update progress for donations too
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("crm_sync_logs")
          .update({ records_synced: recordsSynced, records_failed: recordsFailed })
          .eq("id", syncLogId)

        // Rate limit delay between batches
        await rateLimitDelay()
      }
    } else if (provider === "virtuous") {
      // Sync Virtuous contacts
      for await (const batch of fetchAllVirtuousContacts(apiKey, CRM_SYNC_CONFIG.batchSize)) {
        const mapped = batch.map((c) => ({
          ...mapVirtuousContact(c),
          user_id: userId,
          synced_at: new Date().toISOString(),
          raw_data: c,
        }))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("crm_constituents")
          .upsert(
            mapped.map((c) => ({
              user_id: c.user_id,
              provider: c.provider,
              external_id: c.externalId,
              first_name: c.firstName,
              last_name: c.lastName,
              full_name: c.fullName,
              email: c.email,
              phone: c.phone,
              street_address: c.streetAddress,
              city: c.city,
              state: c.state,
              zip_code: c.zipCode,
              country: c.country,
              total_lifetime_giving: c.totalLifetimeGiving,
              largest_gift: c.largestGift,
              last_gift_amount: c.lastGiftAmount,
              last_gift_date: c.lastGiftDate,
              first_gift_date: c.firstGiftDate,
              gift_count: c.giftCount,
              custom_fields: c.customFields || {},
              raw_data: c.raw_data,
              synced_at: c.synced_at,
            })),
            { onConflict: "user_id,provider,external_id" }
          )

        if (error) {
          console.error("Error upserting contacts:", error)
          recordsFailed += batch.length
        } else {
          recordsSynced += batch.length
        }

        // Update progress
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("crm_sync_logs")
          .update({ records_synced: recordsSynced, records_failed: recordsFailed })
          .eq("id", syncLogId)

        // Check if we've hit the limit
        if (recordsSynced >= CRM_SYNC_CONFIG.maxRecordsPerUser) {
          break
        }

        // Rate limit delay between batches (Virtuous has 10k/hour limit)
        await rateLimitDelay()
      }

      // Sync Virtuous gifts
      for await (const batch of fetchAllVirtuousGifts(apiKey, CRM_SYNC_CONFIG.batchSize)) {
        const mapped = batch.map((g) => ({
          ...mapVirtuousGift(g),
          user_id: userId,
          synced_at: new Date().toISOString(),
          raw_data: g,
        }))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("crm_donations")
          .upsert(
            mapped.map((d) => ({
              user_id: d.user_id,
              provider: d.provider,
              external_id: d.externalId,
              constituent_external_id: d.constituentExternalId,
              amount: d.amount,
              donation_date: d.donationDate,
              donation_type: d.donationType,
              campaign_name: d.campaignName,
              fund_name: d.fundName,
              payment_method: d.paymentMethod,
              status: d.status,
              notes: d.notes,
              custom_fields: d.customFields || {},
              raw_data: d.raw_data,
              synced_at: d.synced_at,
            })),
            { onConflict: "user_id,provider,external_id" }
          )

        if (error) {
          console.error("Error upserting gifts:", error)
          recordsFailed += batch.length
        } else {
          recordsSynced += batch.length
        }

        // Update progress for gifts too
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("crm_sync_logs")
          .update({ records_synced: recordsSynced, records_failed: recordsFailed })
          .eq("id", syncLogId)

        // Rate limit delay between batches
        await rateLimitDelay()
      }
    } else if (provider === "neoncrm") {
      // Parse Neon CRM credentials (stored as orgId:apiKey)
      const credentials = parseNeonCRMCredentials(apiKey)
      if (!credentials) {
        throw new Error("Invalid Neon CRM credentials format")
      }

      // Sync Neon CRM accounts (constituents)
      const accounts = await fetchAllNeonCRMAccounts(credentials, (fetched, total) => {
        console.log(`[Neon CRM] Fetched ${fetched}/${total} accounts`)
      })

      // Process in batches
      for (let i = 0; i < accounts.length; i += CRM_SYNC_CONFIG.batchSize) {
        const batch = accounts.slice(i, i + CRM_SYNC_CONFIG.batchSize)
        const mapped = batch.map((c) => ({
          ...mapNeonCRMAccount(c),
          user_id: userId,
          synced_at: new Date().toISOString(),
          raw_data: c,
        }))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("crm_constituents")
          .upsert(
            mapped.map((c) => ({
              user_id: c.user_id,
              provider: c.provider,
              external_id: c.externalId,
              first_name: c.firstName,
              last_name: c.lastName,
              full_name: c.fullName,
              email: c.email,
              phone: c.phone,
              street_address: c.streetAddress,
              city: c.city,
              state: c.state,
              zip_code: c.zipCode,
              country: c.country,
              total_lifetime_giving: c.totalLifetimeGiving,
              largest_gift: c.largestGift,
              last_gift_amount: c.lastGiftAmount,
              last_gift_date: c.lastGiftDate,
              first_gift_date: c.firstGiftDate,
              gift_count: c.giftCount,
              custom_fields: c.customFields || {},
              raw_data: c.raw_data,
              synced_at: c.synced_at,
            })),
            { onConflict: "user_id,provider,external_id" }
          )

        if (error) {
          console.error("Error upserting Neon CRM accounts:", error)
          recordsFailed += batch.length
        } else {
          recordsSynced += batch.length
        }

        // Update progress
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("crm_sync_logs")
          .update({ records_synced: recordsSynced, records_failed: recordsFailed })
          .eq("id", syncLogId)

        // Check if we've hit the limit
        if (recordsSynced >= CRM_SYNC_CONFIG.maxRecordsPerUser) {
          break
        }

        // Rate limit delay between batches
        await rateLimitDelay()
      }

      // Sync Neon CRM donations
      const donations = await fetchAllNeonCRMDonations(credentials, (fetched, total) => {
        console.log(`[Neon CRM] Fetched ${fetched}/${total} donations`)
      })

      for (let i = 0; i < donations.length; i += CRM_SYNC_CONFIG.batchSize) {
        const batch = donations.slice(i, i + CRM_SYNC_CONFIG.batchSize)
        const mapped = batch.map((d) => ({
          ...mapNeonCRMDonation(d),
          user_id: userId,
          synced_at: new Date().toISOString(),
          raw_data: d,
        }))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("crm_donations")
          .upsert(
            mapped.map((d) => ({
              user_id: d.user_id,
              provider: d.provider,
              external_id: d.externalId,
              constituent_external_id: d.constituentExternalId,
              amount: d.amount,
              donation_date: d.donationDate,
              donation_type: d.donationType,
              campaign_name: d.campaignName,
              fund_name: d.fundName,
              payment_method: d.paymentMethod,
              status: d.status,
              notes: d.notes,
              custom_fields: d.customFields || {},
              raw_data: d.raw_data,
              synced_at: d.synced_at,
            })),
            { onConflict: "user_id,provider,external_id" }
          )

        if (error) {
          console.error("Error upserting Neon CRM donations:", error)
          recordsFailed += batch.length
        } else {
          recordsSynced += batch.length
        }

        // Update progress for donations too
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("crm_sync_logs")
          .update({ records_synced: recordsSynced, records_failed: recordsFailed })
          .eq("id", syncLogId)

        // Rate limit delay between batches
        await rateLimitDelay()
      }
    } else if (provider === "donorperfect") {
      // Sync DonorPerfect donors (constituents)
      for await (const batch of fetchAllDonorPerfectDonors(apiKey, CRM_SYNC_CONFIG.batchSize)) {
        const mapped = batch.map((d) => ({
          ...mapDonorPerfectDonor(d),
          user_id: userId,
          synced_at: new Date().toISOString(),
          raw_data: d,
        }))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("crm_constituents")
          .upsert(
            mapped.map((c) => ({
              user_id: c.user_id,
              provider: c.provider,
              external_id: c.externalId,
              first_name: c.firstName,
              last_name: c.lastName,
              full_name: c.fullName,
              email: c.email,
              phone: c.phone,
              street_address: c.streetAddress,
              city: c.city,
              state: c.state,
              zip_code: c.zipCode,
              country: c.country,
              total_lifetime_giving: c.totalLifetimeGiving,
              largest_gift: c.largestGift,
              last_gift_amount: c.lastGiftAmount,
              last_gift_date: c.lastGiftDate,
              first_gift_date: c.firstGiftDate,
              gift_count: c.giftCount,
              custom_fields: c.customFields || {},
              raw_data: c.raw_data,
              synced_at: c.synced_at,
            })),
            { onConflict: "user_id,provider,external_id" }
          )

        if (error) {
          console.error("Error upserting DonorPerfect donors:", error)
          recordsFailed += batch.length
        } else {
          recordsSynced += batch.length
        }

        // Update progress
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("crm_sync_logs")
          .update({ records_synced: recordsSynced, records_failed: recordsFailed })
          .eq("id", syncLogId)

        // Check if we've hit the limit
        if (recordsSynced >= CRM_SYNC_CONFIG.maxRecordsPerUser) {
          break
        }

        // Rate limit delay between batches
        await rateLimitDelay()
      }

      // Sync DonorPerfect gifts (donations)
      for await (const batch of fetchAllDonorPerfectGifts(apiKey, CRM_SYNC_CONFIG.batchSize)) {
        const mapped = batch.map((g) => ({
          ...mapDonorPerfectGift(g),
          user_id: userId,
          synced_at: new Date().toISOString(),
          raw_data: g,
        }))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("crm_donations")
          .upsert(
            mapped.map((d) => ({
              user_id: d.user_id,
              provider: d.provider,
              external_id: d.externalId,
              constituent_external_id: d.constituentExternalId,
              amount: d.amount,
              donation_date: d.donationDate,
              donation_type: d.donationType,
              campaign_name: d.campaignName,
              fund_name: d.fundName,
              payment_method: d.paymentMethod,
              status: d.status,
              notes: d.notes,
              custom_fields: d.customFields || {},
              raw_data: d.raw_data,
              synced_at: d.synced_at,
            })),
            { onConflict: "user_id,provider,external_id" }
          )

        if (error) {
          console.error("Error upserting DonorPerfect gifts:", error)
          recordsFailed += batch.length
        } else {
          recordsSynced += batch.length
        }

        // Update progress for gifts too
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("crm_sync_logs")
          .update({ records_synced: recordsSynced, records_failed: recordsFailed })
          .eq("id", syncLogId)

        // Rate limit delay between batches
        await rateLimitDelay()
      }
    }

    // Mark sync as completed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("crm_sync_logs")
      .update({
        status: "completed",
        records_synced: recordsSynced,
        records_failed: recordsFailed,
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncLogId)
  } catch (error) {
    console.error("Sync failed:", error)
    errorMessage = error instanceof Error ? error.message : "Sync failed"

    // Mark sync as failed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("crm_sync_logs")
      .update({
        status: "failed",
        records_synced: recordsSynced,
        records_failed: recordsFailed,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncLogId)
  }
}
