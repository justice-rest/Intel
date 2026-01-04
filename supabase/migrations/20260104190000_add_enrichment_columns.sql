-- Migration: Add enrichment columns to batch_prospect_items
-- Purpose: Store detailed prospect intelligence from enrichment engine

-- Add enrichment data column (JSONB for full ProspectIntelligence object)
ALTER TABLE batch_prospect_items
ADD COLUMN IF NOT EXISTS enrichment_data JSONB;

-- Add timestamp for when enrichment was performed
ALTER TABLE batch_prospect_items
ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP WITH TIME ZONE;

-- Add enrichment mode used
ALTER TABLE batch_prospect_items
ADD COLUMN IF NOT EXISTS enrichment_mode TEXT;

-- Add index for querying enriched items
CREATE INDEX IF NOT EXISTS idx_batch_prospect_items_enriched_at
ON batch_prospect_items(enriched_at)
WHERE enriched_at IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN batch_prospect_items.enrichment_data IS 'Full ProspectIntelligence object from enrichment engine (JSON)';
COMMENT ON COLUMN batch_prospect_items.enriched_at IS 'Timestamp when enrichment was performed';
COMMENT ON COLUMN batch_prospect_items.enrichment_mode IS 'Enrichment mode used: QUICK_SCREEN, STANDARD, or DEEP_INTELLIGENCE';
