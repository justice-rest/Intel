/**
 * Bloomerang API Client
 * REST API v2: https://api.bloomerang.co/v2
 */

import { CRM_API_CONFIG } from "../config"
import {
  withRetry,
  shouldContinuePagination,
  PAGINATION_LIMITS,
  sleep,
} from "../utils"
import type {
  BloomerangConstituent,
  BloomerangTransaction,
  BloomerangListResponse,
  BloomerangConstituentSearchParams,
  BloomerangTransactionSearchParams,
} from "./types"

const BLOOMERANG_BASE_URL = "https://api.bloomerang.co/v2"

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function bloomerangFetch<T>(
  endpoint: string,
  apiKey: string,
  options?: RequestInit
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CRM_API_CONFIG.timeout)

  try {
    const response = await fetch(`${BLOOMERANG_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options?.headers,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Bloomerang API error: ${response.status}`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.Message || errorMessage
      } catch {
        // Use status-based error message
      }
      throw new Error(errorMessage)
    }

    return response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Bloomerang API request timed out")
    }
    throw error
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate a Bloomerang API key by making a test request
 * @param apiKey The API key to validate
 * @returns Validation result with organization info if valid
 */
export async function validateBloomerangKey(apiKey: string): Promise<{
  valid: boolean
  organizationName?: string
  error?: string
}> {
  try {
    // Use constituents endpoint with limit 1 to validate key
    await bloomerangFetch<BloomerangListResponse<BloomerangConstituent>>(
      "/constituents?take=1",
      apiKey
    )

    // If we get a response, the key is valid
    return {
      valid: true,
      organizationName: "Bloomerang Organization", // Bloomerang doesn't expose org name easily
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid API key",
    }
  }
}

// ============================================================================
// CONSTITUENTS
// ============================================================================

/**
 * Fetch constituents from Bloomerang
 * @param apiKey API key
 * @param params Search/pagination parameters
 */
export async function fetchBloomerangConstituents(
  apiKey: string,
  params?: BloomerangConstituentSearchParams
): Promise<BloomerangListResponse<BloomerangConstituent>> {
  const searchParams = new URLSearchParams()

  if (params?.skip !== undefined) searchParams.set("skip", params.skip.toString())
  if (params?.take !== undefined) searchParams.set("take", params.take.toString())
  if (params?.orderBy) searchParams.set("orderBy", params.orderBy)
  if (params?.orderDirection) searchParams.set("orderDirection", params.orderDirection)
  if (params?.lastModifiedDate) searchParams.set("lastModifiedDate", params.lastModifiedDate)
  if (params?.type) searchParams.set("type", params.type)
  if (params?.status) searchParams.set("status", params.status)

  const queryString = searchParams.toString()
  const endpoint = `/constituents${queryString ? `?${queryString}` : ""}`

  return withRetry(
    () => bloomerangFetch<BloomerangListResponse<BloomerangConstituent>>(endpoint, apiKey),
    { maxRetries: 3 }
  )
}

/**
 * Search constituents by query string
 * @param apiKey API key
 * @param query Search query
 * @param limit Max results
 */
export async function searchBloomerangConstituents(
  apiKey: string,
  query: string,
  limit: number = 25
): Promise<BloomerangListResponse<BloomerangConstituent>> {
  const searchParams = new URLSearchParams({
    search: query,
    take: limit.toString(),
  })

  return withRetry(
    () => bloomerangFetch<BloomerangListResponse<BloomerangConstituent>>(
      `/constituents?${searchParams.toString()}`,
      apiKey
    ),
    { maxRetries: 3 }
  )
}

/**
 * Get a single constituent by ID
 * @param apiKey API key
 * @param constituentId Constituent ID
 */
export async function getBloomerangConstituent(
  apiKey: string,
  constituentId: number
): Promise<BloomerangConstituent> {
  return withRetry(
    () => bloomerangFetch<BloomerangConstituent>(`/constituents/${constituentId}`, apiKey),
    { maxRetries: 3 }
  )
}

// ============================================================================
// TRANSACTIONS (DONATIONS)
// ============================================================================

/**
 * Fetch transactions from Bloomerang
 * @param apiKey API key
 * @param params Search/pagination parameters
 */
