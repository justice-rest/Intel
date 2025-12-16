-- ============================================================================
-- Migration: 013_add_crm_integrations.sql
-- Description: Add CRM integration tables for Bloomerang and Virtuous
-- ============================================================================

-- CRM Sync Logs Table
-- Tracks sync operations for each CRM provider
CREATE TABLE IF NOT EXISTS crm_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('bloomerang', 'virtuous')),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRM Constituents Table
-- Stores normalized constituent/contact data from CRM systems
CREATE TABLE IF NOT EXISTS crm_constituents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('bloomerang', 'virtuous')),
  external_id TEXT NOT NULL,

  -- Core constituent fields
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  email TEXT,
  phone TEXT,

  -- Address
  street_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT,

  -- Giving data
  total_lifetime_giving DECIMAL(15,2),
  largest_gift DECIMAL(15,2),
  last_gift_amount DECIMAL(15,2),
  last_gift_date DATE,
  first_gift_date DATE,
  gift_count INTEGER DEFAULT 0,

  -- Custom fields (provider-specific)
  custom_fields JSONB DEFAULT '{}'::jsonb,

  -- Raw data from CRM for reference
  raw_data JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per provider per user
  UNIQUE (user_id, provider, external_id)
);

-- CRM Donations Table
-- Stores normalized donation/gift data from CRM systems
CREATE TABLE IF NOT EXISTS crm_donations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('bloomerang', 'virtuous')),
  external_id TEXT NOT NULL,
  constituent_external_id TEXT NOT NULL,

  -- Donation details
  amount DECIMAL(15,2) NOT NULL,
  donation_date DATE,
  donation_type TEXT,
  campaign_name TEXT,
  fund_name TEXT,
  payment_method TEXT,
  status TEXT,

  -- Notes and custom
  notes TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per provider per user
  UNIQUE (user_id, provider, external_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Sync logs indexes
CREATE INDEX IF NOT EXISTS idx_crm_sync_logs_user_provider ON crm_sync_logs(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_crm_sync_logs_status ON crm_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_crm_sync_logs_started_at ON crm_sync_logs(started_at DESC);

-- Constituents indexes
CREATE INDEX IF NOT EXISTS idx_crm_constituents_user_provider ON crm_constituents(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_crm_constituents_full_name ON crm_constituents(full_name);
CREATE INDEX IF NOT EXISTS idx_crm_constituents_email ON crm_constituents(email);
CREATE INDEX IF NOT EXISTS idx_crm_constituents_last_name ON crm_constituents(last_name);
CREATE INDEX IF NOT EXISTS idx_crm_constituents_synced_at ON crm_constituents(synced_at DESC);

-- Full text search index for constituent names
CREATE INDEX IF NOT EXISTS idx_crm_constituents_name_search ON crm_constituents
  USING gin(to_tsvector('english', coalesce(full_name, '') || ' ' || coalesce(email, '')));

-- Donations indexes
CREATE INDEX IF NOT EXISTS idx_crm_donations_user_provider ON crm_donations(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_crm_donations_constituent ON crm_donations(constituent_external_id);
CREATE INDEX IF NOT EXISTS idx_crm_donations_date ON crm_donations(donation_date DESC);
CREATE INDEX IF NOT EXISTS idx_crm_donations_amount ON crm_donations(amount DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE crm_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_constituents ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_donations ENABLE ROW LEVEL SECURITY;

-- Sync logs policies
CREATE POLICY "Users can view own CRM sync logs"
  ON crm_sync_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own CRM sync logs"
  ON crm_sync_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own CRM sync logs"
  ON crm_sync_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own CRM sync logs"
  ON crm_sync_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Constituents policies
CREATE POLICY "Users can view own CRM constituents"
  ON crm_constituents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own CRM constituents"
  ON crm_constituents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own CRM constituents"
  ON crm_constituents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own CRM constituents"
  ON crm_constituents FOR DELETE
  USING (auth.uid() = user_id);

-- Donations policies
CREATE POLICY "Users can view own CRM donations"
  ON crm_donations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own CRM donations"
  ON crm_donations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own CRM donations"
  ON crm_donations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own CRM donations"
  ON crm_donations FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_crm_constituent_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS crm_constituents_updated_at ON crm_constituents;
CREATE TRIGGER crm_constituents_updated_at
  BEFORE UPDATE ON crm_constituents
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_constituent_updated_at();

-- ============================================================================
-- HELPER VIEWS (optional, for easier querying)
-- ============================================================================

-- View for constituent summaries with donation counts
CREATE OR REPLACE VIEW crm_constituent_summaries AS
SELECT
  c.id,
  c.user_id,
  c.provider,
  c.external_id,
  c.full_name,
  c.email,
  c.city,
  c.state,
  c.total_lifetime_giving,
  c.last_gift_amount,
  c.last_gift_date,
  c.gift_count,
  c.synced_at,
  COUNT(d.id) as actual_donation_count,
  SUM(d.amount) as calculated_total_giving
FROM crm_constituents c
LEFT JOIN crm_donations d ON c.user_id = d.user_id
  AND c.provider = d.provider
  AND c.external_id = d.constituent_external_id
GROUP BY c.id;

-- Grant access to the view
GRANT SELECT ON crm_constituent_summaries TO authenticated;
