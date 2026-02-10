/**
 * Memory System Main Module
 *
 * Central export point for all memory functionality.
 * V1 is the active system; V2 modules are kept for future use.
 */

// =============================================================================
// CONFIGURATION
// =============================================================================
export * from "./config"

// =============================================================================
// TYPES
// =============================================================================
export * from "./types"

// =============================================================================
// V1 CORE MODULES
// =============================================================================
export {
  createMemory,
  getUserMemories,
  getMemoryStats,
  deleteMemory,
  updateMemory,
  memoryExists as memoryExistsInStorage,
  getMemoryById,
  upsertMemory,
} from "./storage"

export {
  searchMemories,
  getMemoriesForAutoInject,
  formatMemoriesForPrompt,
  buildConversationContext,
  memoryExists,
  findSimilarMemories,
  extractKeyTopics,
} from "./retrieval"

export * from "./extractor"
export * from "./scorer"
export * from "./embedding-cache"

// =============================================================================
// V2 ENTERPRISE MODULES (kept for future use)
// =============================================================================

// Hot Cache - In-memory LRU cache for <5ms retrieval
export {
  HotMemoryCache,
  getHotCache,
  shutdownHotCache,
  selectHotMemories,
  calculateHotScore,
  qualifiesForHotTier,
} from "./hot-cache"

// Hybrid Search - Vector + Lexical with RRF Fusion
export {
  hybridSearch,
  getMemoryProfile,
  tieredSearch,
  formatMemoriesForPrompt as formatMemoriesForPromptV2,
  deduplicateMemories,
} from "./hybrid-search"

// Memory Manager - Lifecycle, versioning, consolidation
export {
  MemoryManager,
  getMemoryManager,
} from "./memory-manager"

// Chat Integration - Unified interface for chat route
export {
  getChatMemories,
  extractAndSaveMemories,
  type ChatMemoryContext,
  type GetChatMemoriesParams,
  type ExtractAndSaveMemoriesParams,
} from "./chat-integration"

// =============================================================================
// V1 CONVENIENCE EXPORTS
// =============================================================================
export { isMemoryEnabled } from "./config"
// Note: generateEmbedding, getCachedEmbedding, setCachedEmbedding are already
// exported via `export * from "./embedding-cache"` above
