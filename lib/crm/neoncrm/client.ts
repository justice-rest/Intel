/**
 * Neon CRM API Client
 * REST API v2: https://developer.neoncrm.com/api-v2/
 */

import { CRM_API_CONFIG } from "../config"
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
 * Format: "orgId:apiKey"
 */
export function parseNeonCRMCredentials(combinedKey: string): NeonCRMCredentials | null {
  const colonIndex = combinedKey.indexOf(":")
  if (colonIndex === -1 || colonIndex === 0 || colonIndex === combinedKey.length - 1) {
    return null
  }

  return {
    orgId: combinedKey.substring(0, colonIndex),
    apiKey: combinedKey.substring(colonIndex + 1),
  }
}

/**
 * Combine Neon CRM credentials into storage format
 */
export function combineNeonCRMCredentials(orgId: string, apiKey: string): string {
  return `${orgId}:${apiKey}`
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

    // Use accounts endpoint with limit 1 to validate credentials
    await neonCRMFetch<NeonCRMAccountsResponse>(
      "/accounts?pageSize=1",
      credentials
    )

    // If we get a response, the credentials are valid
    return {
      valid: true,
      organizationName: `Neon CRM (Org: ${orgId})`,
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
  const response = await neonCRMFetch<NeonCRMAccountsResponse>(endpoint, credentials)

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

  const response = await neonCRMFetch<{ searchResults?: Array<Record<string, string | number>> }>(
    "/accounts/search",
    credentials,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
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

  while (currentPage < totalPages) {
    const result = await fetchNeonCRMAccounts(credentials, {
      pageSize,
      currentPage,
    })

    allAccounts.push(...result.accounts)

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
      await new Promise((resolve) => setTimeout(resolve, CRM_API_CONFIG.rateLimitDelay))
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
  const response = await neonCRMFetch<NeonCRMDonationsResponse>(
    `/accounts/${accountId}/donations?pageSize=${limit}`,
    credentials
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

  const response = await neonCRMFetch<{
    searchResults?: Array<Record<string, string | number>>
    pagination?: { totalResults: number }
  }>("/donations/search", credentials, {
    method: "POST",
    body: JSON.stringify(body),
  })

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

  while (allDonations.length < totalResults) {
    const result = await searchNeonCRMDonations(credentials, {
      pageSize,
      currentPage,
    })

    allDonations.push(...result.donations)
    totalResults = result.totalResults

    if (onProgress) {
      onProgress(allDonations.length, totalResults)
    }

    if (result.donations.length < pageSize) {
      break
    }

    currentPage++

    // Rate limiting delay
    await new Promise((resolve) => setTimeout(resolve, CRM_API_CONFIG.rateLimitDelay))
  }

  return allDonations
}
