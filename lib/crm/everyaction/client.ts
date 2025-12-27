/**
 * EveryAction (NGP VAN) API Client
 *
 * Authentication: HTTP Basic Auth with applicationName:apiKey|dbMode
 * Rate Limits: Not officially published, but throttling during peak times
 *
 * @see https://docs.everyaction.com/reference/api-overview
 */

import { CRM_API_CONFIG, getProviderRateLimitDelay } from "../config"
import {
  withRetry,
  shouldContinuePagination,
  PAGINATION_LIMITS,
  sleep,
} from "../utils"
import type {
  EveryActionCredentials,
  EveryActionListResponse,
  EveryActionPerson,
  EveryActionContribution,
  EveryActionPersonSearchParams,
  EveryActionContributionSearchParams,
  EveryActionFindOrCreateResponse,
  EveryActionPersonMatch,
} from "./types"

// ============================================================================
// CONSTANTS
// ============================================================================

const EVERYACTION_BASE_URL = "https://api.securevan.com/v4"
const RATE_LIMIT_DELAY = getProviderRateLimitDelay("everyaction")

// ============================================================================
// API CLIENT
// ============================================================================

function buildAuthHeader(credentials: EveryActionCredentials): string {
  // Format: applicationName:apiKey|dbMode
  const authString = `${credentials.applicationName}:${credentials.apiKey}|${credentials.databaseMode}`
  return `Basic ${Buffer.from(authString).toString("base64")}`
}

