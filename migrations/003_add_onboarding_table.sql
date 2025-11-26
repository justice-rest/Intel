-- Migration: Add onboarding_data table and onboarding fields to users
-- This migration creates the onboarding_data table to store user questionnaire responses
-- and adds tracking fields to the users table
--
-- Run this migration in your Supabase SQL Editor or via the CLI

-- ============================================================================
-- ADD ONBOARDING FIELDS TO USERS TABLE
-- ============================================================================

-- Add onboarding completion tracking fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for faster queries on onboarding status
CREATE INDEX IF NOT EXISTS idx_users_onboarding_completed
ON users(onboarding_completed)
WHERE onboarding_completed = false;

-- ============================================================================
-- CREATE ONBOARDING_DATA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS onboarding_data (
  user_id UUID PRIMARY KEY NOT NULL,
  first_name TEXT,
  nonprofit_name TEXT,
  nonprofit_location TEXT,
  nonprofit_sector TEXT,
  annual_budget TEXT,
  donor_count TEXT,
  fundraising_primary BOOLEAN,
  prior_tools TEXT[],
  purpose TEXT,
  agent_name TEXT,
  additional_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT onboarding_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_data_user_id ON onboarding_data(user_id);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE onboarding_data ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own onboarding data" ON onboarding_data;
DROP POLICY IF EXISTS "Users can create their own onboarding data" ON onboarding_data;
DROP POLICY IF EXISTS "Users can update their own onboarding data" ON onboarding_data;

CREATE POLICY "Users can view their own onboarding data"
  ON onboarding_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own onboarding data"
  ON onboarding_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding data"
  ON onboarding_data FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp for onboarding_data
CREATE OR REPLACE FUNCTION update_onboarding_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_onboarding_data_timestamp ON onboarding_data;
CREATE TRIGGER update_onboarding_data_timestamp
BEFORE UPDATE ON onboarding_data
FOR EACH ROW
EXECUTE PROCEDURE update_onboarding_data_updated_at();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Check if onboarding fields were added to users table
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'onboarding_completed'
  ) THEN
    RAISE NOTICE '✓ Added onboarding_completed to users table';
  ELSE
    RAISE EXCEPTION '✗ Failed to add onboarding_completed to users table';
  END IF;

  -- Check if onboarding_data table was created
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'onboarding_data'
  ) THEN
    RAISE NOTICE '✓ Created onboarding_data table';
  ELSE
    RAISE EXCEPTION '✗ Failed to create onboarding_data table';
  END IF;

  RAISE NOTICE 'Migration 003 complete!';
  RAISE NOTICE 'Created onboarding_data table with RLS policies';
  RAISE NOTICE 'Added onboarding tracking fields to users table';
END $$;
