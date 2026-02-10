-- Migration: 020_add_data_provenance.sql
-- Description: Add data provenance tracking for batch research
-- Created: 2025-01-15

-- ============================================================================
-- DATA PROVENANCE TABLE
-- ============================================================================
-- Tracks the origin and history of every data field extracted during research.

CREATE TABLE IF NOT EXISTS prospect_data_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to the batch item
  item_id UUID NOT NULL REFERENCES batch_prospect_items(id) ON DELETE CASCADE,

  -- Field identification (dot notation path)
  field_path TEXT NOT NULL,

  -- The extracted value (stored as JSONB for flexibility)
  value_json JSONB,

  -- Confidence level
  confidence TEXT NOT NULL
    CHECK (confidence IN ('VERIFIED', 'CORROBORATED', 'SINGLE_SOURCE', 'ESTIMATED', 'CONFLICTED')),

  -- Source information (array of source objects)
  sources JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- sources structure: [{ name, url, authority, category }]

  -- Extraction metadata
  extraction_method TEXT NOT NULL,
  model_used TEXT,
  tokens_used INTEGER,

  -- Timestamps
  extracted_at TIMESTAMPTZ DEFAULT NOW(),

  -- Version tracking (for superseded values)
  superseded_by UUID REFERENCES prospect_data_provenance(id),
  superseded_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for finding all provenance for an item
CREATE INDEX IF NOT EXISTS idx_provenance_item
  ON prospect_data_provenance(item_id);

-- Index for finding provenance by field
CREATE INDEX IF NOT EXISTS idx_provenance_field
  ON prospect_data_provenance(item_id, field_path);

-- Index for finding current (non-superseded) provenance
CREATE INDEX IF NOT EXISTS idx_provenance_current
  ON prospect_data_provenance(item_id, field_path)
  WHERE superseded_by IS NULL;

-- Index for finding provenance by confidence
CREATE INDEX IF NOT EXISTS idx_provenance_confidence
  ON prospect_data_provenance(confidence);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE prospect_data_provenance ENABLE ROW LEVEL SECURITY;

-- Users can view provenance for their own items
CREATE POLICY "Users can view own provenance" ON prospect_data_provenance
  FOR SELECT
  USING (
    item_id IN (
      SELECT id FROM batch_prospect_items WHERE user_id = auth.uid()
    )
  );

-- Service role has full access
CREATE POLICY "Service role full access" ON prospect_data_provenance
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get provenance summary for an item
CREATE OR REPLACE FUNCTION get_provenance_summary(p_item_id UUID)
RETURNS TABLE (
  total_fields BIGINT,
  verified_count BIGINT,
  corroborated_count BIGINT,
  single_source_count BIGINT,
  estimated_count BIGINT,
  conflicted_count BIGINT,
  unique_sources BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_fields,
    COUNT(*) FILTER (WHERE confidence = 'VERIFIED')::BIGINT AS verified_count,
    COUNT(*) FILTER (WHERE confidence = 'CORROBORATED')::BIGINT AS corroborated_count,
    COUNT(*) FILTER (WHERE confidence = 'SINGLE_SOURCE')::BIGINT AS single_source_count,
    COUNT(*) FILTER (WHERE confidence = 'ESTIMATED')::BIGINT AS estimated_count,
    COUNT(*) FILTER (WHERE confidence = 'CONFLICTED')::BIGINT AS conflicted_count,
    (
      SELECT COUNT(DISTINCT (source->>'name'))
      FROM prospect_data_provenance p,
           jsonb_array_elements(p.sources) AS source
      WHERE p.item_id = p_item_id AND p.superseded_by IS NULL
    )::BIGINT AS unique_sources
  FROM prospect_data_provenance
  WHERE item_id = p_item_id AND superseded_by IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get source contribution breakdown
CREATE OR REPLACE FUNCTION get_source_contributions(p_item_id UUID)
RETURNS TABLE (
  source_name TEXT,
  fields_provided BIGINT,
  avg_authority NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    source->>'name' AS source_name,
    COUNT(*)::BIGINT AS fields_provided,
    AVG((source->>'authority')::NUMERIC) AS avg_authority
  FROM prospect_data_provenance p,
       jsonb_array_elements(p.sources) AS source
  WHERE p.item_id = p_item_id AND p.superseded_by IS NULL
  GROUP BY source->>'name'
  ORDER BY fields_provided DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE prospect_data_provenance IS
  'Tracks the origin and history of every data field extracted during research';

COMMENT ON COLUMN prospect_data_provenance.field_path IS
  'Dot notation path to the field (e.g., wealth.real_estate.total_value)';

COMMENT ON COLUMN prospect_data_provenance.confidence IS
  'VERIFIED = authoritative source, CORROBORATED = 2+ sources agree, SINGLE_SOURCE = one source only, ESTIMATED = calculated, CONFLICTED = sources disagree';

COMMENT ON COLUMN prospect_data_provenance.sources IS
  'Array of source objects with name, url, authority (0-1), and category';

COMMENT ON COLUMN prospect_data_provenance.superseded_by IS
  'If set, this record was replaced by a newer extraction';
