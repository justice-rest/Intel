/**
 * Start Discovery Job API
 * POST: Start a discovery run using FindAll API
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { DiscoveryJob, StartDiscoveryResponse } from "@/lib/discovery"
import { getDiscoveryPlanLimits } from "@/lib/discovery/config"
import {
  executeProspectDiscovery,
  getFindAllStatus,
} from "@/lib/parallel/findall"

export const runtime = "nodejs"
export const maxDuration = 600 // 10 minutes max for discovery

// ============================================================================
// POST: Start discovery run
// ============================================================================

export async function POST(
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

    // Check FindAll availability
    const findAllStatus = getFindAllStatus()
    if (!findAllStatus.available) {
      return NextResponse.json(
        { error: "Discovery service is currently unavailable" },
        { status: 503 }
      )
    }

    // RATE LIMITING: Check daily job limit
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString()

    const { count: todayJobCount, error: countError } = await (supabase as any)
      .from("discovery_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("started_at", todayIso)
      .in("status", ["running", "completed"]) // Only count started jobs

    if (countError) {
      console.error("[Discovery API] Error checking rate limit:", countError)
    }

    // Get plan limits (default to pro for now - in production, fetch from user profile)
    const planLimits = getDiscoveryPlanLimits("pro")

    if ((todayJobCount ?? 0) >= planLimits.daily_jobs) {
      return NextResponse.json(
        {
          error: `Daily limit reached. You can run ${planLimits.daily_jobs} discovery jobs per day.`,
          limit: planLimits.daily_jobs,
          used: todayJobCount,
        },
        { status: 429 }
      )
    }

    // ATOMIC: Fetch and update job status in one operation to prevent race conditions
    // This ensures only ONE request can start the job even with double-clicks or concurrent requests
    const { data: job, error: jobError } = await (supabase as any)
      .from("discovery_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("user_id", user.id)
      .eq("status", "pending") // CRITICAL: Only update if still pending
      .select()
      .single()

    if (jobError || !job) {
      // Check if job exists but is not pending (already started/completed)
      const { data: existingJob } = await (supabase as any)
        .from("discovery_jobs")
        .select("status")
        .eq("id", jobId)
        .eq("user_id", user.id)
        .single()

      if (existingJob) {
        return NextResponse.json(
          { error: `Cannot start job with status: ${existingJob.status}` },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: "Discovery job not found" },
        { status: 404 }
      )
    }

    try {
      // Build full objective with location
      const fullObjective = job.location
        ? `${job.objective} in ${job.location}`
        : job.objective

      // Build exclude list
      const excludeList = job.exclude_names?.map((name: string) => ({
        name,
        url: "",
      }))

      // IMPORTANT: Normalize entity_type to valid plural forms
      // The FindAll API requires: "people", "companies", "products", "events", "locations", "houses"
      const entityTypeMap: Record<string, string> = {
        person: "people",
        people: "people",
        company: "companies",
        companies: "companies",
        product: "products",
        products: "products",
        philanthropist: "people",
        executive: "people",
        investor: "people",
        entrepreneur: "people",
      }
      const validEntityType = entityTypeMap[job.settings.entity_type.toLowerCase()] || "people"

      // Debug: Log exact parameters being sent to FindAll
      const discoveryParams = {
        objective: fullObjective,
        entityType: validEntityType,
        matchConditions: job.match_conditions,
        matchLimit: job.settings.match_limit,
        generator: job.settings.generator,
        excludeList: excludeList?.length ? excludeList : undefined,
        metadata: {
          source: "labs_discovery",
          job_id: jobId,
          user_id: user.id,
        },
      }
      console.log("[Discovery API] Calling FindAll with params:", JSON.stringify(discoveryParams, null, 2))

      // Execute discovery
      const result = await executeProspectDiscovery(discoveryParams)

      // Store ALL candidates (matched, unmatched, discarded) for full visibility
      if (result.allCandidates.length > 0) {
        const candidateRecords = result.allCandidates.map((prospect) => ({
          job_id: jobId,
          user_id: user.id,
          candidate_id: prospect.candidateId,
          name: prospect.name,
          description: prospect.description || null,
          url: prospect.url,
          status: prospect.matchStatus,
          match_results: prospect.matchResults || null,
          sources: prospect.sources || [],
        }))

        await (supabase as any)
          .from("discovery_candidates")
          .insert(candidateRecords)
      }

      // Update job with results
      const { data: updatedJob } = await (supabase as any)
        .from("discovery_jobs")
        .update({
          status: "completed",
          findall_id: result.findallId,
          total_candidates: result.allCandidates.length,
          matched_count: result.prospects.length,
          unmatched_count: result.allCandidates.filter(
            (c) => c.matchStatus === "unmatched"
          ).length,
          discarded_count: result.allCandidates.filter(
            (c) => c.matchStatus === "discarded"
          ).length,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .select()
        .single()

      const response: StartDiscoveryResponse = {
        job: updatedJob as DiscoveryJob,
        findall_id: result.findallId,
        message: `Discovery completed: ${result.prospects.length} prospects found`,
      }

      return NextResponse.json(response)
    } catch (discoveryError) {
      // Update job with error
      const errorMessage =
        discoveryError instanceof Error
          ? discoveryError.message
          : "Discovery failed"

      await (supabase as any)
        .from("discovery_jobs")
        .update({
          status: "failed",
          error_message: errorMessage,
          last_error_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)

      console.error("[Discovery API] Discovery error:", discoveryError)
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("[Discovery API] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
