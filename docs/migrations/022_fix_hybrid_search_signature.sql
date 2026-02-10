-- ============================================================================
-- MIGRATION 022: Fix Hybrid Search Function Signature
-- ============================================================================
--
-- This migration fixes the parameter mismatch between the TypeScript code
-- in lib/memory/hybrid-search.ts and the database function.
--
-- Changes:
-- - REMOVED: similarity_threshold (filtering now done in TypeScript)
-- - REMOVED: include_static (replaced by filter_static_only with inverted logic)
-- - RENAMED: memory_tiers -> filter_tiers
-- - ADDED: rrf_k (RRF constant, typically 60)
-- - ADDED: filter_kinds (filter by memory kind)
-- - ADDED: filter_static_only (only return static memories)
-- - ADDED: filter_tags (filter by tags array)
-- - ADDED: filter_min_importance (minimum importance threshold)
-- - ADDED: filter_exclude_forgotten (exclude forgotten memories)
--
-- Return Column Changes:
-- - RENAMED: vector_score -> vector_similarity
-- - RENAMED: combined_score -> final_score
-- - ADDED: rrf_score
-- - ADDED: source_chat_id
-- - ADDED: is_inference
-- - ADDED: last_accessed_at
-- - REMOVED: summary (not used by TypeScript)
--
-- ============================================================================

-- Drop the old function (signature has changed, so we must drop first)
DROP FUNCTION IF EXISTS hybrid_search_memories(
    vector(1536), TEXT, UUID, INT, FLOAT, FLOAT, FLOAT, BOOLEAN, memory_tier[]
);

