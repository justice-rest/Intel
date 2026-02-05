-- Migration: Add Watchdogs Events Table
-- Persists classified news events for the Watchdogs dashboard
-- Enables historical analysis and cross-session persistence

-- Create enum types for event classification
DO $$ BEGIN
  CREATE TYPE event_category AS ENUM ('financial', 'geopolitical', 'natural', 'regulatory');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE event_severity AS ENUM ('critical', 'high', 'medium', 'low');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE classification_method AS ENUM ('grok', 'keywords');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Main watchdogs_events table
CREATE TABLE IF NOT EXISTS watchdogs_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User who triggered/viewed this event
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Raw article data
  article_id TEXT NOT NULL,
  article_title TEXT NOT NULL,
  article_description TEXT,
  article_url TEXT,
  article_source TEXT,
  article_published_at TIMESTAMPTZ,
  article_symbols TEXT[], -- Stock symbols mentioned

  -- Classification fields
  category event_category NOT NULL,
  severity event_severity NOT NULL,
  summary TEXT NOT NULL,
  impact_prediction TEXT,
  entities TEXT[] DEFAULT '{}',

  -- Location data (if geocoded)
  location_name TEXT,
  location_country_code TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,

  -- Metadata
  classified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  classified_by classification_method DEFAULT 'keywords',
  alert_generated BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate articles per user
  UNIQUE(user_id, article_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_watchdogs_events_user_id ON watchdogs_events(user_id);
CREATE INDEX IF NOT EXISTS idx_watchdogs_events_category ON watchdogs_events(category);
CREATE INDEX IF NOT EXISTS idx_watchdogs_events_severity ON watchdogs_events(severity);
CREATE INDEX IF NOT EXISTS idx_watchdogs_events_classified_at ON watchdogs_events(classified_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchdogs_events_user_classified ON watchdogs_events(user_id, classified_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchdogs_events_critical ON watchdogs_events(user_id, severity) WHERE severity = 'critical' AND NOT dismissed;

-- Enable RLS
ALTER TABLE watchdogs_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own events
CREATE POLICY "Users can view their own watchdogs events"
  ON watchdogs_events FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own events
CREATE POLICY "Users can insert their own watchdogs events"
  ON watchdogs_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own events (dismiss alerts)
CREATE POLICY "Users can update their own watchdogs events"
  ON watchdogs_events FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own events
CREATE POLICY "Users can delete their own watchdogs events"
  ON watchdogs_events FOR DELETE
  USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_watchdogs_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_watchdogs_events_updated_at ON watchdogs_events;
CREATE TRIGGER trigger_watchdogs_events_updated_at
  BEFORE UPDATE ON watchdogs_events
  FOR EACH ROW
  EXECUTE FUNCTION update_watchdogs_events_updated_at();

-- Function to clean up old events (run periodically)
-- Keeps last 7 days of events per user
CREATE OR REPLACE FUNCTION cleanup_old_watchdogs_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM watchdogs_events
  WHERE classified_at < now() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users for cleanup
GRANT EXECUTE ON FUNCTION cleanup_old_watchdogs_events() TO authenticated;

COMMENT ON TABLE watchdogs_events IS 'Stores classified news events from the Watchdogs real-time intelligence dashboard';
COMMENT ON COLUMN watchdogs_events.category IS 'Event category: financial, geopolitical, natural, or regulatory';
COMMENT ON COLUMN watchdogs_events.severity IS 'Event severity: critical, high, medium, or low';
COMMENT ON COLUMN watchdogs_events.classified_by IS 'How the event was classified: grok (AI) or keywords (fallback)';
