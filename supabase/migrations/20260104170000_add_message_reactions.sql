-- Migration: Add message reactions
-- This adds emoji reaction support for collaborative chats
-- Users can react to messages with emojis (like iMessage, Slack, Discord)

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user can only have one of each emoji per message
  UNIQUE(message_id, user_id, emoji)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id
  ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id
  ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_emoji
  ON message_reactions(message_id, emoji);

-- Enable Row Level Security
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- SELECT: Users can see reactions on messages they can access
-- (messages in their own chats or chats they're collaborators on)
CREATE POLICY "message_reactions_select_policy" ON message_reactions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN chats c ON m.chat_id = c.id
    LEFT JOIN chat_collaborators cc ON cc.chat_id = c.id AND cc.user_id = auth.uid()
    WHERE m.id = message_reactions.message_id
    AND (c.user_id = auth.uid() OR cc.user_id IS NOT NULL OR c.public = true)
  )
);

-- INSERT: Users can add reactions to messages they can access
CREATE POLICY "message_reactions_insert_policy" ON message_reactions
FOR INSERT WITH CHECK (
  -- Must be the authenticated user
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM messages m
    JOIN chats c ON m.chat_id = c.id
    LEFT JOIN chat_collaborators cc ON cc.chat_id = c.id AND cc.user_id = auth.uid()
    WHERE m.id = message_reactions.message_id
    AND (c.user_id = auth.uid() OR cc.user_id IS NOT NULL)
  )
);

-- DELETE: Users can only remove their own reactions
CREATE POLICY "message_reactions_delete_policy" ON message_reactions
FOR DELETE USING (
  user_id = auth.uid()
);

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON message_reactions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE message_reactions_id_seq TO authenticated;

-- Add comment
COMMENT ON TABLE message_reactions IS 'Stores emoji reactions on messages for collaborative chats';
