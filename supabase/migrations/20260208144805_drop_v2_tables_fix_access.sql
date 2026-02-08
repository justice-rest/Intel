-- ============================================================================
-- Migration: Drop V2 tables + Fix increment_memory_access
-- ============================================================================
-- The previous migration (20260208144628) rolled back due to enum dep error.
-- This migration completes the cleanup.
-- ============================================================================

-- 1. Fix increment_memory_access() to target user_memories (V1)
--    It was overwritten by migration 007 to target memories_v2 (0 rows).
CREATE OR REPLACE FUNCTION increment_memory_access(memory_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE user_memories
  SET
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = memory_id;
END;
$$;

COMMENT ON FUNCTION increment_memory_access IS 'Increments access count and updates last accessed timestamp for a user memory.';

-- 2. Drop empty V2 tables (CASCADE removes RLS policies, triggers, indexes)
DROP TABLE IF EXISTS rag_chunks_v2 CASCADE;
DROP TABLE IF EXISTS kg_relations CASCADE;
DROP TABLE IF EXISTS kg_entities CASCADE;
DROP TABLE IF EXISTS memory_relations CASCADE;
DROP TABLE IF EXISTS memories_v2 CASCADE;
