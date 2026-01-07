/**
 * Discovery Module
 *
 * Prospect Discovery feature for finding donors matching criteria.
 *
 * @module lib/discovery
 */

// Types
export type {
  DiscoveryTemplate,
  TemplatePlaceholder,
  DiscoveryRequest,
  DiscoveryFocusArea,
  ProspectConfidence,
  ProspectSource,
  DiscoveredProspect,
  DiscoveryResult,
  DiscoveryErrorCode,
  RateLimitInfo,
  DiscoverySession,
  FilledTemplate,
  DiscoveryConfig,
  DiscoveryProspectInput,
  CreateBatchFromDiscoveryRequest,
} from "./types"

export { DEFAULT_DISCOVERY_CONFIG } from "./types"

// Templates
export {
  DISCOVERY_TEMPLATES,
  US_STATES,
  CAUSE_AREAS,
  CATEGORY_LABELS,
  getTemplateById,
  getTemplatesByCategory,
  getCategories,
  fillTemplatePlaceholders,
  validatePlaceholderValues,
} from "./templates"

// Validation
export {
  validateDiscoveryRequest,
  validatePrompt,
  validateMaxResults,
  validateFocusAreas,
  validateLocation,
  validateTemplateId,
  sanitizeInput,
  sanitizePrompt,
  isValidPersonName,
  normalizeName,
  getDiscoveryRateLimitKey,
  isRateLimitError,
  type ValidationResult,
  type PromptValidationResult,
} from "./validation"

// Discovery Engine
export {
  discoverProspects,
  buildDiscoveryQueries,
  parseDiscoveryResults,
  getLinkUpStatus,
} from "./prospect-finder"
