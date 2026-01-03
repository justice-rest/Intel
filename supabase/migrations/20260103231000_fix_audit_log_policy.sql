-- Fix: Allow users to insert their own audit log entries
-- The original migration only allowed SELECT for users

DROP POLICY IF EXISTS "Users insert own audit" ON knowledge_audit_log;
CREATE POLICY "Users insert own audit"
  ON knowledge_audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
