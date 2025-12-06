/**
 * ProPublica Nonprofit Explorer Tool
 * Provides nonprofit organization search and Form 990 filing data.
 *
 * API Reference: https://projects.propublica.org/nonprofits/api
 *
 * Features:
 * - Search 1.8M+ nonprofits by name, state, and category
 * - Access Form 990 financial data (revenue, expenses, assets)
 * - No API key required (free public API)
 * - Links to full 990 PDFs and GuideStar profiles
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// CONSTANTS
// ============================================================================

const PROPUBLICA_API_BASE = "https://projects.propublica.org/nonprofits/api/v2"
const PROPUBLICA_TIMEOUT_MS = 15000

/**
 * NTEE (National Taxonomy of Exempt Entities) Categories
 * Used to filter nonprofits by their primary purpose
 */
const NTEE_CATEGORIES = {
  1: "Arts, Culture & Humanities",
  2: "Education",
  3: "Environment & Animals",
  4: "Health",
  5: "Human Services",
  6: "International, Foreign Affairs",
  7: "Public, Societal Benefit",
  8: "Religion Related",
  9: "Mutual/Membership Benefit",
  10: "Unknown/Unclassified",
} as const

/**
 * Common 501(c) tax codes
 */
const TAX_CODES = {
  3: "501(c)(3) - Charitable, Religious, Educational",
  4: "501(c)(4) - Social Welfare",
  5: "501(c)(5) - Labor, Agricultural Organizations",
  6: "501(c)(6) - Business Leagues, Chambers of Commerce",
  7: "501(c)(7) - Social and Recreation Clubs",
} as const

// ============================================================================
// SCHEMAS
// ============================================================================

const nonprofitSearchSchema = z.object({
  query: z
    .string()
    .describe("Search term - nonprofit name, city, or keyword. Use quotes for exact phrases."),
  state: z
    .string()
    .optional()
    .describe("Two-letter state code (e.g., 'CA', 'NY', 'TX'). Use 'ZZ' for international."),
  nteeCategory: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .describe("NTEE category (1=Arts, 2=Education, 3=Environment, 4=Health, 5=Human Services, 6=International, 7=Public Benefit, 8=Religion, 9=Membership, 10=Unknown)"),
  page: z
    .number()
    .optional()
    .default(0)
    .describe("Page number (0-indexed) for pagination"),
})

const nonprofitDetailsSchema = z.object({
  ein: z
    .string()
    .describe("Employer Identification Number (EIN) - 9 digits, with or without hyphen (e.g., '14-2007220' or '142007220')"),
})

// ============================================================================
// TYPES
// ============================================================================

interface ProPublicaOrganization {
  ein: number
  strein: string
  name: string
  address?: string
  city?: string
  state?: string
  zipcode?: string
  ntee_code?: string
  subseccd?: number
  have_filings?: boolean
  have_extracts?: boolean
  have_pdfs?: boolean
}

interface ProPublicaFiling {
  ein: number
  tax_prd: number
  tax_prd_yr: number
  formtype: number
  pdf_url?: string
  updated?: string
  // Financial data
  totrevenue?: number
  totfuncexpns?: number
  totassetsend?: number
  totliabend?: number
  pct_compnsatncurrofcr?: number
}

interface ProPublicaSearchResponse {
  total_results: number
  num_pages: number
  cur_page: number
  per_page: number
  organizations: ProPublicaOrganization[]
}

interface ProPublicaOrgResponse {
  organization: ProPublicaOrganization & {
    guidestar_url?: string
  }
  filings_with_data: ProPublicaFiling[]
  filings_without_data: ProPublicaFiling[]
}

