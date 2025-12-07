/**
 * OpenCorporates Tool
 * Provides company ownership, officers, and filing data for prospect research
 *
 * Uses OpenCorporates API - https://api.opencorporates.com/documentation/API-Reference
 * FREE: 100-200 requests/month without API key
 *
 * Key capabilities:
 * - Company search by name
 * - Officer/director lookup
 * - Company filings and status
 * - Cross-jurisdiction search
 */

import { tool } from "ai"
import { z } from "zod"
import {
  isOpenCorporatesEnabled,
  getOpenCorporatesApiKey,
  OPENCORPORATES_API_BASE_URL,
  OPENCORPORATES_DEFAULTS,
  US_JURISDICTION_CODES,
} from "@/lib/opencorporates/config"

// ============================================================================
// TYPES
// ============================================================================

interface OpenCorporatesCompany {
  name: string
  company_number: string
  jurisdiction_code: string
  incorporation_date: string | null
  dissolution_date: string | null
  company_type: string | null
  registry_url: string | null
  branch: string | null
  branch_status: string | null
  inactive: boolean
  current_status: string | null
  created_at: string
  updated_at: string
  retrieved_at: string
  opencorporates_url: string
  registered_address_in_full: string | null
  registered_address: {
    street_address: string | null
    locality: string | null
    region: string | null
    postal_code: string | null
    country: string | null
  } | null
  officers?: OpenCorporatesOfficer[]
  industry_codes?: Array<{
    code: string
    description: string
    code_scheme_name: string
  }>
}

interface OpenCorporatesOfficer {
  id: number
  name: string
  position: string
  start_date: string | null
  end_date: string | null
  occupation: string | null
  nationality: string | null
  current_status: string | null
  inactive: boolean
}

interface OpenCorporatesSearchResult {
  api_version: string
  results: {
    companies: Array<{
      company: OpenCorporatesCompany
    }>
    total_count: number
    total_pages: number
    page: number
    per_page: number
  }
}

interface OpenCorporatesOfficerSearchResult {
  api_version: string
  results: {
    officers: Array<{
      officer: {
        id: number
        name: string
        position: string
        start_date: string | null
        end_date: string | null
        occupation: string | null
        inactive: boolean
        current_status: string | null
        company: {
          name: string
          company_number: string
          jurisdiction_code: string
          opencorporates_url: string
        }
      }
    }>
    total_count: number
    total_pages: number
    page: number
    per_page: number
  }
}

