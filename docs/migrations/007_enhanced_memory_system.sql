-- ============================================================================
-- MIGRATION 007: Enhanced Memory System
-- ============================================================================
-- This migration creates the enterprise-grade memory and RAG system
-- Inspired by Supermemory's architecture patterns
-- Features: Memory versioning, tiering, forgetting, knowledge graph, hybrid search
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For fuzzy text matching
CREATE EXTENSION IF NOT EXISTS vector;    -- For pgvector (should already exist)

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Memory tier for caching strategy
DO $$ BEGIN
    CREATE TYPE memory_tier AS ENUM ('hot', 'warm', 'cold');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Memory kind (inspired by cognitive science)
DO $$ BEGIN
    CREATE TYPE memory_kind AS ENUM ('episodic', 'semantic', 'procedural', 'profile');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Memory relation types (from supermemory)
DO $$ BEGIN
    CREATE TYPE memory_relation AS ENUM ('updates', 'extends', 'derives', 'conflicts');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Chunk types for semantic chunking
DO $$ BEGIN
    CREATE TYPE chunk_type AS ENUM ('paragraph', 'table', 'header', 'list', 'image');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLE: memories_v2 - Enhanced memory storage with versioning and tiering
-- ============================================================================

CREATE TABLE IF NOT EXISTS memories_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Core content
    content TEXT NOT NULL,
    summary TEXT,  -- Compressed version for context injection

    -- Classification (like supermemory's static/dynamic)
    memory_tier memory_tier NOT NULL DEFAULT 'warm',
    memory_kind memory_kind NOT NULL DEFAULT 'semantic',
    is_static BOOLEAN DEFAULT false,  -- Always include in context (static memories)

    -- Versioning (from supermemory's MemoryEntrySchema)
    version INTEGER DEFAULT 1,
    is_latest BOOLEAN DEFAULT true,
    parent_memory_id UUID REFERENCES memories_v2(id) ON DELETE SET NULL,
    root_memory_id UUID REFERENCES memories_v2(id) ON DELETE SET NULL,

    -- Forgetting mechanism (from supermemory)
    is_forgotten BOOLEAN DEFAULT false,
    forget_after TIMESTAMPTZ,
    forget_reason TEXT,

    -- Source tracking (from supermemory)
    source_count INTEGER DEFAULT 1,  -- How many docs support this memory
    is_inference BOOLEAN DEFAULT false,  -- AI-generated vs user-stated
    source_chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
    source_message_id INTEGER,
    extraction_method TEXT DEFAULT 'auto',  -- 'auto', 'explicit', 'inferred'

    -- Temporal data (for episodic memories)
    event_timestamp TIMESTAMPTZ,  -- When the event occurred
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,  -- For time-bounded facts

    -- Scoring
    importance_score FLOAT DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
    confidence_score FLOAT DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    decay_factor FLOAT DEFAULT 0.99,  -- Daily decay multiplier

    -- Access patterns
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    access_velocity FLOAT DEFAULT 0,  -- Accesses per day (rolling 7-day)

    -- Embeddings (multiple models like supermemory)
    embedding vector(1536),
    embedding_model TEXT DEFAULT 'google/gemini-embedding-001',
    matryoshka_embedding vector(256),  -- For fast initial filtering

    -- Full-text search
    content_tsvector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    category TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE memories_v2 IS 'Enhanced memory storage with versioning, tiering, and forgetting mechanisms. Inspired by Supermemory architecture.';

-- ============================================================================
-- TABLE: memory_relations - Graph edges between memories
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_memory_id UUID NOT NULL REFERENCES memories_v2(id) ON DELETE CASCADE,
    target_memory_id UUID NOT NULL REFERENCES memories_v2(id) ON DELETE CASCADE,
    relation_type memory_relation NOT NULL,
    confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(source_memory_id, target_memory_id, relation_type)
);

COMMENT ON TABLE memory_relations IS 'Graph edges representing relationships between memories (updates, extends, derives, conflicts).';

-- ============================================================================
-- TABLE: kg_entities - Knowledge graph entity nodes
-- ============================================================================

CREATE TABLE IF NOT EXISTS kg_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Entity identification
    entity_type TEXT NOT NULL,  -- 'person', 'organization', 'foundation'
    name TEXT NOT NULL,
    canonical_name TEXT NOT NULL,  -- Normalized name for deduplication

    -- Attributes (varies by entity type)
    attributes JSONB DEFAULT '{}',

    -- Embedding for semantic search
    embedding vector(1536),

    -- Metadata
    source_memories UUID[] DEFAULT '{}',  -- Memory IDs that mention this entity
    mention_count INTEGER DEFAULT 1,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, entity_type, canonical_name)
);

