/**
 * Discovery Types
 * Type definitions for the FindAll prospect discovery system
 * Matches the existing batch processing patterns for consistency
 */

// ============================================================================
// STATUS TYPES
// ============================================================================

export type DiscoveryJobStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type DiscoveryCandidateStatus =
  | "generated"
  | "matched"
  | "unmatched"
  | "discarded"

// ============================================================================
// MATCH CONDITION
// ============================================================================

export interface MatchCondition {
  name: string
  description: string
}

// ============================================================================
// DISCOVERY JOB
// ============================================================================

export interface DiscoveryJobSettings {
  /** Maximum number of matches to find (5-50) */
  match_limit: number
  /** Generator quality */
  generator: "base" | "core" | "pro" | "preview"
  /** Entity type to discover */
  entity_type: string
}

export const DEFAULT_DISCOVERY_SETTINGS: DiscoveryJobSettings = {
  match_limit: 10,
  generator: "pro",
  entity_type: "people",  // Must be plural: people, companies, products, events, locations, houses
}

export interface DiscoveryJob {
  id: string
  user_id: string
  name: string
  description?: string
  status: DiscoveryJobStatus

  // Discovery criteria
  objective: string
  match_conditions: MatchCondition[]
  location?: string
  exclude_names?: string[]

  // Settings
  settings: DiscoveryJobSettings

  // Progress
  total_candidates: number
  matched_count: number
  unmatched_count: number
  discarded_count: number

  // Parallel AI reference
  findall_id?: string

  // Timestamps
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string

  // Error tracking
  error_message?: string
  last_error_at?: string

  // Cost tracking
  estimated_cost_usd?: number
}

// ============================================================================
// DISCOVERY CANDIDATE
// ============================================================================

export interface DiscoveryCandidate {
  id: string
  job_id: string
  user_id: string

  // Candidate info from FindAll
  candidate_id: string
  name: string
  description?: string
  url: string

  // Status
  status: DiscoveryCandidateStatus

  // Match results (JSON from FindAll)
  match_results?: Record<string, unknown>

  // Sources/citations
  sources: Array<{
    url: string
    title?: string
    excerpts?: string[]
    field_name?: string
    reasoning?: string
  }>

  // Timestamps
  created_at: string
  updated_at: string
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateDiscoveryJobRequest {
  name: string
  description?: string
  objective: string
  match_conditions: MatchCondition[]
  location?: string
  exclude_names?: string[]
  settings?: Partial<DiscoveryJobSettings>
}

export interface CreateDiscoveryJobResponse {
  job: DiscoveryJob
  message: string
}

export interface DiscoveryJobListResponse {
  jobs: DiscoveryJob[]
  total: number
}

export interface DiscoveryJobDetailResponse {
  job: DiscoveryJob
  candidates: DiscoveryCandidate[]
  progress: {
    percentage: number
    estimated_remaining_ms?: number
  }
}

export interface StartDiscoveryRequest {
  job_id: string
}

export interface StartDiscoveryResponse {
  job: DiscoveryJob
  findall_id: string
  message: string
}

// ============================================================================
// PRESET TEMPLATES
// ============================================================================

export interface DiscoveryTemplate {
  id: string
  name: string
  description: string
  objective: string
  entity_type: string
  match_conditions: MatchCondition[]
  icon: "tech" | "realestate" | "healthcare" | "finance"
}

export const DISCOVERY_TEMPLATES: DiscoveryTemplate[] = [
  {
    id: "tech_philanthropists",
    name: "Tech Philanthropists",
    description: "Technology entrepreneurs with foundations or major giving",
    objective: "Find technology entrepreneurs and executives who are active philanthropists",
    entity_type: "people",  // Must be plural: people, companies, products
    match_conditions: [
      {
        name: "tech_background",
        description: "Must have founded or led a technology company",
      },
      {
        name: "philanthropic_activity",
        description: "Must have a foundation, donor-advised fund, or documented major gifts over $100K",
      },
    ],
    icon: "tech",
  },
  {
    id: "real_estate_investors",
    name: "Real Estate Investors",
    description: "Property investors and developers who give to charity",
    objective: "Find real estate investors and developers who support charitable causes",
    entity_type: "people",  // Must be plural: people, companies, products
    match_conditions: [
      {
        name: "real_estate_holdings",
        description: "Must own multiple commercial or residential properties valued over $5M total",
      },
      {
        name: "charitable_giving",
        description: "Must have documented charitable giving or sit on nonprofit boards",
      },
    ],
    icon: "realestate",
  },
  {
    id: "healthcare_executives",
    name: "Healthcare Executives",
    description: "Healthcare industry leaders with philanthropic interests",
    objective: "Find healthcare executives and entrepreneurs who support health-related causes",
    entity_type: "people",  // Must be plural: people, companies, products
    match_conditions: [
      {
        name: "healthcare_leadership",
        description: "Must be CEO, founder, or senior executive at a healthcare company",
      },
      {
        name: "health_philanthropy",
        description: "Must support health-related nonprofits or medical research",
      },
    ],
    icon: "healthcare",
  },
  {
    id: "finance_philanthropists",
    name: "Finance Philanthropists",
    description: "Finance and investment professionals with major giving capacity",
    objective: "Find finance professionals and investors who are significant philanthropists",
    entity_type: "people",  // Must be plural: people, companies, products
    match_conditions: [
      {
        name: "finance_background",
        description: "Must be partner, managing director, or founder in finance/investment",
      },
      {
        name: "major_gifts",
        description: "Must have made gifts over $1M or have a family foundation",
      },
    ],
    icon: "finance",
  },
]

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type DiscoveryExportFormat = "csv" | "json"

export interface DiscoveryExportRequest {
  job_id: string
  format: DiscoveryExportFormat
  include_all_candidates?: boolean
}

export interface DiscoveryExportResponse {
  success: boolean
  download_url?: string
  file_name?: string
  error?: string
}
