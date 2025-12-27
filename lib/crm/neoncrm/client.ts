/**
 * Neon CRM API Client
 * REST API v2: https://developer.neoncrm.com/api-v2/
 */

import { CRM_API_CONFIG } from "../config"
import {
  withRetry,
  shouldContinuePagination,
  PAGINATION_LIMITS,
  sleep,
} from "../utils"
import type {
  NeonCRMAccount,
  NeonCRMAccountsResponse,
  NeonCRMDonation,
  NeonCRMDonationsResponse,
  NeonCRMCredentials,
} from "./types"

const NEON_CRM_BASE_URL = "https://api.neoncrm.com/v2"
const NEON_CRM_API_VERSION = "2.10"

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse Neon CRM credentials from combined format
 * Format: "orgId|||apiKey" (using ||| as separator to avoid conflicts with special characters)
 *
 * Also supports legacy format "orgId:apiKey" for backward compatibility,
 * but only if the API key doesn't contain colons.
 *
 * NEW FORMAT: URL-encoded JSON for maximum safety
 * Format: base64(JSON.stringify({ orgId, apiKey }))
 */
export function parseNeonCRMCredentials(combinedKey: string): NeonCRMCredentials | null {
  // Input validation
  if (!combinedKey || typeof combinedKey !== "string") {
    console.error("[Neon CRM] Invalid credentials: input is null/undefined/non-string")
    return null
  }

  const trimmed = combinedKey.trim()
  if (!trimmed) {
    console.error("[Neon CRM] Invalid credentials: empty string")
    return null
  }

  // Try new base64 JSON format first (preferred)
  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf-8")
    const parsed = JSON.parse(decoded)
    if (parsed.orgId && parsed.apiKey) {
      // Validate parsed values
      const orgId = String(parsed.orgId).trim()
      const apiKey = String(parsed.apiKey).trim()

      if (!orgId) {
        console.error("[Neon CRM] Invalid credentials: empty Organization ID in JSON")
        return null
      }
      if (!apiKey || apiKey.length < 10) {
        console.error("[Neon CRM] Invalid credentials: API key too short in JSON")
        return null
      }

      return { orgId, apiKey }
    }
  } catch {
    // Not base64 JSON format, try other formats
  }

  // Try new separator format (|||)
  if (trimmed.includes("|||")) {
    const parts = trimmed.split("|||")
    if (parts.length >= 2) {
      const orgId = parts[0].trim()
      const apiKey = parts.slice(1).join("|||").trim() // Handle case where apiKey contains |||

      if (!orgId) {
        console.error("[Neon CRM] Invalid credentials: empty Organization ID")
        return null
      }
      if (!apiKey || apiKey.length < 10) {
        console.error("[Neon CRM] Invalid credentials: API key appears too short")
        return null
      }

      return { orgId, apiKey }
    }
  }

  // Legacy format: "orgId:apiKey" (first colon as separator)
  // Only use if no ||| separator found
  const colonIndex = trimmed.indexOf(":")
  if (colonIndex === -1) {
    console.error("[Neon CRM] Invalid credentials format: missing separator (expected ||| or :)")
    return null
  }

  // Extract and validate parts
  const orgId = trimmed.substring(0, colonIndex).trim()
  const apiKey = trimmed.substring(colonIndex + 1).trim()

  if (!orgId) {
    console.error("[Neon CRM] Invalid credentials: empty Organization ID")
    return null
  }

  if (!apiKey) {
    console.error("[Neon CRM] Invalid credentials: empty API key")
    return null
  }

  // Basic length validation (org IDs are typically short, API keys are longer)
  if (orgId.length > 50) {
    console.error("[Neon CRM] Invalid credentials: Organization ID appears too long")
    return null
  }

  if (apiKey.length < 10) {
    console.error("[Neon CRM] Invalid credentials: API key appears too short")
    return null
  }

  return { orgId, apiKey }
}

/**
 * Combine Neon CRM credentials into storage format
 * Uses base64-encoded JSON for maximum safety with special characters
 */
export function combineNeonCRMCredentials(orgId: string, apiKey: string): string {
  const json = JSON.stringify({ orgId, apiKey })
  return Buffer.from(json, "utf-8").toString("base64")
}

