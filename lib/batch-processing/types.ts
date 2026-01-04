/**
 * Batch Processing Types
 * Type definitions for batch prospect processing system
 */

// ============================================================================
// STATUS TYPES
// ============================================================================

export type BatchJobStatus =
  | "pending"
  | "processing"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"

export type BatchItemStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "skipped"

// ============================================================================
// CONFIDENCE & RATING TYPES
// ============================================================================

/**
 * Confidence levels for data points
 * - VERIFIED: Official source (SEC, FEC, County Assessor, ProPublica 990)
 * - ESTIMATED: Calculated from indicators (includes methodology)
 * - UNVERIFIED: Single web source, not corroborated
 */
export type DataConfidence = "VERIFIED" | "ESTIMATED" | "UNVERIFIED"

/**
 * Overall research confidence level
 */
export type ResearchConfidence = "HIGH" | "MEDIUM" | "LOW"

/**
 * Capacity ratings based on TFG Research standards
 * - MAJOR: Net worth >$5M AND (business owner OR $1M+ property) = $25K+ capacity
 * - PRINCIPAL: Net worth $1M-$5M OR senior executive = $10K-$25K capacity
 * - LEADERSHIP: Net worth $500K-$1M OR professional = $5K-$10K capacity
 * - ANNUAL: Below indicators = <$5K capacity
 */
export type CapacityRating = "MAJOR" | "PRINCIPAL" | "LEADERSHIP" | "ANNUAL"

/**
 * Political party affiliation based on FEC giving patterns
 */
export type PoliticalParty = "REPUBLICAN" | "DEMOCRATIC" | "BIPARTISAN" | "NONE"

/**
 * Prospect readiness for solicitation
 */
export type ProspectReadiness = "NOT_READY" | "WARMING" | "READY" | "URGENT"

/**
 * Tax-smart giving options
 */
export type TaxSmartOption = "QCD" | "STOCK" | "DAF" | "NONE"

/**
 * @deprecated - Removed in favor of single comprehensive mode
 * Kept for backward compatibility with existing database records
 */
export type BatchSearchMode = "standard" | "comprehensive"

// ============================================================================
// PROSPECT INPUT DATA
// ============================================================================

/**
 * Core prospect fields that we recognize and normalize
 */
export interface ProspectInputData {
  // Required fields
  name: string

  // Name components (optional - parsed from name or provided separately)
  first_name?: string
  last_name?: string

  // Address fields (at least one required for research)
  address?: string
  city?: string
  state?: string
  zip?: string
  full_address?: string

  // Optional enrichment fields
  email?: string
  phone?: string
  company?: string
  title?: string
  notes?: string

  // Catch-all for custom columns
  [key: string]: string | undefined
}

/**
 * Column mapping configuration
 * Maps CSV column headers to our normalized field names
 */
export interface ColumnMapping {
  name: string | null  // Required - column containing prospect name (or will combine first_name + last_name)
  first_name?: string | null  // Optional - column containing first name
  last_name?: string | null   // Optional - column containing last name
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  full_address?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  title?: string | null
  notes?: string | null
}

// ============================================================================
// BATCH JOB
// ============================================================================

export interface BatchJobSettings {
  delay_between_prospects_ms: number
  enable_web_search: boolean
  max_retries: number
  generate_romy_score: boolean
  search_mode: BatchSearchMode
}

export const DEFAULT_BATCH_SETTINGS: BatchJobSettings = {
  delay_between_prospects_ms: 3000,
  enable_web_search: true,
  max_retries: 2,
  generate_romy_score: true,
  search_mode: "standard", // Default to Standard for quick prioritization
}

export interface BatchProspectJob {
  id: string
  user_id: string
  name: string
  description?: string
  status: BatchJobStatus

  // Progress
  total_prospects: number
  completed_count: number
  failed_count: number
  skipped_count: number

  // Source file
  source_file_name?: string
  source_file_url?: string
  source_file_size?: number

  // Configuration
  column_mapping?: ColumnMapping
  settings: BatchJobSettings

  // Webhook configuration
  webhook_url?: string
  webhook_secret?: string
  last_webhook_sent_at?: string
  webhook_error?: string

  // Timestamps
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string

