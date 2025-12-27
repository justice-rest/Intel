/**
 * Blackbaud SKY API Client (Raiser's Edge NXT)
 *
 * Rate Limit: 10 calls/second (100ms between requests)
 * Daily Quota: 50,000-100,000 calls depending on subscription
 * Auth: OAuth 2.0 Bearer token + Subscription Key
 *
 * @see https://developer.blackbaud.com/skyapi/docs/basics/
 */

import { CRM_API_CONFIG, getProviderRateLimitDelay } from "../config"
import {
  withRetry,
  shouldContinuePagination,
  PAGINATION_LIMITS,
  sleep,
} from "../utils"
import type {
  BlackbaudCredentials,
  BlackbaudListResponse,
  BlackbaudConstituent,
  BlackbaudGift,
  BlackbaudConstituentSearchParams,
  BlackbaudGiftSearchParams,
  BlackbaudGivingSummary,
} from "./types"

// ============================================================================
// CONSTANTS
// ============================================================================

const BLACKBAUD_BASE_URL = "https://api.sky.blackbaud.com"
const RATE_LIMIT_DELAY = getProviderRateLimitDelay("blackbaud")

// ============================================================================
// API CLIENT
// ============================================================================

async function blackbaudFetch<T>(
  credentials: BlackbaudCredentials,
  path: string,
  options?: RequestInit
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CRM_API_CONFIG.timeout)

  try {
    const url = `${BLACKBAUD_BASE_URL}${path}`

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Bb-Api-Subscription-Key": credentials.subscriptionKey,
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
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000
      throw new Error(`Blackbaud rate limit exceeded. Retry after ${waitTime}ms`)
    }

    // Handle auth errors
    if (response.status === 401) {
      throw new Error("Blackbaud authentication failed - token may be expired")
    }

    if (response.status === 403) {
      throw new Error("Blackbaud access denied - check subscription key permissions")
    }

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Blackbaud API error: ${response.status}`

      try {
        const error = JSON.parse(errorText)
        if (error.message) {
          errorMessage = error.message
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
      throw new Error("Blackbaud API request timed out")
    }

    throw error
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate Blackbaud credentials
 */
export async function validateBlackbaudKey(
  credentials: BlackbaudCredentials
): Promise<{
  valid: boolean
  organizationName?: string
  error?: string
}> {
  try {
    // Try to fetch constituent list with limit 1
    await blackbaudFetch<BlackbaudListResponse<BlackbaudConstituent>>(
      credentials,
      "/constituent/v1/constituents?limit=1"
    )

    return {
      valid: true,
      organizationName: "Raiser's Edge NXT Organization",
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid credentials",
    }
  }
}

// ============================================================================
// CONSTITUENTS
// ============================================================================

/**
 * Fetch constituents with pagination
 */
export async function fetchBlackbaudConstituents(
  credentials: BlackbaudCredentials,
  params?: BlackbaudConstituentSearchParams
): Promise<BlackbaudListResponse<BlackbaudConstituent>> {
  const searchParams = new URLSearchParams()

  if (params?.search_text) searchParams.set("search_text", params.search_text)
  if (params?.sort) searchParams.set("sort", params.sort)
  if (params?.list_id) searchParams.set("list_id", params.list_id)
  if (params?.include_inactive) searchParams.set("include_inactive", "true")
  if (params?.offset !== undefined) searchParams.set("offset", String(params.offset))
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit))
  if (params?.date_modified) searchParams.set("date_modified", `gte ${params.date_modified}`)

  const queryString = searchParams.toString()
  const endpoint = `/constituent/v1/constituents${queryString ? `?${queryString}` : ""}`

  return withRetry(
    () => blackbaudFetch<BlackbaudListResponse<BlackbaudConstituent>>(credentials, endpoint),
    { maxRetries: 3 }
  )
}

/**
 * Search constituents by text
 */
export async function searchBlackbaudConstituents(
  credentials: BlackbaudCredentials,
  query: string,
  limit: number = 25
): Promise<BlackbaudListResponse<BlackbaudConstituent>> {
  return fetchBlackbaudConstituents(credentials, {
    search_text: query,
    limit,
  })
}

/**
 * Get single constituent by ID
 */
export async function getBlackbaudConstituent(
  credentials: BlackbaudCredentials,
  constituentId: string
): Promise<BlackbaudConstituent> {
  return withRetry(
    () => blackbaudFetch<BlackbaudConstituent>(
      credentials,
      `/constituent/v1/constituents/${constituentId}`
    ),
    { maxRetries: 3 }
  )
}

/**
 * Get constituent's giving summary
 */
export async function getBlackbaudGivingSummary(
  credentials: BlackbaudCredentials,
  constituentId: string
): Promise<BlackbaudGivingSummary> {
  return withRetry(
    () => blackbaudFetch<BlackbaudGivingSummary>(
      credentials,
      `/gift/v1/constituents/${constituentId}/givingsummary`
    ),
    { maxRetries: 3 }
  )
}

/**
 * Fetch all constituents (generator)
 */
export async function* fetchAllBlackbaudConstituents(
  credentials: BlackbaudCredentials,
  batchSize: number = 500
): AsyncGenerator<BlackbaudConstituent[], void, unknown> {
  let offset = 0
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
      console.warn(`[Blackbaud] Constituent pagination stopped: ${paginationCheck.reason}`)
      break
    }

    iterationCount++

    try {
      const response = await fetchBlackbaudConstituents(credentials, {
        offset,
        limit: batchSize,
        sort: "date_modified desc",
      })

      if (response.value.length > 0) {
        consecutiveEmptyBatches = 0
        yield response.value
        offset += response.value.length
        totalFetched += response.value.length
      } else {
        consecutiveEmptyBatches++
      }

      // Check if more records
      if (response.value.length < batchSize || !response.next_link) {
        break
      }

      // Rate limiting
      await sleep(RATE_LIMIT_DELAY)
    } catch (error) {
      console.error(`[Blackbaud] Error fetching constituents at offset=${offset}:`, error)
      throw error
    }
  }
}

// ============================================================================
// GIFTS (DONATIONS)
// ============================================================================

/**
 * Fetch gifts with pagination
 */
export async function fetchBlackbaudGifts(
  credentials: BlackbaudCredentials,
  params?: BlackbaudGiftSearchParams
): Promise<BlackbaudListResponse<BlackbaudGift>> {
  const searchParams = new URLSearchParams()

  if (params?.constituent_id) searchParams.set("constituent_id", params.constituent_id)
  if (params?.gift_type) searchParams.set("gift_type", params.gift_type)
  if (params?.post_status) searchParams.set("post_status", params.post_status)
  if (params?.sort) searchParams.set("sort", params.sort)
  if (params?.offset !== undefined) searchParams.set("offset", String(params.offset))
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit))
  if (params?.date_modified) searchParams.set("date_modified", `gte ${params.date_modified}`)

  const queryString = searchParams.toString()
  const endpoint = `/gift/v1/gifts${queryString ? `?${queryString}` : ""}`

  return withRetry(
    () => blackbaudFetch<BlackbaudListResponse<BlackbaudGift>>(credentials, endpoint),
    { maxRetries: 3 }
  )
}

/**
 * Get constituent's gifts
 */
export async function fetchBlackbaudConstituentGifts(
  credentials: BlackbaudCredentials,
  constituentId: string,
  limit: number = 100
): Promise<BlackbaudListResponse<BlackbaudGift>> {
  return fetchBlackbaudGifts(credentials, {
    constituent_id: constituentId,
    limit,
    sort: "date desc",
  })
}

/**
 * Get single gift by ID
 */
export async function getBlackbaudGift(
  credentials: BlackbaudCredentials,
  giftId: string
): Promise<BlackbaudGift> {
  return withRetry(
    () => blackbaudFetch<BlackbaudGift>(
      credentials,
      `/gift/v1/gifts/${giftId}`
    ),
    { maxRetries: 3 }
  )
}

/**
 * Fetch all gifts (generator)
 */
export async function* fetchAllBlackbaudGifts(
  credentials: BlackbaudCredentials,
  batchSize: number = 500
): AsyncGenerator<BlackbaudGift[], void, unknown> {
  let offset = 0
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
      console.warn(`[Blackbaud] Gift pagination stopped: ${paginationCheck.reason}`)
      break
    }

    iterationCount++

    try {
      const response = await fetchBlackbaudGifts(credentials, {
        offset,
        limit: batchSize,
        post_status: "Posted", // Only synced posted gifts
        sort: "date desc",
      })

      if (response.value.length > 0) {
        consecutiveEmptyBatches = 0
        yield response.value
        offset += response.value.length
        totalFetched += response.value.length
      } else {
        consecutiveEmptyBatches++
      }

      if (response.value.length < batchSize || !response.next_link) {
        break
      }

      await sleep(RATE_LIMIT_DELAY)
    } catch (error) {
      console.error(`[Blackbaud] Error fetching gifts at offset=${offset}:`, error)
      throw error
    }
  }
}

// ============================================================================
// CREDENTIAL PARSING
// ============================================================================

/**
 * Parse Blackbaud credentials from stored format
 * Format: Base64-encoded JSON { accessToken, subscriptionKey, refreshToken? }
 */
export function parseBlackbaudCredentials(
  combinedKey: string
): BlackbaudCredentials | null {
  const trimmed = combinedKey.trim()
  if (!trimmed) return null

  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf-8")
    const parsed = JSON.parse(decoded)

    if (parsed.accessToken && parsed.subscriptionKey) {
      return {
        accessToken: String(parsed.accessToken).trim(),
        subscriptionKey: String(parsed.subscriptionKey).trim(),
        refreshToken: parsed.refreshToken ? String(parsed.refreshToken).trim() : undefined,
        tokenExpiry: parsed.tokenExpiry ? Number(parsed.tokenExpiry) : undefined,
        environmentId: parsed.environmentId ? String(parsed.environmentId).trim() : undefined,
      }
    }
  } catch {
    // Not a valid format
  }

  return null
}

/**
 * Combine Blackbaud credentials for storage
 */
export function combineBlackbaudCredentials(
  credentials: BlackbaudCredentials
): string {
  const json = JSON.stringify({
    accessToken: credentials.accessToken,
    subscriptionKey: credentials.subscriptionKey,
    refreshToken: credentials.refreshToken,
    tokenExpiry: credentials.tokenExpiry,
    environmentId: credentials.environmentId,
  })
  return Buffer.from(json, "utf-8").toString("base64")
}
