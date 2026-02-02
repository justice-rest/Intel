// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any

/**
 * Hybrid Memory Search - Vector + Lexical with RRF Fusion
 *
 * Enterprise-grade search pipeline combining:
 * 1. Vector Search (pgvector HNSW) - Semantic similarity
 * 2. Lexical Search (tsvector + trigram) - BM25-like matching
 * 3. RRF Fusion (Reciprocal Rank Fusion) - Score combination
 * 4. Cross-Encoder Reranking (optional) - Final precision boost
 *
 * Target: <100ms for hybrid search, <150ms with reranking
 *
 * Inspired by Supermemory's dual-threshold search API.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js"
import type {
  HybridSearchParams,
  HybridSearchResponse,
  MemorySearchResultV2,
  ProfileSearchParams,
  ProfileSearchResponse,
  MemoryProfile,
  UserMemoryV2,
  MemoryTier,
  MemoryKind,
} from "./types"
import { getHotCache, selectHotMemories } from "./hot-cache"
import { generateEmbedding } from "./embedding-cache"

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_HYBRID_PARAMS = {
  limit: 10,
  vectorThreshold: 0.5,
  lexicalThreshold: 0.3,
  vectorWeight: 0.6,
  lexicalWeight: 0.4,
  rrfK: 60,
  excludeForgotten: true,
}

const DEFAULT_PROFILE_PARAMS = {
  staticLimit: 10,
  dynamicLimit: 5,
}

// ============================================================================
// HYBRID SEARCH IMPLEMENTATION
// ============================================================================

/**
 * Perform hybrid search combining vector and lexical search with RRF fusion
 */
export async function hybridSearch(
  supabase: AnySupabaseClient,
  params: HybridSearchParams
): Promise<HybridSearchResponse> {
  const startTime = Date.now()

  const {
    query,
    userId,
    limit = DEFAULT_HYBRID_PARAMS.limit,
    vectorThreshold = DEFAULT_HYBRID_PARAMS.vectorThreshold,
    lexicalThreshold = DEFAULT_HYBRID_PARAMS.lexicalThreshold,
    vectorWeight = DEFAULT_HYBRID_PARAMS.vectorWeight,
    lexicalWeight = DEFAULT_HYBRID_PARAMS.lexicalWeight,
    rrfK = DEFAULT_HYBRID_PARAMS.rrfK,
    tiers,
    kinds,
    staticOnly = false,
    tags,
    minImportance,
    excludeForgotten = true,
    rerank = false,
  } = params

  // Get or generate query embedding
  const queryEmbedding = params.queryEmbedding || (await generateEmbedding(query))

  const vectorStart = Date.now()
  const lexicalStart = Date.now()

  // Execute vector and lexical search in parallel
  const [vectorResults, lexicalResults] = await Promise.all([
    vectorSearch(supabase, {
      userId,
      queryEmbedding,
      limit: limit * 2, // Over-fetch for fusion
      threshold: vectorThreshold,
      tiers,
      kinds,
      staticOnly,
      tags,
      minImportance,
      excludeForgotten,
    }),
    lexicalSearch(supabase, {
      userId,
      query,
      limit: limit * 2,
      threshold: lexicalThreshold,
      tiers,
      kinds,
      staticOnly,
      tags,
      minImportance,
      excludeForgotten,
    }),
  ])

  const vectorMs = Date.now() - vectorStart
  const lexicalMs = Date.now() - lexicalStart

  // RRF Fusion
  const fusionStart = Date.now()
  const fusedResults = rrfFusion(
    vectorResults,
    lexicalResults,
    vectorWeight,
    lexicalWeight,
    rrfK
  )
  const fusionMs = Date.now() - fusionStart

  // Take top N after fusion
  let finalResults = fusedResults.slice(0, limit)

  // Optional reranking
  let rerankMs: number | undefined
  if (rerank && finalResults.length > 0) {
    const rerankStart = Date.now()
    // Import reranker dynamically to avoid circular dependencies
    const { rerank: rerankFn } = await import("../rag/reranker")
    const reranked = await rerankFn({
      query,
      documents: finalResults.map((r) => ({
        id: r.id,
        content: r.content,
        metadata: { ...(r.metadata as Record<string, unknown> || {}), original_score: r.final_score },
      })),
      topN: limit,
    })

    // Map reranked results back
    finalResults = reranked.results.map((r) => {
      const original = finalResults.find((f) => f.id === r.id)!
      return {
        ...original,
        final_score: r.score,
      }
    })
    rerankMs = Date.now() - rerankStart
  }

  return {
    results: finalResults,
    total: fusedResults.length,
    timing: {
      vectorMs,
      lexicalMs,
      fusionMs,
      rerankMs,
      totalMs: Date.now() - startTime,
    },
  }
}

