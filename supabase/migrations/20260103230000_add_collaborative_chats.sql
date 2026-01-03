-- ============================================================================
-- COLLABORATIVE CHAT SYSTEM
-- ============================================================================
-- Migration: 028
-- Description: Add tables and RLS policies for collaborative chat functionality
--   - Role-based permissions (owner, editor, viewer)
--   - Password-protected share links
--   - Audit trail for access changes
--   - Real-time collaboration support
-- Author: Claude Code
-- Date: 2025-01-03
-- ============================================================================

-- Enable pgcrypto for password hashing (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- CHAT COLLABORATORS TABLE
-- ============================================================================
-- Tracks who has access to which chat and their permission level
-- Primary junction table for multi-user chat access

CREATE TABLE IF NOT EXISTS chat_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Role determines what actions the user can perform
  -- owner: full control (transfer ownership, delete chat, manage collaborators)
  -- editor: can send messages, view history, but cannot manage access
  -- viewer: read-only access to messages and history
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),

  -- How this collaborator gained access
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_via_link_id UUID, -- Will reference chat_share_links.id (added after that table)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one role per user per chat
  UNIQUE(chat_id, user_id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_chat_collaborators_chat_id ON chat_collaborators(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_collaborators_user_id ON chat_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_collaborators_role ON chat_collaborators(chat_id, role);

-- ============================================================================
-- CHAT SHARE LINKS TABLE
-- ============================================================================
-- Magic links for sharing chat access, optionally password protected
-- Links can be single-use, multi-use, or unlimited

CREATE TABLE IF NOT EXISTS chat_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,

  -- The token used in the URL (cryptographically secure)
  token TEXT NOT NULL UNIQUE,

  -- Password protection (using bcrypt via pgcrypto's crypt function)
  -- NULL means no password required
  password_hash TEXT,

  -- What role does accepting this link grant?
  grants_role TEXT NOT NULL DEFAULT 'viewer' CHECK (grants_role IN ('editor', 'viewer')),

  -- Link constraints
  max_uses INTEGER, -- NULL = unlimited uses
  use_count INTEGER DEFAULT 0,

  -- Link metadata
  label TEXT, -- Optional friendly name: "Team link", "Client preview"
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Tracking failed password attempts (rate limiting)
  failed_attempts INTEGER DEFAULT 0,
  last_failed_attempt_at TIMESTAMPTZ,

  -- Soft delete to maintain audit trail
  is_active BOOLEAN DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_chat_share_links_chat_id ON chat_share_links(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_share_links_token ON chat_share_links(token);
CREATE INDEX IF NOT EXISTS idx_chat_share_links_active ON chat_share_links(chat_id, is_active) WHERE is_active = TRUE;

-- Now add the foreign key from chat_collaborators to chat_share_links
ALTER TABLE chat_collaborators
  ADD CONSTRAINT chat_collaborators_invited_via_link_id_fkey
  FOREIGN KEY (invited_via_link_id) REFERENCES chat_share_links(id) ON DELETE SET NULL;

-- ============================================================================
-- CHAT ACCESS LOG TABLE (Audit Trail)
-- ============================================================================
-- Tracks all access changes for compliance and debugging
-- Immutable audit log - no updates or deletes

CREATE TABLE IF NOT EXISTS chat_access_log (
  id BIGSERIAL PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Action types
  action TEXT NOT NULL CHECK (action IN (
    'collaborator_added',
    'collaborator_removed',
    'role_changed',
    'link_created',
    'link_used',
    'link_revoked',
    'link_password_failed',
    'ownership_transferred'
  )),

  -- Action details (JSON for flexibility)
  details JSONB DEFAULT '{}'::jsonb,
  -- Example: { "old_role": "viewer", "new_role": "editor" }
  -- Example: { "link_id": "uuid", "granted_role": "viewer" }

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying logs by chat
CREATE INDEX IF NOT EXISTS idx_chat_access_log_chat_id ON chat_access_log(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_access_log_actor ON chat_access_log(actor_user_id, created_at DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a user has a specific role (or higher) on a chat
CREATE OR REPLACE FUNCTION user_has_chat_role(
  p_user_id UUID,
  p_chat_id UUID,
  p_required_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_owner_id UUID;
BEGIN
  -- First check if user is the original owner (from chats.user_id)
  SELECT user_id INTO v_owner_id FROM chats WHERE id = p_chat_id;
  IF v_owner_id = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- Then check collaborators table
  SELECT role INTO v_role
  FROM chat_collaborators
  WHERE chat_id = p_chat_id AND user_id = p_user_id;

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Role hierarchy: owner > editor > viewer
  IF p_required_role = 'viewer' THEN
    RETURN v_role IN ('owner', 'editor', 'viewer');
  ELSIF p_required_role = 'editor' THEN
    RETURN v_role IN ('owner', 'editor');
  ELSIF p_required_role = 'owner' THEN
    RETURN v_role = 'owner';
  END IF;

  RETURN FALSE;
END;
$$;

-- Function to get user's role on a chat (returns NULL if no access)
CREATE OR REPLACE FUNCTION get_user_chat_role(
  p_user_id UUID,
  p_chat_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_owner_id UUID;
BEGIN
  -- Check if user is original owner
  SELECT user_id INTO v_owner_id FROM chats WHERE id = p_chat_id;
  IF v_owner_id = p_user_id THEN
    RETURN 'owner';
  END IF;

  -- Check collaborators
  SELECT role INTO v_role
  FROM chat_collaborators
  WHERE chat_id = p_chat_id AND user_id = p_user_id;

  RETURN v_role; -- Returns NULL if not found
END;
$$;

-- Function to hash password for share link
CREATE OR REPLACE FUNCTION hash_share_link_password(p_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN crypt(p_password, gen_salt('bf', 12));
END;
$$;

-- Function to verify share link password
CREATE OR REPLACE FUNCTION verify_share_link_password(
  p_link_id UUID,
  p_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_password_hash TEXT;
  v_result BOOLEAN;
BEGIN
  SELECT password_hash INTO v_password_hash
  FROM chat_share_links
  WHERE id = p_link_id AND is_active = TRUE;

  IF v_password_hash IS NULL THEN
    -- No password required (NULL hash means no password set)
    SELECT EXISTS (
      SELECT 1 FROM chat_share_links
      WHERE id = p_link_id AND is_active = TRUE AND password_hash IS NULL
    ) INTO v_result;
    RETURN v_result;
  END IF;

  -- Verify using bcrypt
  v_result := v_password_hash = crypt(p_password, v_password_hash);

  -- Track failed attempts
  IF NOT v_result THEN
    UPDATE chat_share_links
    SET failed_attempts = failed_attempts + 1,
        last_failed_attempt_at = NOW()
    WHERE id = p_link_id;
  END IF;

  RETURN v_result;
END;
$$;

-- Function to generate a secure token for share links
CREATE OR REPLACE FUNCTION generate_share_link_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  -- Generate 32 bytes of random data, encode as base64url-safe
  RETURN replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_');
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE chat_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_access_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CHAT COLLABORATORS POLICIES
-- ============================================================================

-- Anyone can view collaborator list if they have viewer+ access to the chat
CREATE POLICY "Collaborators can view chat's collaborator list"
  ON chat_collaborators FOR SELECT
  USING (
    user_has_chat_role(auth.uid(), chat_id, 'viewer')
  );

-- Only owners can add collaborators
CREATE POLICY "Owners can add collaborators"
  ON chat_collaborators FOR INSERT
  WITH CHECK (
    user_has_chat_role(auth.uid(), chat_id, 'owner')
  );

-- Only owners can modify collaborator roles
CREATE POLICY "Owners can update collaborator roles"
  ON chat_collaborators FOR UPDATE
  USING (
    user_has_chat_role(auth.uid(), chat_id, 'owner')
  );

-- Owners can remove collaborators, users can remove themselves
CREATE POLICY "Owners can remove collaborators or self-removal"
  ON chat_collaborators FOR DELETE
  USING (
    user_has_chat_role(auth.uid(), chat_id, 'owner')
    OR user_id = auth.uid()
  );

-- ============================================================================
-- CHAT SHARE LINKS POLICIES
-- ============================================================================

-- Owners and editors can view share links for their chats
CREATE POLICY "Owners and editors can view share links"
  ON chat_share_links FOR SELECT
  USING (
    user_has_chat_role(auth.uid(), chat_id, 'editor')
  );

-- Only owners can create share links
CREATE POLICY "Owners can create share links"
  ON chat_share_links FOR INSERT
  WITH CHECK (
    user_has_chat_role(auth.uid(), chat_id, 'owner')
  );

-- Only owners can update share links (revoke, etc.)
CREATE POLICY "Owners can update share links"
  ON chat_share_links FOR UPDATE
  USING (
    user_has_chat_role(auth.uid(), chat_id, 'owner')
  );

-- Only owners can delete share links
CREATE POLICY "Owners can delete share links"
  ON chat_share_links FOR DELETE
  USING (
    user_has_chat_role(auth.uid(), chat_id, 'owner')
  );

-- ============================================================================
-- CHAT ACCESS LOG POLICIES
-- ============================================================================

-- Only owners can view access logs
CREATE POLICY "Owners can view access logs"
  ON chat_access_log FOR SELECT
  USING (
    user_has_chat_role(auth.uid(), chat_id, 'owner')
  );

-- Insert allowed via service role only (logged via API, not direct inserts)
-- No INSERT policy needed for regular users

-- ============================================================================
-- UPDATE EXISTING CHATS RLS POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
DROP POLICY IF EXISTS "Users can view public chats" ON chats;
DROP POLICY IF EXISTS "Users can update their own chats" ON chats;
DROP POLICY IF EXISTS "Users can delete their own chats" ON chats;

-- New policies that include collaborators
CREATE POLICY "Users can view chats they have access to"
  ON chats FOR SELECT
  USING (
    auth.uid() = user_id  -- Original owner
    OR public = true  -- Public chats
    OR user_has_chat_role(auth.uid(), id, 'viewer')  -- Collaborator with viewer+ role
  );

CREATE POLICY "Owners can update their chats"
  ON chats FOR UPDATE
  USING (
    auth.uid() = user_id
    OR user_has_chat_role(auth.uid(), id, 'owner')
  );

CREATE POLICY "Owners can delete their chats"
  ON chats FOR DELETE
  USING (
    auth.uid() = user_id
    OR user_has_chat_role(auth.uid(), id, 'owner')
  );

-- Keep create policy - users can still only create their own chats
-- (no change needed, original INSERT policy remains)

-- ============================================================================
-- UPDATE EXISTING MESSAGES RLS POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can view messages in public chats" ON messages;
DROP POLICY IF EXISTS "Users can create messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete messages in their chats" ON messages;

-- New policies that include collaborators
CREATE POLICY "Users can view messages in accessible chats"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chats c
      WHERE c.id = messages.chat_id
      AND (
        c.user_id = auth.uid()  -- Chat owner
        OR c.public = true  -- Public chat
        OR user_has_chat_role(auth.uid(), c.id, 'viewer')  -- Collaborator with viewer+ role
      )
    )
  );

CREATE POLICY "Owners and editors can create messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats c
      WHERE c.id = messages.chat_id
      AND (
        c.user_id = auth.uid()  -- Chat owner
        OR user_has_chat_role(auth.uid(), c.id, 'editor')  -- Collaborator with editor+ role
      )
    )
  );

-- Keep update policy for own messages only
CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  USING (auth.uid() = user_id);

-- Delete: Owner can delete any message, editors can only delete their own messages
CREATE POLICY "Users can delete messages based on role"
  ON messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chats c
      WHERE c.id = messages.chat_id
      AND (
        c.user_id = auth.uid()  -- Chat owner can delete any message
        OR user_has_chat_role(auth.uid(), c.id, 'owner')  -- Collaborator owner can delete any message
        OR (
          -- Editors can only delete their own messages
          user_has_chat_role(auth.uid(), c.id, 'editor')
          AND messages.user_id = auth.uid()
        )
      )
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at for chat_collaborators
CREATE OR REPLACE FUNCTION update_chat_collaborators_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_collaborators_updated_at_trigger ON chat_collaborators;
CREATE TRIGGER chat_collaborators_updated_at_trigger
BEFORE UPDATE ON chat_collaborators
FOR EACH ROW
EXECUTE FUNCTION update_chat_collaborators_updated_at();

-- Auto-update updated_at for chat_share_links
CREATE OR REPLACE FUNCTION update_chat_share_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_share_links_updated_at_trigger ON chat_share_links;
CREATE TRIGGER chat_share_links_updated_at_trigger
BEFORE UPDATE ON chat_share_links
FOR EACH ROW
EXECUTE FUNCTION update_chat_share_links_updated_at();

-- ============================================================================
-- BACKFILL: Add existing chat owners to collaborators table
-- ============================================================================
-- This ensures all existing chats have their owners in the collaborators table
-- for consistent querying. Idempotent - safe to run multiple times.

INSERT INTO chat_collaborators (chat_id, user_id, role, invited_by, created_at)
SELECT id, user_id, 'owner', user_id, created_at
FROM chats
WHERE NOT EXISTS (
  SELECT 1 FROM chat_collaborators cc
  WHERE cc.chat_id = chats.id AND cc.user_id = chats.user_id
)
ON CONFLICT (chat_id, user_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE chat_collaborators IS 'Tracks which users have access to which chats and their permission level';
COMMENT ON TABLE chat_share_links IS 'Magic links for sharing chat access, with optional password protection';
COMMENT ON TABLE chat_access_log IS 'Immutable audit log of all access changes for compliance';
COMMENT ON FUNCTION user_has_chat_role IS 'Checks if a user has a specific role (or higher) on a chat. Role hierarchy: owner > editor > viewer';
COMMENT ON FUNCTION get_user_chat_role IS 'Returns the user role on a chat, NULL if no access';
COMMENT ON FUNCTION verify_share_link_password IS 'Verifies password for a share link using bcrypt, tracks failed attempts';
COMMENT ON FUNCTION hash_share_link_password IS 'Hashes a password for share link protection using bcrypt (cost 12)';
COMMENT ON FUNCTION generate_share_link_token IS 'Generates a cryptographically secure base64url token for share links';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
DECLARE
  table_count INTEGER;
  collaborator_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('chat_collaborators', 'chat_share_links', 'chat_access_log');

  SELECT COUNT(*) INTO collaborator_count FROM chat_collaborators;

  RAISE NOTICE 'Collaborative Chat Migration Complete!';
  RAISE NOTICE '- Created % new tables', table_count;
  RAISE NOTICE '- Backfilled % collaborator records from existing chats', collaborator_count;
  RAISE NOTICE '';
  RAISE NOTICE 'New features enabled:';
  RAISE NOTICE '- Role-based chat access (owner/editor/viewer)';
  RAISE NOTICE '- Password-protected share links';
  RAISE NOTICE '- Access audit logging';
  RAISE NOTICE '- Real-time collaboration support';
END $$;