/**
 * Build Basic Auth header from Neon CRM credentials
 */
function buildNeonCRMAuthHeader(credentials: NeonCRMCredentials): string {
  const encoded = Buffer.from(`${credentials.orgId}:${credentials.apiKey}`).toString("base64")
  return `Basic ${encoded}`
}

async function neonCRMFetch<T>(
  endpoint: string,
  credentials: NeonCRMCredentials,
  options?: RequestInit
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CRM_API_CONFIG.timeout)

  try {
    const response = await fetch(`${NEON_CRM_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: buildNeonCRMAuthHeader(credentials),
        "Content-Type": "application/json",
        Accept: "application/json",
        "NEON-API-VERSION": NEON_CRM_API_VERSION,
        ...options?.headers,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Neon CRM API error: ${response.status}`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.message || errorJson.error || errorMessage
      } catch {
        // Use status-based error message
      }
      throw new Error(errorMessage)
    }

    return response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Neon CRM API request timed out")
    }
    throw error
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate Neon CRM credentials by making a test request
 * Also verifies access to both accounts and donations
 * @param orgId Organization ID
 * @param apiKey API Key
 * @returns Validation result with organization info if valid
 */
export async function validateNeonCRMKey(
  orgId: string,
  apiKey: string
): Promise<{
  valid: boolean
  organizationName?: string
  error?: string
}> {
  try {
    const credentials: NeonCRMCredentials = { orgId, apiKey }
    const organizationName = `Neon CRM (Org: ${orgId})`

    // Step 1: Validate credentials and account access
    try {
      await neonCRMFetch<NeonCRMAccountsResponse>(
        "/accounts?pageSize=1",
        credentials
      )
    } catch (accountError) {
      const errorMsg = accountError instanceof Error ? accountError.message : "Unknown error"
      // Check for permission-related errors
      if (errorMsg.includes("401") || errorMsg.includes("403") ||
          errorMsg.toLowerCase().includes("permission") ||
          errorMsg.toLowerCase().includes("unauthorized") ||
          errorMsg.toLowerCase().includes("forbidden")) {
        return {
          valid: false,
          error: `Invalid credentials or insufficient permissions to access accounts. Please verify your Organization ID and API Key, and ensure the API user has account read access.`,
        }
      }
      throw accountError
    }

    // Step 2: Verify donation access by attempting to search donations
    try {
      await neonCRMFetch<{ searchResults?: unknown[] }>(
        "/donations/search",
        credentials,
        {
          method: "POST",
          body: JSON.stringify({
            searchFields: [],
            outputFields: ["Donation ID"],
            pagination: { currentPage: 0, pageSize: 1 },
          }),
        }
      )
    } catch (donationError) {
      const errorMsg = donationError instanceof Error ? donationError.message : "Unknown error"
      // Check for permission-related errors
      if (errorMsg.includes("401") || errorMsg.includes("403") ||
          errorMsg.toLowerCase().includes("permission") ||
          errorMsg.toLowerCase().includes("unauthorized") ||
          errorMsg.toLowerCase().includes("forbidden") ||
          errorMsg.toLowerCase().includes("access")) {
        return {
          valid: false,
          organizationName,
          error: `API credentials are valid but the API user lacks donation read permission. Please ensure the Neon CRM user has access to view donations.`,
        }
      }
      // Re-throw unexpected errors
      throw donationError
    }

    // If we get here, credentials are valid and have full access
    return {
      valid: true,
      organizationName,
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid credentials",
    }
  }
}

// ============================================================================
// ACCOUNTS (CONSTITUENTS)
// ============================================================================

/**
 * Fetch accounts from Neon CRM
 */
export async function fetchNeonCRMAccounts(
  credentials: NeonCRMCredentials,
  params?: {
    pageSize?: number
    currentPage?: number
    firstName?: string
    lastName?: string
    email?: string
  }
): Promise<{ accounts: NeonCRMAccount[]; pagination?: { totalResults: number; totalPages: number } }> {
  const searchParams = new URLSearchParams()

  if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize))
  if (params?.currentPage !== undefined) searchParams.set("currentPage", String(params.currentPage))
  if (params?.firstName) searchParams.set("firstName", params.firstName)
  if (params?.lastName) searchParams.set("lastName", params.lastName)
  if (params?.email) searchParams.set("email", params.email)

  const endpoint = `/accounts${searchParams.toString() ? `?${searchParams.toString()}` : ""}`

  const response = await withRetry(
    () => neonCRMFetch<NeonCRMAccountsResponse>(endpoint, credentials),
    { maxRetries: 3 }
  )

  return {
    accounts: response.accounts || [],
    pagination: response.pagination
      ? {
          totalResults: response.pagination.totalResults,
          totalPages: response.pagination.totalPages,
        }
      : undefined,
  }
}

