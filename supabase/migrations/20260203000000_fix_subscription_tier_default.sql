-- Fix: Remove 'free' default from subscription_tier
-- The check constraint only allows: growth, pro, scale, starter, or NULL
-- But a DEFAULT 'free' was causing insert failures

-- Remove the default value so new rows get NULL instead of 'free'
ALTER TABLE users ALTER COLUMN subscription_tier DROP DEFAULT;

-- Also ensure any existing 'free' values are set to NULL
UPDATE users SET subscription_tier = NULL WHERE subscription_tier = 'free';
