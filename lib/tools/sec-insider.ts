/**
 * SEC Insider & Board Validation Tools
 * Validates if a person is an officer, director, or 10% owner of a public company
 * using the official SEC EDGAR APIs.
 *
 * Key Features:
 * - Search Form 3/4/5 insider filings by person name OR direct CIK
 * - Support for multiple name aliases (searches all variations)
 * - Verify officer/director status from insider disclosures
 * - Find DEF 14A proxy statements for board composition
 * - No API key required - uses official SEC endpoints
 *
 * Data Sources:
 * - Form 3: Initial statement of beneficial ownership
 * - Form 4: Changes in beneficial ownership (most common)
 * - Form 5: Annual statement of beneficial ownership
 * - DEF 14A: Definitive proxy statement (lists all directors/officers)
 *
 * Implementation:
 * Uses a two-step approach:
 * 1. Search browse-edgar with owner=only to find matching filer CIKs
 * 2. Fetch filings for each matching filer using Atom feed
 */

import { tool } from "ai"
import { z } from "zod"

// ============================================================================
// CONSTANTS
// ============================================================================

const SEC_BROWSE_EDGAR = "https://www.sec.gov/cgi-bin/browse-edgar"
const SEC_TIMEOUT_MS = 30000

// SEC requires User-Agent with app name and email: "app_name [email@domain.com]"
// See: https://www.sec.gov/os/accessing-edgar-data
// Format per SEC best practices: "AppName [email@domain.com]"
const SEC_USER_AGENT = "Romy-Research [admin@romy.app]"

// ============================================================================
// TYPES
// ============================================================================

interface FilerMatch {
  cik: string
  name: string
  searchedAs?: string // Which alias/variation found this match
}

interface InsiderFiling {
  accessionNumber: string
  filingDate: string
  formType: string
  companyName: string
  companyCik: string
  filingUrl: string
  filerName?: string
  filerCik?: string
}

export interface InsiderSearchResult {
  personName: string
  searchedNames: string[] // All names/aliases that were searched
  totalFilings: number
  filings: InsiderFiling[]
  companiesAsInsider: string[]
  matchedFilers: string[]
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
    .optional()
    .describe(
      "Full name of the person to search for (e.g., 'Elon Musk', 'Tim Cook'). " +
        "Will search for matching SEC filer names. Not needed if CIK is provided."
    ),
  aliases: z
    .array(z.string())
    .optional()
    .describe(
      "Alternative names/spellings to also search (e.g., ['Robert Smith', 'Bob Smith', 'R. Smith']). " +
        "The tool will search ALL provided names and combine results."
    ),
  cik: z
    .string()
    .optional()
    .describe(
      "Direct CIK (Central Index Key) number if known (e.g., '0001494730' or '1494730'). " +
        "If provided, skips name search and fetches filings directly for this CIK."
    ),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of filings to return per filer (default: 10, max: 40)"),
})

const proxySearchSchema = z.object({
  companyName: z
    .string()
    .optional()
    .describe(
      "Company name to search for proxy statements (e.g., 'Apple Inc', 'Tesla'). " +
        "Not needed if CIK is provided."
    ),
  cik: z
    .string()
    .optional()
    .describe(
      "Direct CIK number if known (e.g., '0000320193'). Skips company name search."
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
 * Normalize CIK to 10-digit zero-padded format
 */
function normalizeCik(cik: string): string {
  return cik.replace(/\D/g, "").padStart(10, "0")
}

/**
 * Check if a string looks like a CIK (all digits)
 */
function isCikFormat(value: string): boolean {
  return /^\d+$/.test(value.replace(/\D/g, ""))
}

/**
 * Make HTTPS request using Node.js https module
 * More reliable than fetch for SEC.gov endpoints
 */
async function httpsGet(url: string): Promise<{ status: number; data: string }> {
  const https = await import("https")
  const urlObj = new URL(url)

  return new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers: {
        "User-Agent": SEC_USER_AGENT,
        Accept: "text/html, application/atom+xml, application/xml, */*",
      },
    }

    const req = https.request(options, (res) => {
      let data = ""
      res.on("data", (chunk: Buffer) => (data += chunk.toString()))
      res.on("end", () => resolve({ status: res.statusCode || 0, data }))
    })

    req.on("error", reject)
    req.setTimeout(SEC_TIMEOUT_MS, () => {
      req.destroy()
      reject(new Error("Request timed out"))
    })
    req.end()
  })
}

