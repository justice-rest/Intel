-- Fix: Change unique constraint to partial index excluding soft-deleted profiles
-- The original UNIQUE(user_id, name, version) blocked creating profiles with
-- the same name as soft-deleted ones

-- Drop the existing constraint
ALTER TABLE knowledge_profiles
  DROP CONSTRAINT IF EXISTS knowledge_profiles_user_id_name_version_key;

-- Create a partial unique index that only applies to non-deleted records
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_profiles_unique_name_version
  ON knowledge_profiles(user_id, name, version)
  WHERE deleted_at IS NULL;
