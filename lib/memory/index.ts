/**
 * Memory System Main Module
 *
 * Central export point for all memory functionality
 */

// Config
export * from "./config"

// Types
export * from "./types"

// Core modules
export * from "./storage"
export * from "./retrieval"
export * from "./extractor"
export * from "./scorer"
export * from "./embedding-cache"

// Re-export commonly used functions for convenience
export { isMemoryEnabled } from "./config"
export { createMemory, getUserMemories, getMemoryStats } from "./storage"
export { searchMemories, getMemoriesForAutoInject, formatMemoriesForPrompt } from "./retrieval"
export { extractMemories, detectExplicitMemory } from "./extractor"
export { calculateImportanceScore } from "./scorer"
