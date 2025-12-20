/**
 * Socrata SODA API Types
 *
 * Shared types for the Socrata data integration module
 */

// ============================================================================
// DATA SOURCE TYPES
// ============================================================================

export type DataCategory =
  | "property"
  | "property_sales"
  | "business_license"
  | "professional_license"
  | "campaign_finance"
  | "voter_registration"
  | "government_salary"
  | "building_permits"
  | "business_entities"
  | "contracts"
  | "lobbyist"
  | "deeds"
  | "court_records"
  | "other"

export interface FieldMapping {
  /** Source field name in the Socrata dataset */
  source: string
  /** Normalized field name for our application */
  normalized: string
  /** Human-readable label */
  label: string
  /** Field type for parsing */
  type: "string" | "number" | "date" | "boolean" | "currency"
}

export interface DataSourceConfig {
  /** Unique identifier for this data source */
  id: string
  /** Human-readable name */
  name: string
  /** Data category */
  category: DataCategory
  /** State/region code */
  state: string
  /** City/county name if applicable */
  locality?: string
  /** Socrata portal base URL */
  portal: string
  /** Dataset resource ID (the 4x4 code) */
  datasetId: string
  /** Field mappings from source to normalized names */
  fields: FieldMapping[]
  /** SoQL query hints for optimal searching */
  searchFields?: string[]
  /** Notes about this dataset */
  notes?: string
  /** Last verified working date */
  lastVerified?: string
  /** Whether this dataset is verified working */
  verified: boolean
}

// ============================================================================
// QUERY TYPES
// ============================================================================

export type SoQLOperator =
  | "="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "LIKE"
  | "NOT LIKE"
  | "IS NULL"
  | "IS NOT NULL"
  | "IN"
  | "NOT IN"
  | "BETWEEN"

export interface SoQLCondition {
  field: string
  operator: SoQLOperator
  value: string | number | string[] | number[]
}

export interface SoQLQuery {
  /** SELECT clause - fields to return */
  select?: string[]
  /** WHERE clause conditions */
  where?: SoQLCondition[]
  /** Raw WHERE clause (for complex queries) */
  whereRaw?: string
  /** ORDER BY clause */
  orderBy?: { field: string; direction: "ASC" | "DESC" }[]
  /** GROUP BY clause */
  groupBy?: string[]
  /** HAVING clause */
  having?: string
  /** LIMIT clause */
  limit?: number
  /** OFFSET clause */
  offset?: number
  /** Full-text search query */
  q?: string
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface SocrataResponse<T = Record<string, unknown>> {
  data: T[]
  metadata: {
    portal: string
    datasetId: string
    query: string
    count: number
    totalAvailable?: number
  }
  sources: Array<{ name: string; url: string }>
  rawContent: string
  error?: string
}

// ============================================================================
// RATE LIMIT TYPES
// ============================================================================

export interface RateLimitState {
  /** Requests made in current window */
  requestCount: number
  /** Window start timestamp */
  windowStart: number
  /** Max requests per window */
  maxRequests: number
  /** Window size in milliseconds */
  windowMs: number
}

export interface RateLimitConfig {
  /** Whether we have an app token (higher limits) */
  hasAppToken: boolean
  /** Requests per hour without token */
  noTokenLimit: number
  /** Requests per hour with token */
  withTokenLimit: number
}
