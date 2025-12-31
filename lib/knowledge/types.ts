/**
 * Knowledge System Types
 *
 * Type definitions for the organizational knowledge system that enables
 * personalized AI fundraising assistants.
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const PROFILE_STATUS = ['draft', 'active', 'archived'] as const
export type ProfileStatus = (typeof PROFILE_STATUS)[number]

export const DOCUMENT_STATUS = ['pending', 'processing', 'analyzed', 'failed'] as const
export type DocumentStatus = (typeof DOCUMENT_STATUS)[number]

export const DOCUMENT_PURPOSE = ['voice', 'strategy', 'knowledge', 'examples'] as const
export type DocumentPurpose = (typeof DOCUMENT_PURPOSE)[number]

export const VOICE_ELEMENT_TYPE = [
  'tone',
  'formality',
  'terminology',
  'sentence_style',
  'emotional_register',
  'word_preference',
  'word_avoidance',
] as const
export type VoiceElementType = (typeof VOICE_ELEMENT_TYPE)[number]

export const STRATEGY_CATEGORY = [
  'cultivation',
  'solicitation',
  'stewardship',
  'objection_handling',
  'ask_philosophy',
  'donor_segmentation',
  'communication',
  'general',
] as const
export type StrategyCategory = (typeof STRATEGY_CATEGORY)[number]

export const FACT_CATEGORY = [
  'organization',
  'mission',
  'programs',
  'impact',
  'staff',
  'board',
  'donors',
  'campaigns',
  'history',
  'values',
] as const
export type FactCategory = (typeof FACT_CATEGORY)[number]

export const EXAMPLE_TYPE = ['good', 'bad', 'template'] as const
export type ExampleType = (typeof EXAMPLE_TYPE)[number]

export const SOURCE_TYPE = ['extracted', 'user_defined', 'feedback_derived'] as const
export type SourceType = (typeof SOURCE_TYPE)[number]

export const EXAMPLE_SOURCE_TYPE = ['manual', 'conversation', 'document'] as const
export type ExampleSourceType = (typeof EXAMPLE_SOURCE_TYPE)[number]

export const FEEDBACK_TYPE = [
  'voice_mismatch',
  'strategy_wrong',
  'knowledge_incorrect',
  'too_generic',
  'excellent',
  'other',
] as const
export type FeedbackType = (typeof FEEDBACK_TYPE)[number]

export const CHANGE_BY = ['user', 'auto', 'feedback'] as const
export type ChangeBy = (typeof CHANGE_BY)[number]

// ============================================================================
// DATABASE TYPES
// ============================================================================

/**
 * Knowledge Profile - Master container for organizational knowledge
 */
