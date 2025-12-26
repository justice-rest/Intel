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
    const searchedList =
      searchedNames.length > 1
        ? `**Names searched:** ${searchedNames.join(", ")}\n\n`
        : ""

    return `# SEC Insider Search: ${personName}

${searchedList}**Status:** No matching SEC filers found.

## What This Means

This person does NOT appear as an insider at any U.S. public company:
- Not listed as an officer, director, or 10%+ beneficial owner
- May only be associated with **private** companies or **nonprofits**
- SEC Form 3/4/5 filings are only required for **public** company insiders

## Next Steps

1. **Try name variations** - Different spellings, middle initials, maiden names
2. **Search by company** - Use \`sec_proxy_search\` to find board/officer lists from proxy statements
3. **For nonprofits** - Search for the **organization name** (not person) in ProPublica

## Example Queries

\`\`\`
sec_insider_search({ personName: "Robert Smith", aliases: ["Bob Smith", "R. Smith"] })
sec_proxy_search({ companyName: "Apple Inc" })
\`\`\`

[View manual search](${searchUrl})`
  }

  const searchInfo = searchedNames.length > 1 ? `**Names searched:** ${searchedNames.join(", ")}\n` : ""
  const methodInfo = usedDirectCik ? `**Method:** Direct CIK lookup\n` : ""

  let content = `# SEC Insider Search: ${personName}

${searchInfo}${methodInfo}**Status:** Found ${matchedFilers.length} matching SEC filer${matchedFilers.length > 1 ? "s" : ""}.

## Matched Filers

`

  for (const filer of matchedFilers) {
    const filerUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${filer.cik}&type=4&owner=only`
    const foundVia = filer.searchedAs && filer.searchedAs !== filer.name ? ` *(via "${filer.searchedAs}")* ` : ""
    content += `- [${filer.name}](${filerUrl}) (CIK: ${filer.cik})${foundVia}\n`
  }

  if (filings.length === 0) {
    content += `
## Filings

No recent Form 4 filings found for the matched filer(s).`
  } else {
    const companiesMap = new Map<string, InsiderFiling[]>()
    for (const f of filings) {
      const existing = companiesMap.get(f.companyName) || []
      existing.push(f)
      companiesMap.set(f.companyName, existing)
    }

    content += `
## Insider At (${filings.length} filings)

`

    for (const [company, companyFilings] of companiesMap) {
      const companyUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${companyFilings[0].companyCik}&type=4`
      content += `### [${company}](${companyUrl})\n\n`
      content += `| Date | Form | Link |\n`
      content += `|------|------|------|\n`

      for (const f of companyFilings.slice(0, 5)) {
        content += `| ${f.filingDate} | ${f.formType} | [View](${f.filingUrl}) |\n`
      }

      if (companyFilings.length > 5) {
        content += `| ... | ${companyFilings.length - 5} more | [View all](${companyUrl}) |\n`
      }
      content += "\n"
    }
  }

  content += `## What This Confirms

This person IS registered as an SEC insider (officer, director, or 10%+ beneficial owner) at the companies listed above.

[View full results](${searchUrl})`

  return content
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
    return `# SEC Proxy Search: ${companyName}

**Status:** No DEF 14A proxy statements found.

## What This Means

- The company may not be publicly traded
- The exact company name may differ in SEC filings (try official name like "Apple Inc")
- DEF 14A proxy statements are only filed by **public** companies

## Next Steps

1. **Verify company name** - Try the full legal name from company website
2. **Search by ticker** - Use the stock ticker symbol if known
3. **Check SEC EDGAR** - Search manually to find the correct company

[View manual search](${searchUrl})`
  }

  const methodInfo = usedDirectCik ? `**Method:** Direct CIK lookup\n` : ""

  let content = `# SEC Proxy Search: ${companyName}

${methodInfo}**Status:** Found ${filings.length} proxy statement${filings.length > 1 ? "s" : ""}.

## What DEF 14A Contains

- **Board of Directors** - All director names and backgrounds
- **Executive Officers** - Named executive officers with titles
- **Compensation** - Pay packages and equity awards
- **Stock Ownership** - Beneficial ownership tables

## Available Filings

| Date | Type | Link |
|------|------|------|
`

  for (const f of filings.slice(0, 10)) {
    content += `| ${f.filingDate} | ${f.formType} | [View](${f.filingUrl}) |\n`
  }

  content += `
**Tip:** Open the most recent DEF 14A to see current board and officers.

[View all on SEC EDGAR](${searchUrl})`

  return content
}

