/**
 * Batch Prospects API
 * POST: Create a new batch job
 * GET: List user's batch jobs
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  CreateBatchJobRequest,
  CreateBatchJobResponse,
  BatchJobListResponse,
  DEFAULT_BATCH_SETTINGS,
  ProspectInputData,
  BatchProspectJob,
} from "@/lib/batch-processing"
import {
  MAX_PROSPECTS_PER_BATCH,
  MAX_CONCURRENT_JOBS_PER_USER,
  validateProspectData,
  normalizeProspectAddress,
  detectDuplicates,
  scoreAddressQuality,
} from "@/lib/batch-processing/config"
import { checkBatchCredits, trackBatchUsage } from "@/lib/subscription/autumn-client"

export const runtime = "nodejs"
export const maxDuration = 60

// ============================================================================
// POST: Create a new batch job
// ============================================================================

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      )
    }

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    const body: CreateBatchJobRequest = await request.json()

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Job name is required" },
        { status: 400 }
      )
    }

    if (!body.prospects || body.prospects.length === 0) {
      return NextResponse.json(
        { error: "At least one prospect is required" },
        { status: 400 }
      )
    }

    // Validate prospect count
    if (body.prospects.length > MAX_PROSPECTS_PER_BATCH) {
      return NextResponse.json(
        {
          error: `Maximum ${MAX_PROSPECTS_PER_BATCH} prospects per batch. You provided ${body.prospects.length}.`,
        },
        { status: 400 }
      )
    }

    // Check concurrent job limit (using type assertion since table is added via migration)
    const { count: activeJobCount } = await (supabase as any)
      .from("batch_prospect_jobs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["pending", "processing", "paused"]) as { count: number | null }

    if (activeJobCount && activeJobCount >= MAX_CONCURRENT_JOBS_PER_USER) {
      return NextResponse.json(
        {
          error: `Maximum ${MAX_CONCURRENT_JOBS_PER_USER} active jobs allowed. Please wait for current jobs to complete.`,
        },
        { status: 429 }
      )
    }

    // Step 1: Normalize all prospects first
    const normalizedProspects = body.prospects.map((prospect) =>
      normalizeProspectAddress(prospect) as ProspectInputData
    )

    // Step 2: Detect duplicates
    const duplicateResult = detectDuplicates(normalizedProspects)
    const duplicateSet = new Set(duplicateResult.duplicateIndices)

    // Step 3: Validate each prospect and filter invalid ones
    const validProspects: ProspectInputData[] = []
    const invalidProspects: Array<{ index: number; errors: string[] }> = []
    const skippedDuplicates: number[] = []
    const lowQualityWarnings: Array<{ index: number; warnings: string[] }> = []

    normalizedProspects.forEach((prospect, index) => {
      // Skip duplicates (keep first occurrence)
      if (duplicateSet.has(index)) {
        skippedDuplicates.push(index + 1) // 1-indexed for user display
        return
      }

      // Validate required fields
      const validation = validateProspectData(prospect)
      if (!validation.valid) {
        invalidProspects.push({ index: index + 1, errors: validation.errors })
        return
      }

      // Check address quality and add warnings (but don't reject)
      const qualityScore = scoreAddressQuality(prospect)
      if (qualityScore.warnings.length > 0) {
        lowQualityWarnings.push({ index: index + 1, warnings: qualityScore.warnings })
      }

      validProspects.push(prospect)
    })

    if (validProspects.length === 0) {
      return NextResponse.json(
        {
          error: "No valid prospects found",
          details: invalidProspects,
          duplicatesRemoved: skippedDuplicates.length,
        },
        { status: 400 }
      )
    }

    // Log duplicate and quality warnings for debugging
    if (duplicateResult.duplicateCount > 0) {
      console.log(`[BatchAPI] Removed ${duplicateResult.duplicateCount} duplicate prospects`)
    }
    if (lowQualityWarnings.length > 0) {
      console.log(`[BatchAPI] ${lowQualityWarnings.length} prospects have low address quality`)
    }

    // Check if user has enough credits (1 credit per row)
    const creditCheck = await checkBatchCredits(user.id, validProspects.length)
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: `Insufficient credits. You need ${validProspects.length} credits but only have ${creditCheck.balance || 0}. Please upgrade your plan or reduce the number of prospects.`,
          required: validProspects.length,
          available: creditCheck.balance || 0,
          shortfall: creditCheck.shortfall,
        },
        { status: 402 } // Payment Required
      )
    }

    // Deduct credits upfront (1 credit per row)
    await trackBatchUsage(user.id, validProspects.length)

    // Merge settings with defaults
    const settings = {
      ...DEFAULT_BATCH_SETTINGS,
      ...body.settings,
    }

    // Validate webhook URL if provided
    let webhookUrl: string | null = null
    if (body.webhook_url) {
      try {
        const url = new URL(body.webhook_url)
        if (!["http:", "https:"].includes(url.protocol)) {
          return NextResponse.json(
            { error: "Webhook URL must use HTTP or HTTPS protocol" },
            { status: 400 }
          )
        }
        webhookUrl = body.webhook_url
      } catch {
        return NextResponse.json(
          { error: "Invalid webhook URL format" },
          { status: 400 }
        )
      }
    }

    // Create the batch job (using type assertion since table is added via migration)
    const { data: job, error: jobError } = await (supabase as any)
      .from("batch_prospect_jobs")
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        status: "pending",
        total_prospects: validProspects.length,
        source_file_name: body.source_file_name || null,
        source_file_size: body.source_file_size || null,
        column_mapping: body.column_mapping || null,
        settings,
        // Webhook configuration
        webhook_url: webhookUrl,
        webhook_secret: body.webhook_secret || null,
      })
      .select()
      .single() as { data: BatchProspectJob | null; error: any }

    if (jobError || !job) {
      console.error("[BatchAPI] Failed to create job:", jobError)
      return NextResponse.json(
        { error: `Failed to create batch job: ${jobError?.message || "Unknown error"}` },
        { status: 500 }
      )
    }

    // Create batch items for each prospect
    // The prospects are already normalized, so all address fields are consistent
    const batchItems = validProspects.map((prospect, index) => ({
      job_id: job.id,
      user_id: user.id,
      item_index: index,
      status: "pending",
      // Store full prospect data (already normalized, includes full_address)
      input_data: prospect,
      // Also store key fields in individual columns for reliable access
      // (JSONB can lose undefined values during serialization)
      prospect_name: prospect.name,
      prospect_first_name: prospect.first_name || null,
      prospect_last_name: prospect.last_name || null,
      // For prospect_address, use the constructed full_address if street address is missing
      prospect_address: prospect.address || prospect.full_address || null,
      prospect_city: prospect.city || null,
      prospect_state: prospect.state || null,
      prospect_zip: prospect.zip || null,
    }))

    const { error: itemsError } = await (supabase as any)
      .from("batch_prospect_items")
      .insert(batchItems) as { error: any }

    if (itemsError) {
      console.error("[BatchAPI] Failed to create items:", itemsError)
      // Clean up the job
      await (supabase as any).from("batch_prospect_jobs").delete().eq("id", job.id)
      return NextResponse.json(
        { error: `Failed to create batch items: ${itemsError.message}` },
        { status: 500 }
      )
    }

    console.log(
      `[BatchAPI] Created batch job ${job.id} with ${validProspects.length} prospects`
    )

    // Build a detailed response message
    const messageParts: string[] = [`Created job with ${validProspects.length} prospects.`]
    if (skippedDuplicates.length > 0) {
      messageParts.push(`${skippedDuplicates.length} duplicate(s) removed.`)
    }
    if (invalidProspects.length > 0) {
      messageParts.push(`${invalidProspects.length} invalid prospect(s) skipped.`)
    }
    if (lowQualityWarnings.length > 0) {
      messageParts.push(`${lowQualityWarnings.length} prospect(s) have limited address data.`)
    }

    const response: CreateBatchJobResponse = {
      job,
      items_created: validProspects.length,
      message: messageParts.join(" "),
      // Include additional details for transparency
      duplicates_removed: skippedDuplicates.length,
      invalid_skipped: invalidProspects.length,
      low_quality_count: lowQualityWarnings.length,
    } as CreateBatchJobResponse & {
      duplicates_removed: number
      invalid_skipped: number
      low_quality_count: number
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error("[BatchAPI] Error creating batch job:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET: List user's batch jobs
// ============================================================================

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      )
    }

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "20", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    // Build query (using type assertion since table is added via migration)
    let query = (supabase as any)
      .from("batch_prospect_jobs")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq("status", status)
    }

    const { data: jobs, error, count } = await query as { data: BatchProspectJob[] | null; error: any; count: number | null }

    if (error) {
      console.error("[BatchAPI] Failed to fetch jobs:", error)
      return NextResponse.json(
        { error: `Failed to fetch jobs: ${error.message}` },
        { status: 500 }
      )
    }

    const response: BatchJobListResponse = {
      jobs: jobs || [],
      total: count || 0,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[BatchAPI] Error fetching batch jobs:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
