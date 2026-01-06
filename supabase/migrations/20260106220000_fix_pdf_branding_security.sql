-- ============================================================================
-- PDF Branding Security Fixes
-- Migration: 20260106220000_fix_pdf_branding_security.sql
--
-- Fixes:
-- 1. Remove public storage policy (security vulnerability)
-- 2. Add database constraints for colors and footer text
-- 3. Add storage cleanup trigger on branding deletion
-- ============================================================================

-- ============================================================================
-- 1. Fix Storage Policy - Remove Public Access
-- ============================================================================

-- Remove the overly permissive public policy
DROP POLICY IF EXISTS "Public can view branding logos" ON storage.objects;

-- PDF generation happens server-side with service role credentials,
-- so we don't need public access. Users can only see their own logos.

-- ============================================================================
-- 2. Add Database Constraints
-- ============================================================================

-- Add CHECK constraint for hex color format on primary_color
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pdf_branding_primary_color_hex_check'
  ) THEN
    ALTER TABLE pdf_branding
    ADD CONSTRAINT pdf_branding_primary_color_hex_check
    CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;

-- Add CHECK constraint for hex color format on accent_color
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pdf_branding_accent_color_hex_check'
  ) THEN
    ALTER TABLE pdf_branding
    ADD CONSTRAINT pdf_branding_accent_color_hex_check
    CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;

-- Add CHECK constraint for footer text length (max 200 characters)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pdf_branding_footer_text_length_check'
  ) THEN
    ALTER TABLE pdf_branding
    ADD CONSTRAINT pdf_branding_footer_text_length_check
    CHECK (custom_footer_text IS NULL OR length(custom_footer_text) <= 200);
  END IF;
END $$;

-- ============================================================================
-- 3. Storage Cleanup Function and Trigger
-- ============================================================================

-- Function to clean up storage when branding is deleted
CREATE OR REPLACE FUNCTION cleanup_pdf_branding_storage()
RETURNS TRIGGER AS $$
BEGIN
  -- If there was a logo_url, we need to clean up storage
  -- Note: This runs with definer's permissions (superuser)
  -- The actual deletion from storage.objects requires service role,
  -- which should be configured in the application layer.
  -- This trigger logs what needs to be cleaned up.
  IF OLD.logo_url IS NOT NULL THEN
    -- Log the orphaned file for cleanup (actual cleanup by scheduled job)
    INSERT INTO storage.orphaned_files (bucket_id, path, created_at)
    SELECT
      'pdf-branding',
      substring(OLD.logo_url from '/pdf-branding/(.+)$'),
      NOW()
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN OLD;
EXCEPTION
  -- If orphaned_files table doesn't exist, just continue
  WHEN undefined_table THEN
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create orphaned files tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS storage.orphaned_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cleaned_at TIMESTAMPTZ,
  UNIQUE(bucket_id, path)
);

-- Create trigger for cleanup on delete
DROP TRIGGER IF EXISTS cleanup_pdf_branding_storage_trigger ON pdf_branding;
CREATE TRIGGER cleanup_pdf_branding_storage_trigger
BEFORE DELETE ON pdf_branding
FOR EACH ROW
EXECUTE FUNCTION cleanup_pdf_branding_storage();

-- ============================================================================
-- 4. Index for orphaned files cleanup job
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orphaned_files_unprocessed
ON storage.orphaned_files (created_at)
WHERE cleaned_at IS NULL;
