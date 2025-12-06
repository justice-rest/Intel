-- ============================================================================
-- Migration: Add AVM (Automated Valuation Model) Coefficients Table
--
-- This table stores market-specific hedonic pricing coefficients for property
-- valuations. Coefficients are organized hierarchically:
--   ZIP → City → County → MSA → State → National
-- The system falls back to broader geographic areas when specific data
-- is unavailable.
-- ============================================================================

-- Hedonic coefficients table for market-specific property valuations
CREATE TABLE IF NOT EXISTS hedonic_coefficients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Market identification
  market_area TEXT NOT NULL,                    -- ZIP, city, county, MSA name
  market_area_type TEXT NOT NULL CHECK (market_area_type IN (
    'zip', 'city', 'county', 'msa', 'state', 'national'
  )),
  state_code CHAR(2),                           -- For geographic lookup

  -- Model coefficients (log-linear hedonic pricing)
  -- Formula: ln(P) = intercept + ln_sqft_coef*ln(SQFT) + ln_lot_size_coef*ln(LOT) + ...
  intercept DECIMAL(12, 6) NOT NULL,            -- Base ln(price)
  ln_sqft_coef DECIMAL(10, 6) DEFAULT 0.45,     -- Square footage elasticity
  ln_lot_size_coef DECIMAL(10, 6) DEFAULT 0.12, -- Lot size elasticity
  bedroom_coef DECIMAL(10, 6) DEFAULT 0.02,     -- Per bedroom premium
  bathroom_coef DECIMAL(10, 6) DEFAULT 0.08,    -- Per bathroom premium
  age_coef DECIMAL(10, 6) DEFAULT -0.005,       -- Per year depreciation
  garage_coef DECIMAL(10, 6) DEFAULT 0.04,      -- Per garage space
  pool_coef DECIMAL(10, 6) DEFAULT 0.05,        -- Pool premium
  basement_coef DECIMAL(10, 6) DEFAULT 0.03,    -- Basement premium
  fireplace_coef DECIMAL(10, 6) DEFAULT 0.02,   -- Fireplace premium

  -- Comparable sales adjustment factors (dollars)
  -- Used in the sales comparison approach
  adj_sqft_per_100 DECIMAL(10, 2) DEFAULT 15000,  -- Per 100 sqft difference
  adj_bedroom DECIMAL(10, 2) DEFAULT 10000,       -- Per bedroom difference
  adj_bathroom DECIMAL(10, 2) DEFAULT 7500,       -- Per bathroom difference
  adj_age_per_year DECIMAL(10, 2) DEFAULT 1000,   -- Per year of age difference
  adj_garage DECIMAL(10, 2) DEFAULT 8000,         -- Per garage space difference
  adj_pool DECIMAL(10, 2) DEFAULT 20000,          -- Pool adjustment

  -- Model statistics (for confidence scoring)
  r_squared DECIMAL(5, 4),                      -- Model fit quality (0-1)
  sample_size INTEGER,                          -- Training sample size
  median_price DECIMAL(12, 2),                  -- Market median for context
  coefficient_of_variation DECIMAL(5, 4),       -- Market volatility measure

  -- Validity period
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  data_source TEXT,                             -- Where coefficients came from

  UNIQUE(market_area, market_area_type, effective_date)
);

-- Indexes for efficient lookups
-- Primary lookup: by market area type and name
CREATE INDEX IF NOT EXISTS idx_hedonic_market_lookup ON hedonic_coefficients(
  market_area_type, market_area, is_active, effective_date DESC
);

-- State-based lookups for regional defaults
CREATE INDEX IF NOT EXISTS idx_hedonic_state ON hedonic_coefficients(
  state_code, is_active
) WHERE state_code IS NOT NULL;

-- Active coefficients lookup
CREATE INDEX IF NOT EXISTS idx_hedonic_active ON hedonic_coefficients(is_active)
WHERE is_active = TRUE;

-- Insert national defaults
-- These serve as the ultimate fallback when no market-specific data is available
INSERT INTO hedonic_coefficients (
  market_area,
  market_area_type,
  state_code,
  intercept,
  ln_sqft_coef,
  ln_lot_size_coef,
  bedroom_coef,
  bathroom_coef,
  age_coef,
  garage_coef,
  pool_coef,
  basement_coef,
  fireplace_coef,
  adj_sqft_per_100,
  adj_bedroom,
  adj_bathroom,
  adj_age_per_year,
  adj_garage,
  adj_pool,
  data_source
) VALUES (
  'US',
  'national',
  NULL,
  11.2,                  -- Base intercept (ln of ~$73,000)
  0.45,                  -- 1% sqft → 0.45% price
  0.12,                  -- 1% lot → 0.12% price
  0.02,                  -- Each bedroom → ~2%
  0.08,                  -- Each bathroom → ~8%
  -0.005,                -- Each year of age → -0.5%
  0.04,                  -- Each garage space → ~4%
  0.05,                  -- Pool → ~5%
  0.03,                  -- Basement → ~3%
  0.02,                  -- Fireplace → ~2%
  15000,                 -- $15K per 100 sqft
  10000,                 -- $10K per bedroom
  7500,                  -- $7.5K per bathroom
  1000,                  -- $1K per year of age
  8000,                  -- $8K per garage space
  20000,                 -- $20K for pool
  'National averages from housing research and appraisal standards'
) ON CONFLICT (market_area, market_area_type, effective_date) DO NOTHING;

-- Insert some major metro area defaults for better accuracy
-- These are approximate coefficients based on housing market research

