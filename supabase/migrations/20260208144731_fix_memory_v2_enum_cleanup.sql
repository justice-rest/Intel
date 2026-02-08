-- ============================================================================
-- Migration: Complete V2 Enum and Function Cleanup
-- ============================================================================
-- Follow-up to 20260208144628 which dropped V2 tables but the enum drops
-- failed due to remaining function dependencies with different signatures.
-- Using CASCADE to automatically drop any dependent functions.
-- ============================================================================

-- Drop enums with CASCADE (removes any leftover V2 functions referencing them)
DROP TYPE IF EXISTS memory_tier CASCADE;
DROP TYPE IF EXISTS memory_kind CASCADE;
DROP TYPE IF EXISTS memory_relation CASCADE;
DROP TYPE IF EXISTS chunk_type CASCADE;

-- Drop any remaining V2 functions that don't depend on enums
DROP FUNCTION IF EXISTS apply_memory_decay();
DROP FUNCTION IF EXISTS get_user_memory_stats_v2(UUID);
DROP FUNCTION IF EXISTS kg_traverse(UUID, INT, TEXT[]);

-- Drop orphaned view if it survived
DROP VIEW IF EXISTS user_memories_compat;