/**
 * Get a specific account by ID
 */
export async function getNeonCRMAccount(
  credentials: NeonCRMCredentials,
  accountId: string
): Promise<NeonCRMAccount | null> {
  try {
    const response = await neonCRMFetch<NeonCRMAccount>(
      `/accounts/${accountId}`,
      credentials
    )
    return response
  } catch (error) {
    console.error("[Neon CRM] Get account failed:", error)
    return null
  }
}

/**
 * Search accounts using advanced search
 */
export async function searchNeonCRMAccounts(
  credentials: NeonCRMCredentials,
  searchFields: Array<{ field: string; operator: string; value?: string | number }>
): Promise<NeonCRMAccount[]> {
  const body = {
    searchFields,
    outputFields: [
      "Account ID",
      "First Name",
      "Last Name",
      "Email 1",
      "Total Amount of Donations",
    ],
    pagination: {
      currentPage: 0,
      pageSize: 100,
    },
  }

  const response = await withRetry(
    () => neonCRMFetch<{ searchResults?: Array<Record<string, string | number>> }>(
      "/accounts/search",
      credentials,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    ),
    { maxRetries: 3 }
  )

  // Map search results to account format
  return (response.searchResults || []).map((result) => ({
    accountId: String(result["Account ID"] || ""),
    individualAccount: {
      accountId: String(result["Account ID"] || ""),
      primaryContact: {
        firstName: String(result["First Name"] || ""),
        lastName: String(result["Last Name"] || ""),
        email1: String(result["Email 1"] || ""),
      },
    },
    donationsSummary: {
      total: Number(result["Total Amount of Donations"]) || 0,
    },
  }))
}

/**
 * Fetch all accounts with pagination
 */
export async function fetchAllNeonCRMAccounts(
  credentials: NeonCRMCredentials,
  onProgress?: (fetched: number, total: number) => void
): Promise<NeonCRMAccount[]> {
  const allAccounts: NeonCRMAccount[] = []
  let currentPage = 0
  let totalPages = 1
  const pageSize = CRM_API_CONFIG.defaultPageSize
  let iterationCount = 0
  let consecutiveEmptyBatches = 0

  while (currentPage < totalPages) {
    // Pagination safety check
    const paginationCheck = shouldContinuePagination(
      allAccounts.length,
      iterationCount,
      consecutiveEmptyBatches,
      PAGINATION_LIMITS
    )
    if (!paginationCheck.continue) {
      console.warn(`[Neon CRM] Account pagination stopped: ${paginationCheck.reason}`)
      break
    }

    iterationCount++

    try {
      const result = await fetchNeonCRMAccounts(credentials, {
        pageSize,
        currentPage,
      })

      if (result.accounts.length > 0) {
        consecutiveEmptyBatches = 0
        allAccounts.push(...result.accounts)
      } else {
        consecutiveEmptyBatches++
      }

      if (result.pagination) {
        totalPages = result.pagination.totalPages
      } else {
        break
      }

      if (onProgress) {
        onProgress(allAccounts.length, result.pagination?.totalResults || allAccounts.length)
      }

      currentPage++

      // Rate limiting delay
      if (currentPage < totalPages) {
        await sleep(CRM_API_CONFIG.rateLimitDelay)
      }
    } catch (error) {
      console.error(`[Neon CRM] Error fetching accounts at page=${currentPage}:`, error)
      throw error
    }
  }

  return allAccounts
}

// ============================================================================
// DONATIONS
// ============================================================================

/**
 * Fetch donations for an account
 */
