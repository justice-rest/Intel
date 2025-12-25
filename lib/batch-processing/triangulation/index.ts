/**
 * Triangulation Module
 *
 * Multi-source data triangulation with confidence scoring.
 */

export {
  triangulateData,
  quickMerge,
  type TriangulatedResult,
  type SourceData,
} from "./engine"

export {
  calculateFieldConfidence,
  calculateOverallConfidence,
  type ConfidenceLevel,
  type SourceCitation,
  type FieldConfidence,
} from "./confidence-scorer"

export {
  SOURCE_REGISTRY,
  CATEGORY_AUTHORITY,
  identifySource,
  getSourceAuthority,
  getSourcesByCategory,
  getSourcesForDataType,
  classifySource,
  isAuthoritativeFor,
  type SourceCategory,
  type SourceDefinition,
} from "./source-registry"