  // Error tracking
  error_message?: string
  last_error_at?: string
}

// ============================================================================
// BATCH ITEM
// ============================================================================

export interface BatchProspectItem {
  id: string
  job_id: string
  user_id: string

  // Position and status
  item_index: number
  status: BatchItemStatus

  // Input data
  input_data: ProspectInputData

  // Normalized fields (for querying)
  prospect_name?: string
  prospect_first_name?: string
  prospect_last_name?: string
  prospect_address?: string
  prospect_city?: string
  prospect_state?: string
  prospect_zip?: string

  // Generated report
  report_content?: string
  report_format?: "markdown" | "html"

  // Extracted metrics
  romy_score?: number
  romy_score_tier?: string
  capacity_rating?: string
  estimated_net_worth?: number
  estimated_gift_capacity?: number
  recommended_ask?: number

  // Structured data (JSONB columns)
  wealth_indicators?: WealthIndicators
  business_details?: BusinessDetails
  giving_history?: GivingHistory
  affiliations?: Affiliations

  // Search data
  search_queries_used?: string[]
  sources_found?: Array<{ name: string; url: string }>

  // Processing metadata
  processing_started_at?: string
  processing_completed_at?: string
  processing_duration_ms?: number
  tokens_used?: number
  model_used?: string

  // Error handling
  error_message?: string
  retry_count: number
  last_retry_at?: string

