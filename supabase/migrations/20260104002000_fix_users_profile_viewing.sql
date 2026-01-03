-- ============================================================================
-- FIX: Allow authenticated users to view basic profile info of other users
-- ============================================================================
-- Issue: The users table RLS policy only allows users to view their own data:
--   `auth.uid() = id`
--
-- This breaks collaboration features because when viewing collaborators,
-- we need to fetch display_name, email, and profile_image of OTHER users.
--
-- Solution: Add a policy allowing authenticated users to SELECT basic profile
-- fields of any user. We DON'T expose sensitive fields like daily_message_count,
-- premium status, system_prompt, etc.
--
-- Note: We cannot restrict which columns are returned via RLS - that's done
-- at the application layer. The API should only select safe fields:
-- id, display_name, email, profile_image
-- ============================================================================

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own data" ON users;

-- Create new policy that allows:
-- 1. Users to view their own FULL data
-- 2. Any authenticated user to view basic profile info of other users
-- Note: Column restriction happens in application code (SELECT only safe fields)
CREATE POLICY "Users can view profiles"
  ON users FOR SELECT
  USING (
    -- Users can always view their own full profile
    auth.uid() = id
    OR
    -- Authenticated users can view any user's basic info
    -- (Application layer must restrict to: id, display_name, email, profile_image)
    auth.uid() IS NOT NULL
  );

-- ============================================================================
-- Security Notes:
-- ============================================================================
-- This policy is MORE permissive than before. While RLS cannot restrict columns,
-- the application code MUST only query safe fields for other users:
-- - id (UUID)
-- - display_name (TEXT)
-- - email (TEXT)
-- - profile_image (TEXT)
--
-- Fields that should NOT be exposed to other users:
-- - daily_message_count
-- - daily_reset
-- - message_count
-- - premium
-- - daily_pro_message_count
-- - daily_pro_reset
-- - system_prompt
-- - favorite_models
--
-- The getChatCollaborators() function in lib/collaboration/api.ts already
-- implements this correctly by selecting only safe fields.
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Users profile viewing policy updated for collaboration support';
  RAISE NOTICE 'Authenticated users can now view basic profile info of other users';
  RAISE NOTICE 'IMPORTANT: Application must restrict SELECT to safe fields only!';
END $$;
