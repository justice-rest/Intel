-- Migration: Add beta_features_enabled to user_preferences
-- Description: Allows Scale plan users to opt into experimental beta features
-- Features gated by this flag:
--   1. Gemini Grounded Search - Google's native search with citations
--   2. Ultra Research Mode - LinkUp's /research endpoint for comprehensive multi-step research

-- Add beta_features_enabled column to user_preferences
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS beta_features_enabled BOOLEAN DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN user_preferences.beta_features_enabled IS 'Enables experimental beta features (Gemini Grounded Search, Ultra Research). Only available to Scale plan users.';
