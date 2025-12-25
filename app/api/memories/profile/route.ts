/**
 * Memory Profile API Route (V2 - Enterprise)
 *
 * Returns a user's memory profile containing:
 * - Static memories: Always-included profile facts (user info, preferences)
 * - Dynamic memories: Query-dependent contextual memories
 * - Optional search results: Real-time semantic search matches
 *
 * Inspired by Supermemory's /v4/profile endpoint.
 * This is the primary endpoint for AI context injection.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getMemoryProfile,
  isMemoryEnabled,
  generateEmbedding,
  warmUserMemoryCache,
} from "@/lib/memory"
import type { MemoryKind } from "@/lib/memory/types"

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

interface ProfileRequest {
  /** Optional query for dynamic memory selection */
  q?: string
  /** Tag/category filter */
  containerTag?: string
  /** Maximum static memories to return */
  staticLimit?: number
  /** Maximum dynamic memories to return */
  dynamicLimit?: number
  /** Include search results in response */
  includeSearch?: boolean
  /** Search limit (if includeSearch is true) */
  searchLimit?: number
  /** Similarity threshold for search */
  searchThreshold?: number
  /** Enable cache warming for user */
  warmCache?: boolean
}

interface ProfileResponse {
  success: boolean
  profile: {
    /** Static memories - always included in context */
    static: ProfileMemory[]
    /** Dynamic memories - selected based on query */
    dynamic: ProfileMemory[]
    /** Total memory count for user */
    totalMemories: number
    /** Profile completeness score (0-1) */
    completeness: number
  }
  /** Optional search results */
  searchResults?: {
    results: ProfileMemory[]
    total: number
  }
  /** Timing information */
  timing: {
    totalMs: number
    staticMs?: number
    dynamicMs?: number
    searchMs?: number
    cacheWarmMs?: number
  }
  /** Formatted context ready for prompt injection */
  formattedContext?: string
}

interface ProfileMemory {
  id: string
  content: string
  memory_kind: string
  is_static: boolean
  importance_score: number
  created_at: string
  metadata?: Record<string, unknown>
  /** Relevance to query (for dynamic memories) */
  relevance?: number
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * POST /api/memories/profile
 * Get user's memory profile for AI context injection
 */
export async function POST(req: Request): Promise<NextResponse<ProfileResponse | { success: false; error: string }>> {
  const startTime = Date.now()

  try {
    // Check if memory system is enabled
    if (!isMemoryEnabled()) {
      return NextResponse.json(
        { success: false, error: "Memory system is disabled" },
        { status: 503 }
      )
    }

    // Get Supabase client
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database not configured" },
        { status: 503 }
      )
    }

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Parse request body
    const body = (await req.json()) as ProfileRequest

    const timing: ProfileResponse["timing"] = {
      totalMs: 0,
    }

    // Optionally warm the cache
    if (body.warmCache) {
      const cacheStart = Date.now()
      await warmUserMemoryCache(supabase, user.id)
      timing.cacheWarmMs = Date.now() - cacheStart
    }

    // Get memory profile
    const profileStart = Date.now()

    // Generate embedding if query provided
    let queryEmbedding: number[] | undefined
    if (body.q && body.q.trim().length > 0) {
      try {
        queryEmbedding = await generateEmbedding(body.q)
      } catch (error) {
        console.warn("[profile] Embedding generation failed:", error)
      }
    }

    const profileResponse = await getMemoryProfile(supabase, {
      userId: user.id,
      query: body.q,
      queryEmbedding,
      staticLimit: body.staticLimit || 10,
      dynamicLimit: body.dynamicLimit || 5,
      containerTag: body.containerTag,
    })

    timing.staticMs = Date.now() - profileStart

    // Format static memories
    const staticMemories: ProfileMemory[] = profileResponse.profile.static.map((m) => ({
      id: m.id,
      content: m.content,
      memory_kind: m.memory_kind,
      is_static: true,
      importance_score: m.importance_score,
      created_at: typeof m.created_at === "string" ? m.created_at : new Date(m.created_at).toISOString(),
      metadata: (m.metadata ?? {}) as Record<string, unknown>,
    }))

    // Format dynamic memories
    const dynamicMemories: ProfileMemory[] = profileResponse.profile.dynamic.map((m) => ({
      id: m.id,
      content: m.content,
      memory_kind: m.memory_kind,
      is_static: false,
      importance_score: m.importance_score,
      created_at: typeof m.created_at === "string" ? m.created_at : new Date(m.created_at).toISOString(),
      metadata: (m.metadata ?? {}) as Record<string, unknown>,
      relevance: (m as unknown as { similarity_score?: number }).similarity_score,
    }))

