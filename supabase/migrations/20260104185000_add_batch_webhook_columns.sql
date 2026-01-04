-- Migration: Add webhook columns to batch_prospect_jobs
-- This enables batch completion webhooks for integration with external systems

-- Add webhook configuration columns
ALTER TABLE batch_prospect_jobs
ADD COLUMN IF NOT EXISTS webhook_url TEXT,
ADD COLUMN IF NOT EXISTS webhook_secret TEXT,
ADD COLUMN IF NOT EXISTS last_webhook_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS webhook_error TEXT;

-- Add index for jobs with webhooks (for monitoring/debugging)
CREATE INDEX IF NOT EXISTS idx_batch_jobs_webhook_url
ON batch_prospect_jobs (webhook_url)
WHERE webhook_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN batch_prospect_jobs.webhook_url IS 'URL to receive POST notification when batch completes';
COMMENT ON COLUMN batch_prospect_jobs.webhook_secret IS 'HMAC secret for webhook signature verification';
COMMENT ON COLUMN batch_prospect_jobs.last_webhook_sent_at IS 'Timestamp of last successful webhook delivery';
COMMENT ON COLUMN batch_prospect_jobs.webhook_error IS 'Error message from last failed webhook attempt';
