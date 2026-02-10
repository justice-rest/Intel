-- ============================================================================
-- Migration: 028_add_chat_scoped_knowledge.sql
-- Description: Add chat-scoped knowledge profiles support
-- Allows a knowledge profile to be scoped to a single chat conversation,
-- with configurable merge behavior (replace or merge with global profile).
-- ============================================================================

-- Add chat_scoped_to column (nullable FK to chats)
ALTER TABLE knowledge_profiles
  ADD COLUMN IF NOT EXISTS chat_scoped_to UUID REFERENCES chats(id) ON DELETE CASCADE;

-- Add merge_mode column with default 'replace' (how to combine with global profile)
ALTER TABLE knowledge_profiles
  ADD COLUMN IF NOT EXISTS merge_mode TEXT DEFAULT 'replace' CHECK (merge_mode IN ('replace', 'merge'));

-- Index for fast lookups of chat-scoped profiles
CREATE INDEX IF NOT EXISTS idx_knowledge_profiles_chat_scoped
  ON knowledge_profiles (chat_scoped_to)
  WHERE chat_scoped_to IS NOT NULL;

-- Enforce one active (non-deleted) scoped profile per chat
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_profiles_unique_chat_scoped
  ON knowledge_profiles (chat_scoped_to)
  WHERE chat_scoped_to IS NOT NULL AND deleted_at IS NULL;

-- Comment for documentation
COMMENT ON COLUMN knowledge_profiles.chat_scoped_to IS 'When set, this profile is scoped to a single chat and does not appear in global settings';
COMMENT ON COLUMN knowledge_profiles.merge_mode IS 'How to combine with global profile: replace (use only this) or merge (combine both)';
