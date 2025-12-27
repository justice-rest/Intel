/**
 * EveryAction (NGP VAN) API Types
 *
 * EveryAction provides APIs for nonprofit donor management.
 * Uses API key authentication with database mode indicator.
 *
 * Authentication: HTTP Basic Auth (applicationName:apiKey|dbMode)
 * Database Mode: 0 for VoterFile, 1 for MyVoters/MyCampaign
 *
 * @see https://docs.everyaction.com/reference/api-overview
 * @see https://docs.ngpvan.com/reference/authentication
 */

// ============================================================================
// AUTHENTICATION
// ============================================================================

export interface EveryActionCredentials {
  applicationName: string
  apiKey: string
  databaseMode: 0 | 1 // 0 = VoterFile, 1 = MyVoters/MyCampaign
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface EveryActionListResponse<T> {
  items: T[]
  count: number
  nextPageLink?: string
}

export interface EveryActionError {
  errors: EveryActionErrorItem[]
}

export interface EveryActionErrorItem {
  code: string
  text: string
  properties?: string[]
  referenceCode?: string
  hint?: string
  resourceUrl?: string
}

// ============================================================================
// PERSON (CONSTITUENT)
// ============================================================================

export interface EveryActionPerson {
  vanId: number
  firstName?: string
  middleName?: string
  lastName?: string
  nickname?: string
  title?: string
  suffix?: string
  pronouns?: string

  // Contact
  emails?: EveryActionEmail[]
  phones?: EveryActionPhone[]
  addresses?: EveryActionAddress[]

  // Giving (if available)
  // These are typically calculated from contributions
  dateOfBirth?: string
  sex?: string

  // Organization (for org donors)
  isOrganization?: boolean
  organizationName?: string
  employerName?: string
  jobTitle?: string

  // Dates
  dateCreated?: string
  dateModified?: string
}

export interface EveryActionEmail {
  email: string
  type?: string // "P" for personal, "W" for work
  isPreferred?: boolean
  dateCreated?: string
}

export interface EveryActionPhone {
  phoneNumber: string
  phoneType?: string // "C" for cell, "H" for home, "W" for work, "F" for fax
  isPreferred?: boolean
  ext?: string
  dateCreated?: string
}

export interface EveryActionAddress {
  addressId?: number
  addressLine1?: string
  addressLine2?: string
  addressLine3?: string
  city?: string
  stateOrProvince?: string
  zipOrPostalCode?: string
  countryCode?: string
  type?: string // "H" for home, "W" for work, "V" for voting
  isPreferred?: boolean
  dateCreated?: string
}

// ============================================================================
// CONTRIBUTION (DONATION)
// ============================================================================

export interface EveryActionContribution {
  contributionId: number
  vanId: number // Donor's VAN ID

  // Contribution details
  amount: number
  dateReceived?: string
  dateThanked?: string
  datePosted?: string

  // Status
  status?: string
  statusChangedDate?: string

  // Payment
  paymentType?: string
  checkNumber?: string
  creditCardLast4?: string

  // Attribution
  attributionType?: string
  linkedContributionId?: number

  // Designation
  designation?: EveryActionDesignation
  fund?: EveryActionFund
  campaign?: EveryActionCampaign

  // Batch info
  batchCode?: string
  batchNumber?: string

  // Acknowledgement
  acknowledgementStatus?: string
  acknowledgementDate?: string

  // Matching
  matchingContributionId?: number
  employerMatchingContribution?: boolean

  // Notes
  notes?: string
  pledgeId?: number

  // Codes
  codes?: EveryActionCode[]

  // Dates
  dateCreated?: string
  dateModified?: string
}

export interface EveryActionDesignation {
  designationId: number
  name: string
  description?: string
}

export interface EveryActionFund {
  fundId: number
  name: string
  description?: string
}

export interface EveryActionCampaign {
  campaignId: number
  name: string
  type?: string
}

export interface EveryActionCode {
  codeId: number
  name: string
  type?: string
}

// ============================================================================
// PLEDGE
// ============================================================================

export interface EveryActionPledge {
  pledgeId: number
  vanId: number
  amount: number
  pledgeDate?: string
  designation?: EveryActionDesignation
  status?: string
  numberOfInstallments?: number
  installmentFrequency?: string
  firstInstallmentDate?: string
  dateCreated?: string
  dateModified?: string
}

// ============================================================================
// SEARCH/QUERY PARAMS
// ============================================================================

export interface EveryActionPersonSearchParams {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  vanId?: number | string
  expand?: string[] // ["emails", "phones", "addresses"]
  $top?: number // Limit
  $skip?: number // Offset
}

export interface EveryActionContributionSearchParams {
  vanId?: number
  dateReceivedSince?: string
  dateReceivedBefore?: string
  status?: string
  $top?: number
  $skip?: number
}

// ============================================================================
// PERSON CREATE/UPDATE
// ============================================================================

export interface EveryActionPersonMatch {
  firstName: string
  lastName: string
  email?: string
  phone?: string
  zip?: string
  dateOfBirth?: string
}

export interface EveryActionFindOrCreateResponse {
  vanId: number
  status: "Matched" | "Created"
}
