-- ============================================================================
-- Migration: 043_remove_personas.sql
-- Description: Remove the Persona system entirely
--
-- This migration removes:
-- 1. chats.persona_id column and its index
-- 2. personas table (with all indexes, triggers, RLS policies)
-- 3. persona_templates table (with all indexes, RLS policies)
-- 4. Helper functions (get_effective_chat_config, copy_persona_from_template)
--
-- IMPORTANT: Deploy the updated application code BEFORE or alongside this
-- migration. The code no longer references persona_id, so this is safe.
--
-- Preserved:
-- - chats.knowledge_profile_id (still used)
-- - chats.custom_system_prompt (still used)
-- ============================================================================

-- ============================================================================
-- 1. DROP HELPER FUNCTIONS
-- Must drop before tables since they reference persona columns
-- ============================================================================

DROP FUNCTION IF EXISTS get_effective_chat_config(UUID);
DROP FUNCTION IF EXISTS copy_persona_from_template(UUID, UUID, TEXT);

-- ============================================================================
-- 2. DROP chats.persona_id COLUMN
-- Must drop before personas table due to FK constraint
-- ============================================================================

-- Drop the index first
DROP INDEX IF EXISTS idx_chats_persona;

-- Drop the column (CASCADE handles the FK constraint)
ALTER TABLE chats DROP COLUMN IF EXISTS persona_id;

-- ============================================================================
-- 3. DROP PERSONAS TABLE
-- Includes all indexes, triggers, and RLS policies
-- ============================================================================

-- Drop trigger first
DROP TRIGGER IF EXISTS update_personas_updated_at ON personas;

-- Drop RLS policies
DROP POLICY IF EXISTS "Users manage own personas" ON personas;
DROP POLICY IF EXISTS "Service role manages personas" ON personas;

-- Drop indexes
DROP INDEX IF EXISTS idx_personas_unique_name_per_user;
DROP INDEX IF EXISTS idx_personas_default_per_user;
DROP INDEX IF EXISTS idx_personas_user_active;
DROP INDEX IF EXISTS idx_personas_knowledge_profile;

-- Drop the table
DROP TABLE IF EXISTS personas;

-- ============================================================================
-- 4. DROP PERSONA_TEMPLATES TABLE
-- ============================================================================

-- Drop RLS policies
DROP POLICY IF EXISTS "Authenticated users read templates" ON persona_templates;
DROP POLICY IF EXISTS "Service role manages templates" ON persona_templates;

-- Drop indexes
DROP INDEX IF EXISTS idx_persona_templates_category;

-- Drop the table
DROP TABLE IF EXISTS persona_templates;
