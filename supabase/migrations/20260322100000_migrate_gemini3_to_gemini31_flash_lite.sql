-- Migration: Migrate Gemini 3 Flash Preview to Gemini 3.1 Flash Lite Preview
-- Date: 2026-03-22
-- Reason: Gemini 3 Flash Preview is being replaced by Gemini 3.1 Flash Lite Preview
--         as the default chat model. Half the cost with better quality.
--         /labs (batch processing) continues to use Gemini 3 Flash Preview via hardcoded references.

-- ============================================================================
-- STEP 1: Migrate chat default models
-- ============================================================================

-- Migrate chats using Gemini 3 Flash Preview to Gemini 3.1 Flash Lite Preview
UPDATE chats
SET model = 'openrouter:google/gemini-3.1-flash-lite-preview'
WHERE model = 'openrouter:google/gemini-3-flash-preview';

-- Also catch any chats that were previously migrated to Gemini 3 Flash
-- but may have been missed by the application-layer normalizeModelId()
-- (e.g., chats created between the last migration and this deployment)

-- ============================================================================
-- STEP 2: Historical message model attribution
-- ============================================================================

-- Note: We intentionally do NOT update messages.model.
-- The model field on messages is a historical record of which model actually
-- generated that response. Rewriting history would be misleading.
-- The normalizeModelId() function in the application layer handles
-- display normalization for the UI.

-- ============================================================================
-- STEP 3: Migrate user favorite models
-- ============================================================================

-- Update user_preferences where favorite_models array contains Gemini 3 Flash Preview
UPDATE user_preferences
SET favorite_models = array_replace(
  favorite_models,
  'openrouter:google/gemini-3-flash-preview',
  'openrouter:google/gemini-3.1-flash-lite-preview'
)
WHERE 'openrouter:google/gemini-3-flash-preview' = ANY(favorite_models);

-- Remove duplicates that may have been created (if user already had Gemini 3.1 Flash Lite in favorites)
UPDATE user_preferences
SET favorite_models = (
  SELECT ARRAY(SELECT DISTINCT unnest(favorite_models))
)
WHERE array_length(favorite_models, 1) > 0
  AND array_length(favorite_models, 1) != (
    SELECT count(DISTINCT val) FROM unnest(favorite_models) AS val
  );
