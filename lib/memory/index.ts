/**
 * Memory System Main Module
 *
 * Central export point for all memory functionality.
 * Supports both V1 (legacy) and V2 (enterprise) systems.
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
// V1 CORE MODULES (Legacy - maintained for backward compatibility)
// =============================================================================
export {
  createMemory,
  getUserMemories,
  getMemoryStats,
  deleteMemory,
  updateMemory,
  memoryExists,
  getMemoryById,
} from "./storage"

export {
  searchMemories,
  getMemoriesForAutoInject,
  formatMemoriesForPrompt,
  buildConversationContext,
} from "./retrieval"

export * from "./extractor"
export * from "./scorer"
export * from "./embedding-cache"

// =============================================================================
// V2 ENTERPRISE MODULES
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

// Knowledge Graph - Entity & relation extraction
export {
  extractFromText,
  KnowledgeGraphManager,
  getKGManager,
  formatEntitiesForContext,
} from "./kg-extractor"

// Chat Integration - Unified interface for chat route
export {
  getChatMemories,
  warmUserMemoryCache,
  warmUserMemoryCache as warmUpUserCache, // Alias for backward compatibility
  extractAndSaveMemories,
  isV2Available,
  type ChatMemoryContext,
  type GetChatMemoriesParams,
  type ExtractAndSaveMemoriesParams,
} from "./chat-integration"

// =============================================================================
// V1 CONVENIENCE EXPORTS (Legacy - maintained for backward compatibility)
// =============================================================================
export { isMemoryEnabled } from "./config"
export { generateEmbedding, getCachedEmbedding, setCachedEmbedding } from "./embedding-cache"
