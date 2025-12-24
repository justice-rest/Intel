/**
 * Batch Processing API - Parallel Processing
 * POST: Process multiple pending items in parallel
 *
 * This endpoint processes multiple prospects concurrently for faster throughput.
 * The number of concurrent prospects is determined by the user's plan.
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  BatchProspectItem,
  BatchProspectJob,
  BatchJobStatus,
  SonarGrokReportResult,
} from "@/lib/batch-processing"
import { generateComprehensiveReportWithTools } from "@/lib/batch-processing/report-generator"
import { getEffectiveApiKey } from "@/lib/user-keys"
import { MAX_RETRIES_PER_PROSPECT } from "@/lib/batch-processing/config"
import { getCustomerData, normalizePlanId } from "@/lib/subscription/autumn-client"
import {
  sendEmail,
  getBatchCompleteEmailHtml,
  getBatchCompleteEmailSubject,
} from "@/lib/email"

// Allow up to 2 minutes for processing
export const runtime = "nodejs"
export const maxDuration = 120

// Concurrent processing limits by plan
const CONCURRENT_LIMITS: Record<string, number> = {
  growth: 5,
  pro: 10,
  scale: 15,
}

const DEFAULT_CONCURRENT_LIMIT = 5

interface ProcessBatchResponse {
  items_processed: number
  items_succeeded: number
  items_failed: number
  job_status: BatchJobStatus
  progress: {
    completed: number
    total: number
    failed: number
  }
  has_more: boolean
  processing_time_ms: number
  message: string
}

async function getConcurrentLimit(userId: string): Promise<number> {
  try {
    const customerData = await getCustomerData(userId)

    if (customerData?.products && customerData.products.length > 0) {
      // Check for active or trialing products
      const activeProduct = customerData.products.find(
        (p: { status: string }) => p.status === "active" || p.status === "trialing"
      )

      if (activeProduct) {
        const planId = normalizePlanId(activeProduct.id)
        if (planId && CONCURRENT_LIMITS[planId]) {
          return CONCURRENT_LIMITS[planId]
        }
      }
    }
  } catch (error) {
    console.error("[BatchProcessParallel] Error fetching plan:", error)
  }

  return DEFAULT_CONCURRENT_LIMIT
}

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

    // Get user's concurrent processing limit
    const concurrentLimit = await getConcurrentLimit(user.id)

    console.log(`[BatchProcessParallel] User ${user.id} has concurrent limit: ${concurrentLimit}`)

    // Fetch job to check status and get settings
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
      const response: ProcessBatchResponse = {
        items_processed: 0,
        items_succeeded: 0,
        items_failed: 0,
        job_status: job.status as BatchJobStatus,
        progress: {
          completed: job.completed_count,
          total: job.total_prospects,
          failed: job.failed_count,
        },
        has_more: false,
        processing_time_ms: Date.now() - startTime,
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

    // Get multiple pending items (up to concurrent limit)
    const { data: pendingItems, error: itemError } = await (supabase as any)
      .from("batch_prospect_items")
      .select("*")
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .in("status", ["pending"])
      .order("item_index", { ascending: true })
      .limit(concurrentLimit) as { data: BatchProspectItem[] | null; error: any }

    let itemsToProcess: BatchProspectItem[] = pendingItems || []

    // If not enough pending items, check for retryable failed items
    if (itemsToProcess.length < concurrentLimit && !itemError) {
      const remainingSlots = concurrentLimit - itemsToProcess.length
      const { data: failedItems } = await (supabase as any)
        .from("batch_prospect_items")
        .select("*")
        .eq("job_id", jobId)
        .eq("user_id", user.id)
        .eq("status", "failed")
        .lt("retry_count", MAX_RETRIES_PER_PROSPECT)
        .order("item_index", { ascending: true })
        .limit(remainingSlots) as { data: BatchProspectItem[] | null }

      if (failedItems) {
        itemsToProcess = [...itemsToProcess, ...failedItems]
      }
    }

    // If query had an error, return error
    if (itemError) {
      console.error(`[BatchProcessParallel] Error querying items:`, itemError)
      return NextResponse.json(
        { error: `Failed to query items: ${itemError.message}` },
        { status: 500 }
      )
    }

    // If no items to process, check if job should be completed
    if (itemsToProcess.length === 0) {
      const { count: remainingCount } = await (supabase as any)
        .from("batch_prospect_items")
        .select("*", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("user_id", user.id)
        .in("status", ["pending", "processing"]) as { count: number | null }

      if (remainingCount === 0) {
        await (supabase as any)
          .from("batch_prospect_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId)
          .eq("user_id", user.id)

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

        const response: ProcessBatchResponse = {
          items_processed: 0,
          items_succeeded: 0,
          items_failed: 0,
          job_status: "completed",
          progress: {
            completed: finalJob?.completed_count || job.completed_count,
            total: finalJob?.total_prospects || job.total_prospects,
            failed: finalJob?.failed_count || job.failed_count,
          },
          has_more: false,
          processing_time_ms: Date.now() - startTime,
          message: "Batch processing completed",
        }
        return NextResponse.json(response)
      }

      const response: ProcessBatchResponse = {
        items_processed: 0,
        items_succeeded: 0,
        items_failed: 0,
        job_status: job.status as BatchJobStatus,
        progress: {
          completed: job.completed_count,
          total: job.total_prospects,
          failed: job.failed_count,
        },
        has_more: (remainingCount ?? 0) > 0,
        processing_time_ms: Date.now() - startTime,
        message: "No items available to process",
      }
      return NextResponse.json(response)
    }

    // Mark all items as processing
    const itemIds = itemsToProcess.map(item => item.id)
    await (supabase as any)
      .from("batch_prospect_items")
      .update({
        status: "processing",
        processing_started_at: new Date().toISOString(),
      })
      .in("id", itemIds)

    // Get user's API key for OpenRouter
    let apiKey: string | undefined
    try {
      apiKey = (await getEffectiveApiKey(user.id, "openrouter")) || undefined
    } catch {
      apiKey = undefined
    }

    // Get LinkUp API key from environment (parallel search enhancement)
    const linkupApiKey = process.env.LINKUP_API_KEY

    console.log(
      `[BatchProcessParallel] Processing ${itemsToProcess.length} items in parallel for job ${jobId}`
    )
    console.log(
      `[BatchProcessParallel] LinkUp parallel search: ${linkupApiKey ? "ENABLED" : "DISABLED"}`
    )

    // Process all items in parallel
    const results = await Promise.allSettled(
      itemsToProcess.map(async (item) => {
        const itemStartTime = Date.now()

        // Update retry count if this is a retry
        if (item.status === "failed") {
          await (supabase as any)
            .from("batch_prospect_items")
            .update({ retry_count: item.retry_count + 1 })
            .eq("id", item.id)
        }

        // Use Perplexity Sonar Pro for grounded, citation-first research
        let reportResult: SonarGrokReportResult | null = null
        let errorMessage: string | null = null

        try {
          const result = await generateComprehensiveReportWithTools({
            prospect: item.input_data,
            apiKey,
            linkupApiKey, // Enable parallel LinkUp search
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
              processing_duration_ms: Date.now() - itemStartTime,
            }
          } else {
            errorMessage = result.error_message || "Report generation failed"
          }
        } catch (error) {
          console.error(`[BatchProcessParallel] Research failed for ${item.prospect_name}:`, error)
          // Handle HTML error responses from OpenRouter
          const errMsg = error instanceof Error ? error.message : String(error)
          if (errMsg.includes("<!DOCTYPE") || errMsg.includes("<html") || errMsg.includes("An error")) {
            errorMessage = "API returned an error page - will retry"
          } else {
            errorMessage = errMsg
          }
        }

        const processingDuration = Date.now() - itemStartTime

        if (reportResult) {
          const { structured_data } = reportResult

          await (supabase as any)
            .from("batch_prospect_items")
            .update({
              status: "completed",
              report_content: reportResult.report_content,

              // Core metrics from structured data
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
            .eq("id", item.id)

          // Generate embedding for RAG in background (fire-and-forget)
          Promise.resolve().then(async () => {
            try {
              const { generateBatchReportEmbedding, isBatchReportsRAGEnabled } = await import("@/lib/batch-reports")
              if (!isBatchReportsRAGEnabled()) return

              await generateBatchReportEmbedding(
                {
                  itemId: item.id,
                  reportContent: reportResult!.report_content,
                  prospectName: item.prospect_name || item.input_data.name,
                },
                apiKey || process.env.OPENROUTER_API_KEY || ""
              )
            } catch (err) {
              console.error("[BatchProcessor] Failed to generate report embedding:", err)
            }
          }).catch(console.error)

          return { success: true, itemId: item.id, name: item.prospect_name }
        } else {
          await (supabase as any)
            .from("batch_prospect_items")
            .update({
              status: "failed",
              error_message: errorMessage || "Unknown error",
              processing_completed_at: new Date().toISOString(),
              processing_duration_ms: processingDuration,
              last_retry_at: new Date().toISOString(),
            })
            .eq("id", item.id)

          return { success: false, itemId: item.id, name: item.prospect_name, error: errorMessage }
        }
      })
    )

    // Count successes and failures
    let itemsSucceeded = 0
    let itemsFailed = 0
    results.forEach(result => {
      if (result.status === "fulfilled" && result.value.success) {
        itemsSucceeded++
      } else {
        itemsFailed++
      }
    })

    // Fetch updated job counts
    const { data: updatedJob } = await (supabase as any)
      .from("batch_prospect_jobs")
      .select("*")
      .eq("id", jobId)
      .single() as { data: BatchProspectJob | null }

    // Check if there are more items
    const { count: pendingCount } = await (supabase as any)
      .from("batch_prospect_items")
      .select("*", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .eq("status", "pending") as { count: number | null }

    const { count: retryableCount } = await (supabase as any)
      .from("batch_prospect_items")
      .select("*", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .eq("status", "failed")
      .lt("retry_count", MAX_RETRIES_PER_PROSPECT) as { count: number | null }

    const hasMore = ((pendingCount || 0) + (retryableCount || 0)) > 0

    const processingTime = Date.now() - startTime
    console.log(
      `[BatchProcessParallel] Completed batch: ${itemsSucceeded} succeeded, ${itemsFailed} failed in ${processingTime}ms`
    )

    const response: ProcessBatchResponse = {
      items_processed: itemsToProcess.length,
      items_succeeded: itemsSucceeded,
      items_failed: itemsFailed,
      job_status: updatedJob?.status as BatchJobStatus || "processing",
      progress: {
        completed: updatedJob?.completed_count || 0,
        total: updatedJob?.total_prospects || 0,
        failed: updatedJob?.failed_count || 0,
      },
      has_more: hasMore,
      processing_time_ms: processingTime,
      message: `Processed ${itemsToProcess.length} prospects (${itemsSucceeded} succeeded, ${itemsFailed} failed)`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[BatchProcessParallel] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    )
  }
}
