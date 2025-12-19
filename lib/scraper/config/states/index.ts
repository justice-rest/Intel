/**
 * State Registry Configurations Index
 *
 * 49-state coverage for business registry scraping.
 * (Texas excluded - requires $1/search via SOSDirect, use web search instead)
 *
 * Tiers:
 * - Tier 1 (2 states): API/Open Data - CO, NY
 * - Tier 2 (40 states): HTTP scraping
 * - Tier 3 (6 states): Playwright required - MI, IN, VA, WI, WA, IA
 * - Tier 4 (1 state): CAPTCHA - DE
 */

import type { StateRegistryConfig, USStateCode } from "../state-template"

// Tier 1: API States
import { COLORADO_CONFIG, CO_SOCRATA_FIELDS } from "./co"
import { IOWA_CONFIG } from "./ia"
import { WASHINGTON_CONFIG } from "./wa"

// Existing configs (mixed tiers)
import { FLORIDA_CONFIG } from "./fl"
import { NEW_YORK_CONFIG, NY_SOCRATA_FIELD_MAPPING } from "./ny"
import { CALIFORNIA_CONFIG, CA_ENTITY_TYPES } from "./ca"
import { DELAWARE_CONFIG, DE_ENTITY_TYPES } from "./de"

// Tier 2: HTTP Scrape - Individual
import { PENNSYLVANIA_CONFIG } from "./pa"
import { ILLINOIS_CONFIG } from "./il"
import { NORTH_CAROLINA_CONFIG } from "./nc"
import { OHIO_CONFIG } from "./oh"
import { GEORGIA_CONFIG } from "./ga"
import { NEW_JERSEY_CONFIG } from "./nj"
import { MASSACHUSETTS_CONFIG } from "./ma"
import { ARIZONA_CONFIG } from "./az"

// Tier 2: HTTP Scrape - Bulk
import { BULK_TIER2_CONFIGS } from "./bulk-tier2"

// Tier 3: Playwright Required
import { TIER3_CONFIGS } from "./tier3-playwright"

/**
 * All state configurations indexed by state code
 * Complete 50-state coverage
 */
export const STATE_CONFIGS: Partial<Record<USStateCode, StateRegistryConfig>> = {
  // Tier 1: API States
  co: COLORADO_CONFIG,
  ia: IOWA_CONFIG,
  wa: WASHINGTON_CONFIG,

  // Existing configs
  fl: FLORIDA_CONFIG,
  ny: NEW_YORK_CONFIG,
  ca: CALIFORNIA_CONFIG,
  de: DELAWARE_CONFIG,

  // Tier 2: HTTP Scrape - Major states
  pa: PENNSYLVANIA_CONFIG,
  il: ILLINOIS_CONFIG,
  nc: NORTH_CAROLINA_CONFIG,
  oh: OHIO_CONFIG,
  ga: GEORGIA_CONFIG,
  nj: NEW_JERSEY_CONFIG,
  ma: MASSACHUSETTS_CONFIG,
  az: ARIZONA_CONFIG,

  // Tier 2: HTTP Scrape - Bulk states
  ...BULK_TIER2_CONFIGS,

  // Tier 3: Playwright Required
  ...TIER3_CONFIGS,
}

/**
 * Get config for a specific state
 */
export function getStateConfig(stateCode: string): StateRegistryConfig | undefined {
  return STATE_CONFIGS[stateCode.toLowerCase() as USStateCode]
}

/**
 * Get all available state codes with configs
 */
export function getAvailableStates(): USStateCode[] {
  return Object.keys(STATE_CONFIGS) as USStateCode[]
}

/**
 * Check if a state has a configuration
 */
export function hasStateConfig(stateCode: string): boolean {
  return stateCode.toLowerCase() in STATE_CONFIGS
}

/**
 * Get all configs grouped by tier
 */
export function getConfigsByTier(): Record<1 | 2 | 3 | 4, StateRegistryConfig[]> {
  const byTier: Record<1 | 2 | 3 | 4, StateRegistryConfig[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
  }

  for (const config of Object.values(STATE_CONFIGS)) {
    if (config) {
      byTier[config.tier].push(config)
    }
  }

  return byTier
}

/**
 * Get states that support detail page scraping
 */
export function getStatesWithDetailScraping(): USStateCode[] {
  return Object.entries(STATE_CONFIGS)
    .filter(([, config]) => config?.scraping?.detailSelectors)
    .map(([code]) => code as USStateCode)
}

/**
 * Get states that support officer search
 */
export function getStatesWithOfficerSearch(): USStateCode[] {
  return Object.entries(STATE_CONFIGS)
    .filter(([, config]) => config?.scraping?.detailSelectors?.officerContainer)
    .map(([code]) => code as USStateCode)
}

/**
 * Get count of configured states
 */
export function getStateCount(): number {
  return Object.keys(STATE_CONFIGS).length
}

/**
 * Get tier statistics
 */
export function getTierStats(): { tier: number; count: number; states: string[] }[] {
  const byTier = getConfigsByTier()
  return [1, 2, 3, 4].map((tier) => ({
    tier,
    count: byTier[tier as 1 | 2 | 3 | 4].length,
    states: byTier[tier as 1 | 2 | 3 | 4].map((c) => c.stateCode),
  }))
}

// Re-export individual configs for direct access
export {
  FLORIDA_CONFIG,
  NEW_YORK_CONFIG,
  CALIFORNIA_CONFIG,
  DELAWARE_CONFIG,
  COLORADO_CONFIG,
  IOWA_CONFIG,
  WASHINGTON_CONFIG,
  PENNSYLVANIA_CONFIG,
  ILLINOIS_CONFIG,
  NORTH_CAROLINA_CONFIG,
  OHIO_CONFIG,
  GEORGIA_CONFIG,
  NEW_JERSEY_CONFIG,
  MASSACHUSETTS_CONFIG,
  ARIZONA_CONFIG,
}

// Re-export bulk configs
export { BULK_TIER2_CONFIGS, TIER3_CONFIGS }

// Re-export utility mappings
export {
  NY_SOCRATA_FIELD_MAPPING,
  CA_ENTITY_TYPES,
  DE_ENTITY_TYPES,
  CO_SOCRATA_FIELDS,
}

// Re-export types
export type { StateRegistryConfig, USStateCode } from "../state-template"
