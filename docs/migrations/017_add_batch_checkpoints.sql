-- Migration: 017_add_batch_checkpoints.sql
-- Description: Add checkpoint system for batch processing resume capability
-- Created: 2025-01-15

-- ============================================================================
-- BATCH PROSPECT CHECKPOINTS TABLE
-- ============================================================================
-- Stores per-step results for each batch item, enabling:
-- - Resume from last completed step after interruption
-- - Skip already-completed steps on retry
-- - Debugging of failed steps
-- - Progress tracking per step

CREATE TABLE IF NOT EXISTS batch_prospect_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to the batch item being processed
  item_id UUID NOT NULL REFERENCES batch_prospect_items(id) ON DELETE CASCADE,

  -- Step identification
  step_name TEXT NOT NULL,

  -- Status: pending, processing, completed, failed, skipped
  step_status TEXT NOT NULL DEFAULT 'pending',

  -- Result data (stored as JSONB for flexibility)
  result_data JSONB,

  -- Metadata
  tokens_used INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique step per item
  UNIQUE(item_id, step_name)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for quick lookup by item_id (most common query)
CREATE INDEX IF NOT EXISTS idx_batch_checkpoints_item
  ON batch_prospect_checkpoints(item_id);

-- Index for finding stale processing items
CREATE INDEX IF NOT EXISTS idx_batch_checkpoints_status
  ON batch_prospect_checkpoints(step_status)
  WHERE step_status = 'processing';

-- Index for finding stale processing items by time
CREATE INDEX IF NOT EXISTS idx_batch_checkpoints_stale
  ON batch_prospect_checkpoints(updated_at)
  WHERE step_status = 'processing';

-- Composite index for step lookup
CREATE INDEX IF NOT EXISTS idx_batch_checkpoints_item_step
  ON batch_prospect_checkpoints(item_id, step_name);

-- ============================================================================
-- TRIGGER FOR updated_at
-- ============================================================================

-- Update updated_at timestamp on any change
CREATE OR REPLACE FUNCTION update_checkpoint_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_checkpoint_updated_at ON batch_prospect_checkpoints;
CREATE TRIGGER trigger_checkpoint_updated_at
  BEFORE UPDATE ON batch_prospect_checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_checkpoint_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE batch_prospect_checkpoints ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access checkpoints for their own batch items
-- We join through batch_prospect_items to get user_id
CREATE POLICY "Users can view own checkpoints" ON batch_prospect_checkpoints
  FOR SELECT
  USING (
    item_id IN (
      SELECT id FROM batch_prospect_items WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own checkpoints" ON batch_prospect_checkpoints
  FOR INSERT
  WITH CHECK (
    item_id IN (
      SELECT id FROM batch_prospect_items WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own checkpoints" ON batch_prospect_checkpoints
  FOR UPDATE
  USING (
    item_id IN (
      SELECT id FROM batch_prospect_items WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own checkpoints" ON batch_prospect_checkpoints
  FOR DELETE
  USING (
    item_id IN (
      SELECT id FROM batch_prospect_items WHERE user_id = auth.uid()
    )
  );

-- Service role can do anything (for background processing)
CREATE POLICY "Service role full access" ON batch_prospect_checkpoints
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get completion status for an item
CREATE OR REPLACE FUNCTION get_checkpoint_status(p_item_id UUID)
RETURNS TABLE (
  total_steps INTEGER,
  completed_steps INTEGER,
  failed_steps INTEGER,
  skipped_steps INTEGER,
  pending_steps INTEGER,
  processing_steps INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_steps,
    COUNT(*) FILTER (WHERE step_status = 'completed')::INTEGER AS completed_steps,
    COUNT(*) FILTER (WHERE step_status = 'failed')::INTEGER AS failed_steps,
    COUNT(*) FILTER (WHERE step_status = 'skipped')::INTEGER AS skipped_steps,
    COUNT(*) FILTER (WHERE step_status = 'pending')::INTEGER AS pending_steps,
    COUNT(*) FILTER (WHERE step_status = 'processing')::INTEGER AS processing_steps
  FROM batch_prospect_checkpoints
  WHERE item_id = p_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up stale processing checkpoints
CREATE OR REPLACE FUNCTION cleanup_stale_checkpoints(p_threshold_minutes INTEGER DEFAULT 10)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH stale AS (
    UPDATE batch_prospect_checkpoints
    SET step_status = 'pending',
        error_message = 'Reset due to stale processing state',
        updated_at = NOW()
    WHERE step_status = 'processing'
      AND updated_at < NOW() - (p_threshold_minutes || ' minutes')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM stale;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get total tokens used for an item
CREATE OR REPLACE FUNCTION get_item_tokens_used(p_item_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(tokens_used) FROM batch_prospect_checkpoints WHERE item_id = p_item_id),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE batch_prospect_checkpoints IS
  'Stores per-step checkpoints for batch processing items, enabling resume capability and step-level result caching';

COMMENT ON COLUMN batch_prospect_checkpoints.step_name IS
  'Name of the processing step (e.g., perplexity_pass1, linkup_search, validation)';

COMMENT ON COLUMN batch_prospect_checkpoints.step_status IS
  'Current status: pending, processing, completed, failed, skipped';

COMMENT ON COLUMN batch_prospect_checkpoints.result_data IS
  'JSONB storage of step result data (for completed steps) or reason (for skipped steps)';

COMMENT ON COLUMN batch_prospect_checkpoints.tokens_used IS
  'Number of LLM tokens used by this step';

COMMENT ON COLUMN batch_prospect_checkpoints.duration_ms IS
  'Execution time in milliseconds';
