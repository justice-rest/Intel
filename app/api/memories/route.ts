/**
 * Memory API Routes
 * Handles CRUD operations for user memories
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getUserMemories,
  createMemory,
  getMemoryStats,
  isMemoryEnabled,
  calculateImportanceScore,
} from "@/lib/memory"
import { MAX_MEMORY_CONTENT_LENGTH } from "@/lib/memory/config"
import { generateEmbedding } from "@/lib/memory/embedding-cache"
import type { CreateMemoryRequest, MemoryApiResponse } from "@/lib/memory/types"

/**
 * GET /api/memories
 * List all memories for authenticated user
 */
export async function GET(req: Request) {
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

    // Parse query parameters
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    // Get memories
    const memories = await getUserMemories(user.id, limit, offset)

    // Get stats
    const stats = await getMemoryStats(user.id)

    return NextResponse.json({
      success: true,
      memories,
      stats,
      count: memories.length,
    })
  } catch (error) {
    console.error("GET /api/memories error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch memories",
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/memories
 * Create a new memory (explicit memory creation by user)
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

    const body = (await req.json()) as CreateMemoryRequest

    if (!body.content || body.content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Memory content is required" },
        { status: 400 }
      )
    }

    if (body.content.length > MAX_MEMORY_CONTENT_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Memory content must be ${MAX_MEMORY_CONTENT_LENGTH} characters or less` },
        { status: 400 }
      )
    }

    // Generate embedding (embedding-cache reads API key from env)
    const embedding = await generateEmbedding(body.content)

    // Calculate importance score
    const importanceScore =
      body.importance_score ??
      calculateImportanceScore(
        body.content,
        body.metadata?.category || "other",
        body.metadata
      )

    // Create memory
    const memory = await createMemory({
      user_id: user.id,
      content: body.content,
      memory_type: body.memory_type || "explicit",
      importance_score: importanceScore,
      metadata: body.metadata || {},
      embedding,
    })

    if (!memory) {
      return NextResponse.json(
        { success: false, error: "Failed to create memory" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        memory,
        message: "Memory created successfully",
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/memories error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create memory",
      },
      { status: 500 }
    )
  }
}
