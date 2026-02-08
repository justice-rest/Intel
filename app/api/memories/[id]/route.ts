/**
 * Memory API Routes - Individual Memory Operations
 * Handles GET, PUT, DELETE for specific memories
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getMemoryById,
  updateMemory,
  deleteMemory,
  isMemoryEnabled,
} from "@/lib/memory"
import { generateEmbedding } from "@/lib/memory/embedding-cache"
import type { UpdateMemory } from "@/lib/memory/types"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

/**
 * GET /api/memories/[id]
 * Get a specific memory by ID
 */
export async function GET(req: Request, context: RouteContext) {
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

    const { id } = await context.params

    const memory = await getMemoryById(id, user.id)

    if (!memory) {
      return NextResponse.json(
        { success: false, error: "Memory not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      memory,
    })
  } catch (error) {
    console.error("GET /api/memories/[id] error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch memory",
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/memories/[id]
 * Update a specific memory
 */
export async function PUT(req: Request, context: RouteContext) {
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

    const { id } = await context.params
    const body = (await req.json()) as UpdateMemory

    // If content is being updated, regenerate embedding
    // (embedding-cache reads API key from env)
    if (body.content) {
      const embedding = await generateEmbedding(body.content)
      body.embedding = embedding
    }

    const updatedMemory = await updateMemory(id, user.id, body)

    if (!updatedMemory) {
      return NextResponse.json(
        { success: false, error: "Failed to update memory or memory not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      memory: updatedMemory,
      message: "Memory updated successfully",
    })
  } catch (error) {
    console.error("PUT /api/memories/[id] error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update memory",
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/memories/[id]
 * Delete a specific memory
 */
export async function DELETE(req: Request, context: RouteContext) {
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

    const { id } = await context.params

    const success = await deleteMemory(id, user.id)

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Failed to delete memory or memory not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Memory deleted successfully",
    })
  } catch (error) {
    console.error("DELETE /api/memories/[id] error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete memory",
      },
      { status: 500 }
    )
  }
}
