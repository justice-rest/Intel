-- ============================================================================
-- ENABLE REALTIME FOR MESSAGES TABLE
-- ============================================================================
-- Migration: 033
-- Description: Enable Supabase Realtime for messages table to support
--              collaborative chat syncing. This allows collaborators to
--              receive real-time INSERT events for new messages.
-- Author: Claude Code
-- Date: 2026-01-04
-- ============================================================================

-- Enable REPLICA IDENTITY FULL for messages table
-- This is required for Realtime to send complete row data on changes
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Add messages table to supabase_realtime publication if not already present
-- (Using DO block to handle case where table is already in publication)
DO $$
BEGIN
  -- Try to add messages, ignore if already exists
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'messages already in supabase_realtime publication, skipping';
  END;
END $$;

-- Also enable for read receipts
ALTER TABLE chat_read_receipts REPLICA IDENTITY FULL;

DO $$
BEGIN
  -- Try to add chat_read_receipts, ignore if already exists
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_read_receipts;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'chat_read_receipts already in supabase_realtime publication, skipping';
  END;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Realtime enabled for messages and chat_read_receipts tables!';
  RAISE NOTICE 'Collaborators will now receive real-time message updates.';
END $$;