/**
 * Vector-only search using pgvector HNSW index
 */
async function vectorSearch(
  supabase: AnySupabaseClient,
  params: {
    userId: string
    queryEmbedding: number[]
    limit: number
    threshold: number
    tiers?: MemoryTier[]
    kinds?: MemoryKind[]
    staticOnly?: boolean
    tags?: string[]
    minImportance?: number
    excludeForgotten?: boolean
  }
): Promise<MemorySearchResultV2[]> {
  const {
    userId,
    queryEmbedding,
    limit,
    threshold,
    tiers,
    kinds,
    staticOnly,
    tags,
    minImportance,
    excludeForgotten,
  } = params

  // Call the database function
  const { data, error } = await supabase.rpc("hybrid_search_memories", {
    query_embedding: queryEmbedding,
    query_text: "", // Vector-only mode
    match_user_id: userId,
    match_count: limit,
    vector_weight: 1.0, // Vector only
    lexical_weight: 0.0,
    rrf_k: 60,
    filter_tiers: tiers || null,
    filter_kinds: kinds || null,
    filter_static_only: staticOnly || false,
    filter_tags: tags || null,
    filter_min_importance: minImportance || null,
    filter_exclude_forgotten: excludeForgotten,
  })

  if (error) {
    console.error("[hybrid-search] Vector search error:", error)
    return []
  }

  // Map to result type
  return (data || [])
    .filter((row: { vector_similarity: number }) => row.vector_similarity >= threshold)
    .map(mapDbRowToSearchResult)
}

/**
 * Lexical-only search using tsvector and trigram
 */
async function lexicalSearch(
  supabase: AnySupabaseClient,
  params: {
    userId: string
    query: string
    limit: number
    threshold: number
    tiers?: MemoryTier[]
    kinds?: MemoryKind[]
    staticOnly?: boolean
    tags?: string[]
    minImportance?: number
    excludeForgotten?: boolean
  }
): Promise<MemorySearchResultV2[]> {
  const {
    userId,
    query,
    limit,
    threshold,
    tiers,
    kinds,
    staticOnly,
    tags,
    minImportance,
    excludeForgotten,
  } = params

  // Call the database function
  const { data, error } = await supabase.rpc("hybrid_search_memories", {
    query_embedding: null, // Lexical-only mode
    query_text: query,
    match_user_id: userId,
    match_count: limit,
    vector_weight: 0.0,
    lexical_weight: 1.0, // Lexical only
    rrf_k: 60,
    filter_tiers: tiers || null,
    filter_kinds: kinds || null,
    filter_static_only: staticOnly || false,
    filter_tags: tags || null,
    filter_min_importance: minImportance || null,
    filter_exclude_forgotten: excludeForgotten,
  })

  if (error) {
    console.error("[hybrid-search] Lexical search error:", error)
    return []
  }

  // Map to result type
  return (data || [])
    .filter((row: { lexical_score: number }) => row.lexical_score >= threshold)
    .map(mapDbRowToSearchResult)
}

/**
 * Reciprocal Rank Fusion (RRF) to combine search results
 * RRF(d) = Σ 1 / (k + rank_i(d))
 */