export interface CompanySearchResult {
  query: string
  totalFound: number
  companies: Array<{
    name: string
    companyNumber: string
    jurisdiction: string
    status: string
    incorporationDate: string | null
    companyType: string | null
    registeredAddress: string | null
    inactive: boolean
    opencorporatesUrl: string
    registryUrl: string | null
    officers?: Array<{
      name: string
      position: string
      startDate: string | null
      endDate: string | null
      current: boolean
    }>
  }>
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

export interface OfficerSearchResult {
  query: string
  totalFound: number
  officers: Array<{
    name: string
    position: string
    companyName: string
    companyNumber: string
    jurisdiction: string
    startDate: string | null
    endDate: string | null
    current: boolean
    opencorporatesUrl: string
  }>
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// SCHEMAS
// ============================================================================

const companySearchSchema = z.object({
  companyName: z
    .string()
    .describe("Name of the company to search for (e.g., 'Apple Inc', 'Blackstone Group')"),
  jurisdiction: z
    .string()
    .optional()
    .describe("Two-letter US state code (e.g., 'DE', 'NY', 'CA') or country code"),
  includeInactive: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include inactive/dissolved companies in results"),
  includeOfficers: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include officer/director information (may use additional API calls)"),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of companies to return (default: 10, max: 30)"),
})

const officerSearchSchema = z.object({
  officerName: z
    .string()
    .describe("Name of the officer/director to search for (e.g., 'John Smith', 'Jane Doe')"),
  jurisdiction: z
    .string()
    .optional()
    .describe("Two-letter US state code (e.g., 'DE', 'NY', 'CA') or country code"),
  position: z
    .string()
    .optional()
    .describe("Filter by position (e.g., 'director', 'secretary', 'president')"),
  currentOnly: z
    .boolean()
    .optional()
    .default(true)
    .describe("Only show current (active) positions"),
  limit: z
    .number()
    .optional()
    .default(20)
    .describe("Maximum number of results to return (default: 20, max: 50)"),
})

// ============================================================================
// TIMEOUT HELPER
// ============================================================================

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getJurisdictionCode(state: string): string {
  const upper = state.toUpperCase()
  return US_JURISDICTION_CODES[upper] || state.toLowerCase()
}

function formatCompaniesForAI(
  companies: CompanySearchResult["companies"],
  query: string
): string {
  if (companies.length === 0) {
    return `No companies found matching "${query}" in OpenCorporates database.`
  }

  const lines: string[] = [
    `# OpenCorporates Company Search: "${query}"`,
    "",
    `**Total Companies Found:** ${companies.length}`,
    "",
    "---",
    "",
  ]

  companies.forEach((company, idx) => {
    lines.push(`## ${idx + 1}. ${company.name}`)
    lines.push("")
    lines.push(`- **Status:** ${company.status}${company.inactive ? " (INACTIVE)" : " (ACTIVE)"}`)
    lines.push(`- **Company Number:** ${company.companyNumber}`)
    lines.push(`- **Jurisdiction:** ${company.jurisdiction}`)
    if (company.companyType) {
      lines.push(`- **Type:** ${company.companyType}`)
    }
    if (company.incorporationDate) {
      lines.push(`- **Incorporated:** ${company.incorporationDate}`)
    }
    if (company.registeredAddress) {
      lines.push(`- **Registered Address:** ${company.registeredAddress}`)
    }
    lines.push(`- **OpenCorporates:** ${company.opencorporatesUrl}`)
    if (company.registryUrl) {
      lines.push(`- **Official Registry:** ${company.registryUrl}`)
    }

    if (company.officers && company.officers.length > 0) {
      lines.push("")
      lines.push("### Officers/Directors:")
      company.officers.forEach((officer) => {
        const status = officer.current ? "(Current)" : "(Former)"
        const dates = officer.startDate ? ` - Since ${officer.startDate}` : ""
        lines.push(`- **${officer.position}:** ${officer.name} ${status}${dates}`)
      })
    }

    lines.push("")
    lines.push("---")
    lines.push("")
  })

  // Add wealth research context
  lines.push("## Prospect Research Insights")
  lines.push("")

  const activeCompanies = companies.filter((c) => !c.inactive)
  const officerCount = companies.reduce((sum, c) => sum + (c.officers?.length || 0), 0)

  lines.push(`- **Active Companies:** ${activeCompanies.length}`)
  lines.push(`- **Total Officer Positions:** ${officerCount}`)

  if (activeCompanies.length >= 3) {
    lines.push("- **Wealth Indicator:** HIGH - Multiple active company affiliations suggest significant business involvement")
  } else if (activeCompanies.length >= 1) {
    lines.push("- **Wealth Indicator:** MODERATE - Active business ownership/involvement")
  }

  return lines.join("\n")
}

function formatOfficersForAI(
  officers: OfficerSearchResult["officers"],
  query: string
): string {
  if (officers.length === 0) {
    return `No officer/director positions found for "${query}" in OpenCorporates database.`
  }

  const lines: string[] = [
    `# OpenCorporates Officer Search: "${query}"`,
    "",
    `**Total Positions Found:** ${officers.length}`,
    "",
    "---",
    "",
  ]

  // Group by company
  const byCompany: Record<string, typeof officers> = {}
  officers.forEach((officer) => {
    const key = `${officer.companyName} (${officer.jurisdiction})`
    if (!byCompany[key]) byCompany[key] = []
    byCompany[key].push(officer)
  })

  Object.entries(byCompany).forEach(([companyKey, positions]) => {
    lines.push(`## ${companyKey}`)
    lines.push("")
    positions.forEach((pos) => {
      const status = pos.current ? "(Current)" : "(Former)"
      const dates = []
      if (pos.startDate) dates.push(`from ${pos.startDate}`)
      if (pos.endDate) dates.push(`to ${pos.endDate}`)
      const dateStr = dates.length > 0 ? ` - ${dates.join(" ")}` : ""
      lines.push(`- **${pos.position}** ${status}${dateStr}`)
    })
    lines.push(`- [View on OpenCorporates](${positions[0].opencorporatesUrl})`)
    lines.push("")
    lines.push("---")
    lines.push("")
  })

  // Summary
  lines.push("## Prospect Research Insights")
  lines.push("")

  const currentPositions = officers.filter((o) => o.current)
  const uniqueCompanies = new Set(officers.map((o) => o.companyName))

  lines.push(`- **Current Positions:** ${currentPositions.length}`)
  lines.push(`- **Total Companies:** ${uniqueCompanies.size}`)
  lines.push(`- **Total Positions (all time):** ${officers.length}`)

  if (currentPositions.length >= 3) {
    lines.push("- **Wealth Indicator:** HIGH - Multiple current directorships/officer roles indicate significant business involvement")
  } else if (currentPositions.length >= 1) {
    lines.push("- **Wealth Indicator:** MODERATE - Active corporate leadership role(s)")
  }

  return lines.join("\n")
}

// ============================================================================
// TOOLS
// ============================================================================

/**
 * Search for companies by name
 */
export const opencorporatesCompanySearchTool = tool({
  description:
    "Search OpenCorporates database for companies by name. Returns company details including " +
    "incorporation status, registered address, company type, and officer/director information. " +
    "Useful for verifying business ownership, finding affiliated companies, and researching " +
    "corporate structures. FREE API - no key required.",
  parameters: companySearchSchema,
  execute: async ({
    companyName,
    jurisdiction,
    includeInactive = false,
    includeOfficers = true,
    limit = 10,
  }): Promise<CompanySearchResult> => {
    console.log("[OpenCorporates] Searching companies:", companyName)
    const startTime = Date.now()

    if (!isOpenCorporatesEnabled()) {
      return {
        query: companyName,
        totalFound: 0,
        companies: [],
        rawContent: "OpenCorporates API is not available.",
        sources: [],
        error: "OpenCorporates not enabled",
      }
    }

    try {
      const apiKey = getOpenCorporatesApiKey()

      // Build query parameters
      const params = new URLSearchParams({
        q: companyName,
        per_page: Math.min(limit, 30).toString(),
        order: "score",
      })

      if (jurisdiction) {
        params.append("jurisdiction_code", getJurisdictionCode(jurisdiction))
      }
      if (!includeInactive) {
        params.append("inactive", "false")
      }
      if (apiKey) {
        params.append("api_token", apiKey)
      }

      const url = `${OPENCORPORATES_API_BASE_URL}/companies/search?${params.toString()}`

      const response = await withTimeout(
        fetch(url, {
          headers: { Accept: "application/json" },
        }),
        OPENCORPORATES_DEFAULTS.timeout,
        `OpenCorporates request timed out after ${OPENCORPORATES_DEFAULTS.timeout / 1000} seconds`
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenCorporates API error: ${response.status} - ${errorText}`)
      }

      const data: OpenCorporatesSearchResult = await response.json()

      const duration = Date.now() - startTime
      console.log("[OpenCorporates] Found", data.results?.companies?.length || 0, "companies in", duration, "ms")

      const companies: CompanySearchResult["companies"] = (data.results?.companies || []).map(
        ({ company }) => ({
          name: company.name,
          companyNumber: company.company_number,
          jurisdiction: company.jurisdiction_code,
          status: company.current_status || "Unknown",
          incorporationDate: company.incorporation_date,
          companyType: company.company_type,
          registeredAddress: company.registered_address_in_full ||
            (company.registered_address
              ? [
                  company.registered_address.street_address,
                  company.registered_address.locality,
                  company.registered_address.region,
                  company.registered_address.postal_code,
                  company.registered_address.country,
                ].filter(Boolean).join(", ")
              : null),
          inactive: company.inactive,
          opencorporatesUrl: company.opencorporates_url,
          registryUrl: company.registry_url,
        })
      )

      // Generate sources
      const sources: Array<{ name: string; url: string }> = [
        {
          name: `OpenCorporates - "${companyName}" Search`,
          url: `https://opencorporates.com/companies?q=${encodeURIComponent(companyName)}`,
        },
      ]

      companies.slice(0, 5).forEach((company) => {
        sources.push({
          name: `${company.name} - OpenCorporates`,
          url: company.opencorporatesUrl,
        })
        if (company.registryUrl) {
          sources.push({
            name: `${company.name} - Official Registry`,
            url: company.registryUrl,
          })
        }
      })

      const rawContent = formatCompaniesForAI(companies, companyName)

      return {
        query: companyName,
        totalFound: data.results?.total_count || 0,
        companies,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[OpenCorporates] Search failed:", errorMessage)

      // Format error nicely for UI display
      const errorContent = [
        `# OpenCorporates Company Search: "${companyName}"`,
        "",
        "## ⚠️ Search Unavailable",
        "",
        "The OpenCorporates company search could not be completed.",
        "",
        `**Error:** ${errorMessage}`,
        "",
        "---",
        "",
        "### How to Enable OpenCorporates",
        "",
        "OpenCorporates offers **FREE** access (200 requests/month) with an API key:",
        "",
        "1. **Get a FREE API key** at [opencorporates.com/api_accounts/new](https://opencorporates.com/api_accounts/new)",
        "2. Add to your `.env.local` file:",
        "   ```",
        "   OPENCORPORATES_API_KEY=your_api_key_here",
        "   ```",
        "3. Restart the application",
        "",
        "### What OpenCorporates Provides",
        "",
        "- **Company Registry Data** from 140+ jurisdictions",
        "- **Officer/Director Searches** to find business affiliations",
        "- **Corporate Filings** and status information",
        "- **Cross-reference** business ownership for prospect research",
        "",
        "### Manual Search",
        "",
        `You can manually search at: [OpenCorporates](https://opencorporates.com/companies?q=${encodeURIComponent(companyName)})`,
      ].join("\n")

      return {
        query: companyName,
        totalFound: 0,
        companies: [],
        rawContent: errorContent,
        sources: [
          {
            name: "OpenCorporates - Manual Search",
            url: `https://opencorporates.com/companies?q=${encodeURIComponent(companyName)}`,
          },
          {
            name: "OpenCorporates - Get API Key",
            url: "https://opencorporates.com/api_accounts/new",
          },
        ],
        error: errorMessage,
      }
    }
  },
})

/**
 * Search for officers/directors by name
 */
export const opencorporatesOfficerSearchTool = tool({
  description:
    "Search OpenCorporates for officer/director positions held by a person. Returns all companies " +
    "where the person serves as officer, director, secretary, president, or other corporate role. " +
    "Essential for prospect research to discover business affiliations and corporate board seats. " +
    "FREE API - no key required.",
  parameters: officerSearchSchema,
  execute: async ({
    officerName,
    jurisdiction,
    position,
    currentOnly = true,
    limit = 20,
  }): Promise<OfficerSearchResult> => {
    console.log("[OpenCorporates] Searching officer positions:", officerName)
    const startTime = Date.now()

    if (!isOpenCorporatesEnabled()) {
      return {
        query: officerName,
        totalFound: 0,
        officers: [],
        rawContent: "OpenCorporates API is not available.",
        sources: [],
        error: "OpenCorporates not enabled",
      }
    }

    try {
      const apiKey = getOpenCorporatesApiKey()

      // Build query parameters
      const params = new URLSearchParams({
        q: officerName,
        per_page: Math.min(limit, 50).toString(),
        order: "score",
      })

      if (jurisdiction) {
        params.append("jurisdiction_code", getJurisdictionCode(jurisdiction))
      }
      if (position) {
        params.append("position", position)
      }
      if (currentOnly) {
        params.append("inactive", "false")
      }
      if (apiKey) {
        params.append("api_token", apiKey)
      }

      const url = `${OPENCORPORATES_API_BASE_URL}/officers/search?${params.toString()}`

      const response = await withTimeout(
        fetch(url, {
          headers: { Accept: "application/json" },
        }),
        OPENCORPORATES_DEFAULTS.timeout,
        `OpenCorporates request timed out after ${OPENCORPORATES_DEFAULTS.timeout / 1000} seconds`
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenCorporates API error: ${response.status} - ${errorText}`)
      }

      const data: OpenCorporatesOfficerSearchResult = await response.json()

      const duration = Date.now() - startTime
      console.log("[OpenCorporates] Found", data.results?.officers?.length || 0, "officer positions in", duration, "ms")

      const officers: OfficerSearchResult["officers"] = (data.results?.officers || []).map(
        ({ officer }) => ({
          name: officer.name,
          position: officer.position,
          companyName: officer.company.name,
          companyNumber: officer.company.company_number,
          jurisdiction: officer.company.jurisdiction_code,
          startDate: officer.start_date,
          endDate: officer.end_date,
          current: !officer.inactive && !officer.end_date,
          opencorporatesUrl: officer.company.opencorporates_url,
        })
      )

      // Generate sources
      const sources: Array<{ name: string; url: string }> = [
        {
          name: `OpenCorporates - "${officerName}" Officer Search`,
          url: `https://opencorporates.com/officers?q=${encodeURIComponent(officerName)}`,
        },
      ]

      // Add unique company URLs
      const seenUrls = new Set<string>()
      officers.slice(0, 10).forEach((officer) => {
        if (!seenUrls.has(officer.opencorporatesUrl)) {
          sources.push({
            name: `${officer.companyName} - OpenCorporates`,
            url: officer.opencorporatesUrl,
          })
          seenUrls.add(officer.opencorporatesUrl)
        }
      })

      const rawContent = formatOfficersForAI(officers, officerName)

      return {
        query: officerName,
        totalFound: data.results?.total_count || 0,
        officers,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[OpenCorporates] Officer search failed:", errorMessage)

      // Format error nicely for UI display
      const errorContent = [
        `# OpenCorporates Officer Search: "${officerName}"`,
        "",
        "## ⚠️ Search Unavailable",
        "",
        "The OpenCorporates officer search could not be completed.",
        "",
        `**Error:** ${errorMessage}`,
        "",
        "---",
        "",
        "### How to Enable OpenCorporates",
        "",
        "OpenCorporates offers **FREE** access (200 requests/month) with an API key:",
        "",
        "1. **Get a FREE API key** at [opencorporates.com/api_accounts/new](https://opencorporates.com/api_accounts/new)",
        "2. Add to your `.env.local` file:",
        "   ```",
        "   OPENCORPORATES_API_KEY=your_api_key_here",
        "   ```",
        "3. Restart the application",
        "",
        "### What OpenCorporates Officer Search Provides",
        "",
        "- **Business Affiliations** - Find all companies where a person is an officer",
        "- **Board Positions** - Director, secretary, president roles",
        "- **Corporate History** - Current and former positions",
        "- **Wealth Indicator** - Multiple directorships indicate business involvement",
        "",
        "### Manual Search",
        "",
        `You can manually search at: [OpenCorporates Officers](https://opencorporates.com/officers?q=${encodeURIComponent(officerName)})`,
      ].join("\n")

      return {
        query: officerName,
        totalFound: 0,
        officers: [],
        rawContent: errorContent,
        sources: [
          {
            name: "OpenCorporates - Manual Officer Search",
            url: `https://opencorporates.com/officers?q=${encodeURIComponent(officerName)}`,
          },
          {
            name: "OpenCorporates - Get API Key",
            url: "https://opencorporates.com/api_accounts/new",
          },
        ],
        error: errorMessage,
      }
    }
  },
})

/**
 * Check if OpenCorporates tools should be enabled
 */
export function shouldEnableOpenCorporatesTools(): boolean {
  return isOpenCorporatesEnabled()
}
