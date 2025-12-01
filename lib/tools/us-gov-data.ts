/**
 * US Government Data Tool
 * Unified tool for accessing multiple US Government APIs:
 * - USAspending: Federal contracts, grants, loans
 * - Treasury Fiscal Data: National debt, revenue, spending
 * - Federal Register: Regulations, rules, notices
 *
 * All APIs are free and don't require API keys.
 */

import { tool } from "ai"
import { z } from "zod"
import {
  US_GOV_API_URLS,
  US_GOV_DEFAULTS,
  type UsGovDataSource,
  type FederalRegisterDocType,
} from "@/lib/data-gov/config"

// ============================================================================
// TYPES
// ============================================================================

interface UsaspendingAward {
  Award_ID: string
  Recipient_Name: string
  Award_Amount: number
  Total_Outlays: number
  Description: string
  Award_Type: string
  Awarding_Agency: string
  Awarding_Sub_Agency: string
  Start_Date: string
  End_Date: string
  recipient_id: string
  prime_award_recipient_id: string
}

interface TreasuryDebtRecord {
  record_date: string
  debt_held_public_amt: string
  intragov_hold_amt: string
  tot_pub_debt_out_amt: string
}

interface TreasuryStatementRecord {
  record_date: string
  record_fiscal_year: string
  record_fiscal_quarter: string
  record_calendar_month: string
  receipts_mtd_amt: string
  outlays_mtd_amt: string
  surplus_deficit_mtd_amt: string
}

interface TreasuryInterestRecord {
  record_date: string
  security_desc: string
  avg_interest_rate_amt: string
}

interface FederalRegisterDocument {
  document_number: string
  title: string
  type: string
  abstract: string
  publication_date: string
  agencies: Array<{ name: string; slug: string }>
  html_url: string
  pdf_url: string
  action: string
  dates: string
  effective_on: string | null
  comments_close_on: string | null
}

export interface UsGovDataResult {
  dataSource: UsGovDataSource
  query: string
  results: unknown[]
  totalCount: number
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// SCHEMAS
// ============================================================================

const usGovDataSchema = z.object({
  dataSource: z
    .enum(["usaspending", "treasury", "federal_register"])
    .describe(
      "Which government data source to query: " +
        "'usaspending' for federal contracts/grants/loans, " +
        "'treasury' for national debt and government finances, " +
        "'federal_register' for regulations and agency notices"
    ),

  query: z
    .string()
    .describe(
      "Search query - for USAspending: recipient/company name; " +
        "for Treasury: 'current' for latest data; " +
        "for Federal Register: keyword search terms"
    ),

  // USAspending-specific parameters
  awardType: z
    .enum(["contracts", "idvs", "grants", "loans", "other_financial_assistance", "direct_payments", "all"])
    .optional()
    .default("all")
    .describe(
      "Type of federal award to search (USAspending only). " +
      "contracts: Purchase orders, delivery orders, definitive contracts. " +
      "idvs: Indefinite Delivery Vehicles (GWACs, IDCs, BPAs, etc). " +
      "grants: Block, formula, project grants and cooperative agreements. " +
      "loans: Direct and guaranteed/insured loans. " +
      "other_financial_assistance: Direct payments for specified/unrestricted use. " +
      "direct_payments: Insurance and other financial assistance. " +
      "all: Search all types (makes parallel API calls)."
    ),

  agency: z
    .string()
    .optional()
    .describe("Filter by awarding agency name (USAspending only)"),

  // Treasury-specific parameters
  treasuryDataset: z
    .enum(["debt_to_penny", "treasury_statement", "interest_rates"])
    .optional()
    .default("debt_to_penny")
    .describe("Treasury dataset to query: 'debt_to_penny' for national debt, 'treasury_statement' for monthly receipts/outlays"),

  // Federal Register-specific parameters
  documentType: z
    .enum(["rule", "proposed_rule", "notice", "presidential_document"])
    .optional()
    .describe("Type of Federal Register document to search for"),

  // Common parameters
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of results to return (default: 10, max: 50)"),

  startDate: z
    .string()
    .optional()
    .describe("Start date filter in YYYY-MM-DD format"),

  endDate: z
    .string()
    .optional()
    .describe("End date filter in YYYY-MM-DD format"),
})

type UsGovDataParams = z.infer<typeof usGovDataSchema>

// ============================================================================
// TIMEOUT HELPER
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

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "N/A"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "N/A"

