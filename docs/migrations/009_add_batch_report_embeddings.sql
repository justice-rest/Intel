-- ============================================================================
-- BATCH REPORT EMBEDDINGS
-- Migration: 010_add_batch_report_embeddings.sql
-- Description: Add vector embeddings to batch_prospect_items for RAG
-- ============================================================================

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to batch_prospect_items
ALTER TABLE batch_prospect_items
ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE batch_prospect_items
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMPTZ;

ALTER TABLE batch_prospect_items
ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-3-small';

-- Create HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_batch_items_embedding ON batch_prospect_items
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Composite index for user + completed + embedded queries
CREATE INDEX IF NOT EXISTS idx_batch_items_user_completed_embedded
ON batch_prospect_items (user_id, status)
WHERE status = 'completed' AND embedding IS NOT NULL;

-- Search function for batch reports
CREATE OR REPLACE FUNCTION search_batch_reports(
  query_embedding vector(1536),
  match_user_id UUID,
  match_count INT DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id UUID,
  prospect_name TEXT,
  report_content TEXT,
  romy_score INTEGER,
  capacity_rating TEXT,
  estimated_net_worth NUMERIC,
  estimated_gift_capacity NUMERIC,
  sources_found JSONB,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bi.id,
    bi.prospect_name,
    bi.report_content,
    bi.romy_score,
    bi.capacity_rating,
    bi.estimated_net_worth,
    bi.estimated_gift_capacity,
    bi.sources_found,
    1 - (bi.embedding <=> query_embedding) AS similarity,
    bi.created_at
  FROM batch_prospect_items bi
  WHERE bi.user_id = match_user_id
    AND bi.status = 'completed'
    AND bi.embedding IS NOT NULL
    AND 1 - (bi.embedding <=> query_embedding) > similarity_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Comments
COMMENT ON COLUMN batch_prospect_items.embedding IS 'Vector embedding of report content for semantic search (1536 dimensions)';
COMMENT ON COLUMN batch_prospect_items.embedding_generated_at IS 'Timestamp when embedding was generated';
COMMENT ON COLUMN batch_prospect_items.embedding_model IS 'Model used to generate the embedding';
COMMENT ON FUNCTION search_batch_reports IS 'Semantic search for batch prospect reports using vector similarity';
