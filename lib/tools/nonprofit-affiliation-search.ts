/**
 * Nonprofit Affiliation Search Tool
 *
 * Automated workflow to find a person's nonprofit affiliations:
 * 1. Search web for person's nonprofit connections
 * 2. Extract organization names from results
 * 3. Query ProPublica with discovered organization names
 * 4. Return consolidated results with full 990 data
 *
 * This is the "automatic" tool that handles the full workflow without user intervention.
 */

import { tool } from "ai"
import { z } from "zod"
import { LinkupClient } from "linkup-sdk"
import { getLinkupApiKey, isLinkupEnabled } from "@/lib/linkup/config"

// ============================================================================
// CONSTANTS
// ============================================================================

const PROPUBLICA_API_BASE = "https://projects.propublica.org/nonprofits/api/v2"
const SEARCH_TIMEOUT_MS = 45000
const PROPUBLICA_TIMEOUT_MS = 15000

// ============================================================================
// SCHEMAS
// ============================================================================

const nonprofitAffiliationSearchSchema = z.object({
  personName: z
    .string()
    .describe("Full name of the person to research (e.g., 'Bill Gates', 'Mackenzie Scott')"),
  includeRoles: z
    .array(z.enum(["founder", "board", "donor", "executive", "trustee"]))
    .optional()
    .default(["founder", "board", "donor", "executive", "trustee"])
    .describe("Types of nonprofit roles to search for"),
  state: z
    .string()
    .optional()
    .describe("Two-letter state code to narrow search (e.g., 'CA', 'NY')"),
})

// ============================================================================
// TYPES
// ============================================================================

interface DiscoveredOrg {
  name: string
  context: string // How the person is connected
  confidence: "high" | "medium" | "low"
}

interface ProPublicaOrg {
  ein: string
  name: string
  city?: string
  state?: string
  nteeCode?: string
  taxCode?: string
  hasFilings: boolean
}

interface ProPublicaFiling {
  year: number
  formType: string
  revenue?: number
  expenses?: number
  assets?: number
}

interface NonprofitAffiliation {
  organizationName: string
  ein?: string
  role: string
  proPublicaMatch: boolean
  financials?: {
    revenue?: number
    assets?: number
    mostRecentYear?: number
  }
  sources: Array<{ name: string; url: string }>
}

export interface NonprofitAffiliationResult {
  personName: string
  totalAffiliations: number
  affiliations: NonprofitAffiliation[]
  discoveredOrgs: string[]
  matchedInProPublica: number
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

function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return "N/A"
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}

function formatEin(ein: string | number): string {
  const einStr = String(ein).replace(/-/g, "").padStart(9, "0")
  return `${einStr.slice(0, 2)}-${einStr.slice(2)}`
}

/**
 * Extract organization names from Linkup search results
 * Uses pattern matching to find nonprofit/foundation mentions
 */
