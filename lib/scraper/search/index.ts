/**
 * Person Search Module Index
 *
 * Exports the unified person-to-business search system.
 */

// Person search
export {
  searchBusinessesByPerson,
  quickPersonSearch,
  getOwnershipSummary,
  type PersonSearchResult,
  type PersonBusinessResult,
  type SecInsiderResult,
  type PersonSearchOptions,
} from "./person-search"

// Ownership inference
export {
  inferOwnership,
  inferOwnershipFromRole,
  inferOwnershipFromRoles,
  detectEntityType,
  adjustForEntityType,
  adjustForSource,
  getLikelihoodLabel,
  getLikelihoodColor,
  type OwnershipLikelihood,
  type OwnershipInference,
  type DataSource,
  type EntityType,
} from "./ownership-inference"
