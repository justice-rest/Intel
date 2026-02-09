-- Add avatar style and color preferences for the double-tap PFP Easter egg.
-- Both default to 0, which maps to "dylan" style and "00A5E4" (sky blue) color.

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS avatar_style_index INTEGER NOT NULL DEFAULT 0;

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS avatar_color_index INTEGER NOT NULL DEFAULT 0;