export interface KnowledgeProfile {
  id: string
  user_id: string
  name: string
  description: string | null
  version: number
  parent_version_id: string | null
  voice_prompt: string | null
  strategy_prompt: string | null
  knowledge_prompt: string | null
  rules_prompt: string | null
  prompt_generated_at: string | null
  prompt_token_count: number | null
  status: ProfileStatus
  deleted_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Knowledge Document - Uploaded source documents
 */
export interface KnowledgeDocument {
  id: string
  user_id: string
  profile_id: string
  file_name: string
  file_url: string
  file_size: number
  file_type: string
  status: DocumentStatus
  error_message: string | null
  doc_purpose: DocumentPurpose[]
  raw_text: string | null
  page_count: number | null
  word_count: number | null
  analysis_results: DocumentAnalysisResults
  deleted_at: string | null
  created_at: string
  processed_at: string | null
}

/**
 * Voice Element - Extracted voice/style characteristics
 */
export interface KnowledgeVoiceElement {
  id: string
  profile_id: string
  element_type: VoiceElementType
  value: string
  description: string | null
  confidence: number
  source_document_id: string | null
  source_excerpt: string | null
  is_user_defined: boolean
  is_active: boolean
  created_at: string
}

/**
 * Strategy Rule - Fundraising approach rules
 */
export interface KnowledgeStrategyRule {
  id: string
  profile_id: string
  category: StrategyCategory
  rule: string
  rationale: string | null
  priority: number
  source_type: SourceType
  source_document_id: string | null
  is_active: boolean
  created_at: string
}

/**
 * Knowledge Fact - Organizational facts
 */
export interface KnowledgeFact {
  id: string
  profile_id: string
  category: FactCategory
  fact: string
  importance: number
  valid_from: string | null
  valid_until: string | null
  source_document_id: string | null
  is_user_defined: boolean
  is_active: boolean
  embedding: number[] | null
  created_at: string
}

/**
 * Knowledge Example - Few-shot learning examples
 */
export interface KnowledgeExample {
  id: string
  profile_id: string
  example_type: ExampleType
  category: string
  title: string | null
  context: string | null
  input: string | null
  output: string
  explanation: string | null
  source_type: ExampleSourceType
  source_document_id: string | null
  source_chat_id: string | null
  is_active: boolean
  created_at: string
}

/**
 * Knowledge Feedback - User feedback on AI responses
 */
export interface KnowledgeFeedback {
  id: string
  user_id: string
  profile_id: string | null
  message_id: number | null
  chat_id: string | null
  rating: number | null
  feedback_type: FeedbackType | null
  comment: string | null
  preferred_response: string | null
  incorporated: boolean
  incorporated_at: string | null
  created_at: string
}

/**
 * Profile Version - Version snapshots for rollback
 */
export interface KnowledgeProfileVersion {
  id: string
  profile_id: string
  version: number
  voice_prompt: string | null
  strategy_prompt: string | null
  knowledge_prompt: string | null
  rules_prompt: string | null
  change_summary: string | null
  changed_by: ChangeBy | null
  created_at: string
}

/**
 * Audit Log Entry
 */
export interface KnowledgeAuditLog {
  id: string
  user_id: string
  profile_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}

// ============================================================================
// ANALYSIS RESULT TYPES
// ============================================================================

/**
 * Voice analysis results from AI processing
 */
export interface VoiceAnalysisResult {
  tone: {
    value: 'formal' | 'conversational' | 'professional' | 'warm' | 'academic'
    confidence: number
    evidence: string[]
  }
  formality: {
    level: 1 | 2 | 3 | 4 | 5 // 1 = very casual, 5 = very formal
    indicators: string[]
  }
  terminology: {
    preferred: Array<{ term: string; frequency: number; context?: string }>
    avoided: Array<{ term: string; replacement?: string }>
    domain_specific: string[]
    organization_specific: string[]
  }
  sentence_patterns: {
    avg_length: number
    complexity: 'simple' | 'moderate' | 'complex'
    examples: string[]
  }
  emotional_register: {
    warmth: number // 0-1
    urgency: number // 0-1
    gratitude: number // 0-1
    formality: number // 0-1
  }
}

/**
 * Strategy extraction results
 */
export interface StrategyExtractionResult {
  rules: Array<{
    category: StrategyCategory
    rule: string
    rationale: string
    priority: number
    source_excerpt: string
  }>
  patterns: Array<{
    pattern: string
    description: string
    examples: string[]
  }>
}

/**
 * Knowledge fact extraction results
 */
export interface KnowledgeExtractionResult {
  facts: Array<{
    category: FactCategory
    fact: string
    importance: number
    source_excerpt: string
  }>
}

/**
 * Example parsing results
 */
export interface ExampleParsingResult {
  examples: Array<{
    type: ExampleType
    category: string
    title: string
    context: string
    input: string
    output: string
    explanation: string
  }>
}

/**
 * Combined document analysis results (stored in database)
 */
export interface DocumentAnalysisResults {
  voice?: VoiceAnalysisResult
  strategy?: StrategyExtractionResult
  knowledge?: KnowledgeExtractionResult
  examples?: ExampleParsingResult
  processed_at?: string
  processor_version?: string
}

/**
 * Extracted voice element from AI analysis
 */
export interface ExtractedVoiceElement {
  element_type: VoiceElementType
  value: string
  description?: string
  confidence: number
  source_excerpt?: string
}

/**
 * Extracted strategy rule from AI analysis
 */
export interface ExtractedStrategyRule {
  category: StrategyCategory
  rule: string
  rationale?: string
  priority: number
}

/**
 * Extracted fact from AI analysis
 */
export interface ExtractedFact {
  category: FactCategory
  fact: string
  importance: number
}

/**
 * Extracted example from AI analysis
 */
export interface ExtractedExample {
  example_type: 'good' | 'bad' | 'template'
  category: string
  title?: string
  context?: string
  input?: string
  output: string
  explanation?: string
}

/**
 * Processor output format (from document analyzer)
 */
export interface ProcessorAnalysisResults {
  voice_elements: ExtractedVoiceElement[]
  strategy_rules: ExtractedStrategyRule[]
  facts: ExtractedFact[]
  examples: ExtractedExample[]
  summary: string
  document_type: string
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Create profile request
 */
export interface CreateProfileRequest {
  name: string
  description?: string
}

/**
 * Update profile request
 */
export interface UpdateProfileRequest {
  name?: string
  description?: string
  status?: ProfileStatus
}

/**
 * Profile response with counts
 */
export interface ProfileWithCounts extends KnowledgeProfile {
  document_count: number
  voice_element_count: number
  strategy_rule_count: number
  fact_count: number
  example_count: number
}

/**
 * Document upload request
 */
export interface UploadDocumentRequest {
  profile_id: string
  file: File
  doc_purpose?: DocumentPurpose[]
}

/**
 * Analyze document request
 */
export interface AnalyzeDocumentRequest {
  document_id: string
  purposes?: DocumentPurpose[]
}

/**
 * Create voice element request
 */
export interface CreateVoiceElementRequest {
  profile_id: string
  element_type: VoiceElementType
  value: string
  description?: string
}

/**
 * Create strategy rule request
 */
export interface CreateStrategyRuleRequest {
  profile_id: string
  category: StrategyCategory
  rule: string
  rationale?: string
  priority?: number
}

/**
 * Create fact request
 */
export interface CreateFactRequest {
  profile_id: string
  category: FactCategory
  fact: string
  importance?: number
  valid_from?: string
  valid_until?: string
}

/**
 * Create example request
 */
export interface CreateExampleRequest {
  profile_id: string
  example_type: ExampleType
  category: string
  title?: string
  context?: string
  input?: string
  output: string
  explanation?: string
}

/**
 * Submit feedback request
 */
export interface SubmitFeedbackRequest {
  profile_id?: string
  message_id?: number
  chat_id?: string
  rating?: number
  feedback_type?: FeedbackType
  comment?: string
  preferred_response?: string
}

/**
 * Generate prompt request
 */
export interface GeneratePromptRequest {
  profile_id: string
  force?: boolean
}

/**
 * Preview request
 */
export interface PreviewRequest {
  profile_id: string
  test_prompt: string
}

/**
 * Preview response
 */
export interface PreviewResponse {
  response: string
  tokens_used: number
  profile_version: number
}

// ============================================================================
// GENERATED PROMPT TYPES
// ============================================================================

/**
 * Generated training prompt sections
 */
export interface GeneratedKnowledgePrompt {
  voice: string
  strategy: string
  knowledge: string
  rules: string
  examples: string
  total_tokens: number
  generated_at: string
  profile_version: number
}

/**
 * Token budget configuration
 */
export interface TokenBudget {
  voice: number
  strategy: number
  knowledge: number
  rules: number
  examples: number
  total: number
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

/**
 * Dashboard tab state
 */
export type DashboardTab =
  | 'documents'
  | 'voice'
  | 'strategy'
  | 'facts'
  | 'examples'
  | 'preview'

/**
 * Profile selector state
 */
export interface ProfileSelectorState {
  profiles: KnowledgeProfile[]
  activeProfileId: string | null
  isLoading: boolean
}

/**
 * Document list filters
 */
export interface DocumentFilters {
  status?: DocumentStatus
  purpose?: DocumentPurpose
  search?: string
}

/**
 * Fact list filters
 */
export interface FactFilters {
  category?: FactCategory
  importance_min?: number
  search?: string
}

/**
 * Strategy rule filters
 */
export interface StrategyFilters {
  category?: StrategyCategory
  priority_min?: number
  search?: string
}
