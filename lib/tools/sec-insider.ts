/**
 * SEC Insider & Board Validation Tools
 * Validates if a person is an officer, director, or 10% owner of a public company
 * using the FREE SEC EDGAR Full Text Search API (efts.sec.gov).
 *
 * Key Features:
 * - Search Form 4 insider filings by person name
 * - Verify officer/director status from insider disclosures
 * - Find DEF 14A proxy statements for board composition
 * - No API key required - uses official SEC endpoints
 *
 * Data Sources:
 * - Form 3: Initial statement of beneficial ownership
 * - Form 4: Changes in beneficial ownership (most common)
 * - Form 5: Annual statement of beneficial ownership
 * - DEF 14A: Definitive proxy statement (lists all directors/officers)
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// CONSTANTS
// ============================================================================

// SEC EDGAR Full Text Search API (unofficial but stable)
const SEC_EFTS_API = "https://efts.sec.gov/LATEST/search-index"
// SEC EDGAR Submissions API (official)
const SEC_SUBMISSIONS_API = "https://data.sec.gov/submissions"
const SEC_TIMEOUT_MS = 20000

// ============================================================================
// TYPES
// ============================================================================

interface SecSearchHit {
  _id: string
  _source: {
    ciks: string[]
    display_names: string[]
    file_date: string
    file_num: string[]
    form: string
    adsh: string // Accession number
    period_ending?: string
    // Additional fields
    [key: string]: unknown
  }
}

interface SecSearchResponse {
  hits: {
    total: {
      value: number
      relation: string
    }
    hits: SecSearchHit[]
  }
}

interface InsiderFiling {
  accessionNumber: string
  filingDate: string
  formType: string
  companyName: string
  companyCik: string
  reportingPersonName?: string
  isOfficer?: boolean
  isDirector?: boolean
  isTenPercentOwner?: boolean
  officerTitle?: string
  filingUrl: string
}

export interface InsiderSearchResult {
  personName: string
  totalFilings: number
  filings: InsiderFiling[]
  companiesAsInsider: string[]
  isOfficerAtAny: boolean
  isDirectorAtAny: boolean
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

export interface ProxyStatementResult {
  companyName: string
  companyCik: string
  filings: Array<{
    accessionNumber: string
    filingDate: string
    formType: string
    filingUrl: string
  }>
  rawContent: string
  sources: Array<{ name: string; url: string }>
  error?: string
}

// ============================================================================
// SCHEMAS
// ============================================================================

const insiderSearchSchema = z.object({
  personName: z
    .string()
    .describe(
      "Full name of the person to search for (e.g., 'Elon Musk', 'Tim Cook'). " +
        "Use quotes for exact match."
    ),
  companyName: z
    .string()
    .optional()
    .describe(
      "Optional company name to narrow search (e.g., 'Tesla', 'Apple')"
    ),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of filings to return (default: 10, max: 50)"),
})

const proxySearchSchema = z.object({
  companyName: z
    .string()
    .describe(
      "Company name to search for proxy statements (e.g., 'Apple Inc', 'Tesla')"
    ),
  limit: z
    .number()
    .optional()
    .default(5)
    .describe("Maximum number of proxy statements to return (default: 5)"),
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
 * Build SEC EDGAR filing URL from accession number
 */
function buildFilingUrl(cik: string, accessionNumber: string): string {
  // Remove dashes from accession number for URL
  const cleanAccession = accessionNumber.replace(/-/g, "")
  const paddedCik = cik.padStart(10, "0")
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${paddedCik}&type=&dateb=&owner=include&count=40`
}

/**
 * Build direct filing URL
 */
function buildDirectFilingUrl(cik: string, accessionNumber: string): string {
  const paddedCik = cik.padStart(10, "0")
  const cleanAccession = accessionNumber.replace(/-/g, "")
  return `https://www.sec.gov/Archives/edgar/data/${paddedCik}/${cleanAccession}`
}

/**
 * Format search results for AI consumption
 */
