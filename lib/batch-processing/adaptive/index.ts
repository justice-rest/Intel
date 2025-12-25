/**
 * Adaptive Research Module
 *
 * Dynamic research depth selection based on prospect indicators.
 */

export {
  extractIndicators,
  selectDepth,
  selectDepthFromOutput,
  analyzeBatchDepth,
  getDepthDescription,
  DEPTH_CONFIGS,
  type ResearchDepth,
  type DepthConfig,
  type DepthSelectionResult,
  type PreliminaryIndicators,
  type DepthThresholds,
  type BatchDepthAnalysis,
} from "./depth-selector"