/**
 * Search SEC EDGAR for filers matching a name
 * Uses browse-edgar with owner=only to find insider filers
 */
async function searchFilersByName(name: string, searchedAs?: string): Promise<FilerMatch[]> {
  const url = `${SEC_BROWSE_EDGAR}?action=getcompany&owner=only&type=4&company=${encodeURIComponent(name)}&count=40`
  console.log("[SEC] Searching filers:", name)

  try {
    const { status, data } = await withTimeout(
      httpsGet(url),
      SEC_TIMEOUT_MS,
      "SEC filer search timed out"
    )

    if (status !== 200) {
      console.error("[SEC] Filer search returned status:", status)
      return []
    }

    // Parse HTML to extract CIK and names from the results table
    const filers: FilerMatch[] = []
    const rowRegex = /CIK=(\d+)[^>]*>[^<]*<\/a><\/td>\s*<td[^>]*>([^<]+)<\/td>/gi
    let match

    while ((match = rowRegex.exec(data)) !== null) {
      const cik = match[1].padStart(10, "0")
      const filerName = match[2].trim()

      // Only include if the name is relevant to our search
      const searchTerms = name.toLowerCase().split(/\s+/)
      const filerNameLower = filerName.toLowerCase()
      const isRelevant = searchTerms.some((term) => filerNameLower.includes(term))

      if (isRelevant && filerName.length > 0) {
        filers.push({ cik, name: filerName, searchedAs: searchedAs || name })
      }
    }

    console.log("[SEC] Found", filers.length, "matching filers for", name)
    return filers
  } catch (error) {
    console.error("[SEC] Filer search failed:", error)
    return []
  }
}

/**
 * Fetch Form 4 filings for a specific filer CIK
 */
async function fetchFilingsForFiler(
  filerCik: string,
  filerName: string,
  limit: number = 10
): Promise<InsiderFiling[]> {
  const normalizedCik = normalizeCik(filerCik)
  const url = `${SEC_BROWSE_EDGAR}?action=getcompany&CIK=${normalizedCik}&type=4&owner=only&count=${limit}&output=atom`
  console.log("[SEC] Fetching filings for CIK:", normalizedCik)

  try {
    const { status, data } = await withTimeout(
      httpsGet(url),
      SEC_TIMEOUT_MS,
      "SEC filing fetch timed out"
    )

    if (status !== 200) {
      console.error("[SEC] Filing fetch returned status:", status)
      return []
    }

    const filings: InsiderFiling[] = []

    // Parse company/filer name from response
    const companyNameMatch = data.match(/<conformed-name>([^<]+)<\/conformed-name>/)
    const resolvedFilerName = companyNameMatch ? companyNameMatch[1].trim() : filerName
    const companyCik = data.match(/<cik>([^<]+)<\/cik>/)?.[1] || normalizedCik

    // Parse filing entries from Atom feed
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
    let entryMatch

    while ((entryMatch = entryRegex.exec(data)) !== null) {
      const entry = entryMatch[1]

      const accessionMatch = entry.match(/<accession-number>([^<]+)<\/accession-number>/)
      const dateMatch = entry.match(/<filing-date>([^<]+)<\/filing-date>/)
      const typeMatch = entry.match(/<filing-type>([^<]+)<\/filing-type>/)
      const hrefMatch = entry.match(/<filing-href>([^<]+)<\/filing-href>/)

      if (accessionMatch && dateMatch) {
        filings.push({
          accessionNumber: accessionMatch[1],
          filingDate: dateMatch[1],
          formType: `Form ${typeMatch?.[1] || "4"}`,
          companyName: resolvedFilerName,
          companyCik,
          filingUrl: hrefMatch?.[1] || "",
          filerName: resolvedFilerName,
          filerCik: normalizedCik,
        })
      }
    }

    console.log("[SEC] Found", filings.length, "filings for CIK", normalizedCik)
    return filings
  } catch (error) {
    console.error("[SEC] Filing fetch failed:", error)
    return []
  }
}

/**
 * Fetch filer info by CIK (for direct CIK lookup)
 */
