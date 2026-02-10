-- ============================================================================
-- Migration: 027_add_personas_system.sql
-- Description: Personas and Chat Configuration System
--
-- This migration adds:
-- 1. PERSONAS - Reusable AI configurations with custom prompts and behavior
-- 2. CHAT_CONFIG - Per-chat persona and knowledge profile assignments
-- ============================================================================

-- ============================================================================
-- PERSONAS SYSTEM
-- ============================================================================
-- Personas are reusable AI configurations that define communication style,
-- specialized knowledge, and behavior for different use cases:
-- - "Major Gifts Specialist" - formal tone, focus on 6-7 figure asks
-- - "Grant Writer" - proposal writing, LOI drafts
-- - "Annual Fund Rep" - casual tone, recurring donors
-- - "Board Relations" - executive communication style
-- - "Donor Research Analyst" - data-focused, citations heavy

CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Basic Info
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'user', -- Icon identifier for UI
  color TEXT DEFAULT '#6366f1', -- Hex color for UI

  -- System Prompt Configuration
  -- system_prompt_mode determines how the prompt is applied:
  -- - 'full': Complete replacement of default system prompt
  -- - 'prepend': Add before default system prompt
  -- - 'append': Add after default system prompt
  -- - 'inject': Inject at specific marker in default prompt
  system_prompt TEXT,
  system_prompt_mode TEXT DEFAULT 'append' CHECK (
    system_prompt_mode IN ('full', 'prepend', 'append', 'inject')
  ),

  -- Link to Knowledge Profile (optional)
  -- When set, this persona uses the specified knowledge profile
  knowledge_profile_id UUID REFERENCES knowledge_profiles(id) ON DELETE SET NULL,

  -- Voice & Communication Style (overrides knowledge profile if set)
  voice_config JSONB DEFAULT '{}'::jsonb,
  -- Structure:
  -- {
  --   "tone": "formal" | "conversational" | "professional" | "warm",
  --   "formality_level": 1-5,
  --   "use_emojis": boolean,
  --   "signature": string (optional closing signature),
  --   "greeting_style": string
  -- }

  -- Capability Configuration
  capabilities JSONB DEFAULT '{}'::jsonb,
  -- Structure:
  -- {
  --   "tools_enabled": string[] | "all" | "none",
  --   "tools_disabled": string[],
  --   "enable_search": boolean,
  --   "enable_memory": boolean,
  --   "max_tool_steps": number
  -- }

  -- Context injection (additional context always included)
  context_injection TEXT,

  -- Model preferences (optional override)
  preferred_model TEXT,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  is_default BOOLEAN DEFAULT false,

  -- Soft delete for GDPR compliance
  deleted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure unique names per user (partial unique index for soft delete support)
CREATE UNIQUE INDEX IF NOT EXISTS idx_personas_unique_name_per_user
  ON personas(user_id, name)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE personas IS 'Reusable AI personas with custom prompts, voice, and behavior settings';
COMMENT ON COLUMN personas.system_prompt_mode IS 'How to apply custom prompt: full replacement, prepend, append, or inject';
COMMENT ON COLUMN personas.voice_config IS 'JSONB config for communication style (tone, formality, etc.)';
COMMENT ON COLUMN personas.capabilities IS 'JSONB config for tool access and feature toggles';

-- Ensure only one default persona per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_personas_default_per_user
  ON personas(user_id)
  WHERE is_default = true AND deleted_at IS NULL;

-- ============================================================================
-- CHAT CONFIGURATION
-- ============================================================================
-- Per-chat settings for persona and knowledge profile assignment
-- Extends chats table with nullable FKs for backward compatibility

-- Add persona and knowledge profile columns to chats table
ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS knowledge_profile_id UUID REFERENCES knowledge_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_system_prompt TEXT;

COMMENT ON COLUMN chats.persona_id IS 'Optional persona assigned to this chat';
COMMENT ON COLUMN chats.knowledge_profile_id IS 'Optional knowledge profile (overrides persona''s profile)';
COMMENT ON COLUMN chats.custom_system_prompt IS 'Custom system prompt for this specific chat';

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_chats_persona ON chats(persona_id) WHERE persona_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chats_knowledge_profile ON chats(knowledge_profile_id) WHERE knowledge_profile_id IS NOT NULL;

-- ============================================================================
-- PERSONA TEMPLATES (System-provided starting points)
-- ============================================================================

