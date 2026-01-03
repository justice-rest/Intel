-- ============================================================================
-- Add function to get all chats accessible to a user
-- ============================================================================
-- This function returns chats that a user can access:
-- 1. Chats they own (user_id matches)
-- 2. Chats they're a collaborator on (in chat_collaborators table)
--
-- This is needed because the application query was filtering by user_id,
-- which excluded shared chats even though RLS would allow them.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_accessible_chats(p_user_id UUID)
RETURNS SETOF chats
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Get chats user owns
  SELECT c.* FROM chats c
  WHERE c.user_id = p_user_id
  
  UNION
  
  -- Get chats user is collaborator on (excluding ones they own to avoid duplicates)
  SELECT c.* FROM chats c
  INNER JOIN chat_collaborators cc ON c.id = cc.chat_id
  WHERE cc.user_id = p_user_id
  AND c.user_id != p_user_id  -- Exclude owned chats (already in first query)
  
  ORDER BY updated_at DESC NULLS LAST;
$$;

-- Also create a simpler function to get a single chat if user has access
CREATE OR REPLACE FUNCTION get_chat_if_accessible(p_user_id UUID, p_chat_id UUID)
RETURNS SETOF chats
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.* FROM chats c
  WHERE c.id = p_chat_id
  AND (
    c.user_id = p_user_id
    OR EXISTS (
      SELECT 1 FROM chat_collaborators cc
      WHERE cc.chat_id = c.id AND cc.user_id = p_user_id
    )
    OR c.public = true
  );
$$;

COMMENT ON FUNCTION get_user_accessible_chats IS 'Returns all chats a user can access (owned + shared)';
COMMENT ON FUNCTION get_chat_if_accessible IS 'Returns a specific chat if the user has access to it';

DO $$
BEGIN
  RAISE NOTICE 'Created get_user_accessible_chats and get_chat_if_accessible functions';
END $$;
