/**
 * RAG (Retrieval-Augmented Generation) Configuration
 */

// ============================================================================
// RATE LIMITS (Ultra Plan Only)
// ============================================================================

export const RAG_DOCUMENT_LIMIT = 50 // Max documents per user
export const RAG_STORAGE_LIMIT = 500 * 1024 * 1024 // 500MB total storage per user
export const RAG_DAILY_UPLOAD_LIMIT = 10 // Max uploads per day
export const RAG_MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB per file

// ============================================================================
// CHUNKING PARAMETERS
// ============================================================================

export const RAG_CHUNK_SIZE = 500 // Tokens per chunk
export const RAG_CHUNK_OVERLAP = 75 // Token overlap between chunks (15%)
export const RAG_MAX_CHUNK_SIZE = 800 // Safety limit for embedding API

// ============================================================================
// SEARCH PARAMETERS
// ============================================================================

export const RAG_MAX_RESULTS = 5 // Number of chunks to return per search
export const RAG_SIMILARITY_THRESHOLD = 0.5 // Minimum cosine similarity (0-1) - 0.5 allows broader matches

// ============================================================================
// EMBEDDING MODEL CONFIGURATION
// ============================================================================

// Primary: Google Gemini Embedding 001 via OpenRouter
export const RAG_EMBEDDING_MODEL = "google/gemini-embedding-001"
export const RAG_EMBEDDING_DIMENSIONS_FULL = 3072 // Full Gemini dimensions
export const RAG_EMBEDDING_DIMENSIONS = 1536 // Truncated to fit pgvector 2000 limit

// Fallback: OpenAI text-embedding-3-large via OpenRouter
export const RAG_EMBEDDING_MODEL_FALLBACK = "openai/text-embedding-3-large"

// OpenRouter API base URL
export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1"

// ============================================================================
// ALLOWED FILE TYPES
// ============================================================================

export const RAG_ALLOWED_FILE_TYPES = [
  "application/pdf",
] as const

export const RAG_ALLOWED_FILE_EXTENSIONS = [
  ".pdf",
] as const

// ============================================================================
// PROCESSING CONFIGURATION
// ============================================================================

// Maximum number of chunks to embed in a single batch
export const RAG_EMBEDDING_BATCH_SIZE = 100

// Retry configuration for embedding API
export const RAG_EMBEDDING_MAX_RETRIES = 3
export const RAG_EMBEDDING_RETRY_DELAY = 1000 // ms (will use exponential backoff)

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if RAG features are enabled
 * RAG requires Supabase for storage and vector search
 */
export function isRAGEnabled(): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const openrouterKey = process.env.OPENROUTER_API_KEY

  return Boolean(supabaseUrl && supabaseAnonKey && openrouterKey)
}

/**
 * Get the effective embedding model to use
 * Tries primary model first, falls back to secondary if needed
 */
export function getEmbeddingModel(): string {
  // For now, always use the primary model
  // In the future, we could add logic to switch based on availability
  return RAG_EMBEDDING_MODEL
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
}

/**
 * Calculate remaining storage for a user
 */
export function getRemainingStorage(usedBytes: number): number {
  return Math.max(0, RAG_STORAGE_LIMIT - usedBytes)
}

/**
 * Calculate percentage of storage used
 */
export function getStoragePercentage(usedBytes: number): number {
  return Math.round((usedBytes / RAG_STORAGE_LIMIT) * 100)
}
