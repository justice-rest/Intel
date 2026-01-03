-- ============================================================================
-- READ RECEIPTS FOR COLLABORATIVE CHATS
-- ============================================================================
-- Migration: 032
-- Description: Add read receipts tracking for collaborative conversations
--   - Tracks last read message per user per chat
--   - Enables "seen by" indicators on messages
--   - Real-time updates via Supabase subscriptions
-- Author: Claude Code
-- Date: 2026-01-04
-- ============================================================================

-- ============================================================================
-- CHAT READ RECEIPTS TABLE
-- ============================================================================
-- Tracks the last message each user has read in each chat
-- Uses message_id instead of timestamp for precise tracking

CREATE TABLE IF NOT EXISTS chat_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- The ID of the last message the user has seen
  -- Using BIGINT to match messages.id type (SERIAL -> int4/int8)
  last_read_message_id BIGINT NOT NULL,

  -- When the user last read the chat (for sorting/display)
  read_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one read receipt per user per chat
  UNIQUE(chat_id, user_id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_chat_read_receipts_chat_id ON chat_read_receipts(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_read_receipts_user_id ON chat_read_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_read_receipts_last_read ON chat_read_receipts(chat_id, last_read_message_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE chat_read_receipts ENABLE ROW LEVEL SECURITY;

-- Users can view read receipts for chats they have access to
CREATE POLICY "Collaborators can view read receipts"
  ON chat_read_receipts FOR SELECT
  USING (
    user_has_chat_role(auth.uid(), chat_id, 'viewer')
  );

-- Users can insert/update their own read receipts for chats they have access to
CREATE POLICY "Users can mark messages as read"
  ON chat_read_receipts FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND user_has_chat_role(auth.uid(), chat_id, 'viewer')
  );

-- Users can update their own read receipts
CREATE POLICY "Users can update their own read receipts"
  ON chat_read_receipts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own read receipts
CREATE POLICY "Users can delete their own read receipts"
  ON chat_read_receipts FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- HELPER FUNCTION: Get users who have read a specific message
-- ============================================================================

CREATE OR REPLACE FUNCTION get_message_readers(
  p_chat_id UUID,
  p_message_id BIGINT
)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  profile_image TEXT,
  read_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rr.user_id,
    u.display_name,
    u.profile_image,
    rr.read_at
  FROM chat_read_receipts rr
  JOIN users u ON u.id = rr.user_id
  WHERE rr.chat_id = p_chat_id
    AND rr.last_read_message_id >= p_message_id
  ORDER BY rr.read_at DESC;
END;
$$;

-- ============================================================================
-- HELPER FUNCTION: Mark messages as read (upsert)
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_messages_read(
  p_chat_id UUID,
  p_user_id UUID,
  p_last_message_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO chat_read_receipts (chat_id, user_id, last_read_message_id, read_at)
  VALUES (p_chat_id, p_user_id, p_last_message_id, NOW())
  ON CONFLICT (chat_id, user_id)
  DO UPDATE SET
    last_read_message_id = GREATEST(chat_read_receipts.last_read_message_id, EXCLUDED.last_read_message_id),
    read_at = NOW()
  WHERE EXCLUDED.last_read_message_id > chat_read_receipts.last_read_message_id;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE chat_read_receipts IS 'Tracks read status for collaborative chat messages';
COMMENT ON FUNCTION get_message_readers IS 'Returns list of users who have read a specific message';
COMMENT ON FUNCTION mark_messages_read IS 'Marks messages as read for a user (upsert, only updates if newer)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Read receipts migration complete!';
  RAISE NOTICE '- Created chat_read_receipts table';
  RAISE NOTICE '- Added RLS policies for secure access';
  RAISE NOTICE '- Added helper functions for read tracking';
END $$;
