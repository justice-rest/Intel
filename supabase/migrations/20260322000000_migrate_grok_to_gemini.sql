-- Migration: Migrate all Grok model references to Gemini 3 Flash Preview
-- Date: 2026-03-22
-- Reason: Grok 4.1 Fast has been replaced by Gemini 3 Flash Preview as the default model.
--         Existing chats and messages still reference Grok model IDs and need to be updated.

-- ============================================================================
-- STEP 1: Migrate chat default models
-- ============================================================================

-- Migrate chats using Grok 4.1 Fast
UPDATE chats
SET model = 'openrouter:google/gemini-3-flash-preview'
WHERE model = 'openrouter:x-ai/grok-4.1-fast';

-- Migrate chats using Grok 4.1 Fast (Thinking)
UPDATE chats
SET model = 'openrouter:google/gemini-3-flash-preview'
WHERE model = 'openrouter:x-ai/grok-4.1-fast-thinking';

-- Migrate chats using legacy Grok 4 Fast (without dot notation)
UPDATE chats
SET model = 'openrouter:google/gemini-3-flash-preview'
WHERE model = 'openrouter:x-ai/grok-4-fast';

-- Migrate chats still on Perplexity (legacy)
UPDATE chats
SET model = 'openrouter:google/gemini-3-flash-preview'
WHERE model IN (
  'openrouter:perplexity/sonar-reasoning',
  'openrouter:perplexity/sonar-reasoning-pro',
  'openrouter:perplexity/sonar-deep-research'
);

-- Migrate chats using Gemini 3 Pro Preview (deprecated)
UPDATE chats
SET model = 'openrouter:google/gemini-3-flash-preview'
WHERE model = 'openrouter:google/gemini-3-pro-preview';

-- ============================================================================
-- STEP 2: Migrate message-level model references
-- Messages store which model generated them. Update for consistency,
-- but only for the chat-level default model field. Historical message
-- model attribution is kept as-is for audit trail purposes.
-- ============================================================================

-- Note: We intentionally do NOT update messages.model.
-- The model field on messages is a historical record of which model actually
-- generated that response. Rewriting history would be misleading.
-- The normalizeModelId() function in the application layer handles
-- display normalization for the UI.

-- ============================================================================
-- STEP 3: Migrate user favorite models
-- ============================================================================

-- Update user_preferences where favorite_models array contains Grok references
-- This uses PostgreSQL array operations to replace elements
UPDATE user_preferences
SET favorite_models = array_replace(favorite_models, 'openrouter:x-ai/grok-4.1-fast', 'openrouter:google/gemini-3-flash-preview')
WHERE 'openrouter:x-ai/grok-4.1-fast' = ANY(favorite_models);

UPDATE user_preferences
SET favorite_models = array_replace(favorite_models, 'openrouter:x-ai/grok-4.1-fast-thinking', 'openrouter:google/gemini-3-flash-preview')
WHERE 'openrouter:x-ai/grok-4.1-fast-thinking' = ANY(favorite_models);

UPDATE user_preferences
SET favorite_models = array_replace(favorite_models, 'openrouter:x-ai/grok-4-fast', 'openrouter:google/gemini-3-flash-preview')
WHERE 'openrouter:x-ai/grok-4-fast' = ANY(favorite_models);

-- Remove duplicates that may have been created (if user already had gemini in favorites)
-- PostgreSQL doesn't have a built-in array_distinct, so we use a subquery
UPDATE user_preferences
SET favorite_models = (
  SELECT ARRAY(SELECT DISTINCT unnest(favorite_models))
)
WHERE array_length(favorite_models, 1) > 0
  AND array_length(favorite_models, 1) != (
    SELECT count(DISTINCT val) FROM unnest(favorite_models) AS val
  );
