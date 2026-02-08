/**
 * Memory System Configuration
 *
 * Configuration for AI memory storage, retrieval, and management
 */

// ============================================================================
// FEATURE FLAGS
// ============================================================================

/**
 * Check if memory system is enabled
 * Memory is enabled by default but can be disabled via env variable
 */
export function isMemoryEnabled(): boolean {
  // Enable by default, allow opt-out
  return process.env.ENABLE_MEMORY !== "false"
}

// ============================================================================
// MEMORY LIMITS
// ============================================================================

/**
 * Maximum number of memories per user
 */
export const MAX_MEMORIES_PER_USER = 1000

/**
 * Maximum memory content length (characters)
 */
export const MAX_MEMORY_CONTENT_LENGTH = 500

/**
 * Daily limit for memory operations (create/update/delete)
 */
export const DAILY_MEMORY_OPERATIONS_LIMIT = 100

// ============================================================================
// RETRIEVAL CONFIGURATION
// ============================================================================

/**
 * Default number of memories to auto-inject into context
 */
export const AUTO_INJECT_MEMORY_COUNT = 5

/**
 * Default similarity threshold for memory search (0-1)
 */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.5

/**
 * Minimum importance score for auto-injection (0-1)
 */
export const AUTO_INJECT_MIN_IMPORTANCE = 0.3

/**
 * Maximum number of memories to return from search
 */
export const MAX_SEARCH_RESULTS = 20

// ============================================================================
// EXTRACTION CONFIGURATION
// ============================================================================

/**
 * Minimum importance score for auto-extracted memories
 */
export const AUTO_EXTRACT_MIN_IMPORTANCE = 0.4

/**
 * Importance score for explicitly saved memories ("remember this")
 */
export const EXPLICIT_MEMORY_IMPORTANCE = 0.9

/**
 * Patterns to detect explicit memory commands
 */
export const EXPLICIT_MEMORY_PATTERNS = [
  /remember (?:that |this[:;,. ]*)?(.+)/i,
  /(?:please )?save (?:to memory |this[:;,. ]*)(?:that |this[:;,. ]*)?(.+)/i,
  /(?:don't |never )forget (?:that |this[:;,. ]*)?(.+)/i,
  /keep in mind (?:that |this[:;,. ]*)?(.+)/i,
  /note (?:that |this[:;,. ]*)?(.+)/i,
  /i (?:like|love|prefer|enjoy|hate|dislike) (.+)/i,
]

// ============================================================================
// EMBEDDING CONFIGURATION
// ============================================================================

/**
 * Vector embedding dimensions
 * Using 1536 to match RAG system (OpenRouter embeddings)
 */
export const EMBEDDING_DIMENSIONS = 1536

/**
 * Embedding model to use for memory vectors
 * Using same model as RAG for consistency
 */
export const EMBEDDING_MODEL = "text-embedding-3-small"

/**
 * Provider for embedding generation
 */
export const EMBEDDING_PROVIDER = "openrouter"

// ============================================================================
// MEMORY CATEGORIES
// ============================================================================

/**
 * Standard memory categories for organization
 */
export const MEMORY_CATEGORIES = {
  USER_INFO: "user_info", // Name, preferences, personal details
  PREFERENCES: "preferences", // Settings, likes/dislikes
  CONTEXT: "context", // Ongoing projects, goals
  RELATIONSHIPS: "relationships", // People, organizations
  SKILLS: "skills", // Expertise, abilities
  HISTORY: "history", // Past conversations, events
  FACTS: "facts", // Specific facts to remember
  OTHER: "other", // Uncategorized
} as const

export type MemoryCategory =
  (typeof MEMORY_CATEGORIES)[keyof typeof MEMORY_CATEGORIES]

// ============================================================================
// MEMORY SCORING WEIGHTS
// ============================================================================

/**
 * Weight for similarity score in final ranking (0-1)
 */
export const SIMILARITY_WEIGHT = 0.7

/**
 * Weight for importance score in final ranking (0-1)
 */
export const IMPORTANCE_WEIGHT = 0.3

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

/**
 * How long to cache memory search results (milliseconds)
 */
export const MEMORY_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * How long to cache embeddings (milliseconds)
 */
export const EMBEDDING_CACHE_TTL = 60 * 60 * 1000 // 1 hour
