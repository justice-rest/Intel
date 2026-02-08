/**
 * Memory Search API Route
 * Handles semantic search of user memories
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { searchMemories, isMemoryEnabled } from "@/lib/memory"
import type { SearchMemoriesRequest, SearchMemoriesResponse } from "@/lib/memory/types"

/**
 * POST /api/memories/search
 * Search memories using semantic similarity
 */
export async function POST(req: Request) {
  try {
    if (!isMemoryEnabled()) {
      return NextResponse.json(
        { success: false, error: "Memory system is disabled" },
        { status: 503 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 503 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = (await req.json()) as SearchMemoriesRequest

    if (!body.query || body.query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Search query is required" },
        { status: 400 }
      )
    }

    // Search memories (embedding-cache reads API key from env)
    const results = await searchMemories({
      query: body.query,
      userId: user.id,
      limit: body.limit || 10,
      similarityThreshold: body.similarity_threshold || 0.5,
      memoryType: body.memory_type,
      minImportance: body.min_importance || 0,
    })

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
    })
  } catch (error) {
    console.error("POST /api/memories/search error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search memories",
      },
      { status: 500 }
    )
  }
}