async function everyActionFetch<T>(
  credentials: EveryActionCredentials,
  path: string,
  options?: RequestInit
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CRM_API_CONFIG.timeout)

  try {
    const url = `${EVERYACTION_BASE_URL}${path}`

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: buildAuthHeader(credentials),
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options?.headers,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Handle rate limiting
    if (response.status === 429) {
      throw new Error("EveryAction rate limit exceeded. Please wait and retry.")
    }

    // Handle auth errors
    if (response.status === 401) {
      throw new Error("EveryAction authentication failed - check API key and application name")
    }

    if (response.status === 403) {
      throw new Error("EveryAction access denied - check permissions")
    }

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `EveryAction API error: ${response.status}`

      try {
        const errorData = JSON.parse(errorText)
        if (errorData.errors && Array.isArray(errorData.errors)) {
          errorMessage = errorData.errors.map((e: { text?: string; code?: string }) =>
            e.text || e.code
          ).join(", ")
        }
      } catch {
        if (errorText) {
          errorMessage = errorText.slice(0, 200)
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
      throw new Error("EveryAction API request timed out")
    }

    throw error
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate EveryAction credentials
 */
export async function validateEveryActionKey(
  credentials: EveryActionCredentials
): Promise<{
  valid: boolean
  organizationName?: string
  error?: string
}> {
  try {
    // Try to fetch people with limit 1 to validate
    await everyActionFetch<EveryActionListResponse<EveryActionPerson>>(
      credentials,
      "/people?$top=1"
    )

    return {
      valid: true,
      organizationName: "EveryAction Organization",
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid credentials",
    }
  }
}

// ============================================================================
// PEOPLE (CONSTITUENTS)
// ============================================================================

/**
 * Fetch people with pagination
 */
export async function fetchEveryActionPeople(
  credentials: EveryActionCredentials,
  params?: EveryActionPersonSearchParams
): Promise<EveryActionListResponse<EveryActionPerson>> {
  const searchParams = new URLSearchParams()

  if (params?.firstName) searchParams.set("firstName", params.firstName)
  if (params?.lastName) searchParams.set("lastName", params.lastName)
  if (params?.email) searchParams.set("email", params.email)
  if (params?.phone) searchParams.set("phone", params.phone)
  if (params?.vanId) searchParams.set("vanId", String(params.vanId))
  if (params?.expand && params.expand.length > 0) {
    searchParams.set("$expand", params.expand.join(","))
  }
  if (params?.$top !== undefined) searchParams.set("$top", String(params.$top))
  if (params?.$skip !== undefined) searchParams.set("$skip", String(params.$skip))

  const queryString = searchParams.toString()
  const endpoint = `/people${queryString ? `?${queryString}` : ""}`

  return withRetry(
    () => everyActionFetch<EveryActionListResponse<EveryActionPerson>>(credentials, endpoint),
    { maxRetries: 3 }
  )
}

/**
 * Search people by name or email
 */
export async function searchEveryActionPeople(
  credentials: EveryActionCredentials,
  query: string,
  limit: number = 25
): Promise<EveryActionListResponse<EveryActionPerson>> {
  // Parse query to determine search type
  const isEmail = query.includes("@")
  const parts = query.split(" ").filter(Boolean)

  const params: EveryActionPersonSearchParams = {
    $top: limit,
    expand: ["emails", "phones", "addresses"],
  }

  if (isEmail) {
    params.email = query
  } else if (parts.length >= 2) {
    params.firstName = parts[0]
    params.lastName = parts.slice(1).join(" ")
  } else {
    params.lastName = query
  }

  return fetchEveryActionPeople(credentials, params)
}

/**
 * Get single person by VAN ID
 */
export async function getEveryActionPerson(
  credentials: EveryActionCredentials,
  vanId: number
): Promise<EveryActionPerson> {
  return withRetry(
    () => everyActionFetch<EveryActionPerson>(
      credentials,
      `/people/${vanId}?$expand=emails,phones,addresses`
    ),
    { maxRetries: 3 }
  )
}

/**
 * Find or create a person
 */
export async function findOrCreateEveryActionPerson(
  credentials: EveryActionCredentials,
  match: EveryActionPersonMatch
): Promise<EveryActionFindOrCreateResponse> {
  return withRetry(
    () => everyActionFetch<EveryActionFindOrCreateResponse>(
      credentials,
      "/people/findOrCreate",
      {
        method: "POST",
        body: JSON.stringify(match),
      }
    ),
    { maxRetries: 3 }
  )
}

/**
 * Fetch all people (generator)
 */
export async function* fetchAllEveryActionPeople(
  credentials: EveryActionCredentials,
  batchSize: number = 200
): AsyncGenerator<EveryActionPerson[], void, unknown> {
  let skip = 0
  let iterationCount = 0
  let consecutiveEmptyBatches = 0
  let totalFetched = 0

  while (true) {
    // Pagination safety check
    const paginationCheck = shouldContinuePagination(
      totalFetched,
      iterationCount,
      consecutiveEmptyBatches,
      PAGINATION_LIMITS
    )
    if (!paginationCheck.continue) {
      console.warn(`[EveryAction] Person pagination stopped: ${paginationCheck.reason}`)
      break
    }

    iterationCount++

    try {
      const response = await fetchEveryActionPeople(credentials, {
        $top: batchSize,
        $skip: skip,
        expand: ["emails", "phones", "addresses"],
      })

      if (response.items.length > 0) {
        consecutiveEmptyBatches = 0
        yield response.items
        skip += response.items.length
        totalFetched += response.items.length
      } else {
        consecutiveEmptyBatches++
      }

      // Check if more records
      if (response.items.length < batchSize || !response.nextPageLink) {
        break
      }

      // Rate limiting
      await sleep(RATE_LIMIT_DELAY)
    } catch (error) {
      console.error(`[EveryAction] Error fetching people at skip=${skip}:`, error)
      throw error
    }
  }
}

// ============================================================================
// CONTRIBUTIONS (DONATIONS)
// ============================================================================

/**
 * Fetch contributions with pagination
 */
export async function fetchEveryActionContributions(
  credentials: EveryActionCredentials,
  params?: EveryActionContributionSearchParams
): Promise<EveryActionListResponse<EveryActionContribution>> {
  const searchParams = new URLSearchParams()

  if (params?.vanId) searchParams.set("vanId", String(params.vanId))
  if (params?.dateReceivedSince) searchParams.set("dateReceivedSince", params.dateReceivedSince)
  if (params?.dateReceivedBefore) searchParams.set("dateReceivedBefore", params.dateReceivedBefore)
  if (params?.status) searchParams.set("status", params.status)
  if (params?.$top !== undefined) searchParams.set("$top", String(params.$top))
  if (params?.$skip !== undefined) searchParams.set("$skip", String(params.$skip))

  const queryString = searchParams.toString()
  const endpoint = `/contributions${queryString ? `?${queryString}` : ""}`

  return withRetry(
    () => everyActionFetch<EveryActionListResponse<EveryActionContribution>>(credentials, endpoint),
    { maxRetries: 3 }
  )
}

/**
 * Get person's contributions
 */
export async function fetchEveryActionPersonContributions(
  credentials: EveryActionCredentials,
  vanId: number,
  limit: number = 100
): Promise<EveryActionListResponse<EveryActionContribution>> {
  return fetchEveryActionContributions(credentials, {
    vanId,
    $top: limit,
  })
}

/**
 * Get single contribution
 */
export async function getEveryActionContribution(
  credentials: EveryActionCredentials,
  contributionId: number
): Promise<EveryActionContribution> {
  return withRetry(
    () => everyActionFetch<EveryActionContribution>(
      credentials,
      `/contributions/${contributionId}`
    ),
    { maxRetries: 3 }
  )
}

/**
 * Fetch all contributions (generator)
 */
export async function* fetchAllEveryActionContributions(
  credentials: EveryActionCredentials,
  batchSize: number = 200
): AsyncGenerator<EveryActionContribution[], void, unknown> {
  let skip = 0
  let iterationCount = 0
  let consecutiveEmptyBatches = 0
  let totalFetched = 0

  while (true) {
    // Pagination safety check
    const paginationCheck = shouldContinuePagination(
      totalFetched,
      iterationCount,
      consecutiveEmptyBatches,
      PAGINATION_LIMITS
    )
    if (!paginationCheck.continue) {
      console.warn(`[EveryAction] Contribution pagination stopped: ${paginationCheck.reason}`)
      break
    }

    iterationCount++

    try {
      const response = await fetchEveryActionContributions(credentials, {
        $top: batchSize,
        $skip: skip,
      })

      if (response.items.length > 0) {
        consecutiveEmptyBatches = 0
        yield response.items
        skip += response.items.length
        totalFetched += response.items.length
      } else {
        consecutiveEmptyBatches++
      }

      if (response.items.length < batchSize || !response.nextPageLink) {
        break
      }

      await sleep(RATE_LIMIT_DELAY)
    } catch (error) {
      console.error(`[EveryAction] Error fetching contributions at skip=${skip}:`, error)
      throw error
    }
  }
}

// ============================================================================
// CREDENTIAL PARSING
// ============================================================================

/**
 * Parse EveryAction credentials from stored format
 * Format: Base64-encoded JSON { applicationName, apiKey, databaseMode }
 */
export function parseEveryActionCredentials(
  combinedKey: string
): EveryActionCredentials | null {
  const trimmed = combinedKey.trim()
  if (!trimmed) return null

  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf-8")
    const parsed = JSON.parse(decoded)

    if (parsed.applicationName && parsed.apiKey) {
      return {
        applicationName: String(parsed.applicationName).trim(),
        apiKey: String(parsed.apiKey).trim(),
        databaseMode: parsed.databaseMode === 0 ? 0 : 1, // Default to 1 (MyCampaign)
      }
    }
  } catch {
    // Not a valid format
  }

  return null
}

/**
 * Combine EveryAction credentials for storage
 */
export function combineEveryActionCredentials(
  credentials: EveryActionCredentials
): string {
  const json = JSON.stringify({
    applicationName: credentials.applicationName,
    apiKey: credentials.apiKey,
    databaseMode: credentials.databaseMode,
  })
  return Buffer.from(json, "utf-8").toString("base64")
}
