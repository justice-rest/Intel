-- ============================================================================
-- Migration: 023_add_notion_onedrive_integrations.sql
-- Description: Add Notion and OneDrive integration tables for document indexing
-- Features: OAuth token storage, document tracking, shared audit logging
-- ============================================================================

-- ============================================================================
-- NOTION OAUTH TOKENS TABLE
-- Stores encrypted OAuth2 tokens for Notion access
-- Note: Notion tokens do NOT expire, so no refresh token needed
-- ============================================================================

CREATE TABLE IF NOT EXISTS notion_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- OAuth2 token (encrypted with AES-256-GCM)
  -- Notion tokens don't expire, so only access_token is stored
  access_token_encrypted TEXT NOT NULL,
  access_token_iv TEXT NOT NULL,

  -- Notion workspace info (from OAuth response)
  workspace_id TEXT NOT NULL,
  workspace_name TEXT,
  workspace_icon TEXT,

  -- Bot/user info
  bot_id TEXT NOT NULL,
  owner_id TEXT,           -- User ID in Notion
  owner_email TEXT,        -- Email for display

  -- Connection status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'error')),
  last_error TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One token set per user
  UNIQUE (user_id)
);

-- ============================================================================
-- NOTION DOCUMENTS TABLE
-- Tracks Notion pages indexed into RAG system
-- ============================================================================

CREATE TABLE IF NOT EXISTS notion_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Notion page/database identifiers
  notion_page_id TEXT NOT NULL,       -- Notion's page ID (UUID without dashes)
  notion_page_title TEXT NOT NULL,
  notion_object_type TEXT NOT NULL    -- 'page' or 'database'
    CHECK (notion_object_type IN ('page', 'database')),
  notion_url TEXT,
  notion_last_edited_time TIMESTAMPTZ,
  notion_parent_id TEXT,              -- Parent page/database ID
  notion_icon TEXT,                   -- Icon emoji or URL

  -- RAG integration (references rag_documents table)
  rag_document_id UUID,

  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'needs_reindex')),
  error_message TEXT,

  -- Content metadata
  word_count INTEGER,
  block_count INTEGER,
  content_hash TEXT, -- To detect changes for re-indexing

  -- Sync tracking
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per user per page
  UNIQUE (user_id, notion_page_id)
);

-- ============================================================================
-- ONEDRIVE OAUTH TOKENS TABLE
-- Stores encrypted OAuth2 tokens for Microsoft OneDrive access
-- ============================================================================

CREATE TABLE IF NOT EXISTS onedrive_oauth_tokens (
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

  -- Microsoft account info
  microsoft_email TEXT NOT NULL,
  microsoft_id TEXT NOT NULL,
  display_name TEXT,

  -- Connection status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  last_refresh_at TIMESTAMPTZ DEFAULT NOW(),
  last_error TEXT,

  -- Delta sync support (for future incremental sync)
  delta_link TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One token set per user
  UNIQUE (user_id)
);

-- ============================================================================
-- ONEDRIVE DOCUMENTS TABLE
-- Tracks OneDrive files indexed into RAG system
-- ============================================================================

CREATE TABLE IF NOT EXISTS onedrive_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- OneDrive file identifiers
  onedrive_item_id TEXT NOT NULL,
  onedrive_file_name TEXT NOT NULL,
  onedrive_mime_type TEXT NOT NULL,
  onedrive_web_url TEXT,
  onedrive_last_modified_time TIMESTAMPTZ,
  onedrive_file_path TEXT,            -- Path in OneDrive

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
  UNIQUE (user_id, onedrive_item_id)
);

-- ============================================================================
-- CLOUD INTEGRATION AUDIT LOG TABLE
-- Shared audit log for all cloud integrations (Notion, OneDrive, Google)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cloud_integration_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Provider and action details
  provider TEXT NOT NULL
    CHECK (provider IN ('notion', 'onedrive', 'google')),
  action TEXT NOT NULL, -- 'connect', 'disconnect', 'token_refresh', 'document_import', etc.
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

-- Notion OAuth tokens indexes
CREATE INDEX IF NOT EXISTS idx_notion_oauth_user_id ON notion_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_notion_oauth_status ON notion_oauth_tokens(status);
CREATE INDEX IF NOT EXISTS idx_notion_oauth_workspace_id ON notion_oauth_tokens(workspace_id);

