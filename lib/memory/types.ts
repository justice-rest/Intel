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

// ============================================================================
// V2 ENTERPRISE MEMORY TYPES
// ============================================================================

/** Memory tier - determines storage and access strategy */
export type MemoryTier = "hot" | "warm" | "cold"

/** Memory kind - semantic classification */
export type MemoryKind = "episodic" | "semantic" | "procedural" | "profile"

/** Memory relation type */
export type MemoryRelationType = "updates" | "extends" | "derives" | "conflicts"

/** Entity type for knowledge graph */
export type EntityType = "person" | "organization" | "foundation"

/** Relation type for knowledge graph */
export type RelationType =
  | "works_at"
  | "board_member"
  | "donated_to"
  | "owns"
  | "founded"
  | "affiliated_with"
  | "related_to"

/** Chunk type for RAG */
export type ChunkType = "paragraph" | "table" | "header" | "list" | "code" | "image"

/** User memory V2 record */
export interface UserMemoryV2 {
  id: string
  user_id: string
  content: string
  memory_tier: MemoryTier
  memory_kind: MemoryKind
  memory_type?: "auto" | "explicit"
  is_static: boolean
  version: number
  is_latest: boolean
  parent_memory_id?: string | null
  root_memory_id?: string | null
  is_forgotten: boolean
  forget_after?: string | null
  forget_reason?: string | null
  source_count: number
  is_inference: boolean
  source_chat_id?: string | null
  source_message_id?: number | null
  event_timestamp?: string | null
  valid_from: string
  valid_until?: string | null
  importance_score: number
  access_count: number
  access_velocity: number
  last_accessed_at?: string | null
  embedding: number[] | string | null
  embedding_model?: string | null
  matryoshka_embedding?: number[] | string | null
  metadata: Json
  tags: string[]
  created_at: string
  updated_at: string
}

/** Memory search result V2 */
export interface MemorySearchResultV2 {
  id: string
  content: string
  memory_kind: MemoryKind
  memory_tier: MemoryTier
  is_static: boolean
  is_latest?: boolean
  is_forgotten?: boolean
  importance_score: number
  access_count?: number
  access_velocity?: number
  created_at: string | Date
  updated_at?: string | Date
  last_accessed_at?: string | null
  metadata?: Record<string, unknown> | Json | null
  tags?: string[]
  // Search scores
  similarity_score?: number
  vector_similarity?: number
  lexical_score?: number
  rrf_score?: number
  final_score?: number
  // Source tracking
  source_chat_id?: string | null
  is_inference?: boolean
}

/** RAG chunk V2 */
export interface RAGChunkV2 {
  id: string
  document_id: string
  user_id: string
  content: string
  chunk_type: ChunkType
  parent_header?: string | null
  section_path: string[]
  page_number?: number | null
  position: number
  token_count: number
  content_hash: string
  embedding: string
  matryoshka_embedding?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
}

/** Create RAG chunk V2 */
export interface CreateRAGChunkV2 {
  document_id: string
  user_id: string
  content: string
  chunk_type: ChunkType
  parent_header?: string | null
  section_path?: string[]
  page_number?: number | null
  position: number
  token_count: number
  content_hash: string
  embedding: number[]
  matryoshka_embedding?: number[]
  metadata?: Record<string, unknown>
}

/** Hybrid search parameters */
export interface HybridSearchParams {
  query: string
  queryEmbedding?: number[]
  userId: string
  limit?: number
  vectorThreshold?: number
  similarityThreshold?: number
  lexicalThreshold?: number
  vectorWeight?: number
  lexicalWeight?: number
  rrfK?: number
  tiers?: MemoryTier[]
  kinds?: MemoryKind[]
  staticOnly?: boolean
  onlyStatic?: boolean
  tags?: string[]
  minImportance?: number
  excludeForgotten?: boolean
  rerank?: boolean
  memoryKind?: MemoryKind
  memoryTier?: MemoryTier
}

/** Hybrid search response */
export interface HybridSearchResponse {
  results: MemorySearchResultV2[]
  total?: number
  timing?: {
    vectorMs?: number
    lexicalMs?: number
    fusionMs?: number
    rerankMs?: number
    totalMs?: number
    searchMs?: number
  }
  refinedQuery?: string
  debug?: {
    vectorCount?: number
    lexicalCount?: number
    fusionCount?: number
  }
}

/** Profile search parameters */
export interface ProfileSearchParams {
  userId: string
  query?: string
  queryEmbedding?: number[]
  staticLimit?: number
  dynamicLimit?: number
  containerTag?: string
}

/** Profile search response */
export interface ProfileSearchResponse {
  profile: MemoryProfile
  searchResults?: MemorySearchResultV2[]
  timing?: {
    staticMs?: number
    dynamicMs?: number
    searchMs?: number
    totalMs?: number
  }
}

/** Memory profile */
export interface MemoryProfile {
  static: UserMemoryV2[]
  dynamic: UserMemoryV2[]
}

/** Hot cache entry */
export interface HotCacheEntry {
  memories: UserMemoryV2[]
  loadedAt: number
  lastAccessedAt: number
  accessCount: number
}

