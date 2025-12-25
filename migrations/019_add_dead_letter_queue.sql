-- Migration: 019_add_dead_letter_queue.sql
-- Description: Add dead letter queue for failed batch processing items
-- Created: 2025-01-15

-- ============================================================================
-- DEAD LETTER QUEUE TABLE
-- ============================================================================
-- Captures permanently failed batch items for manual review and debugging.

CREATE TABLE IF NOT EXISTS batch_dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to the failed batch item
  item_id UUID NOT NULL REFERENCES batch_prospect_items(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES batch_prospect_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Failure information
  failure_reason TEXT NOT NULL,
  failure_count INTEGER DEFAULT 1,
  last_error JSONB NOT NULL,
  -- last_error structure: { message, stack?, step?, timestamp }

  -- Context for debugging
  prospect_data JSONB,
  checkpoints JSONB DEFAULT '[]'::JSONB,

  -- Resolution tracking
  resolution TEXT NOT NULL DEFAULT 'pending'
    CHECK (resolution IN ('pending', 'retried', 'skipped', 'manual_fix')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for finding DLQ items by user
CREATE INDEX IF NOT EXISTS idx_dlq_user
  ON batch_dead_letter_queue(user_id);

-- Index for finding DLQ items by job
CREATE INDEX IF NOT EXISTS idx_dlq_job
  ON batch_dead_letter_queue(job_id);

-- Index for finding pending items
CREATE INDEX IF NOT EXISTS idx_dlq_pending
  ON batch_dead_letter_queue(resolution, created_at)
  WHERE resolution = 'pending';

-- Index for finding items by batch item
CREATE INDEX IF NOT EXISTS idx_dlq_item
  ON batch_dead_letter_queue(item_id);

-- Index for cleanup of resolved items
CREATE INDEX IF NOT EXISTS idx_dlq_resolved
  ON batch_dead_letter_queue(resolved_at)
  WHERE resolution != 'pending';

-- ============================================================================
-- TRIGGER FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_dlq_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_dlq_updated_at ON batch_dead_letter_queue;
CREATE TRIGGER trigger_dlq_updated_at
  BEFORE UPDATE ON batch_dead_letter_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_dlq_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE batch_dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- Users can view their own DLQ items
CREATE POLICY "Users can view own DLQ items" ON batch_dead_letter_queue
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own DLQ items (for resolution)
CREATE POLICY "Users can update own DLQ items" ON batch_dead_letter_queue
  FOR UPDATE
  USING (user_id = auth.uid());

-- Service role has full access
CREATE POLICY "Service role full access" ON batch_dead_letter_queue
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get DLQ statistics for a user
CREATE OR REPLACE FUNCTION get_dlq_stats(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  total BIGINT,
  pending BIGINT,
  retried BIGINT,
  skipped BIGINT,
  manual_fix BIGINT,
  oldest_pending TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total,
    COUNT(*) FILTER (WHERE resolution = 'pending')::BIGINT AS pending,
    COUNT(*) FILTER (WHERE resolution = 'retried')::BIGINT AS retried,
    COUNT(*) FILTER (WHERE resolution = 'skipped')::BIGINT AS skipped,
    COUNT(*) FILTER (WHERE resolution = 'manual_fix')::BIGINT AS manual_fix,
    MIN(created_at) FILTER (WHERE resolution = 'pending') AS oldest_pending
  FROM batch_dead_letter_queue
  WHERE p_user_id IS NULL OR user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get common errors in DLQ
CREATE OR REPLACE FUNCTION get_dlq_common_errors(
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  error_message TEXT,
  occurrence_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    LEFT(failure_reason, 200) AS error_message,
    COUNT(*) AS occurrence_count
  FROM batch_dead_letter_queue
  WHERE (p_user_id IS NULL OR user_id = p_user_id)
    AND resolution = 'pending'
  GROUP BY LEFT(failure_reason, 200)
  ORDER BY occurrence_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up old resolved DLQ items
CREATE OR REPLACE FUNCTION cleanup_resolved_dlq(p_days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM batch_dead_letter_queue
    WHERE resolution != 'pending'
      AND resolved_at < NOW() - (p_days_old || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM deleted;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE batch_dead_letter_queue IS
  'Captures permanently failed batch items for manual review and retry';

COMMENT ON COLUMN batch_dead_letter_queue.failure_reason IS
  'Human-readable reason for failure';

COMMENT ON COLUMN batch_dead_letter_queue.last_error IS
  'Full error details including stack trace for debugging';

COMMENT ON COLUMN batch_dead_letter_queue.checkpoints IS
  'Checkpoint state at time of failure - shows what completed before failure';

COMMENT ON COLUMN batch_dead_letter_queue.resolution IS
  'pending = awaiting review, retried = sent back for retry, skipped = ignored, manual_fix = manually resolved';
