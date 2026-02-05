/**
 * Neon CRM Tools
 * Provides access to Neon CRM API v2 for nonprofit donor management and research.
 *
 * API Documentation: https://developer.neoncrm.com/api-v2/
 *
 * Features:
 * - Search accounts (donors/constituents) by name, email
 * - Get detailed account information including custom fields
 * - Search donations by various criteria
 * - Get donation history for specific accounts
 * - Search memberships and event registrations
 *
 * Authentication:
 * - Requires NEON_CRM_ORG_ID and NEON_CRM_API_KEY environment variables
 * - Uses HTTP Basic Auth with Org ID:API Key
 */

import { tool } from "ai"
import { z } from "zod"
import {
  isNeonCRMEnabled,
  getNeonCRMBaseUrl,
  getNeonCRMCredentialsOptional,
  buildNeonCRMAuthHeaderFromCredentials,
  NEON_CRM_DEFAULTS,
  type NeonCRMAccountType,
  type NeonCRMPagination,
} from "@/lib/neon-crm/config"

// ============================================================================
// TYPES
// ============================================================================

interface NeonCRMAccount {
  accountId: string
  accountType: NeonCRMAccountType
  firstName?: string
  lastName?: string
  organizationName?: string
  email?: string
  phone?: string
  address?: {
    addressLine1?: string
    addressLine2?: string
    city?: string
    stateProvince?: string
    zipCode?: string
    country?: string
  }
  accountCustomFields?: Array<{
    id: string
    name: string
    value: string
  }>
  totalDonations?: number
  totalGiving?: number
  lastGiftDate?: string
  lastGiftAmount?: number
  createdDate?: string
  companyName?: string
  jobTitle?: string
}

interface NeonCRMDonation {
  donationId: string
  accountId: string
  amount: number
  date: string
  status: string
  campaign?: string
  fund?: string
  paymentMethod?: string
  donorName?: string
  donationType?: string
  acknowledgement?: {
    status: string
    date?: string
  }
}

