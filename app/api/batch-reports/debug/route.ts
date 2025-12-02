/**
 * Debug endpoint for batch reports embeddings
 * GET: Check if embeddings exist and test search
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { generateEmbedding } from "@/lib/rag/embeddings"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get test query from URL params
    const url = new URL(request.url)
    const testQuery = url.searchParams.get("query") || "prospect research"

    // Check completed items with embeddings
    const { data: withEmbeddings, error: e1 } = await (supabase as any)
      .from("batch_prospect_items")
      .select("id, prospect_name, embedding, embedding_generated_at, status")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .not("embedding", "is", null)
      .limit(10)

    // Check completed items without embeddings
    const { data: withoutEmbeddings, error: e2 } = await (supabase as any)
      .from("batch_prospect_items")
      .select("id, prospect_name, embedding, status")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .is("embedding", null)
      .limit(10)

    // Check if the embedding column exists by getting one row
    const { data: sampleRow, error: e3 } = await (supabase as any)
      .from("batch_prospect_items")
      .select("*")
      .eq("user_id", user.id)
      .limit(1)
      .single()

    // Test the RPC function directly
    let rpcTest: any = { error: "Not tested" }
    const apiKey = process.env.OPENROUTER_API_KEY
    if (apiKey && withEmbeddings?.length > 0) {
      try {
        // Generate test embedding
        const embResult = await generateEmbedding(testQuery, apiKey)
        const embString = JSON.stringify(embResult.embedding)

        // Call RPC function
        const { data: rpcData, error: rpcError } = await (supabase as any).rpc("search_batch_reports", {
          query_embedding: embString,
          match_user_id: user.id,
          match_count: 5,
          similarity_threshold: 0.1, // Very low threshold for testing
        })

        rpcTest = {
          success: !rpcError,
          data: rpcData,
          error: rpcError?.message || rpcError?.details || null,
          query_used: testQuery,
          embedding_length: embResult.embedding.length,
        }
      } catch (rpcErr) {
        rpcTest = {
          success: false,
          error: rpcErr instanceof Error ? rpcErr.message : String(rpcErr),
        }
      }
    }

    // Test fallback query directly
    const { data: fallbackData, error: fallbackError } = await (supabase as any)
      .from("batch_prospect_items")
      .select(`
        id,
        prospect_name,
        report_content,
        romy_score,
        capacity_rating,
        estimated_net_worth,
        estimated_gift_capacity,
        sources_found,
        created_at
      `)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .not("report_content", "is", null)
      .order("created_at", { ascending: false })
      .limit(5)

    return NextResponse.json({
      user_id: user.id,
      with_embeddings: {
        count: withEmbeddings?.length || 0,
        items: withEmbeddings?.map((i: any) => ({
          id: i.id,
          name: i.prospect_name,
          has_embedding: !!i.embedding,
          embedding_type: typeof i.embedding,
          embedding_preview: i.embedding ? String(i.embedding).slice(0, 100) + "..." : null,
          generated_at: i.embedding_generated_at,
        })),
        error: e1?.message,
      },
      without_embeddings: {
        count: withoutEmbeddings?.length || 0,
        items: withoutEmbeddings?.map((i: any) => ({
          id: i.id,
          name: i.prospect_name,
        })),
        error: e2?.message,
      },
      rpc_test: rpcTest,
      fallback_test: {
        count: fallbackData?.length || 0,
        items: fallbackData?.map((i: any) => ({
          id: i.id,
          name: i.prospect_name,
          has_report: !!i.report_content,
          romy_score: i.romy_score,
        })),
        error: fallbackError?.message,
      },
      sample_columns: sampleRow ? Object.keys(sampleRow) : [],
      sample_error: e3?.message,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Debug failed"
    }, { status: 500 })
  }
}