export async function fetchBloomerangTransactions(
  apiKey: string,
  params?: BloomerangTransactionSearchParams
): Promise<BloomerangListResponse<BloomerangTransaction>> {
  const searchParams = new URLSearchParams()

  if (params?.skip !== undefined) searchParams.set("skip", params.skip.toString())
  if (params?.take !== undefined) searchParams.set("take", params.take.toString())
  if (params?.orderBy) searchParams.set("orderBy", params.orderBy)
  if (params?.orderDirection) searchParams.set("orderDirection", params.orderDirection)
  if (params?.lastModifiedDate) searchParams.set("lastModifiedDate", params.lastModifiedDate)
  if (params?.accountId) searchParams.set("accountId", params.accountId.toString())
  if (params?.transactionType) searchParams.set("transactionType", params.transactionType)
  if (params?.startDate) searchParams.set("startDate", params.startDate)
  if (params?.endDate) searchParams.set("endDate", params.endDate)

  const queryString = searchParams.toString()
  const endpoint = `/transactions${queryString ? `?${queryString}` : ""}`

  return withRetry(
    () => bloomerangFetch<BloomerangListResponse<BloomerangTransaction>>(endpoint, apiKey),
    { maxRetries: 3 }
  )
}

/**
 * Get transactions for a specific constituent
 * @param apiKey API key
 * @param accountId Account/Constituent ID
 * @param limit Max results
 */
export async function fetchBloomerangConstituentTransactions(
  apiKey: string,
  accountId: number,
  limit: number = 100
): Promise<BloomerangListResponse<BloomerangTransaction>> {
  return fetchBloomerangTransactions(apiKey, {
    accountId,
    take: limit,
    orderBy: "Date",
    orderDirection: "Desc",
  })
}

// ============================================================================
// FULL SYNC HELPERS
// ============================================================================

/**
 * Fetch all constituents in batches (for full sync)
 * @param apiKey API key
 * @param onBatch Callback for each batch
 * @param batchSize Records per batch
 */
export async function* fetchAllBloomerangConstituents(
  apiKey: string,
  batchSize: number = 100
): AsyncGenerator<BloomerangConstituent[], void, unknown> {
  let skip = 0
  let hasMore = true
  let iterationCount = 0
  let consecutiveEmptyBatches = 0
  let totalFetched = 0

  while (hasMore) {
    // Pagination safety check
    const paginationCheck = shouldContinuePagination(
      totalFetched,
      iterationCount,
      consecutiveEmptyBatches,
      PAGINATION_LIMITS
    )
    if (!paginationCheck.continue) {
      console.warn(`[Bloomerang] Constituent pagination stopped: ${paginationCheck.reason}`)
      break
    }

    iterationCount++

    try {
      const response = await fetchBloomerangConstituents(apiKey, {
        skip,
        take: batchSize,
        orderBy: "Id",
        orderDirection: "Asc",
        status: "Active", // Only sync active constituents
      })

      if (response.Results.length > 0) {
        consecutiveEmptyBatches = 0
        yield response.Results
        skip += response.Results.length
        totalFetched += response.Results.length
      } else {
        consecutiveEmptyBatches++
      }

      hasMore = response.Results.length === batchSize && skip < response.Total

      // Rate limiting delay between batches
      if (hasMore) {
        await sleep(CRM_API_CONFIG.rateLimitDelay)
      }
    } catch (error) {
      console.error(`[Bloomerang] Error fetching constituents at skip=${skip}:`, error)
      throw error
    }
  }
}

/**
 * Fetch all transactions in batches (for full sync)
 * @param apiKey API key
 * @param batchSize Records per batch
 */
export async function* fetchAllBloomerangTransactions(
  apiKey: string,
  batchSize: number = 100
): AsyncGenerator<BloomerangTransaction[], void, unknown> {
  let skip = 0
  let hasMore = true
  let iterationCount = 0
  let consecutiveEmptyBatches = 0
  let totalFetched = 0

  while (hasMore) {
    // Pagination safety check
    const paginationCheck = shouldContinuePagination(
      totalFetched,
      iterationCount,
      consecutiveEmptyBatches,
      PAGINATION_LIMITS
    )
    if (!paginationCheck.continue) {
      console.warn(`[Bloomerang] Transaction pagination stopped: ${paginationCheck.reason}`)
      break
    }

    iterationCount++

    try {
      const response = await fetchBloomerangTransactions(apiKey, {
        skip,
        take: batchSize,
        orderBy: "Date",
        orderDirection: "Desc",
      })

      if (response.Results.length > 0) {
        consecutiveEmptyBatches = 0
        yield response.Results
        skip += response.Results.length
        totalFetched += response.Results.length
      } else {
        consecutiveEmptyBatches++
      }

      hasMore = response.Results.length === batchSize && skip < response.Total

      // Rate limiting delay between batches
      if (hasMore) {
        await sleep(CRM_API_CONFIG.rateLimitDelay)
      }
    } catch (error) {
      console.error(`[Bloomerang] Error fetching transactions at skip=${skip}:`, error)
      throw error
    }
  }
}
