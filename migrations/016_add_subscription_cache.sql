-- Migration: Add subscription status cache to users table
-- Purpose: Cache subscription status to avoid loading delay for verification badges

-- Add subscription cache columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT;

-- subscription_status: 'active', 'trialing', 'canceled', 'past_due', null (no subscription)
-- subscription_tier: 'starter', 'pro', 'scale', null (no subscription)

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Comment for documentation
COMMENT ON COLUMN users.subscription_status IS 'Cached subscription status from billing provider (active, trialing, canceled, past_due)';
COMMENT ON COLUMN users.subscription_tier IS 'Cached subscription tier (starter, pro, scale)';