-- California - Higher price per sqft, strong pool premium
INSERT INTO hedonic_coefficients (
  market_area, market_area_type, state_code, intercept,
  ln_sqft_coef, ln_lot_size_coef, bedroom_coef, bathroom_coef,
  age_coef, garage_coef, pool_coef, basement_coef, fireplace_coef,
  adj_sqft_per_100, adj_bedroom, adj_bathroom, adj_age_per_year,
  adj_garage, adj_pool, median_price, data_source
) VALUES (
  'CA', 'state', 'CA', 12.1,
  0.52, 0.15, 0.015, 0.06,
  -0.003, 0.03, 0.08, 0.02, 0.015,
  35000, 15000, 12000, 1500,
  12000, 35000, 750000, 'California market research'
) ON CONFLICT (market_area, market_area_type, effective_date) DO NOTHING;

-- Texas - Moderate prices, larger lots, strong garage value
INSERT INTO hedonic_coefficients (
  market_area, market_area_type, state_code, intercept,
  ln_sqft_coef, ln_lot_size_coef, bedroom_coef, bathroom_coef,
  age_coef, garage_coef, pool_coef, basement_coef, fireplace_coef,
  adj_sqft_per_100, adj_bedroom, adj_bathroom, adj_age_per_year,
  adj_garage, adj_pool, median_price, data_source
) VALUES (
  'TX', 'state', 'TX', 11.5,
  0.48, 0.14, 0.025, 0.09,
  -0.006, 0.05, 0.07, 0.025, 0.02,
  18000, 12000, 9000, 1200,
  10000, 28000, 350000, 'Texas market research'
) ON CONFLICT (market_area, market_area_type, effective_date) DO NOTHING;

-- New York - High base price, smaller lots, strong bathroom premium
INSERT INTO hedonic_coefficients (
  market_area, market_area_type, state_code, intercept,
  ln_sqft_coef, ln_lot_size_coef, bedroom_coef, bathroom_coef,
  age_coef, garage_coef, pool_coef, basement_coef, fireplace_coef,
  adj_sqft_per_100, adj_bedroom, adj_bathroom, adj_age_per_year,
  adj_garage, adj_pool, median_price, data_source
) VALUES (
  'NY', 'state', 'NY', 12.3,
  0.50, 0.10, 0.02, 0.10,
  -0.004, 0.04, 0.04, 0.04, 0.025,
  40000, 20000, 15000, 1800,
  15000, 25000, 550000, 'New York market research'
) ON CONFLICT (market_area, market_area_type, effective_date) DO NOTHING;

-- Florida - Pool premium very high, lower basement value
INSERT INTO hedonic_coefficients (
  market_area, market_area_type, state_code, intercept,
  ln_sqft_coef, ln_lot_size_coef, bedroom_coef, bathroom_coef,
  age_coef, garage_coef, pool_coef, basement_coef, fireplace_coef,
  adj_sqft_per_100, adj_bedroom, adj_bathroom, adj_age_per_year,
  adj_garage, adj_pool, median_price, data_source
) VALUES (
  'FL', 'state', 'FL', 11.8,
  0.47, 0.13, 0.02, 0.085,
  -0.005, 0.045, 0.10, 0.01, 0.01,
  22000, 12000, 10000, 1100,
  10000, 40000, 420000, 'Florida market research'
) ON CONFLICT (market_area, market_area_type, effective_date) DO NOTHING;

-- Washington - Tech-driven market, high base price
INSERT INTO hedonic_coefficients (
  market_area, market_area_type, state_code, intercept,
  ln_sqft_coef, ln_lot_size_coef, bedroom_coef, bathroom_coef,
  age_coef, garage_coef, pool_coef, basement_coef, fireplace_coef,
  adj_sqft_per_100, adj_bedroom, adj_bathroom, adj_age_per_year,
  adj_garage, adj_pool, median_price, data_source
) VALUES (
  'WA', 'state', 'WA', 12.0,
  0.50, 0.12, 0.018, 0.075,
  -0.004, 0.04, 0.05, 0.035, 0.02,
  32000, 18000, 12000, 1600,
  12000, 30000, 620000, 'Washington market research'
) ON CONFLICT (market_area, market_area_type, effective_date) DO NOTHING;

-- Colorado - Strong basement premium, moderate pool value
INSERT INTO hedonic_coefficients (
  market_area, market_area_type, state_code, intercept,
  ln_sqft_coef, ln_lot_size_coef, bedroom_coef, bathroom_coef,
  age_coef, garage_coef, pool_coef, basement_coef, fireplace_coef,
  adj_sqft_per_100, adj_bedroom, adj_bathroom, adj_age_per_year,
  adj_garage, adj_pool, median_price, data_source
) VALUES (
  'CO', 'state', 'CO', 11.9,
  0.48, 0.11, 0.02, 0.08,
  -0.005, 0.045, 0.04, 0.06, 0.03,
  28000, 15000, 11000, 1400,
  11000, 25000, 580000, 'Colorado market research'
) ON CONFLICT (market_area, market_area_type, effective_date) DO NOTHING;

-- Row-level security (match existing patterns in codebase)
-- Coefficients are read-only for most users
ALTER TABLE hedonic_coefficients ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read coefficients
CREATE POLICY "hedonic_coefficients_select_policy" ON hedonic_coefficients
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Allow service role full access for admin operations
CREATE POLICY "hedonic_coefficients_service_role_policy" ON hedonic_coefficients
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- Comment on table for documentation
COMMENT ON TABLE hedonic_coefficients IS
'Market-specific hedonic pricing coefficients for the AVM (Automated Valuation Model) tool.
Coefficients are organized hierarchically by geography (ZIP → City → County → MSA → State → National)
and the system automatically falls back to broader areas when specific data is unavailable.';