-- Create the new function with updated signature
CREATE OR REPLACE FUNCTION hybrid_search_memories(
    query_embedding vector(1536),
    query_text TEXT,
    match_user_id UUID,
    match_count INT DEFAULT 10,
    vector_weight FLOAT DEFAULT 0.6,
    lexical_weight FLOAT DEFAULT 0.4,
    rrf_k INT DEFAULT 60,
    filter_tiers memory_tier[] DEFAULT NULL,
    filter_kinds memory_kind[] DEFAULT NULL,
    filter_static_only BOOLEAN DEFAULT false,
    filter_tags TEXT[] DEFAULT NULL,
    filter_min_importance FLOAT DEFAULT NULL,
    filter_exclude_forgotten BOOLEAN DEFAULT true
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    memory_tier memory_tier,
    memory_kind memory_kind,
    is_static BOOLEAN,
    importance_score FLOAT,
    metadata JSONB,
    tags TEXT[],
    vector_similarity FLOAT,
    lexical_score FLOAT,
    rrf_score FLOAT,
    final_score FLOAT,
    source_chat_id UUID,
    is_inference BOOLEAN,
    created_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    effective_tiers memory_tier[];
BEGIN
    -- Default to hot and warm tiers if not specified
    effective_tiers := COALESCE(filter_tiers, ARRAY['hot', 'warm']::memory_tier[]);

    RETURN QUERY
    WITH
    -- Vector search results with ranking
    vector_results AS (
        SELECT
            m.id,
            (1 - (m.embedding <=> query_embedding))::FLOAT AS v_similarity,
            ROW_NUMBER() OVER (
                ORDER BY m.embedding <=> query_embedding
            ) AS v_rank
        FROM memories_v2 m
        WHERE m.user_id = match_user_id
            AND m.is_latest = true
            AND (NOT filter_exclude_forgotten OR m.is_forgotten = false)
            AND m.memory_tier = ANY(effective_tiers)
            AND (filter_kinds IS NULL OR m.memory_kind = ANY(filter_kinds))
            AND (NOT filter_static_only OR m.is_static = true)
            AND (filter_tags IS NULL OR m.tags && filter_tags)
            AND (filter_min_importance IS NULL OR m.importance_score >= filter_min_importance)
            AND (m.valid_until IS NULL OR m.valid_until > NOW())
            AND query_embedding IS NOT NULL
            AND m.embedding IS NOT NULL
        ORDER BY m.embedding <=> query_embedding
        LIMIT match_count * 3
    ),

    -- Lexical search results with ranking
    lexical_results AS (
        SELECT
            m.id,
            ts_rank_cd(m.content_tsvector, plainto_tsquery('english', query_text))::FLOAT AS l_score,
            ROW_NUMBER() OVER (
                ORDER BY ts_rank_cd(m.content_tsvector, plainto_tsquery('english', query_text)) DESC
            ) AS l_rank
        FROM memories_v2 m
        WHERE m.user_id = match_user_id
            AND m.is_latest = true
            AND (NOT filter_exclude_forgotten OR m.is_forgotten = false)
            AND m.memory_tier = ANY(effective_tiers)
            AND (filter_kinds IS NULL OR m.memory_kind = ANY(filter_kinds))
            AND (NOT filter_static_only OR m.is_static = true)
            AND (filter_tags IS NULL OR m.tags && filter_tags)
            AND (filter_min_importance IS NULL OR m.importance_score >= filter_min_importance)
            AND query_text IS NOT NULL
            AND query_text != ''
            AND m.content_tsvector @@ plainto_tsquery('english', query_text)
        LIMIT match_count * 3
    ),

    -- Merge IDs and scores from both result sets
    merged_scores AS (
        SELECT
            COALESCE(v.id, l.id) AS memory_id,
            COALESCE(v.v_similarity, 0)::FLOAT AS v_similarity,
            COALESCE(l.l_score, 0)::FLOAT AS l_score,
            COALESCE(v.v_rank, 1000)::INT AS v_rank,
            COALESCE(l.l_rank, 1000)::INT AS l_rank
        FROM vector_results v
        FULL OUTER JOIN lexical_results l ON v.id = l.id
    ),

    -- Calculate RRF scores and join back to get full memory data
    scored AS (
        SELECT
            ms.memory_id,
            ms.v_similarity,
            ms.l_score,
            -- RRF score: weight * 1/(k + rank) for each result set
            (
                vector_weight * (1.0 / (rrf_k + ms.v_rank)) +
                lexical_weight * (1.0 / (rrf_k + ms.l_rank))
            )::FLOAT AS rrf_score
        FROM merged_scores ms
    )

    -- Final selection with all memory columns
    SELECT
        m.id,
        m.content,
        m.memory_tier,
        m.memory_kind,
        m.is_static,
        m.importance_score,
        m.metadata,
        m.tags,
        s.v_similarity AS vector_similarity,
        s.l_score AS lexical_score,
        s.rrf_score,
        s.rrf_score AS final_score,
        m.source_chat_id,
        m.is_inference,
        m.created_at,
        m.last_accessed_at
    FROM scored s
    JOIN memories_v2 m ON s.memory_id = m.id
    ORDER BY s.rrf_score DESC
    LIMIT match_count;
END;
$$;

-- Add helpful comment
COMMENT ON FUNCTION hybrid_search_memories IS
'Enterprise-grade hybrid search with RRF fusion.

Supports three modes:
1. Vector-only: query_embedding provided, query_text empty (vector_weight=1, lexical_weight=0)
2. Lexical-only: query_embedding null, query_text provided (vector_weight=0, lexical_weight=1)
3. Hybrid: both provided with configurable weights

Filtering options:
- filter_tiers: Limit to specific memory tiers (hot/warm/cold)
- filter_kinds: Limit to specific memory kinds (episodic/semantic/procedural/profile)
- filter_static_only: Only return static (always-relevant) memories
- filter_tags: Filter by tag overlap (uses && operator)
- filter_min_importance: Minimum importance score threshold
- filter_exclude_forgotten: Exclude soft-deleted memories (default: true)

RRF (Reciprocal Rank Fusion) combines vector and lexical rankings:
RRF(d) = vector_weight/(k + rank_v) + lexical_weight/(k + rank_l)
where k is the rrf_k constant (default: 60).';

-- ============================================================================
-- VERIFICATION QUERY (run manually after migration)
-- ============================================================================
-- SELECT
--     p.proname AS function_name,
--     pg_get_function_arguments(p.oid) AS arguments,
--     pg_get_function_result(p.oid) AS return_type
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--     AND p.proname = 'hybrid_search_memories';
-- ============================================================================
