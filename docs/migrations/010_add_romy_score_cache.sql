-- ============================================================================
-- Migration: Add RomyScore Cache Table
-- Purpose: Store calculated prospect scores for consistency across searches
-- ============================================================================

-- Create the romy_score_cache table
CREATE TABLE IF NOT EXISTS romy_score_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cache_key TEXT NOT NULL UNIQUE,           -- Normalized person identifier
    person_name TEXT NOT NULL,                -- Original person name
    data_points JSONB NOT NULL DEFAULT '{}',  -- Raw data points used for scoring
    score INTEGER NOT NULL DEFAULT 0,         -- Calculated score (0-41)
    tier TEXT NOT NULL,                       -- Score tier name
    capacity TEXT NOT NULL,                   -- Capacity rating (MAJOR/PRINCIPAL/LEADERSHIP/ANNUAL)
    breakdown JSONB NOT NULL DEFAULT '{}',    -- Full score breakdown
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create index on cache_key for fast lookups
CREATE INDEX IF NOT EXISTS idx_romy_score_cache_key ON romy_score_cache(cache_key);

-- Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_romy_score_expires_at ON romy_score_cache(expires_at);

-- Create index on score for ranking queries
CREATE INDEX IF NOT EXISTS idx_romy_score_score ON romy_score_cache(score DESC);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_romy_score_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS romy_score_cache_updated_at ON romy_score_cache;
CREATE TRIGGER romy_score_cache_updated_at
    BEFORE UPDATE ON romy_score_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_romy_score_cache_updated_at();

-- RLS Policies (no user restriction - scores are shared/public within org)
ALTER TABLE romy_score_cache ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write cache
CREATE POLICY "Allow authenticated users to read romy_score_cache"
    ON romy_score_cache FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert romy_score_cache"
    ON romy_score_cache FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update romy_score_cache"
    ON romy_score_cache FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to romy_score_cache"
    ON romy_score_cache FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- Cleanup function for expired cache entries
-- Run periodically via cron or scheduled function
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_romy_scores()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM romy_score_cache
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE romy_score_cache IS 'Cached RomyScores for consistent prospect research scores';
COMMENT ON COLUMN romy_score_cache.cache_key IS 'Normalized person identifier (name + location)';
COMMENT ON COLUMN romy_score_cache.data_points IS 'Raw data points used for scoring (property value, business roles, etc.)';
COMMENT ON COLUMN romy_score_cache.breakdown IS 'Full score breakdown with component scores';
COMMENT ON COLUMN romy_score_cache.expires_at IS 'Cache expiration (default 7 days from creation)';
