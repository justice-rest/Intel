-- ============================================================================
-- Migration: Add Prospect Data Cache Table
-- Purpose: Cache all tool results for prospect research consistency
-- Ensures same prospect searched twice produces identical core data
-- ============================================================================

-- Create the prospect_data_cache table
CREATE TABLE IF NOT EXISTS prospect_data_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cache_key TEXT NOT NULL UNIQUE,              -- SHA256(name + address + city + state)

    -- Prospect identification
    prospect_name TEXT NOT NULL,
    prospect_address TEXT,
    prospect_city TEXT,
    prospect_state TEXT,

    -- Cached tool results (JSONB for flexibility)
    sec_insider_data JSONB,                      -- SEC Form 3/4/5 filings
    fec_data JSONB,                              -- FEC political contributions
    propublica_data JSONB,                       -- 990 nonprofit data
    property_data JSONB,                         -- Property valuation results
    county_assessor_data JSONB,                  -- Official county assessor records
    business_registry_data JSONB,               -- State business registrations
    voter_data JSONB,                            -- Voter registration (party, age)
    family_data JSONB,                           -- Family/household discovery
    wikidata_data JSONB,                         -- Wikidata biographical info
    linkup_data JSONB,                           -- Array of web search results
    revenue_estimate_data JSONB,                 -- Business revenue estimates

    -- Per-source timestamps for selective refresh
    sec_cached_at TIMESTAMPTZ,
    fec_cached_at TIMESTAMPTZ,
    propublica_cached_at TIMESTAMPTZ,
    property_cached_at TIMESTAMPTZ,
    county_assessor_cached_at TIMESTAMPTZ,
    business_registry_cached_at TIMESTAMPTZ,
    voter_cached_at TIMESTAMPTZ,
    family_cached_at TIMESTAMPTZ,
    wikidata_cached_at TIMESTAMPTZ,
    linkup_cached_at TIMESTAMPTZ,
    revenue_estimate_cached_at TIMESTAMPTZ,

    -- Computed/aggregated data
    romy_score INTEGER,
    romy_score_breakdown JSONB,
    net_worth_low BIGINT,                        -- Estimated net worth range (low)
    net_worth_high BIGINT,                       -- Estimated net worth range (high)
    net_worth_methodology TEXT,                  -- How net worth was calculated
    giving_capacity_low BIGINT,                  -- Estimated giving capacity range
    giving_capacity_high BIGINT,
    data_quality TEXT DEFAULT 'limited',         -- complete | partial | limited

    -- Source tracking for audit trail
    sources_used JSONB DEFAULT '[]',             -- Array of {name, url, confidence}

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- Full cache expiration (for cleanup)
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_prospect_cache_key ON prospect_data_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_prospect_cache_name ON prospect_data_cache(prospect_name);
CREATE INDEX IF NOT EXISTS idx_prospect_cache_state ON prospect_data_cache(prospect_state);
CREATE INDEX IF NOT EXISTS idx_prospect_cache_expires ON prospect_data_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_prospect_cache_created_by ON prospect_data_cache(created_by);
CREATE INDEX IF NOT EXISTS idx_prospect_cache_romy_score ON prospect_data_cache(romy_score DESC NULLS LAST);

-- GIN index for JSONB searching
CREATE INDEX IF NOT EXISTS idx_prospect_cache_sources ON prospect_data_cache USING GIN(sources_used);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_prospect_data_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prospect_data_cache_updated_at ON prospect_data_cache;
CREATE TRIGGER prospect_data_cache_updated_at
    BEFORE UPDATE ON prospect_data_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_prospect_data_cache_updated_at();

-- ============================================================================
-- Row Level Security Policies
-- ============================================================================

ALTER TABLE prospect_data_cache ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read cache (prospect data is shared within org)
CREATE POLICY "Allow authenticated users to read prospect_data_cache"
    ON prospect_data_cache FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert their own cache entries
CREATE POLICY "Allow authenticated users to insert prospect_data_cache"
    ON prospect_data_cache FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

-- Allow authenticated users to update any cache entry (collaborative research)
CREATE POLICY "Allow authenticated users to update prospect_data_cache"
    ON prospect_data_cache FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to prospect_data_cache"
    ON prospect_data_cache FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- Cache Expiration Helper Functions
-- ============================================================================