CREATE TABLE IF NOT EXISTS persona_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT DEFAULT 'user',
  color TEXT DEFAULT '#6366f1',

  -- Template configuration
  system_prompt TEXT,
  system_prompt_mode TEXT DEFAULT 'append',
  voice_config JSONB DEFAULT '{}'::jsonb,
  capabilities JSONB DEFAULT '{}'::jsonb,
  context_injection TEXT,

  -- Categorization
  category TEXT NOT NULL CHECK (category IN (
    'fundraising',    -- Major gifts, annual fund, etc.
    'communication',  -- Email, proposals, etc.
    'research',       -- Prospect research, wealth screening
    'strategy',       -- Campaign planning, asks
    'general'         -- General purpose
  )),

  -- For ordering in UI
  display_order INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE persona_templates IS 'System-provided persona templates users can clone';

-- Insert default persona templates
INSERT INTO persona_templates (name, description, icon, color, category, system_prompt, voice_config, display_order)
VALUES
  (
    'Major Gifts Specialist',
    'Focused on high-capacity donors and 6-7 figure gift opportunities. Formal tone with emphasis on relationship cultivation and strategic asks.',
    'crown',
    '#f59e0b',
    'fundraising',
    E'## Major Gifts Specialist Mode\n\nYou are now operating as a major gifts specialist. Your focus is on:\n\n1. **High-capacity donors** ($100K+ potential)\n2. **Relationship cultivation** over transactional giving\n3. **Strategic gift conversations** - never rush the ask\n4. **Personalized engagement** - remember donor interests and history\n\n### Communication Style\n- Formal but warm tone\n- Executive-level language\n- Focus on impact and legacy\n- Reference donor''s previous involvement\n\n### Key Principles\n- Every interaction builds toward transformational giving\n- Listen more than you speak\n- Connect giving to donor''s values and passions\n- Think in terms of gift planning, not just annual fund',
    '{"tone": "professional", "formality_level": 4, "use_emojis": false}',
    1
  ),
  (
    'Grant Writer',
    'Specialized in foundation and government grant proposals. Clear, compelling narratives with strong data support.',
    'file-text',
    '#3b82f6',
    'communication',
    E'## Grant Writing Specialist Mode\n\nYou are now operating as an expert grant writer. Your focus is on:\n\n1. **Compelling narratives** that connect mission to funder priorities\n2. **Data-driven arguments** with clear metrics and outcomes\n3. **Precise language** - every word counts in limited space\n4. **Funder alignment** - tailor each proposal to specific guidelines\n\n### Writing Style\n- Clear, concise prose\n- Active voice preferred\n- Specific, measurable outcomes\n- Strong opening hooks\n\n### Key Principles\n- Start with the funder''s priorities, not your needs\n- Use concrete examples and stories\n- Budget must align with narrative\n- Follow guidelines exactly',
    '{"tone": "professional", "formality_level": 4, "use_emojis": false}',
    2
  ),
  (
    'Annual Fund Coordinator',
    'Casual, friendly tone for recurring donors and broad-based appeals. Focus on accessibility and gratitude.',
    'heart',
    '#ec4899',
    'fundraising',
    E'## Annual Fund Coordinator Mode\n\nYou are now operating as an annual fund coordinator. Your focus is on:\n\n1. **Broad-based appeals** to diverse donor segments\n2. **Recurring giving programs** and monthly donors\n3. **Donor retention** and stewardship\n4. **Accessible messaging** for all giving levels\n\n### Communication Style\n- Warm and approachable\n- Gratitude-forward messaging\n- Clear calls to action\n- Personal connection even at scale\n\n### Key Principles\n- Every gift matters regardless of size\n- Make giving easy and rewarding\n- Celebrate milestones and anniversaries\n- Build habit of giving through recurring programs',
    '{"tone": "warm", "formality_level": 2, "use_emojis": true}',
    3
  ),
  (
    'Prospect Researcher',
    'Data-focused analysis mode. Heavy emphasis on citations, verification, and structured wealth screening.',
    'search',
    '#10b981',
    'research',
    E'## Prospect Research Analyst Mode\n\nYou are now operating as a prospect research analyst. Your focus is on:\n\n1. **Comprehensive wealth screening** using all available data sources\n2. **Citation and verification** - every claim needs a source\n3. **Structured output** - capacity ratings, affinity markers, gift history\n4. **APRA ethical guidelines** compliance\n\n### Research Standards\n- Primary sources > secondary sources\n- Clearly mark estimates vs. confirmed data\n- Use [Estimated] tags for calculated values\n- Include confidence levels\n\n### Key Principles\n- Data integrity is paramount\n- Never fabricate or assume\n- Cross-reference multiple sources\n- Protect donor privacy - need-to-know basis',
    '{"tone": "professional", "formality_level": 4, "use_emojis": false}',
    4
  ),
  (
    'Board Relations',
    'Executive communication style for board members and C-suite donors. Polished, strategic, concise.',
    'briefcase',
    '#6366f1',
    'communication',
    E'## Board Relations Specialist Mode\n\nYou are now operating as a board relations specialist. Your focus is on:\n\n1. **Executive-level communication** - concise, strategic, impactful\n2. **Governance and stewardship** - keeping board engaged and informed\n3. **Strategic alignment** - connecting board giving to organizational vision\n4. **Peer-to-peer cultivation** - board member as fundraiser\n\n### Communication Style\n- Polished executive prose\n- Bullet points and summaries\n- Data highlights, not details\n- Action-oriented recommendations\n\n### Key Principles\n- Respect their time - be concise\n- Lead with impact and outcomes\n- Provide context for decisions\n- Enable them to be ambassadors',
    '{"tone": "formal", "formality_level": 5, "use_emojis": false}',
    5
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Persona indexes
CREATE INDEX IF NOT EXISTS idx_personas_user_active
  ON personas(user_id)
  WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_personas_knowledge_profile
  ON personas(knowledge_profile_id)
  WHERE knowledge_profile_id IS NOT NULL;

-- Template index
CREATE INDEX IF NOT EXISTS idx_persona_templates_category
  ON persona_templates(category, display_order);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp for personas
DROP TRIGGER IF EXISTS update_personas_updated_at ON personas;
CREATE TRIGGER update_personas_updated_at
  BEFORE UPDATE ON personas
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_templates ENABLE ROW LEVEL SECURITY;

-- Personas: users manage their own
DROP POLICY IF EXISTS "Users manage own personas" ON personas;
CREATE POLICY "Users manage own personas"
  ON personas FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages personas" ON personas;
CREATE POLICY "Service role manages personas"
  ON personas FOR ALL
  USING (auth.role() = 'service_role');

-- Persona templates: readable by all authenticated users
DROP POLICY IF EXISTS "Authenticated users read templates" ON persona_templates;
CREATE POLICY "Authenticated users read templates"
  ON persona_templates FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role manages templates" ON persona_templates;
CREATE POLICY "Service role manages templates"
  ON persona_templates FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get effective system prompt for a chat
-- Combines default prompt + persona prompt + knowledge profile + chat override
CREATE OR REPLACE FUNCTION get_effective_chat_config(p_chat_id UUID)
RETURNS TABLE (
  persona_id UUID,
  persona_name TEXT,
  persona_system_prompt TEXT,
  persona_prompt_mode TEXT,
  knowledge_profile_id UUID,
  knowledge_prompt TEXT,
  custom_system_prompt TEXT,
  voice_config JSONB,
  capabilities JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS persona_id,
    p.name AS persona_name,
    p.system_prompt AS persona_system_prompt,
    p.system_prompt_mode AS persona_prompt_mode,
    COALESCE(c.knowledge_profile_id, p.knowledge_profile_id) AS knowledge_profile_id,
    kp.knowledge_prompt,
    c.custom_system_prompt,
    p.voice_config,
    p.capabilities
  FROM chats c
  LEFT JOIN personas p ON c.persona_id = p.id AND p.deleted_at IS NULL
  LEFT JOIN knowledge_profiles kp ON
    COALESCE(c.knowledge_profile_id, p.knowledge_profile_id) = kp.id
    AND kp.deleted_at IS NULL
    AND kp.status = 'active'
  WHERE c.id = p_chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to copy persona from template
CREATE OR REPLACE FUNCTION copy_persona_from_template(
  p_user_id UUID,
  p_template_id UUID,
  p_custom_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_new_id UUID;
  v_template persona_templates%ROWTYPE;
BEGIN
  SELECT * INTO v_template FROM persona_templates WHERE id = p_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found: %', p_template_id;
  END IF;

  INSERT INTO personas (
    user_id, name, description, icon, color,
    system_prompt, system_prompt_mode, voice_config,
    capabilities, status
  )
  VALUES (
    p_user_id,
    COALESCE(p_custom_name, v_template.name),
    v_template.description,
    v_template.icon,
    v_template.color,
    v_template.system_prompt,
    v_template.system_prompt_mode,
    v_template.voice_config,
    v_template.capabilities,
    'active'
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_effective_chat_config(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION copy_persona_from_template(UUID, UUID, TEXT) TO authenticated;
