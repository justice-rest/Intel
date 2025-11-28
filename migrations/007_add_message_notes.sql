-- Rōmy Database Migration v7
-- This migration adds the message_notes table for storing user notes on AI responses
--
-- Run this migration in your Supabase SQL Editor or via the CLI

-- ============================================================================
-- MESSAGE NOTES TABLE
-- ============================================================================
-- User notes attached to specific AI assistant messages

CREATE TABLE IF NOT EXISTS message_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id INTEGER NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT message_notes_message_id_fkey FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT message_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_message_notes_message_id ON message_notes(message_id);
CREATE INDEX IF NOT EXISTS idx_message_notes_user_id ON message_notes(user_id);

-- Unique constraint: one note per message per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_notes_unique ON message_notes(message_id, user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE message_notes ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notes
CREATE POLICY "Users can view their own notes"
  ON message_notes FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert notes for themselves
CREATE POLICY "Users can insert their own notes"
  ON message_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own notes
CREATE POLICY "Users can update their own notes"
  ON message_notes FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own notes
CREATE POLICY "Users can delete their own notes"
  ON message_notes FOR DELETE
  USING (auth.uid() = user_id);