COMMENT ON TABLE kg_entities IS 'Knowledge graph entity nodes for donor research (persons, organizations, foundations).';

-- ============================================================================
-- TABLE: kg_relations - Entity relationship edges
-- ============================================================================

CREATE TABLE IF NOT EXISTS kg_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_entity_id UUID NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
    target_entity_id UUID NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,

    -- Relationship type
    relation_type TEXT NOT NULL,  -- 'works_at', 'board_member', 'donated_to', 'owns', etc.

    -- Attributes
    attributes JSONB DEFAULT '{}',  -- e.g., {"role": "CEO", "since": "2020"}

    -- Temporal validity
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,

    -- Provenance
    source_memory_id UUID REFERENCES memories_v2(id) ON DELETE SET NULL,
    confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(source_entity_id, target_entity_id, relation_type)
);

COMMENT ON TABLE kg_relations IS 'Entity relationships for multi-hop knowledge graph queries.';

-- ============================================================================
-- TABLE: rag_chunks_v2 - Semantic chunks with structure preservation
-- ============================================================================

CREATE TABLE IF NOT EXISTS rag_chunks_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Chunk content
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,  -- For deduplication

    -- Semantic structure (from semantic chunking)
    chunk_type chunk_type DEFAULT 'paragraph',
    parent_header TEXT,  -- Contextual header chain
    section_path TEXT[],  -- ['Chapter 1', 'Section 2', 'Subsection 2.1']

    -- Position
    chunk_index INTEGER NOT NULL,
    page_number INTEGER,
    char_start INTEGER,
    char_end INTEGER,

    -- Embeddings (multiple models like supermemory)
    embedding vector(1536),
    embedding_model TEXT DEFAULT 'google/gemini-embedding-001',
    matryoshka_embedding vector(256),  -- For fast filtering

    -- Full-text search
    content_tsvector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,

    -- Token count
    token_count INTEGER,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE rag_chunks_v2 IS 'Semantic document chunks with structure preservation for enhanced RAG.';

-- ============================================================================
-- INDEXES - Optimized for hybrid search and knowledge graph queries
-- ============================================================================

-- memories_v2 indexes
CREATE INDEX IF NOT EXISTS idx_memories_v2_user_tier
    ON memories_v2(user_id, memory_tier);

CREATE INDEX IF NOT EXISTS idx_memories_v2_user_kind
    ON memories_v2(user_id, memory_kind);

CREATE INDEX IF NOT EXISTS idx_memories_v2_user_static
    ON memories_v2(user_id)
    WHERE is_static = true AND is_forgotten = false AND is_latest = true;

CREATE INDEX IF NOT EXISTS idx_memories_v2_user_latest
    ON memories_v2(user_id)
    WHERE is_latest = true AND is_forgotten = false;

CREATE INDEX IF NOT EXISTS idx_memories_v2_importance
    ON memories_v2(user_id, importance_score DESC)
    WHERE is_forgotten = false AND is_latest = true;

