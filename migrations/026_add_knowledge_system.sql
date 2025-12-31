-- ============================================================================
-- Migration: 026_add_knowledge_system.sql
-- Description: Organizational knowledge profiles for AI personalization
-- ============================================================================

-- Enable pgvector if not already (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- KNOWLEDGE SYSTEM TABLES
-- ============================================================================

-- Master profile combining all knowledge aspects for an organization
CREATE TABLE IF NOT EXISTS knowledge_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name TEXT NOT NULL DEFAULT 'Default Profile',
  description TEXT,

  -- Versioning
  version INTEGER DEFAULT 1,
  parent_version_id UUID REFERENCES knowledge_profiles(id) ON DELETE SET NULL,

  -- Generated prompt sections (output of knowledge processing)
  voice_prompt TEXT,
  strategy_prompt TEXT,
  knowledge_prompt TEXT,
  rules_prompt TEXT,

  prompt_generated_at TIMESTAMPTZ,
  prompt_token_count INTEGER,

  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),

  -- Soft delete for GDPR compliance
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name, version)
);

COMMENT ON TABLE knowledge_profiles IS 'Organizational knowledge profiles for AI personalization';

-- Source documents uploaded for knowledge extraction
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES knowledge_profiles(id) ON DELETE CASCADE,

  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,

  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'analyzed', 'failed'
  )),
  error_message TEXT,

  -- Document classification (what type of knowledge this provides)
  doc_purpose TEXT[] DEFAULT '{}', -- ['voice', 'strategy', 'knowledge', 'examples']

  -- Extracted content
  raw_text TEXT,
  page_count INTEGER,
  word_count INTEGER,

  -- Analysis results (JSONB for flexibility)
  analysis_results JSONB DEFAULT '{}'::jsonb,

  -- Soft delete for GDPR compliance
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

COMMENT ON TABLE knowledge_documents IS 'Source documents uploaded for knowledge extraction';

-- Extracted voice/style characteristics from documents
CREATE TABLE IF NOT EXISTS knowledge_voice_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES knowledge_profiles(id) ON DELETE CASCADE,

  element_type TEXT NOT NULL CHECK (element_type IN (
    'tone', 'formality', 'terminology', 'sentence_style',
    'emotional_register', 'word_preference', 'word_avoidance'
  )),

  value TEXT NOT NULL,
  description TEXT,
  confidence FLOAT DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),

  -- Source tracking
  source_document_id UUID REFERENCES knowledge_documents(id) ON DELETE SET NULL,
  source_excerpt TEXT,

  -- User override
  is_user_defined BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extracted or defined fundraising strategy rules
CREATE TABLE IF NOT EXISTS knowledge_strategy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES knowledge_profiles(id) ON DELETE CASCADE,

  category TEXT NOT NULL CHECK (category IN (
    'cultivation', 'solicitation', 'stewardship', 'objection_handling',
    'ask_philosophy', 'donor_segmentation', 'communication', 'general'
  )),

  rule TEXT NOT NULL,
  rationale TEXT,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),

  -- Source tracking
  source_type TEXT DEFAULT 'user_defined' CHECK (source_type IN (
    'extracted', 'user_defined', 'feedback_derived'
  )),
  source_document_id UUID REFERENCES knowledge_documents(id) ON DELETE SET NULL,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizational facts that should always be known
CREATE TABLE IF NOT EXISTS knowledge_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES knowledge_profiles(id) ON DELETE CASCADE,

  category TEXT NOT NULL CHECK (category IN (
    'organization', 'mission', 'programs', 'impact', 'staff',
    'board', 'donors', 'campaigns', 'history', 'values'
  )),

  fact TEXT NOT NULL,
  importance FLOAT DEFAULT 0.7 CHECK (importance >= 0 AND importance <= 1),

  -- Temporal validity
  valid_from DATE,
  valid_until DATE,

  -- Source tracking
  source_document_id UUID REFERENCES knowledge_documents(id) ON DELETE SET NULL,
  is_user_defined BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Embedding for semantic search
  embedding vector(1536),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE knowledge_facts IS 'Extracted organizational facts with vector embeddings';
COMMENT ON COLUMN knowledge_facts.embedding IS '1536-dim vector for semantic similarity search';

