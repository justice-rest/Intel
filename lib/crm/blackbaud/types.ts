/**
 * Blackbaud SKY API Types (Raiser's Edge NXT)
 *
 * SKY API provides access to Raiser's Edge NXT data through RESTful endpoints.
 * Uses OAuth 2.0 for authentication with subscription keys.
 *
 * Rate Limit: 10 calls/second, 50,000-100,000 daily quota
 * Token Expiry: Refresh tokens expire after 365 days
 *
 * @see https://developer.blackbaud.com/skyapi/docs/basics/
 * @see https://developer.blackbaud.com/skyapi/apis
 */

// ============================================================================
// AUTHENTICATION
// ============================================================================

export interface BlackbaudCredentials {
  accessToken: string
  refreshToken?: string
  subscriptionKey: string // Required for all API calls
  tokenExpiry?: number // Unix timestamp
  environmentId?: string // Optional environment identifier
}

export interface BlackbaudTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  scope?: string
}

export interface BlackbaudOAuthError {
  error: string
  error_description?: string
  error_uri?: string
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface BlackbaudListResponse<T> {
  count: number
  next_link?: string
  value: T[]
}

export interface BlackbaudError {
  statusCode: number
  error: string
  message: string
}

// ============================================================================
// CONSTITUENT
// ============================================================================

export interface BlackbaudConstituent {
  id: string
  type: "Individual" | "Organization"
  lookup_id?: string // User-defined ID

  // Name fields (Individual)
  name?: string
  first?: string
  last?: string
  middle?: string
  preferred_name?: string
  title?: string
  suffix?: string

  // Name fields (Organization)
  org_name?: string

  // Primary contact
  email?: BlackbaudEmail
  phone?: BlackbaudPhone
  address?: BlackbaudAddress

  // Lists
  emails?: BlackbaudEmail[]
  phones?: BlackbaudPhone[]
  addresses?: BlackbaudAddress[]

  // Giving summary
  giving_summary?: BlackbaudGivingSummary
  lifetime_giving?: number
  first_gift_date?: string
  last_gift_date?: string

  // Demographics
  birthdate?: string
  gender?: string
  marital_status?: string
  deceased?: boolean

  // Dates
  date_added?: string
  date_modified?: string
}

export interface BlackbaudEmail {
  id?: string
  address: string
  type: string // "Email", "Work", "Home"
  primary?: boolean
  inactive?: boolean
}

export interface BlackbaudPhone {
  id?: string
  number: string
  type: string // "Home", "Work", "Mobile"
  primary?: boolean
  inactive?: boolean
}

export interface BlackbaudAddress {
  id?: string
  address_lines?: string
  city?: string
  state?: string
  postal_code?: string
  county?: string
  country?: string
  type: string // "Home", "Work", "Business"
  primary?: boolean
  inactive?: boolean
  formatted_address?: string
}

export interface BlackbaudGivingSummary {
  total_amount?: number
  total_number_of_gifts?: number
  first_gift_date?: string
  last_gift_date?: string
  last_gift_amount?: number
  largest_gift_amount?: number
  average_gift_amount?: number
  consecutive_years_given?: number
}

// ============================================================================
// GIFT (DONATION)
// ============================================================================

export interface BlackbaudGift {
  id: string
  lookup_id?: string
  constituent_id: string

  // Gift details
  type: string // "Donation", "Pledge", "RecurringGift", "Other"
  amount?: BlackbaudAmount
  date?: string
  post_date?: string
  post_status?: string

  // Designation
  gift_splits?: BlackbaudGiftSplit[]
  fund?: { id: string; name?: string }
  campaign?: { id: string; name?: string }
  appeal?: { id: string; name?: string }

  // Payment
  payment_method?: string
  check_number?: string
  check_date?: string

  // Acknowledgement
  acknowledgements?: { status?: string; date?: string }[]
  receipt_status?: string
  receipt_date?: string

  // Soft credits
  gift_aid_amount?: BlackbaudAmount
  is_anonymous?: boolean

  // System fields
  date_added?: string
  date_modified?: string
}

export interface BlackbaudAmount {
  value: number
  currency?: string
}

export interface BlackbaudGiftSplit {
  amount?: BlackbaudAmount
  fund?: { id: string; name?: string }
  campaign?: { id: string; name?: string }
  appeal?: { id: string; name?: string }
}

// ============================================================================
// SEARCH/QUERY PARAMS
// ============================================================================

export interface BlackbaudConstituentSearchParams {
  search_text?: string
  sort?: string
  list_id?: string
  include_inactive?: boolean
  offset?: number
  limit?: number
  date_modified?: string // ISO date, for incremental sync
}

export interface BlackbaudGiftSearchParams {
  constituent_id?: string
  gift_type?: string
  post_status?: string
  sort?: string
  offset?: number
  limit?: number
  date_modified?: string
}

// ============================================================================
// CODE TABLES
// ============================================================================

export interface BlackbaudCodeTable {
  name: string
  entries: BlackbaudCodeTableEntry[]
}

export interface BlackbaudCodeTableEntry {
  id: string
  value: string
  sequence?: number
  active?: boolean
}

// ============================================================================
// SUBSCRIPTION / ENVIRONMENT
// ============================================================================

export interface BlackbaudEnvironment {
  environment_id: string
  environment_name: string
  legal_entity_id?: string
  legal_entity_name?: string
}