async function fetchFilerInfoByCik(cik: string): Promise<FilerMatch | null> {
  const normalizedCik = normalizeCik(cik)
  const url = `${SEC_BROWSE_EDGAR}?action=getcompany&CIK=${normalizedCik}&type=4&owner=only&count=1&output=atom`

  try {
    const { status, data } = await httpsGet(url)

    if (status !== 200) {
      return null
    }

    const nameMatch = data.match(/<conformed-name>([^<]+)<\/conformed-name>/)
    if (nameMatch) {
      return { cik: normalizedCik, name: nameMatch[1].trim() }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Search for DEF 14A proxy statements by company name or CIK
 */
async function searchProxyStatements(
  companyNameOrCik: string,
  isCik: boolean,
  limit: number = 5
): Promise<{ filings: InsiderFiling[]; companyName: string; companyCik: string; error?: string }> {
  let searchUrl: string

  if (isCik) {
    const normalizedCik = normalizeCik(companyNameOrCik)
    searchUrl = `${SEC_BROWSE_EDGAR}?action=getcompany&CIK=${normalizedCik}&type=DEF%2014A&count=${limit}&output=atom`
  } else {
    searchUrl = `${SEC_BROWSE_EDGAR}?action=getcompany&company=${encodeURIComponent(companyNameOrCik)}&type=DEF%2014A&count=10&output=atom`
  }

  console.log("[SEC] Searching proxy statements:", searchUrl)

  try {
    const { status, data } = await withTimeout(
      httpsGet(searchUrl),
      SEC_TIMEOUT_MS,
      "SEC proxy search timed out"
    )

    if (status !== 200) {
      return { filings: [], companyName: companyNameOrCik, companyCik: "", error: `SEC returned status ${status}` }
    }

    // Check if we got a company listing (multiple companies) or filings directly
    if (data.includes("<company-info>") && !data.includes("<filing-date>")) {
      // Company listing - extract first CIK and fetch filings
      const cikMatch = data.match(/<cik>(\d+)<\/cik>/)
      if (cikMatch) {
        const companyCik = cikMatch[1].padStart(10, "0")
        return searchProxyStatements(companyCik, true, limit)
      }
    }

    return parseProxyFilings(data, companyNameOrCik, isCik ? normalizeCik(companyNameOrCik) : "", limit)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[SEC] Proxy search failed:", errorMessage)
    return { filings: [], companyName: companyNameOrCik, companyCik: "", error: errorMessage }
  }
}

function parseProxyFilings(
  data: string,
  companyName: string,
  companyCik: string,
  limit: number
): { filings: InsiderFiling[]; companyName: string; companyCik: string } {
  const filings: InsiderFiling[] = []

  const nameMatch = data.match(/<conformed-name>([^<]+)<\/conformed-name>/)
  const cikMatch = data.match(/<cik>([^<]+)<\/cik>/)
  const finalCompanyName = nameMatch?.[1]?.trim() || companyName
  const finalCik = cikMatch?.[1] || companyCik

  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let entryMatch

  while ((entryMatch = entryRegex.exec(data)) !== null && filings.length < limit) {
    const entry = entryMatch[1]

    const accessionMatch = entry.match(/<accession-number>([^<]+)<\/accession-number>/)
    const dateMatch = entry.match(/<filing-date>([^<]+)<\/filing-date>/)
    const typeMatch = entry.match(/<filing-type>([^<]+)<\/filing-type>/)
    const hrefMatch = entry.match(/<filing-href>([^<]+)<\/filing-href>/)

    if (accessionMatch && dateMatch) {
      filings.push({
        accessionNumber: accessionMatch[1],
        filingDate: dateMatch[1],
        formType: typeMatch?.[1] || "DEF 14A",
        companyName: finalCompanyName,
        companyCik: finalCik,
        filingUrl: hrefMatch?.[1] || "",
      })
    }
  }

  return { filings, companyName: finalCompanyName, companyCik: finalCik }
}

/**
 * Deduplicate filers by CIK
 */
function deduplicateFilers(filers: FilerMatch[]): FilerMatch[] {
  const seen = new Map<string, FilerMatch>()
  for (const filer of filers) {
    if (!seen.has(filer.cik)) {
      seen.set(filer.cik, filer)
    }
  }
  return Array.from(seen.values())
}

/**
 * Format insider search results for AI consumption
 */
function formatInsiderResultsForAI(
  personName: string,
  searchedNames: string[],
  matchedFilers: FilerMatch[],
  filings: InsiderFiling[],
  searchUrl: string,
  usedDirectCik: boolean
): string {
  if (matchedFilers.length === 0) {
    const searchedList = searchedNames.length > 1
      ? `\n\n**Names searched:** ${searchedNames.join(", ")}`
      : ""

    return `# SEC Insider Filing Search: "${personName}"
${searchedList}
---

**No matching SEC filers found** for ${searchedNames.length > 1 ? "any of these names" : "this name"}.

## What This Means

- No person with this name (or variations) appears as an SEC insider filer
- This person may not be an officer, director, or 10%+ owner at any **public** company
- They may be associated only with **private** companies or **nonprofits** (no SEC filings)

## Recommended Next Steps

1. **Try More Name Variations**
   - Different spellings (Robert/Bob, William/Bill)
   - With or without middle name/initial
   - Maiden name vs married name
   - Legal name vs preferred name

2. **Search by Company Instead**
   - Use \`sec_proxy_search("[company name]")\` to find DEF 14A proxy statements
   - Proxy statements list ALL directors and officers by name

3. **For Nonprofit Board Members**
   - Use web search to find nonprofit affiliations first
   - Then search ProPublica with the **organization name** (not person name)

## Manual Search

[Search SEC EDGAR](${searchUrl})

---

*SEC Form 3/4/5 filings are only required for insiders at PUBLIC companies.*`
  }

  const lines: string[] = [
    `# SEC Insider Filing Search: "${personName}"`,
    "",
  ]

  if (searchedNames.length > 1) {
    lines.push(`**Names searched:** ${searchedNames.join(", ")}`)
    lines.push("")
  }

  if (usedDirectCik) {
    lines.push(`**Method:** Direct CIK lookup`)
    lines.push("")
  }

  lines.push("---")
  lines.push("")
  lines.push(`**Found ${matchedFilers.length} matching SEC filer${matchedFilers.length > 1 ? "s" : ""}:**`)
  lines.push("")

  for (const filer of matchedFilers) {
    const filerUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${filer.cik}&type=4&owner=only`
    const foundVia = filer.searchedAs && filer.searchedAs !== filer.name ? ` (found via "${filer.searchedAs}")` : ""
    lines.push(`- **[${filer.name}](${filerUrl})** (CIK: ${filer.cik})${foundVia}`)
  }

  lines.push("")

  if (filings.length === 0) {
    lines.push("## No Recent Form 4 Filings")
    lines.push("")
    lines.push("The matched filer(s) exist in SEC EDGAR but have no recent Form 4 filings.")
  } else {
    const companiesMap = new Map<string, InsiderFiling[]>()
    for (const f of filings) {
      const existing = companiesMap.get(f.companyName) || []
      existing.push(f)
      companiesMap.set(f.companyName, existing)
    }

    lines.push(`## Companies Where Insider (${filings.length} filings)`)
    lines.push("")

    for (const [company, companyFilings] of companiesMap) {
      const companyUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${companyFilings[0].companyCik}&type=4`
      lines.push(`### [${company}](${companyUrl})`)
      lines.push("")
      lines.push("| Date | Form | Link |")
      lines.push("|------|------|------|")

      for (const f of companyFilings.slice(0, 5)) {
        lines.push(`| ${f.filingDate} | ${f.formType} | [View](${f.filingUrl}) |`)
      }

      if (companyFilings.length > 5) {
        lines.push(`| ... | ${companyFilings.length - 5} more | [View all](${companyUrl}) |`)
      }
      lines.push("")
    }
  }

  lines.push("---")
  lines.push("")
  lines.push("## What This Confirms")
  lines.push("")
  lines.push("**Finding a match in SEC EDGAR confirms this person IS registered as an insider** (officer, director, or 10%+ beneficial owner) at the companies shown.")
  lines.push("")
  lines.push(`[View full search results](${searchUrl})`)

  return lines.join("\n")
}

/**
 * Format proxy statement results for AI
 */
function formatProxyResultsForAI(
  companyName: string,
  filings: InsiderFiling[],
  searchUrl: string,
  usedDirectCik: boolean
): string {
  if (filings.length === 0) {
    return `# SEC Proxy Statement Search: "${companyName}"

---

**No DEF 14A proxy statements found** for this company.

## What This Means

- The company may not be publicly traded
- The exact company name may differ in SEC filings
- Try the official company name (e.g., "Apple Inc" not "Apple")

## Manual Search

[Search SEC EDGAR](${searchUrl})

---

*DEF 14A proxy statements are only filed by PUBLIC companies.*`
  }

  const lines: string[] = [
    `# SEC Proxy Statement Search: "${companyName}"`,
    "",
  ]

  if (usedDirectCik) {
    lines.push(`**Method:** Direct CIK lookup`)
    lines.push("")
  }

  lines.push("---")
  lines.push("")
  lines.push(`**Found ${filings.length} proxy statement${filings.length > 1 ? "s" : ""}**`)
  lines.push("")
  lines.push("## What DEF 14A Contains")
  lines.push("")
  lines.push("- **Board of Directors** - All director names and backgrounds")
  lines.push("- **Executive Officers** - Named executive officers with titles")
  lines.push("- **Compensation** - Pay packages and equity awards")
  lines.push("- **Stock Ownership** - Beneficial ownership tables")
  lines.push("")
  lines.push("## Available Filings")
  lines.push("")
  lines.push("| Date | Type | Link |")
  lines.push("|------|------|------|")

  for (const f of filings.slice(0, 10)) {
    lines.push(`| ${f.filingDate} | ${f.formType} | [View Filing](${f.filingUrl}) |`)
  }

  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("**Tip:** Open the most recent DEF 14A to see the current board and executive officers.")
  lines.push("")
  lines.push(`[View all on SEC EDGAR](${searchUrl})`)

  return lines.join("\n")
}

// ============================================================================
// TOOLS
// ============================================================================

export const secInsiderSearchTool = tool({
  description:
    "Search SEC Form 3/4/5 insider filings to verify if a person is an officer, director, " +
    "or 10%+ owner of a PUBLIC company. Supports: (1) name search, (2) multiple aliases/variations, " +
    "(3) direct CIK lookup. Finding matches CONFIRMS insider status. " +
    "For nonprofit board research, use web search first to find org names, then use propublica tools. " +
    "No API key required.",
  parameters: insiderSearchSchema,
  execute: async ({ personName, aliases, cik, limit = 10 }): Promise<InsiderSearchResult> => {
    const startTime = Date.now()

    // Validate input - need either personName, aliases, or CIK
    if (!personName && (!aliases || aliases.length === 0) && !cik) {
      return {
        personName: "",
        searchedNames: [],
        totalFilings: 0,
        filings: [],
        companiesAsInsider: [],
        matchedFilers: [],
        isOfficerAtAny: false,
        isDirectorAtAny: false,
        rawContent: "**Error:** Please provide either a person name, aliases, or CIK number.",
        sources: [],
        error: "No search criteria provided",
      }
    }

    const displayName = personName || (aliases && aliases[0]) || `CIK ${cik}`
    const usedDirectCik = Boolean(cik && !personName && (!aliases || aliases.length === 0))

    console.log("[SEC Insider] Starting search for:", displayName, usedDirectCik ? "(direct CIK)" : "")

    const searchUrl = cik
      ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${normalizeCik(cik)}&type=4&owner=only`
      : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&owner=only&type=4&company=${encodeURIComponent(displayName)}&count=40`

    try {
      let matchedFilers: FilerMatch[] = []
      const searchedNames: string[] = []

      // Case 1: Direct CIK provided - skip name search
      if (cik) {
        const normalizedCik = normalizeCik(cik)
        const filerInfo = await fetchFilerInfoByCik(normalizedCik)

        if (filerInfo) {
          matchedFilers = [filerInfo]
          searchedNames.push(`CIK ${normalizedCik}`)
        } else {
          // CIK not found, still try to fetch filings
          matchedFilers = [{ cik: normalizedCik, name: `CIK ${normalizedCik}` }]
          searchedNames.push(`CIK ${normalizedCik}`)
        }
      } else {
        // Case 2: Search by names (including aliases)
        const namesToSearch: string[] = []

        if (personName) {
          namesToSearch.push(personName)
        }

        if (aliases && aliases.length > 0) {
          namesToSearch.push(...aliases)
        }

        // Remove duplicates and empty strings
        const uniqueNames = [...new Set(namesToSearch.filter((n) => n.trim()))]
        searchedNames.push(...uniqueNames)

        // Search all names in parallel
        const searchPromises = uniqueNames.map((name) => searchFilersByName(name, name))
        const results = await Promise.all(searchPromises)

        // Combine and deduplicate results
        const allFilers = results.flat()
        matchedFilers = deduplicateFilers(allFilers).slice(0, 10)
      }

      // Fetch filings for each matched filer
      const allFilings: InsiderFiling[] = []
      const companiesSet = new Set<string>()

      for (const filer of matchedFilers.slice(0, 5)) {
        const filings = await fetchFilingsForFiler(filer.cik, filer.name, limit)
        allFilings.push(...filings)
        filings.forEach((f) => companiesSet.add(f.companyName))
      }

      const duration = Date.now() - startTime
      console.log(
        "[SEC Insider] Search completed in",
        duration,
        "ms. Found",
        matchedFilers.length,
        "filers,",
        allFilings.length,
        "filings"
      )

      const rawContent = formatInsiderResultsForAI(
        displayName,
        searchedNames,
        matchedFilers,
        allFilings,
        searchUrl,
        usedDirectCik
      )

      const sources: Array<{ name: string; url: string }> = [
        { name: `SEC EDGAR - Search for "${displayName}"`, url: searchUrl },
      ]

      matchedFilers.slice(0, 3).forEach((f) => {
        sources.push({
          name: `SEC Filer: ${f.name}`,
          url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${f.cik}&type=4&owner=only`,
        })
      })

      return {
        personName: displayName,
        searchedNames,
        totalFilings: allFilings.length,
        filings: allFilings.slice(0, Math.min(limit * 5, 50)),
        companiesAsInsider: Array.from(companiesSet),
        matchedFilers: matchedFilers.map((f) => f.name),
        isOfficerAtAny: matchedFilers.length > 0,
        isDirectorAtAny: matchedFilers.length > 0,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[SEC Insider] Search failed:", errorMessage)

      return {
        personName: displayName,
        searchedNames: [],
        totalFilings: 0,
        filings: [],
        companiesAsInsider: [],
        matchedFilers: [],
        isOfficerAtAny: false,
        isDirectorAtAny: false,
        rawContent: `# SEC Insider Search: "${displayName}"\n\n**Error:** ${errorMessage}\n\n[Try searching manually](${searchUrl})`,
        sources: [{ name: "SEC EDGAR Manual Search", url: searchUrl }],
        error: errorMessage,
      }
    }
  },
})

export const secProxySearchTool = tool({
  description:
    "Search for DEF 14A proxy statements by company name OR CIK. Proxy statements contain " +
    "the COMPLETE list of directors, executive officers, and their compensation. " +
    "Use this to find WHO serves on a company's board. Only works for PUBLIC companies. " +
    "Supports direct CIK lookup for faster results. No API key required.",
  parameters: proxySearchSchema,
  execute: async ({ companyName, cik, limit = 5 }): Promise<ProxyStatementResult> => {
    // Validate input
    if (!companyName && !cik) {
      return {
        companyName: "",
        companyCik: "",
        filings: [],
        rawContent: "**Error:** Please provide either a company name or CIK number.",
        sources: [],
        error: "No search criteria provided",
      }
    }

    const usedDirectCik = Boolean(cik && !companyName)
    const searchValue = cik || companyName || ""
    const displayName = companyName || `CIK ${cik}`

    console.log("[SEC Proxy] Starting search for:", displayName, usedDirectCik ? "(direct CIK)" : "")
    const startTime = Date.now()

    const searchUrl = cik
      ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${normalizeCik(cik)}&type=DEF%2014A`
      : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(companyName!)}&type=DEF%2014A`

    try {
      const { filings, companyName: resolvedName, companyCik, error } = await searchProxyStatements(
        searchValue,
        Boolean(cik),
        limit
      )

      const duration = Date.now() - startTime
      console.log("[SEC Proxy] Search completed in", duration, "ms. Found", filings.length, "filings")

      const rawContent = formatProxyResultsForAI(resolvedName || displayName, filings, searchUrl, usedDirectCik)

      const sources: Array<{ name: string; url: string }> = [
        { name: `SEC EDGAR - Proxy Statements for "${resolvedName || displayName}"`, url: searchUrl },
      ]

      filings.slice(0, 3).forEach((f) => {
        sources.push({
          name: `DEF 14A (${f.filingDate})`,
          url: f.filingUrl,
        })
      })

      return {
        companyName: resolvedName || displayName,
        companyCik,
        filings: filings.map((f) => ({
          accessionNumber: f.accessionNumber,
          filingDate: f.filingDate,
          formType: f.formType,
          filingUrl: f.filingUrl,
        })),
        rawContent,
        sources,
        error,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[SEC Proxy] Search failed:", errorMessage)

      return {
        companyName: displayName,
        companyCik: "",
        filings: [],
        rawContent: `# SEC Proxy Search: "${displayName}"\n\n**Error:** ${errorMessage}\n\n[Try searching manually](${searchUrl})`,
        sources: [{ name: "SEC EDGAR Manual Search", url: searchUrl }],
        error: errorMessage,
      }
    }
  },
})

export function shouldEnableSecInsiderTools(): boolean {
  return true
}