/** Hot cache configuration */
export interface HotCacheConfig {
  maxPerUser: number
  globalMax: number
  ttlMs: number
  cleanupIntervalMs: number
}

/** Cache statistics */
export interface CacheStats {
  totalEntries: number
  totalMemories: number
  hitRate: number
  missRate: number
  avgAccessTime: number
  oldestEntry: number | null
  newestEntry: number | null
}

/** Rerank input */
export interface RerankInput {
  query: string
  documents: Array<{
    id: string
    content: string
    metadata?: Record<string, unknown>
  }>
  topN?: number
  model?: string
}

/** Rerank result */
export interface RerankResult {
  results: Array<{
    id: string
    score: number
    index: number
  }>
  timing?: { totalMs: number }
}

/** Rerank API response */
export interface RerankResponse {
  results: Array<{
    id: string
    content: string
    score: number
    originalRank: number
    newRank: number
    metadata?: Record<string, unknown>
  }>
  model?: string
  timing?: { totalMs: number }
}

// ============================================================================
// V2 KNOWLEDGE GRAPH TYPES
// ============================================================================

/** Knowledge graph entity type */
export type KGEntityType = "person" | "organization" | "foundation" | "company" | "location" | "concept" | "event"

/** Knowledge graph entity (database row) */
export interface KGEntity {
  id: string
  user_id: string
  entity_type: KGEntityType
  canonical_name: string
  display_name: string
  aliases: string[]
  description: string | null
  embedding: number[] | string | null
  embedding_model: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/** Create knowledge graph entity */
export interface CreateKGEntity {
  user_id: string
  entity_type: KGEntityType
  canonical_name: string
  display_name: string
  aliases?: string[]
  description?: string | null
  embedding?: number[]
  embedding_model?: string
  metadata?: Record<string, unknown>
}

/** Knowledge graph relation (database row) */
export interface KGRelation {
  id: string
  source_entity_id: string
  target_entity_id: string
  relation_type: string
  strength: number
  source_memory_id: string | null
  metadata: Record<string, unknown> | null
  valid_from: string | null
  valid_until: string | null
  created_at: string
}

/** Create knowledge graph relation */
export interface CreateKGRelation {
  source_entity_id: string
  target_entity_id: string
  relation_type: string
  strength?: number
  source_memory_id?: string | null
  metadata?: Record<string, unknown>
  valid_from?: string | null
  valid_until?: string | null
}

/** Knowledge graph traversal result */
export interface KGTraversalResult {
  entity_id: string
  entity_type: KGEntityType
  entity_name: string
  relation_path: string[]
  depth: number
}

// ============================================================================
// V2 MEMORY MANAGER TYPES
// ============================================================================

/** Create memory V2 input */
export interface CreateMemoryV2 {
  user_id: string
  content: string
  memory_tier?: MemoryTier
  memory_kind?: MemoryKind
  memory_type?: "auto" | "explicit"
  is_static?: boolean
  is_inference?: boolean
  importance_score?: number
  source_chat_id?: string | null
  source_message_id?: number | null
  event_timestamp?: string | null
  valid_until?: string | null
  forget_after?: string | null
  embedding?: number[]
  embedding_model?: string
  matryoshka_embedding?: number[] | null
  metadata?: Record<string, unknown>
  tags?: string[]
}

/** Update memory V2 input */
export interface UpdateMemoryV2 {
  content?: string
  memory_tier?: MemoryTier
  memory_kind?: MemoryKind
  is_static?: boolean
  is_inference?: boolean
  importance_score?: number
  valid_until?: string | null
  forget_after?: string | null
  forget_reason?: string | null
  embedding?: number[]
  metadata?: Record<string, unknown>
  tags?: string[]
}

/** Consolidation candidate */
export interface ConsolidationCandidate {
  memories: UserMemoryV2[]
  similarity: number
  suggestedContent: string
  suggestedImportance: number
}

/** Consolidation result */
export interface ConsolidationResult {
  merged: UserMemoryV2
  sourceIds: string[]
  similarity: number
}

/** Consolidation options */
export interface ConsolidationOptions {
  similarityThreshold?: number
  maxBatchSize?: number
  dryRun?: boolean
}

/** Decay configuration */
export interface DecayConfig {
  dailyDecayRate: number
  minImportance: number
  accessBoost: number
  maxImportance: number
}

/** Tier promotion/demotion criteria */
export interface TierCriteria {
  hotVelocityThreshold: number
  coldVelocityThreshold: number
  coldInactiveDays: number
  hotMinImportance: number
}

/** Memory statistics V2 */
export interface MemoryStatsV2 {
  total_memories: number
  hot_memories: number
  warm_memories: number
  cold_memories: number
  episodic_count: number
  semantic_count: number
  procedural_count: number
  profile_count: number
  auto_count: number
  explicit_count: number
  inference_count: number
  static_count: number
  avg_importance: number
  avg_access_velocity: number
  most_recent_memory: string | null
  oldest_memory: string | null
  forgotten_count: number
  expiring_soon_count: number
  entity_count: number
  relation_count: number
}
