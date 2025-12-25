-- ============================================================================
-- MIGRATE USER_MEMORIES TO MEMORIES_V2
-- ============================================================================
-- Migration: 008
-- Description: Migrate existing memories from user_memories to memories_v2
-- Author: Claude Code
-- Date: 2025-01-25
-- ============================================================================

-- Step 1: Migrate existing memories to V2 table
INSERT INTO memories_v2 (
    id,
    user_id,
    content,
    memory_tier,
    memory_kind,
    is_static,
    version,
    is_latest,
    is_forgotten,
    source_count,
    is_inference,
    source_chat_id,
    source_message_id,
    importance_score,
    access_count,
    access_velocity,
    embedding,
    metadata,
    tags,
    created_at,
    updated_at
)
SELECT
    um.id,
    um.user_id,
    um.content,
    -- Assign tier based on importance and access
    CASE
        WHEN um.importance_score >= 0.8 OR um.access_count >= 5 THEN 'hot'::memory_tier
        WHEN um.importance_score >= 0.5 OR um.access_count >= 2 THEN 'warm'::memory_tier
        ELSE 'cold'::memory_tier
    END,
    -- Map memory_type to memory_kind
    CASE
        WHEN um.memory_type = 'explicit' THEN 'profile'::memory_kind
        WHEN um.metadata->>'category' = 'user_info' THEN 'profile'::memory_kind
        WHEN um.metadata->>'category' = 'preferences' THEN 'semantic'::memory_kind
        WHEN um.metadata->>'category' = 'context' THEN 'episodic'::memory_kind
        ELSE 'semantic'::memory_kind
    END,
    -- Static flag: high importance explicit memories are static
    (um.memory_type = 'explicit' AND um.importance_score >= 0.8),
    1, -- version
    true, -- is_latest
    false, -- is_forgotten
    1, -- source_count
    (um.memory_type != 'explicit'), -- is_inference (auto-extracted = inference)
    (um.metadata->>'source_chat_id')::UUID,
    (um.metadata->>'source_message_id')::INTEGER,
    um.importance_score,
    um.access_count,
    -- Calculate access velocity (accesses per day since creation)
    CASE
        WHEN um.created_at < NOW() - INTERVAL '1 day' THEN
            um.access_count::FLOAT / GREATEST(1, EXTRACT(EPOCH FROM (NOW() - um.created_at)) / 86400)
        ELSE um.access_count::FLOAT
    END,
    um.embedding,
    um.metadata,
    COALESCE((um.metadata->>'tags')::TEXT[], ARRAY[]::TEXT[]),
    um.created_at,
    COALESCE(um.updated_at, um.created_at)
FROM user_memories um
WHERE NOT EXISTS (
    -- Skip if already migrated
    SELECT 1 FROM memories_v2 m2 WHERE m2.id = um.id
);

-- Step 2: Log migration results
DO $$
DECLARE
    v1_count INTEGER;
    v2_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v1_count FROM user_memories;
    SELECT COUNT(*) INTO v2_count FROM memories_v2;

    RAISE NOTICE 'Migration complete: % memories in V1, % memories in V2', v1_count, v2_count;
END $$;

-- Step 3: Create view for backward compatibility (optional)
CREATE OR REPLACE VIEW user_memories_compat AS
SELECT
    id,
    user_id,
    content,
    CASE
        WHEN is_static THEN 'explicit'
        ELSE 'auto'
    END AS memory_type,
    importance_score,
    metadata,
    embedding,
    access_count,
    updated_at AS last_accessed_at,
    created_at,
    updated_at
FROM memories_v2
WHERE is_latest = true AND is_forgotten = false;

COMMENT ON VIEW user_memories_compat IS 'Backward-compatible view mapping memories_v2 to user_memories schema';

-- Step 4: Update RLS policies for memories_v2 (if not already set)
ALTER TABLE memories_v2 ENABLE ROW LEVEL SECURITY;

-- Users can only see their own memories
DROP POLICY IF EXISTS "Users can view own memories" ON memories_v2;
CREATE POLICY "Users can view own memories" ON memories_v2
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own memories
DROP POLICY IF EXISTS "Users can insert own memories" ON memories_v2;
CREATE POLICY "Users can insert own memories" ON memories_v2
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own memories
DROP POLICY IF EXISTS "Users can update own memories" ON memories_v2;
CREATE POLICY "Users can update own memories" ON memories_v2
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own memories
DROP POLICY IF EXISTS "Users can delete own memories" ON memories_v2;
CREATE POLICY "Users can delete own memories" ON memories_v2
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- DONE
-- ============================================================================
-- After running this migration:
-- 1. All existing memories are copied to memories_v2 with proper tier/kind mapping
-- 2. A compatibility view (user_memories_compat) maintains V1 API compatibility
-- 3. RLS policies ensure users can only access their own memories
-- 4. Original user_memories table is preserved (can be dropped later)