function extractOrganizationsFromText(text: string, personName: string): DiscoveredOrg[] {
  const orgs: DiscoveredOrg[] = []
  const seen = new Set<string>()
  const personFirstName = personName.split(" ")[0].toLowerCase()
  const personLastName = personName.split(" ").pop()?.toLowerCase() || ""

  // Patterns that indicate nonprofit organizations
  const patterns = [
    // Foundation patterns
    /(?:the\s+)?([A-Z][a-zA-Z\s&'-]+(?:Foundation|Fund|Trust|Endowment|Institute|Initiative))/g,
    // Organization patterns
    /(?:the\s+)?([A-Z][a-zA-Z\s&'-]+(?:Organization|Association|Society|Alliance|Council|Center|Centre))/g,
    // Charity patterns
    /(?:the\s+)?([A-Z][a-zA-Z\s&'-]+(?:Charity|Charities|Relief|Aid|Mission|Ministry|Church))/g,
    // Named foundations (e.g., "Bill & Melinda Gates Foundation")
    /([A-Z][a-zA-Z]+(?:\s+(?:&|and)\s+[A-Z][a-zA-Z]+)?\s+(?:Family\s+)?Foundation)/g,
  ]

  // Role context patterns
  const rolePatterns = [
    { pattern: /(?:founder|founded|established)\s+(?:of\s+)?(?:the\s+)?([^.,]+(?:Foundation|Fund|Trust|Endowment))/gi, role: "Founder" },
    { pattern: /board\s+(?:member|director)\s+(?:of|at)\s+(?:the\s+)?([^.,]+)/gi, role: "Board Member" },
    { pattern: /(?:chair|chairman|chairwoman|chairperson)\s+(?:of|at)\s+(?:the\s+)?([^.,]+)/gi, role: "Chair" },
    { pattern: /(?:trustee)\s+(?:of|at)\s+(?:the\s+)?([^.,]+)/gi, role: "Trustee" },
    { pattern: /(?:president|ceo|executive director)\s+(?:of|at)\s+(?:the\s+)?([^.,]+)/gi, role: "Executive" },
    { pattern: /(?:donated|gave|contributed|pledged)\s+(?:\$[\d.,]+\s+(?:million|billion)?\s+)?(?:to\s+)?(?:the\s+)?([^.,]+)/gi, role: "Donor" },
  ]

  // Extract role-based mentions first (higher confidence)
  for (const { pattern, role } of rolePatterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const orgName = match[1].trim()
      const normalizedName = orgName.toLowerCase()

      // Skip if too short, already seen, or doesn't look like an org
      if (orgName.length < 5 || seen.has(normalizedName)) continue

      // Skip generic terms
      if (/^(the|a|an|their|his|her|its|this|that)\s*$/i.test(orgName)) continue

      // Higher confidence if it contains the person's name or common nonprofit terms
      const hasPersonName = normalizedName.includes(personLastName) || normalizedName.includes(personFirstName)
      const hasNonprofitTerm = /foundation|fund|trust|endowment|institute|charity|organization/i.test(orgName)

      if (hasPersonName || hasNonprofitTerm) {
        seen.add(normalizedName)
        orgs.push({
          name: orgName,
          context: role,
          confidence: hasPersonName ? "high" : "medium",
        })
      }
    }
  }

  // Then extract from generic patterns (lower confidence)
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const orgName = match[1].trim()
      const normalizedName = orgName.toLowerCase()

      if (orgName.length < 8 || seen.has(normalizedName)) continue

      // Check if it's likely related to the person
      const hasPersonName = normalizedName.includes(personLastName) || normalizedName.includes(personFirstName)

      if (hasPersonName || /foundation|fund|trust|charity/i.test(orgName)) {
        seen.add(normalizedName)
        orgs.push({
          name: orgName,
          context: "Affiliated",
          confidence: hasPersonName ? "high" : "low",
        })
      }
    }
  }

  // Sort by confidence
  const confidenceOrder = { high: 0, medium: 1, low: 2 }
  orgs.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence])

  return orgs.slice(0, 15) // Limit to top 15
}

/**
 * Search ProPublica for an organization
 */
async function searchProPublica(query: string): Promise<{ orgs: ProPublicaOrg[]; error?: string }> {
  try {
    const url = new URL(`${PROPUBLICA_API_BASE}/search.json`)
    url.searchParams.set("q", query)

    const response = await withTimeout(
      fetch(url.toString(), {
        headers: { Accept: "application/json" },
      }),
      PROPUBLICA_TIMEOUT_MS,
      "ProPublica search timed out"
    )

    if (!response.ok && response.status !== 404) {
      return { orgs: [], error: `ProPublica error: ${response.status}` }
    }

    const data = await response.json()
    const organizations = data.organizations || []

    return {
      orgs: organizations.slice(0, 5).map((org: { ein: number; name: string; city?: string; state?: string; ntee_code?: string; subseccd?: number; have_filings?: boolean; have_extracts?: boolean }) => ({
        ein: formatEin(org.ein),
        name: org.name,
        city: org.city,
        state: org.state,
        nteeCode: org.ntee_code,
        taxCode: org.subseccd ? `501(c)(${org.subseccd})` : undefined,
        hasFilings: Boolean(org.have_filings || org.have_extracts),
      })),
    }
  } catch (error) {
    return { orgs: [], error: error instanceof Error ? error.message : "Unknown error" }
  }
}

/**
 * Get ProPublica filing details for an EIN
 */
async function getProPublicaDetails(ein: string): Promise<{ filings: ProPublicaFiling[]; error?: string }> {
  try {
    const cleanEin = ein.replace(/[-\s]/g, "")
    const url = `${PROPUBLICA_API_BASE}/organizations/${cleanEin}.json`

    const response = await withTimeout(
      fetch(url, {
        headers: { Accept: "application/json" },
      }),
      PROPUBLICA_TIMEOUT_MS,
      "ProPublica details timed out"
    )

    if (!response.ok) {
      return { filings: [], error: `ProPublica error: ${response.status}` }
    }

    const data = await response.json()
    const allFilings = [
      ...(data.filings_with_data || []),
      ...(data.filings_without_data || []),
    ].sort((a: { tax_prd_yr?: number }, b: { tax_prd_yr?: number }) => (b.tax_prd_yr || 0) - (a.tax_prd_yr || 0))

    return {
      filings: allFilings.slice(0, 3).map((f: { tax_prd_yr?: number; tax_prd?: number; formtype?: number; totrevenue?: number; totfuncexpns?: number; totassetsend?: number }) => ({
        year: f.tax_prd_yr || Math.floor((f.tax_prd || 0) / 100),
        formType: f.formtype === 0 ? "990" : f.formtype === 1 ? "990-EZ" : f.formtype === 2 ? "990-PF" : "990",
        revenue: f.totrevenue,
        expenses: f.totfuncexpns,
        assets: f.totassetsend,
      })),
    }
  } catch (error) {
    return { filings: [], error: error instanceof Error ? error.message : "Unknown error" }
  }
}

/**
 * Format results for AI consumption
 */
function formatResultsForAI(
  personName: string,
  affiliations: NonprofitAffiliation[],
  discoveredOrgs: DiscoveredOrg[],
  linkupSearched: boolean
): string {
  if (affiliations.length === 0 && discoveredOrgs.length === 0) {
    return `# Nonprofit Affiliation Search: ${personName}

**Status:** No nonprofit affiliations found.

## What This Means

- No foundations, charities, or nonprofits were found associated with this person
- They may not have public nonprofit affiliations
- They may use a different name for philanthropic work

## Next Steps

1. **Try name variations** - Full legal name, maiden name, nickname
2. **Search by family** - "[Last Name] Family Foundation"
3. **Check specific organizations** - If you know an org name, search ProPublica directly

\`\`\`
propublica_nonprofit_search({ query: "Smith Family Foundation" })
\`\`\``
  }

  let content = `# Nonprofit Affiliation Search: ${personName}

**Status:** Found ${affiliations.length} affiliation${affiliations.length !== 1 ? "s" : ""}.

`

  if (!linkupSearched) {
    content += `⚠️ *Linkup search not available. Results may be limited.*\n\n`
  }

  if (affiliations.length > 0) {
    content += `## Nonprofit Affiliations\n\n`

    for (const aff of affiliations) {
      content += `### ${aff.organizationName}\n\n`
      content += `- **Role:** ${aff.role}\n`

      if (aff.ein) {
        content += `- **EIN:** ${aff.ein}\n`
      }

      if (aff.financials) {
        if (aff.financials.revenue !== undefined) {
          content += `- **Revenue:** ${formatCurrency(aff.financials.revenue)}\n`
        }
        if (aff.financials.assets !== undefined) {
          content += `- **Assets:** ${formatCurrency(aff.financials.assets)}\n`
        }
        if (aff.financials.mostRecentYear) {
          content += `- **Data Year:** ${aff.financials.mostRecentYear}\n`
        }
      }

      content += `- **ProPublica Match:** ${aff.proPublicaMatch ? "Yes ✓" : "Not found"}\n`
      content += "\n"
    }
  }

  // Add discovered orgs that weren't matched
  const unmatchedOrgs = discoveredOrgs.filter(
    (d) => !affiliations.some((a) => a.organizationName.toLowerCase() === d.name.toLowerCase())
  )

  if (unmatchedOrgs.length > 0) {
    content += `## Other Mentioned Organizations\n\n`
    content += `*These were found in web search but not matched in ProPublica:*\n\n`

    for (const org of unmatchedOrgs.slice(0, 5)) {
      content += `- ${org.name} (${org.context})\n`
    }
    content += "\n"
  }

  // Add summary insights
  if (affiliations.some((a) => a.financials?.assets && a.financials.assets >= 100000000)) {
    content += `## Wealth Indicators\n\n`
    content += `**Major Foundation Affiliation** - Associated with foundation(s) holding $100M+ in assets.\n\n`
  }

  return content
}

// ============================================================================
// TOOL
// ============================================================================

export const nonprofitAffiliationSearchTool = tool({
  description:
    "AUTOMATIC nonprofit affiliation finder. Given a person's name, this tool: " +
    "(1) Searches the web for their nonprofit connections (foundations, boards, donations), " +
    "(2) Extracts organization names from results, " +
    "(3) Queries ProPublica for each organization's 990 data, " +
    "(4) Returns consolidated results with financials. " +
    "Use this instead of manually searching ProPublica when researching a PERSON's philanthropic background. " +
    "No user intervention required - fully automated multi-step workflow.",
  parameters: nonprofitAffiliationSearchSchema,
  execute: async ({ personName, includeRoles, state }): Promise<NonprofitAffiliationResult> => {
    console.log("[Nonprofit Affiliation] Starting search for:", personName)
    const startTime = Date.now()

    const sources: Array<{ name: string; url: string }> = []
    const discoveredOrgs: DiscoveredOrg[] = []
    const affiliations: NonprofitAffiliation[] = []
    let linkupSearched = false

    try {
      // Step 1: Search web for nonprofit affiliations using Linkup
      if (isLinkupEnabled()) {
        console.log("[Nonprofit Affiliation] Step 1: Searching web for affiliations")

        const client = new LinkupClient({ apiKey: getLinkupApiKey() })

        // Build search queries based on roles
        const roleQueries = includeRoles?.map((role) => {
          switch (role) {
            case "founder": return `${personName} founder foundation nonprofit charity established`
            case "board": return `${personName} board member director nonprofit foundation`
            case "donor": return `${personName} donated philanthropy charitable giving foundation`
            case "executive": return `${personName} president CEO executive director nonprofit foundation`
            case "trustee": return `${personName} trustee foundation trust board`
            default: return `${personName} nonprofit foundation charity`
          }
        }) || []

        // Add general query
        const queries = [
          `${personName} foundation nonprofit board member charity`,
          ...roleQueries.slice(0, 2), // Limit to prevent too many searches
        ]

        // Run searches in parallel (limit to 3)
        const searchPromises = queries.slice(0, 3).map(async (query) => {
          try {
            const result = await withTimeout(
              client.search({
                query,
                depth: "standard",
                outputType: "sourcedAnswer",
              }),
              SEARCH_TIMEOUT_MS,
              "Linkup search timed out"
            )
            return { query, answer: result.answer || "", sources: result.sources || [] }
          } catch (error) {
            console.error("[Nonprofit Affiliation] Search failed for query:", query, error)
            return { query, answer: "", sources: [] }
          }
        })

        const searchResults = await Promise.all(searchPromises)
        linkupSearched = true

        // Extract organizations from all search results
        for (const result of searchResults) {
          if (result.answer) {
            const extracted = extractOrganizationsFromText(result.answer, personName)
            for (const org of extracted) {
              // Avoid duplicates
              if (!discoveredOrgs.some((d) => d.name.toLowerCase() === org.name.toLowerCase())) {
                discoveredOrgs.push(org)
              }
            }
          }

          // Add web sources
          for (const source of result.sources || []) {
            if (!sources.some((s) => s.url === source.url)) {
              sources.push({
                name: source.name || "Web Source",
                url: source.url,
              })
            }
          }
        }

        console.log("[Nonprofit Affiliation] Discovered", discoveredOrgs.length, "potential organizations")
      } else {
        console.log("[Nonprofit Affiliation] Linkup not available, using fallback search")

        // Fallback: Search ProPublica directly with person's last name + "foundation"
        const lastName = personName.split(" ").pop() || personName
        discoveredOrgs.push({
          name: `${lastName} Foundation`,
          context: "Inferred",
          confidence: "low",
        })
        discoveredOrgs.push({
          name: `${lastName} Family Foundation`,
          context: "Inferred",
          confidence: "low",
        })
      }

      // Step 2: Query ProPublica for each discovered organization
      console.log("[Nonprofit Affiliation] Step 2: Querying ProPublica for", discoveredOrgs.length, "organizations")

      for (const discoveredOrg of discoveredOrgs.slice(0, 10)) {
        const { orgs, error } = await searchProPublica(discoveredOrg.name)

        if (error) {
          console.error("[Nonprofit Affiliation] ProPublica search error:", error)
          continue
        }

        if (orgs.length > 0) {
          // Find best match
          const bestMatch = orgs.find((o) =>
            o.name.toLowerCase().includes(discoveredOrg.name.toLowerCase().replace(/foundation|fund|trust/gi, "").trim())
          ) || orgs[0]

          // Get filing details
          const { filings } = await getProPublicaDetails(bestMatch.ein)
          const mostRecentFiling = filings[0]

          affiliations.push({
            organizationName: bestMatch.name,
            ein: bestMatch.ein,
            role: discoveredOrg.context,
            proPublicaMatch: true,
            financials: mostRecentFiling ? {
              revenue: mostRecentFiling.revenue,
              assets: mostRecentFiling.assets,
              mostRecentYear: mostRecentFiling.year,
            } : undefined,
            sources: [
              {
                name: `ProPublica - ${bestMatch.name}`,
                url: `https://projects.propublica.org/nonprofits/organizations/${bestMatch.ein.replace("-", "")}`,
              },
            ],
          })

          // Add to main sources
          sources.push({
            name: `ProPublica - ${bestMatch.name}`,
            url: `https://projects.propublica.org/nonprofits/organizations/${bestMatch.ein.replace("-", "")}`,
          })
        } else {
          // Add unmatched org
          affiliations.push({
            organizationName: discoveredOrg.name,
            role: discoveredOrg.context,
            proPublicaMatch: false,
            sources: [],
          })
        }
      }

      const duration = Date.now() - startTime
      console.log("[Nonprofit Affiliation] Completed in", duration, "ms. Found", affiliations.length, "affiliations")

      const rawContent = formatResultsForAI(personName, affiliations, discoveredOrgs, linkupSearched)

      return {
        personName,
        totalAffiliations: affiliations.length,
        affiliations,
        discoveredOrgs: discoveredOrgs.map((o) => o.name),
        matchedInProPublica: affiliations.filter((a) => a.proPublicaMatch).length,
        rawContent,
        sources,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error("[Nonprofit Affiliation] Search failed:", errorMessage)

      return {
        personName,
        totalAffiliations: 0,
        affiliations: [],
        discoveredOrgs: [],
        matchedInProPublica: 0,
        rawContent: `# Nonprofit Affiliation Search: ${personName}

**Error:** ${errorMessage}

## What to Try

1. Check your network connection
2. Try searching again in a few moments
3. Search ProPublica directly with organization names

\`\`\`
propublica_nonprofit_search({ query: "Foundation Name" })
\`\`\``,
        sources: [],
        error: errorMessage,
      }
    }
  },
})

/**
 * Check if the tool should be enabled
 * Works with or without Linkup (degraded mode without it)
 */
export function shouldEnableNonprofitAffiliationTool(): boolean {
  return true // Always enabled, uses fallback if Linkup unavailable
}
