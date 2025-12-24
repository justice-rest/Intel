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
  SonarGrokReportResult,
} from "@/lib/batch-processing"
import {
  generateComprehensiveReportWithTools,
} from "@/lib/batch-processing/report-generator"
import type { GenerateReportResult } from "@/lib/batch-processing/report-generator"
import { getEffectiveApiKey } from "@/lib/user-keys"
import { MAX_RETRIES_PER_PROSPECT } from "@/lib/batch-processing/config"
import {
  sendEmail,
  getBatchCompleteEmailHtml,
  getBatchCompleteEmailSubject,
} from "@/lib/email"

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
    // Using limit(1) without .single() to avoid errors on empty results
    const { data: pendingItems, error: itemError } = await (supabase as any)
      .from("batch_prospect_items")
      .select("*")
      .eq("job_id", jobId)
      .eq("user_id", user.id)  // Explicitly filter by user for safety
      .in("status", ["pending"])  // First check for pending items
      .order("item_index", { ascending: true })
      .limit(1) as { data: BatchProspectItem[] | null; error: any }

    // Log for debugging
    console.log(`[BatchProcess] Query for pending items: jobId=${jobId}, found=${pendingItems?.length || 0}, error=${itemError?.message || 'none'}`)

    let nextItem: BatchProspectItem | null = pendingItems?.[0] || null

    // If no pending items, check for stale "processing" items (stuck for >5 min)
    if (!nextItem && !itemError) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data: staleItems } = await (supabase as any)
        .from("batch_prospect_items")
        .select("*")
        .eq("job_id", jobId)
        .eq("user_id", user.id)
        .eq("status", "processing")
        .lt("processing_started_at", fiveMinutesAgo)  // Stuck for >5 min
        .order("item_index", { ascending: true })
        .limit(1) as { data: BatchProspectItem[] | null }

      nextItem = staleItems?.[0] || null
      if (nextItem) {
        console.log(`[BatchProcess] Found stale processing item: ${nextItem.prospect_name} (started ${nextItem.processing_started_at})`)
      }
    }

    // If no pending or stale items, check for failed items that can be retried
    if (!nextItem && !itemError) {
      const { data: failedItems } = await (supabase as any)
        .from("batch_prospect_items")
        .select("*")
        .eq("job_id", jobId)
        .eq("user_id", user.id)
        .eq("status", "failed")
        .lt("retry_count", MAX_RETRIES_PER_PROSPECT)
        .order("item_index", { ascending: true })
        .limit(1) as { data: BatchProspectItem[] | null }

      nextItem = failedItems?.[0] || null
      console.log(`[BatchProcess] Query for retry items: found=${failedItems?.length || 0}`)
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
      const { count: remainingCount, error: countError } = await (supabase as any)
        .from("batch_prospect_items")
        .select("*", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("user_id", user.id)
        .in("status", ["pending", "processing"]) as { count: number | null; error: any }

      console.log(`[BatchProcess] Remaining count: ${remainingCount}, error=${countError?.message || 'none'}`)

      // Only mark as completed if we successfully verified there are no remaining items
      if (countError) {
        console.error(`[BatchProcess] Error counting remaining items:`, countError)
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
        const { data: finalJob } = await (supabase as any)
          .from("batch_prospect_jobs")
          .select("*")
          .eq("id", jobId)
          .single() as { data: BatchProspectJob | null }

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
            subject: getBatchCompleteEmailSubject(finalJob?.name || job.name || "Batch Research"),
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
      console.warn(`[BatchProcess] Found ${remainingCount ?? 0} remaining items but couldn't fetch next item`)
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

    // Generate the prospect report using Grok 4.1 Fast + Exa web search (comprehensive mode)
    console.log(
      `[BatchProcess] Processing item ${nextItem.item_index + 1}/${job.total_prospects}: ${nextItem.prospect_name}`
    )

    let reportResult: SonarGrokReportResult | null = null
    let errorMessage: string | null = null

    try {
      // Use Perplexity Sonar Pro for grounded, citation-first research
      const result = await generateComprehensiveReportWithTools({
        prospect: nextItem.input_data,
        apiKey,
      })

      if (result.success) {
        // Convert GenerateReportResult to SonarGrokReportResult format
        reportResult = {
          report_content: result.report_content || "",
          structured_data: {
            romy_score: result.romy_score,
            romy_score_tier: result.romy_score_tier,
            capacity_rating: result.capacity_rating,
            estimated_net_worth: result.estimated_net_worth,
            estimated_gift_capacity: result.estimated_gift_capacity,
            recommended_ask: result.recommended_ask,
          },
          sources: result.sources_found || [],
          tokens_used: result.tokens_used || 0,
          model_used: "perplexity/sonar-pro",
          processing_duration_ms: Date.now() - startTime,
        }
      } else {
        errorMessage = result.error_message || "Report generation failed"
      }
    } catch (error) {
      console.error(`[BatchProcess] Comprehensive research failed:`, error)
      // Handle HTML error responses from OpenRouter
      const errMsg = error instanceof Error ? error.message : String(error)
      if (errMsg.includes("<!DOCTYPE") || errMsg.includes("<html") || errMsg.includes("An error")) {
        errorMessage = "API returned an error page - will retry"
      } else {
        errorMessage = errMsg
      }
    }

    const processingDuration = Date.now() - startTime

    // Update item with results
    if (reportResult) {
      const { structured_data } = reportResult

      await (supabase as any)
        .from("batch_prospect_items")
        .update({
          status: "completed",
          report_content: reportResult.report_content,

          // Core metrics
          romy_score: structured_data.romy_score,
          romy_score_tier: structured_data.romy_score_tier,
          capacity_rating: structured_data.capacity_rating,
          estimated_net_worth: structured_data.estimated_net_worth,
          estimated_gift_capacity: structured_data.estimated_gift_capacity,
          recommended_ask: structured_data.recommended_ask,

          // Structured JSONB data
          wealth_indicators: structured_data.wealth_indicators || null,
          business_details: structured_data.business_details || null,
          giving_history: structured_data.giving_history || null,
          affiliations: structured_data.affiliations || null,

          // Search metadata
          search_queries_used: ["Grok 4.1 Fast + Exa"],
          sources_found: reportResult.sources,
          tokens_used: reportResult.tokens_used,
          model_used: reportResult.model_used,
          processing_completed_at: new Date().toISOString(),
          processing_duration_ms: reportResult.processing_duration_ms,
          error_message: null,
        })
        .eq("id", nextItem.id)

      console.log(
        `[BatchProcess] Completed item ${nextItem.item_index + 1}: ` +
        `RōmyScore ${structured_data.romy_score || "N/A"}/41 (${structured_data.romy_score_tier || "N/A"})`
      )
    } else {
      // Mark as failed
      await (supabase as any)
        .from("batch_prospect_items")
        .update({
          status: "failed",
          error_message: errorMessage || "Unknown error",
          processing_completed_at: new Date().toISOString(),
          processing_duration_ms: processingDuration,
          last_retry_at: new Date().toISOString(),
        })
        .eq("id", nextItem.id)

      console.error(
        `[BatchProcess] Failed item ${nextItem.item_index + 1}: ${errorMessage}`
      )
    }

    // Fetch updated job counts (trigger will have updated them)
    const { data: updatedJob } = await (supabase as any)
      .from("batch_prospect_jobs")
      .select("*")
      .eq("id", jobId)
      .single() as { data: BatchProspectJob | null }

    // Check if there are more items - use simple status check
    const { count: pendingCount } = await (supabase as any)
      .from("batch_prospect_items")
      .select("*", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .eq("status", "pending") as { count: number | null }

    // Also check for retryable failed items
    const { count: retryableCount } = await (supabase as any)
      .from("batch_prospect_items")
      .select("*", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .eq("status", "failed")
      .lt("retry_count", MAX_RETRIES_PER_PROSPECT) as { count: number | null }

    const hasMore = ((pendingCount || 0) + (retryableCount || 0)) > 0

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
      message: reportResult
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