interface NeonCRMSearchAccountsResponse {
  accounts: NeonCRMAccount[]
  pagination: NeonCRMPagination
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

interface NeonCRMGetAccountResponse {
  account: NeonCRMAccount | null
  donations: NeonCRMDonation[]
  totalGiving: number
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

interface NeonCRMSearchDonationsResponse {
  donations: NeonCRMDonation[]
  pagination: NeonCRMPagination
  totalAmount: number
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// SCHEMAS
// ============================================================================

const searchAccountsSchema = z.object({
  firstName: z
    .string()
    .optional()
    .describe("First name to search for (partial match supported)"),
  lastName: z
    .string()
    .optional()
    .describe("Last name to search for (partial match supported)"),
  email: z
    .string()
    .optional()
    .describe("Email address to search for"),
  organizationName: z
    .string()
    .optional()
    .describe("Organization name for org accounts"),
  accountType: z
    .enum(["Individual", "Organization", "Household"])
    .optional()
    .describe("Filter by account type"),
  limit: z
    .number()
    .optional()
    .default(20)
    .describe("Maximum results to return (default: 20, max: 200)"),
})

const getAccountSchema = z.object({
  accountId: z
    .string()
    .describe("The Neon CRM account ID to retrieve"),
  includeDonations: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to include donation history (default: true)"),
  donationLimit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum donations to return (default: 10)"),
})

const searchDonationsSchema = z.object({
  accountId: z
    .string()
    .optional()
    .describe("Filter by account ID"),
  startDate: z
    .string()
    .optional()
    .describe("Filter donations from this date (YYYY-MM-DD)"),
  endDate: z
    .string()
    .optional()
    .describe("Filter donations to this date (YYYY-MM-DD)"),
  minAmount: z
    .number()
    .optional()
    .describe("Minimum donation amount"),
  maxAmount: z
    .number()
    .optional()
    .describe("Maximum donation amount"),
  campaign: z
    .string()
    .optional()
    .describe("Filter by campaign name"),
  limit: z
    .number()
    .optional()
    .default(20)
    .describe("Maximum results to return (default: 20, max: 200)"),
})

// ============================================================================
// HELPERS
// ============================================================================

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

/**
 * Make authenticated request to Neon CRM API v2
 */
async function neonCRMRequest<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    body?: unknown
  } = {}
): Promise<T> {
  const credentials = getNeonCRMCredentialsOptional()

  if (!credentials) {
    throw new Error("Neon CRM credentials not configured")
  }

  const baseUrl = getNeonCRMBaseUrl()
  const url = `${baseUrl}${endpoint}`
  const authHeader = buildNeonCRMAuthHeaderFromCredentials(
    credentials.orgId,
    credentials.apiKey
  )

  const response = await withTimeout(
    fetch(url, {
      method: options.method || "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
        "NEON-API-VERSION": NEON_CRM_DEFAULTS.apiVersion,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    }),
    NEON_CRM_DEFAULTS.timeout,
    `Neon CRM API request timed out after ${NEON_CRM_DEFAULTS.timeout / 1000} seconds`
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error")
    throw new Error(`Neon CRM API error (${response.status}): ${errorText}`)
  }

  return response.json()
}

/**
 * Format currency amount
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

/**
 * Format account for AI consumption
 */
function formatAccountForAI(account: NeonCRMAccount): string {
  const lines: string[] = []

  // Name
  if (account.accountType === "Organization") {
    lines.push(`### ${account.organizationName || "Unknown Organization"} (ID: ${account.accountId})`)
    lines.push(`**Type:** Organization`)
  } else {
    const name = [account.firstName, account.lastName].filter(Boolean).join(" ") || "Unknown"
    lines.push(`### ${name} (ID: ${account.accountId})`)
    lines.push(`**Type:** ${account.accountType}`)
  }

  // Contact info
  if (account.email) lines.push(`**Email:** ${account.email}`)
  if (account.phone) lines.push(`**Phone:** ${account.phone}`)
  if (account.companyName) lines.push(`**Company:** ${account.companyName}`)
  if (account.jobTitle) lines.push(`**Title:** ${account.jobTitle}`)

  // Address
  if (account.address) {
    const addr = account.address
    const addressParts = [
      addr.addressLine1,
      addr.addressLine2,
      [addr.city, addr.stateProvince, addr.zipCode].filter(Boolean).join(", "),
      addr.country,
    ].filter(Boolean)
    if (addressParts.length > 0) {
      lines.push(`**Address:** ${addressParts.join(", ")}`)
    }
  }

  // Giving summary
  if (account.totalGiving !== undefined) {
    lines.push(`**Total Giving:** ${formatCurrency(account.totalGiving)}`)
  }
  if (account.totalDonations !== undefined) {
    lines.push(`**Total Donations:** ${account.totalDonations}`)
  }
  if (account.lastGiftDate) {
    lines.push(`**Last Gift:** ${account.lastGiftDate}${account.lastGiftAmount ? ` (${formatCurrency(account.lastGiftAmount)})` : ""}`)
  }

  // Custom fields
  if (account.accountCustomFields && account.accountCustomFields.length > 0) {
    lines.push("\n**Custom Fields:**")
    for (const field of account.accountCustomFields.slice(0, 10)) {
      lines.push(`- ${field.name}: ${field.value}`)
    }
  }

  return lines.join("\n")
}

/**
 * Format donation for AI consumption
 */
function formatDonationForAI(donation: NeonCRMDonation): string {
  const parts = [
    `${donation.date}`,
    formatCurrency(donation.amount),
    donation.campaign ? `Campaign: ${donation.campaign}` : null,
    donation.fund ? `Fund: ${donation.fund}` : null,
    donation.status !== "Succeeded" ? `Status: ${donation.status}` : null,
  ].filter(Boolean)

  return `- ${parts.join(" | ")}`
}

/**
 * Format search results for AI
 */
function formatSearchResultsForAI(
  accounts: NeonCRMAccount[],
  searchCriteria: string
): string {
  if (accounts.length === 0) {
    return `# Neon CRM Search Results

**Search:** ${searchCriteria}

No accounts found matching your search criteria.

## Tips
- Try broader search terms
- Check spelling of names
- Use partial matches (first few letters)
- For organizations, try the organization name field`
  }

  const lines = [
    `# Neon CRM Search Results`,
    ``,
    `**Search:** ${searchCriteria}`,
    `**Found:** ${accounts.length} account${accounts.length === 1 ? "" : "s"}`,
    ``,
  ]

  for (const account of accounts) {
    lines.push(formatAccountForAI(account))
    lines.push("")
  }

  lines.push("---")
  lines.push("Use `neon_crm_get_account` with the account ID to get detailed information and donation history.")

  return lines.join("\n")
}

/**
 * Format account detail for AI
 */
function formatAccountDetailForAI(
  account: NeonCRMAccount,
  donations: NeonCRMDonation[],
  totalGiving: number
): string {
  const lines = [
    `# Neon CRM Account Details`,
    ``,
    formatAccountForAI(account),
    ``,
  ]

  // Donation history
  if (donations.length > 0) {
    lines.push(`## Donation History (${donations.length} shown)`)
    lines.push(`**Total Giving:** ${formatCurrency(totalGiving)}`)
    lines.push("")

    for (const donation of donations) {
      lines.push(formatDonationForAI(donation))
    }
  } else {
    lines.push("## Donation History")
    lines.push("No donations found for this account.")
  }

  return lines.join("\n")
}

/**
 * Format donations search for AI
 */
function formatDonationsSearchForAI(
  donations: NeonCRMDonation[],
  totalAmount: number,
  searchCriteria: string
): string {
  if (donations.length === 0) {
    return `# Neon CRM Donation Search

**Search:** ${searchCriteria}

No donations found matching your criteria.`
  }

  const lines = [
    `# Neon CRM Donation Search`,
    ``,
    `**Search:** ${searchCriteria}`,
    `**Found:** ${donations.length} donation${donations.length === 1 ? "" : "s"}`,
    `**Total Amount:** ${formatCurrency(totalAmount)}`,
    ``,
    `## Donations`,
    ``,
  ]

  for (const donation of donations) {
    const donorInfo = donation.donorName ? ` (${donation.donorName})` : ""
    lines.push(`${formatDonationForAI(donation)}${donorInfo}`)
  }

  return lines.join("\n")
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Search accounts using Neon CRM API v2
 */
async function searchAccounts(params: {
  firstName?: string
  lastName?: string
  email?: string
  organizationName?: string
  accountType?: NeonCRMAccountType
  limit: number
}): Promise<{ accounts: NeonCRMAccount[]; pagination: NeonCRMPagination }> {
  // Build query parameters for GET /accounts
  const queryParams = new URLSearchParams()

  if (params.firstName) queryParams.set("firstName", params.firstName)
  if (params.lastName) queryParams.set("lastName", params.lastName)
  if (params.email) queryParams.set("email", params.email)
  if (params.accountType) queryParams.set("userType", params.accountType)

  queryParams.set("pageSize", Math.min(params.limit, NEON_CRM_DEFAULTS.maxLimit).toString())
  queryParams.set("currentPage", "0")

  const endpoint = `/accounts?${queryParams.toString()}`

  interface ApiResponse {
    accounts?: Array<{
      accountId?: string
      individualAccount?: {
        primaryContact?: {
          firstName?: string
          lastName?: string
          email1?: string
          phone1?: string
          addresses?: Array<{
            addressLine1?: string
            addressLine2?: string
            city?: string
            stateProvince?: { code?: string }
            zipCode?: string
            country?: { name?: string }
          }>
          employer?: { name?: string }
          currentEmployer?: string
          jobTitle?: string
        }
      }
      companyAccount?: {
        name?: string
        email?: string
        phone?: string
        addresses?: Array<{
          addressLine1?: string
          addressLine2?: string
          city?: string
          stateProvince?: { code?: string }
          zipCode?: string
          country?: { name?: string }
        }>
      }
      donationsSummary?: {
        totalDonations?: number
        total?: number
        lastDonationDate?: string
        lastDonationAmount?: number
      }
      accountCustomFields?: Array<{
        id: string
        name: string
        value: string
      }>
    }>
    pagination?: {
      currentPage?: number
      pageSize?: number
      totalPages?: number
      totalResults?: number
    }
  }

  const response = await neonCRMRequest<ApiResponse>(endpoint)

  const accounts: NeonCRMAccount[] = (response.accounts || []).map((acc) => {
    const isIndividual = !!acc.individualAccount
    const contact = acc.individualAccount?.primaryContact
    const company = acc.companyAccount
    const addr = isIndividual
      ? contact?.addresses?.[0]
      : company?.addresses?.[0]

    return {
      accountId: acc.accountId || "",
      accountType: isIndividual ? "Individual" : "Organization",
      firstName: contact?.firstName,
      lastName: contact?.lastName,
      organizationName: company?.name,
      email: isIndividual ? contact?.email1 : company?.email,
      phone: isIndividual ? contact?.phone1 : company?.phone,
      address: addr
        ? {
            addressLine1: addr.addressLine1,
            addressLine2: addr.addressLine2,
            city: addr.city,
            stateProvince: addr.stateProvince?.code,
            zipCode: addr.zipCode,
            country: addr.country?.name,
          }
        : undefined,
      companyName: contact?.currentEmployer || contact?.employer?.name,
      jobTitle: contact?.jobTitle,
      totalDonations: acc.donationsSummary?.totalDonations,
      totalGiving: acc.donationsSummary?.total,
      lastGiftDate: acc.donationsSummary?.lastDonationDate,
      lastGiftAmount: acc.donationsSummary?.lastDonationAmount,
      accountCustomFields: acc.accountCustomFields,
    }
  })

  return {
    accounts,
    pagination: {
      currentPage: response.pagination?.currentPage || 0,
      pageSize: response.pagination?.pageSize || params.limit,
      totalPages: response.pagination?.totalPages || 1,
      totalResults: response.pagination?.totalResults || accounts.length,
    },
  }
}

/**
 * Get account details by ID
 */
async function getAccountById(accountId: string): Promise<NeonCRMAccount | null> {
  interface ApiResponse {
    accountId?: string
    individualAccount?: {
      primaryContact?: {
        firstName?: string
        lastName?: string
        email1?: string
        phone1?: string
        addresses?: Array<{
          addressLine1?: string
          addressLine2?: string
          city?: string
          stateProvince?: { code?: string }
          zipCode?: string
          country?: { name?: string }
        }>
        employer?: { name?: string }
        currentEmployer?: string
        jobTitle?: string
      }
    }
    companyAccount?: {
      name?: string
      email?: string
      phone?: string
      addresses?: Array<{
        addressLine1?: string
        addressLine2?: string
        city?: string
        stateProvince?: { code?: string }
        zipCode?: string
        country?: { name?: string }
      }>
    }
    donationsSummary?: {
      totalDonations?: number
      total?: number
      lastDonationDate?: string
      lastDonationAmount?: number
    }
    accountCustomFields?: Array<{
      id: string
      name: string
      value: string
    }>
    timestamps?: {
      createdDateTime?: string
    }
  }

  try {
    const response = await neonCRMRequest<ApiResponse>(`/accounts/${accountId}`)

    if (!response.accountId) return null

    const isIndividual = !!response.individualAccount
    const contact = response.individualAccount?.primaryContact
    const company = response.companyAccount
    const addr = isIndividual
      ? contact?.addresses?.[0]
      : company?.addresses?.[0]

    return {
      accountId: response.accountId,
      accountType: isIndividual ? "Individual" : "Organization",
      firstName: contact?.firstName,
      lastName: contact?.lastName,
      organizationName: company?.name,
      email: isIndividual ? contact?.email1 : company?.email,
      phone: isIndividual ? contact?.phone1 : company?.phone,
      address: addr
        ? {
            addressLine1: addr.addressLine1,
            addressLine2: addr.addressLine2,
            city: addr.city,
            stateProvince: addr.stateProvince?.code,
            zipCode: addr.zipCode,
            country: addr.country?.name,
          }
        : undefined,
      companyName: contact?.currentEmployer || contact?.employer?.name,
      jobTitle: contact?.jobTitle,
      totalDonations: response.donationsSummary?.totalDonations,
      totalGiving: response.donationsSummary?.total,
      lastGiftDate: response.donationsSummary?.lastDonationDate,
      lastGiftAmount: response.donationsSummary?.lastDonationAmount,
      accountCustomFields: response.accountCustomFields,
      createdDate: response.timestamps?.createdDateTime,
    }
  } catch (error) {
    console.error("[Neon CRM] Get account failed:", error)
    return null
  }
}

/**
 * Get donations for an account
 */
async function getAccountDonations(
  accountId: string,
  limit: number = 10
): Promise<NeonCRMDonation[]> {
  interface ApiResponse {
    donations?: Array<{
      id?: string
      accountId?: string
      amount?: number
      date?: string
      status?: string
      campaign?: { name?: string }
      fund?: { name?: string }
      payment?: { paymentMethod?: string }
      donationType?: string
      acknowledgement?: {
        status?: string
        date?: string
      }
    }>
  }

  try {
    const response = await neonCRMRequest<ApiResponse>(
      `/accounts/${accountId}/donations?pageSize=${limit}`
    )

    return (response.donations || []).map((d) => ({
      donationId: d.id || "",
      accountId: d.accountId || accountId,
      amount: d.amount || 0,
      date: d.date || "",
      status: d.status || "Unknown",
      campaign: d.campaign?.name,
      fund: d.fund?.name,
      paymentMethod: d.payment?.paymentMethod,
      donationType: d.donationType,
      acknowledgement: d.acknowledgement
        ? {
            status: d.acknowledgement.status || "",
            date: d.acknowledgement.date,
          }
        : undefined,
    }))
  } catch (error) {
    console.error("[Neon CRM] Get donations failed:", error)
    return []
  }
}

/**
 * Search donations
 */
async function searchDonations(params: {
  accountId?: string
  startDate?: string
  endDate?: string
  minAmount?: number
  maxAmount?: number
  campaign?: string
  limit: number
}): Promise<{ donations: NeonCRMDonation[]; pagination: NeonCRMPagination; totalAmount: number }> {
  // Build search criteria for POST /donations/search
  const searchFields: Array<{
    field: string
    operator: string
    value?: string | number
  }> = []

  if (params.accountId) {
    searchFields.push({
      field: "Account ID",
      operator: "EQUAL",
      value: params.accountId,
    })
  }

  if (params.startDate) {
    searchFields.push({
      field: "Donation Date",
      operator: "GREATER_AND_EQUAL",
      value: params.startDate,
    })
  }

  if (params.endDate) {
    searchFields.push({
      field: "Donation Date",
      operator: "LESS_AND_EQUAL",
      value: params.endDate,
    })
  }

  if (params.minAmount !== undefined) {
    searchFields.push({
      field: "Donation Amount",
      operator: "GREATER_AND_EQUAL",
      value: params.minAmount,
    })
  }

  if (params.maxAmount !== undefined) {
    searchFields.push({
      field: "Donation Amount",
      operator: "LESS_AND_EQUAL",
      value: params.maxAmount,
    })
  }

  interface ApiResponse {
    searchResults?: Array<{
      "Donation ID"?: string
      "Account ID"?: string
      "Donation Amount"?: number
      "Donation Date"?: string
      "Donation Status"?: string
      "Campaign Name"?: string
      "Fund Name"?: string
      "Donor Name"?: string
      "Donation Type"?: string
    }>
    pagination?: {
      currentPage?: number
      pageSize?: number
      totalPages?: number
      totalResults?: number
    }
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
      "Donor Name",
      "Donation Type",
    ],
    pagination: {
      currentPage: 0,
      pageSize: Math.min(params.limit, NEON_CRM_DEFAULTS.maxLimit),
    },
  }

  const response = await neonCRMRequest<ApiResponse>("/donations/search", {
    method: "POST",
    body,
  })

  const donations: NeonCRMDonation[] = (response.searchResults || []).map((d) => ({
    donationId: d["Donation ID"] || "",
    accountId: d["Account ID"] || "",
    amount: d["Donation Amount"] || 0,
    date: d["Donation Date"] || "",
    status: d["Donation Status"] || "Unknown",
    campaign: d["Campaign Name"],
    fund: d["Fund Name"],
    donorName: d["Donor Name"],
    donationType: d["Donation Type"],
  }))

  const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0)

