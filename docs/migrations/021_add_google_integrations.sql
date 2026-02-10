-- ============================================================================
-- Migration: 021_add_google_integrations.sql
-- Description: Add Gmail and Google Drive integration tables
-- Features: OAuth token storage, Gmail drafts, Drive documents, writing style analysis
-- ============================================================================

-- ============================================================================
-- GOOGLE OAUTH TOKENS TABLE
-- Stores encrypted OAuth2 tokens for Gmail and Drive access
-- ============================================================================

CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- OAuth2 tokens (encrypted with AES-256-GCM)
  access_token_encrypted TEXT NOT NULL,
  access_token_iv TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  refresh_token_iv TEXT NOT NULL,

  -- Token metadata
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',

  -- Google account info
  google_email TEXT NOT NULL,
  google_id TEXT NOT NULL,

  -- Connection status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  last_refresh_at TIMESTAMPTZ DEFAULT NOW(),
  last_error TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One token set per user (can reconnect with different account)
  UNIQUE (user_id)
);

-- ============================================================================
-- GMAIL DRAFTS TABLE
-- Tracks drafts created by AI for user review
-- ============================================================================

CREATE TABLE IF NOT EXISTS gmail_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Gmail identifiers
  draft_id TEXT NOT NULL,
  thread_id TEXT,
  message_id TEXT,

  -- Draft metadata
  to_recipients TEXT[] NOT NULL DEFAULT '{}',
  cc_recipients TEXT[] DEFAULT '{}',
  subject TEXT,
  body_preview TEXT, -- First 200 chars for preview

  -- AI context
  chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
  created_by_ai BOOLEAN DEFAULT true,
  prompt_summary TEXT, -- What the AI was asked to do

  -- Idempotency key for preventing duplicates
  idempotency_key TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'discarded', 'edited')),
  sent_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per user per draft
  UNIQUE (user_id, draft_id)
);

-- ============================================================================
-- GOOGLE DRIVE DOCUMENTS TABLE
-- Tracks Drive files indexed into RAG system
-- ============================================================================

CREATE TABLE IF NOT EXISTS google_drive_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Drive file identifiers
  drive_file_id TEXT NOT NULL,
  drive_file_name TEXT NOT NULL,
  drive_mime_type TEXT NOT NULL,
  drive_modified_time TIMESTAMPTZ,
  drive_web_view_link TEXT,

  -- RAG integration (references rag_documents table)
  rag_document_id UUID,

  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'needs_reindex')),
  error_message TEXT,

  -- File metadata
  file_size BIGINT,
  page_count INTEGER,
  word_count INTEGER,
  content_hash TEXT, -- To detect changes for re-indexing

  -- Sync tracking
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per user per file
  UNIQUE (user_id, drive_file_id)
);

-- ============================================================================
-- USER WRITING STYLE TABLE
-- Stores extracted writing style profile from sent emails
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_writing_style (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Style profile (comprehensive JSON)
  style_profile JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Analysis metadata
  emails_analyzed INTEGER DEFAULT 0,
  last_analyzed_at TIMESTAMPTZ,

  -- Extracted patterns (for quick access)
  formality_score DECIMAL(3,2), -- 0.0 (casual) to 1.0 (formal)
  greeting_patterns TEXT[] DEFAULT '{}',
  closing_patterns TEXT[] DEFAULT '{}',
  common_phrases TEXT[] DEFAULT '{}',
  sample_sentences TEXT[] DEFAULT '{}',
  uses_emojis BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One style profile per user
  UNIQUE (user_id)
);

-- ============================================================================
-- GOOGLE INTEGRATION AUDIT LOG TABLE
-- Tracks all integration actions for compliance and debugging
-- ============================================================================

CREATE TABLE IF NOT EXISTS google_integration_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Action details
  action TEXT NOT NULL, -- 'connect', 'disconnect', 'token_refresh', 'draft_create', 'style_analyze', etc.
  status TEXT NOT NULL, -- 'success', 'failure'
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Request context (for security investigation)
  ip_address INET,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- OAuth tokens indexes
CREATE INDEX IF NOT EXISTS idx_google_oauth_user_id ON google_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_google_oauth_status ON google_oauth_tokens(status);
CREATE INDEX IF NOT EXISTS idx_google_oauth_expires_at ON google_oauth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_google_oauth_google_email ON google_oauth_tokens(google_email);