function rrfFusion(
  vectorResults: MemorySearchResultV2[],
  lexicalResults: MemorySearchResultV2[],
  vectorWeight: number,
  lexicalWeight: number,
  k: number
): MemorySearchResultV2[] {
  const scoreMap = new Map<
    string,
    { result: MemorySearchResultV2; rrfScore: number }
  >()

  // Score vector results
  vectorResults.forEach((result, rank) => {
    const rrfScore = (vectorWeight * 1) / (k + rank + 1)
    const existing = scoreMap.get(result.id)
    if (existing) {
      existing.rrfScore += rrfScore
      // Keep the higher vector similarity
      if ((result.vector_similarity ?? 0) > (existing.result.vector_similarity ?? 0)) {
        existing.result.vector_similarity = result.vector_similarity
      }
    } else {
      scoreMap.set(result.id, {
        result: { ...result },
        rrfScore,
      })
    }
  })

  // Score lexical results
  lexicalResults.forEach((result, rank) => {
    const rrfScore = (lexicalWeight * 1) / (k + rank + 1)
    const existing = scoreMap.get(result.id)
    if (existing) {
      existing.rrfScore += rrfScore
      // Keep the higher lexical score
      if ((result.lexical_score ?? 0) > (existing.result.lexical_score ?? 0)) {
        existing.result.lexical_score = result.lexical_score
      }
    } else {
      scoreMap.set(result.id, {
        result: { ...result },
        rrfScore,
      })
    }
  })

  // Sort by RRF score
  const sorted = Array.from(scoreMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map(({ result, rrfScore }) => ({
      ...result,
      rrf_score: rrfScore,
      final_score: rrfScore,
    }))

  return sorted
}

// ============================================================================
// PROFILE SEARCH (SUPERMEMORY PATTERN)
// ============================================================================

/**
 * Get memory profile - static + dynamic memories for context injection
 * Implements Supermemory's /v4/profile pattern
 */
export async function getMemoryProfile(
  supabase: AnySupabaseClient,
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

  // Try hot cache first for static memories
  const hotCache = getHotCache()
  const cachedHot = hotCache.getFiltered(userId, { staticOnly: true })

  let staticMs = 0
  let dynamicMs = 0
  let searchMs: number | undefined

  // Get static memories (always included)
  const staticStart = Date.now()
  let staticMemories: UserMemoryV2[]

  if (cachedHot && cachedHot.length > 0) {
    // Use cached static memories
    staticMemories = cachedHot.slice(0, staticLimit)
    staticMs = Date.now() - staticStart
  } else {
    // Fetch from database
    const { data: staticData, error: staticError } = await supabase.rpc(
      "get_memory_profile",
      {
        match_user_id: userId,
        static_limit: staticLimit,
        dynamic_limit: 0, // Only get static
        query_embedding: null,
      }
    )
    staticMs = Date.now() - staticStart

    if (staticError) {
      console.error("[hybrid-search] Static profile error:", staticError)
      staticMemories = []
    } else {
      staticMemories = (staticData || [])
        .filter((row: { is_static: boolean }) => row.is_static)
        .map(mapDbRowToMemory)
    }
  }

  // Get dynamic memories (query-dependent)
  const dynamicStart = Date.now()
  let dynamicMemories: UserMemoryV2[] = []

  if (query || queryEmbedding) {
    const embedding = queryEmbedding || (await generateEmbedding(query!))

    const { data: dynamicData, error: dynamicError } = await supabase.rpc(
      "get_memory_profile",
      {
        match_user_id: userId,
        static_limit: 0, // Only get dynamic
        dynamic_limit: dynamicLimit,
        query_embedding: embedding,
      }
    )

    if (dynamicError) {
      console.error("[hybrid-search] Dynamic profile error:", dynamicError)
    } else {
      dynamicMemories = (dynamicData || [])
        .filter((row: { is_static: boolean }) => !row.is_static)
        .map(mapDbRowToMemory)
    }
  }
  dynamicMs = Date.now() - dynamicStart

  // Deduplicate: static > dynamic (Supermemory pattern)
  const staticIds = new Set(staticMemories.map((m) => m.id))
  dynamicMemories = dynamicMemories.filter((m) => !staticIds.has(m.id))

  // Optional: Also get search results if query provided
  let searchResults: MemorySearchResultV2[] | undefined
  if (query) {
    const searchStart = Date.now()
    const searchResponse = await hybridSearch(supabase, {
      query,
      queryEmbedding: queryEmbedding || undefined,
      userId,
      limit: 5,
      excludeForgotten: true,
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
      staticMs,
      dynamicMs,
      searchMs,
      totalMs: Date.now() - startTime,
    },
  }
}

// ============================================================================
// TIERED SEARCH
// ============================================================================

/**
 * Multi-tier search: hot → warm → cold
 * Returns as soon as sufficient results found
 */
export async function tieredSearch(
  supabase: AnySupabaseClient,
  params: HybridSearchParams
): Promise<HybridSearchResponse> {
  const startTime = Date.now()
  const { userId, limit = 10 } = params

  // 1. Try hot cache first (<5ms)
  const hotCache = getHotCache()
  const hotMemories = hotCache.get(userId)

  if (hotMemories && hotMemories.length >= limit) {
    // Filter hot cache based on query
    const queryEmbedding =
      params.queryEmbedding || (await generateEmbedding(params.query))

    const scoredHot = hotMemories.map((m) => {
      // Parse embedding if it's a JSON string
      let embedding: number[] | null = null
      if (Array.isArray(m.embedding)) {
        embedding = m.embedding
      } else if (typeof m.embedding === "string") {
        try {
          embedding = JSON.parse(m.embedding)
        } catch {
          embedding = null
        }
      }

      return {
        memory: m,
        similarity: embedding && queryEmbedding
          ? cosineSimilarity(queryEmbedding, embedding)
          : 0,
      }
    })

    scoredHot.sort((a, b) => b.similarity - a.similarity)
    const topHot = scoredHot.slice(0, limit)

    // Convert to search results
    const results: MemorySearchResultV2[] = topHot.map(({ memory, similarity }) => ({
      id: memory.id,
      content: memory.content,
      memory_tier: memory.memory_tier,
      memory_kind: memory.memory_kind,
      is_static: memory.is_static,
      importance_score: memory.importance_score,
      metadata: memory.metadata,
      tags: memory.tags,
      vector_similarity: similarity,
      lexical_score: 0,
      rrf_score: similarity,
      final_score: similarity,
      source_chat_id: memory.source_chat_id,
      is_inference: memory.is_inference,
      created_at: memory.created_at,
      last_accessed_at: memory.last_accessed_at,
    }))

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

  // 2. Fall back to warm tier (full hybrid search)
  return hybridSearch(supabase, {
    ...params,
    tiers: ["hot", "warm"], // Exclude cold for speed
  })
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map database row to MemorySearchResultV2
 */
function mapDbRowToSearchResult(row: Record<string, unknown>): MemorySearchResultV2 {
  return {
    id: row.id as string,
    content: row.content as string,
    memory_tier: row.memory_tier as MemoryTier,
    memory_kind: row.memory_kind as MemoryKind,
    is_static: row.is_static as boolean,
    importance_score: row.importance_score as number,
    metadata: row.metadata as MemorySearchResultV2["metadata"],
    tags: (row.tags as string[]) || [],
    vector_similarity: (row.vector_similarity as number) || 0,
    lexical_score: (row.lexical_score as number) || 0,
    rrf_score: (row.rrf_score as number) || 0,
    final_score: (row.final_score as number) || 0,
    source_chat_id: row.source_chat_id as string | null,
    is_inference: row.is_inference as boolean,
    created_at: row.created_at as string,
    last_accessed_at: row.last_accessed_at as string | null,
  }
}

/**
 * Map database row to UserMemoryV2
 */
function mapDbRowToMemory(row: Record<string, unknown>): UserMemoryV2 {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    content: row.content as string,
    memory_tier: row.memory_tier as MemoryTier,
    memory_kind: row.memory_kind as MemoryKind,
    memory_type: row.memory_type as "auto" | "explicit",
    is_static: row.is_static as boolean,
    version: row.version as number,
    is_latest: row.is_latest as boolean,
    parent_memory_id: row.parent_memory_id as string | null,
    root_memory_id: row.root_memory_id as string | null,
    is_forgotten: row.is_forgotten as boolean,
    forget_after: row.forget_after as string | null,
    forget_reason: row.forget_reason as string | null,
    source_count: row.source_count as number,
    is_inference: row.is_inference as boolean,
    source_chat_id: row.source_chat_id as string | null,
    source_message_id: row.source_message_id as number | null,
    event_timestamp: row.event_timestamp as string | null,
    valid_from: row.valid_from as string,
    valid_until: row.valid_until as string | null,
    importance_score: row.importance_score as number,
    access_count: row.access_count as number,
    access_velocity: row.access_velocity as number,
    last_accessed_at: row.last_accessed_at as string | null,
    embedding: row.embedding as number[] | null,
    embedding_model: row.embedding_model as string | null,
    matryoshka_embedding: row.matryoshka_embedding as number[] | null,
    metadata: row.metadata as UserMemoryV2["metadata"],
    tags: (row.tags as string[]) || [],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Format memories for system prompt injection (Supermemory pattern)
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
 * Following Supermemory's deduplication pattern
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
