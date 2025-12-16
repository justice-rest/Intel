/**
 * Bloomerang API Types
 * Based on Bloomerang REST API v2
 * @see https://bloomerang.co/product/integrations-data-management/api/rest-api-v1/
 */

// ============================================================================
// CONSTITUENT
// ============================================================================

export interface BloomerangConstituent {
  Id: number
  AccountId: number
  Type: "Individual" | "Organization" | "Household"
  Status: "Active" | "Inactive" | "Deceased" | "Duplicate"

  // Name fields
  FirstName?: string
  LastName?: string
  MiddleName?: string
  Suffix?: string
  FullName?: string
  InformalName?: string
  FormalName?: string
  OrganizationName?: string

  // Contact
  PrimaryEmail?: BloomerangEmail
  PrimaryPhone?: BloomerangPhone
  PrimaryAddress?: BloomerangAddress

  // Additional emails/phones
  SecondaryEmail?: BloomerangEmail
  SecondaryPhone?: BloomerangPhone

  // Giving summary (from API or computed)
  LifetimeGivingAmount?: number
  LargestGiftAmount?: number
  LastTransactionDate?: string
  LastTransactionAmount?: number
  FirstTransactionDate?: string
  TotalTransactionCount?: number

  // Custom fields
  CustomFields?: BloomerangCustomField[]

  // Communication preferences
  CommunicationRestrictions?: string[]
  CommunicationChannels?: string[]

  // Metadata
  CreatedDate: string
  LastModifiedDate: string
}

export interface BloomerangEmail {
  Id: number
  Type: "Home" | "Work" | "Other"
  Value: string
  IsPrimary: boolean
  IsBad: boolean
}

export interface BloomerangPhone {
  Id: number
  Type: "Home" | "Work" | "Mobile" | "Fax" | "Other"
  Number: string
  Extension?: string
  IsPrimary: boolean
  IsBad: boolean
}

export interface BloomerangAddress {
  Id: number
  Type: "Home" | "Work" | "Other"
  Street: string
  City: string
  State: string
  PostalCode: string
  Country: string
  IsPrimary: boolean
  IsBad: boolean
}

export interface BloomerangCustomField {
  FieldId: number
  FieldName: string
  Type: "Text" | "Number" | "Date" | "Boolean" | "PickList"
  Value: unknown
}

// ============================================================================
// TRANSACTION (DONATION)
// ============================================================================

export interface BloomerangTransaction {
  Id: number
  AccountId: number
  TransactionType:
    | "Donation"
    | "Pledge"
    | "RecurringDonation"
    | "PledgePayment"
    | "Grant"
    | "InKind"
    | "Other"
  Amount: number
  Date: string
  Method?: string
  CampaignId?: number
  CampaignName?: string
  FundId?: number
  FundName?: string
  AppealId?: number
  AppealName?: string
  Note?: string
  InHonorOf?: string
  InMemoryOf?: string
  AcknowledgementStatus?: "NotAcknowledged" | "Acknowledged" | "DoNotAcknowledge"
  Status: "Posted" | "Pending" | "Refunded" | "Declined" | "Reversed"
  CheckNumber?: string
  CheckDate?: string
  ReceiptNumber?: string

  // Soft credit info
  SoftCreditAccountId?: number

  // Metadata
  CreatedDate: string
  LastModifiedDate: string
}

// ============================================================================
// CAMPAIGN
// ============================================================================

export interface BloomerangCampaign {
  Id: number
  Name: string
  Goal?: number
  StartDate?: string
  EndDate?: string
  Status: "Active" | "Inactive"
  Description?: string
  CreatedDate: string
  LastModifiedDate: string
}

// ============================================================================
// FUND
// ============================================================================

export interface BloomerangFund {
  Id: number
  Name: string
  Description?: string
  Status: "Active" | "Inactive"
  CreatedDate: string
  LastModifiedDate: string
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface BloomerangListResponse<T> {
  Total: number
  Results: T[]
}

export interface BloomerangSingleResponse<T> {
  Result: T
}

export interface BloomerangErrorResponse {
  Message: string
  ModelState?: Record<string, string[]>
}

// ============================================================================
// API REQUEST PARAMS
// ============================================================================

export interface BloomerangConstituentSearchParams {
  search?: string
  skip?: number
  take?: number
  orderBy?: string
  orderDirection?: "Asc" | "Desc"
  lastModifiedDate?: string
  type?: "Individual" | "Organization" | "Household"
  status?: "Active" | "Inactive" | "Deceased" | "Duplicate"
}

export interface BloomerangTransactionSearchParams {
  skip?: number
  take?: number
  orderBy?: string
  orderDirection?: "Asc" | "Desc"
  lastModifiedDate?: string
  accountId?: number
  transactionType?: string
  startDate?: string
  endDate?: string
}

// ============================================================================
// ACCOUNT INFO (for validation)
// ============================================================================

export interface BloomerangAccount {
  Id: number
  Name: string
  DatabaseName?: string
}
