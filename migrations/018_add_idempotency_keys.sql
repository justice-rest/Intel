-- Migration: 018_add_idempotency_keys.sql
-- Description: Add idempotency key tracking for batch processing
-- Created: 2025-01-15

-- ============================================================================
-- IDEMPOTENCY KEYS TABLE
-- ============================================================================
-- Tracks processing state to prevent double-processing of batch items.
-- Uses optimistic locking pattern - first to insert wins.

CREATE TABLE IF NOT EXISTS batch_processing_idempotency (
  -- Primary key is the idempotency key itself (SHA256 hash)
  idempotency_key TEXT PRIMARY KEY,

  -- Reference to the batch item being processed
  item_id UUID NOT NULL,

  -- Step being processed
  step_name TEXT NOT NULL,

  -- Processing status
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed')),

  -- Result of completed processing (stored as JSONB)
  result JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('processing', 'completed'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for finding records by item_id (for debugging/admin)
CREATE INDEX IF NOT EXISTS idx_idempotency_item
  ON batch_processing_idempotency(item_id);

-- Index for cleanup of expired records
CREATE INDEX IF NOT EXISTS idx_idempotency_expires
  ON batch_processing_idempotency(expires_at);

-- Index for finding processing records (stale detection)
CREATE INDEX IF NOT EXISTS idx_idempotency_status_created
  ON batch_processing_idempotency(status, created_at)
  WHERE status = 'processing';

-- ============================================================================
-- CLEANUP FUNCTION
-- ============================================================================

-- Function to clean up expired idempotency records
-- Should be run periodically (e.g., via cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM batch_processing_idempotency
    WHERE expires_at < NOW()
    RETURNING idempotency_key
  )
  SELECT COUNT(*) INTO v_count FROM deleted;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release stale processing locks
-- Processing that hasn't completed within threshold is considered stale
CREATE OR REPLACE FUNCTION release_stale_idempotency_locks(p_threshold_minutes INTEGER DEFAULT 5)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH stale AS (
    DELETE FROM batch_processing_idempotency
    WHERE status = 'processing'
      AND created_at < NOW() - (p_threshold_minutes || ' minutes')::INTERVAL
    RETURNING idempotency_key
  )
  SELECT COUNT(*) INTO v_count FROM stale;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE batch_processing_idempotency ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for background processing)
CREATE POLICY "Service role full access" ON batch_processing_idempotency
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can view their own idempotency records (via item_id join)
CREATE POLICY "Users can view own idempotency records" ON batch_processing_idempotency
  FOR SELECT
  USING (
    item_id IN (
      SELECT id FROM batch_prospect_items WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE batch_processing_idempotency IS
  'Tracks idempotency keys for batch processing to prevent double-processing';

COMMENT ON COLUMN batch_processing_idempotency.idempotency_key IS
  'SHA256 hash of (item_id, step_name, input_hash) - ensures unique processing';

COMMENT ON COLUMN batch_processing_idempotency.status IS
  'processing = currently being worked on, completed = finished with result cached';

COMMENT ON COLUMN batch_processing_idempotency.result IS
  'Cached result of completed processing (null while processing)';

COMMENT ON COLUMN batch_processing_idempotency.expires_at IS
  'When this record expires - processing locks expire quickly, completed results last 24h';
