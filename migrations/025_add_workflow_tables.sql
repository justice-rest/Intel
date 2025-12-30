-- ============================================================================
-- Migration: 025_add_workflow_tables.sql
-- Description: Add tables for Workflow DevKit durable workflow state persistence
-- Date: 2025-12-30
-- ============================================================================

-- ============================================================================
-- WORKFLOW RUNS TABLE
-- Stores metadata about each workflow execution
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE workflow_runs IS 'Stores workflow execution metadata for Workflow DevKit';
COMMENT ON COLUMN workflow_runs.workflow_name IS 'Name of the workflow function (e.g., syncCRMData)';
COMMENT ON COLUMN workflow_runs.status IS 'Current execution status: pending, running, completed, failed, cancelled';
COMMENT ON COLUMN workflow_runs.input IS 'Serialized input parameters passed to the workflow';
COMMENT ON COLUMN workflow_runs.output IS 'Serialized output returned by the workflow on success';
COMMENT ON COLUMN workflow_runs.error IS 'Error message if workflow failed';

-- ============================================================================
-- WORKFLOW STEPS TABLE
-- Stores individual step execution within a workflow
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'retrying')),
  step_index INT NOT NULL DEFAULT 0,
  input JSONB,
  output JSONB,
  error TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE workflow_steps IS 'Stores individual step execution state within workflows';
COMMENT ON COLUMN workflow_steps.step_name IS 'Name of the step (e.g., fetchConstituents, upsertDonations)';
COMMENT ON COLUMN workflow_steps.step_index IS 'Order of the step within the workflow';
COMMENT ON COLUMN workflow_steps.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN workflow_steps.max_retries IS 'Maximum allowed retries before failure';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Workflow runs indexes
CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_id
  ON workflow_runs(user_id);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_status
  ON workflow_runs(status);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_name
  ON workflow_runs(workflow_name);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_created_at
  ON workflow_runs(created_at DESC);

-- Composite index for querying user's recent workflows
CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_status_created
  ON workflow_runs(user_id, status, created_at DESC);

-- Workflow steps indexes
CREATE INDEX IF NOT EXISTS idx_workflow_steps_run_id
  ON workflow_steps(run_id);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_status
  ON workflow_steps(status);

-- Composite index for querying steps of a run in order
CREATE INDEX IF NOT EXISTS idx_workflow_steps_run_order
  ON workflow_steps(run_id, step_index);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;

-- Workflow runs policies
-- Users can view their own workflow runs
CREATE POLICY "Users can view own workflow runs"
  ON workflow_runs FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role can manage workflow runs"
  ON workflow_runs FOR ALL
  USING (auth.role() = 'service_role');

-- Workflow steps policies
-- Users can view steps of their own workflow runs
CREATE POLICY "Users can view own workflow steps"
  ON workflow_steps FOR SELECT
  USING (
    run_id IN (
      SELECT id FROM workflow_runs WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role can manage workflow steps"
  ON workflow_steps FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for workflow_runs
CREATE TRIGGER update_workflow_runs_updated_at
  BEFORE UPDATE ON workflow_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_updated_at();

-- Trigger for workflow_steps
CREATE TRIGGER update_workflow_steps_updated_at
  BEFORE UPDATE ON workflow_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_updated_at();

-- ============================================================================
-- CLEANUP FUNCTION (optional - for maintenance)
-- ============================================================================

-- Function to clean up old completed/failed workflows
-- Call periodically via cron or scheduled task
CREATE OR REPLACE FUNCTION cleanup_old_workflow_runs(days_old INT DEFAULT 30)
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  WITH deleted AS (
    DELETE FROM workflow_runs
    WHERE
      completed_at < NOW() - (days_old || ' days')::INTERVAL
      AND status IN ('completed', 'failed', 'cancelled')
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role only
REVOKE ALL ON FUNCTION cleanup_old_workflow_runs FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_old_workflow_runs TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify tables were created
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_runs') THEN
    RAISE EXCEPTION 'workflow_runs table was not created';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_steps') THEN
    RAISE EXCEPTION 'workflow_steps table was not created';
  END IF;

  RAISE NOTICE 'Workflow tables created successfully';
END $$;
