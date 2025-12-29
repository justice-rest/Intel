/**
 * Discovery Export API
 * GET: Export discovery results as CSV
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

// ============================================================================
// GET: Export discovery results as CSV
// ============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const { searchParams } = new URL(request.url)
    const includeAll = searchParams.get("all") === "true"

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
    let query = (supabase as any)
      .from("discovery_candidates")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true })

    // Filter to matched only unless includeAll
    if (!includeAll) {
      query = query.eq("status", "matched")
    }

    const { data: candidates, error: candidatesError } = await query

    if (candidatesError) {
      console.error("[Discovery Export] Error fetching candidates:", candidatesError)
      return NextResponse.json(
        { error: "Failed to fetch candidates" },
        { status: 500 }
      )
    }

    // Build CSV content
    const headers = [
      "Name",
      "Description",
      "URL",
      "Status",
      "Sources",
    ]

    const rows = (candidates || []).map((candidate: any) => {
      const sources = (candidate.sources || [])
        .slice(0, 3)
        .map((s: any) => s.url)
        .join("; ")

      return [
        escapeCsvField(candidate.name || ""),
        escapeCsvField(candidate.description || ""),
        escapeCsvField(candidate.url || ""),
        escapeCsvField(candidate.status || ""),
        escapeCsvField(sources),
      ].join(",")
    })

    const csvContent = [headers.join(","), ...rows].join("\n")

    // Generate filename
    const timestamp = new Date().toISOString().split("T")[0]
    const safeName = job.name.replace(/[^a-z0-9]/gi, "_").substring(0, 30)
    const filename = `discovery_${safeName}_${timestamp}.csv`

    // Return CSV response
    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("[Discovery Export] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Helper to escape CSV fields
function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
