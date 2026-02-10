-- Migration: Add welcome popup columns
-- Adds first_name and welcome_completed to users table for the welcome popup feature

-- Add first_name column for personalized greetings
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;

-- Add welcome_completed flag to track if user has completed the welcome popup
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_completed BOOLEAN DEFAULT FALSE;

-- Verification
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'first_name'
  ) THEN
    RAISE NOTICE 'OK: first_name column added to users table';
  ELSE
    RAISE EXCEPTION 'FAIL: first_name column not added';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'welcome_completed'
  ) THEN
    RAISE NOTICE 'OK: welcome_completed column added to users table';
  ELSE
    RAISE EXCEPTION 'FAIL: welcome_completed column not added';
  END IF;
END $$;
