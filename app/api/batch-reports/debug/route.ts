/**
 * Debug endpoint for batch reports embeddings
 * GET: Check if embeddings exist and test search
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
      sample_columns: sampleRow ? Object.keys(sampleRow) : [],
      sample_error: e3?.message,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Debug failed"
    }, { status: 500 })
  }
}