  return {
    donations,
    pagination: {
      currentPage: response.pagination?.currentPage || 0,
      pageSize: response.pagination?.pageSize || params.limit,
      totalPages: response.pagination?.totalPages || 1,
      totalResults: response.pagination?.totalResults || donations.length,
    },
    totalAmount,
  }
}

// ============================================================================
// TOOLS
// ============================================================================

/**
 * Search Neon CRM accounts (donors/constituents)
 */
export const neonCRMSearchAccountsTool = tool({
  description:
    "Search for donors/constituents in Neon CRM by name, email, or organization. " +
    "Returns account IDs, contact info, and giving summaries. " +
    "Use this to find donors in the nonprofit's CRM before external research. " +
    "Requires NEON_CRM_ORG_ID and NEON_CRM_API_KEY environment variables.",
  inputSchema: searchAccountsSchema,
  execute: async (params): Promise<NeonCRMSearchAccountsResponse> => {
    console.log("[Neon CRM] Searching accounts:", params)
    const startTime = Date.now()

    if (!isNeonCRMEnabled()) {
      return {
        accounts: [],
        pagination: { currentPage: 0, pageSize: 0, totalPages: 0, totalResults: 0 },
        rawContent: `# Neon CRM Search

**Error:** Neon CRM is not configured.

## Setup Required

Add these environment variables:
\`\`\`
NEON_CRM_ORG_ID=your_org_id
NEON_CRM_API_KEY=your_api_key
\`\`\`

Get your credentials from Neon CRM:
Settings > Organization Profile (for Org ID)
Settings > User Management > [User] > API Access (for API Key)`,
        sources: [{ name: "Neon CRM Developer Docs", url: "https://developer.neoncrm.com/getting-started/" }],
        error: "Neon CRM not configured",
      }
    }

    try {
      const { accounts, pagination } = await searchAccounts({
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
        organizationName: params.organizationName,
        accountType: params.accountType as NeonCRMAccountType | undefined,
        limit: params.limit,
      })

      const searchCriteria = [
        params.firstName && `firstName="${params.firstName}"`,
        params.lastName && `lastName="${params.lastName}"`,
        params.email && `email="${params.email}"`,
        params.organizationName && `org="${params.organizationName}"`,
        params.accountType && `type=${params.accountType}`,
      ].filter(Boolean).join(", ") || "all accounts"

      const duration = Date.now() - startTime
      console.log(`[Neon CRM] Search completed in ${duration}ms. Found ${accounts.length} accounts.`)

      return {
        accounts,
        pagination,
        rawContent: formatSearchResultsForAI(accounts, searchCriteria),
        sources: [
          {
            name: "Neon CRM Account Search",
            url: "https://developer.neoncrm.com/api-v2/",
          },
        ],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[Neon CRM] Search accounts failed:", errorMessage)

      return {
        accounts: [],
        pagination: { currentPage: 0, pageSize: 0, totalPages: 0, totalResults: 0 },
        rawContent: `# Neon CRM Search Error

**Error:** ${errorMessage}

## Troubleshooting

1. Check your NEON_CRM_ORG_ID and NEON_CRM_API_KEY
2. Ensure API access is enabled for the user
3. Verify your Neon CRM subscription is active`,
        sources: [{ name: "Neon CRM Developer Docs", url: "https://developer.neoncrm.com/getting-started/" }],
        error: errorMessage,
      }
    }
  },
})

/**
 * Get detailed Neon CRM account by ID
 */
export const neonCRMGetAccountTool = tool({
  description:
    "Get detailed information about a Neon CRM account by ID. " +
    "Returns full contact info, custom fields, and donation history. " +
    "Use after searching to get complete donor profile. " +
    "Requires NEON_CRM_ORG_ID and NEON_CRM_API_KEY environment variables.",
  inputSchema: getAccountSchema,
  execute: async ({ accountId, includeDonations, donationLimit }): Promise<NeonCRMGetAccountResponse> => {
    console.log("[Neon CRM] Getting account:", accountId)
    const startTime = Date.now()

    if (!isNeonCRMEnabled()) {
      return {
        account: null,
        donations: [],
        totalGiving: 0,
        rawContent: `# Neon CRM Account

**Error:** Neon CRM is not configured.

## Setup Required

Add these environment variables:
\`\`\`
NEON_CRM_ORG_ID=your_org_id
NEON_CRM_API_KEY=your_api_key
\`\`\``,
        sources: [],
        error: "Neon CRM not configured",
      }
    }

    try {
      const [account, donations] = await Promise.all([
        getAccountById(accountId),
        includeDonations ? getAccountDonations(accountId, donationLimit) : Promise.resolve([]),
      ])

      if (!account) {
        return {
          account: null,
          donations: [],
          totalGiving: 0,
          rawContent: `# Neon CRM Account

**Error:** Account ${accountId} not found.

Check the account ID and try again.`,
          sources: [],
          error: `Account ${accountId} not found`,
        }
      }

      const totalGiving = account.totalGiving || donations.reduce((sum, d) => sum + d.amount, 0)

      const duration = Date.now() - startTime
      console.log(`[Neon CRM] Get account completed in ${duration}ms.`)

      return {
        account,
        donations,
        totalGiving,
        rawContent: formatAccountDetailForAI(account, donations, totalGiving),
        sources: [
          {
            name: `Neon CRM Account ${accountId}`,
            url: "https://developer.neoncrm.com/api-v2/",
          },
        ],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[Neon CRM] Get account failed:", errorMessage)

      return {
        account: null,
        donations: [],
        totalGiving: 0,
        rawContent: `# Neon CRM Account Error

**Error:** ${errorMessage}`,
        sources: [],
        error: errorMessage,
      }
    }
  },
})

/**
 * Search Neon CRM donations
 */
export const neonCRMSearchDonationsTool = tool({
  description:
    "Search donations in Neon CRM by date range, amount, campaign, or account. " +
    "Returns donation details with amounts and campaign attribution. " +
    "Use to analyze giving patterns and major gifts. " +
    "Requires NEON_CRM_ORG_ID and NEON_CRM_API_KEY environment variables.",
  inputSchema: searchDonationsSchema,
  execute: async (params): Promise<NeonCRMSearchDonationsResponse> => {
    console.log("[Neon CRM] Searching donations:", params)
    const startTime = Date.now()

    if (!isNeonCRMEnabled()) {
      return {
        donations: [],
        pagination: { currentPage: 0, pageSize: 0, totalPages: 0, totalResults: 0 },
        totalAmount: 0,
        rawContent: `# Neon CRM Donation Search

**Error:** Neon CRM is not configured.

## Setup Required

Add these environment variables:
\`\`\`
NEON_CRM_ORG_ID=your_org_id
NEON_CRM_API_KEY=your_api_key
\`\`\``,
        sources: [],
        error: "Neon CRM not configured",
      }
    }

    try {
      const { donations, pagination, totalAmount } = await searchDonations({
        accountId: params.accountId,
        startDate: params.startDate,
        endDate: params.endDate,
        minAmount: params.minAmount,
        maxAmount: params.maxAmount,
        campaign: params.campaign,
        limit: params.limit,
      })

      const searchCriteria = [
        params.accountId && `accountId=${params.accountId}`,
        params.startDate && `from=${params.startDate}`,
        params.endDate && `to=${params.endDate}`,
        params.minAmount !== undefined && `min=$${params.minAmount}`,
        params.maxAmount !== undefined && `max=$${params.maxAmount}`,
        params.campaign && `campaign="${params.campaign}"`,
      ].filter(Boolean).join(", ") || "all donations"

      const duration = Date.now() - startTime
      console.log(`[Neon CRM] Donation search completed in ${duration}ms. Found ${donations.length} donations.`)

      return {
        donations,
        pagination,
        totalAmount,
        rawContent: formatDonationsSearchForAI(donations, totalAmount, searchCriteria),
        sources: [
          {
            name: "Neon CRM Donation Search",
            url: "https://developer.neoncrm.com/api-v2/",
          },
        ],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[Neon CRM] Search donations failed:", errorMessage)

      return {
        donations: [],
        pagination: { currentPage: 0, pageSize: 0, totalPages: 0, totalResults: 0 },
        totalAmount: 0,
        rawContent: `# Neon CRM Donation Search Error

**Error:** ${errorMessage}`,
        sources: [],
        error: errorMessage,
      }
    }
  },
})

/**
 * Check if Neon CRM tools should be enabled
 */
export function shouldEnableNeonCRMTools(): boolean {
  return isNeonCRMEnabled()
}