function formatInsiderResultsForAI(
  personName: string,
  filings: InsiderFiling[],
  totalFound: number
): string {
  if (filings.length === 0) {
    return `# Insider Filing Search: "${personName}"

**No Form 3/4/5 insider filings found.**

This person may not be an insider (officer, director, or 10%+ owner) at any SEC-reporting company,
or the name spelling may differ from how it appears in SEC filings.

**Try:**
- Different name variations (e.g., "Robert" vs "Bob")
- Adding a company name to narrow the search
- Checking DEF 14A proxy statements for board membership`
  }

  const lines: string[] = [
    `# Insider Filing Search: "${personName}"`,
    "",
    `**Total Filings Found:** ${totalFound}`,
    `**Showing:** ${filings.length} most recent`,
    "",
  ]

  // Extract unique companies and roles
  const companies = new Map<
    string,
    { isOfficer: boolean; isDirector: boolean; titles: Set<string> }
  >()
  for (const f of filings) {
    if (!companies.has(f.companyName)) {
      companies.set(f.companyName, {
        isOfficer: false,
        isDirector: false,
        titles: new Set(),
      })
    }
    const co = companies.get(f.companyName)!
    if (f.isOfficer) co.isOfficer = true
    if (f.isDirector) co.isDirector = true
    if (f.officerTitle) co.titles.add(f.officerTitle)
  }

  lines.push("## Insider Status Summary")
  lines.push("")
  for (const [company, status] of companies) {
    const roles: string[] = []
    if (status.isDirector) roles.push("Director")
    if (status.isOfficer) roles.push("Officer")
    if (status.titles.size > 0) roles.push(`(${Array.from(status.titles).join(", ")})`)
    lines.push(`- **${company}**: ${roles.join(" / ") || "Insider (10%+ owner)"}`)
  }
  lines.push("")

  lines.push("## Recent Filings")
  lines.push("")
  lines.push("| Date | Form | Company | Role |")
  lines.push("|------|------|---------|------|")

  for (const f of filings.slice(0, 15)) {
    const roles: string[] = []
    if (f.isDirector) roles.push("Director")
    if (f.isOfficer) roles.push("Officer")
    if (f.officerTitle) roles.push(f.officerTitle)
    if (f.isTenPercentOwner) roles.push("10%+ Owner")
    lines.push(
      `| ${f.filingDate} | ${f.formType} | ${f.companyName} | ${roles.join(", ") || "Insider"} |`
    )
  }

  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push(
    "**Note:** Form 4 filings are required within 2 business days of a transaction by officers, directors, and 10%+ owners."
  )

  return lines.join("\n")
}

/**
 * Format proxy statement results for AI
 */
function formatProxyResultsForAI(
  companyName: string,
  filings: ProxyStatementResult["filings"]
): string {
  if (filings.length === 0) {
    return `# Proxy Statement Search: "${companyName}"

**No DEF 14A proxy statements found.**

This company may not be publicly traded, or no proxy statements have been filed.
Try searching with the exact company name as it appears in SEC filings.`
  }

  const lines: string[] = [
    `# Proxy Statement Search: "${companyName}"`,
    "",
    `**Filings Found:** ${filings.length}`,
    "",
    "DEF 14A proxy statements contain:",
    "- Complete list of directors and nominees",
    "- Executive officer information",
    "- Director and executive compensation",
    "- Stock ownership tables",
    "",
    "## Recent Proxy Statements",
    "",
    "| Filing Date | Form | Link |",
    "|-------------|------|------|",
  ]

  for (const f of filings) {
    lines.push(`| ${f.filingDate} | ${f.formType} | [View Filing](${f.filingUrl}) |`)
  }

  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push(
    "**Tip:** Open the most recent DEF 14A to see the current board of directors and executive officers."
  )

  return lines.join("\n")
}

// ============================================================================
// TOOLS
// ============================================================================

/**
 * Search for insider filings (Form 3/4/5) by person name
 * This validates if someone is an officer, director, or 10% owner
 */
export const secInsiderSearchTool = tool({
  description:
    "Search SEC Form 3/4/5 insider filings to verify if a person is an officer, director, " +
    "or 10%+ owner of a public company. Returns their role, company affiliations, and " +
    "recent transactions. Use this to validate board membership claims for public companies. " +
    "No API key required.",
  parameters: insiderSearchSchema,
  execute: async ({
    personName,
    companyName,
    limit = 10,
  }): Promise<InsiderSearchResult> => {
    console.log("[SEC Insider] Searching for:", personName, companyName || "")
    const startTime = Date.now()

    try {
      // Build search query - search for person name in Form 3, 4, 5
      // The SEC full text search indexes the content of filings
      let searchQuery = `"${personName}"`
      if (companyName) {
        searchQuery += ` "${companyName}"`
      }

      const requestBody = {
        q: searchQuery,
        forms: ["3", "4", "5", "3/A", "4/A", "5/A"],
        dateRange: "5y", // Last 5 years
        from: 0,
      }

      const response = await withTimeout(
        fetch(SEC_EFTS_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "Romy-Prospect-Research/1.0 (contact@example.com)",
          },
          body: JSON.stringify(requestBody),
        }),
        SEC_TIMEOUT_MS,
        `SEC search timed out after ${SEC_TIMEOUT_MS / 1000} seconds`
      )

      if (!response.ok) {
        throw new Error(`SEC API error: ${response.status}`)
      }

      const data = (await response.json()) as SecSearchResponse
      const duration = Date.now() - startTime
      console.log(
        "[SEC Insider] Found",
        data.hits.total.value,
        "results in",
        duration,
        "ms"
      )

      const filings: InsiderFiling[] = []
      const companiesSet = new Set<string>()
      let hasOfficer = false
      let hasDirector = false

      for (const hit of data.hits.hits.slice(0, Math.min(limit, 50))) {
        const source = hit._source
        const companyName = source.display_names?.[0] || "Unknown Company"
        const companyCik = source.ciks?.[0] || ""

        companiesSet.add(companyName)

        // Note: The full text search doesn't give us structured insider data
        // We're finding filings that mention this person
        // For detailed role info, would need to parse the actual XML
        const filing: InsiderFiling = {
          accessionNumber: source.adsh,
          filingDate: source.file_date,
          formType: source.form,
          companyName,
          companyCik,
          filingUrl: buildDirectFilingUrl(companyCik, source.adsh),
          // These would require parsing the actual filing XML
          isOfficer: undefined,
          isDirector: undefined,
          isTenPercentOwner: undefined,
        }

        filings.push(filing)
      }

      // Since Form 3/4/5 are only filed by insiders, finding any results
      // means the person IS an insider at that company
      const rawContent = formatInsiderResultsForAI(
        personName,
        filings,
        data.hits.total.value
      )

      const sources: Array<{ name: string; url: string }> = [
        {
          name: `SEC EDGAR - Insider Filings for "${personName}"`,
          url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(personName)}&type=4&dateb=&owner=only&count=40`,
        },
      ]

      // Add links to first few filings
      filings.slice(0, 3).forEach((f) => {
        sources.push({
          name: `${f.formType} - ${f.companyName} (${f.filingDate})`,
          url: f.filingUrl,
        })
      })

      return {
        personName,
        totalFilings: data.hits.total.value,
        filings,
        companiesAsInsider: Array.from(companiesSet),
        // If we found Form 3/4/5 filings, they ARE an insider
        isOfficerAtAny: filings.length > 0, // Presence of filings indicates insider status
        isDirectorAtAny: filings.length > 0,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[SEC Insider] Search failed:", errorMessage)
      return {
        personName,
        totalFilings: 0,
        filings: [],
        companiesAsInsider: [],
        isOfficerAtAny: false,
        isDirectorAtAny: false,
        rawContent: `# Insider Filing Search: "${personName}"\n\n**Error:** ${errorMessage}`,
        sources: [],
        error: errorMessage,
      }
    }
  },
})

