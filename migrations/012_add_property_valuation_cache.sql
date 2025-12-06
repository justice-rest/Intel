-- Property valuation cache table for consistent AVM results
-- Stores valuation results in Supabase for production-ready caching

CREATE TABLE IF NOT EXISTS property_valuation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cache key: normalized address
  address_key TEXT NOT NULL UNIQUE,
  original_address TEXT NOT NULL,

  -- Cached result (full AVMResult as JSONB)
  result JSONB NOT NULL,

  -- Key values extracted for querying/analytics
  estimated_value DECIMAL(14, 2),
  value_low DECIMAL(14, 2),
  value_high DECIMAL(14, 2),
  confidence_score INTEGER,
  confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),

  -- Data quality metrics
  hedonic_weight DECIMAL(5, 4),
  comp_weight DECIMAL(5, 4),
  online_weight DECIMAL(5, 4),
  comparables_used INTEGER DEFAULT 0,
  estimate_sources TEXT[] DEFAULT '{}',

  -- Cache metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Search metadata
  searches_run INTEGER DEFAULT 0,
  searches_failed INTEGER DEFAULT 0
);

-- Index for fast cache lookups
CREATE INDEX idx_valuation_cache_address ON property_valuation_cache(address_key);

-- Index for cache expiry cleanup
CREATE INDEX idx_valuation_cache_expires ON property_valuation_cache(expires_at);

-- Index for analytics (most valued properties)
CREATE INDEX idx_valuation_cache_value ON property_valuation_cache(estimated_value DESC);

-- Function to clean up expired cache entries (run periodically via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_valuation_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM property_valuation_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- RLS policies (no auth required for cache - it's anonymous data)
ALTER TABLE property_valuation_cache ENABLE ROW LEVEL SECURITY;

-- Allow all operations on cache table (property data is public)
CREATE POLICY "Allow cache read" ON property_valuation_cache
  FOR SELECT USING (true);

CREATE POLICY "Allow cache insert" ON property_valuation_cache
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow cache update" ON property_valuation_cache
  FOR UPDATE USING (true);

CREATE POLICY "Allow cache delete" ON property_valuation_cache
  FOR DELETE USING (true);

-- Comment on table
COMMENT ON TABLE property_valuation_cache IS 'Caches property valuation results for 24 hours to ensure consistent results across serverless function instances';
