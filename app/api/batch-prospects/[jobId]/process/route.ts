/**
 * Batch Processing API
 * POST: Process the next pending item in a batch job
 *
 * This endpoint is called repeatedly by the client to process prospects one by one.
 * Each call processes ONE prospect, enabling:
 * - Real-time progress updates
 * - Resume capability (client can stop and restart)
 * - Stays within Vercel timeout limits
 *
 * Feature Flag: `durable-batch-processing`
 * - When enabled: Uses Workflow DevKit for durable processing
 * - When disabled: Uses existing pipeline (default)
 */

import {
  BatchJobStatus,
  BatchProspectItem,
  BatchProspectJob,
  ProcessNextItemResponse,
} from "@/lib/batch-processing"
import {
  classifyBatchError,
  MAX_RETRIES_PER_PROSPECT,
  normalizeProspectAddress,
  STALE_ITEM_THRESHOLD_MS,
} from "@/lib/batch-processing/config"
import {
  adaptPipelineResultToDbFormat,
  createResearchPipeline,
} from "@/lib/batch-processing/pipeline"
import {
  getBatchCompleteEmailHtml,
  getBatchCompleteEmailSubject,
  sendEmail,
} from "@/lib/email"
import { createClient } from "@/lib/supabase/server"
import { getEffectiveApiKey } from "@/lib/user-keys"
import { isWorkflowEnabled, runDurableWorkflow } from "@/lib/workflows"
import { batchResearchWorkflow } from "@/lib/workflows/batch-research.workflow"
import { NextResponse } from "next/server"

