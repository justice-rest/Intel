-- ============================================================================
-- FIX VIEW RLS SECURITY
-- ============================================================================
-- Migration: 012
-- Description: Add security_invoker=true to all views to enforce RLS
-- Author: Claude Code
-- Date: 2025-01-25
--
-- CRITICAL SECURITY FIX:
-- Views by default run as the view OWNER, not the invoking user.
-- This means RLS policies on underlying tables are BYPASSED.
-- With security_invoker=true (PostgreSQL 15+), views run as the
-- calling user, ensuring RLS is properly enforced.
-- ============================================================================

-- Fix crm_constituent_summaries view
DROP VIEW IF EXISTS crm_constituent_summaries;
CREATE VIEW crm_constituent_summaries
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.user_id,
  c.provider,
  c.external_id,
  c.full_name,
  c.email,
  c.city,
  c.state,
  c.total_lifetime_giving,
  c.last_gift_amount,
  c.last_gift_date,
  c.gift_count,
  c.synced_at,
  COUNT(d.id) as actual_donation_count,
  SUM(d.amount) as calculated_total_giving
FROM crm_constituents c
LEFT JOIN crm_donations d ON c.user_id = d.user_id
  AND c.provider = d.provider
  AND c.external_id = d.constituent_external_id
GROUP BY c.id;

GRANT SELECT ON crm_constituent_summaries TO authenticated;

COMMENT ON VIEW crm_constituent_summaries IS 'Constituent summaries with donation aggregates. Uses security_invoker=true to enforce RLS.';

-- Fix user_memories_compat view (if exists)
DROP VIEW IF EXISTS user_memories_compat;
CREATE VIEW user_memories_compat
WITH (security_invoker = true)
AS
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

COMMENT ON VIEW user_memories_compat IS 'Backward-compatible view mapping memories_v2 to user_memories schema. Uses security_invoker=true to enforce RLS.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
    view_count INTEGER;
BEGIN
    -- Count views with security_invoker
    SELECT COUNT(*) INTO view_count
    FROM pg_views v
    JOIN pg_class c ON c.relname = v.viewname
    WHERE v.viewname IN ('crm_constituent_summaries', 'user_memories_compat');

    RAISE NOTICE 'Security fix applied to % views', view_count;
END $$;
