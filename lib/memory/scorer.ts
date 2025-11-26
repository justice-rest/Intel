/**
 * Memory Scoring Module
 *
 * Calculates importance scores for memories based on various factors
 */

import type { MemoryMetadata } from "./types"
import { MEMORY_CATEGORIES } from "./config"

// ============================================================================
// IMPORTANCE SCORING
// ============================================================================

/**
 * Category importance weights
 * Higher weight = more important category
 */
const CATEGORY_WEIGHTS: Record<string, number> = {
  [MEMORY_CATEGORIES.USER_INFO]: 0.95, // Name, personal details
  [MEMORY_CATEGORIES.PREFERENCES]: 0.85, // User preferences
  [MEMORY_CATEGORIES.CONTEXT]: 0.75, // Ongoing projects, goals
  [MEMORY_CATEGORIES.RELATIONSHIPS]: 0.70, // People, organizations
  [MEMORY_CATEGORIES.SKILLS]: 0.65, // Expertise, abilities
  [MEMORY_CATEGORIES.HISTORY]: 0.60, // Past events
  [MEMORY_CATEGORIES.FACTS]: 0.70, // Specific facts
  [MEMORY_CATEGORIES.OTHER]: 0.50, // Uncategorized
}

/**
 * Calculate base importance score from content analysis
 *
 * @param content - Memory content
 * @param category - Memory category
 * @returns Base importance score (0-1)
 */
export function calculateBaseImportance(
  content: string,
  category: string
): number {
  if (!content || content.trim().length === 0) {
    return 0
  }

  // Start with category weight
  let score = CATEGORY_WEIGHTS[category] || 0.5

  // Adjust based on content characteristics
  const contentLower = content.toLowerCase()

  // High-value keywords boost importance
  const highValueKeywords = [
    "my name is",
    "i am",
    "i'm",
    "i work",
    "i prefer",
    "i like",
    "i dislike",
    "i hate",
    "never",
    "always",
    "important",
    "remember",
    "don't forget",
  ]

  const hasHighValueKeyword = highValueKeywords.some((keyword) =>
    contentLower.includes(keyword)
  )

  if (hasHighValueKeyword) {
    score = Math.min(score + 0.1, 1.0)
  }

  // Personal pronouns indicate personal information
  const personalPronouns = ["my", "i", "me", "mine"]
  const pronounCount = personalPronouns.reduce(
    (count, pronoun) =>
      count + (contentLower.match(new RegExp(`\\b${pronoun}\\b`, "g"))?.length || 0),
    0
  )

  if (pronounCount >= 2) {
    score = Math.min(score + 0.05, 1.0)
  }

  // Specificity: longer, more detailed content is more valuable
  const wordCount = content.split(/\s+/).length
  if (wordCount > 15) {
    score = Math.min(score + 0.05, 1.0)
  } else if (wordCount < 5) {
    score = Math.max(score - 0.1, 0.1)
  }

  return Math.max(0, Math.min(1, score))
}

/**
 * Calculate importance score with context
 *
 * @param content - Memory content
 * @param category - Memory category
 * @param metadata - Memory metadata
 * @returns Final importance score (0-1)
 */
export function calculateImportanceScore(
  content: string,
  category: string,
  metadata?: MemoryMetadata
): number {
  let score = calculateBaseImportance(content, category)

  // Boost explicit memories
  if (metadata?.tags?.includes("explicit")) {
    score = Math.min(score + 0.2, 1.0)
  }

  // Boost user-requested memories
  if (metadata?.tags?.includes("user-requested")) {
    score = Math.min(score + 0.15, 1.0)
  }

  // Boost if has rich context
  if (metadata?.context && metadata.context.length > 20) {
    score = Math.min(score + 0.05, 1.0)
  }

  return Math.max(0, Math.min(1, score))
}

// ============================================================================
// ACCESS-BASED SCORING
// ============================================================================

/**
 * Calculate relevance decay based on time since last access
 * Memories that haven't been accessed in a while become less important
 *
 * @param lastAccessedAt - Last access timestamp
 * @param createdAt - Creation timestamp
 * @returns Decay factor (0-1)
 */
export function calculateTemporalDecay(
  lastAccessedAt: string | null,
  createdAt: string
): number {
  const now = new Date()
  const lastAccess = lastAccessedAt ? new Date(lastAccessedAt) : new Date(createdAt)
  const daysSinceAccess = (now.getTime() - lastAccess.getTime()) / (1000 * 60 * 60 * 24)

  // Exponential decay over 90 days
  // After 90 days of no access, decay factor = 0.5
  const decayRate = Math.exp(-(daysSinceAccess / 90))

  return Math.max(0.5, decayRate) // Minimum 0.5 (never fully decay)
}

/**
 * Calculate importance boost based on access frequency
 * Frequently accessed memories are more important
 *
 * @param accessCount - Number of times memory has been accessed
 * @returns Boost factor (0-0.2)
 */
export function calculateAccessBoost(accessCount: number): number {
  // Logarithmic boost: more accesses = higher importance, but with diminishing returns
  // Max boost: 0.2 (at 100+ accesses)
  const boost = Math.min(0.2, Math.log10(accessCount + 1) / 10)
  return boost
}

/**
 * Calculate dynamic importance score
 * Combines base importance with access patterns
 *
 * @param baseImportance - Base importance score
 * @param accessCount - Access count
 * @param lastAccessedAt - Last access timestamp
 * @param createdAt - Creation timestamp
 * @returns Dynamic importance score (0-1)
 */
export function calculateDynamicImportance(
  baseImportance: number,
  accessCount: number,
  lastAccessedAt: string | null,
  createdAt: string
): number {
  const temporalDecay = calculateTemporalDecay(lastAccessedAt, createdAt)
  const accessBoost = calculateAccessBoost(accessCount)

  // Combine factors
  const dynamicScore = baseImportance * temporalDecay + accessBoost

  return Math.max(0, Math.min(1, dynamicScore))
}

// ============================================================================
// MEMORY RANKING
// ============================================================================

/**
 * Calculate combined relevance score for search ranking
 * Combines semantic similarity with importance
 *
 * @param similarity - Semantic similarity score (0-1)
 * @param importance - Importance score (0-1)
 * @param similarityWeight - Weight for similarity (default: 0.7)
 * @param importanceWeight - Weight for importance (default: 0.3)
 * @returns Combined score (0-1)
 */
export function calculateRelevanceScore(
  similarity: number,
  importance: number,
  similarityWeight: number = 0.7,
  importanceWeight: number = 0.3
): number {
  return similarity * similarityWeight + importance * importanceWeight
}

/**
 * Determine if memory should be pruned (deleted)
 * Based on importance, age, and access patterns
 *
 * @param importance - Current importance score
 * @param accessCount - Access count
 * @param daysSinceCreation - Days since memory was created
 * @param daysSinceLastAccess - Days since last access
 * @returns True if memory should be pruned
 */
export function shouldPruneMemory(
  importance: number,
  accessCount: number,
  daysSinceCreation: number,
  daysSinceLastAccess: number
): boolean {
  // Never prune high-importance memories
  if (importance > 0.8) {
    return false
  }

  // Never prune frequently accessed memories
  if (accessCount > 10) {
    return false
  }

  // Prune low-importance, old, never-accessed memories
  if (importance < 0.4 && accessCount === 0 && daysSinceCreation > 90) {
    return true
  }

  // Prune medium-importance memories that haven't been accessed in 180 days
  if (importance < 0.6 && daysSinceLastAccess > 180) {
    return true
  }

  return false
}
