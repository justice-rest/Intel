/**
 * RomyScore Module
 * Consistent, deterministic prospect scoring system
 *
 * Usage:
 * ```typescript
 * import { getRomyScore, calculateRomyScore, formatRomyScoreForDisplay } from "@/lib/romy-score"
 *
 * // Get cached score or calculate from new data
 * const score = await getRomyScore("John Smith", "San Francisco", "CA", {
 *   propertyValue: 2500000,
 *   businessRoles: [{ role: "CEO", companyName: "Acme Corp", isPublicCompany: false }],
 * })
 *
 * // Format for display
 * const formatted = formatRomyScoreForDisplay(score)
 * ```
 */

// Main scoring functions
export {
  calculateRomyScore,
  mergeDataPoints,
  formatRomyScoreForDisplay,
  normalizePersonName,
  createScoreCacheKey,
  getScoreTier,
} from "./calculator"

// Cache functions
export {
  getRomyScore,
  getCachedScore,
  setCachedScore,
  updateCachedScore,
  clearCachedScore,
  isSupabaseCacheAvailable,
} from "./cache"

// Types
export type {
  RomyScoreDataPoints,
  RomyScoreBreakdown,
} from "./calculator"

// Config
export {
  ROMY_SCORE_CACHE_TTL,
  ROMY_SCORE_WEIGHTS,
  ROMY_SCORE_TIERS,
} from "./config"
