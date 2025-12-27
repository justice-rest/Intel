/**
 * Salesforce NPSP API Client
 * REST API integration for Nonprofit Success Pack
 *
 * Authentication: OAuth 2.0 with Connected App
 * Rate Limits: 15,000 API calls/day (standard), HTTP 429 for throttling
 * Retry Strategy: Exponential backoff with jitter
 *
 * @see https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_rest.htm
 */

import { CRM_API_CONFIG, getProviderRateLimitDelay } from "../config"
import {
  withRetry,
  shouldContinuePagination,
  PAGINATION_LIMITS,
  sleep,
} from "../utils"
import type {
  SalesforceCredentials,
  SalesforceTokenResponse,
  SalesforceQueryResponse,
  SalesforceContact,
  SalesforceOpportunity,
  SalesforceOrgLimits,
  SalesforceContactSearchParams,
  SalesforceOpportunitySearchParams,
} from "./types"

// ============================================================================
// CONSTANTS
// ============================================================================

const SALESFORCE_API_VERSION = "v59.0"
const RATE_LIMIT_DELAY = getProviderRateLimitDelay("salesforce")

// SOQL queries for NPSP data
const CONTACT_FIELDS = `
  Id, FirstName, LastName, Name, Email, Phone, MobilePhone, HomePhone,
  MailingStreet, MailingCity, MailingState, MailingPostalCode, MailingCountry,
  AccountId,
  npo02__TotalOppAmount__c, npo02__NumberOfClosedOpps__c,
  npo02__FirstCloseDate__c, npo02__LastCloseDate__c,
  npo02__LastOppAmount__c, npo02__LargestAmount__c, npo02__AverageAmount__c,
  CreatedDate, LastModifiedDate
`.replace(/\s+/g, " ").trim()

const OPPORTUNITY_FIELDS = `
  Id, Name, AccountId, Amount, CloseDate, StageName, Type,
  npsp__Primary_Contact__c, ContactId, CampaignId,
  npe01__Payment_Method__c, Description,
  CreatedDate, LastModifiedDate
`.replace(/\s+/g, " ").trim()

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildApiUrl(instanceUrl: string, path: string): string {
  const baseUrl = instanceUrl.replace(/\/$/, "")
  return `${baseUrl}/services/data/${SALESFORCE_API_VERSION}${path}`
}

function encodeSOQL(query: string): string {
  return encodeURIComponent(query.replace(/\s+/g, " ").trim())
}

// ============================================================================
// API CLIENT
// ============================================================================

async function salesforceFetch<T>(
  credentials: SalesforceCredentials,
  path: string,
  options?: RequestInit
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CRM_API_CONFIG.timeout)

  try {
    const url = buildApiUrl(credentials.instanceUrl, path)

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options?.headers,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After")
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000
      throw new Error(`Salesforce rate limit exceeded. Retry after ${waitTime}ms`)
    }

    // Handle auth errors
    if (response.status === 401) {
      throw new Error("Salesforce authentication failed - token may be expired")
    }

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Salesforce API error: ${response.status}`

      try {
        const errors = JSON.parse(errorText)
        if (Array.isArray(errors) && errors.length > 0) {
          errorMessage = errors.map((e) => e.message || e.errorCode).join(", ")
        }
      } catch {
        if (errorText) {
          errorMessage = errorText
        }
      }

      throw new Error(errorMessage)
    }

    const text = await response.text()
    if (!text) {
      return {} as T
    }

    return JSON.parse(text) as T
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Salesforce API request timed out")
    }

    throw error
  }
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Refresh an expired access token
 */
export async function refreshSalesforceToken(
  credentials: SalesforceCredentials
): Promise<SalesforceTokenResponse> {
  if (!credentials.refreshToken || !credentials.clientId || !credentials.clientSecret) {
    throw new Error("Missing credentials for token refresh")
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: credentials.refreshToken,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  })

  const response = await fetch(
    `${credentials.instanceUrl}/services/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error_description || "Token refresh failed")
  }

  return response.json()
}

/**
 * Validate Salesforce credentials by checking API limits
 */
export async function validateSalesforceKey(
  credentials: SalesforceCredentials
): Promise<{
  valid: boolean
  organizationName?: string
  error?: string
}> {
  try {
    // Check org limits to validate credentials
    const limits = await salesforceFetch<SalesforceOrgLimits>(
      credentials,
      "/limits"
    )

    // Also get org info for name
    const userInfo = await salesforceFetch<{ name: string; organization_name: string }>(
      { ...credentials, instanceUrl: credentials.instanceUrl },
      "/sobjects/User/me"
    ).catch(() => null)

    return {
      valid: true,
      organizationName: userInfo?.organization_name || "Salesforce Organization",
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid credentials",
    }
  }
}

// ============================================================================
// CONTACTS (CONSTITUENTS)
// ============================================================================

/**
 * Fetch contacts using SOQL query
 */
