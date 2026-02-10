-- ============================================================================
-- BATCH PROSPECT PROCESSING TABLES
-- Migration: 009_add_batch_processing.sql
-- Description: Tables for batch processing of prospect research reports
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- BATCH JOBS TABLE
-- Tracks the overall batch processing job
-- ============================================================================
CREATE TABLE IF NOT EXISTS batch_prospect_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Job metadata
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'paused', 'completed', 'failed', 'cancelled')),

  -- Progress tracking
  total_prospects INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,

  -- Source file info
  source_file_name TEXT,
  source_file_url TEXT,
  source_file_size INTEGER,

  -- Column mapping (stores how CSV columns map to prospect fields)
  column_mapping JSONB,

  -- Processing settings
  settings JSONB DEFAULT '{
    "delay_between_prospects_ms": 3000,
    "enable_web_search": true,
    "max_retries": 2,
    "generate_romy_score": true
  }'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Error tracking
  error_message TEXT,
  last_error_at TIMESTAMPTZ
);

-- ============================================================================
-- BATCH ITEMS TABLE
-- Individual prospect items within a batch job
-- ============================================================================
CREATE TABLE IF NOT EXISTS batch_prospect_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES batch_prospect_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Item position and status
  item_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),

  -- Input data from CSV (flexible JSONB for any columns)
  input_data JSONB NOT NULL,

  -- Parsed/normalized input fields (extracted from input_data for querying)
  prospect_name TEXT,
  prospect_address TEXT,
  prospect_city TEXT,
  prospect_state TEXT,
  prospect_zip TEXT,

  -- Output: Generated report
  report_content TEXT,
  report_format TEXT DEFAULT 'markdown',

  -- Extracted metrics from report
  romy_score INTEGER,
  romy_score_tier TEXT,
  capacity_rating TEXT,
  estimated_net_worth NUMERIC,
  estimated_gift_capacity NUMERIC,
  recommended_ask NUMERIC,

  -- Web search results used
  search_queries_used JSONB,
  sources_found JSONB,

  -- Processing metadata
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_duration_ms INTEGER,
  tokens_used INTEGER,
  model_used TEXT,

  -- Error handling
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Batch jobs indexes
CREATE INDEX IF NOT EXISTS idx_batch_jobs_user_id ON batch_prospect_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_prospect_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_created_at ON batch_prospect_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_user_status ON batch_prospect_jobs(user_id, status);

-- Batch items indexes
CREATE INDEX IF NOT EXISTS idx_batch_items_job_id ON batch_prospect_items(job_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_status ON batch_prospect_items(status);
CREATE INDEX IF NOT EXISTS idx_batch_items_job_status ON batch_prospect_items(job_id, status);
CREATE INDEX IF NOT EXISTS idx_batch_items_job_index ON batch_prospect_items(job_id, item_index);
CREATE INDEX IF NOT EXISTS idx_batch_items_user_id ON batch_prospect_items(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE batch_prospect_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_prospect_items ENABLE ROW LEVEL SECURITY;

-- Batch jobs policies
CREATE POLICY "Users can view own batch jobs"
  ON batch_prospect_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own batch jobs"
  ON batch_prospect_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own batch jobs"
  ON batch_prospect_jobs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own batch jobs"
  ON batch_prospect_jobs FOR DELETE
  USING (auth.uid() = user_id);

-- Batch items policies
CREATE POLICY "Users can view own batch items"
  ON batch_prospect_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own batch items"
  ON batch_prospect_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own batch items"
  ON batch_prospect_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own batch items"
  ON batch_prospect_items FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update job progress counts
CREATE OR REPLACE FUNCTION update_batch_job_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the job's counts
  UPDATE batch_prospect_jobs
  SET
    completed_count = (
      SELECT COUNT(*) FROM batch_prospect_items
      WHERE job_id = COALESCE(NEW.job_id, OLD.job_id) AND status = 'completed'
    ),
    failed_count = (
      SELECT COUNT(*) FROM batch_prospect_items
      WHERE job_id = COALESCE(NEW.job_id, OLD.job_id) AND status = 'failed'
    ),
    skipped_count = (
      SELECT COUNT(*) FROM batch_prospect_items
      WHERE job_id = COALESCE(NEW.job_id, OLD.job_id) AND status = 'skipped'
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.job_id, OLD.job_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update job counts when items change
DROP TRIGGER IF EXISTS trigger_update_batch_job_counts ON batch_prospect_items;
CREATE TRIGGER trigger_update_batch_job_counts
  AFTER INSERT OR UPDATE OF status OR DELETE ON batch_prospect_items
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_job_counts();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_batch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_batch_jobs_updated_at ON batch_prospect_jobs;
CREATE TRIGGER trigger_batch_jobs_updated_at
  BEFORE UPDATE ON batch_prospect_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_updated_at();

DROP TRIGGER IF EXISTS trigger_batch_items_updated_at ON batch_prospect_items;
CREATE TRIGGER trigger_batch_items_updated_at
  BEFORE UPDATE ON batch_prospect_items
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE batch_prospect_jobs IS 'Batch prospect research jobs - tracks overall progress of bulk prospect processing';
COMMENT ON TABLE batch_prospect_items IS 'Individual prospects within a batch job - stores input data and generated reports';
COMMENT ON COLUMN batch_prospect_items.input_data IS 'Raw CSV row data as JSONB - flexible schema for any columns';
COMMENT ON COLUMN batch_prospect_items.report_content IS 'Generated prospect research report in markdown format';
COMMENT ON COLUMN batch_prospect_items.romy_score IS 'Extracted RomyScore (0-41) from the generated report';
