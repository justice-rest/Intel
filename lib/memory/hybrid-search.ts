/**
 * Hybrid Memory Search - V1-backed Implementation
 *
 * Provides hybridSearch, getMemoryProfile, tieredSearch, formatMemoriesForPrompt,
 * and deduplicateMemories using the V1 `search_user_memories` RPC function.
 *
 * V2 tables (memories_v2, hybrid_search_memories RPC, get_memory_profile RPC)
 * were dropped in migration 20260208144805. This module preserves the same
 * exported interface so callers (agentic-pipeline, profile route) keep working.
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type {
  HybridSearchParams,
  HybridSearchResponse,
  MemorySearchResultV2,
  ProfileSearchParams,
  ProfileSearchResponse,
  MemoryProfile,
  UserMemoryV2,
} from "./types"
import { generateEmbedding } from "./embedding-cache"
import { DEFAULT_SIMILARITY_THRESHOLD } from "./config"

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_HYBRID_PARAMS = {
  limit: 10,
  vectorThreshold: 0.5,
}

const DEFAULT_PROFILE_PARAMS = {
  staticLimit: 10,
  dynamicLimit: 5,
}

// ============================================================================
// V1 ROW → V2 TYPE MAPPERS
// ============================================================================

/**
 * Map a V1 search_user_memories row to MemorySearchResultV2.
 * V2-only fields get safe defaults.
 */
function mapV1ToSearchResult(row: Record<string, unknown>): MemorySearchResultV2 {
  const similarity = (row.similarity as number) || 0
  const metadata = (row.metadata as Record<string, unknown>) || {}
  return {
    id: row.id as string,
    content: row.content as string,
    memory_tier: "warm",
    memory_kind: "semantic",
    is_static: (metadata.is_static as boolean) || false,
    importance_score: (row.importance_score as number) || 0.5,
    metadata: metadata as MemorySearchResultV2["metadata"],
    tags: (metadata.tags as string[]) || [],
    vector_similarity: similarity,
    lexical_score: 0,
    rrf_score: similarity,
    final_score: (row.weighted_score as number) || similarity,
    source_chat_id: (metadata.source_chat_id as string) || null,
    is_inference: false,
    created_at: row.created_at as string,
    last_accessed_at: row.last_accessed_at as string | null,
  }
}

/**
 * Map a V1 search_user_memories row to UserMemoryV2.
 * V2-only fields get safe defaults.
 */
function mapV1ToMemory(row: Record<string, unknown>): UserMemoryV2 {
  const metadata = (row.metadata as Record<string, unknown>) || {}
  return {
    id: row.id as string,
    user_id: "",
    content: row.content as string,
    memory_tier: "warm",
    memory_kind: "semantic",
    memory_type: (row.memory_type as "auto" | "explicit") || "auto",
    is_static: (metadata.is_static as boolean) || false,
    version: 1,
    is_latest: true,
    parent_memory_id: null,
    root_memory_id: null,
    is_forgotten: false,
    forget_after: null,
    forget_reason: null,
    source_count: (metadata.source_count as number) || 1,
    is_inference: false,
    source_chat_id: (metadata.source_chat_id as string) || null,
    source_message_id: (metadata.source_message_id as number) || null,
    event_timestamp: null,
    valid_from: row.created_at as string,
    valid_until: null,
    importance_score: (row.importance_score as number) || 0.5,
    access_count: 0,
    access_velocity: 0,
    last_accessed_at: row.last_accessed_at as string | null,
    embedding: null,
    embedding_model: null,
    matryoshka_embedding: null,
    metadata: metadata as UserMemoryV2["metadata"],
    tags: (metadata.tags as string[]) || [],
    created_at: row.created_at as string,
    updated_at: row.created_at as string,
  }
}

// ============================================================================
// HYBRID SEARCH (backed by V1 search_user_memories)
// ============================================================================

/**
 * Perform memory search using V1 `search_user_memories` RPC.
 * Returns results in the HybridSearchResponse format for compatibility.
 */
export async function hybridSearch(
  supabase: SupabaseClient,
  params: HybridSearchParams
): Promise<HybridSearchResponse> {
  const startTime = Date.now()

  const {
    query,
    userId,
    limit = DEFAULT_HYBRID_PARAMS.limit,
    vectorThreshold = DEFAULT_HYBRID_PARAMS.vectorThreshold,
    minImportance,
  } = params

  // Get or generate query embedding
  const queryEmbedding = params.queryEmbedding || (await generateEmbedding(query))

  // Call V1 search function
  const { data, error } = await supabase.rpc("search_user_memories", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_user_id: userId,
    match_count: limit,
    similarity_threshold: vectorThreshold,
    memory_type_filter: null,
    min_importance: minImportance || 0,
  })

  if (error) {
    console.error("[hybrid-search] Search error:", error)
    return {
      results: [],
      total: 0,
      timing: { vectorMs: 0, lexicalMs: 0, fusionMs: 0, totalMs: Date.now() - startTime },
    }
  }

  const results: MemorySearchResultV2[] = (data || []).map(mapV1ToSearchResult)

  return {
    results,
    total: results.length,
    timing: {
      vectorMs: Date.now() - startTime,
      lexicalMs: 0,
      fusionMs: 0,
      totalMs: Date.now() - startTime,
    },
  }
}

