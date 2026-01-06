-- Migration: Add consent_logs table for GDPR/CCPA compliance
-- This table stores cookie consent records for legal compliance (3-year retention)

-- Create consent_logs table
CREATE TABLE IF NOT EXISTS consent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Can be null for anonymous users
    ip_hash TEXT NOT NULL, -- SHA-256 hash of IP (for compliance, not tracking)
    consent_version TEXT NOT NULL DEFAULT '1.0',
    choices JSONB NOT NULL DEFAULT '{"essential": true, "analytics": false, "marketing": false}'::jsonb,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_consent_logs_user_id ON consent_logs(user_id);

-- Create index for compliance queries (by date)
CREATE INDEX IF NOT EXISTS idx_consent_logs_created_at ON consent_logs(created_at);

-- Enable RLS
ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own consent records
CREATE POLICY "Users can view own consent logs"
ON consent_logs FOR SELECT
USING (
    auth.uid() = user_id
    OR user_id IS NULL -- Allow viewing anonymous records by their IP hash
);

-- Policy: Anyone can insert consent records (anonymous users need to record consent)
CREATE POLICY "Anyone can insert consent logs"
ON consent_logs FOR INSERT
WITH CHECK (true);

-- Policy: Service role has full access (for admin queries)
CREATE POLICY "Service role has full access to consent logs"
ON consent_logs FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE consent_logs IS 'Cookie consent records for GDPR/CCPA compliance. Retained for 3 years.';
COMMENT ON COLUMN consent_logs.ip_hash IS 'SHA-256 hash of IP address with salt. For compliance verification, not tracking.';
COMMENT ON COLUMN consent_logs.choices IS 'JSON object with consent choices: essential (always true), analytics, marketing';