  if (Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(2)}T`
  if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
  if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
  if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

function formatDate(dateStr: string | null | undefined): string {
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

// ============================================================================
// USASPENDING API
// ============================================================================

/**
 * Award type code groups - USAspending API requires codes from only ONE group per request
 * Based on API error response which defines these exact groups
 */
const AWARD_TYPE_GROUPS: Record<string, { codes: string[]; label: string }> = {
  contracts: {
    codes: ["A", "B", "C", "D"],
    label: "Contracts",
  },
  idvs: {
    codes: ["IDV_A", "IDV_B", "IDV_B_A", "IDV_B_B", "IDV_B_C", "IDV_C", "IDV_D", "IDV_E"],
    label: "Indefinite Delivery Vehicles",
  },
  grants: {
    codes: ["02", "03", "04", "05"],
    label: "Grants",
  },
  loans: {
    codes: ["07", "08"],
    label: "Loans",
  },
  other_financial_assistance: {
    codes: ["06", "10"],
    label: "Other Financial Assistance",
  },
  direct_payments: {
    codes: ["09", "11", "-1"],
    label: "Direct Payments",
  },
}

/**
 * Make a single USAspending API request for a specific award type group
 */
async function fetchUsaspendingByGroup(
  query: string,
  awardTypeCodes: string[],
  groupLabel: string,
  options: {
    agency?: string
    startDate?: string
    endDate?: string
    limit: number
  }
): Promise<{ awards: UsaspendingAward[]; total: number; error?: string }> {
  const { agency, startDate, endDate, limit } = options

  try {
    const requestBody: Record<string, unknown> = {
      filters: {
        recipient_search_text: [query],
        award_type_codes: awardTypeCodes,
        ...(agency && { agencies: [{ type: "awarding", tier: "toptier", name: agency }] }),
        ...(startDate && endDate && {
          time_period: [{ start_date: startDate, end_date: endDate }],
        }),
      },
      fields: [
        "Award ID",
        "Recipient Name",
        "Award Amount",
        "Total Outlays",
        "Description",
        "Award Type",
        "Awarding Agency",
        "Awarding Sub Agency",
        "Start Date",
        "End Date",
      ],
      page: 1,
      limit,
      sort: "Award Amount",
      order: "desc",
    }

    const response = await withTimeout(
      fetch(`${US_GOV_API_URLS.USASPENDING}/search/spending_by_award/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
      }),
      US_GOV_DEFAULTS.timeoutMs,
      `USAspending ${groupLabel} request timed out`
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[USAspending] ${groupLabel} API error:`, response.status, errorText)
      return { awards: [], total: 0, error: `${groupLabel}: ${response.status}` }
    }

    const data = await response.json()
    const awards: UsaspendingAward[] = data.results || []
    const total = data.page_metadata?.total || awards.length

    console.log(`[USAspending] ${groupLabel}: ${awards.length} awards (${total} total)`)
    return { awards, total }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`[USAspending] ${groupLabel} fetch failed:`, errorMessage)
    return { awards: [], total: 0, error: `${groupLabel}: ${errorMessage}` }
  }
}

async function searchUsaspending(params: UsGovDataParams): Promise<UsGovDataResult> {
  const { query, awardType, agency, limit, startDate, endDate } = params
  console.log("[USAspending] Searching for:", query, "type:", awardType)
  const startTime = Date.now()

  try {
    const requestLimit = Math.min(limit || US_GOV_DEFAULTS.limit, 50)
    const options = { agency, startDate, endDate, limit: requestLimit }

    let allAwards: UsaspendingAward[] = []
    let totalCount = 0
    const errors: string[] = []

    if (awardType === "all") {
      // Make parallel API calls to all groups
      console.log("[USAspending] Fetching all award types in parallel...")

      const groupPromises = Object.entries(AWARD_TYPE_GROUPS).map(([key, group]) =>
        fetchUsaspendingByGroup(query, group.codes, group.label, options)
      )

      const results = await Promise.all(groupPromises)

      // Merge results
      for (const result of results) {
        if (result.error) {
          errors.push(result.error)
        }
        allAwards.push(...result.awards)
        totalCount += result.total
      }

      // Sort merged results by Award Amount (descending) and take top N
      allAwards.sort((a, b) => (b.Award_Amount || 0) - (a.Award_Amount || 0))
      allAwards = allAwards.slice(0, requestLimit)
    } else {
      // Single group request
      const group = AWARD_TYPE_GROUPS[awardType]
      if (!group) {
        return {
          dataSource: "usaspending",
          query,
          results: [],
          totalCount: 0,
          rawContent: `Unknown award type: ${awardType}. Valid types: ${Object.keys(AWARD_TYPE_GROUPS).join(", ")}, all`,
          sources: [],
          error: `Unknown award type: ${awardType}`,
        }
      }

      const result = await fetchUsaspendingByGroup(query, group.codes, group.label, options)
      allAwards = result.awards
      totalCount = result.total
      if (result.error) {
        errors.push(result.error)
      }
    }

    const duration = Date.now() - startTime
    console.log("[USAspending] Total:", allAwards.length, "awards retrieved in", duration, "ms")

    // If all requests failed, return error
    if (allAwards.length === 0 && errors.length > 0) {
      return {
        dataSource: "usaspending",
        query,
        results: [],
        totalCount: 0,
        rawContent: `Failed to search USAspending for "${query}": ${errors.join("; ")}`,
        sources: [],
        error: errors.join("; "),
      }
    }

    // Calculate totals
    const totalAmount = allAwards.reduce((sum, a) => sum + (a.Award_Amount || 0), 0)

    // Group by award type for display
    const byType: Record<string, UsaspendingAward[]> = {}
    allAwards.forEach((a) => {
      const type = a.Award_Type || "Unknown"
      if (!byType[type]) byType[type] = []
      byType[type].push(a)
    })

    // Generate raw content for AI
    const lines: string[] = [
      `# USAspending: Federal Awards for "${query}"`,
      "",
      `**Total Awards Found:** ${totalCount.toLocaleString()}`,
      `**Total Award Amount:** ${formatCurrency(totalAmount)}`,
      `**Showing:** ${allAwards.length} results`,
    ]

    if (awardType === "all") {
      lines.push(`**Search Type:** All award types (parallel search across ${Object.keys(AWARD_TYPE_GROUPS).length} categories)`)
    }

    if (errors.length > 0) {
      lines.push(`**Partial Results:** Some categories had errors: ${errors.join("; ")}`)
    }

    lines.push("")
    lines.push("---")
    lines.push("")

    // Group by award type
    Object.entries(byType).forEach(([type, typeAwards]) => {
      const typeTotal = typeAwards.reduce((sum, a) => sum + (a.Award_Amount || 0), 0)
      lines.push(`## ${type} (${typeAwards.length} awards, ${formatCurrency(typeTotal)})`)
      lines.push("")

      typeAwards.forEach((award) => {
        lines.push(`### ${formatCurrency(award.Award_Amount)} - ${award.Awarding_Agency || "Unknown Agency"}`)
        lines.push(`- **Award ID:** ${award.Award_ID}`)
        lines.push(`- **Recipient:** ${award.Recipient_Name}`)
        lines.push(`- **Agency:** ${award.Awarding_Agency}${award.Awarding_Sub_Agency ? ` / ${award.Awarding_Sub_Agency}` : ""}`)
        if (award.Description) {
          lines.push(`- **Description:** ${award.Description.substring(0, 200)}${award.Description.length > 200 ? "..." : ""}`)
        }
        lines.push(`- **Period:** ${formatDate(award.Start_Date)} - ${formatDate(award.End_Date)}`)
        if (award.Total_Outlays) {
          lines.push(`- **Total Outlays:** ${formatCurrency(award.Total_Outlays)}`)
        }
        lines.push("")
      })
    })

    // Add prospect research summary
    lines.push("## Summary for Prospect Research")
    lines.push("")
    if (totalAmount >= 10000000) {
      lines.push("**Federal Funding Level:** HIGH - Major government contractor/grantee")
    } else if (totalAmount >= 1000000) {
      lines.push("**Federal Funding Level:** MODERATE - Significant federal funding recipient")
    } else if (totalAmount >= 100000) {
      lines.push("**Federal Funding Level:** EMERGING - Growing federal funding relationship")
    } else {
      lines.push("**Federal Funding Level:** LOW - Limited federal funding")
    }

    // Generate sources
    const sources: Array<{ name: string; url: string }> = [
      {
        name: `USAspending.gov - ${query}`,
        url: `https://www.usaspending.gov/search/?hash=${encodeURIComponent(query)}`,
      },
    ]

    return {
      dataSource: "usaspending",
      query,
      results: allAwards,
      totalCount,
      rawContent: lines.join("\n"),
      sources,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[USAspending] Search failed:", errorMessage)
    return {
      dataSource: "usaspending",
      query,
      results: [],
      totalCount: 0,
      rawContent: `Failed to search USAspending for "${query}": ${errorMessage}`,
      sources: [],
      error: errorMessage,
    }
  }
}