export async function fetchSalesforceContacts(
  credentials: SalesforceCredentials,
  params?: SalesforceContactSearchParams
): Promise<SalesforceQueryResponse<SalesforceContact>> {
  const whereClause: string[] = []

  if (params?.modifiedSince) {
    whereClause.push(`LastModifiedDate >= ${params.modifiedSince}`)
  }

  // Build SOQL query
  let soql = `SELECT ${CONTACT_FIELDS} FROM Contact`
  if (whereClause.length > 0) {
    soql += ` WHERE ${whereClause.join(" AND ")}`
  }
  soql += ` ORDER BY LastModifiedDate DESC`

  if (params?.limit) {
    soql += ` LIMIT ${params.limit}`
  }
  if (params?.offset) {
    soql += ` OFFSET ${params.offset}`
  }

  const encodedQuery = encodeSOQL(soql)
  return withRetry(
    () => salesforceFetch<SalesforceQueryResponse<SalesforceContact>>(
      credentials,
      `/query?q=${encodedQuery}`
    ),
    { maxRetries: 3 }
  )
}

/**
 * Search contacts by name or email
 */
export async function searchSalesforceContacts(
  credentials: SalesforceCredentials,
  query: string,
  limit: number = 25
): Promise<SalesforceQueryResponse<SalesforceContact>> {
  // Use SOSL for text search
  const soslQuery = `FIND {${query}*} IN ALL FIELDS RETURNING Contact(${CONTACT_FIELDS} LIMIT ${limit})`
  const encodedQuery = encodeURIComponent(soslQuery)

  const response = await withRetry(
    () => salesforceFetch<{ searchRecords: SalesforceContact[] }>(
      credentials,
      `/search?q=${encodedQuery}`
    ),
    { maxRetries: 3 }
  )

  return {
    totalSize: response.searchRecords?.length || 0,
    done: true,
    records: response.searchRecords || [],
  }
}

/**
 * Get a single contact by ID
 */
export async function getSalesforceContact(
  credentials: SalesforceCredentials,
  contactId: string
): Promise<SalesforceContact> {
  return withRetry(
    () => salesforceFetch<SalesforceContact>(
      credentials,
      `/sobjects/Contact/${contactId}`
    ),
    { maxRetries: 3 }
  )
}

/**
 * Fetch all contacts in batches (generator)
 */
export async function* fetchAllSalesforceContacts(
  credentials: SalesforceCredentials,
  batchSize: number = 200
): AsyncGenerator<SalesforceContact[], void, unknown> {
  let iterationCount = 0
  let consecutiveEmptyBatches = 0
  let totalFetched = 0
  let nextRecordsUrl: string | undefined

  // Initial query
  let soql = `SELECT ${CONTACT_FIELDS} FROM Contact ORDER BY LastModifiedDate DESC LIMIT ${batchSize}`

  while (true) {
    // Pagination safety check
    const paginationCheck = shouldContinuePagination(
      totalFetched,
      iterationCount,
      consecutiveEmptyBatches,
      PAGINATION_LIMITS
    )
    if (!paginationCheck.continue) {
      console.warn(`[Salesforce] Contact pagination stopped: ${paginationCheck.reason}`)
      break
    }

    iterationCount++

    try {
      let response: SalesforceQueryResponse<SalesforceContact>

      if (nextRecordsUrl) {
        // Use nextRecordsUrl for pagination
        response = await withRetry(
          () => salesforceFetch<SalesforceQueryResponse<SalesforceContact>>(
            credentials,
            nextRecordsUrl!.replace(`/services/data/${SALESFORCE_API_VERSION}`, "")
          ),
          { maxRetries: 3 }
        )
      } else {
        // Initial query
        response = await withRetry(
          () => salesforceFetch<SalesforceQueryResponse<SalesforceContact>>(
            credentials,
            `/query?q=${encodeSOQL(soql)}`
          ),
          { maxRetries: 3 }
        )
      }

      if (response.records.length > 0) {
        consecutiveEmptyBatches = 0
        yield response.records
        totalFetched += response.records.length
      } else {
        consecutiveEmptyBatches++
      }

      // Check if more records available
      if (response.done || !response.nextRecordsUrl) {
        break
      }

      nextRecordsUrl = response.nextRecordsUrl

      // Rate limiting delay
      await sleep(RATE_LIMIT_DELAY)
    } catch (error) {
      console.error(`[Salesforce] Error fetching contacts:`, error)
      throw error
    }
  }
}

// ============================================================================
// OPPORTUNITIES (DONATIONS)
// ============================================================================

/**
 * Fetch opportunities (donations)
 */