export async function fetchNeonCRMAccountDonations(
  credentials: NeonCRMCredentials,
  accountId: string,
  limit: number = 50
): Promise<NeonCRMDonation[]> {
  const response = await withRetry(
    () => neonCRMFetch<NeonCRMDonationsResponse>(
      `/accounts/${accountId}/donations?pageSize=${limit}`,
      credentials
    ),
    { maxRetries: 3 }
  )

  return response.donations || []
}

/**
 * Search donations
 */
export async function searchNeonCRMDonations(
  credentials: NeonCRMCredentials,
  params?: {
    accountId?: string
    startDate?: string
    endDate?: string
    minAmount?: number
    maxAmount?: number
    pageSize?: number
    currentPage?: number
  }
): Promise<{ donations: NeonCRMDonation[]; totalResults: number }> {
  const searchFields: Array<{ field: string; operator: string; value?: string | number }> = []

  if (params?.accountId) {
    searchFields.push({ field: "Account ID", operator: "EQUAL", value: params.accountId })
  }
  if (params?.startDate) {
    searchFields.push({ field: "Donation Date", operator: "GREATER_AND_EQUAL", value: params.startDate })
  }
  if (params?.endDate) {
    searchFields.push({ field: "Donation Date", operator: "LESS_AND_EQUAL", value: params.endDate })
  }
  if (params?.minAmount !== undefined) {
    searchFields.push({ field: "Donation Amount", operator: "GREATER_AND_EQUAL", value: params.minAmount })
  }
  if (params?.maxAmount !== undefined) {
    searchFields.push({ field: "Donation Amount", operator: "LESS_AND_EQUAL", value: params.maxAmount })
  }

  const body = {
    searchFields,
    outputFields: [
      "Donation ID",
      "Account ID",
      "Donation Amount",
      "Donation Date",
      "Donation Status",
      "Campaign Name",
      "Fund Name",
    ],
    pagination: {
      currentPage: params?.currentPage || 0,
      pageSize: params?.pageSize || 100,
    },
  }

  const response = await withRetry(
    () => neonCRMFetch<{
      searchResults?: Array<Record<string, string | number>>
      pagination?: { totalResults: number }
    }>("/donations/search", credentials, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { maxRetries: 3 }
  )

  const donations: NeonCRMDonation[] = (response.searchResults || []).map((result) => ({
    id: String(result["Donation ID"] || ""),
    accountId: String(result["Account ID"] || ""),
    amount: Number(result["Donation Amount"]) || 0,
    date: String(result["Donation Date"] || ""),
    status: String(result["Donation Status"] || ""),
    campaign: { name: String(result["Campaign Name"] || "") },
    fund: { name: String(result["Fund Name"] || "") },
  }))

  return {
    donations,
    totalResults: response.pagination?.totalResults || donations.length,
  }
}

/**
 * Fetch all donations with pagination
 */
export async function fetchAllNeonCRMDonations(
  credentials: NeonCRMCredentials,
  onProgress?: (fetched: number, total: number) => void
): Promise<NeonCRMDonation[]> {
  const allDonations: NeonCRMDonation[] = []
  let currentPage = 0
  let totalResults = Infinity
  const pageSize = CRM_API_CONFIG.defaultPageSize
  let iterationCount = 0
  let consecutiveEmptyBatches = 0

  while (allDonations.length < totalResults) {
    // Pagination safety check
    const paginationCheck = shouldContinuePagination(
      allDonations.length,
      iterationCount,
      consecutiveEmptyBatches,
      PAGINATION_LIMITS
    )
    if (!paginationCheck.continue) {
      console.warn(`[Neon CRM] Donation pagination stopped: ${paginationCheck.reason}`)
      break
    }

    iterationCount++

    try {
      const result = await searchNeonCRMDonations(credentials, {
        pageSize,
        currentPage,
      })

      if (result.donations.length > 0) {
        consecutiveEmptyBatches = 0
        allDonations.push(...result.donations)
      } else {
        consecutiveEmptyBatches++
      }

      totalResults = result.totalResults

      if (onProgress) {
        onProgress(allDonations.length, totalResults)
      }

      if (result.donations.length < pageSize) {
        break
      }

      currentPage++

      // Rate limiting delay
      await sleep(CRM_API_CONFIG.rateLimitDelay)
    } catch (error) {
      console.error(`[Neon CRM] Error fetching donations at page=${currentPage}:`, error)
      throw error
    }
  }

  return allDonations
}
