/**
 * Scraper Configuration Index
 *
 * Exports state registry configuration templates, utilities, and state-specific configs.
 */

// State template types and utilities
export {
  type StateRegistryConfig,
  type ApiConfig,
  type ScrapingConfig,
  type SearchResultSelectors,
  type DetailPageSelectors,
  type SelectorStrategy,
  type FormField,
  type StateNotes,
  type USStateCode,
  US_STATES,
  TIER_DESCRIPTIONS,
  validateStateConfig,
  selector,
  buildDetailUrl,
} from "./state-template"

// State-specific configurations
export {
  STATE_CONFIGS,
  getStateConfig,
  getAvailableStates,
  hasStateConfig,
  getConfigsByTier,
  getStatesWithDetailScraping,
  getStatesWithOfficerSearch,
  FLORIDA_CONFIG,
  NEW_YORK_CONFIG,
  CALIFORNIA_CONFIG,
  DELAWARE_CONFIG,
  NY_SOCRATA_FIELD_MAPPING,
  CA_ENTITY_TYPES,
  DE_ENTITY_TYPES,
} from "./states"