CREATE INDEX IF NOT EXISTS idx_memories_v2_access
    ON memories_v2(user_id, last_accessed_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_memories_v2_validity
    ON memories_v2(user_id, valid_from, valid_until);

CREATE INDEX IF NOT EXISTS idx_memories_v2_root
    ON memories_v2(root_memory_id)
    WHERE root_memory_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_memories_v2_forget
    ON memories_v2(forget_after)
    WHERE forget_after IS NOT NULL AND is_forgotten = false;

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_memories_v2_fts
    ON memories_v2 USING GIN(content_tsvector);

-- Trigram index for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_memories_v2_trgm
    ON memories_v2 USING GIN(content gin_trgm_ops);

-- HNSW vector indexes with production settings (m=32, ef_construction=128)
-- These settings provide ~2x better recall than defaults
CREATE INDEX IF NOT EXISTS idx_memories_v2_embedding
    ON memories_v2 USING hnsw (embedding vector_cosine_ops)
    WITH (m = 32, ef_construction = 128);

-- Matryoshka embedding for fast initial filtering
CREATE INDEX IF NOT EXISTS idx_memories_v2_matryoshka
    ON memories_v2 USING hnsw (matryoshka_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Knowledge graph indexes
CREATE INDEX IF NOT EXISTS idx_kg_entities_user_type
    ON kg_entities(user_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_kg_entities_name
    ON kg_entities USING GIN(canonical_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_kg_entities_embedding
    ON kg_entities USING hnsw (embedding vector_cosine_ops)
    WITH (m = 32, ef_construction = 128);

CREATE INDEX IF NOT EXISTS idx_kg_relations_source
    ON kg_relations(source_entity_id);

CREATE INDEX IF NOT EXISTS idx_kg_relations_target
    ON kg_relations(target_entity_id);

CREATE INDEX IF NOT EXISTS idx_kg_relations_type
    ON kg_relations(relation_type);

-- RAG chunks v2 indexes
CREATE INDEX IF NOT EXISTS idx_rag_chunks_v2_document
    ON rag_chunks_v2(document_id);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_v2_user
    ON rag_chunks_v2(user_id);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_v2_hash
    ON rag_chunks_v2(content_hash);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_v2_fts
    ON rag_chunks_v2 USING GIN(content_tsvector);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_v2_trgm
    ON rag_chunks_v2 USING GIN(content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_v2_embedding
    ON rag_chunks_v2 USING hnsw (embedding vector_cosine_ops)
    WITH (m = 32, ef_construction = 128);

-- ============================================================================
-- FUNCTIONS: Hybrid Search with RRF Fusion
-- ============================================================================

-- Function to search memories using hybrid vector + lexical search
CREATE OR REPLACE FUNCTION hybrid_search_memories(
    query_embedding vector(1536),
    query_text TEXT,
    match_user_id UUID,
    match_count INT DEFAULT 10,
    similarity_threshold FLOAT DEFAULT 0.5,
    vector_weight FLOAT DEFAULT 0.6,
    lexical_weight FLOAT DEFAULT 0.4,
    include_static BOOLEAN DEFAULT true,
    memory_tiers memory_tier[] DEFAULT ARRAY['hot', 'warm']::memory_tier[]
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    summary TEXT,
    memory_kind memory_kind,
    memory_tier memory_tier,
    is_static BOOLEAN,
    importance_score FLOAT,
    metadata JSONB,
    tags TEXT[],
    vector_score FLOAT,
    lexical_score FLOAT,
    combined_score FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT
            m.id,
            m.content,
            m.summary,
            m.memory_kind,
            m.memory_tier,
            m.is_static,
            m.importance_score,
            m.metadata,
            m.tags,
            (1 - (m.embedding <=> query_embedding)) AS v_score,
            m.created_at
        FROM memories_v2 m
        WHERE m.user_id = match_user_id
            AND m.is_latest = true
            AND m.is_forgotten = false
            AND m.memory_tier = ANY(memory_tiers)
            AND (m.valid_until IS NULL OR m.valid_until > NOW())
            AND 1 - (m.embedding <=> query_embedding) > similarity_threshold
        ORDER BY m.embedding <=> query_embedding
        LIMIT match_count * 3
    ),
    lexical_results AS (
        SELECT
            m.id,
            ts_rank_cd(m.content_tsvector, plainto_tsquery('english', query_text)) AS l_score
        FROM memories_v2 m
        WHERE m.user_id = match_user_id
            AND m.is_latest = true
            AND m.is_forgotten = false
            AND m.memory_tier = ANY(memory_tiers)
            AND m.content_tsvector @@ plainto_tsquery('english', query_text)
        LIMIT match_count * 3
    ),
    static_memories AS (
        SELECT
            m.id,
            m.content,
            m.summary,
            m.memory_kind,
            m.memory_tier,
            m.is_static,
            m.importance_score,
            m.metadata,
            m.tags,
            1.0 AS v_score,  -- Static memories get full score
            1.0 AS l_score,
            m.created_at
        FROM memories_v2 m
        WHERE m.user_id = match_user_id
            AND m.is_static = true
            AND m.is_latest = true
            AND m.is_forgotten = false
            AND include_static = true
    ),
    combined AS (
        SELECT
            v.id,
            v.content,
            v.summary,
            v.memory_kind,
            v.memory_tier,
            v.is_static,
            v.importance_score,
            v.metadata,
            v.tags,
            COALESCE(v.v_score, 0) AS vector_score,
            COALESCE(l.l_score, 0) AS lexical_score,
            -- Combined score with importance boost
            (COALESCE(v.v_score, 0) * vector_weight +
             COALESCE(l.l_score, 0) * lexical_weight +
             v.importance_score * 0.1) AS combined_score,
            v.created_at
        FROM vector_results v
        LEFT JOIN lexical_results l ON v.id = l.id

        UNION ALL

        -- Include static memories with boosted score
        SELECT
            s.id,
            s.content,
            s.summary,
            s.memory_kind,
            s.memory_tier,
            s.is_static,
            s.importance_score,
            s.metadata,
            s.tags,
            s.v_score AS vector_score,
            s.l_score AS lexical_score,
            2.0 AS combined_score,  -- Static memories always rank high
            s.created_at
        FROM static_memories s
        WHERE NOT EXISTS (SELECT 1 FROM vector_results vr WHERE vr.id = s.id)
    )
    SELECT DISTINCT ON (c.id)
        c.id,
        c.content,
        c.summary,
        c.memory_kind,
        c.memory_tier,
        c.is_static,
        c.importance_score,
        c.metadata,
        c.tags,
        c.vector_score,
        c.lexical_score,
        c.combined_score,
        c.created_at
    FROM combined c
    ORDER BY c.id, c.combined_score DESC
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION hybrid_search_memories IS 'Hybrid search combining vector similarity and lexical matching with RRF-style fusion. Includes static memories automatically.';

-- ============================================================================
-- FUNCTION: RRF (Reciprocal Rank Fusion) Search
-- ============================================================================

CREATE OR REPLACE FUNCTION rrf_search_memories(
    query_embedding vector(1536),
    query_text TEXT,
    match_user_id UUID,
    match_count INT DEFAULT 10,
    k_constant INT DEFAULT 60  -- RRF constant (typically 60)
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    rrf_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH vector_ranked AS (
        SELECT
            m.id,
            m.content,
            ROW_NUMBER() OVER (ORDER BY m.embedding <=> query_embedding) AS rank
        FROM memories_v2 m
        WHERE m.user_id = match_user_id
            AND m.is_latest = true
            AND m.is_forgotten = false
        ORDER BY m.embedding <=> query_embedding
        LIMIT match_count * 3
    ),
    lexical_ranked AS (
        SELECT
            m.id,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(m.content_tsvector,
                plainto_tsquery('english', query_text)) DESC) AS rank
        FROM memories_v2 m
        WHERE m.user_id = match_user_id
            AND m.is_latest = true
            AND m.is_forgotten = false
            AND m.content_tsvector @@ plainto_tsquery('english', query_text)
        LIMIT match_count * 3
    ),
    fused AS (
        SELECT
            COALESCE(v.id, l.id) AS id,
            COALESCE(v.content, (SELECT content FROM memories_v2 WHERE id = l.id)) AS content,
            (1.0 / (k_constant + COALESCE(v.rank, 1000))) +
            (1.0 / (k_constant + COALESCE(l.rank, 1000))) AS rrf_score
        FROM vector_ranked v
        FULL OUTER JOIN lexical_ranked l ON v.id = l.id
    )
    SELECT f.id, f.content, f.rrf_score
    FROM fused f
    ORDER BY f.rrf_score DESC
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION rrf_search_memories IS 'Reciprocal Rank Fusion search combining vector and lexical rankings.';

-- ============================================================================
-- FUNCTION: Knowledge Graph Traversal
-- ============================================================================

CREATE OR REPLACE FUNCTION kg_traverse(
    start_entity_id UUID,
    max_depth INT DEFAULT 2,
    relation_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    entity_id UUID,
    entity_type TEXT,
    entity_name TEXT,
    relation_path TEXT[],
    depth INT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE traversal AS (
        -- Base case: start entity
        SELECT
            e.id AS entity_id,
            e.entity_type,
            e.name AS entity_name,
            ARRAY[]::TEXT[] AS relation_path,
            0 AS depth
        FROM kg_entities e
        WHERE e.id = start_entity_id

        UNION ALL

        -- Recursive case: follow relations
        SELECT
            e.id,
            e.entity_type,
            e.name,
            t.relation_path || r.relation_type,
            t.depth + 1
        FROM traversal t
        JOIN kg_relations r ON t.entity_id = r.source_entity_id
        JOIN kg_entities e ON r.target_entity_id = e.id
        WHERE t.depth < max_depth
            AND (relation_types IS NULL OR r.relation_type = ANY(relation_types))
            AND (r.valid_until IS NULL OR r.valid_until > NOW())
    )
    SELECT * FROM traversal
    WHERE depth > 0  -- Exclude start entity
    ORDER BY depth, entity_name;
END;
$$;

COMMENT ON FUNCTION kg_traverse IS 'Multi-hop knowledge graph traversal with optional relation type filtering.';

-- ============================================================================
-- FUNCTION: Get Memory Profile (static + dynamic)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_memory_profile(
    match_user_id UUID,
    query_embedding vector(1536) DEFAULT NULL,
    query_text TEXT DEFAULT NULL,
    static_limit INT DEFAULT 10,
    dynamic_limit INT DEFAULT 10
)
RETURNS TABLE (
    memory_type TEXT,  -- 'static' or 'dynamic'
    id UUID,
    content TEXT,
    memory_kind memory_kind,
    importance_score FLOAT,
    metadata JSONB,
    similarity_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    -- Static memories (always included)
    (
        SELECT
            'static'::TEXT AS memory_type,
            m.id,
            m.content,
            m.memory_kind,
            m.importance_score,
            m.metadata,
            1.0::FLOAT AS similarity_score
        FROM memories_v2 m
        WHERE m.user_id = match_user_id
            AND m.is_static = true
            AND m.is_latest = true
            AND m.is_forgotten = false
            AND (m.valid_until IS NULL OR m.valid_until > NOW())
        ORDER BY m.importance_score DESC
        LIMIT static_limit
    )

    UNION ALL

    -- Dynamic memories (query-dependent)
    (
        SELECT
            'dynamic'::TEXT AS memory_type,
            m.id,
            m.content,
            m.memory_kind,
            m.importance_score,
            m.metadata,
            CASE
                WHEN query_embedding IS NOT NULL THEN (1 - (m.embedding <=> query_embedding))::FLOAT
                ELSE 0.5::FLOAT
            END AS similarity_score
        FROM memories_v2 m
        WHERE m.user_id = match_user_id
            AND m.is_static = false
            AND m.is_latest = true
            AND m.is_forgotten = false
            AND (m.valid_until IS NULL OR m.valid_until > NOW())
            AND (
                query_embedding IS NULL
                OR (1 - (m.embedding <=> query_embedding)) > 0.5
            )
        ORDER BY
            CASE
                WHEN query_embedding IS NOT NULL THEN (1 - (m.embedding <=> query_embedding))
                ELSE m.importance_score
            END DESC
        LIMIT dynamic_limit
    );
END;
$$;

COMMENT ON FUNCTION get_memory_profile IS 'Get user memory profile with static (always included) and dynamic (query-dependent) memories. Inspired by Supermemory /v4/profile.';

-- ============================================================================
-- FUNCTION: Apply Memory Decay (Run daily via cron)
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_memory_decay()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Apply decay to importance scores
    UPDATE memories_v2
    SET
        importance_score = GREATEST(0.1, importance_score * decay_factor),
        memory_tier = CASE
            WHEN importance_score * decay_factor < 0.2 THEN 'cold'::memory_tier
            WHEN last_accessed_at < NOW() - INTERVAL '7 days' THEN 'cold'::memory_tier
            WHEN last_accessed_at < NOW() - INTERVAL '1 day' THEN 'warm'::memory_tier
            ELSE memory_tier
        END,
        updated_at = NOW()
    WHERE memory_tier != 'cold'
        AND is_forgotten = false
        AND last_accessed_at < NOW() - INTERVAL '1 day';

    -- Boost frequently accessed memories
    UPDATE memories_v2
    SET
        importance_score = LEAST(1.0, importance_score * 1.1),
        memory_tier = 'hot'::memory_tier,
        updated_at = NOW()
    WHERE access_velocity > 1.0  -- More than 1 access per day
        AND last_accessed_at > NOW() - INTERVAL '1 day'
        AND is_forgotten = false;

    -- Mark memories past forget_after as forgotten
    UPDATE memories_v2
    SET
        is_forgotten = true,
        updated_at = NOW()
    WHERE forget_after IS NOT NULL
        AND forget_after < NOW()
        AND is_forgotten = false;
END;
$$;

COMMENT ON FUNCTION apply_memory_decay IS 'Apply daily decay to memory importance scores and update tiers. Should be run via cron job.';

-- ============================================================================
-- FUNCTION: Increment Memory Access
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_memory_access(memory_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE memories_v2
    SET
        access_count = access_count + 1,
        last_accessed_at = NOW(),
        -- Update access velocity (rolling average)
        access_velocity = (access_velocity * 6 + 1) / 7  -- 7-day rolling average
    WHERE id = memory_id;
END;
$$;

COMMENT ON FUNCTION increment_memory_access IS 'Increment access count and update access velocity for a memory.';

-- ============================================================================
-- FUNCTION: Get Memory Stats
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_memory_stats_v2(match_user_id UUID)
RETURNS TABLE (
    total_memories BIGINT,
    static_memories BIGINT,
    hot_memories BIGINT,
    warm_memories BIGINT,
    cold_memories BIGINT,
    episodic_count BIGINT,
    semantic_count BIGINT,
    procedural_count BIGINT,
    profile_count BIGINT,
    avg_importance FLOAT,
    latest_memory_at TIMESTAMPTZ,
    total_entities BIGINT,
    total_relations BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_memories,
        COUNT(*) FILTER (WHERE m.is_static = true)::BIGINT AS static_memories,
        COUNT(*) FILTER (WHERE m.memory_tier = 'hot')::BIGINT AS hot_memories,
        COUNT(*) FILTER (WHERE m.memory_tier = 'warm')::BIGINT AS warm_memories,
        COUNT(*) FILTER (WHERE m.memory_tier = 'cold')::BIGINT AS cold_memories,
        COUNT(*) FILTER (WHERE m.memory_kind = 'episodic')::BIGINT AS episodic_count,
        COUNT(*) FILTER (WHERE m.memory_kind = 'semantic')::BIGINT AS semantic_count,
        COUNT(*) FILTER (WHERE m.memory_kind = 'procedural')::BIGINT AS procedural_count,
        COUNT(*) FILTER (WHERE m.memory_kind = 'profile')::BIGINT AS profile_count,
        AVG(m.importance_score)::FLOAT AS avg_importance,
        MAX(m.created_at) AS latest_memory_at,
        (SELECT COUNT(*) FROM kg_entities WHERE user_id = match_user_id)::BIGINT AS total_entities,
        (SELECT COUNT(*) FROM kg_relations kr
         JOIN kg_entities ke ON kr.source_entity_id = ke.id
         WHERE ke.user_id = match_user_id)::BIGINT AS total_relations
    FROM memories_v2 m
    WHERE m.user_id = match_user_id
        AND m.is_latest = true
        AND m.is_forgotten = false;
END;
$$;

COMMENT ON FUNCTION get_user_memory_stats_v2 IS 'Get comprehensive memory statistics for a user including tier breakdown and knowledge graph counts.';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE memories_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks_v2 ENABLE ROW LEVEL SECURITY;

-- Policies for memories_v2
CREATE POLICY "Users can only access their own memories"
    ON memories_v2
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policies for memory_relations
CREATE POLICY "Users can only access relations for their memories"
    ON memory_relations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM memories_v2
            WHERE id = source_memory_id
            AND user_id = auth.uid()
        )
    );

-- Policies for kg_entities
CREATE POLICY "Users can only access their own entities"
    ON kg_entities
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policies for kg_relations
CREATE POLICY "Users can only access relations for their entities"
    ON kg_relations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM kg_entities
            WHERE id = source_entity_id
            AND user_id = auth.uid()
        )
    );

-- Policies for rag_chunks_v2
CREATE POLICY "Users can only access their own chunks"
    ON rag_chunks_v2
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_memories_v2_updated_at
    BEFORE UPDATE ON memories_v2
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kg_entities_updated_at
    BEFORE UPDATE ON kg_entities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
--
-- This migration should be run during low-traffic periods as HNSW index
-- creation can be resource-intensive. Consider:
--
-- 1. Run during off-peak hours
-- 2. Increase maintenance_work_mem: SET maintenance_work_mem = '1GB';
-- 3. Increase parallel workers: SET max_parallel_maintenance_workers = 4;
--
-- After migration, verify indexes are built:
--   SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass))
--   FROM pg_indexes WHERE tablename LIKE '%memories_v2%';
--
-- ============================================================================
