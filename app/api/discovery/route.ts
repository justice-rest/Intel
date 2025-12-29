/**
 * Discovery API
 * POST: Create a new discovery job
 * GET: List user's discovery jobs
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  CreateDiscoveryJobRequest,
  CreateDiscoveryJobResponse,
  DiscoveryJobListResponse,
  DEFAULT_DISCOVERY_SETTINGS,
  DiscoveryJob,
} from "@/lib/discovery"
import {
  DISCOVERY_MAX_CONDITIONS,
  DISCOVERY_MAX_EXCLUSIONS,
  DISCOVERY_MIN_CANDIDATES,
  DISCOVERY_MAX_CANDIDATES,
  DISCOVERY_MAX_STORED_JOBS,
  getDiscoveryPlanLimits,
} from "@/lib/discovery/config"

export const runtime = "nodejs"
export const maxDuration = 60

// ============================================================================
// POST: Create a new discovery job
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

    // RATE LIMITING: Check total stored jobs limit
    const { count: totalJobs, error: countError } = await (supabase as any)
      .from("discovery_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)

    if (countError) {
      console.error("[Discovery API] Error checking job count:", countError)
    }

    if ((totalJobs ?? 0) >= DISCOVERY_MAX_STORED_JOBS) {
      return NextResponse.json(
        {
          error: `Maximum ${DISCOVERY_MAX_STORED_JOBS} discovery jobs allowed. Please delete old jobs to create new ones.`,
          limit: DISCOVERY_MAX_STORED_JOBS,
          used: totalJobs,
        },
        { status: 429 }
      )
    }

    // Parse request body
    const body: CreateDiscoveryJobRequest = await request.json()

    // Validate required fields with length limits
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Job name is required" },
        { status: 400 }
      )
    }
    if (body.name.length > 255) {
      return NextResponse.json(
        { error: "Job name must be 255 characters or less" },
        { status: 400 }
      )
    }

    if (!body.objective?.trim()) {
      return NextResponse.json(
        { error: "Discovery objective is required" },
        { status: 400 }
      )
    }
    if (body.objective.length > 2000) {
      return NextResponse.json(
        { error: "Objective must be 2000 characters or less" },
        { status: 400 }
      )
    }

    // Validate optional description length
    if (body.description && body.description.length > 5000) {
      return NextResponse.json(
        { error: "Description must be 5000 characters or less" },
        { status: 400 }
      )
    }

    // Validate optional location length
    if (body.location && body.location.length > 255) {
      return NextResponse.json(
        { error: "Location must be 255 characters or less" },
        { status: 400 }
      )
    }

    if (!body.match_conditions || !Array.isArray(body.match_conditions) || body.match_conditions.length === 0) {
      return NextResponse.json(
        { error: "At least one match condition is required" },
        { status: 400 }
      )
    }

    // Validate match conditions count
    if (body.match_conditions.length > DISCOVERY_MAX_CONDITIONS) {
      return NextResponse.json(
        { error: `Maximum ${DISCOVERY_MAX_CONDITIONS} match conditions allowed` },
        { status: 400 }
      )
    }

    // SECURITY: Validate each match condition structure and content
    for (let i = 0; i < body.match_conditions.length; i++) {
      const condition = body.match_conditions[i]

      // Must be an object
      if (!condition || typeof condition !== "object") {
        return NextResponse.json(
          { error: `Match condition ${i + 1} must be an object` },
          { status: 400 }
        )
      }

      // Must have name and description as non-empty strings
      if (typeof condition.name !== "string" || !condition.name.trim()) {
        return NextResponse.json(
          { error: `Match condition ${i + 1}: name must be a non-empty string` },
          { status: 400 }
        )
      }

      if (typeof condition.description !== "string" || !condition.description.trim()) {
        return NextResponse.json(
          { error: `Match condition ${i + 1}: description must be a non-empty string` },
          { status: 400 }
        )
      }

      // Sanitize: trim and limit length to prevent abuse
      const MAX_NAME_LENGTH = 100
      const MAX_DESC_LENGTH = 500

      if (condition.name.length > MAX_NAME_LENGTH) {
        return NextResponse.json(
          { error: `Match condition ${i + 1}: name must be ${MAX_NAME_LENGTH} characters or less` },
          { status: 400 }
        )
      }

      if (condition.description.length > MAX_DESC_LENGTH) {
        return NextResponse.json(
          { error: `Match condition ${i + 1}: description must be ${MAX_DESC_LENGTH} characters or less` },
          { status: 400 }
        )
      }

      // Sanitize the condition
      body.match_conditions[i] = {
        name: condition.name.trim(),
        description: condition.description.trim(),
      }
    }

    // Validate exclusions
    if (body.exclude_names) {
      if (!Array.isArray(body.exclude_names)) {
        return NextResponse.json(
          { error: "exclude_names must be an array" },
          { status: 400 }
        )
      }

      if (body.exclude_names.length > DISCOVERY_MAX_EXCLUSIONS) {
        return NextResponse.json(
          { error: `Maximum ${DISCOVERY_MAX_EXCLUSIONS} exclusions allowed` },
          { status: 400 }
        )
      }

      // Validate each exclusion is a non-empty string
      for (let i = 0; i < body.exclude_names.length; i++) {
        const name = body.exclude_names[i]
        if (typeof name !== "string" || !name.trim()) {
          return NextResponse.json(
            { error: `Exclusion ${i + 1} must be a non-empty string` },
            { status: 400 }
          )
        }
        // Limit length to prevent abuse
        if (name.length > 200) {
          return NextResponse.json(
            { error: `Exclusion ${i + 1} must be 200 characters or less` },
            { status: 400 }
          )
        }
        // Sanitize
        body.exclude_names[i] = name.trim()
      }
    }

    // Get plan limits (default to pro for now)
    const planLimits = getDiscoveryPlanLimits("pro")

    // Validate settings if provided
    if (body.settings) {
      // Validate generator if provided
      const validGenerators = ["base", "core", "pro", "preview"]
      if (body.settings.generator !== undefined && !validGenerators.includes(body.settings.generator)) {
        return NextResponse.json(
          { error: `Invalid generator. Must be one of: ${validGenerators.join(", ")}` },
          { status: 400 }
        )
      }

      // Validate entity_type if provided (non-empty string)
      if (body.settings.entity_type !== undefined) {
        if (typeof body.settings.entity_type !== "string" || !body.settings.entity_type.trim()) {
          return NextResponse.json(
            { error: "entity_type must be a non-empty string" },
            { status: 400 }
          )
        }
        if (body.settings.entity_type.length > 100) {
          return NextResponse.json(
            { error: "entity_type must be 100 characters or less" },
            { status: 400 }
          )
        }
      }

      // Validate match_limit if provided
      if (body.settings.match_limit !== undefined) {
        if (typeof body.settings.match_limit !== "number" || !Number.isInteger(body.settings.match_limit)) {
          return NextResponse.json(
            { error: "match_limit must be an integer" },
            { status: 400 }
          )
        }
      }
    }

    // Merge settings with defaults and enforce limits
    const settings = {
      ...DEFAULT_DISCOVERY_SETTINGS,
      ...body.settings,
      entity_type: body.settings?.entity_type?.trim() ?? DEFAULT_DISCOVERY_SETTINGS.entity_type,
      match_limit: Math.min(
        Math.max(body.settings?.match_limit ?? 10, DISCOVERY_MIN_CANDIDATES),
        Math.min(planLimits.max_candidates_per_job, DISCOVERY_MAX_CANDIDATES)
      ),
    }

    // Create the discovery job
    const { data: job, error: jobError } = await (supabase as any)
      .from("discovery_jobs")
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        status: "pending",
        objective: body.objective.trim(),
        match_conditions: body.match_conditions,
        location: body.location?.trim() || null,
        exclude_names: body.exclude_names || null,
        settings,
        total_candidates: 0,
        matched_count: 0,
        unmatched_count: 0,
        discarded_count: 0,
      })
      .select()
      .single()

    if (jobError) {
      console.error("[Discovery API] Error creating job:", jobError)
      return NextResponse.json(
        { error: "Failed to create discovery job" },
        { status: 500 }
      )
    }

    const response: CreateDiscoveryJobResponse = {
      job: job as DiscoveryJob,
      message: "Discovery job created successfully",
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error("[Discovery API] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET: List user's discovery jobs
// ============================================================================

export async function GET() {
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

    // Fetch user's discovery jobs
    const { data: jobs, error, count } = await (supabase as any)
      .from("discovery_jobs")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      console.error("[Discovery API] Error fetching jobs:", error)
      return NextResponse.json(
        { error: "Failed to fetch discovery jobs" },
        { status: 500 }
      )
    }

    const response: DiscoveryJobListResponse = {
      jobs: (jobs || []) as DiscoveryJob[],
      total: count || 0,
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
