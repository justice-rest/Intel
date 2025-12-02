/**
 * Batch Reports Backfill API
 * POST: Generate embeddings for existing completed reports without embeddings
 *
 * This endpoint backfills embeddings for reports that were created before
 * the batch reports RAG feature was implemented.
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { backfillBatchReportEmbeddings } from "@/lib/batch-reports"

export const runtime = "nodejs"
export const maxDuration = 120 // Allow up to 2 minutes

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      )
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get batch size from request body (default: 10)
    let batchSize = 10
    try {
      const body = await request.json()
      if (body.batchSize && typeof body.batchSize === "number") {
        batchSize = Math.min(Math.max(body.batchSize, 1), 50) // Clamp between 1-50
      }
    } catch {
      // Use default batch size if no body
    }

    // Get API key
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 500 }
      )
    }

    // Run backfill
    const result = await backfillBatchReportEmbeddings(user.id, apiKey, batchSize)

    // Check how many remain
    const { count: remainingCount } = await (supabase as any)
      .from("batch_prospect_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed")
      .is("embedding", null)
      .not("report_content", "is", null)

    return NextResponse.json({
      success: true,
      ...result,
      remaining: remainingCount || 0,
      message: `Processed ${result.processed} reports, ${result.failed} failed, ${result.skipped} skipped. ${remainingCount || 0} remaining.`,
    })
  } catch (error) {
    console.error("[BackfillAPI] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 500 }
    )
  }
}

/**
 * GET: Check how many reports need backfilling
 */
export async function GET() {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      )
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Count reports needing backfill
    const { count: needsBackfill } = await (supabase as any)
      .from("batch_prospect_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed")
      .is("embedding", null)
      .not("report_content", "is", null)

    // Count reports with embeddings
    const { count: hasEmbedding } = await (supabase as any)
      .from("batch_prospect_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed")
      .not("embedding", "is", null)

    return NextResponse.json({
      needs_backfill: needsBackfill || 0,
      has_embedding: hasEmbedding || 0,
      total_completed: (needsBackfill || 0) + (hasEmbedding || 0),
    })
  } catch (error) {
    console.error("[BackfillAPI] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check status" },
      { status: 500 }
    )
  }
}
