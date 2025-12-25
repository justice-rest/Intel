-- ============================================================================
-- Quiz Rewards System
-- ============================================================================
-- Adds tables for tracking quiz completion and bonus message rewards
-- for Growth Plan users who answer fundraising education questions.
--
-- Business Logic:
-- - 20 multiple-choice questions (Basic, Intermediate, Advanced)
-- - 5-10 bonus messages per correct answer
-- - Maximum 100 bonus messages per month
-- - Questions can rotate daily or be available as a full list
-- ============================================================================

-- ============================================================================
-- Table: user_quiz_progress
-- ============================================================================
-- Tracks which questions a user has answered and their bonus earnings
CREATE TABLE IF NOT EXISTS user_quiz_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,                    -- Question identifier (e.g., "Q1", "Q2"...)
  answered_correctly BOOLEAN NOT NULL,          -- Whether they got it right
  bonus_messages_earned INTEGER NOT NULL DEFAULT 0, -- Bonus messages from this answer
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: user can only answer each question once
  UNIQUE(user_id, question_id)
);

-- ============================================================================
-- Table: user_quiz_monthly_limits
-- ============================================================================
-- Tracks monthly bonus message limits (max 100 per month)
CREATE TABLE IF NOT EXISTS user_quiz_monthly_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,                     -- Format: "2025-01" for Jan 2025
  total_bonus_earned INTEGER NOT NULL DEFAULT 0, -- Total bonus messages this month

  -- Unique constraint: one record per user per month
  UNIQUE(user_id, month_year)
);

-- ============================================================================
-- Add bonus_messages column to users table
-- ============================================================================
-- bonus_messages: Current bonus message balance (rolls over, capped at 100)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS bonus_messages INTEGER DEFAULT 0;

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_quiz_progress_user_id ON user_quiz_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_progress_question ON user_quiz_progress(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_monthly_user_month ON user_quiz_monthly_limits(user_id, month_year);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE user_quiz_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quiz_monthly_limits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent re-runs)
DROP POLICY IF EXISTS "Users can view their own quiz progress" ON user_quiz_progress;
DROP POLICY IF EXISTS "Users can insert their own quiz progress" ON user_quiz_progress;
DROP POLICY IF EXISTS "Users can view their own monthly limits" ON user_quiz_monthly_limits;
DROP POLICY IF EXISTS "Users can insert their own monthly limits" ON user_quiz_monthly_limits;
DROP POLICY IF EXISTS "Users can update their own monthly limits" ON user_quiz_monthly_limits;
DROP POLICY IF EXISTS "Service role can manage all quiz progress" ON user_quiz_progress;
DROP POLICY IF EXISTS "Service role can manage all monthly limits" ON user_quiz_monthly_limits;

-- user_quiz_progress policies
CREATE POLICY "Users can view their own quiz progress"
  ON user_quiz_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quiz progress"
  ON user_quiz_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- user_quiz_monthly_limits policies
CREATE POLICY "Users can view their own monthly limits"
  ON user_quiz_monthly_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monthly limits"
  ON user_quiz_monthly_limits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monthly limits"
  ON user_quiz_monthly_limits FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Service role policies for API routes
-- ============================================================================
CREATE POLICY "Service role can manage all quiz progress"
  ON user_quiz_progress FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage all monthly limits"
  ON user_quiz_monthly_limits FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
