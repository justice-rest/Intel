/**
 * Virtuous CRM API Types
 * Based on Virtuous CRM+ API
 * @see https://docs.virtuoussoftware.com/
 */

// ============================================================================
// CONTACT
// ============================================================================

export interface VirtuousContact {
  id: number
  contactType: "Individual" | "Organization" | "Household"
  referenceSource?: string
  isPrivate: boolean

  // Name
  name: string
  informalName?: string
  formalName?: string
  title?: string
  firstName?: string
  middleName?: string
  lastName?: string
  suffix?: string
  organizationName?: string

  // Contact info
  primaryEmail?: string
  secondaryEmail?: string
  primaryPhone?: string
  secondaryPhone?: string

  // Address
  address?: VirtuousAddress

  // Giving summary
  lifetimeGiving?: number
  yearToDateGiving?: number
  lastGiftAmount?: number
  lastGiftDate?: string
  firstGiftDate?: string
  totalGifts?: number
  averageGiftAmount?: number

  // Engagement
  engagementScore?: number
  tags?: string[]

  // Custom fields
  customFields?: VirtuousCustomField[]

  // Metadata
  createdDateTime: string
  modifiedDateTime: string
}

export interface VirtuousAddress {
  id?: number
  label?: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  postal?: string
  country?: string
  isPrimary: boolean
}

export interface VirtuousCustomField {
  name: string
  value: unknown
  dataType: "Text" | "Number" | "Date" | "Boolean" | "Currency" | "PickList"
  displayName?: string
}

// ============================================================================
// GIFT (DONATION)
// ============================================================================

export interface VirtuousGift {
  id: number
  contactId: number
  contactName?: string
  giftType: "Donation" | "Pledge" | "PledgePayment" | "RecurringGift" | "InKind" | "Grant" | "Stock"
  amount: number
  giftDate: string
  paymentType?: string
  state: "Pending" | "Posted" | "Refunded" | "Reversed" | "Cancelled"

  // Campaign/Project
  segment?: string
  segmentId?: number
  project?: string
  projectId?: number
  appeal?: string
  appealId?: number

  // Details
  notes?: string
  transactionSource?: string
  transactionId?: string
  batch?: string
  batchNumber?: string

  // Acknowledgement
  acknowledgementStatus?: string
  acknowledgedDate?: string

  // Tax info
  isTaxDeductible?: boolean
  receiptNumber?: string
  receiptDate?: string

  // Soft credit
  softCredits?: VirtuousSoftCredit[]

  // Metadata
  createdDateTime: string
  modifiedDateTime: string
}

export interface VirtuousSoftCredit {
  contactId: number
  contactName: string
  amount: number
}

// ============================================================================
// SEGMENT (CAMPAIGN)
// ============================================================================

export interface VirtuousSegment {
  id: number
  name: string
  code?: string
  description?: string
  goal?: number
  startDate?: string
  endDate?: string
  isActive: boolean
  createdDateTime: string
  modifiedDateTime: string
}

// ============================================================================
// PROJECT
// ============================================================================

export interface VirtuousProject {
  id: number
  name: string
  code?: string
  description?: string
  projectType?: string
  isActive: boolean
  goal?: number
  onlineDisplayName?: string
  createdDateTime: string
  modifiedDateTime: string
}

// ============================================================================
// ORGANIZATION INFO
// ============================================================================

export interface VirtuousOrganization {
  name: string
  organizationId?: number
  timeZone?: string
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface VirtuousListResponse<T> {
  list: T[]
  total: number
  skip?: number
  take?: number
}

export interface VirtuousQueryRequest {
  groups?: VirtuousQueryGroup[]
  sortBy?: string
  descending?: boolean
  skip?: number
  take?: number
}

export interface VirtuousQueryGroup {
  conditions: VirtuousQueryCondition[]
}

export interface VirtuousQueryCondition {
  parameter: string
  operator: "Is" | "IsNot" | "Contains" | "StartsWith" | "GreaterThan" | "LessThan" | "Between"
  value: string | number | boolean
}

export interface VirtuousErrorResponse {
  message: string
  errors?: string[]
  statusCode?: number
}

// ============================================================================
// API REQUEST PARAMS
// ============================================================================

export interface VirtuousContactQueryParams {
  skip?: number
  take?: number
  sortBy?: string
  descending?: boolean
  modifiedSince?: string
  contactType?: "Individual" | "Organization" | "Household"
}

export interface VirtuousGiftQueryParams {
  skip?: number
  take?: number
  sortBy?: string
  descending?: boolean
  modifiedSince?: string
  contactId?: number
  giftDateStart?: string
  giftDateEnd?: string
}