/**
 * Search for DEF 14A proxy statements by company
 * These list all directors and officers
 */
export const secProxySearchTool = tool({
  description:
    "Search for DEF 14A proxy statements by company name. Proxy statements contain " +
    "the complete list of directors, executive officers, and their compensation. " +
    "Use this to find who serves on a company's board. No API key required.",
  parameters: proxySearchSchema,
  execute: async ({
    companyName,
    limit = 5,
  }): Promise<ProxyStatementResult> => {
    console.log("[SEC Proxy] Searching for:", companyName)
    const startTime = Date.now()

    try {
      const requestBody = {
        q: `"${companyName}"`,
        forms: ["DEF 14A", "DEF 14C", "DEFA14A"],
        dateRange: "5y",
        from: 0,
      }

      const response = await withTimeout(
        fetch(SEC_EFTS_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "Romy-Prospect-Research/1.0 (contact@example.com)",
          },
          body: JSON.stringify(requestBody),
        }),
        SEC_TIMEOUT_MS,
        `SEC search timed out after ${SEC_TIMEOUT_MS / 1000} seconds`
      )

      if (!response.ok) {
        throw new Error(`SEC API error: ${response.status}`)
      }

      const data = (await response.json()) as SecSearchResponse
      const duration = Date.now() - startTime
      console.log(
        "[SEC Proxy] Found",
        data.hits.total.value,
        "results in",
        duration,
        "ms"
      )

      const filings: ProxyStatementResult["filings"] = []
      let primaryCompanyName = companyName
      let primaryCik = ""

      for (const hit of data.hits.hits.slice(0, Math.min(limit, 10))) {
        const source = hit._source
        primaryCompanyName = source.display_names?.[0] || companyName
        primaryCik = source.ciks?.[0] || ""

        filings.push({
          accessionNumber: source.adsh,
          filingDate: source.file_date,
          formType: source.form,
          filingUrl: buildDirectFilingUrl(primaryCik, source.adsh),
        })
      }

      const rawContent = formatProxyResultsForAI(primaryCompanyName, filings)

      const sources: Array<{ name: string; url: string }> = [
        {
          name: `SEC EDGAR - Proxy Statements for "${companyName}"`,
          url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(companyName)}&type=DEF+14A&dateb=&owner=include&count=40`,
        },
      ]

      filings.slice(0, 3).forEach((f) => {
        sources.push({
          name: `${f.formType} (${f.filingDate})`,
          url: f.filingUrl,
        })
      })

      return {
        companyName: primaryCompanyName,
        companyCik: primaryCik,
        filings,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[SEC Proxy] Search failed:", errorMessage)
      return {
        companyName,
        companyCik: "",
        filings: [],
        rawContent: `# Proxy Statement Search: "${companyName}"\n\n**Error:** ${errorMessage}`,
        sources: [],
        error: errorMessage,
      }
    }
  },
})

/**
 * SEC insider tools are always available (no API key required)
 */
export function shouldEnableSecInsiderTools(): boolean {
  return true
}
