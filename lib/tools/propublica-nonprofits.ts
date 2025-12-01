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

// ============================================================================
// TOOLS
// ============================================================================

/**
 * Search for nonprofit organizations
 */
export const propublicaNonprofitSearchTool = tool({
  description:
    "Search for nonprofit organizations in the ProPublica Nonprofit Explorer database. " +
    "Returns organization names, EINs, locations, and whether they have 990 filings. " +
    "Use this to find foundation EINs, research charitable organizations, " +
    "and identify nonprofits a prospect may be affiliated with. " +
    "Covers 1.8M+ tax-exempt organizations.",
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

      if (!response.ok) {
        throw new Error(`ProPublica API error: ${response.status}`)
      }

      const data = await response.json() as ProPublicaSearchResponse

      const duration = Date.now() - startTime
      console.log("[ProPublica] Search completed in", duration, "ms, found", data.total_results, "results")

      return {
        totalResults: data.total_results,
        page: data.cur_page,
        totalPages: data.num_pages,
        organizations: data.organizations.slice(0, 20).map((org) => ({
          ein: formatEin(org.ein),
          name: org.name,
          city: org.city,
          state: org.state,
          nteeCode: org.ntee_code,
          taxCode: getTaxCodeDescription(org.subseccd),
          hasFilings: Boolean(org.have_filings || org.have_extracts),
        })),
        query,
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
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[ProPublica] Details failed:", errorMessage)
      return {
        ein: formatEin(cleanEin),
        name: "Error",
        filings: [],
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
