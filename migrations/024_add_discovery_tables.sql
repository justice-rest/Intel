-- ============================================================================
-- Discovery Tables Migration
-- Adds tables for FindAll prospect discovery feature
-- ============================================================================

-- ============================================================================
-- DISCOVERY JOBS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS discovery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Job metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled')),

  -- Discovery criteria
  objective TEXT NOT NULL,
  match_conditions JSONB NOT NULL DEFAULT '[]',
  location VARCHAR(255),
  exclude_names JSONB DEFAULT '[]',

  -- Settings
  settings JSONB NOT NULL DEFAULT '{"match_limit": 10, "generator": "pro", "entity_type": "philanthropist"}',

  -- Progress tracking
  total_candidates INTEGER NOT NULL DEFAULT 0,
  matched_count INTEGER NOT NULL DEFAULT 0,
  unmatched_count INTEGER NOT NULL DEFAULT 0,
  discarded_count INTEGER NOT NULL DEFAULT 0,

  -- Parallel AI reference
  findall_id VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Error tracking
  error_message TEXT,
  last_error_at TIMESTAMP WITH TIME ZONE,

  -- Cost tracking
  estimated_cost_usd DECIMAL(10, 4)
);

-- ============================================================================
-- DISCOVERY CANDIDATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS discovery_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES discovery_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Candidate info from FindAll
  candidate_id VARCHAR(255) NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  url TEXT NOT NULL,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'matched', 'unmatched', 'discarded')),

  -- Match results (JSON from FindAll)
  match_results JSONB,

  -- Sources/citations
  sources JSONB NOT NULL DEFAULT '[]',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Discovery jobs indexes
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_user_id ON discovery_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_status ON discovery_jobs(status);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_user_status ON discovery_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_created_at ON discovery_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_started_at ON discovery_jobs(started_at);
-- Composite index for rate limiting query: WHERE user_id = ? AND started_at >= ? AND status IN (...)
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_rate_limit ON discovery_jobs(user_id, started_at, status);

-- Discovery candidates indexes
CREATE INDEX IF NOT EXISTS idx_discovery_candidates_job_id ON discovery_candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_discovery_candidates_user_id ON discovery_candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_discovery_candidates_status ON discovery_candidates(status);
CREATE INDEX IF NOT EXISTS idx_discovery_candidates_job_status ON discovery_candidates(job_id, status);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

-- Prevent duplicate candidates per job (idempotency protection)
ALTER TABLE discovery_candidates
  ADD CONSTRAINT uq_discovery_candidates_job_candidate
  UNIQUE (job_id, candidate_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE discovery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_candidates ENABLE ROW LEVEL SECURITY;

-- Discovery jobs policies
CREATE POLICY "Users can view their own discovery jobs"
  ON discovery_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own discovery jobs"
  ON discovery_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own discovery jobs"
  ON discovery_jobs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own discovery jobs"
  ON discovery_jobs FOR DELETE
  USING (auth.uid() = user_id);

-- Discovery candidates policies
CREATE POLICY "Users can view their own discovery candidates"
  ON discovery_candidates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own discovery candidates"
  ON discovery_candidates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own discovery candidates"
  ON discovery_candidates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own discovery candidates"
  ON discovery_candidates FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

-- Trigger function (reuse existing if available)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS set_discovery_jobs_updated_at ON discovery_jobs;
CREATE TRIGGER set_discovery_jobs_updated_at
  BEFORE UPDATE ON discovery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_discovery_candidates_updated_at ON discovery_candidates;
CREATE TRIGGER set_discovery_candidates_updated_at
  BEFORE UPDATE ON discovery_candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE discovery_jobs IS 'Stores FindAll prospect discovery job configurations and results';
COMMENT ON TABLE discovery_candidates IS 'Stores candidates found by FindAll discovery runs';
COMMENT ON COLUMN discovery_jobs.match_conditions IS 'Array of {name, description} conditions that candidates must satisfy';
COMMENT ON COLUMN discovery_jobs.settings IS 'Job settings: match_limit, generator, entity_type';
COMMENT ON COLUMN discovery_candidates.match_results IS 'Match evaluation results from FindAll API';
COMMENT ON COLUMN discovery_candidates.sources IS 'Array of source citations with url, title, excerpts, reasoning';
