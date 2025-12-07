/**
 * RomyScore Configuration
 * Deterministic scoring system for consistent prospect research scores
 *
 * The RomyScore is a 0-41 point scale that evaluates prospect capacity
 * based on verifiable data points from multiple sources.
 *
 * CONSISTENCY APPROACH:
 * - Scores are calculated from RAW DATA POINTS, not AI interpretation
 * - Scores are cached by normalized person identifier
 * - New data only ADDS to existing scores (never decreases unless data is contradicted)
 * - Cache TTL is 7 days for freshness
 */

/**
 * Cache TTL in milliseconds (7 days)
 */
export const ROMY_SCORE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000

/**
 * Score component weights (must sum to 41)
 */
export const ROMY_SCORE_WEIGHTS = {
  // Property Value (0-12 points)
  propertyValue: {
    maxPoints: 12,
    thresholds: [
      { min: 2000000, points: 12 },   // $2M+
      { min: 1000000, points: 10 },   // $1M-$2M
      { min: 750000, points: 8 },     // $750K-$1M
      { min: 500000, points: 6 },     // $500K-$750K
      { min: 250000, points: 4 },     // $250K-$500K
      { min: 0, points: 2 },          // <$250K
    ],
  },

  // Business Ownership (0-12 points)
  businessOwnership: {
    maxPoints: 12,
    roles: {
      founder: 12,
      owner: 12,
      ceo: 10,
      president: 10,
      coo: 8,
      cfo: 8,
      cto: 8,
      vp: 8,
      "vice president": 8,
      director: 5,
      manager: 3,
      executive: 6,
      partner: 10,
      principal: 9,
      chairman: 11,
      "board member": 6,
    },
  },

  // Additional Wealth Indicators (0-17 points)
  additionalIndicators: {
    maxPoints: 17,
    indicators: {
      multipleProperties: 3,           // Owns multiple properties
      multipleBusinesses: 3,           // Has multiple company affiliations
      publicCompanyExecutive: 5,       // Executive at a public company (SEC filings)
      foundationAffiliation: 3,        // Connected to a foundation
      significantPoliticalGiving: 2,   // FEC contributions > $10K total
      publiclyKnownNetWorth: 1,        // Net worth in Wikidata/public sources
    },
  },
} as const

/**
 * Score tier definitions
 */
export const ROMY_SCORE_TIERS = {
  transformational: { min: 31, max: 41, name: "Transformational Prospect", capacity: "MAJOR" },
  highCapacity: { min: 21, max: 30, name: "High-Capacity Major Donor Target", capacity: "PRINCIPAL" },
  midCapacity: { min: 11, max: 20, name: "Mid-Capacity Growth Potential", capacity: "LEADERSHIP" },
  emerging: { min: 0, max: 10, name: "Emerging/Annual Fund", capacity: "ANNUAL" },
} as const

/**
 * Get tier info for a score
 */
export function getScoreTier(score: number): {
  name: string
  capacity: string
  giftCapacityRange: string
} {
  if (score >= 31) {
    return {
      name: ROMY_SCORE_TIERS.transformational.name,
      capacity: ROMY_SCORE_TIERS.transformational.capacity,
      giftCapacityRange: "$25,000+",
    }
  } else if (score >= 21) {
    return {
      name: ROMY_SCORE_TIERS.highCapacity.name,
      capacity: ROMY_SCORE_TIERS.highCapacity.capacity,
      giftCapacityRange: "$10,000 - $25,000",
    }
  } else if (score >= 11) {
    return {
      name: ROMY_SCORE_TIERS.midCapacity.name,
      capacity: ROMY_SCORE_TIERS.midCapacity.capacity,
      giftCapacityRange: "$5,000 - $10,000",
    }
  } else {
    return {
      name: ROMY_SCORE_TIERS.emerging.name,
      capacity: ROMY_SCORE_TIERS.emerging.capacity,
      giftCapacityRange: "< $5,000",
    }
  }
}

/**
 * Normalize a person's name for cache key
 * - Lowercase
 * - Remove extra whitespace
 * - Remove common suffixes (Jr, Sr, III, etc.)
 * - Sort name parts alphabetically (handles "John Smith" vs "Smith, John")
 */
export function normalizePersonName(name: string): string {
  if (!name) return ""

  // Lowercase and trim
  let normalized = name.toLowerCase().trim()

  // Remove common suffixes
  normalized = normalized.replace(/\b(jr\.?|sr\.?|iii|ii|iv|phd|md|esq\.?|cpa)\b/gi, "")

  // Remove punctuation except spaces
  normalized = normalized.replace(/[^\w\s]/g, "")

  // Split into parts, filter empty, sort, rejoin
  const parts = normalized.split(/\s+/).filter(Boolean).sort()

  return parts.join("_")
}

/**
 * Create a cache key for a person
 */
export function createScoreCacheKey(name: string, city?: string, state?: string): string {
  const normalizedName = normalizePersonName(name)
  const location = [city, state].filter(Boolean).join("_").toLowerCase().replace(/\s+/g, "_")

  return location ? `${normalizedName}__${location}` : normalizedName
}
