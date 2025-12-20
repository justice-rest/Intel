/**
 * Socrata Open Data API Module
 *
 * Unified interface for querying Socrata-powered government data portals.
 * Supports rate limiting, query building, and multi-state data sources.
 *
 * Rate Limits (per portal):
 * - Without app token: 60 requests/hour
 * - With app token: 1000 requests/hour
 *
 * Get a free app token at: https://dev.socrata.com/register
 */

// Types
export type {
  DataCategory,
  FieldMapping,
  DataSourceConfig,
  SoQLOperator,
  SoQLCondition,
  SoQLQuery,
  SocrataResponse,
  RateLimitState,
  RateLimitConfig,
} from "./types"

// Query Builder
export {
  getSocrataAppToken,
  hasAppToken,
  buildSoQLUrl,
  executeSoQLQuery,
  buildNameSearchQuery,
  buildAddressSearchQuery,
  buildValueRangeQuery,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  DEFAULT_TIMEOUT_MS,
} from "./query-builder"

// State Data Sources
export {
  STATE_DATA_SOURCES,
  findDataSourcesByState,
  findDataSourcesByCategory,
  findDataSourceById,
  getVerifiedDataSources,
  findDataSource,
  getDataSourceStats,
} from "./state-portals"

// County Property Sources (existing)
export {
  COUNTY_DATA_SOURCES,
  findCountyDataSource,
  getSupportedCounties,
  isCountySupported,
  isSocrataEnabled,
  SOCRATA_DEFAULTS,
} from "./config"
export type { CountyDataSource } from "./config"
