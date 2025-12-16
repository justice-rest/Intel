/**
 * Neon CRM API Types
 * Based on Neon CRM API v2: https://developer.neoncrm.com/api-v2/
 */

// ============================================================================
// ACCOUNT TYPES
// ============================================================================

export interface NeonCRMAddress {
  addressId?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  stateProvince?: {
    code?: string
    name?: string
  }
  zipCode?: string
  country?: {
    id?: string
    name?: string
  }
  isPrimaryAddress?: boolean
}

export interface NeonCRMPrimaryContact {
  contactId?: string
  firstName?: string
  lastName?: string
  preferredName?: string
  email1?: string
  email2?: string
  phone1?: string
  phone2?: string
  addresses?: NeonCRMAddress[]
  employer?: {
    id?: string
    name?: string
  }
  currentEmployer?: string
  jobTitle?: string
}

export interface NeonCRMIndividualAccount {
  accountId?: string
  primaryContact?: NeonCRMPrimaryContact
}

export interface NeonCRMCompanyAccount {
  accountId?: string
  name?: string
  email?: string
  phone?: string
  addresses?: NeonCRMAddress[]
  website?: string
}

export interface NeonCRMDonationsSummary {
  totalDonations?: number
  total?: number
  lastDonationDate?: string
  lastDonationAmount?: number
  firstDonationDate?: string
  averageDonation?: number
}

export interface NeonCRMCustomField {
  id: string
  name: string
  value: string
}

export interface NeonCRMAccount {
  accountId?: string
  individualAccount?: NeonCRMIndividualAccount
  companyAccount?: NeonCRMCompanyAccount
  donationsSummary?: NeonCRMDonationsSummary
  accountCustomFields?: NeonCRMCustomField[]
  timestamps?: {
    createdDateTime?: string
    updatedDateTime?: string
  }
}

// ============================================================================
// DONATION TYPES
// ============================================================================

export interface NeonCRMDonation {
  id?: string
  accountId?: string
  amount?: number
  date?: string
  status?: string
  campaign?: {
    id?: string
    name?: string
  }
  fund?: {
    id?: string
    name?: string
  }
  payment?: {
    paymentMethod?: string
  }
  donationType?: string
  acknowledgement?: {
    status?: string
    date?: string
  }
  timestamps?: {
    createdDateTime?: string
    updatedDateTime?: string
  }
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface NeonCRMPagination {
  currentPage: number
  pageSize: number
  totalPages: number
  totalResults: number
}

export interface NeonCRMAccountsResponse {
  accounts?: NeonCRMAccount[]
  pagination?: NeonCRMPagination
}

export interface NeonCRMDonationsResponse {
  donations?: NeonCRMDonation[]
  pagination?: NeonCRMPagination
}

export interface NeonCRMSearchResult {
  [key: string]: string | number | undefined
}

export interface NeonCRMSearchResponse {
  searchResults?: NeonCRMSearchResult[]
  pagination?: NeonCRMPagination
}

// ============================================================================
// CREDENTIALS
// ============================================================================

export interface NeonCRMCredentials {
  orgId: string
  apiKey: string
}