    // Calculate profile completeness
    const completeness = calculateCompleteness(staticMemories, dynamicMemories)

    // Get total memory count
    const { count: totalMemories } = await supabase
      .from("user_memories")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    // Build response
    const response: ProfileResponse = {
      success: true,
      profile: {
        static: staticMemories,
        dynamic: dynamicMemories,
        totalMemories: totalMemories || 0,
        completeness,
      },
      timing: {
        ...timing,
        totalMs: Date.now() - startTime,
      },
    }

    // Add formatted context for prompt injection
    response.formattedContext = formatProfileForPrompt(
      staticMemories,
      dynamicMemories,
      body.q
    )

    return NextResponse.json(response)
  } catch (error) {
    console.error("POST /api/memories/profile error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get memory profile",
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET HANDLER
// ============================================================================

/**
 * GET /api/memories/profile
 * Get user's static profile (no query context)
 */
export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url)

  // Convert to POST-style request
  const body: ProfileRequest = {
    q: searchParams.get("q") || undefined,
    staticLimit: parseInt(searchParams.get("staticLimit") || "10"),
    dynamicLimit: parseInt(searchParams.get("dynamicLimit") || "5"),
    warmCache: searchParams.get("warmCache") === "true",
  }

  // Create a synthetic request
  const syntheticReq = new Request(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify(body),
  })

  return POST(syntheticReq)
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate profile completeness score
 * Based on having key memory types filled in
 */
function calculateCompleteness(
  staticMemories: ProfileMemory[],
  dynamicMemories: ProfileMemory[]
): number {
  const allMemories = [...staticMemories, ...dynamicMemories]

  // Check for presence of key memory kinds
  const keyKinds = ["profile", "semantic", "episodic", "procedural"]
  const presentKinds = new Set(allMemories.map((m) => m.memory_kind))

  let score = 0

  // Base score from memory count
  if (allMemories.length >= 1) score += 0.1
  if (allMemories.length >= 5) score += 0.1
  if (allMemories.length >= 10) score += 0.1
  if (allMemories.length >= 20) score += 0.1

  // Score from memory kinds
  for (const kind of keyKinds) {
    if (presentKinds.has(kind)) {
      score += 0.1
    }
  }

  // Score from static memories (profile facts)
  if (staticMemories.length >= 1) score += 0.1
  if (staticMemories.length >= 3) score += 0.1

  return Math.min(1.0, score)
}

/**
 * Format profile for system prompt injection
 */
function formatProfileForPrompt(
  staticMemories: ProfileMemory[],
  dynamicMemories: ProfileMemory[],
  query?: string
): string {
  const parts: string[] = []

  // Static profile section
  if (staticMemories.length > 0) {
    parts.push("## User Profile")
    parts.push("")
    for (const memory of staticMemories) {
      parts.push(`- ${memory.content}`)
    }
    parts.push("")
  }

  // Dynamic context section
  if (dynamicMemories.length > 0) {
    parts.push("## Contextual Information")
    if (query) {
      parts.push(`(Relevant to: "${query}")`)
    }
    parts.push("")
    for (const memory of dynamicMemories) {
      const relevanceNote = memory.relevance
        ? ` (${Math.round(memory.relevance * 100)}% relevant)`
        : ""
      parts.push(`- ${memory.content}${relevanceNote}`)
    }
    parts.push("")
  }

  // Add guidance for AI
  if (parts.length > 0) {
    parts.push("---")
    parts.push("Use this information to personalize your response.")
  }

  return parts.join("\n")
}

// ============================================================================
// PROFILE WARMUP ENDPOINT
// ============================================================================

/**
 * PUT /api/memories/profile
 * Warm up user's memory cache for faster subsequent requests
 */
export async function PUT(req: Request): Promise<NextResponse> {
  const startTime = Date.now()

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
        { success: false, error: "Database not configured" },
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

    // Warm the cache
    await warmUserMemoryCache(supabase, user.id)

    return NextResponse.json({
      success: true,
      message: "Cache warmed successfully",
      timing: {
        totalMs: Date.now() - startTime,
      },
    })
  } catch (error) {
    console.error("PUT /api/memories/profile error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to warm cache",
      },
      { status: 500 }
    )
  }
}
