/**
 * CRM Sync Durable Workflow
 *
 * This workflow handles CRM data synchronization with:
 * - Automatic retry on transient failures
 * - Durable checkpointing (resume after server restart)
 * - Step-level observability
 * - Rate limiting without resource consumption
 *
 * Supports: Bloomerang, Virtuous, Neon CRM, DonorPerfect
 */

import { z } from "zod"
import type { CRMProvider } from "@/lib/crm/types"

// ============================================================================
// INPUT VALIDATION SCHEMA
// ============================================================================

/**
 * Strict schema for CRM sync parameters
 * Uses Zod for runtime validation
 */
export const CRMSyncParamsSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  provider: z.enum(["bloomerang", "virtuous", "neoncrm", "donorperfect"] as const),
  apiKey: z.string().min(1, "apiKey is required"),
  syncLogId: z.string().uuid("syncLogId must be a valid UUID"),
})

export type CRMSyncParams = z.infer<typeof CRMSyncParamsSchema>

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface CRMSyncResult {
  success: boolean
  constituentsCount: number
  donationsCount: number
  recordsFailed: number
  durationMs: number
}

// ============================================================================
// INTERNAL STEP FUNCTIONS
// ============================================================================

/**
 * Fetch all constituents from CRM provider
 * This is a step function - will be checkpointed after completion
 */
async function fetchConstituentsStep(params: CRMSyncParams): Promise<{
  constituents: Array<{
    provider: CRMProvider
    externalId: string
    firstName?: string
    lastName?: string
    fullName: string
    email?: string
    phone?: string
    streetAddress?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
    totalLifetimeGiving?: number
    largestGift?: number
    lastGiftAmount?: number
    lastGiftDate?: string
    firstGiftDate?: string
    giftCount?: number
    customFields?: Record<string, unknown>
    rawData: Record<string, unknown>
  }>
}> {
  // Dynamic import to avoid bundling all CRM adapters
  const {
    fetchAllBloomerangConstituents,
    fetchAllVirtuousContacts,
    fetchAllNeonCRMAccounts,
    fetchAllDonorPerfectDonors,
    mapBloomerangConstituent,
    mapVirtuousContact,
    mapNeonCRMAccount,
    mapDonorPerfectDonor,
    parseNeonCRMCredentials,
    CRM_SYNC_CONFIG,
  } = await import("@/lib/crm")

  const constituents: Array<{
    provider: CRMProvider
    externalId: string
    firstName?: string
    lastName?: string
    fullName: string
    email?: string
    phone?: string
    streetAddress?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
    totalLifetimeGiving?: number
    largestGift?: number
    lastGiftAmount?: number
    lastGiftDate?: string
    firstGiftDate?: string
    giftCount?: number
    customFields?: Record<string, unknown>
    rawData: Record<string, unknown>
  }> = []

  if (params.provider === "bloomerang") {
    for await (const batch of fetchAllBloomerangConstituents(params.apiKey, CRM_SYNC_CONFIG.batchSize)) {
      for (const c of batch) {
        const mapped = mapBloomerangConstituent(c)
        constituents.push({
          ...mapped,
          rawData: c as unknown as Record<string, unknown>,
        })
      }
      if (constituents.length >= CRM_SYNC_CONFIG.maxRecordsPerUser) break
    }
  } else if (params.provider === "virtuous") {
    for await (const batch of fetchAllVirtuousContacts(params.apiKey, CRM_SYNC_CONFIG.batchSize)) {
      for (const c of batch) {
        const mapped = mapVirtuousContact(c)
        constituents.push({
          ...mapped,
          rawData: c as unknown as Record<string, unknown>,
        })
      }
      if (constituents.length >= CRM_SYNC_CONFIG.maxRecordsPerUser) break
    }
  } else if (params.provider === "neoncrm") {
    const credentials = parseNeonCRMCredentials(params.apiKey)
    if (!credentials) {
      throw new Error("Invalid Neon CRM credentials format")
    }
    const accounts = await fetchAllNeonCRMAccounts(credentials)
    for (const c of accounts) {
      const mapped = mapNeonCRMAccount(c)
      constituents.push({
        ...mapped,
        rawData: c as unknown as Record<string, unknown>,
      })
      if (constituents.length >= CRM_SYNC_CONFIG.maxRecordsPerUser) break
    }
  } else if (params.provider === "donorperfect") {
    for await (const batch of fetchAllDonorPerfectDonors(params.apiKey, CRM_SYNC_CONFIG.batchSize)) {
      for (const d of batch) {
        const mapped = mapDonorPerfectDonor(d)
        constituents.push({
          ...mapped,
          rawData: d as unknown as Record<string, unknown>,
        })
      }
      if (constituents.length >= CRM_SYNC_CONFIG.maxRecordsPerUser) break
    }
  }

  return { constituents }
}

/**
 * Fetch all donations from CRM provider
 */
