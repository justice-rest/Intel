/**
 * Knowledge System Configuration
 *
 * Constants, limits, and settings for the organizational knowledge system.
 */

import type { TokenBudget } from './types'

// ============================================================================
// LIMITS
// ============================================================================

/** Maximum knowledge profiles per user */
export const MAX_PROFILES_PER_USER = 5

/** Maximum documents per profile */
export const MAX_DOCUMENTS_PER_PROFILE = 50

/** Maximum total storage per user (in bytes) - 500MB */
export const MAX_STORAGE_PER_USER = 500 * 1024 * 1024

/** Maximum file size per document (in bytes) - 50MB */
export const MAX_FILE_SIZE = 50 * 1024 * 1024

/** Maximum daily document uploads */
export const MAX_DAILY_UPLOADS = 10

/** Maximum voice elements per profile */
export const MAX_VOICE_ELEMENTS_PER_PROFILE = 50

/** Maximum strategy rules per profile */
export const MAX_STRATEGY_RULES_PER_PROFILE = 100

/** Maximum facts per profile */
export const MAX_FACTS_PER_PROFILE = 500

/** Maximum examples per profile */
export const MAX_EXAMPLES_PER_PROFILE = 50

/** Maximum characters per fact */
export const MAX_FACT_LENGTH = 1000

/** Maximum characters per rule */
export const MAX_RULE_LENGTH = 500

/** Maximum characters per example output */
export const MAX_EXAMPLE_OUTPUT_LENGTH = 2000

// ============================================================================
// TOKEN BUDGET
// ============================================================================

/** Token budget for generated prompts */
export const TOKEN_BUDGET: TokenBudget = {
  voice: 200,
  strategy: 300,
  knowledge: 500,
  rules: 150,
  examples: 500,
  total: 1650,
}

/** Warning threshold (percentage of total budget) */
export const TOKEN_WARNING_THRESHOLD = 0.9 // 90%

// ============================================================================
// EMBEDDING CONFIGURATION
// ============================================================================

/** Embedding model for knowledge facts */
export const EMBEDDING_MODEL = 'text-embedding-3-small'

/** Embedding dimensions */
export const EMBEDDING_DIMENSIONS = 1536

/** Batch size for embedding generation */
export const EMBEDDING_BATCH_SIZE = 50

/** Maximum daily embedding operations */
export const MAX_DAILY_EMBEDDINGS = 500

/** Embedding cache TTL (1 hour) */
export const EMBEDDING_CACHE_TTL = 60 * 60 * 1000

// ============================================================================
// PROCESSING CONFIGURATION
// ============================================================================

/** AI model for document analysis */
export const ANALYSIS_MODEL = 'openrouter:openai/gpt-4o-mini'

/** Maximum tokens for analysis requests */
export const ANALYSIS_MAX_TOKENS = 4000

/** Analysis request timeout (ms) */
export const ANALYSIS_TIMEOUT = 60000

/** Minimum confidence for extracted elements */
export const MIN_EXTRACTION_CONFIDENCE = 0.6

/** Maximum retries for failed analysis */
export const MAX_ANALYSIS_RETRIES = 3

// ============================================================================
// DOCUMENT PROCESSING
// ============================================================================

/** Supported file types */
export const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/plain',
  'text/markdown',
] as const

/** Alias for document upload validation */
export const ALLOWED_FILE_TYPES = [...SUPPORTED_FILE_TYPES] as string[]

/** File type to extension mapping */
export const FILE_TYPE_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'text/markdown': '.md',
}

/** Maximum pages to process per document */
export const MAX_PAGES_TO_PROCESS = 100

/** Maximum characters to extract per document */
export const MAX_CHARS_TO_EXTRACT = 100000

// ============================================================================
// CACHING
// ============================================================================

/** Profile cache TTL (5 minutes) */
export const PROFILE_CACHE_TTL = 5 * 60 * 1000