-- Get TTL for each data source type
CREATE OR REPLACE FUNCTION get_prospect_cache_ttl(source_type TEXT)
RETURNS INTERVAL AS $$
BEGIN
    RETURN CASE source_type
        -- Official records - longer TTL (30 days)
        WHEN 'sec_insider' THEN INTERVAL '30 days'
        WHEN 'fec' THEN INTERVAL '30 days'
        WHEN 'propublica' THEN INTERVAL '30 days'
        WHEN 'county_assessor' THEN INTERVAL '30 days'

        -- Business registrations - medium TTL (14 days)
        WHEN 'business_registry' THEN INTERVAL '14 days'

        -- Property valuations - shorter TTL (7 days)
        WHEN 'property' THEN INTERVAL '7 days'

        -- Voter data - medium TTL (14 days)
        WHEN 'voter' THEN INTERVAL '14 days'

        -- Biographical data - medium TTL (14 days)
        WHEN 'wikidata' THEN INTERVAL '14 days'
        WHEN 'family' THEN INTERVAL '14 days'

        -- Web search - short TTL (24 hours)
        WHEN 'linkup' THEN INTERVAL '24 hours'

        -- Revenue estimates - short TTL (7 days)
        WHEN 'revenue_estimate' THEN INTERVAL '7 days'

        ELSE INTERVAL '7 days'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check if a specific source is expired
CREATE OR REPLACE FUNCTION is_prospect_source_expired(
    cached_at TIMESTAMPTZ,
    source_type TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    IF cached_at IS NULL THEN
        RETURN TRUE;
    END IF;

    RETURN cached_at + get_prospect_cache_ttl(source_type) < NOW();
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Cleanup function for expired cache entries
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_prospect_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM prospect_data_cache
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Upsert function for cache entries
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_prospect_cache(
    p_cache_key TEXT,
    p_prospect_name TEXT,
    p_prospect_address TEXT DEFAULT NULL,
    p_prospect_city TEXT DEFAULT NULL,
    p_prospect_state TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    result_id UUID;
BEGIN
    INSERT INTO prospect_data_cache (
        cache_key,
        prospect_name,
        prospect_address,
        prospect_city,
        prospect_state,
        created_by,
        expires_at
    ) VALUES (
        p_cache_key,
        p_prospect_name,
        p_prospect_address,
        p_prospect_city,
        p_prospect_state,
        p_created_by,
        NOW() + INTERVAL '30 days'
    )
    ON CONFLICT (cache_key) DO UPDATE SET
        prospect_name = EXCLUDED.prospect_name,
        prospect_address = COALESCE(EXCLUDED.prospect_address, prospect_data_cache.prospect_address),
        prospect_city = COALESCE(EXCLUDED.prospect_city, prospect_data_cache.prospect_city),
        prospect_state = COALESCE(EXCLUDED.prospect_state, prospect_data_cache.prospect_state),
        updated_at = NOW(),
        expires_at = NOW() + INTERVAL '30 days'
    RETURNING id INTO result_id;

    RETURN result_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE prospect_data_cache IS 'Cached prospect research data for consistency across multiple searches';
COMMENT ON COLUMN prospect_data_cache.cache_key IS 'SHA256 hash of normalized (name + address + city + state)';
COMMENT ON COLUMN prospect_data_cache.sec_insider_data IS 'SEC Form 3/4/5 insider filings data';
COMMENT ON COLUMN prospect_data_cache.fec_data IS 'FEC political contribution records';
COMMENT ON COLUMN prospect_data_cache.propublica_data IS 'ProPublica 990 nonprofit data';
COMMENT ON COLUMN prospect_data_cache.county_assessor_data IS 'Official county property assessor records (Socrata APIs)';
COMMENT ON COLUMN prospect_data_cache.voter_data IS 'Voter registration data (party affiliation, birth year)';
COMMENT ON COLUMN prospect_data_cache.family_data IS 'Family/household discovery results';
COMMENT ON COLUMN prospect_data_cache.linkup_data IS 'Array of Linkup web search results';
COMMENT ON COLUMN prospect_data_cache.net_worth_methodology IS 'Explanation of how net worth range was calculated';
COMMENT ON COLUMN prospect_data_cache.data_quality IS 'Overall data quality: complete (3+ sources), partial (1-2 sources), limited (no verified sources)';
COMMENT ON COLUMN prospect_data_cache.sources_used IS 'Array of all sources used with name, url, and confidence level';
