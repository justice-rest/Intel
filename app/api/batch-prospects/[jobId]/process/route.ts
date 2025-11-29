/**
 * Batch Processing API
 * POST: Process the next pending item in a batch job
 *
 * This endpoint is called repeatedly by the client to process prospects one by one.
 * Each call processes ONE prospect, enabling:
 * - Real-time progress updates
 * - Resume capability (client can stop and restart)
 * - Stays within Vercel timeout limits
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  ProcessNextItemResponse,
  BatchProspectItem,
  BatchProspectJob,
  BatchJobStatus,
} from "@/lib/batch-processing"
import { generateProspectReport } from "@/lib/batch-processing/report-generator"
import { getEffectiveApiKey } from "@/lib/user-keys"
import { MAX_RETRIES_PER_PROSPECT } from "@/lib/batch-processing/config"

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
    const { data: job, error: jobError } = await (supabase as any)
      .from("batch_prospect_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single() as { data: BatchProspectJob | null; error: any }

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      )
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
    const { data: nextItem, error: itemError } = await (supabase as any)
      .from("batch_prospect_items")
      .select("*")
      .eq("job_id", jobId)
      .or(`status.eq.pending,and(status.eq.failed,retry_count.lt.${MAX_RETRIES_PER_PROSPECT})`)
      .order("item_index", { ascending: true })
      .limit(1)
      .single() as { data: BatchProspectItem | null; error: any }

    // If no more items, mark job as completed
    if (itemError || !nextItem) {
      // Check if there are any remaining items
      const { count } = await (supabase as any)
        .from("batch_prospect_items")
        .select("*", { count: "exact", head: true })
        .eq("job_id", jobId)
        .in("status", ["pending", "processing"]) as { count: number | null }

      if (!count || count === 0) {
        // Job is complete
        await (supabase as any)
          .from("batch_prospect_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId)

        const response: ProcessNextItemResponse = {
          job_status: "completed",
          progress: {
            completed: job.completed_count,
            total: job.total_prospects,
            failed: job.failed_count,
          },
          has_more: false,
          message: "Batch processing completed",
        }
        return NextResponse.json(response)
      }

      // Something unexpected
      const response: ProcessNextItemResponse = {
        job_status: job.status as BatchJobStatus,
        progress: {
          completed: job.completed_count,
          total: job.total_prospects,
          failed: job.failed_count,
        },
        has_more: false,
        message: "No items to process",
      }
      return NextResponse.json(response)
    }

    // Mark item as processing
    await (supabase as any)
      .from("batch_prospect_items")
      .update({
        status: "processing",
        processing_started_at: new Date().toISOString(),
        retry_count: nextItem.status === "failed" ? nextItem.retry_count + 1 : 0,
      })
      .eq("id", nextItem.id)

    // Get user's API key for OpenRouter
    let apiKey: string | undefined
    try {
      apiKey = (await getEffectiveApiKey(user.id, "openrouter")) || undefined
    } catch {
      // Fall back to env key
      apiKey = undefined
    }

    // Generate the prospect report
    console.log(
      `[BatchProcess] Processing item ${nextItem.item_index + 1}/${job.total_prospects}: ${nextItem.prospect_name}`
    )

    const reportResult = await generateProspectReport({
      prospect: nextItem.input_data,
      enableWebSearch: job.settings?.enable_web_search ?? true,
      generateRomyScore: job.settings?.generate_romy_score ?? true,
      apiKey,
    })

    const processingDuration = Date.now() - startTime

    // Update item with results
    if (reportResult.success) {
      await (supabase as any)
        .from("batch_prospect_items")
        .update({
          status: "completed",
          report_content: reportResult.report_content,
          romy_score: reportResult.romy_score,
          romy_score_tier: reportResult.romy_score_tier,
          capacity_rating: reportResult.capacity_rating,
          estimated_net_worth: reportResult.estimated_net_worth,
          estimated_gift_capacity: reportResult.estimated_gift_capacity,
          recommended_ask: reportResult.recommended_ask,
          search_queries_used: reportResult.search_queries_used,
          sources_found: reportResult.sources_found,
          tokens_used: reportResult.tokens_used,
          model_used: "openrouter:x-ai/grok-4.1-fast",
          processing_completed_at: new Date().toISOString(),
          processing_duration_ms: processingDuration,
          error_message: null,
        })
        .eq("id", nextItem.id)

      console.log(
        `[BatchProcess] Completed item ${nextItem.item_index + 1}: RōmyScore ${reportResult.romy_score || "N/A"}`
      )
    } else {
      // Mark as failed
      await (supabase as any)
        .from("batch_prospect_items")
        .update({
          status: "failed",
          error_message: reportResult.error_message,
          processing_completed_at: new Date().toISOString(),
          processing_duration_ms: processingDuration,
          last_retry_at: new Date().toISOString(),
        })
        .eq("id", nextItem.id)

      console.error(
        `[BatchProcess] Failed item ${nextItem.item_index + 1}: ${reportResult.error_message}`
      )
    }

    // Fetch updated job counts (trigger will have updated them)
    const { data: updatedJob } = await (supabase as any)
      .from("batch_prospect_jobs")
      .select("*")
      .eq("id", jobId)
      .single() as { data: BatchProspectJob | null }

    // Check if there are more items
    const { count: remainingCount } = await (supabase as any)
      .from("batch_prospect_items")
      .select("*", { count: "exact", head: true })
      .eq("job_id", jobId)
      .or(`status.eq.pending,and(status.eq.failed,retry_count.lt.${MAX_RETRIES_PER_PROSPECT})`) as { count: number | null }

    const hasMore = (remainingCount || 0) > 0

    // Fetch the updated item
    const { data: updatedItem } = await (supabase as any)
      .from("batch_prospect_items")
      .select("*")
      .eq("id", nextItem.id)
      .single() as { data: BatchProspectItem | null }

    const response: ProcessNextItemResponse = {
      item: updatedItem as BatchProspectItem,
      job_status: updatedJob?.status as BatchJobStatus || "processing",
      progress: {
        completed: updatedJob?.completed_count || 0,
        total: updatedJob?.total_prospects || 0,
        failed: updatedJob?.failed_count || 0,
      },
      has_more: hasMore,
      message: reportResult.success
        ? `Processed ${nextItem.prospect_name}`
        : `Failed to process ${nextItem.prospect_name}: ${reportResult.error_message}`,
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
