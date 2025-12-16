/**
 * Virtuous CRM API Client
 * API Reference: https://docs.virtuoussoftware.com/
 */

import { CRM_API_CONFIG } from "../config"
import type {
  VirtuousContact,
  VirtuousGift,
  VirtuousListResponse,
  VirtuousOrganization,
  VirtuousContactQueryParams,
  VirtuousGiftQueryParams,
  VirtuousQueryRequest,
} from "./types"

const VIRTUOUS_BASE_URL = "https://api.virtuoussoftware.com/api"

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function virtuousFetch<T>(
  endpoint: string,
  apiKey: string,
  options?: RequestInit
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CRM_API_CONFIG.timeout)

  try {
    const response = await fetch(`${VIRTUOUS_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options?.headers,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Virtuous API error: ${response.status}`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.message || errorJson.Message || errorMessage
      } catch {
        // Use status-based error message
      }

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After")
        errorMessage = `Rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter} seconds.` : ""}`
      }

      throw new Error(errorMessage)
    }

    return response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Virtuous API request timed out")
    }
    throw error
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate a Virtuous API key by making a test request
 * @param apiKey The API key to validate
 * @returns Validation result with organization info if valid
 */
export async function validateVirtuousKey(apiKey: string): Promise<{
  valid: boolean
  organizationName?: string
  error?: string
}> {
  try {
    // Use Organization endpoint to validate key and get org info
    const org = await virtuousFetch<VirtuousOrganization>("/Organization", apiKey)

    return {
      valid: true,
      organizationName: org.name || "Virtuous Organization",
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid API key",
    }
  }
}

// ============================================================================
// CONTACTS
// ============================================================================

/**
 * Fetch contacts from Virtuous using the Query API
 * @param apiKey API key
 * @param params Query parameters
 */
export async function fetchVirtuousContacts(
  apiKey: string,
  params?: VirtuousContactQueryParams
): Promise<VirtuousListResponse<VirtuousContact>> {
  const queryBody: VirtuousQueryRequest = {
    skip: params?.skip || 0,
    take: params?.take || 100,
    sortBy: params?.sortBy || "Id",
    descending: params?.descending ?? false,
  }

  // Add filter for modified date if provided
  if (params?.modifiedSince) {
    queryBody.groups = [
      {
        conditions: [
          {
            parameter: "Last Modified Date",
            operator: "GreaterThan",
            value: params.modifiedSince,
          },
        ],
      },
    ]
  }

  return virtuousFetch<VirtuousListResponse<VirtuousContact>>("/Contact/Query", apiKey, {
    method: "POST",
    body: JSON.stringify(queryBody),
  })
}

/**
 * Search contacts by query string
 * @param apiKey API key
 * @param query Search query
 * @param limit Max results
 */
export async function searchVirtuousContacts(
  apiKey: string,
  query: string,
  limit: number = 25
): Promise<VirtuousListResponse<VirtuousContact>> {
  const searchParams = new URLSearchParams({
    searchText: query,
    take: limit.toString(),
  })

  return virtuousFetch<VirtuousListResponse<VirtuousContact>>(
    `/Contact/Search?${searchParams.toString()}`,
    apiKey
  )
}

/**
 * Get a single contact by ID
 * @param apiKey API key
 * @param contactId Contact ID
 */
export async function getVirtuousContact(
  apiKey: string,
  contactId: number
): Promise<VirtuousContact> {
  return virtuousFetch<VirtuousContact>(`/Contact/${contactId}`, apiKey)
}

// ============================================================================
// GIFTS (DONATIONS)
// ============================================================================

/**
 * Fetch gifts from Virtuous using the Query API
 * @param apiKey API key
 * @param params Query parameters
 */
export async function fetchVirtuousGifts(
  apiKey: string,
  params?: VirtuousGiftQueryParams
): Promise<VirtuousListResponse<VirtuousGift>> {
  const queryBody: VirtuousQueryRequest = {
    skip: params?.skip || 0,
    take: params?.take || 100,
    sortBy: params?.sortBy || "GiftDate",
    descending: params?.descending ?? true,
  }

  const conditions: { parameter: string; operator: string; value: string | number }[] = []

  if (params?.modifiedSince) {
    conditions.push({
      parameter: "Last Modified Date",
      operator: "GreaterThan",
      value: params.modifiedSince,
    })
  }

  if (params?.contactId) {
    conditions.push({
      parameter: "Contact Id",
      operator: "Is",
      value: params.contactId,
    })
  }

  if (params?.giftDateStart) {
    conditions.push({
      parameter: "Gift Date",
      operator: "GreaterThan",
      value: params.giftDateStart,
    })
  }

  if (params?.giftDateEnd) {
    conditions.push({
      parameter: "Gift Date",
      operator: "LessThan",
      value: params.giftDateEnd,
    })
  }

  if (conditions.length > 0) {
    queryBody.groups = [{ conditions: conditions as VirtuousQueryRequest["groups"] extends (infer U)[] ? U extends { conditions: infer C } ? C : never : never }]
  }

  return virtuousFetch<VirtuousListResponse<VirtuousGift>>("/Gift/Query", apiKey, {
    method: "POST",
    body: JSON.stringify(queryBody),
  })
}

/**
 * Get gifts for a specific contact
 * @param apiKey API key
 * @param contactId Contact ID
 * @param limit Max results
 */
export async function fetchVirtuousContactGifts(
  apiKey: string,
  contactId: number,
  limit: number = 100
): Promise<VirtuousListResponse<VirtuousGift>> {
  return fetchVirtuousGifts(apiKey, {
    contactId,
    take: limit,
    sortBy: "GiftDate",
    descending: true,
  })
}

// ============================================================================
// FULL SYNC HELPERS
// ============================================================================

/**
 * Fetch all contacts in batches (for full sync)
 * @param apiKey API key
 * @param batchSize Records per batch
 */
export async function* fetchAllVirtuousContacts(
  apiKey: string,
  batchSize: number = 100
): AsyncGenerator<VirtuousContact[], void, unknown> {
  let skip = 0
  let hasMore = true

  while (hasMore) {
    const response = await fetchVirtuousContacts(apiKey, {
      skip,
      take: batchSize,
      sortBy: "Id",
      descending: false,
    })

    if (response.list.length > 0) {
      yield response.list
      skip += response.list.length
    }

    hasMore = response.list.length === batchSize && skip < response.total
  }
}

/**
 * Fetch all gifts in batches (for full sync)
 * @param apiKey API key
 * @param batchSize Records per batch
 */
export async function* fetchAllVirtuousGifts(
  apiKey: string,
  batchSize: number = 100
): AsyncGenerator<VirtuousGift[], void, unknown> {
  let skip = 0
  let hasMore = true

  while (hasMore) {
    const response = await fetchVirtuousGifts(apiKey, {
      skip,
      take: batchSize,
      sortBy: "GiftDate",
      descending: true,
    })

    if (response.list.length > 0) {
      yield response.list
      skip += response.list.length
    }

    hasMore = response.list.length === batchSize && skip < response.total
  }
}
