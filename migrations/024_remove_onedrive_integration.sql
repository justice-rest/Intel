-- ============================================================================
-- Migration: 024_remove_onedrive_integration.sql
-- Description: Remove OneDrive integration tables and related objects
-- Safe to run even if tables don't exist
-- ============================================================================

-- Drop OneDrive-specific view (if exists)
DROP VIEW IF EXISTS onedrive_integration_status;

-- Drop OneDrive tables (if exist)
DROP TABLE IF EXISTS onedrive_documents;
DROP TABLE IF EXISTS onedrive_oauth_tokens;

-- Update cloud_integration_audit_log only if it exists
DO $$
BEGIN
  -- Only proceed if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cloud_integration_audit_log') THEN
    -- Drop old constraint if exists
    ALTER TABLE cloud_integration_audit_log
      DROP CONSTRAINT IF EXISTS cloud_integration_audit_log_provider_check;

    -- Add updated constraint without 'onedrive'
    ALTER TABLE cloud_integration_audit_log
      ADD CONSTRAINT cloud_integration_audit_log_provider_check
      CHECK (provider IN ('notion', 'google'));

    -- Clean up OneDrive entries
    DELETE FROM cloud_integration_audit_log WHERE provider = 'onedrive';

    -- Update comment
    COMMENT ON TABLE cloud_integration_audit_log IS 'Shared audit log for cloud integrations (Notion, Google) for compliance and debugging.';
  END IF;
END $$;
