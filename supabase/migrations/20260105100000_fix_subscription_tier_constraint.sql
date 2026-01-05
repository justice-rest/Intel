-- Migration: Fix subscription_tier CHECK constraint
-- The constraint was too restrictive and didn't include 'growth' tier

-- Drop the existing constraint if it exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;

-- First, clean up any invalid data by setting non-conforming values to null
-- This handles any rows that don't match our expected tier values
UPDATE users
SET subscription_tier = NULL
WHERE subscription_tier IS NOT NULL
  AND subscription_tier NOT IN ('growth', 'pro', 'scale', 'starter');

-- Recreate with correct allowed values (including null for no subscription)
-- Allowed values: 'growth', 'pro', 'scale', 'starter', or NULL
ALTER TABLE users ADD CONSTRAINT users_subscription_tier_check
  CHECK (subscription_tier IS NULL OR subscription_tier IN ('growth', 'pro', 'scale', 'starter'));

-- Update comment
COMMENT ON COLUMN users.subscription_tier IS 'Cached subscription tier (growth, pro, scale, starter)';
