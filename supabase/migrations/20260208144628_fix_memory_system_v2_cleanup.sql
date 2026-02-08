-- ============================================================================
-- Migration: Fix Memory System + V2 Cleanup
-- ============================================================================
-- 1. Restore increment_memory_access() to target user_memories (V1)
--    Migration 007 overwrote it to target memories_v2 which has 0 rows,
--    so access tracking has been silently broken.
-- 2. Drop empty V2 tables and their functions/enums/indexes.
--    V2 was never used in production — all code now uses V1 (user_memories).
-- ============================================================================

-- ============================================================================
-- 1. FIX: increment_memory_access() → target user_memories
-- ============================================================================

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

COMMENT ON FUNCTION increment_memory_access IS 'Increments access count and updates last accessed timestamp for a V1 user memory.';

-- ============================================================================
-- 2. DROP V2 enums with CASCADE (takes out dependent functions automatically)
--    This is safe because only V2 functions/tables use these enums.
-- ============================================================================

DROP TYPE IF EXISTS memory_tier CASCADE;
DROP TYPE IF EXISTS memory_kind CASCADE;
DROP TYPE IF EXISTS memory_relation CASCADE;
DROP TYPE IF EXISTS chunk_type CASCADE;

-- ============================================================================
-- 3. DROP remaining V2 functions that don't depend on enums
-- ============================================================================

DROP FUNCTION IF EXISTS apply_memory_decay();
DROP FUNCTION IF EXISTS get_user_memory_stats_v2(UUID);
DROP FUNCTION IF EXISTS kg_traverse(UUID, INT, TEXT[]);

-- ============================================================================
-- 4. DROP V2 tables (cascade drops RLS policies, triggers, indexes)
-- ============================================================================

DROP TABLE IF EXISTS rag_chunks_v2 CASCADE;
DROP TABLE IF EXISTS kg_relations CASCADE;
DROP TABLE IF EXISTS kg_entities CASCADE;
DROP TABLE IF EXISTS memory_relations CASCADE;
DROP TABLE IF EXISTS memories_v2 CASCADE;

-- ============================================================================
-- END
-- ============================================================================
