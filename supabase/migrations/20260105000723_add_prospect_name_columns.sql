-- ============================================================================
-- ADD PROSPECT NAME COLUMNS
-- Migration: 20260105000723_add_prospect_name_columns.sql
-- Description: Add first_name and last_name columns to batch_prospect_items
-- ============================================================================

-- Add first_name column
ALTER TABLE batch_prospect_items
ADD COLUMN IF NOT EXISTS prospect_first_name TEXT;

-- Add last_name column
ALTER TABLE batch_prospect_items
ADD COLUMN IF NOT EXISTS prospect_last_name TEXT;

-- Create index for name searches
CREATE INDEX IF NOT EXISTS idx_batch_items_first_name
ON batch_prospect_items(prospect_first_name);

CREATE INDEX IF NOT EXISTS idx_batch_items_last_name
ON batch_prospect_items(prospect_last_name);

-- Add comment for documentation
COMMENT ON COLUMN batch_prospect_items.prospect_first_name IS 'First name parsed from full name or provided separately in CSV';
COMMENT ON COLUMN batch_prospect_items.prospect_last_name IS 'Last name parsed from full name or provided separately in CSV';
