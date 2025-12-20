/**
 * CMS Open Payments Tool (Sunshine Act)
 *
 * Search payments from pharmaceutical/device companies to physicians.
 * This is the "Sunshine Act" data - required disclosure of all payments >$10.
 *
 * Data Source: CMS Open Payments via Socrata
 * Portal: https://openpaymentsdata.cms.gov/
 *
 * Coverage: Payments since 2013
 * Updates: Annually (published each June 30)
 *
 * Use Cases:
 * - Identify physician consulting/speaking income
 * - Research grant funding to physicians
 * - Food, beverage, travel payments
 * - Wealth indicator for healthcare prospects
 *
 * FREE - No API key required
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// CONFIGURATION
// ============================================================================

const CMS_PORTAL = "https://openpaymentsdata.cms.gov"
const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_LIMIT = 50

// Dataset IDs for different payment types (2024 data - most recent)
const DATASETS = {
  general_2024: "e6b17c6a-2534-4207-a4a1-6746a14911ff",
  research_2024: "2f15cb85-8887-4dcc-a318-1f8ec1d815b3",
  ownership_2024: "9ac4f7f8-b6e4-4d80-8410-4aba7e71dd02",
  general_2023: "fb3a65aa-c901-4a38-a813-b04b00dfa2a9",
  research_2023: "ec9521bf-9d97-4603-814c-f4132d34bc4f",
  ownership_2023: "ac0bc85c-02e3-45d9-89e8-2ff43da85df7",
}

// ============================================================================
// TYPES
// ============================================================================

interface CMSPaymentRecord {
  covered_recipient_first_name?: string
  covered_recipient_last_name?: string
  covered_recipient_middle_name?: string
  covered_recipient_type?: string
  covered_recipient_specialty?: string
  covered_recipient_primary_business_street_address_line1?: string
  covered_recipient_city?: string
  covered_recipient_state?: string
  covered_recipient_zip_code?: string
  applicable_manufacturer_or_applicable_gpo_making_payment_name?: string
  total_amount_of_payment_usdollars?: string
  date_of_payment?: string
  form_of_payment_or_transfer_of_value?: string
  nature_of_payment_or_transfer_of_value?: string
  product_indicator?: string
  name_of_drug_or_biological_or_device_or_medical_supply_1?: string
  program_year?: string
  payment_publication_date?: string
}

interface CMSResearchRecord {
  covered_recipient_first_name?: string
  covered_recipient_last_name?: string
  covered_recipient_type?: string
  covered_recipient_specialty?: string
  covered_recipient_city?: string
  covered_recipient_state?: string
  applicable_manufacturer_or_applicable_gpo_making_payment_name?: string
  total_amount_of_payment_usdollars?: string
  form_of_payment_or_transfer_of_value?: string
  name_of_study?: string
  program_year?: string
}

interface PaymentSummary {
  recipientName: string
  specialty?: string
  location?: string
  payerName: string
  amount: number
  date?: string
  paymentType: string
  productName?: string
  year: string
}

interface CMSOpenPaymentsResult {
  searchTerm: string
  paymentType: "general" | "research" | "ownership" | "all"
  payments: PaymentSummary[]
  summary: {
    totalPayments: number
    totalAmount: number
    uniquePayers: number
    paymentTypes: Record<string, number>
    yearRange: { min: string; max: string }
  }
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseAmount(value: string | undefined): number {
  if (!value) return 0
  const num = parseFloat(value.replace(/[^0-9.-]/g, ""))
  return isNaN(num) ? 0 : num
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "N/A"
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return dateStr
  }
}

function buildFullName(first?: string, middle?: string, last?: string): string {
  const parts = [first, middle, last].filter(Boolean)
  return parts.join(" ") || "Unknown"
}

// ============================================================================
// API CLIENT
// ============================================================================

async function queryCMSDataset(
  datasetId: string,
  physicianName: string,
  limit: number = DEFAULT_LIMIT
): Promise<CMSPaymentRecord[] | CMSResearchRecord[]> {
  // Build SoQL query for physician name search
  const nameParts = physicianName.trim().split(/\s+/)
  const conditions: string[] = []

  if (nameParts.length >= 2) {
    // Search by first and last name
    const firstName = nameParts[0].toUpperCase()
    const lastName = nameParts[nameParts.length - 1].toUpperCase()
    conditions.push(
      `upper(covered_recipient_first_name) LIKE '%${firstName}%'`,
      `upper(covered_recipient_last_name) LIKE '%${lastName}%'`
    )
  } else {
    // Single name - search last name only
    const name = nameParts[0].toUpperCase()
    conditions.push(`upper(covered_recipient_last_name) LIKE '%${name}%'`)
  }

  const whereClause = conditions.join(" AND ")
  const url = `${CMS_PORTAL}/api/1/datastore/sql?query=SELECT * FROM "${datasetId}" WHERE ${encodeURIComponent(whereClause)} ORDER BY total_amount_of_payment_usdollars DESC LIMIT ${limit}`

  console.log(`[CMSOpenPayments] Querying: ${url.substring(0, 200)}...`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`CMS API error ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    return data || []
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("CMS API request timed out")
    }
    throw error
  }
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

async function searchGeneralPayments(
  physicianName: string,
  limit: number = DEFAULT_LIMIT
): Promise<PaymentSummary[]> {
  const payments: PaymentSummary[] = []

  // Search both 2024 and 2023 data
  for (const [key, datasetId] of Object.entries(DATASETS)) {
    if (!key.startsWith("general_")) continue

    try {
      const records = (await queryCMSDataset(
        datasetId,
        physicianName,
        limit
      )) as CMSPaymentRecord[]

      for (const record of records) {
        payments.push({
          recipientName: buildFullName(
            record.covered_recipient_first_name,
            record.covered_recipient_middle_name,
            record.covered_recipient_last_name
          ),
          specialty: record.covered_recipient_specialty,
          location:
            record.covered_recipient_city && record.covered_recipient_state
              ? `${record.covered_recipient_city}, ${record.covered_recipient_state}`
              : undefined,
          payerName:
            record.applicable_manufacturer_or_applicable_gpo_making_payment_name ||
            "Unknown",
          amount: parseAmount(record.total_amount_of_payment_usdollars),
          date: record.date_of_payment,
          paymentType:
            record.nature_of_payment_or_transfer_of_value || "General Payment",
          productName: record.name_of_drug_or_biological_or_device_or_medical_supply_1,
          year: record.program_year || key.split("_")[1],
        })
      }
    } catch (error) {
      console.error(`[CMSOpenPayments] Error querying ${key}:`, error)
    }
  }

  return payments
}

async function searchResearchPayments(
  physicianName: string,
  limit: number = DEFAULT_LIMIT
): Promise<PaymentSummary[]> {
  const payments: PaymentSummary[] = []

  for (const [key, datasetId] of Object.entries(DATASETS)) {
    if (!key.startsWith("research_")) continue

    try {
      const records = (await queryCMSDataset(
        datasetId,
        physicianName,
        limit
      )) as CMSResearchRecord[]

      for (const record of records) {
        payments.push({
          recipientName: buildFullName(
            record.covered_recipient_first_name,
            undefined,
            record.covered_recipient_last_name
          ),
          specialty: record.covered_recipient_specialty,
          location:
            record.covered_recipient_city && record.covered_recipient_state
              ? `${record.covered_recipient_city}, ${record.covered_recipient_state}`
              : undefined,
          payerName:
            record.applicable_manufacturer_or_applicable_gpo_making_payment_name ||
            "Unknown",
          amount: parseAmount(record.total_amount_of_payment_usdollars),
          paymentType: "Research Grant",
          productName: record.name_of_study,
          year: record.program_year || key.split("_")[1],
        })
      }
    } catch (error) {
      console.error(`[CMSOpenPayments] Error querying ${key}:`, error)
    }
  }

  return payments
}

async function searchAllPayments(
  physicianName: string,
  limit: number = DEFAULT_LIMIT
): Promise<PaymentSummary[]> {
  const [general, research] = await Promise.all([
    searchGeneralPayments(physicianName, limit),
    searchResearchPayments(physicianName, limit),
  ])

  return [...general, ...research].sort((a, b) => b.amount - a.amount)
}

// ============================================================================
// RESULT BUILDERS
// ============================================================================

function buildErrorResult(
  searchTerm: string,
  paymentType: "general" | "research" | "ownership" | "all",
  error: string
): CMSOpenPaymentsResult {
  return {
    searchTerm,
    paymentType,
    payments: [],
    summary: {
      totalPayments: 0,
      totalAmount: 0,
      uniquePayers: 0,
      paymentTypes: {},
      yearRange: { min: "", max: "" },
    },
    rawContent: `## Error\n\nFailed to search CMS Open Payments: ${error}`,
    sources: [
      {
        name: "CMS Open Payments",
        url: "https://openpaymentsdata.cms.gov/",
      },
    ],
    error,
  }
}

function buildSuccessResult(
  searchTerm: string,
  paymentType: "general" | "research" | "ownership" | "all",
  payments: PaymentSummary[]
): CMSOpenPaymentsResult {
  // Calculate summary statistics
  let totalAmount = 0
  const payers = new Set<string>()
  const paymentTypes: Record<string, number> = {}
  const years: string[] = []

  for (const payment of payments) {
    totalAmount += payment.amount
    payers.add(payment.payerName)
    paymentTypes[payment.paymentType] =
      (paymentTypes[payment.paymentType] || 0) + payment.amount
    if (payment.year) years.push(payment.year)
  }

  const sortedYears = [...new Set(years)].sort()

  // Build formatted output
  const lines: string[] = []
  lines.push(`# CMS Open Payments Search (Sunshine Act)`)
  lines.push("")
  lines.push(`**Physician:** ${searchTerm}`)
  lines.push(`**Payment Type:** ${paymentType.toUpperCase()}`)
  lines.push(`**Source:** CMS Open Payments (required disclosure of pharma/device payments >$10)`)
  lines.push("")

  if (payments.length > 0) {
    lines.push(`## Summary`)
    lines.push("")
    lines.push(`| Metric | Value |`)
    lines.push(`|--------|-------|`)
    lines.push(`| Total Payments | ${payments.length} |`)
    lines.push(`| Total Amount | ${formatCurrency(totalAmount)} |`)
    lines.push(`| Unique Payers | ${payers.size} |`)
    lines.push(
      `| Years | ${sortedYears.length > 0 ? `${sortedYears[0]} - ${sortedYears[sortedYears.length - 1]}` : "N/A"} |`
    )
    lines.push("")

    // Payment type breakdown
    lines.push(`## Payment Type Breakdown`)
    lines.push("")
    lines.push(`| Type | Amount |`)
    lines.push(`|------|--------|`)
    const sortedTypes = Object.entries(paymentTypes).sort((a, b) => b[1] - a[1])
    for (const [type, amount] of sortedTypes.slice(0, 10)) {
      lines.push(`| ${type} | ${formatCurrency(amount)} |`)
    }
    lines.push("")

    // Top payments
    lines.push(`## Top Payments`)
    lines.push("")

    for (const payment of payments.slice(0, 15)) {
      lines.push(`### ${formatCurrency(payment.amount)} - ${payment.year}`)
      lines.push("")
      lines.push(`| Field | Value |`)
      lines.push(`|-------|-------|`)
      lines.push(`| Recipient | ${payment.recipientName} |`)
      if (payment.specialty) {
        lines.push(`| Specialty | ${payment.specialty} |`)
      }
      if (payment.location) {
        lines.push(`| Location | ${payment.location} |`)
      }
      lines.push(`| Payer | ${payment.payerName} |`)
      lines.push(`| Payment Type | ${payment.paymentType} |`)
      if (payment.productName) {
        lines.push(`| Product/Study | ${payment.productName} |`)
      }
      if (payment.date) {
        lines.push(`| Date | ${formatDate(payment.date)} |`)
      }
      lines.push("")
    }

    if (payments.length > 15) {
      lines.push(`*...and ${payments.length - 15} more payments*`)
    }
  } else {
    lines.push(`## No Results`)
    lines.push("")
    lines.push(`No payments found for "${searchTerm}" in CMS Open Payments database.`)
    lines.push("")
    lines.push(`**Note:** Only payments to physicians are disclosed. Not all healthcare providers are covered.`)
  }

  return {
    searchTerm,
    paymentType,
    payments,
    summary: {
      totalPayments: payments.length,
      totalAmount,
      uniquePayers: payers.size,
      paymentTypes,
      yearRange: {
        min: sortedYears[0] || "",
        max: sortedYears[sortedYears.length - 1] || "",
      },
    },
    rawContent: lines.join("\n"),
    sources: [
      {
        name: "CMS Open Payments",
        url: "https://openpaymentsdata.cms.gov/",
      },
    ],
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

const cmsOpenPaymentsSchema = z.object({
  physicianName: z
    .string()
    .describe("Full name of the physician to search for (e.g., 'John Smith')"),
  paymentType: z
    .enum(["general", "research", "all"])
    .optional()
    .default("all")
    .describe(
      "Type of payments: 'general' (consulting, speaking, meals), 'research' (grants), or 'all'"
    ),
  limit: z
    .number()
    .optional()
    .default(50)
    .describe("Maximum number of payments to return per dataset"),
})

export const cmsOpenPaymentsTool = tool({
  description:
    "Search CMS Open Payments (Sunshine Act) for pharmaceutical/device company payments to physicians. " +
    "Includes consulting fees, speaking fees, research grants, meals, travel. " +
    "REQUIRED DISCLOSURE: All payments >$10 must be reported. " +
    "WEALTH INDICATOR: High-paid physician consultants/speakers indicate significant income. " +
    "$100K+ annual = key opinion leader, $500K+ = major industry relationship.",

  parameters: cmsOpenPaymentsSchema,

  execute: async ({
    physicianName,
    paymentType,
    limit,
  }): Promise<CMSOpenPaymentsResult> => {
    console.log(
      `[CMSOpenPayments] Searching for "${physicianName}" (type: ${paymentType})`
    )

    try {
      let payments: PaymentSummary[]

      switch (paymentType) {
        case "general":
          payments = await searchGeneralPayments(physicianName, limit)
          break
        case "research":
          payments = await searchResearchPayments(physicianName, limit)
          break
        case "all":
        default:
          payments = await searchAllPayments(physicianName, limit)
          break
      }

      return buildSuccessResult(physicianName, paymentType, payments)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      console.error(`[CMSOpenPayments] Error:`, errorMessage)
      return buildErrorResult(physicianName, paymentType, errorMessage)
    }
  },
})

// ============================================================================
// EXPORTS
// ============================================================================

export function shouldEnableCMSOpenPaymentsTool(): boolean {
  return true // FREE - no API key required
}

export { searchGeneralPayments, searchResearchPayments, searchAllPayments }