-- Notion documents indexes
CREATE INDEX IF NOT EXISTS idx_notion_docs_user_id ON notion_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_notion_docs_status ON notion_documents(status);
CREATE INDEX IF NOT EXISTS idx_notion_docs_page_id ON notion_documents(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_notion_docs_rag_id ON notion_documents(rag_document_id);
CREATE INDEX IF NOT EXISTS idx_notion_docs_synced_at ON notion_documents(last_synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_notion_docs_object_type ON notion_documents(notion_object_type);

-- OneDrive OAuth tokens indexes
CREATE INDEX IF NOT EXISTS idx_onedrive_oauth_user_id ON onedrive_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_onedrive_oauth_status ON onedrive_oauth_tokens(status);
CREATE INDEX IF NOT EXISTS idx_onedrive_oauth_expires_at ON onedrive_oauth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_onedrive_oauth_email ON onedrive_oauth_tokens(microsoft_email);

-- OneDrive documents indexes
CREATE INDEX IF NOT EXISTS idx_onedrive_docs_user_id ON onedrive_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_onedrive_docs_status ON onedrive_documents(status);
CREATE INDEX IF NOT EXISTS idx_onedrive_docs_item_id ON onedrive_documents(onedrive_item_id);
CREATE INDEX IF NOT EXISTS idx_onedrive_docs_rag_id ON onedrive_documents(rag_document_id);
CREATE INDEX IF NOT EXISTS idx_onedrive_docs_mime_type ON onedrive_documents(onedrive_mime_type);
CREATE INDEX IF NOT EXISTS idx_onedrive_docs_synced_at ON onedrive_documents(last_synced_at DESC);

-- Cloud audit log indexes
CREATE INDEX IF NOT EXISTS idx_cloud_audit_user_id ON cloud_integration_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_audit_provider ON cloud_integration_audit_log(provider);
CREATE INDEX IF NOT EXISTS idx_cloud_audit_action ON cloud_integration_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_cloud_audit_created_at ON cloud_integration_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_audit_user_provider ON cloud_integration_audit_log(user_id, provider, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE notion_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notion_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE onedrive_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE onedrive_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_integration_audit_log ENABLE ROW LEVEL SECURITY;

-- Notion OAuth tokens policies
DROP POLICY IF EXISTS "Users can view own Notion OAuth tokens" ON notion_oauth_tokens;
CREATE POLICY "Users can view own Notion OAuth tokens"
  ON notion_oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own Notion OAuth tokens" ON notion_oauth_tokens;
CREATE POLICY "Users can insert own Notion OAuth tokens"
  ON notion_oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own Notion OAuth tokens" ON notion_oauth_tokens;
CREATE POLICY "Users can update own Notion OAuth tokens"
  ON notion_oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own Notion OAuth tokens" ON notion_oauth_tokens;
CREATE POLICY "Users can delete own Notion OAuth tokens"
  ON notion_oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Notion documents policies
DROP POLICY IF EXISTS "Users can view own Notion documents" ON notion_documents;
CREATE POLICY "Users can view own Notion documents"
  ON notion_documents FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own Notion documents" ON notion_documents;
CREATE POLICY "Users can insert own Notion documents"
  ON notion_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own Notion documents" ON notion_documents;
CREATE POLICY "Users can update own Notion documents"
  ON notion_documents FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own Notion documents" ON notion_documents;
CREATE POLICY "Users can delete own Notion documents"
  ON notion_documents FOR DELETE
  USING (auth.uid() = user_id);

-- OneDrive OAuth tokens policies
DROP POLICY IF EXISTS "Users can view own OneDrive OAuth tokens" ON onedrive_oauth_tokens;
CREATE POLICY "Users can view own OneDrive OAuth tokens"
  ON onedrive_oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own OneDrive OAuth tokens" ON onedrive_oauth_tokens;
CREATE POLICY "Users can insert own OneDrive OAuth tokens"
  ON onedrive_oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own OneDrive OAuth tokens" ON onedrive_oauth_tokens;
CREATE POLICY "Users can update own OneDrive OAuth tokens"
  ON onedrive_oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own OneDrive OAuth tokens" ON onedrive_oauth_tokens;
CREATE POLICY "Users can delete own OneDrive OAuth tokens"
  ON onedrive_oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- OneDrive documents policies
DROP POLICY IF EXISTS "Users can view own OneDrive documents" ON onedrive_documents;
CREATE POLICY "Users can view own OneDrive documents"
  ON onedrive_documents FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own OneDrive documents" ON onedrive_documents;
CREATE POLICY "Users can insert own OneDrive documents"
  ON onedrive_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own OneDrive documents" ON onedrive_documents;
CREATE POLICY "Users can update own OneDrive documents"
  ON onedrive_documents FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own OneDrive documents" ON onedrive_documents;
CREATE POLICY "Users can delete own OneDrive documents"
  ON onedrive_documents FOR DELETE
  USING (auth.uid() = user_id);

-- Cloud audit log policies (users can view their own, insert allowed for logging)
DROP POLICY IF EXISTS "Users can view own cloud audit logs" ON cloud_integration_audit_log;
CREATE POLICY "Users can view own cloud audit logs"
  ON cloud_integration_audit_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own cloud audit logs" ON cloud_integration_audit_log;
CREATE POLICY "Users can insert own cloud audit logs"
  ON cloud_integration_audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Notion OAuth tokens updated_at trigger
DROP TRIGGER IF EXISTS notion_oauth_tokens_updated_at ON notion_oauth_tokens;
CREATE TRIGGER notion_oauth_tokens_updated_at
  BEFORE UPDATE ON notion_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_google_integration_updated_at();

-- Notion documents updated_at trigger
DROP TRIGGER IF EXISTS notion_documents_updated_at ON notion_documents;
CREATE TRIGGER notion_documents_updated_at
  BEFORE UPDATE ON notion_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_google_integration_updated_at();

-- OneDrive OAuth tokens updated_at trigger
DROP TRIGGER IF EXISTS onedrive_oauth_tokens_updated_at ON onedrive_oauth_tokens;
CREATE TRIGGER onedrive_oauth_tokens_updated_at
  BEFORE UPDATE ON onedrive_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_google_integration_updated_at();

-- OneDrive documents updated_at trigger
DROP TRIGGER IF EXISTS onedrive_documents_updated_at ON onedrive_documents;
CREATE TRIGGER onedrive_documents_updated_at
  BEFORE UPDATE ON onedrive_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_google_integration_updated_at();

-- ============================================================================
-- DATA VALIDATION CONSTRAINTS
-- ============================================================================

-- Notion documents constraints
ALTER TABLE notion_documents
  DROP CONSTRAINT IF EXISTS check_notion_title_length,
  ADD CONSTRAINT check_notion_title_length CHECK (length(notion_page_title) <= 2000);

-- OneDrive documents constraints
ALTER TABLE onedrive_documents
  DROP CONSTRAINT IF EXISTS check_onedrive_file_size_limit,
  ADD CONSTRAINT check_onedrive_file_size_limit CHECK (file_size IS NULL OR file_size <= 52428800); -- 50MB

ALTER TABLE onedrive_documents
  DROP CONSTRAINT IF EXISTS check_onedrive_filename_length,
  ADD CONSTRAINT check_onedrive_filename_length CHECK (length(onedrive_file_name) <= 500);

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View for Notion integration status per user
DROP VIEW IF EXISTS notion_integration_status;
CREATE VIEW notion_integration_status
WITH (security_invoker = true)
AS
SELECT
  u.id as user_id,
  u.email as user_email,
  nt.workspace_name,
  nt.workspace_id,
  nt.owner_email as notion_email,
  nt.status as connection_status,
  nt.last_error,
  nt.created_at as connected_at,
  (SELECT COUNT(*) FROM notion_documents nd WHERE nd.user_id = u.id AND nd.status = 'ready') as indexed_pages,
  (SELECT COUNT(*) FROM notion_documents nd WHERE nd.user_id = u.id AND nd.status = 'processing') as processing_pages
FROM users u
LEFT JOIN notion_oauth_tokens nt ON u.id = nt.user_id;

-- View for OneDrive integration status per user
DROP VIEW IF EXISTS onedrive_integration_status;
CREATE VIEW onedrive_integration_status
WITH (security_invoker = true)
AS
SELECT
  u.id as user_id,
  u.email as user_email,
  odt.microsoft_email,
  odt.display_name,
  odt.status as connection_status,
  odt.expires_at as token_expires_at,
  odt.last_refresh_at,
  odt.last_error,
  odt.created_at as connected_at,
  (SELECT COUNT(*) FROM onedrive_documents od WHERE od.user_id = u.id AND od.status = 'ready') as indexed_files,
  (SELECT COUNT(*) FROM onedrive_documents od WHERE od.user_id = u.id AND od.status = 'processing') as processing_files
FROM users u
LEFT JOIN onedrive_oauth_tokens odt ON u.id = odt.user_id;

-- Grant access to the views
GRANT SELECT ON notion_integration_status TO authenticated;
GRANT SELECT ON onedrive_integration_status TO authenticated;

-- ============================================================================
-- COMMENTS (for documentation)
-- ============================================================================

COMMENT ON TABLE notion_oauth_tokens IS 'Stores encrypted OAuth2 tokens for Notion access. Notion tokens do not expire, so no refresh token is stored.';
COMMENT ON TABLE notion_documents IS 'Tracks Notion pages imported and indexed into the RAG system for AI context.';
COMMENT ON TABLE onedrive_oauth_tokens IS 'Stores encrypted OAuth2 tokens for Microsoft OneDrive access. Tokens are encrypted with AES-256-GCM.';
COMMENT ON TABLE onedrive_documents IS 'Tracks OneDrive files imported and indexed into the RAG system for AI context.';
COMMENT ON TABLE cloud_integration_audit_log IS 'Shared audit log for all cloud integrations (Notion, OneDrive, Google) for compliance and debugging.';

COMMENT ON COLUMN notion_oauth_tokens.access_token_encrypted IS 'AES-256-GCM encrypted access token';
COMMENT ON COLUMN notion_oauth_tokens.bot_id IS 'Notion integration bot ID from OAuth response';
COMMENT ON COLUMN notion_documents.notion_object_type IS 'Type of Notion object: page or database';
COMMENT ON COLUMN onedrive_oauth_tokens.access_token_encrypted IS 'AES-256-GCM encrypted access token';
COMMENT ON COLUMN onedrive_oauth_tokens.refresh_token_encrypted IS 'AES-256-GCM encrypted refresh token';
COMMENT ON COLUMN onedrive_oauth_tokens.delta_link IS 'Microsoft Graph delta link for incremental sync';