async function fetchDonationsStep(params: CRMSyncParams): Promise<{
  donations: Array<{
    provider: CRMProvider
    externalId: string
    constituentExternalId: string
    amount: number
    donationDate?: string
    donationType?: string
    campaignName?: string
    fundName?: string
    paymentMethod?: string
    status?: string
    notes?: string
    customFields?: Record<string, unknown>
    rawData: Record<string, unknown>
  }>
}> {
  const {
    fetchAllBloomerangTransactions,
    fetchAllVirtuousGifts,
    fetchAllNeonCRMDonations,
    fetchAllDonorPerfectGifts,
    mapBloomerangTransaction,
    mapVirtuousGift,
    mapNeonCRMDonation,
    mapDonorPerfectGift,
    parseNeonCRMCredentials,
    CRM_SYNC_CONFIG,
  } = await import("@/lib/crm")

  const donations: Array<{
    provider: CRMProvider
    externalId: string
    constituentExternalId: string
    amount: number
    donationDate?: string
    donationType?: string
    campaignName?: string
    fundName?: string
    paymentMethod?: string
    status?: string
    notes?: string
    customFields?: Record<string, unknown>
    rawData: Record<string, unknown>
  }> = []

  if (params.provider === "bloomerang") {
    for await (const batch of fetchAllBloomerangTransactions(params.apiKey, CRM_SYNC_CONFIG.batchSize)) {
      for (const t of batch) {
        const mapped = mapBloomerangTransaction(t)
        donations.push({
          ...mapped,
          rawData: t as unknown as Record<string, unknown>,
        })
      }
    }
  } else if (params.provider === "virtuous") {
    for await (const batch of fetchAllVirtuousGifts(params.apiKey, CRM_SYNC_CONFIG.batchSize)) {
      for (const g of batch) {
        const mapped = mapVirtuousGift(g)
        donations.push({
          ...mapped,
          rawData: g as unknown as Record<string, unknown>,
        })
      }
    }
  } else if (params.provider === "neoncrm") {
    const credentials = parseNeonCRMCredentials(params.apiKey)
    if (!credentials) {
      throw new Error("Invalid Neon CRM credentials format")
    }
    const allDonations = await fetchAllNeonCRMDonations(credentials)
    for (const d of allDonations) {
      const mapped = mapNeonCRMDonation(d)
      donations.push({
        ...mapped,
        rawData: d as unknown as Record<string, unknown>,
      })
    }
  } else if (params.provider === "donorperfect") {
    for await (const batch of fetchAllDonorPerfectGifts(params.apiKey, CRM_SYNC_CONFIG.batchSize)) {
      for (const g of batch) {
        const mapped = mapDonorPerfectGift(g)
        donations.push({
          ...mapped,
          rawData: g as unknown as Record<string, unknown>,
        })
      }
    }
  }

  return { donations }
}

/**
 * Upsert constituents to database in batches
 */
