/**
 * Batch Enrichment Streaming API
 *
 * POST: Start enrichment with Server-Sent Events for real-time progress
 *
 * This endpoint:
 * 1. Streams progress events as prospects are enriched
 * 2. Supports pause/resume via query params
 * 3. Returns final results when complete
 */

import { createClient } from "@/lib/supabase/server"
import { NextRequest } from "next/server"
import { getEffectiveApiKey } from "@/lib/user-keys"
import {
  EnrichmentQueue,
  type EnrichmentProgressEvent,
} from "@/lib/batch-processing/enrichment/queue"
import type { EnrichmentMode, EnrichmentRequest } from "@/lib/batch-processing/enrichment/types"

export const runtime = "nodejs"
export const maxDuration = 300 // 5 minutes for batch enrichment

interface EnrichStreamRequest {
  mode?: EnrichmentMode
  maxConcurrent?: number
  // Optional: only enrich specific item IDs
  itemIds?: string[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  try {
    const supabase = await createClient()

    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Database not configured" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      )
    }

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    // Parse request body
    let body: EnrichStreamRequest = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is OK, use defaults
    }

    const mode: EnrichmentMode = body.mode || "STANDARD"
    const maxConcurrent = body.maxConcurrent || 3

    // Fetch job to verify ownership
    const { data: job, error: jobError } = await (supabase as any)
      .from("batch_prospect_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single()

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    }

    // Fetch completed items that need enrichment
    let itemsQuery = (supabase as any)
      .from("batch_prospect_items")
      .select("*")
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("item_index", { ascending: true })

    // Filter by specific IDs if provided
    if (body.itemIds && body.itemIds.length > 0) {
      itemsQuery = itemsQuery.in("id", body.itemIds)
    }

    const { data: items, error: itemsError } = await itemsQuery

    if (itemsError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch items: ${itemsError.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "No completed items found to enrich" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Get user's API key
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
      return new Response(
        JSON.stringify({ error: "No API key available. Add your OpenRouter key in Settings." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Create SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        // Helper to send SSE event
        const sendEvent = (event: EnrichmentProgressEvent) => {
          const data = JSON.stringify(event)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }

        // Send initial event
        sendEvent({
          type: "item_started",
          batchId: jobId,
          progress: {
            completed: 0,
            failed: 0,
            total: items.length,
            percentage: 0,
          },
          timestamp: new Date(),
        })

        try {
          // Convert items to enrichment requests
          const prospects = items.map((item: any) => ({
            prospect: {
              name: item.prospect_name || item.input_data?.name || "Unknown",
              address: item.prospect_address || item.input_data?.address,
              city: item.prospect_city || item.input_data?.city,
              state: item.prospect_state || item.input_data?.state,
              zip: item.prospect_zip || item.input_data?.zip,
              email: item.input_data?.email,
              phone: item.input_data?.phone,
              company: item.input_data?.company,
              title: item.input_data?.title,
            } as EnrichmentRequest["prospect"],
            mode,
            priority: "MEDIUM" as const,
          }))

          // Create enrichment queue
          const queue = new EnrichmentQueue(
            jobId,
            {
              maxConcurrent,
              onProgress: (event) => {
                sendEvent(event)

                // Store enrichment results in database when item completes
                if (event.type === "item_completed" && event.result && event.itemIndex !== undefined) {
                  const item = items[event.itemIndex]
                  if (item) {
                    // Fire-and-forget update
                    (supabase as any)
                      .from("batch_prospect_items")
                      .update({
                        enrichment_data: event.result,
                        enriched_at: new Date().toISOString(),
                      })
                      .eq("id", item.id)
                      .then(() => {})
                      .catch((err: any) => {
                        console.error("[EnrichStream] Failed to save enrichment:", err)
                      })
                  }
                }
              },
            },
            apiKey
          )

          // Add all prospects
          queue.addBatch(prospects)

          // Start processing
          await queue.start()

          // Send final completion event
          const finalProgress = queue.getProgress()
          sendEvent({
            type: "batch_completed",
            batchId: jobId,
            progress: finalProgress,
            timestamp: new Date(),
          })
        } catch (error) {
          console.error("[EnrichStream] Error:", error)
          sendEvent({
            type: "batch_failed",
            batchId: jobId,
            error: error instanceof Error ? error.message : "Enrichment failed",
            progress: { completed: 0, failed: items.length, total: items.length, percentage: 100 },
            timestamp: new Date(),
          })
        }

        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("[EnrichStream] Error:", error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
