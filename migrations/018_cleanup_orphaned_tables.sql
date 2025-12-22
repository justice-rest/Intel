-- ============================================================================
-- Migration 018: Cleanup Orphaned Tables
-- ============================================================================
-- Purpose: Remove tables that were created for tools that have been deleted
--
-- Tables being dropped:
-- 1. property_valuation_cache - Created for property_valuation tool (deleted Dec 21, 2025)
-- 2. hedonic_coefficients - Created for AVM property valuation (tool deleted)
--
-- These tables have zero active code references and can be safely dropped.
-- ============================================================================

-- Drop property valuation cache table
-- This table was created for caching AVM property valuations
-- The property_valuation tool was deleted, so this table is orphaned
DROP TABLE IF EXISTS property_valuation_cache;

-- Drop hedonic coefficients table
-- This table stored market-specific pricing coefficients for the AVM
-- Only referenced by lib/avm/coefficients.ts which is also being deleted
DROP TABLE IF EXISTS hedonic_coefficients;

-- ============================================================================
-- Verification query (run manually to confirm tables are gone):
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN ('property_valuation_cache', 'hedonic_coefficients');
-- ============================================================================