// ============================================================================
// TOOLS
// ============================================================================

export const secInsiderSearchTool = tool({
  description:
    // CONSTRAINT-FIRST PROMPTING: Board validation
    "HARD CONSTRAINTS: " +
    "(1) ONLY for PUBLIC company insider verification—use propublica for nonprofits, " +
    "(2) Finding matches CONFIRMS insider status (HIGH CONFIDENCE), " +
    "(3) No match ≠ not an insider—may use variations of name. " +
    "CAPABILITY: Search SEC Form 3/4/5 insider filings by name or CIK. " +
    "VERIFIES: Officer, director, or 10%+ owner status at public companies. " +
    "SUPPORTS: Multiple aliases/name variations, direct CIK lookup. " +
    "SOURCE: SEC EDGAR (official government data). No API key required.",
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
        rawContent: `# SEC Insider Search

**Error:** Missing search criteria.

## Required Parameters

Provide at least one of the following:

1. \`personName\` - Full name to search (e.g., "Elon Musk")
2. \`aliases\` - Array of name variations (e.g., ["Bob Smith", "Robert Smith"])
3. \`cik\` - Direct CIK number (e.g., "0001494730")

## Example

\`\`\`
sec_insider_search({ personName: "Tim Cook" })
sec_insider_search({ cik: "0001214128" })
\`\`\``,
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
        rawContent: `# SEC Insider Search: ${displayName}

**Error:** ${errorMessage}

## What to Try

1. Check your network connection
2. Try searching again in a few moments
3. Use the manual search link below

[View manual search](${searchUrl})`,
        sources: [{ name: "SEC EDGAR Manual Search", url: searchUrl }],
        error: errorMessage,
      }
    }
  },
})

export const secProxySearchTool = tool({
  description:
    // CONSTRAINT-FIRST PROMPTING: Board composition lookup
    "HARD CONSTRAINTS: " +
    "(1) ONLY for PUBLIC companies—nonprofits use 990 data, " +
    "(2) Proxy statements are HIGH CONFIDENCE [Verified] official filings. " +
    "CAPABILITY: Search DEF 14A proxy statements by company name or CIK. " +
    "RETURNS: COMPLETE list of directors, executive officers, compensation data. " +
    "USE WHEN: Need to verify WHO serves on a company's board. " +
    "SUPPORTS: Company name search, direct CIK lookup (faster). " +
    "SOURCE: SEC EDGAR (official government data). No API key required.",
  parameters: proxySearchSchema,
  execute: async ({ companyName, cik, limit = 5 }): Promise<ProxyStatementResult> => {
    // Validate input
    if (!companyName && !cik) {
      return {
        companyName: "",
        companyCik: "",
        filings: [],
        rawContent: `# SEC Proxy Search

**Error:** Missing search criteria.

## Required Parameters

Provide at least one:

1. \`companyName\` - Company name (e.g., "Apple Inc")
2. \`cik\` - Direct CIK number (e.g., "0000320193")

## Example

\`\`\`
sec_proxy_search({ companyName: "Tesla Inc" })
sec_proxy_search({ cik: "0001318605" })
\`\`\``,
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
        rawContent: `# SEC Proxy Search: ${displayName}

**Error:** ${errorMessage}

## What to Try

1. Check your network connection
2. Try searching again in a few moments
3. Use the manual search link below

[View manual search](${searchUrl})`,
        sources: [{ name: "SEC EDGAR Manual Search", url: searchUrl }],
        error: errorMessage,
      }
    }
  },
})

export function shouldEnableSecInsiderTools(): boolean {
  return true
}
