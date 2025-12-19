-- Add verification columns to messages table
-- Used for Perplexity Sonar response verification
--
-- IMPORTANT: After running this migration, you must enable Supabase Realtime
-- for the messages table to allow real-time verification status updates:
--
-- 1. Go to Supabase Dashboard > Database > Replication
-- 2. Find the "messages" table and enable it for Realtime
-- OR run: ALTER PUBLICATION supabase_realtime ADD TABLE messages;

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verifying BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_result JSONB,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Create index for verified queries
CREATE INDEX IF NOT EXISTS idx_messages_verified ON messages(verified) WHERE verified = true;
CREATE INDEX IF NOT EXISTS idx_messages_verifying ON messages(verifying) WHERE verifying = true;

-- Comments on columns
COMMENT ON COLUMN messages.verified IS 'Whether this message has been verified by Perplexity Sonar';
COMMENT ON COLUMN messages.verifying IS 'Whether verification is currently in progress';
COMMENT ON COLUMN messages.verification_result IS 'JSON containing verification details: corrections, gapsFilled, confidenceScore, sources';
COMMENT ON COLUMN messages.verified_at IS 'Timestamp when verification completed';

-- Enable Realtime for messages table (required for verification status updates)
-- Note: This may already be enabled. If you get an error, you can ignore it.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'messages table already in supabase_realtime publication';
END $$;
