-- Clear all user data (keeps table structure)
-- This is a one-time data cleanup migration

TRUNCATE TABLE
  messages,
  chats,
  chat_attachments,
  user_preferences,
  user_keys,
  feedback,
  users
CASCADE;

-- Clear memory tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_memories') THEN
    TRUNCATE TABLE user_memories CASCADE;
  END IF;
END $$;

-- Clear CRM tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_donations') THEN
    TRUNCATE TABLE crm_donations CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_constituents') THEN
    TRUNCATE TABLE crm_constituents CASCADE;
  END IF;
END $$;