-- Gmail drafts indexes
CREATE INDEX IF NOT EXISTS idx_gmail_drafts_user_id ON gmail_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_drafts_status ON gmail_drafts(status);
CREATE INDEX IF NOT EXISTS idx_gmail_drafts_created_at ON gmail_drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gmail_drafts_thread_id ON gmail_drafts(thread_id);
CREATE INDEX IF NOT EXISTS idx_gmail_drafts_chat_id ON gmail_drafts(chat_id);
CREATE INDEX IF NOT EXISTS idx_gmail_drafts_idempotency ON gmail_drafts(user_id, idempotency_key);

-- Drive documents indexes
CREATE INDEX IF NOT EXISTS idx_drive_docs_user_id ON google_drive_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_docs_status ON google_drive_documents(status);
CREATE INDEX IF NOT EXISTS idx_drive_docs_file_id ON google_drive_documents(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_drive_docs_rag_id ON google_drive_documents(rag_document_id);
CREATE INDEX IF NOT EXISTS idx_drive_docs_mime_type ON google_drive_documents(drive_mime_type);
CREATE INDEX IF NOT EXISTS idx_drive_docs_synced_at ON google_drive_documents(last_synced_at DESC);

-- Writing style indexes
CREATE INDEX IF NOT EXISTS idx_writing_style_user_id ON user_writing_style(user_id);
CREATE INDEX IF NOT EXISTS idx_writing_style_analyzed_at ON user_writing_style(last_analyzed_at DESC);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON google_integration_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON google_integration_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON google_integration_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_action ON google_integration_audit_log(user_id, action, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE google_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_drive_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_writing_style ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_integration_audit_log ENABLE ROW LEVEL SECURITY;

-- OAuth tokens policies
DROP POLICY IF EXISTS "Users can view own OAuth tokens" ON google_oauth_tokens;
CREATE POLICY "Users can view own OAuth tokens"
  ON google_oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own OAuth tokens" ON google_oauth_tokens;
CREATE POLICY "Users can insert own OAuth tokens"
  ON google_oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own OAuth tokens" ON google_oauth_tokens;
CREATE POLICY "Users can update own OAuth tokens"
  ON google_oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own OAuth tokens" ON google_oauth_tokens;
CREATE POLICY "Users can delete own OAuth tokens"
  ON google_oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Gmail drafts policies
DROP POLICY IF EXISTS "Users can view own Gmail drafts" ON gmail_drafts;
CREATE POLICY "Users can view own Gmail drafts"
  ON gmail_drafts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own Gmail drafts" ON gmail_drafts;
CREATE POLICY "Users can insert own Gmail drafts"
  ON gmail_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own Gmail drafts" ON gmail_drafts;
CREATE POLICY "Users can update own Gmail drafts"
  ON gmail_drafts FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own Gmail drafts" ON gmail_drafts;
CREATE POLICY "Users can delete own Gmail drafts"
  ON gmail_drafts FOR DELETE
  USING (auth.uid() = user_id);

-- Drive documents policies
DROP POLICY IF EXISTS "Users can view own Drive documents" ON google_drive_documents;
CREATE POLICY "Users can view own Drive documents"
  ON google_drive_documents FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own Drive documents" ON google_drive_documents;
CREATE POLICY "Users can insert own Drive documents"
  ON google_drive_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own Drive documents" ON google_drive_documents;
CREATE POLICY "Users can update own Drive documents"
  ON google_drive_documents FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own Drive documents" ON google_drive_documents;
CREATE POLICY "Users can delete own Drive documents"
  ON google_drive_documents FOR DELETE
  USING (auth.uid() = user_id);

-- Writing style policies
DROP POLICY IF EXISTS "Users can view own writing style" ON user_writing_style;
CREATE POLICY "Users can view own writing style"
  ON user_writing_style FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own writing style" ON user_writing_style;
CREATE POLICY "Users can insert own writing style"
  ON user_writing_style FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own writing style" ON user_writing_style;
CREATE POLICY "Users can update own writing style"
  ON user_writing_style FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own writing style" ON user_writing_style;
CREATE POLICY "Users can delete own writing style"
  ON user_writing_style FOR DELETE
  USING (auth.uid() = user_id);

-- Audit log policies (users can only view their own, insert allowed for logging)
DROP POLICY IF EXISTS "Users can view own audit logs" ON google_integration_audit_log;
CREATE POLICY "Users can view own audit logs"
  ON google_integration_audit_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own audit logs" ON google_integration_audit_log;
CREATE POLICY "Users can insert own audit logs"
  ON google_integration_audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_google_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- OAuth tokens updated_at trigger
DROP TRIGGER IF EXISTS google_oauth_tokens_updated_at ON google_oauth_tokens;
CREATE TRIGGER google_oauth_tokens_updated_at
  BEFORE UPDATE ON google_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_google_integration_updated_at();

-- Drive documents updated_at trigger
DROP TRIGGER IF EXISTS google_drive_documents_updated_at ON google_drive_documents;
CREATE TRIGGER google_drive_documents_updated_at
  BEFORE UPDATE ON google_drive_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_google_integration_updated_at();

-- Writing style updated_at trigger
DROP TRIGGER IF EXISTS user_writing_style_updated_at ON user_writing_style;
CREATE TRIGGER user_writing_style_updated_at
  BEFORE UPDATE ON user_writing_style
  FOR EACH ROW
  EXECUTE FUNCTION update_google_integration_updated_at();

-- ============================================================================
-- DATA VALIDATION CONSTRAINTS
-- ============================================================================

-- Add CHECK constraints for data validation
ALTER TABLE gmail_drafts
  DROP CONSTRAINT IF EXISTS check_subject_length,
  ADD CONSTRAINT check_subject_length CHECK (subject IS NULL OR length(subject) <= 1000);

ALTER TABLE gmail_drafts
  DROP CONSTRAINT IF EXISTS check_recipients_limit,
  ADD CONSTRAINT check_recipients_limit CHECK (array_length(to_recipients, 1) IS NULL OR array_length(to_recipients, 1) <= 100);

ALTER TABLE google_drive_documents
  DROP CONSTRAINT IF EXISTS check_file_size_limit,
  ADD CONSTRAINT check_file_size_limit CHECK (file_size IS NULL OR file_size <= 52428800); -- 50MB

ALTER TABLE user_writing_style
  DROP CONSTRAINT IF EXISTS check_formality_range,
  ADD CONSTRAINT check_formality_range CHECK (formality_score IS NULL OR (formality_score >= 0 AND formality_score <= 1));

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View for Google integration status per user
DROP VIEW IF EXISTS google_integration_status;
CREATE VIEW google_integration_status
WITH (security_invoker = true)
AS
SELECT
  u.id as user_id,
  u.email as user_email,
  got.google_email,
  got.status as connection_status,
  got.scopes,
  got.last_refresh_at,
  got.last_error,
  got.created_at as connected_at,
  (SELECT COUNT(*) FROM gmail_drafts gd WHERE gd.user_id = u.id AND gd.status = 'pending') as pending_drafts,
  (SELECT COUNT(*) FROM google_drive_documents gdd WHERE gdd.user_id = u.id AND gdd.status = 'ready') as indexed_documents,
  uws.emails_analyzed,
  uws.last_analyzed_at as style_analyzed_at
FROM users u
LEFT JOIN google_oauth_tokens got ON u.id = got.user_id
LEFT JOIN user_writing_style uws ON u.id = uws.user_id;

-- Grant access to the view
GRANT SELECT ON google_integration_status TO authenticated;

-- ============================================================================
-- COMMENTS (for documentation)
-- ============================================================================

COMMENT ON TABLE google_oauth_tokens IS 'Stores encrypted OAuth2 tokens for Gmail and Google Drive access. Tokens are encrypted with AES-256-GCM.';
COMMENT ON TABLE gmail_drafts IS 'Tracks email drafts created by AI. Users must manually send drafts - AI cannot send emails.';
COMMENT ON TABLE google_drive_documents IS 'Tracks Google Drive files imported and indexed into the RAG system for AI context.';
COMMENT ON TABLE user_writing_style IS 'Stores extracted writing style profiles from sent emails for personalized draft generation.';
COMMENT ON TABLE google_integration_audit_log IS 'Audit log for all Google integration actions for compliance and debugging.';

COMMENT ON COLUMN google_oauth_tokens.access_token_encrypted IS 'AES-256-GCM encrypted access token';
COMMENT ON COLUMN google_oauth_tokens.refresh_token_encrypted IS 'AES-256-GCM encrypted refresh token';
COMMENT ON COLUMN gmail_drafts.idempotency_key IS 'Prevents duplicate draft creation from retried requests';
COMMENT ON COLUMN user_writing_style.style_profile IS 'Comprehensive JSON profile with formality, greetings, closings, sample sentences, etc.';