// Allow up to 2 minutes for processing (web searches + AI generation)
export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const startTime = Date.now()

  try {
    const { jobId } = await params
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

    // Fetch job to check status and get settings
    // Using type assertion since table is added via migration
    const { data: job, error: jobError } = (await (supabase as any)
      .from("batch_prospect_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single()) as { data: BatchProspectJob | null; error: any }

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Check job status - only process if pending or processing
    if (!["pending", "processing"].includes(job.status)) {
      const response: ProcessNextItemResponse = {
        job_status: job.status as BatchJobStatus,
        progress: {
          completed: job.completed_count,
          total: job.total_prospects,
          failed: job.failed_count,
        },
        has_more: false,
        message: `Job is ${job.status}, not processing`,
      }
      return NextResponse.json(response)
    }

    // Update job to processing if it was pending
    if (job.status === "pending") {
      await (supabase as any)
        .from("batch_prospect_jobs")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
        })
        .eq("id", jobId)
    }

    // Get next pending item (or failed item under retry limit)
    // Using limit(1) without .single() to avoid errors on empty results
    const { data: pendingItems, error: itemError } = (await (supabase as any)
      .from("batch_prospect_items")
      .select("*")
      .eq("job_id", jobId)
      .eq("user_id", user.id) // Explicitly filter by user for safety
      .in("status", ["pending"]) // First check for pending items
      .order("item_index", { ascending: true })
      .limit(1)) as { data: BatchProspectItem[] | null; error: any }

    // Log for debugging
    console.log(
      `[BatchProcess] Query for pending items: jobId=${jobId}, found=${pendingItems?.length || 0}, error=${itemError?.message || "none"}`
    )

    let nextItem: BatchProspectItem | null = pendingItems?.[0] || null

    // If no pending items, check for stale "processing" items (stuck for >STALE_ITEM_THRESHOLD_MS)
    if (!nextItem && !itemError) {
      const staleThreshold = new Date(
        Date.now() - STALE_ITEM_THRESHOLD_MS
      ).toISOString()
      const { data: staleItems } = (await (supabase as any)
        .from("batch_prospect_items")
        .select("*")
        .eq("job_id", jobId)
        .eq("user_id", user.id)
        .eq("status", "processing")
        .lt("processing_started_at", staleThreshold) // Stuck for >threshold
        .order("item_index", { ascending: true })
        .limit(1)) as { data: BatchProspectItem[] | null }

      nextItem = staleItems?.[0] || null
      if (nextItem) {
        const staleMinutes = Math.floor(STALE_ITEM_THRESHOLD_MS / 60000)
        console.log(
          `[BatchProcess] Found stale processing item (>${staleMinutes}m): ${nextItem.prospect_name} (started ${nextItem.processing_started_at})`
        )
      }
    }

    // If no pending or stale items, check for failed items that can be retried
    if (!nextItem && !itemError) {
      const { data: failedItems } = (await (supabase as any)
        .from("batch_prospect_items")
        .select("*")
        .eq("job_id", jobId)
        .eq("user_id", user.id)
        .eq("status", "failed")
        .lt("retry_count", MAX_RETRIES_PER_PROSPECT)
        .order("item_index", { ascending: true })
        .limit(1)) as { data: BatchProspectItem[] | null }

      nextItem = failedItems?.[0] || null
      console.log(
        `[BatchProcess] Query for retry items: found=${failedItems?.length || 0}`
      )
    }

    // If query had an error, don't mark job as completed - return error
    if (itemError) {
      console.error(`[BatchProcess] Error querying items:`, itemError)
      return NextResponse.json(
        { error: `Failed to query items: ${itemError.message}` },
        { status: 500 }
      )
    }

    // If no more items to process, check if job should be marked as completed
    if (!nextItem) {
      // Count remaining pending/processing items
      const { count: remainingCount, error: countError } = (await (
        supabase as any
      )
        .from("batch_prospect_items")
        .select("*", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("user_id", user.id)
        .in("status", ["pending", "processing"])) as {
        count: number | null
        error: any
      }

      console.log(
        `[BatchProcess] Remaining count: ${remainingCount}, error=${countError?.message || "none"}`
      )

      // Only mark as completed if we successfully verified there are no remaining items
      if (countError) {
        console.error(
          `[BatchProcess] Error counting remaining items:`,
          countError
        )
        return NextResponse.json(
          { error: `Failed to check remaining items: ${countError.message}` },
          { status: 500 }
        )
      }

      if (remainingCount === 0) {
        // Job is truly complete - all items processed
        await (supabase as any)
          .from("batch_prospect_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId)
          .eq("user_id", user.id)

        // Fetch final counts
        const { data: finalJob } = (await (supabase as any)
          .from("batch_prospect_jobs")
          .select("*")
          .eq("id", jobId)
          .single()) as { data: BatchProspectJob | null }

        // Send completion email
        if (user.email) {
          const emailHtml = getBatchCompleteEmailHtml({
            jobName: finalJob?.name || job.name || "Batch Research",
            totalProspects: finalJob?.total_prospects || job.total_prospects,
            completedCount: finalJob?.completed_count || job.completed_count,
            failedCount: finalJob?.failed_count || job.failed_count,
            jobId,
            appUrl: "https://intel.getromy.app",
          })

          await sendEmail({
            to: user.email,
            subject: getBatchCompleteEmailSubject(
              finalJob?.name || job.name || "Batch Research"
            ),
            html: emailHtml,
          })
        }

        const response: ProcessNextItemResponse = {
          job_status: "completed",
          progress: {
            completed: finalJob?.completed_count || job.completed_count,
            total: finalJob?.total_prospects || job.total_prospects,
            failed: finalJob?.failed_count || job.failed_count,
          },
          has_more: false,
          message: "Batch processing completed",
        }
        return NextResponse.json(response)
      }

      // There are still pending items but we couldn't fetch them - something is wrong
      console.warn(
        `[BatchProcess] Found ${remainingCount ?? 0} remaining items but couldn't fetch next item`
      )
      const response: ProcessNextItemResponse = {
        job_status: job.status as BatchJobStatus,
        progress: {
          completed: job.completed_count,
          total: job.total_prospects,
          failed: job.failed_count,
        },
        has_more: (remainingCount ?? 0) > 0,
        message: `${remainingCount ?? 0} items remaining but unable to fetch next item`,
      }
      return NextResponse.json(response)
    }

    // RACE CONDITION PROTECTION: Atomically claim the item
    // Only update if the item is still in the expected status
    // This prevents multiple workers from processing the same item
    const expectedStatus = nextItem.status // "pending" or "failed" (for retry)
    const { data: claimedItem, error: claimError } = (await (supabase as any)
      .from("batch_prospect_items")
      .update({
        status: "processing",
        processing_started_at: new Date().toISOString(),
        retry_count:
          nextItem.status === "failed" ? nextItem.retry_count + 1 : 0,
      })
      .eq("id", nextItem.id)
      .eq("status", expectedStatus) // Atomic check - only update if still in expected status
      .select()
      .single()) as { data: BatchProspectItem | null; error: any }

    // If we couldn't claim the item, another worker got it first
    if (claimError || !claimedItem) {
      console.log(
        `[BatchProcess] Item ${nextItem.id} was already claimed by another worker`
      )

      // Try to get the next item instead
      const response: ProcessNextItemResponse = {
        job_status: job.status as BatchJobStatus,
        progress: {
          completed: job.completed_count,
          total: job.total_prospects,
          failed: job.failed_count,
        },
        has_more: true, // There might be more items
        message: "Item was claimed by another worker, try again",
      }
      return NextResponse.json(response)
    }

    // Get user's API key for OpenRouter
    let apiKey: string | undefined
    try {
      apiKey = (await getEffectiveApiKey(user.id, "openrouter")) || undefined
    } catch {
      // Fall back to env key
      apiKey = undefined
    }

    // Generate the prospect report using Parallel AI (comprehensive mode)
    console.log(
      `[BatchProcess] Processing item ${nextItem.item_index + 1}/${job.total_prospects}: ${nextItem.prospect_name}`
    )

    // Check if durable workflow is enabled for this user
    const useDurableWorkflow = isWorkflowEnabled(
      "durable-batch-processing",
      user.id
    )

    if (useDurableWorkflow) {
      // NEW: Durable workflow with automatic retry and observability
      console.log(`[BatchProcess] Using durable workflow for user ${user.id}`)

      try {
        const workflowResult = await runDurableWorkflow(batchResearchWorkflow, {
          jobId,
          itemId: nextItem.id,
          userId: user.id,
          prospect: nextItem.input_data,
          apiKey,
        })

        // Workflow completed (success or failure) - fetch updated state from DB
        // The workflow already updated item status and job counts

        // Fetch updated job counts
        const { data: updatedJob } = (await (supabase as any)
          .from("batch_prospect_jobs")
          .select("*")
          .eq("id", jobId)
          .single()) as { data: BatchProspectJob | null }

        // Fetch updated item
        const { data: updatedItem } = (await (supabase as any)
          .from("batch_prospect_items")
          .select("*")
          .eq("id", nextItem.id)
          .single()) as { data: BatchProspectItem | null }

        // Check if there are more items
        const { count: pendingCount } = (await (supabase as any)
          .from("batch_prospect_items")
          .select("*", { count: "exact", head: true })
          .eq("job_id", jobId)
          .eq("user_id", user.id)
          .eq("status", "pending")) as { count: number | null }

        const { count: retryableCount } = (await (supabase as any)
          .from("batch_prospect_items")
          .select("*", { count: "exact", head: true })
          .eq("job_id", jobId)
          .eq("user_id", user.id)
          .eq("status", "failed")
          .lt("retry_count", MAX_RETRIES_PER_PROSPECT)) as {
          count: number | null
        }

        const hasMore = (pendingCount || 0) + (retryableCount || 0) > 0

        const data = workflowResult.data
        const response: ProcessNextItemResponse = {
          item: updatedItem as BatchProspectItem,
          job_status: (updatedJob?.status as BatchJobStatus) || "processing",
          progress: {
            completed: updatedJob?.completed_count || 0,
            total: updatedJob?.total_prospects || 0,
            failed: updatedJob?.failed_count || 0,
          },
          has_more: hasMore,
          message: data?.success
            ? `Processed ${nextItem.prospect_name}`
            : `Failed to process ${nextItem.prospect_name}: ${data?.errorMessage || workflowResult.error || "Unknown error"}`,
        }

        return NextResponse.json(response)
      } catch (workflowError) {
        console.error(`[BatchProcess] Durable workflow failed:`, workflowError)
        // Fall through to legacy processing on workflow infrastructure failure
        console.log(`[BatchProcess] Falling back to legacy processing`)
      }
    }

    // ResearchPipeline v4.0 - With SEC/FEC/ProPublica verification
    console.log(`[BatchProcess] Using ResearchPipeline v4.0 with verification`)

    let pipelineSuccess = false
    let errorMessage: string | null = null

    try {
      // FIX: Ensure prospect has all address fields by merging JSONB with individual columns
      // When input_data JSONB is stored, JavaScript undefined values are omitted during
      // JSON serialization. The individual columns (prospect_city, etc.) store data correctly,
      // so we use them as fallback to ensure complete address data reaches the AI.

      // Merge address data from both JSONB and individual columns (individual columns take precedence as fallback)
      const mergedInputData: Record<string, string | undefined> = {
        ...(nextItem.input_data as Record<string, string | undefined>),
        // Use individual DB columns as fallback when JSONB values are missing
        address:
          nextItem.input_data?.address ||
          nextItem.prospect_address ||
          undefined,
        city: nextItem.input_data?.city || nextItem.prospect_city || undefined,
        state:
          nextItem.input_data?.state || nextItem.prospect_state || undefined,
        zip: nextItem.input_data?.zip || nextItem.prospect_zip || undefined,
      }

      // Use the centralized normalization function to ensure consistent address data
      const enrichedProspect = normalizeProspectAddress(mergedInputData)

      // Log for debugging address data flow
      console.log(
        `[BatchProcess] Address data for ${nextItem.prospect_name}:`,
        {
          input_data_address: nextItem.input_data?.address,
          input_data_city: nextItem.input_data?.city,
          input_data_state: nextItem.input_data?.state,
          input_data_zip: nextItem.input_data?.zip,
          db_prospect_address: nextItem.prospect_address,
          db_prospect_city: nextItem.prospect_city,
          db_prospect_state: nextItem.prospect_state,
          db_prospect_zip: nextItem.prospect_zip,
          enriched_full_address: enrichedProspect.full_address,
        }
      )

      // Create and execute the research pipeline
      const pipeline = createResearchPipeline()
      const pipelineResult = await pipeline.executeForItem(
        nextItem.id,
        enrichedProspect,
        { apiKey }
      )

      // Adapt pipeline result to database format
      const { success, updateData, verification } =
        adaptPipelineResultToDbFormat(pipelineResult, startTime)

      pipelineSuccess = success

      // Log verification results
      console.log(
        `[BatchProcess] Verification: ${verification.status} (confidence: ${(verification.confidence * 100).toFixed(1)}%, ` +
          `verified: ${verification.verifiedClaimsCount}, hallucinations: ${verification.hallucinationsCount})`
      )

      if (verification.recommendations.length > 0) {
        console.log(
          `[BatchProcess] Verification recommendations:`,
          verification.recommendations
        )
      }

      // Update item with results
      await (supabase as any)
        .from("batch_prospect_items")
        .update(updateData)
        .eq("id", nextItem.id)

      if (success) {
        console.log(
          `[BatchProcess] Completed item ${nextItem.item_index + 1}: ` +
            `RōmyScore ${updateData.romy_score || "N/A"}/41 (${updateData.romy_score_tier || "N/A"}) ` +
            `[${verification.status}]`
        )
      } else {
        errorMessage = updateData.error_message || "Pipeline execution failed"
        console.error(
          `[BatchProcess] Failed item ${nextItem.item_index + 1}: ${errorMessage}`
        )
      }
    } catch (error) {
      console.error(`[BatchProcess] Pipeline research failed:`, error)
      // Use centralized error classification for consistent handling
      const classifiedError = classifyBatchError(error)
      errorMessage = classifiedError.userMessage

      // Log detailed error for debugging
      console.log(
        `[BatchProcess] Error classified as ${classifiedError.code}:`,
        {
          original: classifiedError.message,
          userMessage: classifiedError.userMessage,
          retryable: classifiedError.retryable,
          retryAfterMs: classifiedError.retryAfterMs,
        }
      )

      // Mark item as failed
      await (supabase as any)
        .from("batch_prospect_items")
        .update({
          status: "failed",
          error_message: errorMessage,
          processing_completed_at: new Date().toISOString(),
          processing_duration_ms: Date.now() - startTime,
          last_retry_at: new Date().toISOString(),
        })
        .eq("id", nextItem.id)
    }

    // Fetch updated job counts (trigger will have updated them)
    const { data: updatedJob } = (await (supabase as any)
      .from("batch_prospect_jobs")
      .select("*")
      .eq("id", jobId)
      .single()) as { data: BatchProspectJob | null }

    // Check if there are more items - use simple status check
    const { count: pendingCount } = (await (supabase as any)
      .from("batch_prospect_items")
      .select("*", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .eq("status", "pending")) as { count: number | null }

    // Also check for retryable failed items
    const { count: retryableCount } = (await (supabase as any)
      .from("batch_prospect_items")
      .select("*", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .eq("status", "failed")
      .lt("retry_count", MAX_RETRIES_PER_PROSPECT)) as { count: number | null }

    const hasMore = (pendingCount || 0) + (retryableCount || 0) > 0

    // Fetch the updated item
    const { data: updatedItem } = (await (supabase as any)
      .from("batch_prospect_items")
      .select("*")
      .eq("id", nextItem.id)
      .single()) as { data: BatchProspectItem | null }

    const response: ProcessNextItemResponse = {
      item: updatedItem as BatchProspectItem,
      job_status: (updatedJob?.status as BatchJobStatus) || "processing",
      progress: {
        completed: updatedJob?.completed_count || 0,
        total: updatedJob?.total_prospects || 0,
        failed: updatedJob?.failed_count || 0,
      },
      has_more: hasMore,
      message: pipelineSuccess
        ? `Processed ${nextItem.prospect_name}`
        : `Failed to process ${nextItem.prospect_name}: ${errorMessage}`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[BatchProcess] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    )
  }
}