export async function fetchSalesforceOpportunities(
  credentials: SalesforceCredentials,
  params?: SalesforceOpportunitySearchParams
): Promise<SalesforceQueryResponse<SalesforceOpportunity>> {
  const whereClause: string[] = []

  if (params?.contactId) {
    whereClause.push(`npsp__Primary_Contact__c = '${params.contactId}'`)
  }
  if (params?.accountId) {
    whereClause.push(`AccountId = '${params.accountId}'`)
  }
  if (params?.modifiedSince) {
    whereClause.push(`LastModifiedDate >= ${params.modifiedSince}`)
  }
  if (params?.stageName) {
    whereClause.push(`StageName = '${params.stageName}'`)
  }

  let soql = `SELECT ${OPPORTUNITY_FIELDS} FROM Opportunity`
  if (whereClause.length > 0) {
    soql += ` WHERE ${whereClause.join(" AND ")}`
  }
  soql += ` ORDER BY CloseDate DESC`

  if (params?.limit) {
    soql += ` LIMIT ${params.limit}`
  }
  if (params?.offset) {
    soql += ` OFFSET ${params.offset}`
  }

  return withRetry(
    () => salesforceFetch<SalesforceQueryResponse<SalesforceOpportunity>>(
      credentials,
      `/query?q=${encodeSOQL(soql)}`
    ),
    { maxRetries: 3 }
  )
}

/**
 * Fetch closed/won opportunities (actual donations)
 */
export async function fetchSalesforceContactDonations(
  credentials: SalesforceCredentials,
  contactId: string,
  limit: number = 100
): Promise<SalesforceQueryResponse<SalesforceOpportunity>> {
  return fetchSalesforceOpportunities(credentials, {
    contactId,
    stageName: "Closed Won",
    limit,
  })
}

/**
 * Fetch all opportunities in batches (generator)
 */
export async function* fetchAllSalesforceOpportunities(
  credentials: SalesforceCredentials,
  batchSize: number = 200
): AsyncGenerator<SalesforceOpportunity[], void, unknown> {
  let iterationCount = 0
  let consecutiveEmptyBatches = 0
  let totalFetched = 0
  let nextRecordsUrl: string | undefined

  // Only fetch Closed Won opportunities (actual donations)
  let soql = `SELECT ${OPPORTUNITY_FIELDS} FROM Opportunity WHERE StageName = 'Closed Won' ORDER BY CloseDate DESC LIMIT ${batchSize}`

  while (true) {
    // Pagination safety check
    const paginationCheck = shouldContinuePagination(
      totalFetched,
      iterationCount,
      consecutiveEmptyBatches,
      PAGINATION_LIMITS
    )
    if (!paginationCheck.continue) {
      console.warn(`[Salesforce] Opportunity pagination stopped: ${paginationCheck.reason}`)
      break
    }

    iterationCount++

    try {
      let response: SalesforceQueryResponse<SalesforceOpportunity>

      if (nextRecordsUrl) {
        response = await withRetry(
          () => salesforceFetch<SalesforceQueryResponse<SalesforceOpportunity>>(
            credentials,
            nextRecordsUrl!.replace(`/services/data/${SALESFORCE_API_VERSION}`, "")
          ),
          { maxRetries: 3 }
        )
      } else {
        response = await withRetry(
          () => salesforceFetch<SalesforceQueryResponse<SalesforceOpportunity>>(
            credentials,
            `/query?q=${encodeSOQL(soql)}`
          ),
          { maxRetries: 3 }
        )
      }

      if (response.records.length > 0) {
        consecutiveEmptyBatches = 0
        yield response.records
        totalFetched += response.records.length
      } else {
        consecutiveEmptyBatches++
      }

      if (response.done || !response.nextRecordsUrl) {
        break
      }

      nextRecordsUrl = response.nextRecordsUrl
      await sleep(RATE_LIMIT_DELAY)
    } catch (error) {
      console.error(`[Salesforce] Error fetching opportunities:`, error)
      throw error
    }
  }
}

// ============================================================================
// CREDENTIAL PARSING
// ============================================================================

/**
 * Parse Salesforce credentials from stored format
 * Format: Base64-encoded JSON { instanceUrl, accessToken, refreshToken? }
 */
export function parseSalesforceCredentials(
  combinedKey: string
): SalesforceCredentials | null {
  const trimmed = combinedKey.trim()
  if (!trimmed) return null

  try {
    // Try base64 JSON format
    const decoded = Buffer.from(trimmed, "base64").toString("utf-8")
    const parsed = JSON.parse(decoded)

    if (parsed.instanceUrl && parsed.accessToken) {
      return {
        instanceUrl: String(parsed.instanceUrl).trim(),
        accessToken: String(parsed.accessToken).trim(),
        refreshToken: parsed.refreshToken ? String(parsed.refreshToken).trim() : undefined,
        tokenExpiry: parsed.tokenExpiry ? Number(parsed.tokenExpiry) : undefined,
        clientId: parsed.clientId ? String(parsed.clientId).trim() : undefined,
        clientSecret: parsed.clientSecret ? String(parsed.clientSecret).trim() : undefined,
      }
    }
  } catch {
    // Not a valid format
  }

  return null
}

/**
 * Combine Salesforce credentials for storage
 */
export function combineSalesforceCredentials(
  credentials: SalesforceCredentials
): string {
  const json = JSON.stringify({
    instanceUrl: credentials.instanceUrl,
    accessToken: credentials.accessToken,
    refreshToken: credentials.refreshToken,
    tokenExpiry: credentials.tokenExpiry,
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
  })
  return Buffer.from(json, "utf-8").toString("base64")
}
