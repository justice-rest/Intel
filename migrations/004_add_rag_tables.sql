-- ============================================================================
-- RAG (Retrieval-Augmented Generation) TABLES
-- ============================================================================
-- Migration: 004
-- Description: Add tables for RAG document management with vector embeddings
-- Author: Claude Code
-- Date: 2025-01-22
-- ============================================================================

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- RAG DOCUMENTS TABLE
-- ============================================================================
-- Stores uploaded documents for RAG retrieval (PDFs)

CREATE TABLE IF NOT EXISTS rag_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- File metadata
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT DEFAULT 'application/pdf',

  -- Document metadata
  page_count INTEGER,
  word_count INTEGER,
  language TEXT DEFAULT 'en',

  -- Tags for organization (array of strings)
  tags TEXT[] DEFAULT '{}',

  -- Processing status
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Foreign key constraint (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rag_documents_user_id_fkey'
  ) THEN
    ALTER TABLE rag_documents
      ADD CONSTRAINT rag_documents_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rag_documents_user_id ON rag_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_status ON rag_documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_rag_documents_created_at ON rag_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_documents_tags ON rag_documents USING GIN(tags);

-- Full-text search index for document names
CREATE INDEX IF NOT EXISTS idx_rag_documents_file_name_search ON rag_documents USING gin(to_tsvector('english', file_name));

-- ============================================================================
-- RAG DOCUMENT CHUNKS TABLE
-- ============================================================================
-- Stores chunked text with embeddings for semantic search

CREATE TABLE IF NOT EXISTS rag_document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Chunk data
  chunk_index INTEGER NOT NULL, -- Position in document (0-based)
  content TEXT NOT NULL,
  page_number INTEGER, -- Original page number in PDF (1-based)

  -- Embedding vector
  -- Using 1536 dimensions (truncated from Gemini's 3072)
  -- Gemini embeddings support Matryoshka truncation to 768/1536/3072
  -- We use 1536 to stay under pgvector's 2000 dimension index limit
  -- while maintaining excellent quality (minimal loss from 3072)
  embedding vector(1536),

  -- Metadata
  token_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign key constraints (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rag_document_chunks_document_id_fkey'
  ) THEN
    ALTER TABLE rag_document_chunks
      ADD CONSTRAINT rag_document_chunks_document_id_fkey
      FOREIGN KEY (document_id) REFERENCES rag_documents(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rag_document_chunks_user_id_fkey'
  ) THEN
    ALTER TABLE rag_document_chunks
      ADD CONSTRAINT rag_document_chunks_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id ON rag_document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_user_id ON rag_document_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_page_number ON rag_document_chunks(document_id, page_number);

-- CRITICAL: Vector similarity search index using HNSW
-- Using 1536 dimensions (truncated from Gemini's 3072 using Matryoshka property)
-- HNSW provides O(log n) search performance, faster than IVFFlat
-- m=16: number of bi-directional links per node (higher = more accurate but slower build)
-- ef_construction=64: size of dynamic candidate list during index construction
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding ON rag_document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- RLS (ROW LEVEL SECURITY) POLICIES FOR RAG TABLES
-- ============================================================================

ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_document_chunks ENABLE ROW LEVEL SECURITY;

-- Documents policies
CREATE POLICY "Users can view their own RAG documents"
  ON rag_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own RAG documents"
  ON rag_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own RAG documents"
  ON rag_documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own RAG documents"
  ON rag_documents FOR DELETE
  USING (auth.uid() = user_id);

-- Chunks policies
CREATE POLICY "Users can view their own RAG chunks"
  ON rag_document_chunks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own RAG chunks"
  ON rag_document_chunks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own RAG chunks"
  ON rag_document_chunks FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- VECTOR SIMILARITY SEARCH FUNCTION
-- ============================================================================
-- Searches for similar chunks using cosine similarity
-- Returns chunks with similarity scores, sorted by relevance

CREATE OR REPLACE FUNCTION search_rag_chunks(
  query_embedding vector(1536),
  match_user_id UUID,
  match_count INT DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.5,
  filter_document_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  document_name TEXT,
  content TEXT,
  page_number INTEGER,
  chunk_index INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    d.file_name as document_name,
    c.content,
    c.page_number,
    c.chunk_index,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM rag_document_chunks c
  JOIN rag_documents d ON c.document_id = d.id
  WHERE c.user_id = match_user_id
    AND d.status = 'ready'
    AND (filter_document_ids IS NULL OR c.document_id = ANY(filter_document_ids))
    AND 1 - (c.embedding <=> query_embedding) > similarity_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- HELPER FUNCTION: Get RAG storage usage by user
-- ============================================================================

CREATE OR REPLACE FUNCTION get_rag_storage_usage(
  user_id_param UUID
)
RETURNS TABLE (
  document_count BIGINT,
  total_bytes BIGINT,
  chunk_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT d.id) as document_count,
    COALESCE(SUM(d.file_size), 0) as total_bytes,
    COUNT(c.id) as chunk_count
  FROM rag_documents d
  LEFT JOIN rag_document_chunks c ON d.id = c.document_id
  WHERE d.user_id = user_id_param
    AND d.status != 'failed';
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE rag_documents IS 'Stores user-uploaded documents for RAG retrieval (Ultra plan only)';
COMMENT ON TABLE rag_document_chunks IS 'Stores document chunks with vector embeddings for semantic search';
COMMENT ON FUNCTION search_rag_chunks IS 'Performs vector similarity search to find relevant document chunks';
COMMENT ON FUNCTION get_rag_storage_usage IS 'Returns document count, storage size, and chunk count for a user';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