/** Generated prompt cache TTL (15 minutes) */
export const PROMPT_CACHE_TTL = 15 * 60 * 1000

/** Idempotency key TTL (24 hours) */
export const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000

// ============================================================================
// RATE LIMITING
// ============================================================================

/** Daily analysis operations limit */
export const DAILY_ANALYSIS_LIMIT = 20

/** Daily prompt generation limit */
export const DAILY_GENERATION_LIMIT = 50

/** Daily preview requests limit */
export const DAILY_PREVIEW_LIMIT = 100

// ============================================================================
// UI CONFIGURATION
// ============================================================================

/** Default items per page in lists */
export const DEFAULT_PAGE_SIZE = 20

/** Maximum items to show in compact views */
export const COMPACT_VIEW_LIMIT = 5

/** Search debounce delay (ms) */
export const SEARCH_DEBOUNCE_MS = 300

// ============================================================================
// STORAGE
// ============================================================================

/** Supabase storage bucket name */
export const STORAGE_BUCKET = 'knowledge-documents'

/** File path pattern: {user_id}/{profile_id}/{filename} */
export const getStoragePath = (
  userId: string,
  profileId: string,
  filename: string
): string => {
  return `${userId}/${profileId}/${filename}`
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if file type is supported
 */
export const isSupportedFileType = (mimeType: string): boolean => {
  return SUPPORTED_FILE_TYPES.includes(mimeType as (typeof SUPPORTED_FILE_TYPES)[number])
}

/**
 * Check if file size is within limit
 */
export const isFileSizeValid = (bytes: number): boolean => {
  return bytes <= MAX_FILE_SIZE
}

/**
 * Get human-readable file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Calculate token estimate for text
 * Rough estimate: ~4 characters per token for English
 */
export const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4)
}

/**
 * Check if tokens are within budget
 */
export const isWithinTokenBudget = (
  section: keyof TokenBudget,
  tokens: number
): boolean => {
  if (section === 'total') {
    return tokens <= TOKEN_BUDGET.total
  }
  return tokens <= TOKEN_BUDGET[section]
}

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  PROFILE_LIMIT_REACHED: `You've reached the maximum of ${MAX_PROFILES_PER_USER} profiles`,
  DOCUMENT_LIMIT_REACHED: `This profile has reached the maximum of ${MAX_DOCUMENTS_PER_PROFILE} documents`,
  STORAGE_LIMIT_REACHED: 'You\'ve reached your storage limit',
  FILE_TOO_LARGE: `File exceeds the maximum size of ${formatFileSize(MAX_FILE_SIZE)}`,
  UNSUPPORTED_FILE_TYPE: 'This file type is not supported',
  DAILY_UPLOAD_LIMIT: `You've reached the daily upload limit of ${MAX_DAILY_UPLOADS} documents`,
  DAILY_ANALYSIS_LIMIT: `You've reached the daily analysis limit of ${DAILY_ANALYSIS_LIMIT} operations`,
  TOKEN_BUDGET_EXCEEDED: 'Generated prompt exceeds the token budget',
  PROFILE_NOT_FOUND: 'Knowledge profile not found',
  DOCUMENT_NOT_FOUND: 'Document not found',
  UNAUTHORIZED: 'You do not have permission to access this resource',
  PROCESSING_FAILED: 'Document processing failed. Please try again.',
} as const

// ============================================================================
// SUCCESS MESSAGES
// ============================================================================

export const SUCCESS_MESSAGES = {
  PROFILE_CREATED: 'Knowledge profile created successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
  PROFILE_DELETED: 'Profile deleted successfully',
  DOCUMENT_UPLOADED: 'Document uploaded successfully',
  DOCUMENT_ANALYZED: 'Document analyzed successfully',
  DOCUMENT_DELETED: 'Document deleted successfully',
  PROMPT_GENERATED: 'Knowledge prompt generated successfully',
  ELEMENT_SAVED: 'Changes saved successfully',
} as const
