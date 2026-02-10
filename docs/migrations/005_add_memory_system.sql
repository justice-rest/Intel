-- ============================================================================
-- MEMORY SYSTEM TABLES
-- ============================================================================
-- Migration: 006
-- Description: Add tables for AI memory with vector embeddings for semantic recall
-- Author: Claude Code
-- Date: 2025-01-24
-- ============================================================================

-- Enable pgvector extension for vector similarity search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- USER MEMORIES TABLE
-- ============================================================================
-- Stores important facts and context that the AI should remember about users
-- Supports both automatic extraction and explicit "remember this" commands
-- Uses vector embeddings for semantic retrieval

CREATE TABLE IF NOT EXISTS user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Memory content
  content TEXT NOT NULL,

  -- Memory metadata
  memory_type TEXT NOT NULL DEFAULT 'auto' CHECK (memory_type IN ('auto', 'explicit')),
  importance_score FLOAT DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),

  -- Source tracking (which chat/message this came from)
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Example metadata structure:
  -- {
  --   "source_chat_id": "uuid",
  --   "source_message_id": 123,
  --   "tags": ["preference", "personal"],
  --   "category": "user_info",
  --   "context": "User mentioned their name during onboarding"
  -- }

  -- Embedding vector for semantic search
  -- Using 1536 dimensions (same as RAG for consistency)
  -- Compatible with OpenRouter embeddings (truncated from larger models)
  embedding vector(1536),

  -- Access tracking
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign key constraint (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_memories_user_id_fkey'
  ) THEN
    ALTER TABLE user_memories
      ADD CONSTRAINT user_memories_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON user_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_user_type ON user_memories(user_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_user_memories_importance ON user_memories(user_id, importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_memories_created_at ON user_memories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_memories_last_accessed ON user_memories(user_id, last_accessed_at DESC NULLS LAST);

-- Full-text search index for memory content
CREATE INDEX IF NOT EXISTS idx_user_memories_content_search ON user_memories USING gin(to_tsvector('english', content));

-- CRITICAL: Vector similarity search index using HNSW
-- Using 1536 dimensions (same as RAG chunks)
-- HNSW provides O(log n) search performance
-- m=16: number of bi-directional links per node
-- ef_construction=64: size of dynamic candidate list during index construction
CREATE INDEX IF NOT EXISTS idx_user_memories_embedding ON user_memories
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- RLS (ROW LEVEL SECURITY) POLICIES FOR MEMORY TABLES
-- ============================================================================

ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;

-- Memory policies (users can only access their own memories)
CREATE POLICY "Users can view their own memories"
  ON user_memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own memories"
  ON user_memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories"
  ON user_memories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memories"
  ON user_memories FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- VECTOR SIMILARITY SEARCH FUNCTION FOR MEMORIES
-- ============================================================================
-- Searches for similar memories using cosine similarity
-- Returns memories with similarity scores, sorted by relevance
-- Includes importance weighting in the final ranking

CREATE OR REPLACE FUNCTION search_user_memories(
  query_embedding vector(1536),
  match_user_id UUID,
  match_count INT DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.5,
  memory_type_filter TEXT DEFAULT NULL,
  min_importance FLOAT DEFAULT 0.0
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  memory_type TEXT,
  importance_score FLOAT,
  metadata JSONB,
  similarity FLOAT,
  weighted_score FLOAT,
  created_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.memory_type,
    m.importance_score,
    m.metadata,
    1 - (m.embedding <=> query_embedding) AS similarity,
    -- Weighted score: combine similarity with importance
    -- Formula: (similarity * 0.7) + (importance_score * 0.3)
    ((1 - (m.embedding <=> query_embedding)) * 0.7 + m.importance_score * 0.3) AS weighted_score,
    m.created_at,
    m.last_accessed_at
  FROM user_memories m
  WHERE m.user_id = match_user_id
    AND (memory_type_filter IS NULL OR m.memory_type = memory_type_filter)
    AND m.importance_score >= min_importance
    AND 1 - (m.embedding <=> query_embedding) > similarity_threshold
  ORDER BY
    -- Sort by weighted score (similarity + importance)
    ((1 - (m.embedding <=> query_embedding)) * 0.7 + m.importance_score * 0.3) DESC
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- HELPER FUNCTION: Get memory statistics by user
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_memory_stats(
  user_id_param UUID
)
RETURNS TABLE (
  total_memories BIGINT,
  auto_memories BIGINT,
  explicit_memories BIGINT,
  avg_importance FLOAT,
  most_recent_memory TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_memories,
    COUNT(*) FILTER (WHERE memory_type = 'auto') as auto_memories,
    COUNT(*) FILTER (WHERE memory_type = 'explicit') as explicit_memories,
    COALESCE(AVG(importance_score), 0.0) as avg_importance,
    MAX(created_at) as most_recent_memory
  FROM user_memories
  WHERE user_id = user_id_param;
END;
$$;

-- ============================================================================
-- TRIGGER: Update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_memories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_memories_updated_at_trigger
BEFORE UPDATE ON user_memories
FOR EACH ROW
EXECUTE FUNCTION update_user_memories_updated_at();

-- ============================================================================
-- TRIGGER: Increment access count and update last_accessed_at
-- ============================================================================
-- This function will be called by the application when a memory is retrieved

CREATE OR REPLACE FUNCTION increment_memory_access(memory_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE user_memories
  SET
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = memory_id;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_memories IS 'Stores important facts and context about users for AI memory and personalization';
COMMENT ON FUNCTION search_user_memories IS 'Performs vector similarity search to find relevant memories with importance weighting';
COMMENT ON FUNCTION get_user_memory_stats IS 'Returns statistics about a user''s memory usage';
COMMENT ON FUNCTION increment_memory_access IS 'Increments access count and updates last accessed timestamp for a memory';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
