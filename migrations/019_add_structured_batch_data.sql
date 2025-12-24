-- Migration: Add structured data columns to batch_prospect_items
-- Purpose: Store extracted wealth indicators, business details, giving history, and affiliations
-- as JSONB for flexible querying instead of regex-parsed markdown

-- Add JSONB columns for structured data
ALTER TABLE batch_prospect_items
  ADD COLUMN IF NOT EXISTS wealth_indicators JSONB,
  ADD COLUMN IF NOT EXISTS business_details JSONB,
  ADD COLUMN IF NOT EXISTS giving_history JSONB,
  ADD COLUMN IF NOT EXISTS affiliations JSONB;

-- Add comment documentation
COMMENT ON COLUMN batch_prospect_items.wealth_indicators IS 'Structured wealth data: real_estate_total, property_count, business_equity, public_holdings, inheritance_likely';
COMMENT ON COLUMN batch_prospect_items.business_details IS 'Business ownership: companies, roles, industries';
COMMENT ON COLUMN batch_prospect_items.giving_history IS 'Philanthropic data: total_political, political_party, foundation_affiliations, nonprofit_boards, known_major_gifts';
COMMENT ON COLUMN batch_prospect_items.affiliations IS 'Personal affiliations: education, clubs, public_company_boards';

-- Add indexes for common queries on existing columns
CREATE INDEX IF NOT EXISTS idx_batch_items_capacity_rating
  ON batch_prospect_items (capacity_rating)
  WHERE capacity_rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_batch_items_net_worth_desc
  ON batch_prospect_items (estimated_net_worth DESC NULLS LAST)
  WHERE estimated_net_worth IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_batch_items_gift_capacity_desc
  ON batch_prospect_items (estimated_gift_capacity DESC NULLS LAST)
  WHERE estimated_gift_capacity IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_batch_items_romy_score_desc
  ON batch_prospect_items (romy_score DESC NULLS LAST)
  WHERE romy_score IS NOT NULL;

-- GIN indexes for JSONB querying (e.g., find all tech industry prospects)
CREATE INDEX IF NOT EXISTS idx_batch_items_wealth_gin
  ON batch_prospect_items USING GIN (wealth_indicators)
  WHERE wealth_indicators IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_batch_items_business_gin
  ON batch_prospect_items USING GIN (business_details)
  WHERE business_details IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_batch_items_giving_gin
  ON batch_prospect_items USING GIN (giving_history)
  WHERE giving_history IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_batch_items_affiliations_gin
  ON batch_prospect_items USING GIN (affiliations)
  WHERE affiliations IS NOT NULL;

-- Example queries enabled by these indexes:
-- Find all prospects in tech industry:
--   SELECT * FROM batch_prospect_items WHERE business_details @> '{"industries": ["Technology"]}';
-- Find all prospects with foundation affiliations:
--   SELECT * FROM batch_prospect_items WHERE giving_history ? 'foundation_affiliations';
-- Find all Harvard alumni:
--   SELECT * FROM batch_prospect_items WHERE affiliations @> '{"education": ["Harvard"]}';