// ============================================================================
// PROFILE SEARCH (backed by V1 search_user_memories)
// ============================================================================

/**
 * Get memory profile — static + dynamic memories for context injection.
 * Uses V1 search_user_memories. "Static" memories are those with
 * is_static=true in metadata; all others are "dynamic."
 */
export async function getMemoryProfile(
  supabase: SupabaseClient,
  params: ProfileSearchParams
): Promise<ProfileSearchResponse> {
  const startTime = Date.now()
  const {
    userId,
    query,
    queryEmbedding,
    staticLimit = DEFAULT_PROFILE_PARAMS.staticLimit,
    dynamicLimit = DEFAULT_PROFILE_PARAMS.dynamicLimit,
  } = params

  let staticMemories: UserMemoryV2[] = []
  let dynamicMemories: UserMemoryV2[] = []
  let searchMs: number | undefined

  // If we have a query, do a semantic search for dynamic memories
  if (query || queryEmbedding) {
    const embedding = queryEmbedding || (await generateEmbedding(query!))

    const { data, error } = await supabase.rpc("search_user_memories", {
      query_embedding: JSON.stringify(embedding),
      match_user_id: userId,
      match_count: staticLimit + dynamicLimit,
      similarity_threshold: DEFAULT_SIMILARITY_THRESHOLD,
      memory_type_filter: null,
      min_importance: 0,
    })

    if (error) {
      console.error("[hybrid-search] Profile search error:", error)
    } else {
      const allMemories = (data || []).map(mapV1ToMemory)

      // Split: memories with is_static metadata → static, rest → dynamic
      for (const m of allMemories) {
        if (m.is_static && staticMemories.length < staticLimit) {
          staticMemories.push(m)
        } else if (dynamicMemories.length < dynamicLimit) {
          dynamicMemories.push(m)
        }
      }
    }
  } else {
    // No query — just fetch recent important memories
    const { data, error } = await supabase
      .from("user_memories")
      .select("*")
      .eq("user_id", userId)
      .order("importance_score", { ascending: false })
      .limit(staticLimit + dynamicLimit)

    if (error) {
      console.error("[hybrid-search] Profile fetch error:", error)
    } else {
      const allMemories = (data || []).map((row: Record<string, unknown>) => mapV1ToMemory(row))

      for (const m of allMemories) {
        if (m.is_static && staticMemories.length < staticLimit) {
          staticMemories.push(m)
        } else if (dynamicMemories.length < dynamicLimit) {
          dynamicMemories.push(m)
        }
      }
    }
  }

  // Deduplicate: static > dynamic
  const staticIds = new Set(staticMemories.map((m) => m.id))
  dynamicMemories = dynamicMemories.filter((m) => !staticIds.has(m.id))

  // Optional: search results if query provided
  let searchResults: MemorySearchResultV2[] | undefined
  if (query) {
    const searchStart = Date.now()
    const searchResponse = await hybridSearch(supabase, {
      query,
      queryEmbedding: queryEmbedding || undefined,
      userId,
      limit: 5,
    })
    searchResults = searchResponse.results
    searchMs = Date.now() - searchStart

    // Deduplicate: static > dynamic > search
    const allIds = new Set([...staticIds, ...dynamicMemories.map((m) => m.id)])
    searchResults = searchResults.filter((r) => !allIds.has(r.id))
  }

  return {
    profile: {
      static: staticMemories,
      dynamic: dynamicMemories,
    },
    searchResults,
    timing: {
      staticMs: 0,
      dynamicMs: 0,
      searchMs,
      totalMs: Date.now() - startTime,
    },
  }
}

// ============================================================================
// TIERED SEARCH (falls through to hybridSearch)
// ============================================================================

/**
 * Multi-tier search. Since V2 tiers are gone, this delegates to hybridSearch.
 */
export async function tieredSearch(
  supabase: SupabaseClient,
  params: HybridSearchParams
): Promise<HybridSearchResponse> {
  return hybridSearch(supabase, params)
}

// ============================================================================
// FORMATTING & DEDUP
// ============================================================================

/**
 * Format memories for system prompt injection
 */
export function formatMemoriesForPrompt(profile: MemoryProfile): string {
  const parts: string[] = []

  if (profile.static.length > 0) {
    parts.push("## User Profile (Always Relevant)")
    profile.static.forEach((m) => {
      parts.push(`- ${m.content}`)
    })
  }

  if (profile.dynamic.length > 0) {
    parts.push("\n## Contextual Memories")
    profile.dynamic.forEach((m) => {
      parts.push(`- ${m.content}`)
    })
  }

  return parts.join("\n")
}

/**
 * Deduplicate memories (static > dynamic > search)
 */
export function deduplicateMemories(params: {
  static: UserMemoryV2[]
  dynamic: UserMemoryV2[]
  searchResults?: MemorySearchResultV2[]
}): {
  static: UserMemoryV2[]
  dynamic: UserMemoryV2[]
  searchResults: MemorySearchResultV2[]
} {
  const staticIds = new Set(params.static.map((m) => m.id))
  const dynamic = params.dynamic.filter((m) => !staticIds.has(m.id))

  const allIds = new Set([...staticIds, ...dynamic.map((m) => m.id)])
  const searchResults = (params.searchResults || []).filter(
    (r) => !allIds.has(r.id)
  )

  return {
    static: params.static,
    dynamic,
    searchResults,
  }
}
