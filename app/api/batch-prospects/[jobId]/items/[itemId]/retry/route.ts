/**
 * Individual Item Retry API
 *
 * POST: Retry a specific failed item within a batch job
 *
 * This endpoint allows retrying individual failed items without re-running
 * the entire batch. It's useful for cases where a single item failed due
 * to a transient error.
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  BatchProspectItem,
  BatchProspectJob,
  SonarGrokReportResult,
} from "@/lib/batch-processing"
import { generateComprehensiveReportWithTools } from "@/lib/batch-processing/report-generator"
import { getEffectiveApiKey } from "@/lib/user-keys"
import {
  MAX_RETRIES_PER_PROSPECT,
  normalizeProspectAddress,
  classifyBatchError,
} from "@/lib/batch-processing/config"

export const runtime = "nodejs"
export const maxDuration = 120

interface RetryItemResponse {
  success: boolean
  item: BatchProspectItem
  message: string
  processing_time_ms: number
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string; itemId: string }> }
) {
  const startTime = Date.now()

  try {
    const { jobId, itemId } = await params
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

    // Fetch the job to verify ownership
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

    // Fetch the item
    const { data: item, error: itemError } = await (supabase as any)
      .from("batch_prospect_items")
      .select("*")
      .eq("id", itemId)
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .single() as { data: BatchProspectItem | null; error: any }

    if (itemError || !item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      )
    }

    // Check if item can be retried
    if (item.status === "completed") {
      return NextResponse.json(
        { error: "Item is already completed" },
        { status: 400 }
      )
    }

    if (item.status === "processing") {
      return NextResponse.json(
        { error: "Item is currently being processed" },
        { status: 400 }
      )
    }

    // Check retry limit
    if (item.retry_count >= MAX_RETRIES_PER_PROSPECT) {
      return NextResponse.json(
        {
          error: `Maximum retry limit reached (${MAX_RETRIES_PER_PROSPECT} retries)`,
          retry_count: item.retry_count,
        },
        { status: 400 }
      )
    }

    // Mark item as processing
    await (supabase as any)
      .from("batch_prospect_items")
      .update({
        status: "processing",
        processing_started_at: new Date().toISOString(),
        retry_count: item.retry_count + 1,
        error_message: null,
      })
      .eq("id", itemId)

    // Get API key
    let apiKey: string | undefined
    try {
      apiKey = (await getEffectiveApiKey(user.id, "openrouter")) || undefined
    } catch {
      apiKey = undefined
    }

    if (!apiKey) {
      apiKey = process.env.OPENROUTER_API_KEY
    }

    if (!apiKey) {
      await (supabase as any)
        .from("batch_prospect_items")
        .update({
          status: "failed",
          error_message: "No API key available",
          processing_completed_at: new Date().toISOString(),
        })
        .eq("id", itemId)

      return NextResponse.json(
        { error: "No API key available. Add your OpenRouter key in Settings." },
        { status: 400 }
      )
    }

    console.log(`[RetryItem] Retrying item ${itemId}: ${item.prospect_name}`)

    // Process the item
    let reportResult: SonarGrokReportResult | null = null
    let errorMessage: string | null = null

    try {
      // Prepare prospect data with normalization
      const mergedInputData: Record<string, string | undefined> = {
        ...(item.input_data as Record<string, string | undefined>),
        address: item.input_data?.address || item.prospect_address || undefined,
        city: item.input_data?.city || item.prospect_city || undefined,
        state: item.input_data?.state || item.prospect_state || undefined,
        zip: item.input_data?.zip || item.prospect_zip || undefined,
      }
      const enrichedProspect = normalizeProspectAddress(mergedInputData)

      const result = await generateComprehensiveReportWithTools({
        prospect: enrichedProspect,
        apiKey,
      })

      if (result.success) {
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
      const classifiedError = classifyBatchError(error)
      errorMessage = classifiedError.userMessage
      console.error(`[RetryItem] Error processing ${item.prospect_name}:`, classifiedError.message)
    }

    const processingDuration = Date.now() - startTime

    // Update item with results
    let updatedItem: BatchProspectItem

    if (reportResult) {
      const { structured_data } = reportResult

      const { data: updated } = await (supabase as any)
        .from("batch_prospect_items")
        .update({
          status: "completed",
          report_content: reportResult.report_content,
          romy_score: structured_data.romy_score,
          romy_score_tier: structured_data.romy_score_tier,
          capacity_rating: structured_data.capacity_rating,
          estimated_net_worth: structured_data.estimated_net_worth,
          estimated_gift_capacity: structured_data.estimated_gift_capacity,
          recommended_ask: structured_data.recommended_ask,
          sources_found: reportResult.sources,
          tokens_used: reportResult.tokens_used,
          model_used: reportResult.model_used,
          processing_completed_at: new Date().toISOString(),
          processing_duration_ms: processingDuration,
          error_message: null,
        })
        .eq("id", itemId)
        .select()
        .single() as { data: BatchProspectItem | null }

      updatedItem = updated || { ...item, status: "completed" } as BatchProspectItem

      console.log(`[RetryItem] Successfully processed ${item.prospect_name}`)

      return NextResponse.json({
        success: true,
        item: updatedItem,
        message: "Item processed successfully",
        processing_time_ms: processingDuration,
      } as RetryItemResponse)
    } else {
      const { data: updated } = await (supabase as any)
        .from("batch_prospect_items")
        .update({
          status: "failed",
          error_message: errorMessage || "Unknown error",
          processing_completed_at: new Date().toISOString(),
          processing_duration_ms: processingDuration,
          last_retry_at: new Date().toISOString(),
        })
        .eq("id", itemId)
        .select()
        .single() as { data: BatchProspectItem | null }

      updatedItem = updated || { ...item, status: "failed" } as BatchProspectItem

      console.log(`[RetryItem] Failed to process ${item.prospect_name}: ${errorMessage}`)

      return NextResponse.json({
        success: false,
        item: updatedItem,
        message: errorMessage || "Processing failed",
        processing_time_ms: processingDuration,
      } as RetryItemResponse)
    }
  } catch (error) {
    console.error("[RetryItem] Error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Retry failed",
        processing_time_ms: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}