-- Good and bad examples for few-shot learning
CREATE TABLE IF NOT EXISTS knowledge_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES knowledge_profiles(id) ON DELETE CASCADE,

  example_type TEXT NOT NULL CHECK (example_type IN ('good', 'bad', 'template')),
  category TEXT NOT NULL,

  title TEXT,
  context TEXT,
  input TEXT,
  output TEXT NOT NULL,
  explanation TEXT,

  -- Source tracking
  source_type TEXT DEFAULT 'manual' CHECK (source_type IN (
    'manual', 'conversation', 'document'
  )),
  source_document_id UUID REFERENCES knowledge_documents(id) ON DELETE SET NULL,
  source_chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User feedback on AI responses for continuous improvement
CREATE TABLE IF NOT EXISTS knowledge_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES knowledge_profiles(id) ON DELETE SET NULL,

  message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,

  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_type TEXT CHECK (feedback_type IN (
    'voice_mismatch', 'strategy_wrong', 'knowledge_incorrect',
    'too_generic', 'excellent', 'other'
  )),
  comment TEXT,
  preferred_response TEXT,

  incorporated BOOLEAN DEFAULT false,
  incorporated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Version history for rollback support
CREATE TABLE IF NOT EXISTS knowledge_profile_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES knowledge_profiles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,

  -- Snapshot of generated prompts at this version
  voice_prompt TEXT,
  strategy_prompt TEXT,
  knowledge_prompt TEXT,
  rules_prompt TEXT,

  change_summary TEXT,
  changed_by TEXT CHECK (changed_by IN ('user', 'auto', 'feedback')),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(profile_id, version)
);

-- Idempotency for API calls (prevents duplicate processing)
CREATE TABLE IF NOT EXISTS knowledge_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log for compliance (GDPR, data tracking)
CREATE TABLE IF NOT EXISTS knowledge_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES knowledge_profiles(id) ON DELETE SET NULL,

  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Profile indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_profiles_user_active
  ON knowledge_profiles(user_id)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_knowledge_profiles_user_status
  ON knowledge_profiles(user_id, status);

