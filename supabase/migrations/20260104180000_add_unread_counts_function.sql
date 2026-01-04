-- ============================================================================
-- MIGRATION 035: Add Unread Counts Function
-- ============================================================================
-- Creates a function to efficiently calculate unread message counts
-- for all chats a user has access to.
--
-- Author: Claude Code
-- Date: 2026-01-04
-- ============================================================================

-- Drop existing function if exists (for idempotency)
DROP FUNCTION IF EXISTS get_user_unread_counts(UUID);

-- ============================================================================
-- GET USER UNREAD COUNTS
-- ============================================================================
-- Returns unread message counts for all chats the user can access.
-- Uses the chat_read_receipts table to determine what the user has already read.
--
-- Returns:
--   - chat_id: The chat identifier
--   - unread_count: Number of unread messages (messages after last_read_message_id)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_unread_counts(p_user_id UUID)
RETURNS TABLE (chat_id UUID, unread_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH user_chats AS (
    -- Get all chats the user owns
    SELECT c.id as chat_id
    FROM chats c
    WHERE c.user_id = p_user_id

    UNION

    -- Get all chats the user collaborates on
    SELECT cc.chat_id
    FROM chat_collaborators cc
    WHERE cc.user_id = p_user_id
  ),
  chat_last_messages AS (
    -- Get the last message ID for each chat
    SELECT
      m.chat_id,
      MAX(m.id) as last_message_id
    FROM messages m
    INNER JOIN user_chats uc ON m.chat_id::uuid = uc.chat_id
    GROUP BY m.chat_id
  ),
  user_read_positions AS (
    -- Get user's read position for each chat
    SELECT
      r.chat_id,
      r.last_read_message_id
    FROM chat_read_receipts r
    WHERE r.user_id = p_user_id
  )
  -- Calculate unread counts
  SELECT
    uc.chat_id,
    COALESCE(
      -- Count messages after user's last read position
      (
        SELECT COUNT(*)::BIGINT
        FROM messages m
        WHERE m.chat_id::uuid = uc.chat_id
          AND m.id > COALESCE(urp.last_read_message_id, 0)
          -- Only count messages from others (not user's own messages)
          AND (m.user_id IS NULL OR m.user_id != p_user_id)
      ),
      0
    ) as unread_count
  FROM user_chats uc
  LEFT JOIN user_read_positions urp ON uc.chat_id = urp.chat_id
  LEFT JOIN chat_last_messages clm ON uc.chat_id = clm.chat_id
  -- Only include chats that have messages
  WHERE clm.last_message_id IS NOT NULL;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_unread_counts(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_user_unread_counts IS
'Returns unread message counts for all chats a user has access to.
Uses chat_read_receipts to determine read positions.
Only counts messages from other users (not the current user''s own messages).';
