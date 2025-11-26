/**
 * Memory System Type Definitions
 */

import type { Json } from "@/app/types/database.types"
import type { MemoryCategory } from "./config"

// ============================================================================
// CORE MEMORY TYPES
// ============================================================================

/**
 * Memory type - how it was created
 */
export type MemoryType = "auto" | "explicit"

/**
 * Memory metadata structure
 */
export interface MemoryMetadata {
  /** Source chat ID where memory was created */
  source_chat_id?: string
  /** Source message ID */
  source_message_id?: number
  /** Memory category */
  category?: MemoryCategory
  /** Additional tags for organization */
  tags?: string[]
  /** Optional context about why this was saved */
  context?: string
  /** Original full text before extraction (for explicit memories) */
  original_text?: string
}

/**
 * User memory record (database row)
 */
export interface UserMemory {
  id: string
  user_id: string
  content: string
  memory_type: MemoryType
  importance_score: number
  metadata: Json
  embedding: string // JSON-encoded vector
  access_count: number
  last_accessed_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Memory to create (insert)
 */
export interface CreateMemory {
  user_id: string
  content: string
  memory_type?: MemoryType
  importance_score?: number
  metadata?: MemoryMetadata
  embedding: number[]
}

/**
 * Memory to update
 */
export interface UpdateMemory {
  content?: string
  importance_score?: number
  metadata?: MemoryMetadata
  embedding?: number[]
}

// ============================================================================
// SEARCH & RETRIEVAL TYPES
// ============================================================================

/**
 * Memory search result (from database function)
 */
export interface MemorySearchResult {
  id: string
  content: string
  memory_type: string
  importance_score: number
  metadata: Json
  similarity: number
  weighted_score: number
  created_at: string
  last_accessed_at: string | null
}

/**
 * Memory search parameters
 */
export interface MemorySearchParams {
  /** Query text to search for */
  query: string
  /** User ID to search memories for */
  userId: string
  /** Number of results to return */
  limit?: number
  /** Minimum similarity threshold (0-1) */
  similarityThreshold?: number
  /** Filter by memory type */
  memoryType?: MemoryType
  /** Minimum importance score */
  minImportance?: number
}

/**
 * Auto-injection parameters
 */
export interface AutoInjectParams {
  /** Current conversation messages */
  conversationContext: string
  /** User ID */
  userId: string
  /** Number of memories to inject */
  count?: number
  /** Minimum importance for injection */
  minImportance?: number
}

// ============================================================================
// EXTRACTION TYPES
// ============================================================================

/**
 * Extracted memory from conversation
 */
export interface ExtractedMemory {
  /** Memory content */
  content: string
  /** Importance score (0-1) */
  importance: number
  /** Memory category */
  category: MemoryCategory
  /** Additional tags */
  tags: string[]
  /** Context about extraction */
  context: string
}

/**
 * Extraction request
 */
export interface ExtractionRequest {
  /** Conversation messages to analyze */
  messages: Array<{
    role: string
    content: string
  }>
  /** User ID */
  userId: string
  /** Chat ID */
  chatId: string
}

/**
 * Extraction response
 */
export interface ExtractionResponse {
  /** Extracted memories */
  memories: ExtractedMemory[]
  /** Total number of memories extracted */
  count: number
}

// ============================================================================
// STATISTICS TYPES
// ============================================================================

/**
 * User memory statistics
 */
export interface MemoryStats {
  total_memories: number
  auto_memories: number
  explicit_memories: number
  avg_importance: number
  most_recent_memory: string | null
}

// ============================================================================
// API TYPES
// ============================================================================

/**
 * API request to create memory
 */
export interface CreateMemoryRequest {
  content: string
  memory_type?: MemoryType
  importance_score?: number
  metadata?: MemoryMetadata
}

/**
 * API response for memory operations
 */
export interface MemoryApiResponse {
  success: boolean
  memory?: UserMemory
  memories?: UserMemory[]
  error?: string
  message?: string
}

/**
 * API request to search memories
 */
export interface SearchMemoriesRequest {
  query: string
  limit?: number
  similarity_threshold?: number
  memory_type?: MemoryType
  min_importance?: number
}

/**
 * API response for memory search
 */
export interface SearchMemoriesResponse {
  success: boolean
  results?: MemorySearchResult[]
  count?: number
  error?: string
}
