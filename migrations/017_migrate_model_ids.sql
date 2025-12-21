-- Migration: Update old model IDs to new Perplexity Sonar Reasoning model
-- This migration updates all references from deprecated Grok model IDs to the new Perplexity model

-- Update chats table
UPDATE chats
SET model = 'openrouter:perplexity/sonar-reasoning'
WHERE model IN (
  'openrouter:x-ai/grok-4-fast',
  'openrouter:x-ai/grok-4.1-fast'
);

-- Update messages table (if it has a model column)
UPDATE messages
SET model = 'openrouter:perplexity/sonar-reasoning'
WHERE model IN (
  'openrouter:x-ai/grok-4-fast',
  'openrouter:x-ai/grok-4.1-fast'
);

-- Update users table favorite_models (JSONB array)
UPDATE users
SET favorite_models = (
  SELECT jsonb_agg(
    CASE
      WHEN value::text IN ('"openrouter:x-ai/grok-4-fast"', '"openrouter:x-ai/grok-4.1-fast"')
      THEN '"openrouter:perplexity/sonar-reasoning"'::jsonb
      ELSE value
    END
  )
  FROM jsonb_array_elements(favorite_models)
)
WHERE favorite_models IS NOT NULL
  AND favorite_models::text LIKE '%grok%';

-- Update batch_prospect_items table (if it has a model_used column)
UPDATE batch_prospect_items
SET model_used = 'openrouter:perplexity/sonar-reasoning'
WHERE model_used IN (
  'openrouter:x-ai/grok-4-fast',
  'openrouter:x-ai/grok-4.1-fast'
);

-- Add comment to track migration
COMMENT ON TABLE chats IS 'Model IDs migrated from grok-4.1-fast to perplexity/sonar-reasoning on 2025-01-01';