-- Document indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_profile ON knowledge_documents(profile_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_status ON knowledge_documents(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_user_created
  ON knowledge_documents(user_id, created_at DESC);

-- Voice elements
CREATE INDEX IF NOT EXISTS idx_knowledge_voice_profile ON knowledge_voice_elements(profile_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_voice_type ON knowledge_voice_elements(element_type);

-- Strategy rules
CREATE INDEX IF NOT EXISTS idx_knowledge_strategy_profile ON knowledge_strategy_rules(profile_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_strategy_category ON knowledge_strategy_rules(category);

-- Knowledge facts
CREATE INDEX IF NOT EXISTS idx_knowledge_facts_profile ON knowledge_facts(profile_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_facts_category ON knowledge_facts(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_facts_embedding_hnsw
  ON knowledge_facts USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Examples
CREATE INDEX IF NOT EXISTS idx_knowledge_examples_profile ON knowledge_examples(profile_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_examples_type ON knowledge_examples(example_type, category);

-- Feedback
CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_profile_pending
  ON knowledge_feedback(profile_id)
  WHERE incorporated = false;

-- Idempotency cleanup index
CREATE INDEX IF NOT EXISTS idx_knowledge_idempotency_created
  ON knowledge_idempotency(created_at);

-- Audit log
CREATE INDEX IF NOT EXISTS idx_knowledge_audit_user ON knowledge_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_audit_profile ON knowledge_audit_log(profile_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_knowledge_profiles_updated_at ON knowledge_profiles;
CREATE TRIGGER update_knowledge_profiles_updated_at
  BEFORE UPDATE ON knowledge_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE knowledge_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_voice_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_strategy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_profile_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_audit_log ENABLE ROW LEVEL SECURITY;

-- Profiles: user owns their profiles
DROP POLICY IF EXISTS "Users manage own profiles" ON knowledge_profiles;
CREATE POLICY "Users manage own profiles"
  ON knowledge_profiles FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages profiles" ON knowledge_profiles;
CREATE POLICY "Service role manages profiles"
  ON knowledge_profiles FOR ALL
  USING (auth.role() = 'service_role');

-- Documents: user owns their documents
DROP POLICY IF EXISTS "Users manage own documents" ON knowledge_documents;
CREATE POLICY "Users manage own documents"
  ON knowledge_documents FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages documents" ON knowledge_documents;
CREATE POLICY "Service role manages documents"
  ON knowledge_documents FOR ALL
  USING (auth.role() = 'service_role');

-- Voice elements: via profile ownership
DROP POLICY IF EXISTS "Users manage own voice elements" ON knowledge_voice_elements;
CREATE POLICY "Users manage own voice elements"
  ON knowledge_voice_elements FOR ALL
  USING (
    profile_id IN (
      SELECT id FROM knowledge_profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages voice elements" ON knowledge_voice_elements;
CREATE POLICY "Service role manages voice elements"
  ON knowledge_voice_elements FOR ALL
  USING (auth.role() = 'service_role');

-- Strategy rules: via profile ownership
DROP POLICY IF EXISTS "Users manage own strategy rules" ON knowledge_strategy_rules;
CREATE POLICY "Users manage own strategy rules"
  ON knowledge_strategy_rules FOR ALL
  USING (
    profile_id IN (
      SELECT id FROM knowledge_profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages strategy rules" ON knowledge_strategy_rules;
CREATE POLICY "Service role manages strategy rules"
  ON knowledge_strategy_rules FOR ALL
  USING (auth.role() = 'service_role');

-- Facts: via profile ownership
DROP POLICY IF EXISTS "Users manage own facts" ON knowledge_facts;
CREATE POLICY "Users manage own facts"
  ON knowledge_facts FOR ALL
  USING (
    profile_id IN (
      SELECT id FROM knowledge_profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages facts" ON knowledge_facts;
CREATE POLICY "Service role manages facts"
  ON knowledge_facts FOR ALL
  USING (auth.role() = 'service_role');

-- Examples: via profile ownership
DROP POLICY IF EXISTS "Users manage own examples" ON knowledge_examples;
CREATE POLICY "Users manage own examples"
  ON knowledge_examples FOR ALL
  USING (
    profile_id IN (
      SELECT id FROM knowledge_profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages examples" ON knowledge_examples;
CREATE POLICY "Service role manages examples"
  ON knowledge_examples FOR ALL
  USING (auth.role() = 'service_role');

-- Feedback: user owns their feedback
DROP POLICY IF EXISTS "Users manage own feedback" ON knowledge_feedback;
CREATE POLICY "Users manage own feedback"
  ON knowledge_feedback FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages feedback" ON knowledge_feedback;
CREATE POLICY "Service role manages feedback"
  ON knowledge_feedback FOR ALL
  USING (auth.role() = 'service_role');

-- Versions: via profile ownership (read-only for users)
DROP POLICY IF EXISTS "Users view own versions" ON knowledge_profile_versions;
CREATE POLICY "Users view own versions"
  ON knowledge_profile_versions FOR SELECT
  USING (
    profile_id IN (
      SELECT id FROM knowledge_profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages versions" ON knowledge_profile_versions;
CREATE POLICY "Service role manages versions"
  ON knowledge_profile_versions FOR ALL
  USING (auth.role() = 'service_role');

-- Idempotency: user owns their keys
DROP POLICY IF EXISTS "Users manage own idempotency" ON knowledge_idempotency;
CREATE POLICY "Users manage own idempotency"
  ON knowledge_idempotency FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages idempotency" ON knowledge_idempotency;
CREATE POLICY "Service role manages idempotency"
  ON knowledge_idempotency FOR ALL
  USING (auth.role() = 'service_role');

-- Audit: user can view their own audit logs
DROP POLICY IF EXISTS "Users view own audit" ON knowledge_audit_log;
CREATE POLICY "Users view own audit"
  ON knowledge_audit_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages audit" ON knowledge_audit_log;
CREATE POLICY "Service role manages audit"
  ON knowledge_audit_log FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- STORAGE BUCKET
-- ============================================================================

-- Create storage bucket for knowledge documents (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-documents', 'knowledge-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for knowledge-documents bucket
DROP POLICY IF EXISTS "Users can upload knowledge documents" ON storage.objects;
CREATE POLICY "Users can upload knowledge documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'knowledge-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view own knowledge documents" ON storage.objects;
CREATE POLICY "Users can view own knowledge documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'knowledge-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own knowledge documents" ON storage.objects;
CREATE POLICY "Users can delete own knowledge documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'knowledge-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