export interface NonprofitSearchResult {
  totalResults: number
  page: number
  totalPages: number
  organizations: Array<{
    ein: string
    name: string
    city?: string
    state?: string
    nteeCode?: string
    taxCode?: string
    hasFilings: boolean
  }>
  query: string
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

export interface NonprofitDetailsResult {
  ein: string
  name: string
  address?: string
  city?: string
  state?: string
  zipcode?: string
  nteeCode?: string
  taxCode?: string
  guidestarUrl?: string
  filings: Array<{
    year: number
    formType: string
    revenue?: number
    expenses?: number
    assets?: number
    liabilities?: number
    officerCompensationPercent?: number
    pdfUrl?: string
  }>
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// HELPERS
// ============================================================================

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

function formatEin(ein: string | number): string {
  const einStr = String(ein).replace(/-/g, "").padStart(9, "0")
  return `${einStr.slice(0, 2)}-${einStr.slice(2)}`
}

function getFormTypeName(formtype: number): string {
  switch (formtype) {
    case 0: return "Form 990"
    case 1: return "Form 990-EZ"
    case 2: return "Form 990-PF"
    default: return `Form ${formtype}`
  }
}

function getTaxCodeDescription(subseccd?: number): string | undefined {
  if (!subseccd) return undefined
  return TAX_CODES[subseccd as keyof typeof TAX_CODES] || `501(c)(${subseccd})`
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return "N/A"
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}

function getNteeDescription(nteeCode?: string): string {
  if (!nteeCode) return "Unknown"
  const categoryNum = parseInt(nteeCode.charAt(0), 10)
  if (categoryNum >= 1 && categoryNum <= 10) {
    return NTEE_CATEGORIES[categoryNum as keyof typeof NTEE_CATEGORIES] || nteeCode
  }
  return nteeCode
}

/**
 * Format search results for AI consumption
 */
function formatSearchResultsForAI(
  organizations: ProPublicaOrganization[],
  query: string,
  totalResults: number
): string {
  if (organizations.length === 0) {
    return `# ProPublica Nonprofit Search: "${query}"\n\n**No results found.**\n\nThis search only matches organization names, not people. If searching for a person's nonprofit affiliations, try:\n1. Search for their foundation name (e.g., "Smith Family Foundation")\n2. Search for organizations they might be affiliated with\n3. Use web search first to discover their nonprofit connections`
  }

  const lines: string[] = [
    `# ProPublica Nonprofit Search: "${query}"`,
    "",
    `**Total Results:** ${totalResults.toLocaleString()}`,
    `**Showing:** ${organizations.length} organizations`,
    "",
    "---",
    "",
  ]

  organizations.forEach((org, index) => {
    const location = [org.city, org.state].filter(Boolean).join(", ")
    lines.push(`## ${index + 1}. ${org.name}`)
    lines.push(`- **EIN:** ${formatEin(org.ein)}`)
    if (location) lines.push(`- **Location:** ${location}`)
    if (org.ntee_code) lines.push(`- **Category:** ${getNteeDescription(org.ntee_code)} (${org.ntee_code})`)
    const taxCode = getTaxCodeDescription(org.subseccd)
    if (taxCode) lines.push(`- **Tax Status:** ${taxCode}`)
    lines.push(`- **Has 990 Filings:** ${org.have_filings || org.have_extracts ? "Yes" : "No"}`)
    lines.push("")
  })

  lines.push("---")
  lines.push("")
  lines.push("**Next Steps:** Use `propublica_nonprofit_details` with an EIN to get full 990 financial data.")

  return lines.join("\n")
}

/**
 * Format organization details for AI consumption
 */
function formatDetailsForAI(
  org: ProPublicaOrganization & { guidestar_url?: string },
  filings: ProPublicaFiling[]
): string {
  const lines: string[] = [
    `# ${org.name}`,
    "",
    `**EIN:** ${formatEin(org.ein)}`,
  ]

  const location = [org.address, org.city, org.state, org.zipcode].filter(Boolean).join(", ")
  if (location) lines.push(`**Address:** ${location}`)

  if (org.ntee_code) lines.push(`**Category:** ${getNteeDescription(org.ntee_code)} (${org.ntee_code})`)
  const taxCode = getTaxCodeDescription(org.subseccd)
  if (taxCode) lines.push(`**Tax Status:** ${taxCode}`)

  lines.push("")
  lines.push("---")
  lines.push("")

  if (filings.length === 0) {
    lines.push("## Financial Data")
    lines.push("")
    lines.push("*No Form 990 filings available for this organization.*")
  } else {
    lines.push("## Form 990 Financial History")
    lines.push("")

    // Get most recent filing for summary
    const mostRecent = filings[0]
    if (mostRecent.totrevenue !== undefined || mostRecent.totassetsend !== undefined) {
      lines.push("### Most Recent Filing Summary")
      lines.push(`- **Year:** ${mostRecent.tax_prd_yr}`)
      if (mostRecent.totrevenue !== undefined) lines.push(`- **Total Revenue:** ${formatCurrency(mostRecent.totrevenue)}`)
      if (mostRecent.totfuncexpns !== undefined) lines.push(`- **Total Expenses:** ${formatCurrency(mostRecent.totfuncexpns)}`)
      if (mostRecent.totassetsend !== undefined) lines.push(`- **Total Assets:** ${formatCurrency(mostRecent.totassetsend)}`)
      if (mostRecent.totliabend !== undefined) lines.push(`- **Total Liabilities:** ${formatCurrency(mostRecent.totliabend)}`)
      if (mostRecent.pct_compnsatncurrofcr !== undefined) {
        lines.push(`- **Officer Compensation (% of expenses):** ${(mostRecent.pct_compnsatncurrofcr * 100).toFixed(1)}%`)
      }
      lines.push("")
    }

    lines.push("### Filing History")
    lines.push("")
    lines.push("| Year | Form | Revenue | Expenses | Assets |")
    lines.push("|------|------|---------|----------|--------|")

    filings.slice(0, 10).forEach((filing) => {
      const formType = getFormTypeName(filing.formtype)
      const revenue = formatCurrency(filing.totrevenue)
      const expenses = formatCurrency(filing.totfuncexpns)
      const assets = formatCurrency(filing.totassetsend)
      lines.push(`| ${filing.tax_prd_yr} | ${formType} | ${revenue} | ${expenses} | ${assets} |`)
    })

    lines.push("")
  }

  // Add prospect research insights
  if (filings.length > 0) {
    const recentFiling = filings[0]
    lines.push("## Prospect Research Insights")
    lines.push("")

    if (recentFiling.totassetsend !== undefined) {
      if (recentFiling.totassetsend >= 100000000) {
        lines.push("**Foundation Size:** MAJOR - Assets over $100M indicate significant giving capacity")
      } else if (recentFiling.totassetsend >= 10000000) {
        lines.push("**Foundation Size:** LARGE - Assets over $10M suggest substantial grant-making ability")
      } else if (recentFiling.totassetsend >= 1000000) {
        lines.push("**Foundation Size:** MEDIUM - Assets over $1M indicate active charitable work")
      } else {
        lines.push("**Foundation Size:** SMALL - Smaller foundation with limited assets")
      }
    }
  }

  return lines.join("\n")
}

// ============================================================================
// TOOLS
// ============================================================================

/**
 * Search for nonprofit organizations BY ORGANIZATION NAME (not person name)
 */
export const propublicaNonprofitSearchTool = tool({
  description:
    "Search for nonprofit organizations BY ORGANIZATION NAME in the ProPublica Nonprofit Explorer database. " +
    "IMPORTANT: This searches ORG NAMES only, NOT person names. To find a person's nonprofit affiliations: " +
    "(1) Use web search to find their nonprofit connections, (2) Then search here with the ORG NAME. " +
    "Returns EINs, locations, and 990 filing availability. Covers 1.8M+ tax-exempt organizations.",
  parameters: nonprofitSearchSchema,
  execute: async ({ query, state, nteeCategory, page }): Promise<NonprofitSearchResult> => {
    console.log("[ProPublica] Searching nonprofits:", { query, state, nteeCategory, page })
    const startTime = Date.now()

    try {
      const url = new URL(`${PROPUBLICA_API_BASE}/search.json`)
      url.searchParams.set("q", query)
      if (state) url.searchParams.set("state[id]", state.toUpperCase())
      if (nteeCategory) url.searchParams.set("ntee[id]", String(nteeCategory))
      if (page) url.searchParams.set("page", String(page))

      const response = await withTimeout(
        fetch(url.toString(), {
          headers: { Accept: "application/json" },
        }),
        PROPUBLICA_TIMEOUT_MS,
        `ProPublica search timed out after ${PROPUBLICA_TIMEOUT_MS / 1000} seconds`
      )

      // ProPublica returns 404 for zero results (unusual but valid)
      // We need to parse the response body even on 404
      if (!response.ok && response.status !== 404) {
        throw new Error(`ProPublica API error: ${response.status}`)
      }

      const data = await response.json() as ProPublicaSearchResponse

      const duration = Date.now() - startTime
      console.log("[ProPublica] Search completed in", duration, "ms, found", data.total_results, "results")

      const orgs = data.organizations || []
      const rawContent = formatSearchResultsForAI(orgs, query, data.total_results || 0)

      // Generate sources for UI display
      const sources: Array<{ name: string; url: string }> = [
        {
          name: `ProPublica Nonprofit Explorer - "${query}"`,
          url: `https://projects.propublica.org/nonprofits/search?q=${encodeURIComponent(query)}`,
        },
      ]

      // Add individual organization links
      orgs.slice(0, 5).forEach((org) => {
        sources.push({
          name: org.name,
          url: `https://projects.propublica.org/nonprofits/organizations/${org.ein}`,
        })
      })

      return {
        totalResults: data.total_results || 0,
        page: data.cur_page || 0,
        totalPages: data.num_pages || 0,
        organizations: orgs.slice(0, 20).map((org) => ({
          ein: formatEin(org.ein),
          name: org.name,
          city: org.city,
          state: org.state,
          nteeCode: org.ntee_code,
          taxCode: getTaxCodeDescription(org.subseccd),
          hasFilings: Boolean(org.have_filings || org.have_extracts),
        })),
        query,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[ProPublica] Search failed:", errorMessage)
      return {
        totalResults: 0,
        page: 0,
        totalPages: 0,
        organizations: [],
        query,
        rawContent: `# ProPublica Nonprofit Search: "${query}"\n\n**Error:** ${errorMessage}\n\nThis search only matches organization names, not people. If searching for a person's nonprofit affiliations, try:\n1. Search for their foundation name (e.g., "Smith Family Foundation")\n2. Search for organizations they might be affiliated with\n3. Use web search first to discover their nonprofit connections`,
        sources: [],
        error: `Failed to search nonprofits: ${errorMessage}`,
      }
    }
  },
})

/**
 * Get detailed nonprofit information and 990 filings
 */
export const propublicaNonprofitDetailsTool = tool({
  description:
    "Get detailed information about a nonprofit organization including Form 990 financial data. " +
    "Returns revenue, expenses, assets, liabilities, and officer compensation percentages. " +
    "Use this after finding an EIN via search to get full financial history. " +
    "Essential for researching foundation giving capacity and nonprofit financials.",
  parameters: nonprofitDetailsSchema,
  execute: async ({ ein }): Promise<NonprofitDetailsResult> => {
    // Clean EIN - remove hyphens and spaces
    const cleanEin = ein.replace(/[-\s]/g, "")
    console.log("[ProPublica] Getting nonprofit details for EIN:", cleanEin)
    const startTime = Date.now()

    try {
      const url = `${PROPUBLICA_API_BASE}/organizations/${cleanEin}.json`

      const response = await withTimeout(
        fetch(url, {
          headers: { Accept: "application/json" },
        }),
        PROPUBLICA_TIMEOUT_MS,
        `ProPublica details timed out after ${PROPUBLICA_TIMEOUT_MS / 1000} seconds`
      )

      if (!response.ok) {
        if (response.status === 404) {
          return {
            ein: formatEin(cleanEin),
            name: "Not Found",
            filings: [],
            rawContent: `# Nonprofit Not Found\n\n**EIN:** ${formatEin(cleanEin)}\n\nNo nonprofit organization found with this EIN in the ProPublica database.\n\nPossible reasons:\n- The EIN may be incorrect\n- The organization may not have filed Form 990\n- The organization may be very new or recently dissolved`,
            sources: [],
            error: `No nonprofit found with EIN ${formatEin(cleanEin)}`,
          }
        }
        throw new Error(`ProPublica API error: ${response.status}`)
      }

      const data = await response.json() as ProPublicaOrgResponse

      const duration = Date.now() - startTime
      console.log("[ProPublica] Details retrieved in", duration, "ms")

      const org = data.organization
      const allFilings = [...(data.filings_with_data || []), ...(data.filings_without_data || [])]
        .sort((a, b) => (b.tax_prd_yr || 0) - (a.tax_prd_yr || 0))

      const rawContent = formatDetailsForAI(org, allFilings)

      // Generate sources
      const sources: Array<{ name: string; url: string }> = [
        {
          name: `ProPublica - ${org.name}`,
          url: `https://projects.propublica.org/nonprofits/organizations/${cleanEin}`,
        },
      ]

      if (org.guidestar_url) {
        sources.push({
          name: `GuideStar - ${org.name}`,
          url: org.guidestar_url,
        })
      }

      // Add PDF links for recent filings
      allFilings.slice(0, 3).forEach((filing) => {
        if (filing.pdf_url) {
          sources.push({
            name: `Form 990 (${filing.tax_prd_yr})`,
            url: filing.pdf_url,
          })
        }
      })

      return {
        ein: formatEin(org.ein),
        name: org.name,
        address: org.address,
        city: org.city,
        state: org.state,
        zipcode: org.zipcode,
        nteeCode: org.ntee_code,
        taxCode: getTaxCodeDescription(org.subseccd),
        guidestarUrl: org.guidestar_url,
        filings: allFilings.slice(0, 10).map((filing) => ({
          year: filing.tax_prd_yr || Math.floor(filing.tax_prd / 100),
          formType: getFormTypeName(filing.formtype),
          revenue: filing.totrevenue,
          expenses: filing.totfuncexpns,
          assets: filing.totassetsend,
          liabilities: filing.totliabend,
          officerCompensationPercent: filing.pct_compnsatncurrofcr,
          pdfUrl: filing.pdf_url,
        })),
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[ProPublica] Details failed:", errorMessage)
      return {
        ein: formatEin(cleanEin),
        name: "Error",
        filings: [],
        rawContent: `# Error Loading Nonprofit\n\n**EIN:** ${formatEin(cleanEin)}\n\n**Error:** ${errorMessage}`,
        sources: [],
        error: `Failed to get nonprofit details: ${errorMessage}`,
      }
    }
  },
})

/**
 * ProPublica tools are always available (no API key required)
 */
export function shouldEnableProPublicaTools(): boolean {
  return true
}

/**
 * Export NTEE categories for reference
 */
export { NTEE_CATEGORIES, TAX_CODES }
