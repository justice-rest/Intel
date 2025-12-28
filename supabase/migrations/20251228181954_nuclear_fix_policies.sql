-- NUCLEAR OPTION: Drop ALL policies on chats and messages, then recreate clean ones

-- Drop ALL policies on chats table (regardless of name)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chats'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON chats', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Drop ALL policies on messages table (regardless of name)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON messages', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Enable RLS on both tables (in case it was disabled)
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Recreate clean policies for chats
CREATE POLICY "Users can view their own chats" ON chats
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own chats" ON chats
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own chats" ON chats
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own chats" ON chats
FOR DELETE USING (user_id = auth.uid());

-- Recreate clean policies for messages
CREATE POLICY "Users can view messages in their chats" ON messages
FOR SELECT USING (
    EXISTS (SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid())
);

CREATE POLICY "Users can insert messages in their chats" ON messages
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid())
);

CREATE POLICY "Users can update messages in their chats" ON messages
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid())
);

CREATE POLICY "Users can delete messages in their chats" ON messages
FOR DELETE USING (
    EXISTS (SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid())
);
