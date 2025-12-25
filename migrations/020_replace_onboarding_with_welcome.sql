-- Migration 020: Replace onboarding with welcome popup
-- This migration:
-- 1. Adds first_name and welcome_completed to users table
-- 2. Migrates existing data from onboarding_data
-- 3. Drops the onboarding_data table and related columns
-- 4. Removes onboarding column from user_preferences

-- ============================================================================
-- STEP 1: Add new columns to users table
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_completed BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- STEP 2: Migrate existing first_name data from onboarding_data
-- ============================================================================
UPDATE users u
SET first_name = od.first_name
FROM onboarding_data od
WHERE u.id = od.user_id AND od.first_name IS NOT NULL;

-- ============================================================================
-- STEP 3: Mark users who completed onboarding as welcome_completed
-- ============================================================================
UPDATE users SET welcome_completed = TRUE WHERE onboarding_completed = TRUE;

-- ============================================================================
-- STEP 4: Drop onboarding_data table and its dependencies
-- ============================================================================
-- Drop RLS policies
DROP POLICY IF EXISTS "Users can view their own onboarding data" ON onboarding_data;
DROP POLICY IF EXISTS "Users can create their own onboarding data" ON onboarding_data;
DROP POLICY IF EXISTS "Users can update their own onboarding data" ON onboarding_data;

-- Drop trigger and function
DROP TRIGGER IF EXISTS update_onboarding_data_timestamp ON onboarding_data;
DROP FUNCTION IF EXISTS update_onboarding_data_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_onboarding_data_user_id;

-- Drop the table
DROP TABLE IF EXISTS onboarding_data;

-- ============================================================================
-- STEP 5: Remove onboarding columns from users table
-- ============================================================================
DROP INDEX IF EXISTS idx_users_onboarding_completed;
ALTER TABLE users DROP COLUMN IF EXISTS onboarding_completed;
ALTER TABLE users DROP COLUMN IF EXISTS onboarding_completed_at;

-- ============================================================================
-- STEP 6: Remove onboarding from user_preferences (from migration 002)
-- ============================================================================
DROP INDEX IF EXISTS idx_user_preferences_onboarding_completed;
ALTER TABLE user_preferences DROP COLUMN IF EXISTS onboarding;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  -- Verify first_name was added
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'first_name'
  ) THEN
    RAISE NOTICE 'OK: first_name column added to users table';
  ELSE
    RAISE EXCEPTION 'FAIL: first_name column not added';
  END IF;

  -- Verify welcome_completed was added
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'welcome_completed'
  ) THEN
    RAISE NOTICE 'OK: welcome_completed column added to users table';
  ELSE
    RAISE EXCEPTION 'FAIL: welcome_completed column not added';
  END IF;

  -- Verify onboarding_data was dropped
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'onboarding_data'
  ) THEN
    RAISE NOTICE 'OK: onboarding_data table dropped';
  ELSE
    RAISE EXCEPTION 'FAIL: onboarding_data table still exists';
  END IF;

  -- Verify onboarding_completed was dropped from users
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'onboarding_completed'
  ) THEN
    RAISE NOTICE 'OK: onboarding_completed removed from users table';
  ELSE
    RAISE EXCEPTION 'FAIL: onboarding_completed still exists';
  END IF;

  RAISE NOTICE 'Migration 020 complete!';
END $$;