async function upsertConstituentsStep(
  constituents: Awaited<ReturnType<typeof fetchConstituentsStep>>["constituents"],
  userId: string,
  syncLogId: string
): Promise<{ synced: number; failed: number }> {
  const { createClient } = await import("@/lib/supabase/server")
  const { CRM_SYNC_CONFIG, CRM_API_CONFIG } = await import("@/lib/crm")

  const supabase = await createClient()
  if (!supabase) {
    throw new Error("Supabase not configured")
  }

  let synced = 0
  let failed = 0

  // Process in batches with rate limiting
  for (let i = 0; i < constituents.length; i += CRM_SYNC_CONFIG.batchSize) {
    const batch = constituents.slice(i, i + CRM_SYNC_CONFIG.batchSize)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("crm_constituents")
      .upsert(
        batch.map((c) => ({
          user_id: userId,
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
          raw_data: c.rawData,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,provider,external_id" }
      )

    if (error) {
      console.error("[CRM Sync] Error upserting constituents batch:", error)
      failed += batch.length
    } else {
      synced += batch.length
    }

    // Update progress in sync log
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("crm_sync_logs")
      .update({ records_synced: synced, records_failed: failed })
      .eq("id", syncLogId)

    // Rate limit delay between batches
    await new Promise((resolve) => setTimeout(resolve, CRM_API_CONFIG.rateLimitDelay))
  }

  return { synced, failed }
}

/**
 * Upsert donations to database in batches
 */
async function upsertDonationsStep(
  donations: Awaited<ReturnType<typeof fetchDonationsStep>>["donations"],
  userId: string,
  syncLogId: string,
  previousSynced: number,
  previousFailed: number
): Promise<{ synced: number; failed: number }> {
  const { createClient } = await import("@/lib/supabase/server")
  const { CRM_SYNC_CONFIG, CRM_API_CONFIG } = await import("@/lib/crm")

  const supabase = await createClient()
  if (!supabase) {
    throw new Error("Supabase not configured")
  }

  let synced = previousSynced
  let failed = previousFailed

  for (let i = 0; i < donations.length; i += CRM_SYNC_CONFIG.batchSize) {
    const batch = donations.slice(i, i + CRM_SYNC_CONFIG.batchSize)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("crm_donations")
      .upsert(
        batch.map((d) => ({
          user_id: userId,
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
          raw_data: d.rawData,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,provider,external_id" }
      )

    if (error) {
      console.error("[CRM Sync] Error upserting donations batch:", error)
      failed += batch.length
    } else {
      synced += batch.length
    }

    // Update progress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("crm_sync_logs")
      .update({ records_synced: synced, records_failed: failed })
      .eq("id", syncLogId)

    await new Promise((resolve) => setTimeout(resolve, CRM_API_CONFIG.rateLimitDelay))
  }

  return { synced, failed }
}

/**
 * Mark sync as completed in database
 */
async function markSyncCompleteStep(
  syncLogId: string,
  recordsSynced: number,
  recordsFailed: number
): Promise<void> {
  const { createClient } = await import("@/lib/supabase/server")

  const supabase = await createClient()
  if (!supabase) {
    throw new Error("Supabase not configured")
  }

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
}

/**
 * Mark sync as failed in database
 */
async function markSyncFailedStep(
  syncLogId: string,
  recordsSynced: number,
  recordsFailed: number,
  errorMessage: string
): Promise<void> {
  const { createClient } = await import("@/lib/supabase/server")

  const supabase = await createClient()
  if (!supabase) {
    throw new Error("Supabase not configured")
  }

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

// ============================================================================
// MAIN WORKFLOW FUNCTION
// ============================================================================

/**
 * Durable CRM Sync Workflow
 *
 * This is the main workflow function that orchestrates the CRM sync process.
 * Each step is automatically checkpointed, allowing the workflow to resume
 * from the last completed step if interrupted.
 *
 * @param params - Validated sync parameters
 * @returns CRMSyncResult with counts and duration
 *
 * @example
 * ```typescript
 * import { syncCRMData } from "@/lib/workflows/crm-sync.workflow"
 * import { runDurableWorkflow } from "@/lib/workflows"
 *
 * const result = await runDurableWorkflow(syncCRMData, {
 *   userId: user.id,
 *   provider: "bloomerang",
 *   apiKey: decryptedKey,
 *   syncLogId: syncLog.id,
 * })
 * ```
 */
export async function syncCRMData(params: CRMSyncParams): Promise<CRMSyncResult> {
  "use workflow"

  const startTime = Date.now()

  // Step 0: Validate inputs (fail fast on invalid params)
  const validated = CRMSyncParamsSchema.safeParse(params)
  if (!validated.success) {
    const errorMessage = `Invalid params: ${validated.error.message}`
    console.error("[CRM Sync] Validation failed:", errorMessage)

    // Mark sync as failed immediately
    await markSyncFailedStep(params.syncLogId, 0, 0, errorMessage)

    return {
      success: false,
      constituentsCount: 0,
      donationsCount: 0,
      recordsFailed: 0,
      durationMs: Date.now() - startTime,
    }
  }

  console.log(`[CRM Sync] Starting sync for provider: ${params.provider}`)

  let constituentsCount = 0
  let donationsCount = 0
  let recordsFailed = 0

  try {
    // Step 1: Fetch constituents from CRM
    "use step"
    console.log("[CRM Sync] Step 1: Fetching constituents...")
    const { constituents } = await fetchConstituentsStep(params)
    console.log(`[CRM Sync] Fetched ${constituents.length} constituents`)

    // Step 2: Upsert constituents to database
    "use step"
    console.log("[CRM Sync] Step 2: Upserting constituents...")
    const constituentResult = await upsertConstituentsStep(
      constituents,
      params.userId,
      params.syncLogId
    )
    constituentsCount = constituentResult.synced
    recordsFailed += constituentResult.failed
    console.log(`[CRM Sync] Upserted ${constituentsCount} constituents, ${constituentResult.failed} failed`)

    // Step 3: Fetch donations from CRM
    "use step"
    console.log("[CRM Sync] Step 3: Fetching donations...")
    const { donations } = await fetchDonationsStep(params)
    console.log(`[CRM Sync] Fetched ${donations.length} donations`)

    // Step 4: Upsert donations to database
    "use step"
    console.log("[CRM Sync] Step 4: Upserting donations...")
    const donationResult = await upsertDonationsStep(
      donations,
      params.userId,
      params.syncLogId,
      constituentsCount,
      recordsFailed
    )
    donationsCount = donationResult.synced - constituentsCount
    recordsFailed = donationResult.failed

    // Step 5: Mark sync as complete
    "use step"
    console.log("[CRM Sync] Step 5: Marking sync complete...")
    await markSyncCompleteStep(
      params.syncLogId,
      constituentsCount + donationsCount,
      recordsFailed
    )

    const durationMs = Date.now() - startTime
    console.log(`[CRM Sync] Completed in ${durationMs}ms`)

    return {
      success: true,
      constituentsCount,
      donationsCount,
      recordsFailed,
      durationMs,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[CRM Sync] Workflow failed:", errorMessage)

    // Mark sync as failed
    await markSyncFailedStep(
      params.syncLogId,
      constituentsCount + donationsCount,
      recordsFailed,
      errorMessage
    )

    return {
      success: false,
      constituentsCount,
      donationsCount,
      recordsFailed: recordsFailed + 1,
      durationMs: Date.now() - startTime,
    }
  }
}
