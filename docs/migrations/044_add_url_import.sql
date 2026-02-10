-- Migration 044: Add URL import support for RAG documents
-- Adds source_url and crawl_job_id columns for web-crawled documents

ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS crawl_job_id UUID;

-- Unique constraint: prevent duplicate page URLs per user (also serves as dedup index)
-- Each crawled page has a unique source_url. Two concurrent imports of the same site
-- will fail at insert time if they try to create the same page URL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_documents_source_url
  ON rag_documents(user_id, source_url) WHERE source_url IS NOT NULL;

-- Index for grouping pages from the same crawl job
CREATE INDEX IF NOT EXISTS idx_rag_documents_crawl_job_id
  ON rag_documents(crawl_job_id) WHERE crawl_job_id IS NOT NULL;
