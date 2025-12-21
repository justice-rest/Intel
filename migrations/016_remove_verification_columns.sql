-- Migration: Remove verification columns from messages table
-- These columns were used for Perplexity Sonar Pro fact-checking, which has been removed.
-- Now using Perplexity Sonar Reasoning as the primary model with built-in citations.

ALTER TABLE messages DROP COLUMN IF EXISTS verified;
ALTER TABLE messages DROP COLUMN IF EXISTS verifying;
ALTER TABLE messages DROP COLUMN IF EXISTS verification_result;
ALTER TABLE messages DROP COLUMN IF EXISTS verified_at;
