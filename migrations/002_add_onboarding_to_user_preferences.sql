-- Migration: Add onboarding field to user_preferences
-- This migration adds a JSONB column to store onboarding questionnaire responses
--
-- Run this migration in your Supabase SQL Editor or via the CLI

-- Add onboarding column to user_preferences table
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS onboarding JSONB DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN user_preferences.onboarding IS 'Stores onboarding questionnaire responses including: firstName, email, nonprofit, location, sector, annualBudget, donorCount, isFundraisingPrimary, purpose, assistantName, completedAt';

-- Create index for faster queries on onboarding completion
CREATE INDEX IF NOT EXISTS idx_user_preferences_onboarding_completed
ON user_preferences ((onboarding->>'completedAt'))
WHERE onboarding IS NOT NULL;

-- Verify the column was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_preferences'
      AND column_name = 'onboarding'
  ) THEN
    RAISE NOTICE 'Migration complete! Added onboarding column to user_preferences table.';
  ELSE
    RAISE EXCEPTION 'Migration failed! onboarding column was not added.';
  END IF;
END $$;
