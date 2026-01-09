-- Rollback Migration 042: Remove Watchdogs Events System
-- This removes watchdogs_events table and related objects

-- 1. Drop trigger first
DROP TRIGGER IF EXISTS trigger_watchdogs_events_updated_at ON watchdogs_events;

-- 2. Drop functions
DROP FUNCTION IF EXISTS update_watchdogs_events_updated_at();
DROP FUNCTION IF EXISTS cleanup_old_watchdogs_events();

-- 3. Drop table (cascades indexes and RLS policies)
DROP TABLE IF EXISTS watchdogs_events CASCADE;

-- 4. Drop enum types (CASCADE to handle dependencies)
DROP TYPE IF EXISTS classification_method CASCADE;
DROP TYPE IF EXISTS event_severity CASCADE;
DROP TYPE IF EXISTS event_category CASCADE;
