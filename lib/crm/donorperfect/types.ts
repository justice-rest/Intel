/**
 * DonorPerfect API Types
 * Based on DonorPerfect Online XML API v6.9
 * https://www.donorperfect.net/prod/xmlrequest.asp
 */

// ============================================================================
// DONOR TYPES (DP Table)
// ============================================================================

export interface DonorPerfectDonor {
  donor_id: string
  first_name?: string
  last_name?: string
  middle_name?: string
  suffix?: string
  title?: string
  salutation?: string
  prof_title?: string
  opt_line?: string // Organization name or secondary line
  address?: string
  address2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  address_type?: string
  home_phone?: string
  business_phone?: string
  fax_phone?: string
  mobile_phone?: string
  email?: string
  org_rec?: "Y" | "N" // Is this an organization record?
  donor_type?: string // IN = Individual, CO = Corporate
  nomail?: "Y" | "N"
  nomail_reason?: string
  narrative?: string
  donor_name?: string // Computed full name
  city_state_zip?: string // Computed address line

  // Giving summary fields (from dp_donorsearch or SELECT)
  gifts?: number // Total gift count
  gift_total?: number // Total lifetime giving
  last_contrib_amt?: number
  max_amt?: number // Largest gift
  max_date?: string // Date of largest gift
  avg_amt?: number
  ytd?: number // Year to date
  ly_ytd?: number // Last year to date
  yrs_donated?: number
  first_gift_date?: string
  last_gift_date?: string

  // Timestamps
  created_date?: string
  modified_date?: string
}

// ============================================================================
// GIFT TYPES (DPGIFT Table)
// ============================================================================

export interface DonorPerfectGift {
  gift_id: string
  donor_id: string
  record_type?: string // G = Gift, P = Pledge, M = Main split gift
  gift_date?: string // Format: MM/DD/YYYY
  gift_date2?: string // Alternative date field from dp_gifts
  amount?: number
  total?: number
  balance?: number // For pledges
  gl_code?: string // General Ledger code
  gl?: string // GL description
  solicit_code?: string
  sub_solicit_code?: string
  campaign?: string
  gift_type?: string
  split_gift?: "Y" | "N"
  pledge_payment?: "Y" | "N"
  reference?: string
  transaction_id?: string
  memory_honor?: string
  gfname?: string // Gift first name (for tributes)
  glname?: string // Gift last name (for tributes)
  fmv?: number // Fair market value
  batch_no?: number
  gift_narrative?: string
  ty_letter_no?: string // Thank you letter code
  glink?: number // Link to main gift in split
  plink?: number // Link to pledge
  nocalc?: "Y" | "N"
  receipt?: "Y" | "N"
  anongift?: string
  gift_aid_date?: string
  gift_aid_amt?: number
  gift_aid_eligible_g?: string
  currency?: string
  receipt_delivery_g?: string // N = no ack, E = email, B = both, L = letter

  // Timestamps
  created_date?: string
  modified_date?: string
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Parsed XML field from DonorPerfect API response
 * Format: <field name="donor_id" id="donor_id" value="147"/>
 */
export interface DonorPerfectXMLField {
  name: string
  id: string
  value: string
}

/**
 * Parsed XML record from DonorPerfect API response
 * Format: <record><field .../><field .../></record>
 */
export interface DonorPerfectXMLRecord {
  fields: DonorPerfectXMLField[]
}

/**
 * Parsed XML result from DonorPerfect API
 * Format: <result><record>...</record></result>
 */
export interface DonorPerfectXMLResult {
  records: DonorPerfectXMLRecord[]
  error?: string
}

// ============================================================================
// SEARCH/QUERY TYPES
// ============================================================================

export interface DonorPerfectDonorSearchParams {
  donor_id?: number | null
  last_name?: string | null
  first_name?: string | null
  opt_line?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
  filter_id?: number | null
  user_id?: string | null
}

export interface DonorPerfectGiftSearchParams {
  donor_id: number
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

/**
 * DonorPerfect has a 500 row limit per query.
 * Pagination is handled via WHERE clauses with > or < operators.
 */
export interface DonorPerfectPaginationState {
  lastDonorId?: number
  lastGiftId?: number
  hasMore: boolean
  totalFetched: number
}
