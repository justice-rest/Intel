-- ============================================================================
-- MIGRATION: Remove Collaborative Chat Feature
-- ============================================================================
-- This migration completely removes the collaborative chat functionality
-- including all related tables, functions, RLS policies, and realtime config.
--
-- The public share feature (/share/[chatId]) is PRESERVED - it uses a
-- different system (the 'public' column on chats table).
-- ============================================================================

-- ============================================================================
-- 1. DROP TABLES (in dependency order - children first)
-- ============================================================================

-- Drop message reactions (depends on messages)
DROP TABLE IF EXISTS message_reactions CASCADE;

-- Drop read receipts
DROP TABLE IF EXISTS chat_read_receipts CASCADE;

-- Drop access log (audit trail)
DROP TABLE IF EXISTS chat_access_log CASCADE;

-- Drop share links
DROP TABLE IF EXISTS chat_share_links CASCADE;

-- Drop collaborators (main junction table)
DROP TABLE IF EXISTS chat_collaborators CASCADE;

-- ============================================================================
-- 2. DROP FUNCTIONS
-- ============================================================================

-- Unread counts function
DROP FUNCTION IF EXISTS get_user_unread_counts(UUID);

-- Read receipts functions
DROP FUNCTION IF EXISTS mark_messages_read(UUID, UUID, BIGINT);
DROP FUNCTION IF EXISTS get_message_readers(UUID, BIGINT);

-- Share link functions
DROP FUNCTION IF EXISTS generate_share_link_token();
DROP FUNCTION IF EXISTS verify_share_link_password(UUID, TEXT);
DROP FUNCTION IF EXISTS hash_share_link_password(TEXT);

-- Role check functions
DROP FUNCTION IF EXISTS get_user_chat_role(UUID, UUID);
DROP FUNCTION IF EXISTS user_has_chat_role(UUID, UUID, TEXT);

-- Accessible chats functions (added for collaboration)
DROP FUNCTION IF EXISTS get_user_accessible_chats(UUID);
DROP FUNCTION IF EXISTS get_chat_if_accessible(UUID, UUID);

-- ============================================================================
-- 3. RESTORE ORIGINAL RLS POLICIES FOR CHATS TABLE
-- ============================================================================

-- Drop collaboration-aware policies (if they exist)
DROP POLICY IF EXISTS "Users can view chats they have access to" ON chats;
DROP POLICY IF EXISTS "Owners can update their chats" ON chats;
DROP POLICY IF EXISTS "Owners can delete their chats" ON chats;

-- Also drop any old policies that might conflict
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
DROP POLICY IF EXISTS "Users can update their own chats" ON chats;
DROP POLICY IF EXISTS "Users can delete their own chats" ON chats;

-- Recreate simple owner-based policies
CREATE POLICY "Users can view their own chats" ON chats
  FOR SELECT USING (auth.uid() = user_id OR public = true);

CREATE POLICY "Users can update their own chats" ON chats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chats" ON chats
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 4. RESTORE ORIGINAL RLS POLICIES FOR MESSAGES TABLE
-- ============================================================================

-- Drop collaboration-aware policies (if they exist)
DROP POLICY IF EXISTS "Users can view messages in accessible chats" ON messages;
DROP POLICY IF EXISTS "Owners and editors can create messages" ON messages;
DROP POLICY IF EXISTS "Users can delete messages based on role" ON messages;

-- Also drop any old policies that might conflict
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can create messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can delete messages in their chats" ON messages;

-- Recreate simple owner-based policies
CREATE POLICY "Users can view messages in their chats" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND (chats.user_id = auth.uid() OR chats.public = true)
    )
  );

CREATE POLICY "Users can create messages in their chats" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages in their chats" ON messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND chats.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. RESTORE ORIGINAL RLS POLICY FOR USERS TABLE
-- ============================================================================

-- Drop the overly permissive policy added for collaboration (migration 031)
DROP POLICY IF EXISTS "Users can view profiles" ON users;

-- Also drop any old policy that might conflict
DROP POLICY IF EXISTS "Users can view their own data" ON users;

-- Restore original policy - users can only view their own data
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- ============================================================================
-- 6. COMPLETION NOTICE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Collaborative Chat Feature Removed';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Dropped tables: message_reactions, chat_read_receipts, chat_access_log, chat_share_links, chat_collaborators';
  RAISE NOTICE 'Dropped functions: get_user_unread_counts, mark_messages_read, get_message_readers, generate_share_link_token, verify_share_link_password, hash_share_link_password, get_user_chat_role, user_has_chat_role, get_user_accessible_chats, get_chat_if_accessible';
  RAISE NOTICE 'Restored simple RLS policies for chats, messages, and users tables';
  RAISE NOTICE 'Public share feature (/share/[chatId]) is PRESERVED';
  RAISE NOTICE '============================================';
END $$;
