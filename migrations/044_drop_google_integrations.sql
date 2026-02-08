-- ============================================================================
-- Migration: 044_drop_google_integrations.sql
-- Description: Drop all Google Gmail/Drive integration tables, views, triggers
-- Reason: Google Workspace integration (Gmail, Drive) has been removed from the app.
--         All application code referencing these tables has been deleted.
--         Tables have ON DELETE CASCADE from users(id), so they're already empty
--         for any deleted users. This migration cleans up the schema.
-- ============================================================================

-- Drop the view first (depends on tables)
DROP VIEW IF EXISTS google_integration_status;

-- Drop triggers
DROP TRIGGER IF EXISTS google_oauth_tokens_updated_at ON google_oauth_tokens;
DROP TRIGGER IF EXISTS google_drive_documents_updated_at ON google_drive_documents;
DROP TRIGGER IF EXISTS user_writing_style_updated_at ON user_writing_style;

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_google_integration_updated_at();

-- Drop tables (CASCADE drops indexes, policies, constraints automatically)
DROP TABLE IF EXISTS google_integration_audit_log CASCADE;
DROP TABLE IF EXISTS gmail_drafts CASCADE;
DROP TABLE IF EXISTS google_drive_documents CASCADE;
DROP TABLE IF EXISTS user_writing_style CASCADE;
DROP TABLE IF EXISTS google_oauth_tokens CASCADE;