  // Timestamps
  created_at: string
  updated_at: string
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateBatchJobRequest {
  name: string
  description?: string
  prospects: ProspectInputData[]
  column_mapping?: ColumnMapping
  settings?: Partial<BatchJobSettings>
  source_file_name?: string
  source_file_size?: number
  // Webhook notification URL (receives POST on job completion)
  webhook_url?: string
  // Optional secret for webhook signature verification
  webhook_secret?: string
}

export interface CreateBatchJobResponse {
  job: BatchProspectJob
  items_created: number
  message: string
}

export interface BatchJobListResponse {
  jobs: BatchProspectJob[]
  total: number
}

export interface BatchJobDetailResponse {
  job: BatchProspectJob
  items: BatchProspectItem[]
  progress: {
    percentage: number
    estimated_remaining_ms?: number
  }
}

export interface ProcessNextItemRequest {
  job_id: string
}

export interface ProcessNextItemResponse {
  item?: BatchProspectItem
  job_status: BatchJobStatus
  progress: {
    completed: number
    total: number
    failed: number
  }
  has_more: boolean
  message: string
}

// ============================================================================
// PARSED FILE RESULT
// ============================================================================

export interface ParsedFileResult {
  success: boolean
  rows: Record<string, string>[]
  columns: string[]
  total_rows: number
  errors: string[]
  suggested_mapping: Partial<ColumnMapping>
}

// ============================================================================
// STRUCTURED DATA TYPES (for JSON extraction)
// ============================================================================

/**
 * Wealth indicators extracted from research
 */
export interface WealthIndicators {
  real_estate_total?: number
  property_count?: number
  business_equity?: number
  public_holdings?: number
  inheritance_likely?: boolean
}

/**
 * Business ownership details
 */
export interface BusinessDetails {
  companies?: string[]
  roles?: string[]
  industries?: string[]
}

/**
 * Philanthropic and political giving history
 */
export interface GivingHistory {
  total_political?: number
  political_party?: string
  foundation_affiliations?: string[]
  nonprofit_boards?: string[]
  known_major_gifts?: Array<{
    org: string
    amount: number
    year?: number
  }>
}

/**
 * Personal and professional affiliations
 */
export interface Affiliations {
  education?: string[]
  clubs?: string[]
  public_company_boards?: string[]
}

/**
 * Core metrics extracted from reports
 */
export interface ExtractedMetrics {
  romy_score?: number
  romy_score_tier?: string
  capacity_rating?: string
  estimated_net_worth?: number
  estimated_gift_capacity?: number
  recommended_ask?: number
}

/**
 * Complete structured data from Sonar+Grok research
 */
export interface StructuredProspectData extends ExtractedMetrics {
  wealth_indicators?: WealthIndicators
  business_details?: BusinessDetails
  giving_history?: GivingHistory
  affiliations?: Affiliations
}

/**
 * Result from Sonar research call
 */
export interface SonarResearchResult {
  content: string
  sources: Array<{ name: string; url: string }>
  tokens: number
}

/**
 * Result from the combined Sonar+Grok report generation
 */
export interface SonarGrokReportResult {
  report_content: string
  structured_data: StructuredProspectData
  sources: Array<{ name: string; url: string }>
  tokens_used: number
  model_used: string
  processing_duration_ms: number
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type ExportFormat = "csv" | "pdf" | "json"

export interface ExportRequest {
  job_id: string
  format: ExportFormat
  include_full_reports?: boolean
  include_failed?: boolean
}

export interface ExportResponse {
  success: boolean
  download_url?: string
  file_name?: string
  error?: string
}

// ============================================================================
// PROSPECT RESEARCH OUTPUT (New Perplexity Sonar Pro Format)
// ============================================================================

/**
 * Source citation from research
 */
export interface ResearchSource {
  title: string
  url: string
  data_provided: string  // What this source contributed to the research
}

/**
 * Individual property record
 */
export interface PropertyRecord {
  address: string
  value: number
  source: string  // "County Assessor" | "Zillow" | "Redfin" | etc.
  confidence: DataConfidence
}

/**
 * Business ownership record
 */
export interface BusinessRecord {
  company: string
  role: string
  estimated_value: number | null
  source: string
  confidence: DataConfidence
}

/**
 * Known major gift record
 */
export interface MajorGiftRecord {
  organization: string
  amount: number
  year: number | null
  source: string
}

/**
 * Core metrics from research - always present
 */
export interface ResearchMetrics {
  estimated_net_worth_low: number | null
  estimated_net_worth_high: number | null
  estimated_gift_capacity: number | null
  capacity_rating: CapacityRating
  romy_score: number  // 0-41
  recommended_ask: number | null
  confidence_level: ResearchConfidence
}

/**
 * Real estate holdings
 */
export interface RealEstateData {
  total_value: number | null
  properties: PropertyRecord[]
}

/**
 * Securities and public company affiliations
 */
export interface SecuritiesData {
  has_sec_filings: boolean
  insider_at: string[]  // Public company tickers
  source: string | null
}

/**
 * Wealth indicators from research
 */
export interface ResearchWealth {
  real_estate: RealEstateData
  business_ownership: BusinessRecord[]
  securities: SecuritiesData
}

/**
 * Political giving data from FEC
 */
export interface PoliticalGivingData {
  total: number
  party_lean: PoliticalParty
  source: "FEC" | null
}

/**
 * Philanthropic profile
 */
export interface ResearchPhilanthropy {
  political_giving: PoliticalGivingData
  foundation_affiliations: string[]
  nonprofit_boards: string[]
  known_major_gifts: MajorGiftRecord[]
}

/**
 * Family information
 */
export interface FamilyData {
  spouse: string | null
  children_count: number | null
}

/**
 * Personal background
 */
export interface ResearchBackground {
  age: number | null
  education: string[]
  career_summary: string
  family: FamilyData
}

/**
 * Cultivation strategy recommendations
 */
export interface CultivationStrategy {
  readiness: ProspectReadiness
  next_steps: string[]
  best_solicitor: string
  tax_smart_option: TaxSmartOption
  talking_points: string[]
  avoid: string[]
}

/**
 * Complete structured output from Perplexity Sonar Pro research
 * This is the JSON schema the model outputs directly
 */
export interface ProspectResearchOutput {
  // Core metrics (always required)
  metrics: ResearchMetrics

  // Wealth indicators with confidence levels
  wealth: ResearchWealth

  // Philanthropic profile
  philanthropy: ResearchPhilanthropy

  // Personal background
  background: ResearchBackground

  // Cultivation strategy
  strategy: CultivationStrategy

  // Sources with URLs (grounded citations)
  sources: ResearchSource[]

  // Brief narrative summary (for display)
  executive_summary: string
}

/**
 * Result from Perplexity Sonar Pro research
 */
export interface PerplexityResearchResult {
  success: boolean
  output?: ProspectResearchOutput
  report_markdown?: string  // Formatted display report
  tokens_used: number
  model_used: string
  processing_duration_ms: number
  error_message?: string
}
