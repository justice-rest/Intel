/**
 * Discovery Job Detail API
 * GET: Get job details with candidates
 * PATCH: Update job status
 * DELETE: Delete job
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  DiscoveryJob,
  DiscoveryCandidate,
  DiscoveryJobDetailResponse,
} from "@/lib/discovery"

export const runtime = "nodejs"
export const maxDuration = 60

// ============================================================================
// GET: Get job details with candidates
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

    // Fetch job
    const { data: job, error: jobError } = await (supabase as any)
      .from("discovery_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Discovery job not found" },
        { status: 404 }
      )
    }

    // Fetch candidates
    const { data: candidates, error: candidatesError } = await (supabase as any)
      .from("discovery_candidates")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true })

    if (candidatesError) {
      console.error("[Discovery API] Error fetching candidates:", candidatesError)
    }

    // Calculate progress
    const totalCandidates = job.total_candidates || 0
    const processedCount = (job.matched_count || 0) + (job.unmatched_count || 0) + (job.discarded_count || 0)
    const percentage = totalCandidates > 0
      ? Math.round((processedCount / totalCandidates) * 100)
      : 0

    const response: DiscoveryJobDetailResponse = {
      job: job as DiscoveryJob,
      candidates: (candidates || []) as DiscoveryCandidate[],
      progress: {
        percentage,
        estimated_remaining_ms: undefined,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[Discovery API] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
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

    // Only allow certain fields to be updated
    const allowedFields = ["status", "name", "description"]
    const updates: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    // SECURITY: Validate status field if provided
    if (updates.status !== undefined) {
      const validStatuses = ["pending", "cancelled"] // Users can only set these statuses
      if (!validStatuses.includes(updates.status as string)) {
        return NextResponse.json(
          { error: "Invalid status. Only 'pending' or 'cancelled' allowed" },
          { status: 400 }
        )
      }
    }

    // Validate name if provided (non-empty string)
    if (updates.name !== undefined) {
      if (typeof updates.name !== "string" || !updates.name.trim()) {
        return NextResponse.json(
          { error: "Job name must be a non-empty string" },
          { status: 400 }
        )
      }
      updates.name = (updates.name as string).trim()
    }

    // Validate description if provided (string or null)
    if (updates.description !== undefined && updates.description !== null) {
      if (typeof updates.description !== "string") {
        return NextResponse.json(
          { error: "Description must be a string" },
          { status: 400 }
        )
      }
      updates.description = (updates.description as string).trim() || null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      )
    }

    updates.updated_at = new Date().toISOString()

    // Update job
    const { data: job, error } = await (supabase as any)
      .from("discovery_jobs")
      .update(updates)
      .eq("id", jobId)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error || !job) {
      return NextResponse.json(
        { error: "Failed to update discovery job" },
        { status: 500 }
      )
    }

    return NextResponse.json({ job: job as DiscoveryJob })
  } catch (error) {
    console.error("[Discovery API] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE: Delete job and candidates
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

    // SECURITY: First verify the job belongs to the user BEFORE deleting anything
    const { data: existingJob, error: fetchError } = await (supabase as any)
      .from("discovery_jobs")
      .select("id")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !existingJob) {
      return NextResponse.json(
        { error: "Discovery job not found" },
        { status: 404 }
      )
    }

    // Now safe to delete candidates - job ownership verified
    // Also filter by user_id for defense in depth
    await (supabase as any)
      .from("discovery_candidates")
      .delete()
      .eq("job_id", jobId)
      .eq("user_id", user.id)

    // Delete job
    const { error } = await (supabase as any)
      .from("discovery_jobs")
      .delete()
      .eq("id", jobId)
      .eq("user_id", user.id)

    if (error) {
      console.error("[Discovery API] Error deleting job:", error)
      return NextResponse.json(
        { error: "Failed to delete discovery job" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Discovery API] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
