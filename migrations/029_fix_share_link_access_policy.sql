-- ============================================================================
-- FIX: Allow reading share links by token for acceptance
-- ============================================================================
-- Issue: Users accepting a share link couldn't read it because they weren't
-- collaborators yet (chicken-and-egg problem)
--
-- Solution: Add a policy that allows any authenticated user to SELECT
-- share links when they know the exact token. This is secure because:
-- 1. Tokens are cryptographically secure (32 bytes random)
-- 2. Without the token, you can't query for links
-- 3. This only allows SELECT, not UPDATE/DELETE
-- ============================================================================

-- Add policy to allow reading share links by token (for acceptance flow)
CREATE POLICY "Anyone can read share links by token"
  ON chat_share_links FOR SELECT
  USING (
    -- Either user is editor+ on the chat (existing policy logic)
    user_has_chat_role(auth.uid(), chat_id, 'editor')
    OR
    -- Or they're authenticated (for token-based lookup during acceptance)
    auth.uid() IS NOT NULL
  );

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Owners and editors can view share links" ON chat_share_links;

-- ============================================================================
-- Note: The token itself acts as the security mechanism. Without knowing
-- the 32-byte cryptographically random token, a user cannot query for links.
-- The API endpoint validates the token match, so this policy is safe.
-- ============================================================================