// ============================================================================
// TREASURY FISCAL DATA API
// ============================================================================

async function searchTreasury(params: UsGovDataParams): Promise<UsGovDataResult> {
  const { treasuryDataset, limit } = params
  const dataset = treasuryDataset || "debt_to_penny"
  console.log("[Treasury] Fetching dataset:", dataset)
  const startTime = Date.now()

  try {
    let endpoint = ""
    let fields = ""

    switch (dataset) {
      case "debt_to_penny":
        endpoint = "/accounting/od/debt_to_penny"
        fields = "record_date,debt_held_public_amt,intragov_hold_amt,tot_pub_debt_out_amt"
        break
      case "treasury_statement":
        endpoint = "/accounting/mts/mts_table_4"
        fields = "record_date,record_fiscal_year,record_fiscal_quarter,record_calendar_month,receipts_mtd_amt,outlays_mtd_amt,surplus_deficit_mtd_amt"
        break
      case "interest_rates":
        endpoint = "/avg_interest_rates"
        fields = "record_date,security_desc,avg_interest_rate_amt"
        break
    }

    const queryParams = new URLSearchParams({
      fields,
      sort: "-record_date",
      page_size: Math.min(limit || US_GOV_DEFAULTS.limit, 50).toString(),
      format: "json",
    })

    const response = await withTimeout(
      fetch(`${US_GOV_API_URLS.TREASURY}${endpoint}?${queryParams}`, {
        headers: { Accept: "application/json" },
      }),
      US_GOV_DEFAULTS.timeoutMs,
      `Treasury API request timed out after ${US_GOV_DEFAULTS.timeoutMs / 1000} seconds`
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Treasury API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const duration = Date.now() - startTime
    console.log("[Treasury] Retrieved", data.data?.length || 0, "records in", duration, "ms")

    const records = data.data || []
    const totalCount = data.meta?.total_count || records.length

    // Generate raw content based on dataset type
    const lines: string[] = []

    if (dataset === "debt_to_penny") {
      const debtRecords = records as TreasuryDebtRecord[]
      lines.push("# US Treasury: National Debt (Debt to the Penny)")
      lines.push("")
      lines.push(`**Records Retrieved:** ${debtRecords.length}`)
      lines.push("")

      if (debtRecords.length > 0) {
        const latest = debtRecords[0]
        lines.push("## Current National Debt")
        lines.push("")
        lines.push(`**As of:** ${formatDate(latest.record_date)}`)
        lines.push(`- **Total Public Debt:** ${formatCurrency(latest.tot_pub_debt_out_amt)}`)
        lines.push(`- **Debt Held by Public:** ${formatCurrency(latest.debt_held_public_amt)}`)
        lines.push(`- **Intragovernmental Holdings:** ${formatCurrency(latest.intragov_hold_amt)}`)
        lines.push("")

        // Show trend
        if (debtRecords.length > 1) {
          lines.push("## Recent Trend")
          lines.push("")
          lines.push("| Date | Total Debt | Debt Held by Public |")
          lines.push("|------|------------|---------------------|")
          debtRecords.slice(0, 10).forEach((r) => {
            lines.push(`| ${formatDate(r.record_date)} | ${formatCurrency(r.tot_pub_debt_out_amt)} | ${formatCurrency(r.debt_held_public_amt)} |`)
          })
        }
      }
    } else if (dataset === "treasury_statement") {
      const stmtRecords = records as TreasuryStatementRecord[]
      lines.push("# US Treasury: Monthly Treasury Statement")
      lines.push("")
      lines.push(`**Records Retrieved:** ${stmtRecords.length}`)
      lines.push("")

      if (stmtRecords.length > 0) {
        const latest = stmtRecords[0]
        lines.push("## Latest Data")
        lines.push("")
        lines.push(`**Period:** FY${latest.record_fiscal_year} Q${latest.record_fiscal_quarter}`)
        lines.push(`- **Receipts (MTD):** ${formatCurrency(latest.receipts_mtd_amt)}`)
        lines.push(`- **Outlays (MTD):** ${formatCurrency(latest.outlays_mtd_amt)}`)
        lines.push(`- **Surplus/Deficit (MTD):** ${formatCurrency(latest.surplus_deficit_mtd_amt)}`)
        lines.push("")

        if (stmtRecords.length > 1) {
          lines.push("## Recent History")
          lines.push("")
          lines.push("| Date | Receipts | Outlays | Surplus/Deficit |")
          lines.push("|------|----------|---------|-----------------|")
          stmtRecords.slice(0, 10).forEach((r) => {
            lines.push(`| ${formatDate(r.record_date)} | ${formatCurrency(r.receipts_mtd_amt)} | ${formatCurrency(r.outlays_mtd_amt)} | ${formatCurrency(r.surplus_deficit_mtd_amt)} |`)
          })
        }
      }
    } else if (dataset === "interest_rates") {
      const rateRecords = records as TreasuryInterestRecord[]
      lines.push("# US Treasury: Average Interest Rates")
      lines.push("")
      lines.push(`**Records Retrieved:** ${rateRecords.length}`)
      lines.push("")

      if (rateRecords.length > 0) {
        lines.push("## Current Rates by Security Type")
        lines.push("")
        lines.push("| Date | Security | Rate |")
        lines.push("|------|----------|------|")
        rateRecords.slice(0, 20).forEach((r) => {
          lines.push(`| ${formatDate(r.record_date)} | ${r.security_desc} | ${r.avg_interest_rate_amt}% |`)
        })
      }
    }

    const sources: Array<{ name: string; url: string }> = [
      {
        name: "Treasury Fiscal Data",
        url: "https://fiscaldata.treasury.gov/",
      },
    ]

    return {
      dataSource: "treasury",
      query: dataset,
      results: records,
      totalCount,
      rawContent: lines.join("\n"),
      sources,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Treasury] Fetch failed:", errorMessage)
    return {
      dataSource: "treasury",
      query: dataset,
      results: [],
      totalCount: 0,
      rawContent: `Failed to fetch Treasury data (${dataset}): ${errorMessage}`,
      sources: [],
      error: errorMessage,
    }
  }
}

// ============================================================================
// FEDERAL REGISTER API
// ============================================================================

async function searchFederalRegister(params: UsGovDataParams): Promise<UsGovDataResult> {
  const { query, documentType, limit, startDate, endDate } = params
  console.log("[Federal Register] Searching for:", query, "type:", documentType)
  const startTime = Date.now()

  try {
    const queryParams = new URLSearchParams({
      per_page: Math.min(limit || US_GOV_DEFAULTS.limit, 50).toString(),
      order: "relevance",
    })

    // Add search terms
    if (query && query !== "current") {
      queryParams.append("conditions[term]", query)
    }

    // Add document type filter
    if (documentType) {
      const typeMap: Record<FederalRegisterDocType, string> = {
        rule: "RULE",
        proposed_rule: "PRORULE",
        notice: "NOTICE",
        presidential_document: "PRESDOCU",
      }
      queryParams.append("conditions[type][]", typeMap[documentType])
    }

    // Add date filters
    if (startDate) {
      queryParams.append("conditions[publication_date][gte]", startDate)
    }
    if (endDate) {
      queryParams.append("conditions[publication_date][lte]", endDate)
    }

    const response = await withTimeout(
      fetch(`${US_GOV_API_URLS.FEDERAL_REGISTER}/documents.json?${queryParams}`, {
        headers: { Accept: "application/json" },
      }),
      US_GOV_DEFAULTS.timeoutMs,
      `Federal Register request timed out after ${US_GOV_DEFAULTS.timeoutMs / 1000} seconds`
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Federal Register API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const duration = Date.now() - startTime
    console.log("[Federal Register] Retrieved", data.results?.length || 0, "documents in", duration, "ms")

    const documents: FederalRegisterDocument[] = data.results || []
    const totalCount = data.count || documents.length

    // Group by document type
    const byType: Record<string, FederalRegisterDocument[]> = {}
    documents.forEach((doc) => {
      const type = doc.type || "Unknown"
      if (!byType[type]) byType[type] = []
      byType[type].push(doc)
    })

    // Generate raw content
    const lines: string[] = [
      `# Federal Register: "${query}"`,
      "",
      `**Total Documents Found:** ${totalCount.toLocaleString()}`,
      `**Showing:** ${documents.length} results`,
      "",
      "---",
      "",
    ]

    Object.entries(byType).forEach(([type, typeDocs]) => {
      lines.push(`## ${type} (${typeDocs.length} documents)`)
      lines.push("")

      typeDocs.forEach((doc) => {
        lines.push(`### ${doc.title}`)
        lines.push(`- **Document #:** ${doc.document_number}`)
        lines.push(`- **Published:** ${formatDate(doc.publication_date)}`)
        if (doc.agencies?.length > 0) {
          lines.push(`- **Agency:** ${doc.agencies.map((a) => a.name).join(", ")}`)
        }
        if (doc.abstract) {
          lines.push(`- **Abstract:** ${doc.abstract.substring(0, 300)}${doc.abstract.length > 300 ? "..." : ""}`)
        }
        if (doc.action) {
          lines.push(`- **Action:** ${doc.action}`)
        }
        if (doc.effective_on) {
          lines.push(`- **Effective Date:** ${formatDate(doc.effective_on)}`)
        }
        if (doc.comments_close_on) {
          lines.push(`- **Comments Close:** ${formatDate(doc.comments_close_on)}`)
        }
        lines.push(`- **URL:** ${doc.html_url}`)
        lines.push("")
      })
    })

    // Generate sources
    const sources: Array<{ name: string; url: string }> = [
      {
        name: `Federal Register - ${query}`,
        url: `https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=${encodeURIComponent(query)}`,
      },
    ]

    // Add document-specific sources
    documents.slice(0, 5).forEach((doc) => {
      if (doc.html_url) {
        sources.push({
          name: doc.title.substring(0, 50) + (doc.title.length > 50 ? "..." : ""),
          url: doc.html_url,
        })
      }
    })

    return {
      dataSource: "federal_register",
      query,
      results: documents,
      totalCount,
      rawContent: lines.join("\n"),
      sources,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Federal Register] Search failed:", errorMessage)
    return {
      dataSource: "federal_register",
      query,
      results: [],
      totalCount: 0,
      rawContent: `Failed to search Federal Register for "${query}": ${errorMessage}`,
      sources: [],
      error: errorMessage,
    }
  }
}

// ============================================================================
// MAIN TOOL
// ============================================================================

/**
 * Unified US Government Data Tool
 * Routes queries to appropriate government API based on dataSource parameter
 */
export const usGovDataTool = tool({
  description:
    "Search US Government data including federal contracts/grants (USAspending), " +
    "national debt and treasury data (Treasury Fiscal Data), and regulations/rules (Federal Register). " +
    "All APIs are free and don't require API keys. " +
    "Use dataSource='usaspending' for federal contracts, grants, loans - great for prospect research. " +
    "Use dataSource='treasury' for national debt and government financial data. " +
    "Use dataSource='federal_register' for regulations, proposed rules, and agency notices.",
  parameters: usGovDataSchema,
  execute: async (params: UsGovDataParams): Promise<UsGovDataResult> => {
    console.log("[US Gov Data] Request:", params.dataSource, "query:", params.query)

    switch (params.dataSource) {
      case "usaspending":
        return await searchUsaspending(params)
      case "treasury":
        return await searchTreasury(params)
      case "federal_register":
        return await searchFederalRegister(params)
      default:
        return {
          dataSource: params.dataSource,
          query: params.query,
          results: [],
          totalCount: 0,
          rawContent: `Unknown data source: ${params.dataSource}. Use 'usaspending', 'treasury', or 'federal_register'.`,
          sources: [],
          error: `Unknown data source: ${params.dataSource}`,
        }
    }
  },
})

/**
 * Check if US Government Data tools should be enabled
 * Always returns true since these APIs don't require API keys
 */
export function shouldEnableUsGovDataTools(): boolean {
  return true
}
