/**
 * Batch Job Detail API
 * GET: Get job details with items
 * DELETE: Delete a batch job
 * PATCH: Update job status (pause/resume/cancel)
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { BatchJobDetailResponse, BatchJobStatus, BatchProspectJob, BatchProspectItem } from "@/lib/batch-processing"
import {
  calculateEstimatedTimeRemaining,
  DEFAULT_DELAY_BETWEEN_PROSPECTS_MS,
} from "@/lib/batch-processing/config"

export const runtime = "nodejs"

// ============================================================================
// GET: Get job details with items
// ============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
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

    // Fetch job (using type assertion since table is added via migration)
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

    // Parse query params for items filtering
    const { searchParams } = new URL(request.url)
    const itemStatus = searchParams.get("item_status")
    const includeItems = searchParams.get("include_items") !== "false"
    const itemLimit = parseInt(searchParams.get("item_limit") || "100", 10)
    const itemOffset = parseInt(searchParams.get("item_offset") || "0", 10)

    let items: any[] = []

    if (includeItems) {
      let itemsQuery = (supabase as any)
        .from("batch_prospect_items")
        .select("*")
        .eq("job_id", jobId)
        .order("item_index", { ascending: true })
        .range(itemOffset, itemOffset + itemLimit - 1)

      if (itemStatus) {
        itemsQuery = itemsQuery.eq("status", itemStatus)
      }

      const { data: itemsData, error: itemsError } = await itemsQuery as { data: BatchProspectItem[] | null; error: any }

      if (itemsError) {
        console.error("[BatchAPI] Failed to fetch items:", itemsError)
      } else {
        items = itemsData || []
      }
    }

    // Calculate progress
    const completed = job.completed_count || 0
    const total = job.total_prospects || 0
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

    const remaining = total - completed - (job.failed_count || 0) - (job.skipped_count || 0)
    const delayMs = job.settings?.delay_between_prospects_ms || DEFAULT_DELAY_BETWEEN_PROSPECTS_MS
    const estimatedRemainingMs = calculateEstimatedTimeRemaining(remaining, delayMs)

    const response: BatchJobDetailResponse = {
      job,
      items,
      progress: {
        percentage,
        estimated_remaining_ms: estimatedRemainingMs,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[BatchAPI] Error fetching job:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}

// ============================================================================
// PATCH: Update job status
// ============================================================================

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
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

    const body = await request.json()
    const newStatus: BatchJobStatus = body.status

    // Validate status transition
    const validStatuses: BatchJobStatus[] = [
      "pending",
      "processing",
      "paused",
      "cancelled",
    ]

    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    // Fetch current job (using type assertion since table is added via migration)
    const { data: job, error: fetchError } = await (supabase as any)
      .from("batch_prospect_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single() as { data: BatchProspectJob | null; error: any }

    if (fetchError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      )
    }

    // Check if status transition is valid
    // Allow resetting completed/failed jobs to "pending" for reprocessing
    if ((job.status === "completed" || job.status === "failed") && newStatus !== "pending") {
      return NextResponse.json(
        { error: `Can only reset ${job.status} job to pending for reprocessing` },
        { status: 400 }
      )
    }

    // Update job status
    const updateData: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }

    if (newStatus === "processing" && !job.started_at) {
      updateData.started_at = new Date().toISOString()
    }

    // If resetting to pending, also reset any non-completed items
    if (newStatus === "pending" && (job.status === "completed" || job.status === "failed")) {
      // Reset items that weren't successfully processed
      await (supabase as any)
        .from("batch_prospect_items")
        .update({
          status: "pending",
          error_message: null,
          retry_count: 0,
        })
        .eq("job_id", jobId)
        .neq("status", "completed") // Don't reset items that were successfully completed

      // Clear job timestamps for restart
      updateData.started_at = null
      updateData.completed_at = null
    }

    const { data: updatedJob, error: updateError } = await (supabase as any)
      .from("batch_prospect_jobs")
      .update(updateData)
      .eq("id", jobId)
      .select()
      .single() as { data: BatchProspectJob | null; error: any }

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update job: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ job: updatedJob })
  } catch (error) {
    console.error("[BatchAPI] Error updating job:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE: Delete a batch job
// ============================================================================

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
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

    // Delete job (items will cascade delete due to foreign key)
    const { error } = await (supabase as any)
      .from("batch_prospect_jobs")
      .delete()
      .eq("id", jobId)
      .eq("user_id", user.id) as { error: any }

    if (error) {
      return NextResponse.json(
        { error: `Failed to delete job: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[BatchAPI] Error deleting job:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
