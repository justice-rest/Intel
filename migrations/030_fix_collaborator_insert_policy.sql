-- ============================================================================
-- FIX: Allow users to join as collaborators via share link
-- ============================================================================
-- Issue: The INSERT policy on chat_collaborators only allowed owners to insert.
-- But when a user accepts a share link, THEY need to insert themselves as a
-- collaborator - they're not an owner yet!
--
-- Solution: Modify the policy to allow self-insertion when:
-- 1. User is inserting themselves (user_id = auth.uid())
-- 2. They have a valid share link reference (invited_via_link_id)
-- 3. The share link exists, is active, not revoked, and matches the chat
-- ============================================================================

-- ============================================================================
-- FIX SELECT POLICY: Allow users to check their own collaborator status
-- ============================================================================
-- Issue: getUserChatRole() queries chat_collaborators to check if user exists,
-- but the SELECT policy requires viewer+ role (chicken-and-egg)

-- Drop the old SELECT policy
DROP POLICY IF EXISTS "Collaborators can view chat's collaborator list" ON chat_collaborators;

-- Create new SELECT policy that allows:
-- 1. Collaborators to view the full list (existing behavior)
-- 2. Any authenticated user to view their OWN record (for status checks)
CREATE POLICY "Collaborators can view list or users can view own status"
  ON chat_collaborators FOR SELECT
  USING (
    -- Option 1: User has viewer+ role on the chat (can see all collaborators)
    user_has_chat_role(auth.uid(), chat_id, 'viewer')
    OR
    -- Option 2: User is checking their own collaborator status
    user_id = auth.uid()
  );

-- ============================================================================
-- FIX INSERT POLICY: Allow users to insert themselves via share link
-- ============================================================================

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Owners can add collaborators" ON chat_collaborators;

-- Create new policy that allows:
-- 1. Owners to add any collaborator (existing behavior)
-- 2. Users to add THEMSELVES via a valid share link
CREATE POLICY "Owners can add collaborators or users can join via share link"
  ON chat_collaborators FOR INSERT
  WITH CHECK (
    -- Option 1: User is an owner of the chat
    user_has_chat_role(auth.uid(), chat_id, 'owner')
    OR
    -- Option 2: User is inserting themselves via a valid share link
    (
      -- Must be inserting themselves
      user_id = auth.uid()
      AND
      -- Must have a share link reference
      invited_via_link_id IS NOT NULL
      AND
      -- The share link must be valid
      EXISTS (
        SELECT 1 FROM chat_share_links 
        WHERE id = invited_via_link_id 
        AND chat_id = chat_collaborators.chat_id
        AND is_active = true
        AND revoked_at IS NULL
        -- Also check max_uses hasn't been exceeded
        AND (max_uses IS NULL OR use_count < max_uses)
      )
    )
  );

-- ============================================================================
-- Security Notes:
-- - Users can ONLY insert themselves (user_id = auth.uid())
-- - They MUST have a valid share link ID that:
--   - Matches the chat they're trying to join
--   - Is active and not revoked
--   - Hasn't exceeded max uses
-- - The role they get is still controlled by the share link (API validates this)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Collaborator INSERT policy updated to allow share link acceptance';
END $$;
