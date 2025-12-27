/**
 * Salesforce NPSP (Nonprofit Success Pack) API Types
 *
 * Salesforce uses standard REST API with NPSP custom objects:
 * - Contact: Constituents/donors
 * - Account: Organizations/households
 * - Opportunity: Donations (with npe01__OppPayment__c for payments)
 * - npe03__Recurring_Donation__c: Recurring gifts
 *
 * @see https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_rest.htm
 * @see https://powerofus.force.com/s/article/NPSP-Development-Standards
 */

// ============================================================================
// AUTHENTICATION
// ============================================================================

export interface SalesforceCredentials {
  instanceUrl: string // e.g., https://yourorg.my.salesforce.com
  accessToken: string
  refreshToken?: string
  tokenExpiry?: number // Unix timestamp
  clientId?: string
  clientSecret?: string
}

export interface SalesforceTokenResponse {
  access_token: string
  refresh_token?: string
  instance_url: string
  id: string
  token_type: string
  issued_at: string
  expires_in?: number
  signature: string
}

export interface SalesforceOAuthError {
  error: string
  error_description: string
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface SalesforceQueryResponse<T> {
  totalSize: number
  done: boolean
  nextRecordsUrl?: string
  records: T[]
}

export interface SalesforceError {
  message: string
  errorCode: string
  fields?: string[]
}

export interface SalesforceCreateResponse {
  id: string
  success: boolean
  errors: SalesforceError[]
}

// ============================================================================
// CONTACT (CONSTITUENT)
// ============================================================================

export interface SalesforceContact {
  Id: string
  FirstName?: string
  LastName: string
  Name?: string // Full name (auto-generated)
  Email?: string
  Phone?: string
  MobilePhone?: string
  HomePhone?: string

  // Mailing Address
  MailingStreet?: string
  MailingCity?: string
  MailingState?: string
  MailingPostalCode?: string
  MailingCountry?: string

  // Other Address
  OtherStreet?: string
  OtherCity?: string
  OtherState?: string
  OtherPostalCode?: string
  OtherCountry?: string

  // Account relationship
  AccountId?: string
  Account?: SalesforceAccount

  // NPSP Fields
  npo02__TotalOppAmount__c?: number // Total lifetime giving
  npo02__NumberOfClosedOpps__c?: number // Number of donations
  npo02__FirstCloseDate__c?: string // First donation date
  npo02__LastCloseDate__c?: string // Last donation date
  npo02__LastOppAmount__c?: number // Last donation amount
  npo02__LargestAmount__c?: number // Largest donation
  npo02__AverageAmount__c?: number // Average donation
  npo02__SmallestAmount__c?: number // Smallest donation

  // System fields
  CreatedDate: string
  LastModifiedDate: string
  SystemModstamp: string
}

// ============================================================================
// ACCOUNT (ORGANIZATION/HOUSEHOLD)
// ============================================================================

export interface SalesforceAccount {
  Id: string
  Name: string
  Type?: string // "Household", "Organization", etc.
  RecordTypeId?: string

  // Address
  BillingStreet?: string
  BillingCity?: string
  BillingState?: string
  BillingPostalCode?: string
  BillingCountry?: string

  ShippingStreet?: string
  ShippingCity?: string
  ShippingState?: string
  ShippingPostalCode?: string
  ShippingCountry?: string

  // Contact info
  Phone?: string
  Fax?: string
  Website?: string

  // NPSP Fields
  npo02__TotalOppAmount__c?: number
  npo02__NumberOfClosedOpps__c?: number
  npo02__FirstCloseDate__c?: string
  npo02__LastCloseDate__c?: string
  npo02__SYSTEM_CUSTOM_NAMING__c?: string

  // System fields
  CreatedDate: string
  LastModifiedDate: string
}

// ============================================================================
// OPPORTUNITY (DONATION)
// ============================================================================

export interface SalesforceOpportunity {
  Id: string
  Name: string
  AccountId?: string
  Account?: SalesforceAccount

  // Contact relationship (NPSP Primary Contact)
  npsp__Primary_Contact__c?: string
  npsp__Primary_Contact__r?: SalesforceContact
  ContactId?: string // Standard Contact lookup

  // Donation details
  Amount: number
  CloseDate: string // Date of donation
  StageName: string // "Closed Won", "Pledged", etc.
  Probability?: number

  // Type and campaign
  Type?: string // "Donation", "Grant", "Major Gift", etc.
  CampaignId?: string
  Campaign?: SalesforceCampaign

  // NPSP Fields
  npe01__Membership_Start_Date__c?: string
  npe01__Membership_End_Date__c?: string
  npe01__Member_Level__c?: string
  npe01__Payment_Method__c?: string

  // Recurring donation link
  npe03__Recurring_Donation__c?: string

  // Description
  Description?: string

  // System fields
  CreatedDate: string
  LastModifiedDate: string
}

// ============================================================================
// CAMPAIGN
// ============================================================================

export interface SalesforceCampaign {
  Id: string
  Name: string
  Type?: string
  Status?: string
  StartDate?: string
  EndDate?: string
  Description?: string
  ExpectedRevenue?: number
  BudgetedCost?: number
  ActualCost?: number
  NumberOfContacts?: number
  NumberOfOpportunities?: number
  AmountAllOpportunities?: number
}

// ============================================================================
// RECURRING DONATION (NPSP)
// ============================================================================

export interface SalesforceRecurringDonation {
  Id: string
  Name: string
  npe03__Contact__c?: string
  npe03__Contact__r?: SalesforceContact
  npe03__Organization__c?: string // Account ID for org donations
  npe03__Amount__c?: number
  npe03__Installment_Period__c?: string // "Monthly", "Yearly", etc.
  npe03__Installments__c?: number
  npe03__Date_Established__c?: string
  npe03__Schedule_Type__c?: string // "Multiply By", "Divide By"
  npe03__Open_Ended_Status__c?: string // "Open", "Closed"
  npsp__Status__c?: string
  npsp__Day_of_Month__c?: string
  npsp__PaymentMethod__c?: string
  CreatedDate: string
  LastModifiedDate: string
}

// ============================================================================
// SEARCH/QUERY PARAMS
// ============================================================================

export interface SalesforceContactSearchParams {
  query?: string // SOSL search query
  modifiedSince?: string // ISO date for incremental sync
  limit?: number
  offset?: number
}

export interface SalesforceOpportunitySearchParams {
  contactId?: string
  accountId?: string
  modifiedSince?: string
  stageName?: string
  limit?: number
  offset?: number
}

// ============================================================================
// SOBJECT DESCRIBE
// ============================================================================

export interface SalesforceSObjectDescribe {
  name: string
  label: string
  labelPlural: string
  custom: boolean
  queryable: boolean
  searchable: boolean
  retrieveable: boolean
  createable: boolean
  updateable: boolean
  deletable: boolean
  fields: SalesforceFieldDescribe[]
}

export interface SalesforceFieldDescribe {
  name: string
  label: string
  type: string
  length?: number
  scale?: number
  precision?: number
  custom: boolean
  nillable: boolean
  unique: boolean
  picklistValues?: { value: string; label: string; active: boolean }[]
}

// ============================================================================
// LIMITS/USAGE
// ============================================================================

export interface SalesforceOrgLimits {
  DailyApiRequests: {
    Max: number
    Remaining: number
  }
  DailyBulkApiRequests: {
    Max: number
    Remaining: number
  }
  SingleEmail: {
    Max: number
    Remaining: number
  }
  DataStorageMB: {
    Max: number
    Remaining: number
  }
}
